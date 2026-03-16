import { useState } from "react"

type Props = {
  onSend: (text: string) => void
  isLoading?: boolean
}

export default function ChatInput({ onSend, isLoading = false }: Props) {
  const [text, setText] = useState("")

  const handleSend = () => {
    if (!text.trim() || isLoading) return
    onSend(text)
    setText("")
  }

  return (
    <div style={{
      padding: 12,
      borderTop: "1px solid #eee",
      display: "flex",
      gap: 8,
      backgroundColor: "white"
    }}>
      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyPress={(e) => e.key === "Enter" && handleSend()}
        placeholder={isLoading ? "응답 대기 중..." : "메시지 입력..."}
        disabled={isLoading}
        style={{
          flex: 1,
          padding: 8,
          border: "1px solid #ddd",
          borderRadius: 4,
          fontSize: 14,
          opacity: isLoading ? 0.6 : 1,
          cursor: isLoading ? "not-allowed" : "text"
        }}
      />
      <button
        onClick={handleSend}
        disabled={isLoading}
        style={{
          padding: "8px 16px",
          backgroundColor: isLoading ? "#ccc" : "#4f46e5",
          color: "white",
          border: "none",
          borderRadius: 4,
          cursor: isLoading ? "not-allowed" : "pointer",
          fontSize: 14,
          fontWeight: "bold"
        }}
      >
        {isLoading ? "⏳" : "Send"}
      </button>
    </div>
  )
}
