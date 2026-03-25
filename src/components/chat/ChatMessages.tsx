import { useEffect, useRef } from 'react'
import { router } from '../../router/router'
import type { ChatMessage } from '../../utils/chatStorage'

type Props = {
  messages: ChatMessage[]
  onInviteResponse?: (inviteId: string, status: 'ACCEPTED' | 'REJECTED') => void
  respondingInviteId?: string | null
}

// HTML 특수문자 이스케이프 (XSS 방지)
const escapeHtml = (text: string): string =>
  text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')

const formatMessage = (text: string): string => {
  return escapeHtml(text)
    // 코드 블록 ```...```
    .replace(
      /```[\w]*\n?([\s\S]*?)```/g,
      '<pre style="background:#f1f5f9;padding:8px 12px;border-radius:6px;font-size:12px;overflow-x:auto;margin:6px 0;font-family:monospace;white-space:pre-wrap">$1</pre>'
    )
    // 인라인 코드 `code`
    .replace(
      /`([^`]+)`/g,
      '<code style="background:#f1f5f9;padding:2px 5px;border-radius:4px;font-size:12px;font-family:monospace">$1</code>'
    )
    // 굵게 **text**
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    // 기울임 *text*
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    // 불릿 항목 (줄 시작의 • 또는 -)
    .replace(
      /^[•\-] (.+)$/gm,
      '<span style="display:block;padding:2px 0 2px 10px;border-left:2px solid #3b82f6;margin:2px 0">• $1</span>'
    )
    // 번호 목록 "1. text"
    .replace(
      /^(\d+)\. (.+)$/gm,
      '<span style="display:block;padding:2px 0 2px 4px;margin:2px 0"><strong>$1.</strong> $2</span>'
    )
    // 구분선 ---
    .replace(/^---+$/gm, '<hr style="border:none;border-top:1px solid #e2e8f0;margin:8px 0"/>')
    // 줄바꿈
    .replace(/\n/g, '<br />')
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
