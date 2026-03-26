type Props = {
  onClick: () => void
  open: boolean
  unreadCount?: number
}

export default function ChatButton({ onClick, open, unreadCount = 0 }: Props) {
  // 채팅창이 열려있으면 버튼 숨김
  if (open) return null

  return (
    <button
      onClick={onClick}
      data-preserve-auth-card="true"
      aria-label="채팅 열기"
      style={{
        position: "fixed",
        bottom: 20,
        right: 20,
        width: 60,
        height: 60,
        borderRadius: "50%",
        background: "linear-gradient(135deg, #3B82F6 0%, #0EA5E9 100%)",
        color: "#FFFFFF",
        border: "none",
        fontSize: 24,
        cursor: "pointer",
        zIndex: 1000,
        boxShadow: "0 10px 22px rgba(14, 165, 233, 0.35)",
        transition: "transform 0.2s ease, box-shadow 0.2s ease"
      }}
      onMouseOver={(e) => {
        e.currentTarget.style.transform = 'scale(1.08)'
        e.currentTarget.style.boxShadow = '0 14px 26px rgba(59, 130, 246, 0.4)'
      }}
      onMouseOut={(e) => {
        e.currentTarget.style.transform = 'scale(1)'
        e.currentTarget.style.boxShadow = '0 10px 22px rgba(14, 165, 233, 0.35)'
      }}
      title="채팅"
    >
      💬
      {unreadCount > 0 && (
        <span
          style={{
            position: 'absolute',
            top: -2,
            right: -2,
            backgroundColor: '#ef4444',
            color: 'white',
            borderRadius: '50%',
            width: 20,
            height: 20,
            fontSize: 10,
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: '2px solid white',
            pointerEvents: 'none'
          }}
        >
          {unreadCount > 99 ? '99+' : unreadCount}
        </span>
      )}
    </button>
  )
}
