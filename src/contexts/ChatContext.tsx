import { createContext, useContext, useState, type ReactNode, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import {
  clearLegacyChatStorage,
  createEmptyChatData,
  getLastSeenAt,
  setLastSeenAt,
  getTeamRoomId,
  type ChatMessage,
  type UserChatData
} from '../utils/chatStorage'
import {
  consumeGeneralChatNotifications,
  GENERAL_CHAT_NOTIFICATION_EVENT,
  GENERAL_CHAT_NOTIFICATION_STORAGE_PREFIX
} from '../utils/generalChatNotifications'
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
  ensureGeneralRoomForUser,
  ensureNoticeRoomForUser,
  cleanupDuplicatePersonalGeneralRooms,
  fetchUserChatRooms,
  fetchRoomMessages,
  sendSystemMessage,
  type TeamRoomLifecycleEvent,
  type SupabaseChatRoom
} from '../api/realtimeChatApi'

export type { ChatMessage, ChatRoom, UserChatData } from '../utils/chatStorage'

type ChatContextType = {
  chatData: UserChatData | null
  supabaseRooms: SupabaseChatRoom[]
  isLoadingRooms: boolean
  roomActivityAt: Record<string, number>
  unreadTotalCount: number
  unreadDmCount: number
  unreadNoticeCount: number
  unreadRoomCounts: Record<string, number>
  addMessage: (roomId: string, message: ChatMessage) => void
  addGeneralSystemMessage: (content: string) => Promise<void>
  addSupabaseMessage: (roomId: string, userId: string, nickname: string, content: string) => Promise<void>
  openDirectRoom: (fromUserId: string, fromNickname: string, toUserId: string, toNickname: string) => Promise<string | null>
  findDirectRoomWithUser: (userId1: string, userId2: string) => Promise<string | null>
  getOrCreateDirectRoomWithUser: (userId1: string, nickname1: string, userId2: string, nickname2: string) => Promise<string | null>
  leaveDirectRoom: (roomId: string) => Promise<void>
  markRoomSeen: (roomId: string) => void
  initializeChatData: (username: string, displayName?: string, supabaseUserId?: string) => void
  clearChatData: () => void
  loadSupabaseRooms: (userId: string) => Promise<void>
}

const ChatContext = createContext<ChatContextType | undefined>(undefined)

const sanitizeChatDataForSupabaseUser = (data: UserChatData): UserChatData => {
  const nextRooms = data.rooms.filter((room) => !room.id.startsWith('team:') && !['1', '2', '3'].includes(room.id))
  const nextMessages = Object.fromEntries(
    Object.entries(data.messages).filter(([roomId]) => !roomId.startsWith('team:') && !['1', '2', '3'].includes(roomId))
  )

  return {
    ...data,
    rooms: nextRooms,
    messages: nextMessages
  }
}

export function ChatProvider({ children }: { children: ReactNode }) {
  const [chatData, setChatData] = useState<UserChatData | null>(() => createEmptyChatData())
  const [currentUsername, setCurrentUsername] = useState<string>('')
  const [currentDisplayName, setCurrentDisplayName] = useState<string>('')
  const [supabaseRooms, setSupabaseRooms] = useState<SupabaseChatRoom[]>([])
  const [isLoadingRooms, setIsLoadingRooms] = useState(false)
  const [roomActivityAt, setRoomActivityAt] = useState<Record<string, number>>({})

  const unsubscribeMapRef = useRef<Map<string, () => void>>(new Map())
  const membershipUnsubscribeRef = useRef<(() => void) | null>(null)
  const teamRoomLifecycleUnsubscribeRef = useRef<(() => void) | null>(null)
  const teamChatMappingUnsubscribeRef = useRef<(() => void) | null>(null)
  const roomSyncIntervalRef = useRef<number | null>(null)
  const supabaseRoomIdsRef = useRef<Set<string>>(new Set())
  const supabaseRoomsRef = useRef<SupabaseChatRoom[]>([])
  const currentSupabaseUserIdRef = useRef<string>('')
  const loadSupabaseRoomsRequestIdRef = useRef(0)
  const cleanedPersonalGeneralRoomsRef = useRef<Set<string>>(new Set())
  const [unreadRoomCountsState, setUnreadRoomCountsState] = useState<Record<string, number>>({})
  const activeRoomIdRef = useRef<string | null>(null)

  const flushGeneralNotificationQueueToSupabase = async (userId: string, nickname: string) => {
    const queued = consumeGeneralChatNotifications(userId)
    if (queued.length === 0) return

    const room = await ensureGeneralRoomForUser(userId, nickname)
    if (!room) return

    for (const notification of queued) {
      await sendSystemMessage(room.id, notification.text)
    }
  }

  useEffect(() => {
    const handleGeneralNotification = (event: Event) => {
      const customEvent = event as CustomEvent<{ userId?: string }>
      const userId = customEvent.detail?.userId

      if (!userId || userId !== currentSupabaseUserIdRef.current) {
        return
      }

      void flushGeneralNotificationQueueToSupabase(userId, currentDisplayName || currentUsername || userId)
      void loadSupabaseRooms(userId)
    }

    window.addEventListener(GENERAL_CHAT_NOTIFICATION_EVENT, handleGeneralNotification as EventListener)
    return () => window.removeEventListener(GENERAL_CHAT_NOTIFICATION_EVENT, handleGeneralNotification as EventListener)
  }, [])

  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      const currentUserId = currentSupabaseUserIdRef.current
      if (!currentUserId || !event.key) return

      const targetKey = `${GENERAL_CHAT_NOTIFICATION_STORAGE_PREFIX}${currentUserId}`
      if (event.key !== targetKey) return

      void flushGeneralNotificationQueueToSupabase(currentUserId, currentDisplayName || currentUsername || currentUserId)
      void loadSupabaseRooms(currentUserId)
    }

    window.addEventListener('storage', handleStorage)
    return () => window.removeEventListener('storage', handleStorage)
  }, [])

  // Supabase 채팅방 로드 및 실시간 구독
  const loadSupabaseRooms = async (userId: string) => {
    const requestId = ++loadSupabaseRoomsRequestIdRef.current
    const isStale = () => requestId !== loadSupabaseRoomsRequestIdRef.current

    try {
      setIsLoadingRooms(true)

      if (!cleanedPersonalGeneralRoomsRef.current.has(userId)) {
        await cleanupDuplicatePersonalGeneralRooms(userId)
        cleanedPersonalGeneralRoomsRef.current.add(userId)
      }

      let rooms = await fetchUserChatRooms(userId)

      if (isStale()) return

      const hasGeneralRoom = rooms.some((room) => room.room_type === 'general' && room.name === '일반')
      const hasNoticeRoom = rooms.some((room) => room.room_type === 'general' && room.name === '공지')

      if (!hasGeneralRoom || !hasNoticeRoom) {
        const nickname = currentDisplayName || currentUsername || userId
        if (!hasGeneralRoom) {
          await ensureGeneralRoomForUser(userId, nickname)
        }
        if (!hasNoticeRoom) {
          await ensureNoticeRoomForUser(userId, nickname)
        }
        rooms = await fetchUserChatRooms(userId)
        if (isStale()) return
      }

      const previousSupabaseRooms = supabaseRoomsRef.current
      const previousSupabaseRoomIds = supabaseRoomIdsRef.current
      const nextSupabaseRoomIds = new Set(rooms.map((room) => room.id))
      supabaseRoomIdsRef.current = nextSupabaseRoomIds
      supabaseRoomsRef.current = rooms
      setSupabaseRooms(rooms)

      setUnreadRoomCountsState((prev) => {
        const next: Record<string, number> = {}
        Object.entries(prev).forEach(([roomId, count]) => {
          if (rooms.some((room) => room.id === roomId) && count > 0) {
            next[roomId] = count
          }
        })
        return next
      })

      setRoomActivityAt((prev) => {
        const next: Record<string, number> = {}
        rooms.forEach((room) => {
          const roomUpdatedAt = Date.parse(room.updated_at)
          const fallback = Number.isNaN(roomUpdatedAt) ? Date.now() : roomUpdatedAt
          next[room.id] = Math.max(prev[room.id] ?? 0, fallback)
        })
        return next
      })

      if (isStale()) return

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

      const nextUnreadCounts: Record<string, number> = {}

      for (const room of rooms) {
        const { messages } = await fetchRoomMessages(room.id, 50, 0)
        if (isStale()) return

        const currentUserId = currentSupabaseUserIdRef.current
        if (currentUserId) {
          const isActiveRoom = room.id === activeRoomIdRef.current
          if (isActiveRoom) {
            setLastSeenAt(currentUserId, room.id, new Date().toISOString())
          } else {
            const lastSeen = getLastSeenAt(currentUserId, room.id)
            if (!lastSeen) {
              // 사용자별로 아직 확인하지 않은 방이면 미읽음을 유지한다.
              const unreadCount = messages.filter((message) => message.user_id !== currentUserId).length
              if (unreadCount > 0) {
                nextUnreadCounts[room.id] = unreadCount
              }
            } else {
              const unreadCount = messages.filter((message) => {
                if (message.user_id === currentUserId) return false
                return new Date(message.created_at) > new Date(lastSeen)
              }).length
              if (unreadCount > 0) {
                nextUnreadCounts[room.id] = unreadCount
              }
            }
          }
        }

        setChatData((prev) => {
          if (!prev) return prev

          const mappedMessages: ChatMessage[] = messages.map((message) => ({
            id: message.id,
            userId: message.user_id,
            user: message.user_nickname,
            text: message.content,
            timestamp: new Date(message.created_at).toLocaleTimeString('ko-KR'),
            createdAt: message.created_at
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

      setUnreadRoomCountsState(nextUnreadCounts)

      if (isStale()) return

      // 각 채팅방의 메시지 실시간 구독
      rooms.forEach((room) => {
        if (isStale()) return
        const unsubscribeMessages = subscribeToRoomMessages(
          room.id,
          (message) => {
            // 새 메시지를 로컬 채팅 데이터에 추가
            const chatMessage: ChatMessage = {
              id: message.id,
              userId: message.user_id,
              user: message.user_nickname,
              text: message.content,
              timestamp: new Date(message.created_at).toLocaleTimeString('ko-KR'),
              createdAt: message.created_at
            }
            addMessage(room.id, chatMessage)
            const createdAtMs = Date.parse(message.created_at)
            setRoomActivityAt((prev) => ({
              ...prev,
              [room.id]: Number.isNaN(createdAtMs) ? Date.now() : createdAtMs
            }))

            const currentUserId = currentSupabaseUserIdRef.current
            if (!currentUserId || message.user_id === currentUserId) return

            if (room.id === activeRoomIdRef.current) {
              setLastSeenAt(currentUserId, room.id, new Date().toISOString())
              setUnreadRoomCountsState((prev) => {
                if (!prev[room.id]) return prev
                return {
                  ...prev,
                  [room.id]: 0
                }
              })
            } else {
              setUnreadRoomCountsState((prev) => ({
                ...prev,
                [room.id]: (prev[room.id] ?? 0) + 1
              }))
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
      if (!isStale()) {
        setIsLoadingRooms(false)
      }
    }
  }

  const initializeChatData = (username: string, displayName = username, supabaseUserId?: string) => {
    setCurrentUsername(username)
    setCurrentDisplayName(displayName)
    const resolvedUserId = supabaseUserId ?? username
    clearLegacyChatStorage()
    loadSupabaseRoomsRequestIdRef.current += 1
    activeRoomIdRef.current = null
    setUnreadRoomCountsState({})
    setRoomActivityAt({})

    // 로그인 사용자는 팀 채팅방 상태를 Supabase를 source-of-truth로 사용한다.
    // 오래된 sessionStorage(team:*)가 복원되며 화면을 덮어쓰는 문제를 방지한다.
    setChatData(sanitizeChatDataForSupabaseUser(createEmptyChatData()))

    // Supabase 채팅방 로드 (기본은 username, 있으면 userId 우선)
    currentSupabaseUserIdRef.current = resolvedUserId

    if (roomSyncIntervalRef.current !== null) {
      window.clearInterval(roomSyncIntervalRef.current)
      roomSyncIntervalRef.current = null
    }

    void (async () => {
      await ensureGeneralRoomForUser(resolvedUserId, displayName)
      await ensureNoticeRoomForUser(resolvedUserId, displayName)
      await flushGeneralNotificationQueueToSupabase(resolvedUserId, displayName)
      await loadSupabaseRooms(resolvedUserId)
    })()

    // Realtime 누락/지연 대비: 주기적으로 방/메시지 동기화
    roomSyncIntervalRef.current = window.setInterval(() => {
      const currentUserId = currentSupabaseUserIdRef.current
      if (!currentUserId) return
      void loadSupabaseRooms(currentUserId)
    }, 3000)

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

    if (roomSyncIntervalRef.current !== null) {
      window.clearInterval(roomSyncIntervalRef.current)
      roomSyncIntervalRef.current = null
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
    loadSupabaseRoomsRequestIdRef.current += 1

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

    clearLegacyChatStorage()
    setChatData(createEmptyChatData())
    setCurrentUsername('')
    setCurrentDisplayName('')
    setSupabaseRooms([])
    setRoomActivityAt({})
    setUnreadRoomCountsState({})
    activeRoomIdRef.current = null
    supabaseRoomIdsRef.current = new Set()
    supabaseRoomsRef.current = []
    currentSupabaseUserIdRef.current = ''
    cleanedPersonalGeneralRoomsRef.current.clear()
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
      if (roomSyncIntervalRef.current !== null) {
        window.clearInterval(roomSyncIntervalRef.current)
        roomSyncIntervalRef.current = null
      }
      supabaseRoomIdsRef.current = new Set()
      supabaseRoomsRef.current = []
      currentSupabaseUserIdRef.current = ''
      cleanedPersonalGeneralRoomsRef.current.clear()
      setRoomActivityAt({})
      setUnreadRoomCountsState({})
      activeRoomIdRef.current = null
      clearLegacyChatStorage()
    }
  }, [])

  // 초기 fetch/실시간 반영 후 메시지 데이터 기준으로 unread를 재동기화한다.
  useEffect(() => {
    const currentUserId = currentSupabaseUserIdRef.current
    if (!currentUserId || !chatData) return

    const nextUnreadCounts: Record<string, number> = {}

    for (const room of supabaseRooms) {
      const messages = chatData.messages[room.id] || []
      const lastSeen = getLastSeenAt(currentUserId, room.id)

      const unreadCount = messages.filter((message) => {
        if (message.userId === currentUserId) return false
        if (!message.createdAt) return false
        if (!lastSeen) return true
        return new Date(message.createdAt) > new Date(lastSeen)
      }).length

      if (unreadCount > 0) {
        nextUnreadCounts[room.id] = unreadCount
      }
    }

    setUnreadRoomCountsState((prev) => {
      const prevSerialized = JSON.stringify(prev)
      const nextSerialized = JSON.stringify(nextUnreadCounts)
      if (prevSerialized === nextSerialized) return prev
      return nextUnreadCounts
    })
  }, [chatData, supabaseRooms])

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
    setUnreadRoomCountsState((prev) => {
      if (!prev[roomId]) return prev
      return {
        ...prev,
        [roomId]: 0
      }
    })
    const userId = currentSupabaseUserIdRef.current
    if (userId) setLastSeenAt(userId, roomId, new Date().toISOString())
  }

  // 두 유저가 함께 속한 활성 direct room 탐색
  const findDirectRoomWithUser = async (userId1: string, userId2: string): Promise<string | null> => {
    if (!userId1 || !userId2 || userId1 === userId2) return null

    try {
      const { data: commonRooms, error } = await supabase
        .from('chat_members')
        .select('room_id')
        .eq('user_id', userId1)
        .eq('is_active', true)

      if (error) throw error

      if (commonRooms && commonRooms.length > 0) {
        const roomIds = commonRooms.map((r) => r.room_id)
        const { data: directRooms } = await supabase
          .from('chat_rooms')
          .select('*')
          .in('id', roomIds)
          .eq('room_type', 'direct')
          .eq('is_active', true)

        if (directRooms && directRooms.length > 0) {
          for (const room of directRooms) {
            const { data: members } = await supabase
              .from('chat_members')
              .select('user_id')
              .eq('room_id', room.id)
              .eq('user_id', userId2)
              .eq('is_active', true)

            if (members && members.length > 0) {
              return room.id
            }
          }
        }
      }

      return null
    } catch (error) {
      console.error('Failed to find direct room:', error)
      return null
    }
  }

  // 두 유저 간의 DM 방 찾거나 생성
  const getOrCreateDirectRoomWithUser = async (userId1: string, nickname1: string, userId2: string, nickname2: string): Promise<string | null> => {
    try {
      const existingRoomId = await findDirectRoomWithUser(userId1, userId2)
      if (existingRoomId) {
        return existingRoomId
      }

      const newRoomId = await openDirectRoom(userId1, nickname1, userId2, nickname2)
      return newRoomId
    } catch (error) {
      console.error('Failed to get or create direct room:', error)
      return null
    }
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
        userId: message.user_id,
        user: message.user_nickname,
        text: message.content,
        timestamp: new Date(message.created_at).toLocaleTimeString('ko-KR'),
        createdAt: message.created_at
      })
    } catch (error) {
      console.error('Failed to add Supabase message:', error)
      throw error
    }
  }

  const addGeneralSystemMessage = async (content: string): Promise<void> => {
    const userId = currentSupabaseUserIdRef.current
    if (!userId) return

    const nickname = currentDisplayName || currentUsername || userId
    const room = await ensureGeneralRoomForUser(userId, nickname)
    if (!room) return

    await sendSystemMessage(room.id, content)
  }

  return (
    <ChatContext.Provider
      value={{
        chatData,
        supabaseRooms,
        isLoadingRooms,
        roomActivityAt,
        unreadTotalCount: Object.values(unreadRoomCountsState).reduce((sum, count) => sum + count, 0),
        unreadDmCount: supabaseRooms
          .filter((room) => room.room_type === 'direct')
          .reduce((sum, room) => sum + (unreadRoomCountsState[room.id] ?? 0), 0),
        unreadNoticeCount: supabaseRooms
          .filter((room) => room.room_type === 'general' && room.name === '공지')
          .reduce((sum, room) => sum + (unreadRoomCountsState[room.id] ?? 0), 0),
        unreadRoomCounts: unreadRoomCountsState,
        addMessage,
        addGeneralSystemMessage,
        addSupabaseMessage,
        openDirectRoom,
        findDirectRoomWithUser,
        getOrCreateDirectRoomWithUser,
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
