import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import ChatButton from './components/chat/ChatButton'
import ChatPanel from './components/chat/ChatPanel'

export default function App() {
  const [chatOpen, setChatOpen] = useState(false)

  return (
    <div>
      <Outlet />
      
      {/* 채팅 UI - 모든 페이지에서 사용 가능 */}
      <ChatButton onClick={() => setChatOpen(!chatOpen)} open={chatOpen} />
      <ChatPanel open={chatOpen} onClose={() => setChatOpen(false)} />
    </div>
  )
}