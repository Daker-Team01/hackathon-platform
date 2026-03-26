import { createContext, useContext, useState, type ReactNode, useEffect, useRef } from 'react'
import {
  CHAT_SYNC_EVENT,
  createUserChatData,
  getLastSeenAt,
  setLastSeenAt,
  getTeamRoomId,
  loadChatDataFromSession,
  loadOrCreateChatData,
  setChatSessionPersistenceEnabled,
  saveChatDataToSession,
  type ChatMessage,
  type UserChatData
} from '../utils/chatStorage'
import {
  sendMessage,
  createChatRoom,
  addChatMember,
  removeChatMember,
  deactivateDirectRoomIfEmpty,
  subscribeToTeamChatMappingChanges,
  subscribeToRoomMessages,
  subscribeToTeamRoomLifecycle,
  subscribeToUserMemberships,
  subscribeToDmRoomMembers,
  fetchUserChatRooms,
  fetchRoomMessages,
  type TeamRoomLifecycleEvent,
  type SupabaseChatRoom
} from '../api/realtimeChatApi'

export type { ChatMessage, ChatRoom, UserChatData } from '../utils/chatStorage'

type ChatContextType = {
  chatData: UserChatData | null
  supabaseRooms: SupabaseChatRoom[]
  isLoadingRooms: boolean
  unreadDmCount: number
  addMessage: (roomId: string, message: ChatMessage) => void
  addSupabaseMessage: (roomId: string, userId: string, nickname: string, content: string) => Promise<void>
  openDirectRoom: (fromUserId: string, fromNickname: string, toUserId: string, toNickname: string) => Promise<string | null>
  leaveDirectRoom: (roomId: string) => Promise<void>
  markRoomSeen: (roomId: string) => void
  initializeChatData: (username: string, displayName?: string, supabaseUserId?: string) => void
  clearChatData: () => void
  loadSupabaseRooms: (userId: string) => Promise<void>
}

const ChatContext = createContext<ChatContextType | undefined>(undefined)

const sanitizeChatDataForSupabaseUser = (data: UserChatData): UserChatData => {
  const nextRooms = data.rooms.filter((room) => !room.id.startsWith('team:'))
  const nextMessages = Object.fromEntries(
    Object.entries(data.messages).filter(([roomId]) => !roomId.startsWith('team:'))
  )

  return {
    ...data,
    rooms: nextRooms,
    messages: nextMessages
  }
}

export function ChatProvider({ children }: { children: ReactNode }) {
  const [chatData, setChatData] = useState<UserChatData | null>(null)
  const [currentUsername, setCurrentUsername] = useState<string>('')
  const [currentDisplayName, setCurrentDisplayName] = useState<string>('')
  const [isSupabaseBackedUser, setIsSupabaseBackedUser] = useState(false)
  const [supabaseRooms, setSupabaseRooms] = useState<SupabaseChatRoom[]>([])
  const [isLoadingRooms, setIsLoadingRooms] = useState(false)

  const unsubscribeMapRef = useRef<Map<string, () => void>>(new Map())
  const membershipUnsubscribeRef = useRef<(() => void) | null>(null)
  const teamRoomLifecycleUnsubscribeRef = useRef<(() => void) | null>(null)
  const teamChatMappingUnsubscribeRef = useRef<(() => void) | null>(null)
  const supabaseRoomIdsRef = useRef<Set<string>>(new Set())
  const supabaseRoomsRef = useRef<SupabaseChatRoom[]>([])
  const currentSupabaseUserIdRef = useRef<string>('')
  const [unreadDmRoomIds, setUnreadDmRoomIds] = useState<Set<string>>(new Set())
  const activeRoomIdRef = useRef<string | null>(null)

  // 게스트 채팅 데이터 자동 초기화
  useEffect(() => {
    if (!chatData) {
      setChatData(createUserChatData('게스트'))
    }
  }, [chatData])

  useEffect(() => {
    if (!currentUsername || isSupabaseBackedUser) return

    const handleChatSync = (event: Event) => {
      const customEvent = event as CustomEvent<{ username?: string }>

      if (customEvent.detail?.username !== currentUsername) {
        return
      }

      setChatData(loadOrCreateChatData(currentUsername, currentDisplayName || currentUsername))
    }

    window.addEventListener(CHAT_SYNC_EVENT, handleChatSync as EventListener)
    return () => window.removeEventListener(CHAT_SYNC_EVENT, handleChatSync as EventListener)
  }, [currentDisplayName, currentUsername, isSupabaseBackedUser])

  // Supabase 채팅방 로드 및 실시간 구독
  const loadSupabaseRooms = async (userId: string) => {
    try {
      setIsLoadingRooms(true)
      const rooms = await fetchUserChatRooms(userId)
      const previousSupabaseRooms = supabaseRoomsRef.current
      const previousSupabaseRoomIds = supabaseRoomIdsRef.current
      const nextSupabaseRoomIds = new Set(rooms.map((room) => room.id))
      supabaseRoomIdsRef.current = nextSupabaseRoomIds
      supabaseRoomsRef.current = rooms
      setSupabaseRooms(rooms)

      // DM 미읽음 알림 체크
      const dmUserId = currentSupabaseUserIdRef.current
      if (dmUserId) {
        setUnreadDmRoomIds((prev) => {
          const next = new Set(prev)
          // 삭제된 방 제거
          prev.forEach((id) => {
            if (!rooms.some((r) => r.id === id)) next.delete(id)
          })
          // 각 DM 방 검사
          rooms.forEach((room) => {
            if (room.room_type !== 'direct') return
            const lastSeen = getLastSeenAt(dmUserId, room.id)
            
            // 현재 보고 있는 방은 unread 제외
            if (room.id === activeRoomIdRef.current) {
              next.delete(room.id)
              // 현재 방의 lastSeen 업데이트
              setLastSeenAt(dmUserId, room.id, new Date().toISOString())
            } 
            // lastSeen이 없으면 새 방 → 무조건 unread 추가
            else if (!lastSeen) {
              next.add(room.id)
              // 초기 lastSeen은 room.updated_at - 1초로 설정 (이후 새 메시지만 감지)
              const initialTime = new Date(new Date(room.updated_at).getTime() - 1000).toISOString()
              setLastSeenAt(dmUserId, room.id, initialTime)
            } 
            // lastSeen이 있으면 최신 메시지 확인
            else if (new Date(room.updated_at) > new Date(lastSeen)) {
              next.add(room.id)
            } 
            // 미읽음이 있는데 이미 로드됐으면 유지
            else if (next.has(room.id)) {
              // 유지
            } 
            // 아니면 읽음으로 표시
            else {
              next.delete(room.id)
            }
          })
          return next
        })
      }

      // 기존 룸 구독 정리 후 재구독
      unsubscribeMapRef.current.forEach((unsubscribe) => unsubscribe())
      unsubscribeMapRef.current.clear()

      setChatData((prev) => {
        if (!prev) return prev

        const removedRoomIds = [...previousSupabaseRoomIds].filter((id) => !nextSupabaseRoomIds.has(id))
        const removedLegacyTeamRoomIds = previousSupabaseRooms
          .filter((room) => removedRoomIds.includes(room.id) && room.room_type === 'team' && room.team_id)
          .map((room) => getTeamRoomId(room.team_id!))

        // 로그인 직후에는 previousSupabaseRoomIds가 비어 있을 수 있어,
        // 현재 활성 Supabase 팀방 목록에 없는 로컬 team:* 방은 항상 정리한다.
        const activeLegacyTeamRoomIds = new Set(
          rooms
            .filter((room) => room.room_type === 'team' && Boolean(room.team_id))
            .map((room) => getTeamRoomId(room.team_id!))
        )
        const staleLegacyTeamRoomIds = prev.rooms
          .filter((room) => room.id.startsWith('team:') && !activeLegacyTeamRoomIds.has(room.id))
          .map((room) => room.id)

        const allRemovedRoomIds = new Set([
          ...removedRoomIds,
          ...removedLegacyTeamRoomIds,
          ...staleLegacyTeamRoomIds
        ])

        const mergedRooms = prev.rooms.filter((room) => !allRemovedRoomIds.has(room.id))
        rooms.forEach((room) => {
          if (!mergedRooms.some((r) => r.id === room.id)) {
            mergedRooms.push({ id: room.id, name: room.name, unreadCount: 0 })
          }
        })

        const nextMessages = { ...prev.messages }
        allRemovedRoomIds.forEach((roomId) => {
          delete nextMessages[roomId]
        })

        return {
          ...prev,
          rooms: mergedRooms,
          messages: nextMessages
        }
      })

      for (const room of rooms) {
        const { messages } = await fetchRoomMessages(room.id, 50, 0)
        setChatData((prev) => {
          if (!prev) return prev

          const mappedMessages: ChatMessage[] = messages.map((message) => ({
            id: message.id,
            user: message.user_nickname,
            text: message.content,
            timestamp: new Date(message.created_at).toLocaleTimeString('ko-KR')
          }))

          return {
            ...prev,
            messages: {
              ...prev.messages,
              [room.id]: mappedMessages
            }
          }
        })
      }

      // 각 채팅방의 메시지 실시간 구독
      rooms.forEach((room) => {
        const unsubscribeMessages = subscribeToRoomMessages(
          room.id,
          (message) => {
            // 새 메시지를 로컬 채팅 데이터에 추가
            const chatMessage: ChatMessage = {
              id: message.id,
              user: message.user_nickname,
              text: message.content,
              timestamp: new Date(message.created_at).toLocaleTimeString('ko-KR')
            }
            addMessage(room.id, chatMessage)
            // DM 방의 새 메시지: 현재 해당 방을 보고 있지 않으면 미읽음 표시
            if (room.room_type === 'direct' && room.id !== activeRoomIdRef.current) {
              setUnreadDmRoomIds((prev) => new Set([...prev, room.id]))
            }
          }
        )
        
        // DM 방의 멤버십 변경 구독 (상대방이 나가면 감지)
        let unsubscribeMembers: (() => void) | undefined
        if (room.room_type === 'direct') {
          unsubscribeMembers = subscribeToDmRoomMembers(
            room.id,
            () => {
              // 멤버십이 변경되면 방 목록 다시 로드
              const userId = currentSupabaseUserIdRef.current
              if (userId) loadSupabaseRooms(userId)
            }
          )
        }
        
        // 두 구독 모두 정리하는 unsubscribe 함수
        const unsubscribe = () => {
          unsubscribeMessages()
          unsubscribeMembers?.()
        }
        
        unsubscribeMapRef.current.set(room.id, unsubscribe)
      })
    } catch (error) {
      console.error('Failed to load Supabase rooms:', error)
    } finally {
      setIsLoadingRooms(false)
    }
  }

  const initializeChatData = (username: string, displayName = username, supabaseUserId?: string) => {
    setCurrentUsername(username)
    setCurrentDisplayName(displayName)
    const isSupabaseUser = Boolean(supabaseUserId)
    setIsSupabaseBackedUser(isSupabaseUser)
    setChatSessionPersistenceEnabled(!isSupabaseUser)

    const savedData = isSupabaseUser ? null : loadChatDataFromSession(username)
    const initialData = savedData ?? createUserChatData(username, displayName)

    // 로그인 사용자는 팀 채팅방 상태를 Supabase를 source-of-truth로 사용한다.
    // 오래된 sessionStorage(team:*)가 복원되며 화면을 덮어쓰는 문제를 방지한다.
    setChatData(isSupabaseUser ? sanitizeChatDataForSupabaseUser(initialData) : initialData)

    // Supabase 채팅방 로드 (기본은 username, 있으면 userId 우선)
    const resolvedUserId = supabaseUserId ?? username
    currentSupabaseUserIdRef.current = resolvedUserId
    loadSupabaseRooms(resolvedUserId)

    // 유저의 chat_members 변경(초대 수락/강퇴 등)을 실시간 반영
    if (membershipUnsubscribeRef.current) {
      membershipUnsubscribeRef.current()
      membershipUnsubscribeRef.current = null
    }

    membershipUnsubscribeRef.current = subscribeToUserMemberships(
      resolvedUserId,
      () => {
        loadSupabaseRooms(resolvedUserId)
      },
      (error) => {
        console.error('Failed to subscribe to membership changes:', error)
      }
    )

    if (teamRoomLifecycleUnsubscribeRef.current) {
      teamRoomLifecycleUnsubscribeRef.current()
      teamRoomLifecycleUnsubscribeRef.current = null
    }

    teamRoomLifecycleUnsubscribeRef.current = subscribeToTeamRoomLifecycle(
      (room: TeamRoomLifecycleEvent) => {
        if (room.team_id && (room.is_active === false || room._action === 'DELETE')) {
          const legacyRoomId = getTeamRoomId(room.team_id)
          setChatData((prev) => {
            if (!prev) return prev

            if (!prev.rooms.some((candidate) => candidate.id === legacyRoomId) && !prev.messages[legacyRoomId]) {
              return prev
            }

            const nextMessages = { ...prev.messages }
            delete nextMessages[legacyRoomId]

            return {
              ...prev,
              rooms: prev.rooms.filter((candidate) => candidate.id !== legacyRoomId),
              messages: nextMessages
            }
          })
        }

        const currentUserId = currentSupabaseUserIdRef.current
        if (currentUserId) {
          loadSupabaseRooms(currentUserId)
        }
      },
      (error) => {
        console.error('Failed to subscribe to team room lifecycle changes:', error)
      }
    )

    if (teamChatMappingUnsubscribeRef.current) {
      teamChatMappingUnsubscribeRef.current()
      teamChatMappingUnsubscribeRef.current = null
    }

    teamChatMappingUnsubscribeRef.current = subscribeToTeamChatMappingChanges(
      (mapping) => {
        if (mapping.team_id) {
          const legacyRoomId = getTeamRoomId(mapping.team_id)
          setChatData((prev) => {
            if (!prev) return prev

            const hasLegacyRoom = prev.rooms.some((candidate) => candidate.id === legacyRoomId)
            const hasLegacyMessages = Boolean(prev.messages[legacyRoomId])

            if (!hasLegacyRoom && !hasLegacyMessages) {
              return prev
            }

            const nextMessages = { ...prev.messages }
            delete nextMessages[legacyRoomId]

            return {
              ...prev,
              rooms: prev.rooms.filter((candidate) => candidate.id !== legacyRoomId),
              messages: nextMessages
            }
          })
        }

        const currentUserId = currentSupabaseUserIdRef.current
        if (currentUserId) {
          loadSupabaseRooms(currentUserId)
        }
      },
      (error) => {
        console.error('Failed to subscribe to team chat mapping changes:', error)
      }
    )
  }

  const clearChatData = () => {
    // 모든 구독 해제
    unsubscribeMapRef.current.forEach((unsubscribe) => unsubscribe())
    unsubscribeMapRef.current.clear()
    if (membershipUnsubscribeRef.current) {
      membershipUnsubscribeRef.current()
      membershipUnsubscribeRef.current = null
    }
    if (teamRoomLifecycleUnsubscribeRef.current) {
      teamRoomLifecycleUnsubscribeRef.current()
      teamRoomLifecycleUnsubscribeRef.current = null
    }
    if (teamChatMappingUnsubscribeRef.current) {
      teamChatMappingUnsubscribeRef.current()
      teamChatMappingUnsubscribeRef.current = null
    }

    if (!isSupabaseBackedUser && currentUsername && chatData) {
      saveChatDataToSession(currentUsername, chatData, false)
    }
    setChatData(null)
    setCurrentUsername('')
    setCurrentDisplayName('')
    setIsSupabaseBackedUser(false)
    setChatSessionPersistenceEnabled(true)
    setSupabaseRooms([])
    setUnreadDmRoomIds(new Set())
    activeRoomIdRef.current = null
    supabaseRoomIdsRef.current = new Set()
    supabaseRoomsRef.current = []
    currentSupabaseUserIdRef.current = ''
  }

  useEffect(() => {
    return () => {
      unsubscribeMapRef.current.forEach((unsubscribe) => unsubscribe())
      unsubscribeMapRef.current.clear()
      if (membershipUnsubscribeRef.current) {
        membershipUnsubscribeRef.current()
        membershipUnsubscribeRef.current = null
      }
      if (teamRoomLifecycleUnsubscribeRef.current) {
        teamRoomLifecycleUnsubscribeRef.current()
        teamRoomLifecycleUnsubscribeRef.current = null
      }
      if (teamChatMappingUnsubscribeRef.current) {
        teamChatMappingUnsubscribeRef.current()
        teamChatMappingUnsubscribeRef.current = null
      }
      supabaseRoomIdsRef.current = new Set()
      supabaseRoomsRef.current = []
      currentSupabaseUserIdRef.current = ''
      setUnreadDmRoomIds(new Set())
      activeRoomIdRef.current = null
      setIsSupabaseBackedUser(false)
      setChatSessionPersistenceEnabled(true)
    }
  }, [])

  const addMessage = (roomId: string, message: ChatMessage) => {
    setChatData((prevChatData) => {
      if (!prevChatData) return prevChatData

      const roomMessages = prevChatData.messages[roomId] || []
      const existingIndex = roomMessages.findIndex((candidate) => candidate.id === message.id)
      const nextRoomMessages = [...roomMessages]

      if (existingIndex === -1) {
        nextRoomMessages.push(message)
      } else {
        nextRoomMessages[existingIndex] = message
      }

      const updatedChatData = {
        ...prevChatData,
        messages: {
          ...prevChatData.messages,
          [roomId]: nextRoomMessages
        }
      }

      if (currentUsername && !isSupabaseBackedUser) {
        saveChatDataToSession(currentUsername, updatedChatData, false)
      }

      return updatedChatData
    })
  }

  const leaveDirectRoom = async (roomId: string): Promise<void> => {
    const userId = currentSupabaseUserIdRef.current
    if (!userId) return
    await removeChatMember(roomId, userId)
    // 방이 비어있으면 chat_rooms.is_active = false로 설정
    await deactivateDirectRoomIfEmpty(roomId)
    await loadSupabaseRooms(userId)
  }

  const markRoomSeen = (roomId: string) => {
    activeRoomIdRef.current = roomId
    setUnreadDmRoomIds((prev) => {
      const next = new Set(prev)
      next.delete(roomId)
      return next
    })
    const userId = currentSupabaseUserIdRef.current
    if (userId) setLastSeenAt(userId, roomId, new Date().toISOString())
  }

  const openDirectRoom = async (
    fromUserId: string,
    fromNickname: string,
    toUserId: string,
    toNickname: string
  ): Promise<string | null> => {
    try {
      const room = await createChatRoom(
        `${fromNickname} ↔ ${toNickname}`,
        'direct',
        undefined,
        fromUserId
      )
      if (!room) return null
      await addChatMember(room.id, fromUserId, fromNickname)
      await addChatMember(room.id, toUserId, toNickname)
      const currentUserId = currentSupabaseUserIdRef.current
      if (currentUserId) {
        await loadSupabaseRooms(currentUserId)
      }
      return room.id
    } catch (error) {
      console.error('Failed to open direct room:', error)
      return null
    }
  }

  const addSupabaseMessage = async (roomId: string, userId: string, nickname: string, content: string) => {
    try {
      const message = await sendMessage(roomId, userId, nickname, content, 'text')
      if (!message) throw new Error('Failed to send message')

      // 실시간 수신이 지연/누락되어도 즉시 화면에 반영
      addMessage(roomId, {
        id: message.id,
        user: message.user_nickname,
        text: message.content,
        timestamp: new Date(message.created_at).toLocaleTimeString('ko-KR')
      })
    } catch (error) {
      console.error('Failed to add Supabase message:', error)
      throw error
    }
  }

  return (
    <ChatContext.Provider
      value={{
        chatData,
        supabaseRooms,
        isLoadingRooms,
        unreadDmCount: unreadDmRoomIds.size,
        addMessage,
        addSupabaseMessage,
        openDirectRoom,
        leaveDirectRoom,
        markRoomSeen,
        initializeChatData,
        clearChatData,
        loadSupabaseRooms
      }}
    >
      {children}
    </ChatContext.Provider>
  )
}

export function useChat() {
  const context = useContext(ChatContext)
  if (context === undefined) {
    throw new Error('useChat must be used within ChatProvider')
  }
  return context
}
