import { useEffect, useRef } from 'react'
import { router } from '../../router/router'
import type { ChatMessage } from '../../utils/chatStorage'

type Props = {
  messages: ChatMessage[]
  onInviteResponse?: (inviteId: string, status: 'ACCEPTED' | 'REJECTED') => void
  respondingInviteId?: string | null
}

const formatMessage = (text: string) => {
  // 마크다운 형식의 텍스트를 HTML로 변환
  let formatted = text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/\n/g, '<br />')
  return formatted
}

const INVITE_STATUS_META = {
  PENDING: { label: '응답 대기', backgroundColor: '#fef3c7', color: '#92400e' },
  ACCEPTED: { label: '수락됨', backgroundColor: '#dcfce7', color: '#166534' },
  REJECTED: { label: '거절됨', backgroundColor: '#fee2e2', color: '#991b1b' }
} as const

export default function ChatMessages({ messages, onInviteResponse, respondingInviteId }: Props) {
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
        backgroundColor: "#FFFFFF",
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
          color: "#94a3b8",
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
              background: msg.user === "You"
                ? "linear-gradient(135deg, #3B82F6 0%, #0EA5E9 100%)"
                : (msg.invite ? "#EFF6FF" : "#F1F5F9"),
              color: msg.user === "You" ? "#FFFFFF" : "#0f172a",
              border: msg.user === "You" ? "none" : "1px solid #E2E8F0",
              boxShadow: "0 2px 8px rgba(15, 23, 42, 0.08)",
              wordWrap: "break-word"
            }}>
              <div style={{
                fontSize: 12,
                marginBottom: 6,
                opacity: msg.user === "You" ? 0.9 : 0.65,
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
              {msg.invite && (
                <div style={{ marginTop: 10, display: 'grid', gap: 8 }}>
                  <span
                    style={{
                      display: 'inline-flex',
                      width: 'fit-content',
                      padding: '4px 8px',
                      borderRadius: 999,
                      fontSize: 11,
                      fontWeight: 700,
                      backgroundColor: INVITE_STATUS_META[msg.invite.status].backgroundColor,
                      color: INVITE_STATUS_META[msg.invite.status].color
                    }}
                  >
                    {INVITE_STATUS_META[msg.invite.status].label}
                  </span>

                  {msg.invite.status === 'PENDING' && onInviteResponse && (
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        onClick={() => onInviteResponse(msg.invite!.inviteId, 'ACCEPTED')}
                        disabled={respondingInviteId === msg.invite.inviteId}
                        style={{
                          flex: 1,
                          padding: '8px 10px',
                          borderRadius: 8,
                          border: 'none',
                          backgroundColor: '#10b981',
                          color: 'white',
                          fontSize: 12,
                          fontWeight: 700,
                          cursor: respondingInviteId === msg.invite.inviteId ? 'not-allowed' : 'pointer',
                          opacity: respondingInviteId === msg.invite.inviteId ? 0.6 : 1
                        }}
                      >
                        수락
                      </button>
                      <button
                        onClick={() => onInviteResponse(msg.invite!.inviteId, 'REJECTED')}
                        disabled={respondingInviteId === msg.invite.inviteId}
                        style={{
                          flex: 1,
                          padding: '8px 10px',
                          borderRadius: 8,
                          border: 'none',
                          backgroundColor: '#ef4444',
                          color: 'white',
                          fontSize: 12,
                          fontWeight: 700,
                          cursor: respondingInviteId === msg.invite.inviteId ? 'not-allowed' : 'pointer',
                          opacity: respondingInviteId === msg.invite.inviteId ? 0.6 : 1
                        }}
                      >
                        거절
                      </button>
                    </div>
                  )}
                </div>
              )}
              {msg.user === 'Chatbot' && msg.action && (
                <button
                  onClick={() => {
                    if (msg.action) {
                      router.navigate(msg.action.path)
                    }
                  }}
                  style={{
                    marginTop: 10,
                    width: '100%',
                    padding: '8px 10px',
                    borderRadius: 8,
                    border: 'none',
                    background: 'linear-gradient(135deg, #3B82F6 0%, #0EA5E9 100%)',
                    color: '#FFFFFF',
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  {msg.action.label}
                </button>
              )}
            </div>
          </div>
        ))
      )}
    </div>
  )
}
