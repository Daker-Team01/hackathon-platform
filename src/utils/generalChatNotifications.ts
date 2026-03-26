export const GENERAL_CHAT_NOTIFICATION_EVENT = 'general-chat-notification'
export const GENERAL_CHAT_NOTIFICATION_STORAGE_PREFIX = 'general_chat_notifications_'

type QueuedGeneralChatNotification = {
  id: string
  userId: string
  text: string
  createdAt: string
}

const storageKey = (userId: string) => `${GENERAL_CHAT_NOTIFICATION_STORAGE_PREFIX}${userId}`

const loadQueue = (userId: string): QueuedGeneralChatNotification[] => {
  try {
    const raw = localStorage.getItem(storageKey(userId))
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter((item): item is QueuedGeneralChatNotification => typeof item === 'object' && item !== null) : []
  } catch {
    return []
  }
}

const saveQueue = (userId: string, queue: QueuedGeneralChatNotification[]) => {
  localStorage.setItem(storageKey(userId), JSON.stringify(queue))
}

export const enqueueGeneralChatNotification = (userId: string, text: string) => {
  const queue = loadQueue(userId)
  const notification: QueuedGeneralChatNotification = {
    id: `general_notice_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    userId,
    text,
    createdAt: new Date().toISOString()
  }

  saveQueue(userId, [...queue, notification])
  window.dispatchEvent(new CustomEvent(GENERAL_CHAT_NOTIFICATION_EVENT, { detail: { userId } }))
}

export const consumeGeneralChatNotifications = (userId: string): QueuedGeneralChatNotification[] => {
  const queue = loadQueue(userId)
  localStorage.removeItem(storageKey(userId))
  return queue
}