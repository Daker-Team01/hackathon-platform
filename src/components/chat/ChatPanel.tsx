import { useState } from 'react'
import { useUser } from '../../contexts/UserContext'
import ChatRoomList from './ChatRoomList'
import ChatMessages from './ChatMessages'
import ChatInput from './ChatInput'

type Props = {
  open: boolean
  onClose: () => void
}

export default function ChatPanel({ open, onClose }: Props) {
  const { isLoggedIn, chatData, addMessage } = useUser()
  const [selectedRoomId, setSelectedRoomId] = useState('1')

  // 로그인하지 않았으면 아무것도 렌더링하지 않음
  if (!isLoggedIn || !chatData) {
    return null
  }

  const handleSendMessage = (text: string) => {
    const newMessage = {
      id: String((chatData.messages[selectedRoomId]?.length || 0) + 1),
      user: 'You',
      text,
      timestamp: new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
    }
    addMessage(selectedRoomId, newMessage)
  }

  return (
    <>
      {/* 오버레이 */}
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
            zIndex: 998
          }}
        />
      )}

      {/* 채팅 패널 */}
      <div
        style={{
          position: 'fixed',
          top: 0,
          right: open ? 0 : -600,
          width: 600,
          height: '100vh',
          backgroundColor: 'white',
          boxShadow: '-2px 0 10px rgba(0,0,0,0.1)',
          transition: 'right 0.3s ease',
          display: 'flex',
          flexDirection: 'column',
          zIndex: 999
        }}
      >
        {/* 헤더 */}
        <div style={{
          padding: 16,
          borderBottom: '1px solid #eee',
          backgroundColor: '#4f46e5',
          color: 'white',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
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

        {/* 메인 컨텐츠 */}
        <div style={{
          display: 'flex',
          flex: 1,
          overflow: 'hidden'
        }}>
          {/* 왼쪽: 채팅방 목록 */}
          <ChatRoomList
            rooms={chatData.rooms}
            selectedRoomId={selectedRoomId}
            onSelectRoom={setSelectedRoomId}
          />

          {/* 오른쪽: 메시지 + 입력 */}
          <div style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column'
          }}>
            <ChatMessages messages={chatData.messages[selectedRoomId] || []} />
            <ChatInput onSend={handleSendMessage} />
          </div>
        </div>
      </div>
    </>
  )
}
