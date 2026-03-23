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
    if (isLoading) return
    onSend(question)
  }

  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      backgroundColor: "#FFFFFF",
      borderTop: "1px solid #e5e7eb"
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
                backgroundColor: "#FFFFFF",
                color: "#3B82F6",
                border: "1.5px solid #3B82F6",
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
                  button.style.background = "linear-gradient(135deg, #3B82F6 0%, #0EA5E9 100%)"
                  button.style.color = "#FFFFFF"
                  button.style.borderColor = "transparent"
                  button.style.boxShadow = "0 6px 14px rgba(59, 130, 246, 0.25)"
                  button.style.transform = "translateY(-1px)"
                }
              }}
              onMouseLeave={(e) => {
                const button = e.currentTarget
                button.style.background = "#FFFFFF"
                button.style.color = "#3B82F6"
                button.style.borderColor = "#3B82F6"
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
        backgroundColor: "#FFFFFF"
      }}>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
          placeholder={isLoading ? "응답 대기 중..." : "메시지 입력..."}
          disabled={isLoading}
          style={{
            flex: 1,
            padding: "10px 12px",
            border: "1px solid #d1d5db",
            borderRadius: 8,
            fontSize: 14,
            opacity: isLoading ? 0.6 : 1,
            cursor: isLoading ? "not-allowed" : "text",
            transition: "border 0.2s, box-shadow 0.2s"
          }}
          onFocus={(e) => {
            if (!isLoading) {
              e.currentTarget.style.borderColor = "#3B82F6"
              e.currentTarget.style.boxShadow = "0 0 0 3px rgba(59, 130, 246, 0.15)"
            }
          }}
          onBlur={(e) => {
            e.currentTarget.style.borderColor = "#d1d5db"
            e.currentTarget.style.boxShadow = "none"
          }}
        />
        <button
          onClick={handleSend}
          disabled={isLoading}
          style={{
            padding: "10px 20px",
            background: isLoading ? "#d1d5db" : "linear-gradient(135deg, #3B82F6 0%, #0EA5E9 100%)",
            color: "#FFFFFF",
            border: "none",
            borderRadius: 8,
            cursor: isLoading ? "not-allowed" : "pointer",
            fontSize: 14,
            fontWeight: "bold",
            transition: "transform 0.2s ease, box-shadow 0.2s ease"
          }}
          onMouseEnter={(e) => {
            if (!isLoading) {
              const button = e.currentTarget
              button.style.transform = "translateY(-1px)"
              button.style.boxShadow = "0 8px 16px rgba(14, 165, 233, 0.3)"
            }
          }}
          onMouseLeave={(e) => {
            if (!isLoading) {
              const button = e.currentTarget
              button.style.transform = "translateY(0)"
              button.style.boxShadow = "none"
            }
          }}
        >
          {isLoading ? "⏳" : "Send"}
        </button>
      </div>
    </div>
  )
}
