import { createContext, useContext, useState, ReactNode } from 'react'
import userAlice from '../data/UserData/user_alice.json'
import userBob from '../data/UserData/user_bob.json'
import userCharlie from '../data/UserData/user_charlie.json'
import userDiana from '../data/UserData/user_diana.json'
import userEvan from '../data/UserData/user_evan.json'

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
}

const UserContext = createContext<UserContextType | undefined>(undefined)

// 모든 유저 데이터를 하나의 배열로 관리
const allUsers = [userAlice, userBob, userCharlie, userDiana, userEvan] as any[]

export function UserProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)

  const login = (username: string, password: string): boolean => {
    // 아이디와 비밀번호로 사용자 찾기
    const foundUser = allUsers.find(
      (u) => u.username === username && u.password === password
    )

    if (foundUser) {
      // 비밀번호 제거하고 사용자 정보 저장
      const { password, ...userWithoutPassword } = foundUser
      setUser(userWithoutPassword)
      return true
    }
    return false
  }

  const logout = () => {
    setUser(null)
  }

  return (
    <UserContext.Provider value={{ user, isLoggedIn: !!user, login, logout }}>
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
