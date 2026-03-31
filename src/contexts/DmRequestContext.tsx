import { createContext, useContext, useCallback, useEffect, useState, useRef, type ReactNode } from 'react'
import { 
  sendDmRequest as supabaseSendDmRequest,
  getDmRequestsForUser,
  getDmRequestsSentByUser,
  respondToDmRequest,
  subscribeToDmRequests,
  subscribeToDmRequestsBySender,
  type SupabaseDmRequest
} from '../api/realtimeChatApi'
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
  sendDmRequest: (fromUserId: string, fromNickname: string, toUserId: string, toNickname: string) => Promise<void>
  getPendingForUser: (userId: string) => DmRequest[]
  respondToRequest: (requestId: string, toUserId: string, status: 'ACCEPTED' | 'REJECTED') => Promise<void>
  hasSentPendingRequest: (fromUserId: string, toUserId: string) => boolean
  setupSubscriptionForUser: (userId: string) => void
}

const DmRequestContext = createContext<DmRequestContextType | undefined>(undefined)

export function DmRequestProvider({ children }: { children: ReactNode }) {
  const [dmRequests, setDmRequests] = useState<SupabaseDmRequest[]>([])
  const subscriptionMapRef = useRef<Map<string, () => void>>(new Map())
  const pollingMapRef = useRef<Map<string, number>>(new Map())

  const mapSupabaseRequest = (req: SupabaseDmRequest): DmRequest => ({
    id: req.id,
    fromUserId: req.from_user_id,
    fromNickname: req.from_user_name,
    toUserId: req.to_user_id,
    toNickname: req.to_user_name,
    status: req.status,
    createdAt: req.created_at
  })

  const sendDmRequest = useCallback(
    async (fromUserId: string, fromNickname: string, toUserId: string, toNickname: string) => {
      try {
        const result = await supabaseSendDmRequest(fromUserId, fromNickname, toUserId, toNickname)
        if (result) {
          // dmRequests 상태에 새 요청 추가
          setDmRequests((prev) => {
            const exists = prev.some((r) => r.id === result.id)
            return exists ? prev : [...prev, result]
          })
          
          // Supabase 구독이 자동으로 새 요청 이벤트를 보냄
          enqueueGeneralChatNotification(fromUserId, `${toNickname}님에게 1:1 채팅 요청을 보냈습니다.`)
          enqueueGeneralChatNotification(toUserId, `${fromNickname}님에게서 1:1 채팅 요청이 도착했습니다.`)
        }
      } catch (error) {
        console.error('Failed to send DM request:', error)
        throw error
      }
    },
    []
  )

  const getPendingForUser = useCallback(
    (userId: string): DmRequest[] => {
      return dmRequests
        .filter((req) => req.to_user_id === userId && req.status === 'PENDING')
        .map(mapSupabaseRequest)
    },
    [dmRequests]
  )

  const respondToRequest = useCallback(
    async (requestId: string, toUserId: string, status: 'ACCEPTED' | 'REJECTED') => {
      try {
        const targetRequest = dmRequests.find((r) => r.id === requestId)
        const updatedRequest = await respondToDmRequest(requestId, status)

        if (!updatedRequest) {
          throw new Error('1:1 채팅 요청 상태를 업데이트하지 못했습니다.')
        }

        setDmRequests((prev) =>
          prev.map((request) => (request.id === requestId ? updatedRequest : request))
        )
        
        if (targetRequest) {
          const responseText = status === 'ACCEPTED' ? '수락' : '거절'
          enqueueGeneralChatNotification(toUserId, `${targetRequest.from_user_name}님의 1:1 채팅 요청을 ${responseText}했습니다.`)
          enqueueGeneralChatNotification(targetRequest.from_user_id, `${targetRequest.to_user_name}님이 1:1 채팅 요청을 ${responseText}했습니다.`)
        }
      } catch (error) {
        console.error('Failed to respond to DM request:', error)
        throw error
      }
    },
    [dmRequests]
  )

  const hasSentPendingRequest = useCallback(
    (fromUserId: string, toUserId: string): boolean => {
      return dmRequests.some(
        (r) => r.from_user_id === fromUserId && r.to_user_id === toUserId && r.status === 'PENDING'
      )
    },
    [dmRequests]
  )

  // 특정 사용자의 DM 요청 구독 설정
  const setupSubscriptionForUser = useCallback(
    (userId: string) => {
      const existingUnsubscribe = subscriptionMapRef.current.get(userId)
      if (existingUnsubscribe) {
        existingUnsubscribe()
        subscriptionMapRef.current.delete(userId)
      }

      const existingPolling = pollingMapRef.current.get(userId)
      if (existingPolling) {
        window.clearInterval(existingPolling)
        pollingMapRef.current.delete(userId)
      }

      // 초기 로드
      Promise.all([getDmRequestsForUser(userId), getDmRequestsSentByUser(userId)])
        .then(([receivedRequests, sentRequests]) => {
          const requests = [...receivedRequests, ...sentRequests]
          setDmRequests((prev) => {
            // 기존 요청들 중 이 사용자와 관련된 것은 제거 후 최신 데이터 병합
            const filtered = prev.filter((r) => r.to_user_id !== userId && r.from_user_id !== userId)
            return [...filtered, ...requests]
          })
        })
        .catch((error) => console.error('Failed to load DM requests:', error))

      // 실시간 구독(받은 요청)
      const unsubscribeTo = subscribeToDmRequests(
        userId,
        (newRequest) => {
          setDmRequests((prev) => {
            const exists = prev.some((r) => r.id === newRequest.id)
            return exists ? prev : [...prev, newRequest]
          })
        },
        (updatedRequest) => {
          // 요청 상태 업데이트 (수락/거절)
          setDmRequests((prev) =>
            prev.map((r) => (r.id === updatedRequest.id ? updatedRequest : r))
          )
        }
      )

      // 실시간 구독(보낸 요청)
      const unsubscribeFrom = subscribeToDmRequestsBySender(
        userId,
        (newRequest) => {
          setDmRequests((prev) => {
            const exists = prev.some((r) => r.id === newRequest.id)
            return exists ? prev : [...prev, newRequest]
          })
        },
        (updatedRequest) => {
          setDmRequests((prev) =>
            prev.map((r) => (r.id === updatedRequest.id ? updatedRequest : r))
          )
        }
      )

      subscriptionMapRef.current.set(userId, () => {
        unsubscribeTo()
        unsubscribeFrom()
      })

      // Realtime 누락/끊김 대비 폴링 fallback
      const pollingId = window.setInterval(() => {
        Promise.all([getDmRequestsForUser(userId), getDmRequestsSentByUser(userId)])
          .then(([receivedRequests, sentRequests]) => {
            const requests = [...receivedRequests, ...sentRequests]
            setDmRequests((prev) => {
              const others = prev.filter((r) => r.to_user_id !== userId && r.from_user_id !== userId)
              return [...others, ...requests]
            })
          })
          .catch((error) => console.error('Failed to poll DM requests:', error))
      }, 3000)

      pollingMapRef.current.set(userId, pollingId)
    },
    []
  )

  // 주요 마운트/언마운트 시 구독 관리 (현재 사용자)
  useEffect(() => {
    return () => {
      // Provider 언마운트 시 모든 구독 정리
      subscriptionMapRef.current.forEach((unsubscribe) => {
        unsubscribe()
      })
      subscriptionMapRef.current.clear()

      pollingMapRef.current.forEach((intervalId) => {
        window.clearInterval(intervalId)
      })
      pollingMapRef.current.clear()
    }
  }, [])

  return (
    <DmRequestContext.Provider value={{ sendDmRequest, getPendingForUser, respondToRequest, hasSentPendingRequest, setupSubscriptionForUser }}>
      {children}
    </DmRequestContext.Provider>
  )
}

export function useDmRequests() {
  const ctx = useContext(DmRequestContext)
  if (!ctx) throw new Error('useDmRequests must be used within DmRequestProvider')
  return ctx
}

// Provider 내부에서만 사용하는 헬퍼 (외부로 노출 안 함)
export function useSetupDmRequestSubscription() {
  const context = useContext(DmRequestContext)
  if (!context) throw new Error('useSetupDmRequestSubscription must be used within DmRequestProvider')
  return context.setupSubscriptionForUser
}
