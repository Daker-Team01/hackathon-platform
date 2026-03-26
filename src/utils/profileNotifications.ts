export const seenNotificationStorageKey = (userId: string) => `mypage_seen_notifications_${userId}`

export const announcedNotificationStorageKey = (userId: string) => `general_announced_notifications_${userId}`

const loadNotificationIds = (storageKey: string): string[] => {
  try {
    const raw = localStorage.getItem(storageKey)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : []
  } catch {
    return []
  }
}

export const loadSeenNotificationIds = (userId: string): string[] => {
  return loadNotificationIds(seenNotificationStorageKey(userId))
}

export const saveSeenNotificationIds = (userId: string, ids: string[]) => {
  localStorage.setItem(seenNotificationStorageKey(userId), JSON.stringify(ids))
}

export const loadAnnouncedNotificationIds = (userId: string): string[] => {
  return loadNotificationIds(announcedNotificationStorageKey(userId))
}

export const saveAnnouncedNotificationIds = (userId: string, ids: string[]) => {
  localStorage.setItem(announcedNotificationStorageKey(userId), JSON.stringify(ids))
}