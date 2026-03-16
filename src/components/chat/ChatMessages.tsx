type Message = {
  id: string
  user: string
  text: string
  timestamp: string
}

type Props = {
  messages: Message[]
}

export default function ChatMessages({ messages }: Props) {
  return (
    <div style={{
      flex: 1,
      overflow: "auto",
      padding: 16,
      backgroundColor: "#fafafa",
      display: "flex",
      flexDirection: "column",
      gap: 12
    }}>
      {messages.length === 0 ? (
        <div style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: "100%",
          color: "#999"
        }}>
          메시지를 입력하세요
        </div>
      ) : (
        messages.map((msg) => (
          <div
            key={msg.id}
            style={{
              display: "flex",
              justifyContent: msg.user === "You" ? "flex-end" : "flex-start"
            }}
          >
            <div style={{
              maxWidth: "70%",
              padding: 10,
              borderRadius: 8,
              backgroundColor: msg.user === "You" ? "#4f46e5" : "#fff",
              color: msg.user === "You" ? "white" : "#000",
              border: msg.user === "You" ? "none" : "1px solid #ddd"
            }}>
              <div style={{
                fontSize: 11,
                marginBottom: 4,
                opacity: 0.7
              }}>
                {msg.user} · {msg.timestamp}
              </div>
              <div style={{ fontSize: 14 }}>{msg.text}</div>
            </div>
          </div>
        ))
      )}
    </div>
  )
}
