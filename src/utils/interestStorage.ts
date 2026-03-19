export type HackathonInterest = {
  userId: string
  hackathonId: string
  interestedAt: string
}

const HACKATHON_INTERESTS_STORAGE_KEY = 'hackathon_interests'

function loadAllInterests(): HackathonInterest[] {
  const raw = localStorage.getItem(HACKATHON_INTERESTS_STORAGE_KEY)
  if (!raw) return []

  try {
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []

    return parsed.filter(
      (item): item is HackathonInterest =>
        item &&
        typeof item.userId === 'string' &&
        typeof item.hackathonId === 'string' &&
        typeof item.interestedAt === 'string'
    )
  } catch {
    return []
  }
}

function saveAllInterests(interests: HackathonInterest[]) {
  localStorage.setItem(HACKATHON_INTERESTS_STORAGE_KEY, JSON.stringify(interests))
}

export function getUserHackathonInterests(userId: string): HackathonInterest[] {
  return loadAllInterests().filter((item) => item.userId === userId)
}

export function isHackathonInterested(userId: string, hackathonId: string): boolean {
  return loadAllInterests().some(
    (item) => item.userId === userId && item.hackathonId === hackathonId
  )
}

export function toggleHackathonInterest(userId: string, hackathonId: string): boolean {
  const current = loadAllInterests()
  const exists = current.some(
    (item) => item.userId === userId && item.hackathonId === hackathonId
  )

  if (exists) {
    const next = current.filter(
      (item) => !(item.userId === userId && item.hackathonId === hackathonId)
    )
    saveAllInterests(next)
    return false
  }

  const next = [
    ...current,
    {
      userId,
      hackathonId,
      interestedAt: new Date().toISOString(),
    },
  ]
  saveAllInterests(next)
  return true
}
