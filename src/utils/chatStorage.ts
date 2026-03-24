import type { InviteStatus } from '../types/team'

export const CHAT_SYNC_EVENT = 'hackathon-chat-sync'
export const GENERAL_ROOM_ID = '1'
export const NOTICE_ROOM_ID = '2'
export const TEAM_FINDER_ROOM_ID = '3'
export const CHATBOT_ROOM_ID = '4'

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
  user: string
  text: string
  timestamp: string
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

const getChatStorageKey = (username: string) => `chat_${username}`

export const createChatTimestamp = (date = new Date()) => {
  return date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
}

export const getTeamRoomId = (teamCode: string) => `team:${teamCode}`

export const createTeamRoom = (teamCode: string, name: string): ChatRoom => ({
  id: getTeamRoomId(teamCode),
  name,
  unreadCount: 0
})

export const createUserChatData = (username: string, displayName = username): UserChatData => ({
  rooms: [
    { id: GENERAL_ROOM_ID, name: '일반', unreadCount: 0 },
    { id: NOTICE_ROOM_ID, name: '공지', unreadCount: 0 },
    { id: TEAM_FINDER_ROOM_ID, name: '팀 찾기', unreadCount: 0 },
    { id: CHATBOT_ROOM_ID, name: '🤖 챗봇', unreadCount: 0 }
  ],
  messages: {
    [GENERAL_ROOM_ID]: [
      { id: '1', user: 'Admin', text: `안녕하세요! ${displayName}님 환영합니다.`, timestamp: '10:00' }
    ],
    [NOTICE_ROOM_ID]: [
      { id: '1', user: 'Admin', text: '[공지] 해커톤이 시작되었습니다!', timestamp: '09:00' }
    ],
    [TEAM_FINDER_ROOM_ID]: [],
    [CHATBOT_ROOM_ID]: [
      { id: '1', user: 'Chatbot', text: '안녕하세요! 저는 해커톤 플랫폼 챗봇입니다. 해커톤, 팀, 랭킹 등에 대해 궁금하신 점을 물어보세요! 📚', timestamp: '10:00' }
    ]
  }
})

export const loadChatDataFromSession = (username: string): UserChatData | null => {
  if (typeof window === 'undefined') return null

  const savedData = sessionStorage.getItem(getChatStorageKey(username))

  if (!savedData) {
    return null
  }

  try {
    return JSON.parse(savedData) as UserChatData
  } catch (error) {
    console.error('Failed to parse chat data from session:', error)
    return null
  }
}

export const loadOrCreateChatData = (username: string, displayName = username): UserChatData => {
  return loadChatDataFromSession(username) ?? createUserChatData(username, displayName)
}

export const saveChatDataToSession = (username: string, chatData: UserChatData, shouldNotify = true) => {
  if (typeof window === 'undefined') return

  sessionStorage.setItem(getChatStorageKey(username), JSON.stringify(chatData))

  if (shouldNotify) {
    window.dispatchEvent(new CustomEvent(CHAT_SYNC_EVENT, { detail: { username } }))
  }
}

export const upsertRoomInChatData = (chatData: UserChatData, room: ChatRoom): UserChatData => {
  const existingRoom = chatData.rooms.find((candidate) => candidate.id === room.id)
  const nextRooms = existingRoom
    ? chatData.rooms.map((candidate) =>
        candidate.id === room.id
          ? { ...candidate, name: room.name }
          : candidate
      )
    : [...chatData.rooms, room]

  return {
    ...chatData,
    rooms: nextRooms,
    messages: {
      ...chatData.messages,
      [room.id]: chatData.messages[room.id] || []
    }
  }
}

export const upsertMessageInChatData = (
  chatData: UserChatData,
  roomId: string,
  message: ChatMessage
): UserChatData => {
  const roomMessages = chatData.messages[roomId] || []
  const existingIndex = roomMessages.findIndex((candidate) => candidate.id === message.id)
  const nextMessages = [...roomMessages]

  if (existingIndex === -1) {
    nextMessages.push(message)
  } else {
    nextMessages[existingIndex] = message
  }

  return {
    ...chatData,
    messages: {
      ...chatData.messages,
      [roomId]: nextMessages
    }
  }
}

export const appendMessageInChatData = (
  chatData: UserChatData,
  roomId: string,
  message: ChatMessage
): UserChatData => {
  const roomMessages = chatData.messages[roomId] || []

  return {
    ...chatData,
    messages: {
      ...chatData.messages,
      [roomId]: [...roomMessages, message]
    }
  }
}

export const mutateUserChatData = (
  username: string,
  updater: (chatData: UserChatData) => UserChatData
) => {
  const nextChatData = updater(loadOrCreateChatData(username))
  saveChatDataToSession(username, nextChatData)
  return nextChatData
}