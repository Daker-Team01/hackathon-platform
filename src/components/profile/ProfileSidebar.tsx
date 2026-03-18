import { useUser } from '../../contexts/UserContext'
import LoginForm from './LoginForm'
import UserProfile from './UserProfile'
import NotificationPanel from './NotificationPanel'
import { useEffect, useRef, useState } from 'react'

type Props = {
  chatOpen: boolean
}

export default function ProfileSidebar({ chatOpen }: Props) {
  const { isLoggedIn } = useUser()
  const sidebarRef = useRef<HTMLDivElement>(null)
  const [windowWidth, setWindowWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1400)

  // 윈도우 크기 변경 감지
  useEffect(() => {
    const handleResize = () => {
      setWindowWidth(window.innerWidth)
    }

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  // ProfileSidebar 높이를 측정해서 CSS custom property로 설정
  useEffect(() => {
    const sidebar = sidebarRef.current
    if (!sidebar) return

    const updateSidebarHeight = () => {
      const height = sidebar.offsetHeight
      document.documentElement.style.setProperty('--sidebar-height', `${height}px`)
    }

    // 초기 측정
    updateSidebarHeight()

    // ResizeObserver로 크기 변경 모니터링
    const resizeObserver = new ResizeObserver(() => {
      updateSidebarHeight()
    })
    resizeObserver.observe(sidebar)

    return () => resizeObserver.disconnect()
  }, [isLoggedIn])

  // 화면이 900px 이하면 ProfileSidebar 숨김
  const shouldHide = windowWidth < 900

  return (
    <div
      ref={sidebarRef}
      style={{
        position: 'fixed',
        right: chatOpen ? 540 : 20,
        top: 20,
        width: 280,
        maxHeight: 'calc(100vh - 40px)',
        backgroundColor: 'white',
        border: '1px solid #e5e7eb',
        borderRadius: 12,
        padding: 20,
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
        zIndex: 999,
        overflowY: 'auto',
        transition: 'right 0.3s ease',
        display: shouldHide ? 'none' : 'block'
      }}
    >
      <h2 style={{ margin: '0 0 20px 0', fontSize: 18, fontWeight: 700 }}>
        {isLoggedIn ? '마이페이지' : '로그인'}
      </h2>

      {isLoggedIn ? (
        <>
          <UserProfile />
          <NotificationPanel />
        </>
      ) : <LoginForm />}
    </div>
  )
}

