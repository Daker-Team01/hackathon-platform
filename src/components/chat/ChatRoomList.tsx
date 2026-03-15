type ChatRoom = {
  id: string
  name: string
  unreadCount: number
}

type Props = {
  rooms: ChatRoom[]
  selectedRoomId: string
  onSelectRoom: (roomId: string) => void
}

export default function ChatRoomList({ rooms, selectedRoomId, onSelectRoom }: Props) {
  return (
    <div style={{
      width: 180,
      backgroundColor: "#f8f9fa",
      borderRight: "1px solid #eee",
      overflowY: "auto"
    }}>
      {rooms.map((room) => (
        <div
          key={room.id}
          onClick={() => onSelectRoom(room.id)}
          style={{
            padding: 12,
            borderBottom: "1px solid #eee",
            cursor: "pointer",
            backgroundColor: selectedRoomId === room.id ? "#e0e7ff" : "transparent",
            borderLeft: selectedRoomId === room.id ? "3px solid #4f46e5" : "none"
          }}
        >
          <div style={{
            fontSize: 14,
            fontWeight: selectedRoomId === room.id ? "bold" : "normal",
            marginBottom: 4
          }}>
            {room.name}
          </div>
          {room.unreadCount > 0 && (
            <div style={{
              display: "inline-flex",
              backgroundColor: "#ef4444",
              color: "white",
              borderRadius: "50%",
              width: 20,
              height: 20,
              fontSize: 12,
              alignItems: "center",
              justifyContent: "center"
            }}>
              {room.unreadCount}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
