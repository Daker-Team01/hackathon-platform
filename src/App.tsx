import { useState } from 'react'
import ChatButton from './components/chat/ChatButton'
import ChatPanel from './components/chat/ChatPanel'
import ProfileSidebar from './components/profile/ProfileSidebar'

export default function App({ children }: { children: React.ReactNode }) {
  const [chatOpen, setChatOpen] = useState(false)

  return (
    <div>
      {/* 프로필 사이드바 - 오른쪽 상단에 고정 (채팅 열리면 우측 이동) */}
      <ProfileSidebar chatOpen={chatOpen} />

      {/* 메인 컨텐츠 - 오른쪽에 여백 추가 (마이페이지 너비 + 마진) */}
      <div style={{ padding: 20, paddingRight: 320 }}>
        {children}
      </div>
      
      {/* 채팅 UI - 오른쪽 상단 (마이페이지 아래) */}
      <ChatButton onClick={() => setChatOpen(!chatOpen)} open={chatOpen} />
      <ChatPanel open={chatOpen} onClose={() => setChatOpen(false)} />
    </div>
  )
}