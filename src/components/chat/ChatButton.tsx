import { useUser } from '../../contexts/UserContext'

type Props = {
  onClick: () => void
  open: boolean
}

export default function ChatButton({ onClick, open }: Props) {
  const { isLoggedIn } = useUser()

  // 로그인하지 않았으면 버튼을 표시하지 않음
  if (!isLoggedIn) {
    return null
  }

  return (
    <button
      onClick={onClick}
      style={{
        position: "fixed",
        bottom: 20,
        right: open ? 620 : 20,
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
        transition: "right 0.3s ease"
      }}
    >
      💬
    </button>
  )
}
