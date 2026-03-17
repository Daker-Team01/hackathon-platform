import { useState } from 'react'
import { useUser } from '../../contexts/UserContext'
import { useChat } from '../../contexts/ChatContext'
import { generateChatbotResponse, getChatbotAction } from '../../api/chatbotApi'
import ChatRoomList from './ChatRoomList'
import ChatMessages from './ChatMessages'
import ChatInput from './ChatInput'

type Props = {
  open: boolean
  onClose: () => void
}

export default function ChatPanel({ open, onClose }: Props) {
  const { isLoggedIn } = useUser()
  const { chatData, addMessage } = useChat()
  const [selectedRoomId, setSelectedRoomId] = useState('1')
  const [isWaitingForResponse, setIsWaitingForResponse] = useState(false)

  // 채팅 데이터 없으면 아무것도 렌더링하지 않음
  if (!chatData) return null

  // 로그인 안 했을 때는 챗봇/일반방만 노출
  const allowedRoomIds = isLoggedIn ? chatData.rooms.map(r => r.id) : ['1', '4']
  const filteredRooms = chatData.rooms.filter(r => allowedRoomIds.includes(r.id))
  // 선택된 방이 허용되지 않으면 일반방으로 강제
  const safeSelectedRoomId = allowedRoomIds.includes(selectedRoomId) ? selectedRoomId : '1'

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
            bottom: 20,
            right: 20,
            width: 500,
            maxHeight: '925px',
            height: '925px',
            backgroundColor: 'white',
            borderRadius: 12,
            boxShadow: '0 10px 30px rgba(0, 0, 0, 0.3)',
            display: 'flex',
            flexDirection: 'column',
            zIndex: 998,
            animation: 'slideUp 0.3s ease-out'
          }}
        >
          <div style={{
            padding: 16,
            borderBottom: '1px solid #eee',
            backgroundColor: '#4f46e5',
            color: 'white',
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
                color: 'white',
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
            overflow: 'hidden'
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
              flexDirection: 'column'
            }}>
              <ChatMessages messages={chatData.messages[safeSelectedRoomId] || []} />
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
