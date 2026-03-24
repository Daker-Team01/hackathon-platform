import { createContext, useContext, useState, type ReactNode, useEffect } from 'react'
import {
  CHAT_SYNC_EVENT,
  createUserChatData,
  loadChatDataFromSession,
  loadOrCreateChatData,
  saveChatDataToSession,
  type ChatMessage,
  type UserChatData
} from '../utils/chatStorage'

export type { ChatMessage, ChatRoom, UserChatData } from '../utils/chatStorage'

type ChatContextType = {
  chatData: UserChatData | null
  addMessage: (roomId: string, message: ChatMessage) => void
  initializeChatData: (username: string, displayName?: string) => void
  clearChatData: () => void
}

const ChatContext = createContext<ChatContextType | undefined>(undefined)

export function ChatProvider({ children }: { children: ReactNode }) {
  const [chatData, setChatData] = useState<UserChatData | null>(null)
  const [currentUsername, setCurrentUsername] = useState<string>('')
  const [currentDisplayName, setCurrentDisplayName] = useState<string>('')

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

  const initializeChatData = (username: string, displayName = username) => {
    setCurrentUsername(username)
    setCurrentDisplayName(displayName)
    const savedData = loadChatDataFromSession(username)
    setChatData(savedData ?? createUserChatData(username, displayName))
  }

  const clearChatData = () => {
    if (currentUsername && chatData) {
      saveChatDataToSession(currentUsername, chatData, false)
    }
    setChatData(null)
    setCurrentUsername('')
    setCurrentDisplayName('')
  }

  const addMessage = (roomId: string, message: ChatMessage) => {
    setChatData((prevChatData) => {
      if (!prevChatData) return prevChatData

      const updatedChatData = {
        ...prevChatData,
        messages: {
          ...prevChatData.messages,
          [roomId]: [...(prevChatData.messages[roomId] || []), message]
        }
      }

      if (currentUsername) {
        saveChatDataToSession(currentUsername, updatedChatData, false)
      }

      return updatedChatData
    })
  }

  return (
    <ChatContext.Provider value={{ chatData, addMessage, initializeChatData, clearChatData }}>
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
