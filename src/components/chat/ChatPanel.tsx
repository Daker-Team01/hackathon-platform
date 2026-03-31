import { useEffect, useState } from 'react'
import { useUser } from '../../contexts/UserContext'
import { useChat } from '../../contexts/ChatContext'
import { useLog } from '../../contexts/LogContext'
import { generateChatbotResponseWithFallback, getChatbotAction } from '../../api/chatbotApi'
import { useRespondToInvite } from '../../hooks/useTeams'
import ChatRoomList from './ChatRoomList'
import ChatMessages from './ChatMessages'
import ChatInput from './ChatInput'

const CHATBOT_ROOM_ID = 'chatbot'
const NEXT_DIRECT_ROOM_ID_KEY = 'nextDirectRoomId'

type Props = {
  open: boolean
  onClose: () => void
}

export default function ChatPanel({ open, onClose }: Props) {
  const { isLoggedIn, user } = useUser()
  const { recordEvent } = useLog()
  const { chatData, supabaseRooms, roomActivityAt, unreadRoomCounts, addMessage, addSupabaseMessage, leaveDirectRoom, markRoomSeen } = useChat()
  const respondMutation = useRespondToInvite()
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null)
  const [isWaitingForResponse, setIsWaitingForResponse] = useState(false)
  const [panelWidth, setPanelWidth] = useState(500)
  const supabaseRoomIds = new Set(supabaseRooms.map((room) => room.id))

  // sessionStorage에서 자동으로 선택할 room id 확인
  useEffect(() => {
    const nextRoomId = sessionStorage.getItem(NEXT_DIRECT_ROOM_ID_KEY)
    if (nextRoomId) {
      setSelectedRoomId(nextRoomId)
      sessionStorage.removeItem(NEXT_DIRECT_ROOM_ID_KEY)
    }
  }, [])

  const [panelHeight, setPanelHeight] = useState(760)
  const [panelRight, setPanelRight] = useState(20)
  const [panelBottom, setPanelBottom] = useState(20)

  useEffect(() => {
    const updateLayout = () => {
      const vv = window.visualViewport
      const vw = vv?.width ?? window.innerWidth
      const vh = vv?.height ?? window.innerHeight

      const isMobile = vw < 768
      const horizontalMargin = isMobile ? 12 : 20
      const verticalMargin = isMobile ? 12 : 20

      const nextWidth = Math.max(320, Math.min(500, Math.floor(vw - horizontalMargin * 2)))

      const safeBottomInset = vv
        ? Math.max(0, window.innerHeight - (vv.height + vv.offsetTop))
        : 0

      const navbar = document.querySelector('[data-app-navbar="true"]') as HTMLElement | null
      const navbarBottom = navbar?.getBoundingClientRect().bottom ?? 0
      const topClearance = Math.max(verticalMargin, Math.ceil(navbarBottom) + 12)
      const availableHeight = Math.max(
        280,
        Math.floor(vh - topClearance - (verticalMargin + safeBottomInset))
      )

      const nextHeight = Math.max(
        Math.min(availableHeight, 900),
        Math.min(420, availableHeight)
      )

      setPanelWidth(nextWidth)
      setPanelHeight(nextHeight)
      setPanelBottom(verticalMargin + safeBottomInset)
      setPanelRight(isMobile ? Math.max(12, Math.floor((vw - nextWidth) / 2)) : 20)
    }

    updateLayout()

    window.addEventListener('resize', updateLayout)
    window.visualViewport?.addEventListener('resize', updateLayout)
    window.visualViewport?.addEventListener('scroll', updateLayout)

    return () => {
      window.removeEventListener('resize', updateLayout)
      window.visualViewport?.removeEventListener('resize', updateLayout)
      window.visualViewport?.removeEventListener('scroll', updateLayout)
    }
  }, [])

  // 채팅 데이터 없으면 아무것도 렌더링하지 않음
  if (!chatData) return null

  const directRoomIds = new Set(supabaseRooms.filter((r) => r.room_type === 'direct').map((r) => r.id))
  const supabaseGeneralRoomId = supabaseRooms.find((room) => room.room_type === 'general')?.id
  const mergedRooms = [...chatData.rooms]

  if (!mergedRooms.some((room) => room.id === CHATBOT_ROOM_ID)) {
    mergedRooms.push({ id: CHATBOT_ROOM_ID, name: '🤖 챗봇', unreadCount: 0 })
  }

  supabaseRooms.forEach((room) => {
    if (!mergedRooms.some((r) => r.id === room.id)) {
      mergedRooms.push({ id: room.id, name: room.name, unreadCount: 0 })
    }
  })
  const mergedRoomsWithUnread = mergedRooms.map((room) => ({
    ...room,
    unreadCount: unreadRoomCounts[room.id] ?? 0
  }))

  const allowedRoomIds = isLoggedIn
    ? mergedRoomsWithUnread.map((room) => room.id)
    : [CHATBOT_ROOM_ID]
  const filteredRooms = mergedRoomsWithUnread.filter(r => allowedRoomIds.includes(r.id))

  const getPinnedRank = (room: { id: string; name: string }) => {
    if (room.name === '공지') return 0
    if (room.name === '일반') return 1
    if (room.id === CHATBOT_ROOM_ID) return 2
    return 99
  }

  const sortedRooms = [...filteredRooms].sort((left, right) => {
    const leftRank = getPinnedRank(left)
    const rightRank = getPinnedRank(right)

    const leftPinned = leftRank !== 99
    const rightPinned = rightRank !== 99

    if (leftPinned && rightPinned) {
      return leftRank - rightRank
    }
    if (leftPinned) return -1
    if (rightPinned) return 1

    const leftActivity = roomActivityAt[left.id] ?? 0
    const rightActivity = roomActivityAt[right.id] ?? 0
    return rightActivity - leftActivity
  })

  const fallbackRoomId = isLoggedIn
    ? (supabaseGeneralRoomId ?? allowedRoomIds[0] ?? CHATBOT_ROOM_ID)
    : CHATBOT_ROOM_ID
  const safeSelectedRoomId = selectedRoomId && allowedRoomIds.includes(selectedRoomId)
    ? selectedRoomId
    : fallbackRoomId

  // 패널이 열려 있는 동안 현재 선택(또는 자동 선택)된 Supabase 방을 항상 읽음 처리
  useEffect(() => {
    if (!open) return
    if (!safeSelectedRoomId) return
    if (!supabaseRoomIds.has(safeSelectedRoomId)) return
    markRoomSeen(safeSelectedRoomId)
  }, [markRoomSeen, open, safeSelectedRoomId, supabaseRoomIds])

  const selectedSupabaseRoom = safeSelectedRoomId
    ? supabaseRooms.find((room) => room.id === safeSelectedRoomId)
    : undefined
  const isReadOnlyGeneralRoom = Boolean(
    selectedSupabaseRoom &&
    selectedSupabaseRoom.room_type === 'general' &&
    (selectedSupabaseRoom.name === '공지' || selectedSupabaseRoom.name === '일반')
  )

  useEffect(() => {
    if (!safeSelectedRoomId || safeSelectedRoomId !== CHATBOT_ROOM_ID) return
    const messages = chatData.messages[CHATBOT_ROOM_ID] || []
    if (messages.length > 0) return

    addMessage(CHATBOT_ROOM_ID, {
      id: `chatbot-welcome-${Date.now()}`,
      user: 'Chatbot',
      text: '안녕하세요! 저는 해커톤 플랫폼 챗봇입니다. 궁금한 내용을 물어보세요.',
      timestamp: new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
    })
  }, [addMessage, chatData.messages, safeSelectedRoomId])

  const handleInviteResponse = (inviteId: string, status: 'ACCEPTED' | 'REJECTED') => {
    const actionLabel = status === 'ACCEPTED' ? '수락' : '거절'

    if (window.confirm(`이 팀 초대를 ${actionLabel}하시겠습니까?`)) {
      respondMutation.mutate(
        { inviteId, status },
        {
          onError: (error) => {
            alert(error instanceof Error ? error.message : '초대 처리에 실패했습니다.')
          }
        }
      )
    }
  }

  const handleSendMessage = async (text: string) => {
    if (!safeSelectedRoomId) return
    if (isReadOnlyGeneralRoom) return

    if (safeSelectedRoomId === CHATBOT_ROOM_ID) {
      const normalizedText = text.trim()
      const startedAt = typeof performance !== 'undefined' ? performance.now() : Date.now()
      const querySample = normalizedText.length > 120 ? `${normalizedText.slice(0, 120)}…` : normalizedText

      recordEvent('chatbot_query', 'chatbot', CHATBOT_ROOM_ID, {
        queryLength: normalizedText.length,
        querySample,
        hasLoginUser: !!user
      })

      const timestamp = new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
      addMessage(CHATBOT_ROOM_ID, {
        id: `chatbot-user-${Date.now()}`,
        user: 'You',
        text,
        timestamp
      })

      setIsWaitingForResponse(true)
      try {
        const botResponse = await generateChatbotResponseWithFallback(text, user ?? undefined)
        const botAction = getChatbotAction(text)
        const endedAt = typeof performance !== 'undefined' ? performance.now() : Date.now()

        recordEvent('chatbot_response', 'chatbot', CHATBOT_ROOM_ID, {
          queryLength: normalizedText.length,
          responseLength: botResponse.length,
          responseMs: Math.max(0, Math.round(endedAt - startedAt)),
          hasAction: !!botAction,
          actionPath: botAction?.path ?? null
        })

        addMessage(CHATBOT_ROOM_ID, {
          id: `chatbot-bot-${Date.now()}`,
          user: 'Chatbot',
          text: botResponse,
          timestamp: new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
          action: botAction
        })
      } finally {
        setIsWaitingForResponse(false)
      }
      return
    }

    if (!supabaseRoomIds.has(safeSelectedRoomId) || !user) return
    addSupabaseMessage(safeSelectedRoomId, user.userId, user.nickname, text).catch((error) => {
      console.error('Failed to send Supabase message:', error)
    })
  }

  return (
    <>
      {open && (
        <div
          onClick={onClose}
          data-preserve-auth-card="true"
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.3)',
            zIndex: 997
          }}
        />
      )}
      {open && (
        <div
          style={{
            position: 'fixed',
            bottom: panelBottom,
            right: panelRight,
            width: panelWidth,
            maxHeight: `${panelHeight}px`,
            height: `${panelHeight}px`,
            backgroundColor: '#FFFFFF',
            borderRadius: 12,
            boxShadow: '0 16px 40px rgba(15, 23, 42, 0.22)',
            display: 'flex',
            flexDirection: 'column',
            zIndex: 998,
            animation: 'slideUp 0.3s ease-out'
          }}
        >
          <div style={{
            padding: 16,
            borderBottom: '1px solid #dbeafe',
            background: 'linear-gradient(135deg, #3B82F6 0%, #0EA5E9 100%)',
            color: '#FFFFFF',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            borderTopLeftRadius: 12,
            borderTopRightRadius: 12
          }}>
            <b>Hackathon Chat</b>
            <button
              onClick={onClose}
              data-preserve-auth-card="true"
              style={{
                border: 'none',
                background: 'none',
                color: '#FFFFFF',
                fontSize: 24,
                cursor: 'pointer'
              }}
            >
              ✕
            </button>
          </div>
          <div style={{
            display: 'flex',
            flex: 1,
            overflow: 'hidden',
            backgroundColor: '#FFFFFF'
          }}>
            <ChatRoomList
              rooms={sortedRooms}
              selectedRoomId={safeSelectedRoomId ?? ''}
              directRoomIds={directRoomIds}
              onSelectRoom={(rid) => {
                if (!allowedRoomIds.includes(rid)) return
                setSelectedRoomId(rid)
                if (supabaseRoomIds.has(rid)) markRoomSeen(rid)
              }}
              onLeaveRoom={async (roomId) => {
                await leaveDirectRoom(roomId)
                if (selectedRoomId === roomId) setSelectedRoomId(null)
              }}
            />
            <div style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              backgroundColor: '#FFFFFF'
            }}>
              {safeSelectedRoomId ? (
                <>
                  <ChatMessages
                    messages={chatData.messages[safeSelectedRoomId] || []}
                    onInviteResponse={handleInviteResponse}
                    respondingInviteId={respondMutation.isPending ? (respondMutation.variables?.inviteId ?? null) : null}
                  />
                  {isReadOnlyGeneralRoom ? (
                    <div
                      style={{
                        borderTop: '1px solid #e5e7eb',
                        backgroundColor: '#f8fafc',
                        color: '#64748b',
                        fontSize: 13,
                        padding: '12px 14px',
                        textAlign: 'center'
                      }}
                    >
                      공지/일반 채팅방은 읽기 전용입니다.
                    </div>
                  ) : (
                    <ChatInput
                      onSend={handleSendMessage}
                      isLoading={safeSelectedRoomId === CHATBOT_ROOM_ID && isWaitingForResponse}
                      isChatbot={safeSelectedRoomId === CHATBOT_ROOM_ID}
                    />
                  )}
                </>
              ) : (
                <div style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: 24,
                  color: '#64748b',
                  fontSize: 14,
                  textAlign: 'center'
                }}>
                  {isLoggedIn ? '참여 중인 채팅방이 없습니다.' : '로그인 후 Supabase 채팅방을 이용할 수 있습니다.'}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      <style>{`
        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </>
  )
}
