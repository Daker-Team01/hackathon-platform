import { createContext, useContext, useState, type ReactNode, useEffect, useRef } from 'react'
import {
  CHAT_SYNC_EVENT,
  createUserChatData,
  loadChatDataFromSession,
  loadOrCreateChatData,
  saveChatDataToSession,
  type ChatMessage,
  type UserChatData
} from '../utils/chatStorage'
import {
  sendMessage,
  subscribeToRoomMessages,
  subscribeToUserMemberships,
  fetchUserChatRooms,
  fetchRoomMessages,
  type SupabaseChatRoom
} from '../api/realtimeChatApi'

export type { ChatMessage, ChatRoom, UserChatData } from '../utils/chatStorage'

type ChatContextType = {
  chatData: UserChatData | null
  supabaseRooms: SupabaseChatRoom[]
  isLoadingRooms: boolean
  addMessage: (roomId: string, message: ChatMessage) => void
  addSupabaseMessage: (roomId: string, userId: string, nickname: string, content: string) => Promise<void>
  initializeChatData: (username: string, displayName?: string, supabaseUserId?: string) => void
  clearChatData: () => void
  loadSupabaseRooms: (userId: string) => Promise<void>
}

const ChatContext = createContext<ChatContextType | undefined>(undefined)

export function ChatProvider({ children }: { children: ReactNode }) {
  const [chatData, setChatData] = useState<UserChatData | null>(null)
  const [currentUsername, setCurrentUsername] = useState<string>('')
  const [currentDisplayName, setCurrentDisplayName] = useState<string>('')
  const [supabaseRooms, setSupabaseRooms] = useState<SupabaseChatRoom[]>([])
  const [isLoadingRooms, setIsLoadingRooms] = useState(false)

  const unsubscribeMapRef = useRef<Map<string, () => void>>(new Map())
  const membershipUnsubscribeRef = useRef<(() => void) | null>(null)
  const supabaseRoomIdsRef = useRef<Set<string>>(new Set())

  // 게스트 채팅 데이터 자동 초기화
  useEffect(() => {
    if (!chatData) {
      setChatData(createUserChatData('게스트'))
    }
  }, [chatData])

  useEffect(() => {
    if (!currentUsername) return

    const handleChatSync = (event: Event) => {
      const customEvent = event as CustomEvent<{ username?: string }>

      if (customEvent.detail?.username !== currentUsername) {
        return
      }

      setChatData(loadOrCreateChatData(currentUsername, currentDisplayName || currentUsername))
    }

    window.addEventListener(CHAT_SYNC_EVENT, handleChatSync as EventListener)
    return () => window.removeEventListener(CHAT_SYNC_EVENT, handleChatSync as EventListener)
  }, [currentDisplayName, currentUsername])

  // Supabase 채팅방 로드 및 실시간 구독
  const loadSupabaseRooms = async (userId: string) => {
    try {
      setIsLoadingRooms(true)
      const rooms = await fetchUserChatRooms(userId)
      const previousSupabaseRoomIds = supabaseRoomIdsRef.current
      const nextSupabaseRoomIds = new Set(rooms.map((room) => room.id))
      supabaseRoomIdsRef.current = nextSupabaseRoomIds
      setSupabaseRooms(rooms)

      // 기존 룸 구독 정리 후 재구독
      unsubscribeMapRef.current.forEach((unsubscribe) => unsubscribe())
      unsubscribeMapRef.current.clear()

      setChatData((prev) => {
        if (!prev) return prev

        const removedRoomIds = [...previousSupabaseRoomIds].filter((id) => !nextSupabaseRoomIds.has(id))

        const mergedRooms = prev.rooms.filter((room) => !removedRoomIds.includes(room.id))
        rooms.forEach((room) => {
          if (!mergedRooms.some((r) => r.id === room.id)) {
            mergedRooms.push({ id: room.id, name: room.name, unreadCount: 0 })
          }
        })

        const nextMessages = { ...prev.messages }
        removedRoomIds.forEach((roomId) => {
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
        const unsubscribe = subscribeToRoomMessages(
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
          }
        )
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
    const savedData = loadChatDataFromSession(username)
    setChatData(savedData ?? createUserChatData(username, displayName))

    // Supabase 채팅방 로드 (기본은 username, 있으면 userId 우선)
    const resolvedUserId = supabaseUserId ?? username
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
  }

  const clearChatData = () => {
    // 모든 구독 해제
    unsubscribeMapRef.current.forEach((unsubscribe) => unsubscribe())
    unsubscribeMapRef.current.clear()
    if (membershipUnsubscribeRef.current) {
      membershipUnsubscribeRef.current()
      membershipUnsubscribeRef.current = null
    }

    if (currentUsername && chatData) {
      saveChatDataToSession(currentUsername, chatData, false)
    }
    setChatData(null)
    setCurrentUsername('')
    setCurrentDisplayName('')
    setSupabaseRooms([])
    supabaseRoomIdsRef.current = new Set()
  }

  useEffect(() => {
    return () => {
      unsubscribeMapRef.current.forEach((unsubscribe) => unsubscribe())
      unsubscribeMapRef.current.clear()
      if (membershipUnsubscribeRef.current) {
        membershipUnsubscribeRef.current()
        membershipUnsubscribeRef.current = null
      }
      supabaseRoomIdsRef.current = new Set()
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

      if (currentUsername) {
        saveChatDataToSession(currentUsername, updatedChatData, false)
      }

      return updatedChatData
    })
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
        addMessage,
        addSupabaseMessage,
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
