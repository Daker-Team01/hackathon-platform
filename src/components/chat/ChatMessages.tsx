import { useEffect, useRef } from 'react'

type Message = {
  id: string
  user: string
  text: string
  timestamp: string
}

type Props = {
  messages: Message[]
}

const formatMessage = (text: string) => {
  // 마크다운 형식의 텍스트를 HTML로 변환
  let formatted = text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/\n/g, '<br />')
  return formatted
}

export default function ChatMessages({ messages }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)

  // 새 메시지가 추가될 때 자동으로 밑으로 스크롤
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight
    }
  }, [messages])

  return (
    <div 
      ref={containerRef}
      style={{
        flex: 1,
        overflow: "auto",
        padding: 16,
        backgroundColor: "#fafafa",
        display: "flex",
        flexDirection: "column",
        gap: 12
      }}
    >
      {messages.length === 0 ? (
        <div style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: "100%",
          color: "#999",
          fontSize: 14
        }}>
          💬 메시지를 입력하세요
        </div>
      ) : (
        messages.map((msg) => (
          <div
            key={msg.id}
            style={{
              display: "flex",
              justifyContent: msg.user === "You" ? "flex-end" : "flex-start",
              marginBottom: 4
            }}
          >
            <div style={{
              maxWidth: "75%",
              padding: "12px 14px",
              borderRadius: 12,
              backgroundColor: msg.user === "You" ? "#4f46e5" : "#e5e7eb",
              color: msg.user === "You" ? "white" : "#1f2937",
              boxShadow: "0 1px 2px rgba(0,0,0,0.1)",
              wordWrap: "break-word"
            }}>
              <div style={{
                fontSize: 12,
                marginBottom: 6,
                opacity: msg.user === "You" ? 0.8 : 0.6,
                fontWeight: 500
              }}>
                {msg.user} · {msg.timestamp}
              </div>
              <div 
                style={{ 
                  fontSize: 14,
                  lineHeight: 1.5
                }}
                dangerouslySetInnerHTML={{ __html: formatMessage(msg.text) }}
              />
            </div>
          </div>
        ))
      )}
    </div>
  )
}
