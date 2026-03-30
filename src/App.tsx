import { useState, useEffect } from 'react'
import ChatButton from './components/chat/ChatButton'
import ChatPanel from './components/chat/ChatPanel'
import Navbar from './components/Navbar'
import { useChat } from './contexts/ChatContext'

const OPEN_CHAT_PANEL_KEY = 'openChatPanel'

export default function App({ children }: { children: React.ReactNode }) {
  const [chatOpen, setChatOpen] = useState(false)
  const [authCardOpen, setAuthCardOpen] = useState(false)
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0)
  const { unreadTotalCount } = useChat()
  const totalBadgeCount = unreadTotalCount + unreadNotificationCount

  // sessionStorage 변화를 감시하여 ChatPanel 자동 열기
  useEffect(() => {
    const handleStorageChange = () => {
      const shouldOpen = sessionStorage.getItem(OPEN_CHAT_PANEL_KEY)
      if (shouldOpen) {
        setChatOpen(true)
        sessionStorage.removeItem(OPEN_CHAT_PANEL_KEY)
      }
    }

    // 커스텀 이벤트 감시 (같은 탭에서의 변경)
    window.addEventListener('sessionStorageChanged', handleStorageChange)
    
    // storage 이벤트 감시 (다른 탭에서의 변경)
    window.addEventListener('storage', handleStorageChange)
    
    // 초기 로드 시 확인
    handleStorageChange()

    return () => {
      window.removeEventListener('sessionStorageChanged', handleStorageChange)
      window.removeEventListener('storage', handleStorageChange)
    }
  }, [])

  return (
    <div className="relative min-h-screen overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_10%_15%,rgba(59,130,246,0.18),transparent_35%),radial-gradient(circle_at_85%_20%,rgba(14,165,233,0.2),transparent_38%),linear-gradient(180deg,#F8FCFF_0%,#EEF8FF_55%,#F7FBFF_100%)]" />
      <div className="pointer-events-none absolute -top-20 -left-10 h-72 w-72 rounded-full bg-[#3B82F6]/15 blur-3xl" />
      <div className="pointer-events-none absolute top-40 -right-20 h-80 w-80 rounded-full bg-[#0EA5E9]/20 blur-3xl" />
      <Navbar
        chatOpen={chatOpen}
        authCardOpen={authCardOpen}
        onAuthCardOpenChange={setAuthCardOpen}
        onUnreadNotificationCountChange={setUnreadNotificationCount}
      />

      <main className="relative z-10 min-h-[calc(100vh-84px)]">
        <div className="container mx-auto py-8">
          {children}
        </div>
      </main>

      <ChatButton onClick={() => setChatOpen(true)} open={chatOpen} unreadCount={totalBadgeCount} />
      <ChatPanel open={chatOpen} onClose={() => setChatOpen(false)} />
    </div>
  )
}
