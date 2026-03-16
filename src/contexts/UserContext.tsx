import { createContext, useContext, useState, ReactNode } from 'react'
import userAlice from '../data/UserData/user_alice.json'
import userBob from '../data/UserData/user_bob.json'
import userCharlie from '../data/UserData/user_charlie.json'
import userDiana from '../data/UserData/user_diana.json'
import userEvan from '../data/UserData/user_evan.json'

export type ChatMessage = {
  id: string
  user: string
  text: string
  timestamp: string
}

export type ChatRoom = {
  id: string
  name: string
  unreadCount: number
}

export type User = {
  id: string
  username: string
  nickname: string
  profileImage: string
  ranking: number
  points: number
  techStack: string[]
  personalityTags: string[]
}

type UserChatData = {
  rooms: ChatRoom[]
  messages: { [roomId: string]: ChatMessage[] }
}

type UserContextType = {
  user: User | null
  isLoggedIn: boolean
  login: (username: string, password: string) => boolean
  logout: () => void
  chatData: UserChatData | null
  addMessage: (roomId: string, message: ChatMessage) => void
}

const UserContext = createContext<UserContextType | undefined>(undefined)

// 모든 유저 데이터를 하나의 배열로 관리
const allUsers = [userAlice, userBob, userCharlie, userDiana, userEvan] as any[]

// 사용자별 채팅 데이터 초기값
const createUserChatData = (username: string): UserChatData => ({
  rooms: [
    { id: '1', name: '일반', unreadCount: 0 },
    { id: '2', name: '공지', unreadCount: 0 },
    { id: '3', name: '팀 찾기', unreadCount: 0 }
  ],
  messages: {
    '1': [
      { id: '1', user: 'Admin', text: `안녕하세요! ${username}님 환영합니다.`, timestamp: '10:00' }
    ],
    '2': [
      { id: '1', user: 'Admin', text: '[공지] 해커톤이 시작되었습니다!', timestamp: '09:00' }
    ],
    '3': []
  }
})

// sessionStorage에서 사용자 채팅 데이터 불러오기
const loadChatDataFromSession = (username: string): UserChatData => {
  const storageKey = `chat_${username}`
  const savedData = sessionStorage.getItem(storageKey)
  
  if (savedData) {
    try {
      return JSON.parse(savedData)
    } catch (error) {
      console.error('Failed to parse chat data from session:', error)
      return createUserChatData(username)
    }
  }
  
  return createUserChatData(username)
}

// sessionStorage에 사용자 채팅 데이터 저장
const saveChatDataToSession = (username: string, chatData: UserChatData) => {
  const storageKey = `chat_${username}`
  sessionStorage.setItem(storageKey, JSON.stringify(chatData))
}

export function UserProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [chatData, setChatData] = useState<UserChatData | null>(null)

  const login = (username: string, password: string): boolean => {
    // 아이디와 비밀번호로 사용자 찾기
    const foundUser = allUsers.find(
      (u) => u.username === username && u.password === password
    )

    if (foundUser) {
      // 비밀번호 제거하고 사용자 정보 저장
      const { password, ...userWithoutPassword } = foundUser
      setUser(userWithoutPassword)
      
      // sessionStorage에서 채팅 데이터 불러오기 또는 새로 생성
      const savedChatData = loadChatDataFromSession(username)
      setChatData(savedChatData)
      
      return true
    }
    return false
  }

  const logout = () => {
    // 현재 채팅 데이터를 sessionStorage에 저장
    if (user && chatData) {
      saveChatDataToSession(user.username, chatData)
    }
    
    setUser(null)
    setChatData(null)
  }

  const addMessage = (roomId: string, message: ChatMessage) => {
    if (!chatData || !user) return
    
    const updatedChatData = {
      ...chatData,
      messages: {
        ...chatData.messages,
        [roomId]: [...(chatData.messages[roomId] || []), message]
      }
    }
    
    setChatData(updatedChatData)
    // 즉시 sessionStorage에 저장
    saveChatDataToSession(user.username, updatedChatData)
  }

  return (
    <UserContext.Provider value={{ user, isLoggedIn: !!user, login, logout, chatData, addMessage }}>
      {children}
    </UserContext.Provider>
  )
}

export function useUser() {
  const context = useContext(UserContext)
  if (context === undefined) {
    throw new Error('useUser must be used within UserProvider')
  }
  return context
}
