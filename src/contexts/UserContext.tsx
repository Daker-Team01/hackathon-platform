import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import userAlice from '../data/UserData/user_alice.json'
import userBob from '../data/UserData/user_bob.json'
import userCharlie from '../data/UserData/user_charlie.json'
import userDiana from '../data/UserData/user_diana.json'
import userEvan from '../data/UserData/user_evan.json'
import { useChat } from './ChatContext'

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

type UserContextType = {
  user: User | null
  isLoggedIn: boolean
  login: (username: string, password: string) => boolean
  logout: () => void
  updateUser: (updates: Partial<User>) => void
}

const UserContext = createContext<UserContextType | undefined>(undefined)

type UserWithPassword = User & {
  password: string
}

const USER_STORAGE_KEY = 'logged_in_user'

// 모든 유저 데이터를 하나의 배열로 관리
const allUsers: UserWithPassword[] = [userAlice, userBob, userCharlie, userDiana, userEvan]

const loadUserFromStorage = (): User | null => {
  const raw = localStorage.getItem(USER_STORAGE_KEY)
  if (!raw) return null

  try {
    const parsed = JSON.parse(raw) as User
    if (parsed && typeof parsed.username === 'string') {
      return parsed
    }
  } catch (error) {
    console.error('Failed to parse user data from localStorage:', error)
  }

  localStorage.removeItem(USER_STORAGE_KEY)
  return null
}

const saveUserToStorage = (nextUser: User) => {
  localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(nextUser))
}

const clearUserFromStorage = () => {
  localStorage.removeItem(USER_STORAGE_KEY)
}

export function UserProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => loadUserFromStorage())
  const { initializeChatData, clearChatData } = useChat()

  // 새로고침 후 자동 복원된 로그인 유저의 채팅 데이터도 초기화
  useEffect(() => {
    if (user?.username) {
      initializeChatData(user.username)
    }
    // initializeChatData는 컨텍스트 렌더마다 참조가 바뀔 수 있어 최초 복원 시점에만 실행
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const login = (username: string, password: string): boolean => {
    // 아이디와 비밀번호로 사용자 찾기
    const foundUser = allUsers.find(
      (u) => u.username === username && u.password === password
    )

    if (foundUser) {
      // 비밀번호 제거하고 사용자 정보 저장
      const { password: _password, ...userWithoutPassword } = foundUser
      setUser(userWithoutPassword)
      saveUserToStorage(userWithoutPassword)
      
      // 채팅 데이터 초기화
      initializeChatData(username)
      
      return true
    }
    return false
  }

  const logout = () => {
    clearChatData()
    clearUserFromStorage()
    setUser(null)
  }

  const updateUser = (updates: Partial<User>) => {
    if (!user) return
    
    const updatedUser = { ...user, ...updates }
    setUser(updatedUser)
    saveUserToStorage(updatedUser)
  }

  return (
    <UserContext.Provider value={{ user, isLoggedIn: !!user, login, logout, updateUser }}>
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
