import { useState } from 'react'
import ChatButton from './components/chat/ChatButton'
import ChatPanel from './components/chat/ChatPanel'
import Navbar from './components/Navbar'

export default function App({ children }: { children: React.ReactNode }) {
  const [chatOpen, setChatOpen] = useState(false)

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <main className="relative min-h-[calc(100vh-84px)]">
        <div className="container mx-auto py-8">
          {children}
        </div>
      </main>

      <ChatButton onClick={() => setChatOpen(true)} open={chatOpen} />
      <ChatPanel open={chatOpen} onClose={() => setChatOpen(false)} />
    </div>
  )
}
