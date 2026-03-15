import { useState } from "react"

type Props = {
  onSend: (text: string) => void
}

export default function ChatInput({ onSend }: Props) {
  const [text, setText] = useState("")

  const handleSend = () => {
    if (!text.trim()) return
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
        placeholder="메시지 입력..."
        style={{
          flex: 1,
          padding: 8,
          border: "1px solid #ddd",
          borderRadius: 4,
          fontSize: 14
        }}
      />
      <button
        onClick={handleSend}
        style={{
          padding: "8px 16px",
          backgroundColor: "#4f46e5",
          color: "white",
          border: "none",
          borderRadius: 4,
          cursor: "pointer",
          fontSize: 14,
          fontWeight: "bold"
        }}
      >
        Send
      </button>
    </div>
  )
}
