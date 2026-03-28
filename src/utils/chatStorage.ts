import type { InviteStatus } from '../types/team'

const CHAT_SESSION_DISABLED_KEY = 'hackathon-chat-session-disabled'

export type ChatAction = {
  label: string
  path: string
}

export type ChatInvite = {
  inviteId: string
  teamId: string
  teamName: string
  status: InviteStatus
}

export type ChatMessage = {
  id: string
  userId?: string
  user: string
  text: string
  timestamp: string
  createdAt?: string
  action?: ChatAction
  invite?: ChatInvite
}

export type ChatRoom = {
  id: string
  name: string
  unreadCount: number
}

export type UserChatData = {
  rooms: ChatRoom[]
  messages: Record<string, ChatMessage[]>
}

export const createChatTimestamp = (date = new Date()) => {
  return date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
}

export const getTeamRoomId = (teamCode: string) => `team:${teamCode}`

export const createEmptyChatData = (): UserChatData => ({
  rooms: [],
  messages: {}
})

export const clearLegacyChatStorage = () => {
  if (typeof window === 'undefined') return

  for (let index = sessionStorage.length - 1; index >= 0; index -= 1) {
    const key = sessionStorage.key(index)
    if (!key) continue
    if (key.startsWith('chat_') || key === CHAT_SESSION_DISABLED_KEY) {
      sessionStorage.removeItem(key)
    }
  }
}

/* ─── DM 최근 읽은 시각 (lastSeen) ─── */
const getLastSeenKey = (userId: string) => `lastSeen_dm_${userId}`

export const getLastSeenAt = (userId: string, roomId: string): string | null => {
  try {
    const raw = localStorage.getItem(getLastSeenKey(userId))
    if (!raw) return null
    const parsed = JSON.parse(raw) as Record<string, string>
    const value = parsed[roomId]
    if (!value) return null

    // 오래된 포맷/깨진 값이 남아 있으면 미읽음 계산이 0으로 고정될 수 있어 정리한다.
    if (Number.isNaN(Date.parse(value))) {
      delete parsed[roomId]
      localStorage.setItem(getLastSeenKey(userId), JSON.stringify(parsed))
      return null
    }

    return value
  } catch {
    return null
  }
}

export const setLastSeenAt = (userId: string, roomId: string, timestamp: string): void => {
  try {
    const raw = localStorage.getItem(getLastSeenKey(userId))
    const map: Record<string, string> = raw ? (JSON.parse(raw) as Record<string, string>) : {}
    map[roomId] = timestamp
    localStorage.setItem(getLastSeenKey(userId), JSON.stringify(map))
  } catch {
    // ignore
  }
}