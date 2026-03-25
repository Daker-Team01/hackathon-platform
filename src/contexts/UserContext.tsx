import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import userDummyData from '../data/user_dummy_data.json'
import { useChat } from './ChatContext'

export type UserParticipation = {
  hackathonSlug: string
  teamCode: string
  role: string
  isLeader: boolean
  contributionScore: number
  status: string
}

export type UserWorkStyle = {
  communication: string
  leadership: string
  execution: string
}

export type User = {
  id: string
  userId: string
  username: string
  email: string
  nickname: string
  profileImage: string
  ranking: number
  points: number
  techStack: string[]
  personalityTags: string[]
  preferredRoles: string[]
  workStyle: UserWorkStyle
  activityScore: number
  reputation: number
  participations: UserParticipation[]
  createdAt: string
  lastLoginAt: string
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

type RawUser = {
  userId?: unknown
  nickname?: unknown
  email?: unknown
  password?: unknown
  profileImage?: unknown
  createdAt?: unknown
  lastLoginAt?: unknown
  skills?: unknown
  preferredRoles?: unknown
  personalityTags?: unknown
  workStyle?: unknown
  activityScore?: unknown
  reputation?: unknown
  points?: unknown
  participations?: unknown
}

const USER_STORAGE_KEY = 'logged_in_user'

const normalizeStringArray = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return value
      .filter((item): item is string => typeof item === 'string')
      .map((item) => item.trim())
      .filter(Boolean)
  }

  if (typeof value === 'string') {
    return value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean)
  }

  return []
}

const toFiniteNumber = (value: unknown, fallback = 0): number => {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

const normalizeWorkStyle = (value: unknown): UserWorkStyle => {
  if (typeof value !== 'object' || value === null) {
    return {
      communication: 'medium',
      leadership: 'medium',
      execution: 'medium'
    }
  }

  const candidate = value as Record<string, unknown>

  return {
    communication: typeof candidate.communication === 'string' ? candidate.communication : 'medium',
    leadership: typeof candidate.leadership === 'string' ? candidate.leadership : 'medium',
    execution: typeof candidate.execution === 'string' ? candidate.execution : 'medium'
  }
}

const normalizeParticipations = (value: unknown): UserParticipation[] => {
  if (!Array.isArray(value)) {
    return []
  }

  return value
    .filter((item): item is Record<string, unknown> => typeof item === 'object' && item !== null)
    .map((item) => ({
      hackathonSlug: typeof item.hackathonSlug === 'string' ? item.hackathonSlug : '',
      teamCode: typeof item.teamCode === 'string' ? item.teamCode : '',
      role: typeof item.role === 'string' ? item.role : '팀원',
      isLeader: Boolean(item.isLeader),
      contributionScore: toFiniteNumber(item.contributionScore),
      status: typeof item.status === 'string' ? item.status : 'unknown'
    }))
    .filter((item) => item.hackathonSlug && item.teamCode)
}

const normalizePointValue = (value: unknown): { total: number } => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return { total: value }
  }

  if (typeof value === 'object' && value !== null) {
    const candidate = value as Record<string, unknown>
    return {
      total: toFiniteNumber(candidate.total)
    }
  }

  return { total: 0 }
}

const createFallbackProfileImage = (nickname: string) => {
  const initial = nickname.trim().charAt(0) || 'U'
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 120 120">
      <rect width="120" height="120" rx="60" fill="#dbeafe" />
      <text x="50%" y="54%" dominant-baseline="middle" text-anchor="middle" font-family="Arial, sans-serif" font-size="48" font-weight="700" fill="#1d4ed8">${initial}</text>
    </svg>
  `

  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`
}

const resolveProfileImage = (profileImage: unknown, nickname: string) => {
  if (typeof profileImage === 'string' && profileImage && !profileImage.includes('example.com')) {
    return profileImage
  }

  return createFallbackProfileImage(nickname)
}

const rawUsers = Array.isArray(userDummyData) ? (userDummyData as RawUser[]) : []

const rankingByUserId = new Map(
  [...rawUsers]
    .sort((left, right) => {
      const leftPoints = normalizePointValue(left.points).total
      const rightPoints = normalizePointValue(right.points).total

      if (rightPoints !== leftPoints) {
        return rightPoints - leftPoints
      }

      return toFiniteNumber(right.reputation) - toFiniteNumber(left.reputation)
    })
    .map((user, index) => [typeof user.userId === 'string' ? user.userId : '', index + 1] as const)
)

const normalizeUser = (value: unknown): User | null => {
  if (typeof value !== 'object' || value === null) {
    return null
  }

  const candidate = value as Record<string, unknown>
  const id = typeof candidate.id === 'string'
    ? candidate.id
    : typeof candidate.userId === 'string'
      ? candidate.userId
      : ''
  const resolvedUserId = typeof candidate.userId === 'string' ? candidate.userId : id
  const email = typeof candidate.email === 'string'
    ? candidate.email
    : typeof candidate.username === 'string'
      ? candidate.username
      : ''
  const nickname = typeof candidate.nickname === 'string' ? candidate.nickname : email

  if (!id || !email || !nickname) {
    return null
  }

  const normalizedPoints = normalizePointValue(candidate.points)

  return {
    id,
    userId: resolvedUserId,
    username: typeof candidate.username === 'string' ? candidate.username : email,
    email,
    nickname,
    profileImage: resolveProfileImage(candidate.profileImage, nickname),
    // 랭킹은 저장값보다 userId 기준 계산값을 우선 사용해 일관성을 보장
    ranking: rankingByUserId.get(resolvedUserId) ?? rankingByUserId.get(id) ?? toFiniteNumber(candidate.ranking),
    points: normalizedPoints.total,
    techStack: normalizeStringArray(candidate.techStack ?? candidate.skills),
    personalityTags: normalizeStringArray(candidate.personalityTags),
    preferredRoles: normalizeStringArray(candidate.preferredRoles),
    workStyle: normalizeWorkStyle(candidate.workStyle),
    activityScore: toFiniteNumber(candidate.activityScore),
    reputation: toFiniteNumber(candidate.reputation),
    participations: normalizeParticipations(candidate.participations),
    createdAt: typeof candidate.createdAt === 'string' ? candidate.createdAt : '',
    lastLoginAt: typeof candidate.lastLoginAt === 'string' ? candidate.lastLoginAt : ''
  }
}

export const allUsers: UserWithPassword[] = rawUsers
  .map((value) => {
    const normalized = normalizeUser(value)
    const password = typeof value.password === 'string' ? value.password : ''

    if (!normalized || !password) {
      return null
    }

    return {
      ...normalized,
      password
    }
  })
  .filter((user): user is UserWithPassword => user !== null)

const loadUserFromStorage = (): User | null => {
  const raw = localStorage.getItem(USER_STORAGE_KEY)
  if (!raw) return null

  try {
    const parsed = JSON.parse(raw) as unknown
    const normalized = normalizeUser(parsed)
    if (normalized) {
      return normalized
    }
  } catch (error) {
    console.error('Failed to parse user data from localStorage:', error)
  }

  localStorage.removeItem(USER_STORAGE_KEY)
  return null
}

const saveUserToStorage = (nextUser: User) => {
  localStorage.setItem(
    USER_STORAGE_KEY,
    JSON.stringify({
      ...nextUser,
      username: nextUser.email,
      techStack: normalizeStringArray(nextUser.techStack),
      personalityTags: normalizeStringArray(nextUser.personalityTags),
      preferredRoles: normalizeStringArray(nextUser.preferredRoles),
      participations: normalizeParticipations(nextUser.participations)
    })
  )
}

const clearUserFromStorage = () => {
  localStorage.removeItem(USER_STORAGE_KEY)
}

export function UserProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => loadUserFromStorage())
  const { initializeChatData, clearChatData } = useChat()

  // 새로고침 후 자동 복원된 로그인 유저의 채팅 데이터도 초기화
  useEffect(() => {
    if (user?.email) {
      initializeChatData(user.email, user.nickname, user.userId)
    }
    // initializeChatData는 컨텍스트 렌더마다 참조가 바뀔 수 있어 최초 복원 시점에만 실행
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const login = (username: string, password: string): boolean => {
    const identifier = username.trim().toLowerCase()

    const foundUser = allUsers.find(
      (u) => {
        const candidates = [u.email, u.userId, u.nickname, u.username].map((value) => value.trim().toLowerCase())
        return candidates.includes(identifier) && u.password === password
      }
    )

    if (foundUser) {
      const normalizedUser: User = {
        id: foundUser.id,
        userId: foundUser.userId,
        username: foundUser.username,
        email: foundUser.email,
        nickname: foundUser.nickname,
        profileImage: foundUser.profileImage,
        ranking: foundUser.ranking,
        points: foundUser.points,
        techStack: normalizeStringArray(foundUser.techStack),
        personalityTags: normalizeStringArray(foundUser.personalityTags),
        preferredRoles: normalizeStringArray(foundUser.preferredRoles),
        workStyle: normalizeWorkStyle(foundUser.workStyle),
        activityScore: foundUser.activityScore,
        reputation: foundUser.reputation,
        participations: normalizeParticipations(foundUser.participations),
        createdAt: foundUser.createdAt,
        lastLoginAt: foundUser.lastLoginAt
      }

      setUser(normalizedUser)
      saveUserToStorage(normalizedUser)
      
      // 채팅 데이터 초기화
      initializeChatData(foundUser.email, foundUser.nickname, foundUser.userId)
      
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
    
    const updatedUser = {
      ...user,
      ...updates,
      username: updates.email ?? user.email,
      techStack: normalizeStringArray(updates.techStack ?? user.techStack),
      personalityTags: normalizeStringArray(updates.personalityTags ?? user.personalityTags),
      preferredRoles: normalizeStringArray(updates.preferredRoles ?? user.preferredRoles),
      participations: normalizeParticipations(updates.participations ?? user.participations),
      workStyle: normalizeWorkStyle(updates.workStyle ?? user.workStyle)
    }
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
