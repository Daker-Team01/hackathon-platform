import { createContext, useContext, useState, ReactNode } from 'react'

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
  login: (username: string, password: string) => void
  logout: () => void
}

const UserContext = createContext<UserContextType | undefined>(undefined)

export function UserProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)

  const login = (username: string, password: string) => {
    // 샘플 로그인 (실제로는 서버에서 검증)
    if (username && password) {
      const newUser: User = {
        id: '1',
        username,
        nickname: username,
        profileImage: `https://api.dicebear.com/7.x/avataaars/svg?seed=${username}`,
        ranking: Math.floor(Math.random() * 100) + 1,
        points: Math.floor(Math.random() * 1000),
        techStack: ['React', 'TypeScript', 'Node.js'],
        personalityTags: ['창의적', '리더십', '책임감']
      }
      setUser(newUser)
    }
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
