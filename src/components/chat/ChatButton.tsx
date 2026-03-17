type Props = {
  onClick: () => void
  open: boolean
}

export default function ChatButton({ onClick, open }: Props) {
  // 채팅창이 열려있으면 버튼 숨김
  if (open) {
    return null
  }

  return (
    <button
      onClick={onClick}
      style={{
        position: "fixed",
        bottom: 20,
        right: 20,
        width: 60,
        height: 60,
        borderRadius: "50%",
        background: "#4f46e5",
        color: "white",
        border: "none",
        fontSize: 24,
        cursor: "pointer",
        zIndex: 1000,
        boxShadow: "0 4px 12px rgba(79, 70, 229, 0.4)",
        transition: "transform 0.2s, box-shadow 0.2s"
      }}
      onMouseOver={(e) => {
        e.currentTarget.style.transform = 'scale(1.1)'
        e.currentTarget.style.boxShadow = '0 6px 16px rgba(79, 70, 229, 0.6)'
      }}
      onMouseOut={(e) => {
        e.currentTarget.style.transform = 'scale(1)'
        e.currentTarget.style.boxShadow = '0 4px 12px rgba(79, 70, 229, 0.4)'
      }}
      title="채팅"
    >
      💬
    </button>
  )
}
