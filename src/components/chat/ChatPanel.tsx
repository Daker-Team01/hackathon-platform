import { useEffect, useState } from 'react'
import { useUser } from '../../contexts/UserContext'
import { useChat } from '../../contexts/ChatContext'
import { generateChatbotResponse, getChatbotAction } from '../../api/chatbotApi'
import { useRespondToInvite } from '../../hooks/useTeams'
import ChatRoomList from './ChatRoomList'
import ChatMessages from './ChatMessages'
import ChatInput from './ChatInput'
import { GENERAL_ROOM_ID } from '../../utils/chatStorage'

type Props = {
  open: boolean
  onClose: () => void
}

export default function ChatPanel({ open, onClose }: Props) {
  const { isLoggedIn } = useUser()
  const { chatData, addMessage } = useChat()
  const respondMutation = useRespondToInvite()
  const [selectedRoomId, setSelectedRoomId] = useState(GENERAL_ROOM_ID)
  const [isWaitingForResponse, setIsWaitingForResponse] = useState(false)
  const [panelWidth, setPanelWidth] = useState(500)
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
      const nextHeight = Math.max(420, Math.min(900, Math.floor(vh - verticalMargin * 2)))

      const safeBottomInset = vv
        ? Math.max(0, window.innerHeight - (vv.height + vv.offsetTop))
        : 0

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

  // 로그인 안 했을 때는 챗봇/일반방만 노출
  const allowedRoomIds = isLoggedIn ? chatData.rooms.map(r => r.id) : [GENERAL_ROOM_ID, '4']
  const filteredRooms = chatData.rooms.filter(r => allowedRoomIds.includes(r.id))
  // 선택된 방이 허용되지 않으면 일반방으로 강제
  const safeSelectedRoomId = allowedRoomIds.includes(selectedRoomId) ? selectedRoomId : GENERAL_ROOM_ID

  const handleInviteResponse = (inviteId: string, status: 'ACCEPTED' | 'REJECTED') => {
    const actionLabel = status === 'ACCEPTED' ? '수락' : '거절'

    if (window.confirm(`이 팀 초대를 ${actionLabel}하시겠습니까?`)) {
      respondMutation.mutate({ inviteId, status })
    }
  }

  const handleSendMessage = (text: string) => {
    const timestamp = new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
    const uniqueId = Date.now().toString()
    const userMessage = {
      id: uniqueId,
      user: 'You',
      text,
      timestamp
    }
    addMessage(safeSelectedRoomId, userMessage)

    if (safeSelectedRoomId === '4') {
      setIsWaitingForResponse(true)
      setTimeout(() => {
        const botResponse = generateChatbotResponse(text)
        const botAction = getChatbotAction(text)
        const botMessage = {
          id: (Date.now() + 1).toString(),
          user: 'Chatbot',
          text: botResponse,
          timestamp: new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
          action: botAction
        }
        addMessage(safeSelectedRoomId, botMessage)
        setIsWaitingForResponse(false)
      }, 600)
    }
  }

  return (
    <>
      {open && (
        <div
          onClick={onClose}
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
              rooms={filteredRooms}
              selectedRoomId={safeSelectedRoomId}
              onSelectRoom={rid => {
                if (allowedRoomIds.includes(rid)) setSelectedRoomId(rid)
              }}
            />
            <div style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              backgroundColor: '#FFFFFF'
            }}>
              <ChatMessages
                messages={chatData.messages[safeSelectedRoomId] || []}
                onInviteResponse={handleInviteResponse}
                respondingInviteId={respondMutation.isPending ? (respondMutation.variables?.inviteId ?? null) : null}
              />
              <ChatInput 
                onSend={handleSendMessage} 
                isLoading={safeSelectedRoomId === '4' && isWaitingForResponse}
                isChatbot={safeSelectedRoomId === '4'}
              />
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
