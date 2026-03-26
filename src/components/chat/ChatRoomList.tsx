import { useState } from 'react'

type ChatRoom = {
  id: string
  name: string
  unreadCount: number
}

type Props = {
  rooms: ChatRoom[]
  selectedRoomId: string
  onSelectRoom: (roomId: string) => void
  directRoomIds?: Set<string>
  onLeaveRoom?: (roomId: string) => void
}

export default function ChatRoomList({ rooms, selectedRoomId, onSelectRoom, directRoomIds, onLeaveRoom }: Props) {
  const [confirmRoomId, setConfirmRoomId] = useState<string | null>(null)
  const confirmRoom = confirmRoomId ? rooms.find((r) => r.id === confirmRoomId) : null

  return (
    <div style={{
      width: 180,
      backgroundColor: "#f8f9fa",
      borderRight: "1px solid #eee",
      overflowY: "auto"
    }}>
      {rooms.map((room) => {
        const isDirect = directRoomIds?.has(room.id)
        return (
          <div
            key={room.id}
            onClick={() => onSelectRoom(room.id)}
            style={{
              padding: '10px 10px 10px 12px',
              borderBottom: "1px solid #eee",
              cursor: "pointer",
              backgroundColor: selectedRoomId === room.id ? "#e0e7ff" : "transparent",
              borderLeft: selectedRoomId === room.id ? "3px solid #4f46e5" : "3px solid transparent",
              display: "flex",
              alignItems: "center",
              gap: 4,
              justifyContent: "space-between"
            }}
          >
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontSize: 13,
                fontWeight: selectedRoomId === room.id ? "bold" : "normal",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                marginBottom: 2
              }}>
                {room.name}
              </div>
              {room.unreadCount > 0 && (
                <div style={{
                  display: "inline-flex",
                  backgroundColor: "#ef4444",
                  color: "white",
                  borderRadius: "50%",
                  width: 18,
                  height: 18,
                  fontSize: 11,
                  alignItems: "center",
                  justifyContent: "center"
                }}>
                  {room.unreadCount}
                </div>
              )}
            </div>
            {isDirect && onLeaveRoom && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  setConfirmRoomId(room.id)
                }}
                title="채팅방 나가기"
                style={{
                  flexShrink: 0,
                  background: "none",
                  border: "1px solid #d1d5db",
                  borderRadius: 4,
                  padding: "2px 5px",
                  fontSize: 11,
                  cursor: "pointer",
                  color: "#9ca3af",
                  lineHeight: 1.4
                }}
                onMouseOver={(e) => { e.currentTarget.style.borderColor = '#ef4444'; e.currentTarget.style.color = '#ef4444' }}
                onMouseOut={(e) => { e.currentTarget.style.borderColor = '#d1d5db'; e.currentTarget.style.color = '#9ca3af' }}
              >
                나가기
              </button>
            )}
          </div>
        )
      })}

      {/* 나가기 확인 다이얼로그 */}
      {confirmRoom && (
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            position: "fixed",
            top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: "rgba(0,0,0,0.4)",
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center"
          }}
        >
          <div style={{
            backgroundColor: "white",
            borderRadius: 14,
            padding: "28px 24px 20px",
            minWidth: 280,
            maxWidth: 340,
            boxShadow: "0 12px 40px rgba(0,0,0,0.2)",
            textAlign: "center"
          }}>
            <div style={{ fontSize: 28, marginBottom: 12 }}>🚪</div>
            <p style={{ fontSize: 15, fontWeight: 700, color: "#111827", margin: "0 0 8px" }}>
              채팅방 나가기
            </p>
            <p style={{ fontSize: 13, color: "#6b7280", margin: "0 0 20px", lineHeight: 1.6 }}>
              <strong style={{ color: "#374151" }}>{confirmRoom.name}</strong>을(를)<br />
              정말 나가시겠습니까?
            </p>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                onClick={() => setConfirmRoomId(null)}
                style={{
                  flex: 1, padding: "9px 0", borderRadius: 8,
                  border: "1px solid #e5e7eb", background: "white",
                  fontSize: 14, cursor: "pointer", color: "#374151", fontWeight: 500
                }}
              >
                취소
              </button>
              <button
                onClick={() => {
                  onLeaveRoom?.(confirmRoom.id)
                  setConfirmRoomId(null)
                }}
                style={{
                  flex: 1, padding: "9px 0", borderRadius: 8,
                  border: "none", background: "#ef4444",
                  fontSize: 14, cursor: "pointer", color: "white", fontWeight: 700
                }}
              >
                나가기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

