import { createContext, useContext, useCallback, useEffect, useState, type ReactNode } from 'react'
import { enqueueGeneralChatNotification } from '../utils/generalChatNotifications'

export type DmRequest = {
  id: string
  fromUserId: string
  fromNickname: string
  toUserId: string
  toNickname: string
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED'
  createdAt: string
}

type DmRequestContextType = {
  sendDmRequest: (fromUserId: string, fromNickname: string, toUserId: string, toNickname: string) => void
  getPendingForUser: (userId: string) => DmRequest[]
  respondToRequest: (requestId: string, toUserId: string, status: 'ACCEPTED' | 'REJECTED') => void
  hasSentPendingRequest: (fromUserId: string, toUserId: string) => boolean
}

const DmRequestContext = createContext<DmRequestContextType | undefined>(undefined)

const storageKey = (toUserId: string) => `dm_requests_${toUserId}`

const loadRequests = (toUserId: string): DmRequest[] => {
  try {
    const raw = localStorage.getItem(storageKey(toUserId))
    return raw ? (JSON.parse(raw) as DmRequest[]) : []
  } catch {
    return []
  }
}

const saveRequests = (toUserId: string, requests: DmRequest[]) => {
  localStorage.setItem(storageKey(toUserId), JSON.stringify(requests))
}

export function DmRequestProvider({ children }: { children: ReactNode }) {
  // version bump forces consumers to re-read localStorage
  const [tick, setTick] = useState(0)
  const bump = () => setTick((v) => v + 1)

  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (!event.key) return
      if (!event.key.startsWith('dm_requests_')) return
      bump()
    }

    window.addEventListener('storage', handleStorage)
    return () => window.removeEventListener('storage', handleStorage)
  }, [])

  const sendDmRequest = useCallback(
    (fromUserId: string, fromNickname: string, toUserId: string, toNickname: string) => {
      const existing = loadRequests(toUserId)
      if (existing.some((r) => r.fromUserId === fromUserId && r.status === 'PENDING')) return

      const request: DmRequest = {
        id: `dmreq_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        fromUserId,
        fromNickname,
        toUserId,
        toNickname,
        status: 'PENDING',
        createdAt: new Date().toISOString(),
      }
      saveRequests(toUserId, [...existing, request])
      enqueueGeneralChatNotification(fromUserId, `${toNickname}님에게 1:1 채팅 요청을 보냈습니다.`)
      enqueueGeneralChatNotification(toUserId, `${fromNickname}님에게서 1:1 채팅 요청이 도착했습니다.`)
      bump()
    },
    []
  )

  const getPendingForUser = useCallback(
    (userId: string): DmRequest[] => {
      void tick
      return loadRequests(userId).filter((r) => r.status === 'PENDING')
    },
    [tick]
  )

  const respondToRequest = useCallback(
    (requestId: string, toUserId: string, status: 'ACCEPTED' | 'REJECTED') => {
      const requests = loadRequests(toUserId)
      const targetRequest = requests.find((request) => request.id === requestId)
      const updated = requests.map((r) =>
        r.id === requestId ? { ...r, status } : r
      )
      saveRequests(toUserId, updated)

      if (targetRequest) {
        const responseText = status === 'ACCEPTED' ? '수락' : '거절'
        enqueueGeneralChatNotification(toUserId, `${targetRequest.fromNickname}님의 1:1 채팅 요청을 ${responseText}했습니다.`)
        enqueueGeneralChatNotification(targetRequest.fromUserId, `${targetRequest.toNickname}님이 1:1 채팅 요청을 ${responseText}했습니다.`)
      }

      bump()
    },
    []
  )

  const hasSentPendingRequest = useCallback(
    (fromUserId: string, toUserId: string): boolean => {
      void tick
      return loadRequests(toUserId).some((r) => r.fromUserId === fromUserId && r.status === 'PENDING')
    },
    [tick]
  )

  return (
    <DmRequestContext.Provider value={{ sendDmRequest, getPendingForUser, respondToRequest, hasSentPendingRequest }}>
      {children}
    </DmRequestContext.Provider>
  )
}

export function useDmRequests() {
  const ctx = useContext(DmRequestContext)
  if (!ctx) throw new Error('useDmRequests must be used within DmRequestProvider')
  return ctx
}
