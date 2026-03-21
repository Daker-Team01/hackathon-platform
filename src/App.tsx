import { useState } from 'react'
import ChatButton from './components/chat/ChatButton'
import ChatPanel from './components/chat/ChatPanel'
import ProfileSidebar from './components/profile/ProfileSidebar'
import Navbar from './components/Navbar'

export default function App({ children }: { children: React.ReactNode }) {
  const [chatOpen, setChatOpen] = useState(false)

  return (
    <div className="min-h-screen bg-background">
      {/* 상단 네비게이션 (목업 스타일용 빈 바) */}
      <Navbar />

      <main className="relative flex min-h-screen">
        {/* 메인 컨텐츠 영역 */}
        <div className={`flex-1 transition-all duration-300 ${chatOpen ? 'pr-[400px]' : 'pr-0'}`}>
          <div className="container mx-auto py-8">
            {children}
          </div>
        </div>

        {/* 사이드바 & 채팅 패널 (오른쪽 고정) */}
        <div className="fixed top-20 right-4 z-40 flex flex-col gap-4">
          <ProfileSidebar chatOpen={chatOpen} />
          
          <div className="flex justify-end">
            <ChatButton onClick={() => setChatOpen(!chatOpen)} open={chatOpen} />
          </div>
          
          {chatOpen && (
            <div className="w-[360px] h-[600px] shadow-2xl rounded-2xl overflow-hidden border border-gray-100">
              <ChatPanel open={chatOpen} onClose={() => setChatOpen(false)} />
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
