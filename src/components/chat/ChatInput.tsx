import { useState } from "react"

type Props = {
  onSend: (text: string) => void
  isLoading?: boolean
  isChatbot?: boolean
}

const QUICK_QUESTIONS = [
  "진행 중인 해커톤",
  "팀 찾기",
  "랭킹",
  "도움말"
]

export default function ChatInput({ onSend, isLoading = false, isChatbot = false }: Props) {
  const [text, setText] = useState("")

  const handleSend = () => {
    if (!text.trim() || isLoading) return
    onSend(text)
    setText("")
  }

  const handleQuickQuestion = (question: string) => {
    onSend(question)
  }

  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      backgroundColor: "white",
      borderTop: "1px solid #eee"
    }}>
      {/* 빠른 질문 버튼 (챗봇 룸일 때만) */}
      {isChatbot && (
        <div style={{
          padding: "12px 12px 0 12px",
          display: "flex",
          gap: 6,
          flexWrap: "wrap",
          backgroundColor: "transparent"
        }}>
          {QUICK_QUESTIONS.map((question) => (
            <button
              key={question}
              onClick={() => handleQuickQuestion(question)}
              disabled={isLoading}
              style={{
                padding: "8px 14px",
                backgroundColor: "transparent",
                color: "#4f46e5",
                border: "1.5px solid #4f46e5",
                borderRadius: 20,
                fontSize: 13,
                fontWeight: 600,
                cursor: isLoading ? "not-allowed" : "pointer",
                transition: "all 0.2s ease",
                opacity: isLoading ? 0.5 : 1,
                whiteSpace: "nowrap"
              }}
              onMouseEnter={(e) => {
                if (!isLoading) {
                  const button = e.currentTarget
                  button.style.backgroundColor = "#4f46e5"
                  button.style.color = "white"
                  button.style.boxShadow = "0 4px 12px rgba(79, 70, 229, 0.3)"
                  button.style.transform = "translateY(-2px)"
                }
              }}
              onMouseLeave={(e) => {
                const button = e.currentTarget
                button.style.backgroundColor = "transparent"
                button.style.color = "#4f46e5"
                button.style.boxShadow = "none"
                button.style.transform = "translateY(0)"
              }}
            >
              {question}
            </button>
          ))}
        </div>
      )}

      {/* 메시지 입력 */}
      <div style={{
        padding: 12,
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
            padding: "10px 12px",
            border: "1px solid #ddd",
            borderRadius: 6,
            fontSize: 14,
            opacity: isLoading ? 0.6 : 1,
            cursor: isLoading ? "not-allowed" : "text",
            transition: "border 0.2s"
          }}
          onFocus={(e) => {
            if (!isLoading) {
              e.currentTarget.style.borderColor = "#4f46e5"
              e.currentTarget.style.boxShadow = "0 0 0 3px rgba(79, 70, 229, 0.1)"
            }
          }}
          onBlur={(e) => {
            e.currentTarget.style.borderColor = "#ddd"
            e.currentTarget.style.boxShadow = "none"
          }}
        />
        <button
          onClick={handleSend}
          disabled={isLoading}
          style={{
            padding: "10px 20px",
            backgroundColor: isLoading ? "#d1d5db" : "#4f46e5",
            color: "white",
            border: "none",
            borderRadius: 6,
            cursor: isLoading ? "not-allowed" : "pointer",
            fontSize: 14,
            fontWeight: "bold",
            transition: "background-color 0.2s"
          }}
          onMouseEnter={(e) => {
            if (!isLoading) {
              const button = e.currentTarget
              button.style.backgroundColor = "#4338ca"
            }
          }}
          onMouseLeave={(e) => {
            if (!isLoading) {
              const button = e.currentTarget
              button.style.backgroundColor = "#4f46e5"
            }
          }}
        >
          {isLoading ? "⏳" : "Send"}
        </button>
      </div>
    </div>
  )
}
