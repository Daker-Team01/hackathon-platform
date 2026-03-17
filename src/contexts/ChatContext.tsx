import { createContext, useContext, useState, type ReactNode, useEffect } from 'react'

export type ChatMessage = {
  id: string
  user: string
  text: string
  timestamp: string
  action?: {
    label: string
    path: string
  }
}

export type ChatRoom = {
  id: string
  name: string
  unreadCount: number
}

export type UserChatData = {
  rooms: ChatRoom[]
  messages: { [roomId: string]: ChatMessage[] }
}

type ChatContextType = {
  chatData: UserChatData | null
  addMessage: (roomId: string, message: ChatMessage) => void
  initializeChatData: (username: string) => void
  clearChatData: () => void
}

const ChatContext = createContext<ChatContextType | undefined>(undefined)

// 사용자별 채팅 데이터 초기값 생성
const createUserChatData = (username: string): UserChatData => ({
  rooms: [
    { id: '1', name: '일반', unreadCount: 0 },
    { id: '2', name: '공지', unreadCount: 0 },
    { id: '3', name: '팀 찾기', unreadCount: 0 },
    { id: '4', name: '🤖 챗봇', unreadCount: 0 }
  ],
  messages: {
    '1': [
      { id: '1', user: 'Admin', text: `안녕하세요! ${username}님 환영합니다.`, timestamp: '10:00' }
    ],
    '2': [
      { id: '1', user: 'Admin', text: '[공지] 해커톤이 시작되었습니다!', timestamp: '09:00' }
    ],
    '3': [],
    '4': [
      { id: '1', user: 'Chatbot', text: '안녕하세요! 저는 해커톤 플랫폼 챗봇입니다. 해커톤, 팀, 랭킹 등에 대해 궁금하신 점을 물어보세요! 📚', timestamp: '10:00' }
    ]
  }
})

// sessionStorage에서 채팅 데이터 불러오기
const loadChatDataFromSession = (username: string): UserChatData | null => {
  const storageKey = `chat_${username}`
  const savedData = sessionStorage.getItem(storageKey)

  if (savedData) {
    try {
      return JSON.parse(savedData)
    } catch (error) {
      console.error('Failed to parse chat data from session:', error)
      return null
    }
  }

  return null
}

// sessionStorage에 채팅 데이터 저장
const saveChatDataToSession = (username: string, chatData: UserChatData) => {
  const storageKey = `chat_${username}`
  sessionStorage.setItem(storageKey, JSON.stringify(chatData))
}

export function ChatProvider({ children }: { children: ReactNode }) {
  const [chatData, setChatData] = useState<UserChatData | null>(null)
  const [currentUsername, setCurrentUsername] = useState<string>('')

  // 게스트 채팅 데이터 자동 초기화
  useEffect(() => {
    if (!chatData) {
      setChatData(createUserChatData('게스트'))
    }
  }, [chatData])

  const initializeChatData = (username: string) => {
    setCurrentUsername(username)
    // sessionStorage에서 저장된 데이터 불러오기
    const savedData = loadChatDataFromSession(username)
    if (savedData) {
      setChatData(savedData)
    } else {
      // 새로운 데이터 생성
      setChatData(createUserChatData(username))
    }
  }

  const clearChatData = () => {
    // 로그아웃 전에 데이터 저장
    if (currentUsername && chatData) {
      saveChatDataToSession(currentUsername, chatData)
    }
    setChatData(null)
    setCurrentUsername('')
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

      // 즉시 저장
      if (currentUsername) {
        saveChatDataToSession(currentUsername, updatedChatData)
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
