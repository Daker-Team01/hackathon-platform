import { useState } from 'react'
import ChatButton from './components/chat/ChatButton'
import ChatPanel from './components/chat/ChatPanel'
import ProfileSidebar from './components/profile/ProfileSidebar'

export default function App({ children }: { children: React.ReactNode }) {
  const [chatOpen, setChatOpen] = useState(false)

  return (
    <div>
      {/* 프로필 사이드바 - 왼쪽 위에 고정 */}
      <ProfileSidebar />

      {/* 메인 컨텐츠 */}
      <div style={{ marginLeft: 320 }}>
        {children}
      </div>
      
      {/* 채팅 UI - 오른쪽 아래에 고정 */}
      <ChatButton onClick={() => setChatOpen(!chatOpen)} open={chatOpen} />
      <ChatPanel open={chatOpen} onClose={() => setChatOpen(false)} />
    </div>
  )
}