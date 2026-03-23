import { useState } from 'react'
import ChatButton from './components/chat/ChatButton'
import ChatPanel from './components/chat/ChatPanel'
import Navbar from './components/Navbar'

export default function App({ children }: { children: React.ReactNode }) {
  const [chatOpen, setChatOpen] = useState(false)
  const [authCardOpen, setAuthCardOpen] = useState(false)

  return (
    <div className="relative min-h-screen overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_10%_15%,rgba(59,130,246,0.18),transparent_35%),radial-gradient(circle_at_85%_20%,rgba(14,165,233,0.2),transparent_38%),linear-gradient(180deg,#F8FCFF_0%,#EEF8FF_55%,#F7FBFF_100%)]" />
      <div className="pointer-events-none absolute -top-20 -left-10 h-72 w-72 rounded-full bg-[#3B82F6]/15 blur-3xl" />
      <div className="pointer-events-none absolute top-40 -right-20 h-80 w-80 rounded-full bg-[#0EA5E9]/20 blur-3xl" />
      <Navbar
        chatOpen={chatOpen}
        authCardOpen={authCardOpen}
        onAuthCardOpenChange={setAuthCardOpen}
      />

      <main className="relative z-10 min-h-[calc(100vh-84px)]">
        <div className="container mx-auto py-8">
          {children}
        </div>
      </main>

      <ChatButton onClick={() => setChatOpen(true)} open={chatOpen} />
      <ChatPanel open={chatOpen} onClose={() => setChatOpen(false)} />
    </div>
  )
}
