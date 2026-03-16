import { useUser } from '../../contexts/UserContext'
import LoginForm from './LoginForm'
import UserProfile from './UserProfile'

export default function ProfileSidebar() {
  const { isLoggedIn } = useUser()

  return (
    <div
      style={{
        position: 'fixed',
        left: 20,
        top: 20,
        width: 280,
        maxHeight: 'calc(100vh - 40px)',
        backgroundColor: 'white',
        border: '1px solid #e5e7eb',
        borderRadius: 12,
        padding: 20,
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
        zIndex: 999,
        overflowY: 'auto'
      }}
    >
      <h2 style={{ margin: '0 0 20px 0', fontSize: 18, fontWeight: 700 }}>
        {isLoggedIn ? '마이페이지' : '로그인'}
      </h2>

      {isLoggedIn ? <UserProfile /> : <LoginForm />}
    </div>
  )
}
