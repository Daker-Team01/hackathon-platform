import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { LogIn, User, X } from 'lucide-react'
import { useUser } from '../contexts/UserContext'
import LoginForm from './profile/LoginForm'
import UserProfile from './profile/UserProfile'
import NotificationPanel from './profile/NotificationPanel'

type Props = {
  chatOpen?: boolean
  authCardOpen?: boolean
  onAuthCardOpenChange?: (open: boolean) => void
}

export default function Navbar({
  chatOpen = false,
  authCardOpen = false,
  onAuthCardOpenChange
}: Props) {
  const { isLoggedIn, user } = useUser()
  const authCardRef = useRef<HTMLDivElement>(null)
  const [windowWidth, setWindowWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1400)
  const [authCardLayout, setAuthCardLayout] = useState({ top: 96, right: 536, maxHeight: 640 })

  useEffect(() => {
    const updateLayout = () => {
      const vv = window.visualViewport
      const vw = vv?.width ?? window.innerWidth
      const vh = vv?.height ?? window.innerHeight
      const isMobile = vw < 768
      const horizontalMargin = isMobile ? 12 : 20
      const verticalMargin = isMobile ? 12 : 20
      const panelWidth = Math.max(320, Math.min(500, Math.floor(vw - horizontalMargin * 2)))
      const safeBottomInset = vv
        ? Math.max(0, window.innerHeight - (vv.height + vv.offsetTop))
        : 0
      const navbar = document.querySelector('[data-app-navbar="true"]') as HTMLElement | null
      const navbarBottom = navbar?.getBoundingClientRect().bottom ?? 0
      const topClearance = Math.max(verticalMargin, Math.ceil(navbarBottom) + 12)
      const availableHeight = Math.max(
        280,
        Math.floor(vh - topClearance - (verticalMargin + safeBottomInset))
      )
      const panelHeight = Math.max(
        Math.min(availableHeight, 900),
        Math.min(420, availableHeight)
      )
      const panelRight = isMobile ? Math.max(12, Math.floor((vw - panelWidth) / 2)) : 20

      setWindowWidth(window.innerWidth)
      setAuthCardLayout({
        top: Math.max(topClearance, Math.floor(vh - safeBottomInset - verticalMargin - panelHeight)),
        right: panelRight + panelWidth + 16,
        maxHeight: panelHeight
      })
    }

    updateLayout()

    window.addEventListener('resize', updateLayout)
    window.visualViewport?.addEventListener('resize', updateLayout)
    window.visualViewport?.addEventListener('scroll', updateLayout)

    return () => {
      window.removeEventListener('resize', updateLayout)
      window.visualViewport?.removeEventListener('resize', updateLayout)
      window.visualViewport?.removeEventListener('scroll', updateLayout)
    }
  }, [])

  const openBesideChat = chatOpen && windowWidth >= 980

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null
      if (target?.closest('[data-preserve-auth-card="true"]')) {
        return
      }

      if (!authCardRef.current?.contains(event.target as Node)) {
        onAuthCardOpenChange?.(false)
      }
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onAuthCardOpenChange?.(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleEscape)

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [])

  return (
    <header
      data-app-navbar="true"
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 1002,
        backgroundColor: '#FFFFFF',
        borderBottom: '1px solid #e5e7eb',
        boxShadow: '0 2px 8px rgba(15, 23, 42, 0.04)'
      }}
    >
      <div
        style={{
          maxWidth: 1200,
          margin: '0 auto',
          padding: '14px 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
          <Link
            to="/"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 10,
              textDecoration: 'none',
              color: '#0f172a',
              fontWeight: 800,
              fontSize: 36
            }}
          >
            <span
              style={{
                width: 44,
                height: 44,
                borderRadius: '50%',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'linear-gradient(135deg, #3B82F6 0%, #0EA5E9 100%)',
                color: '#FFFFFF',
                fontSize: 22,
                boxShadow: '0 8px 20px rgba(14, 165, 233, 0.32)'
              }}
            >
              🚀
            </span>
            HackHub
          </Link>

          <nav style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Link to="/hackathons" style={{ textDecoration: 'none', color: '#334155', fontWeight: 600 }}>Hackathons</Link>
            <Link to="/camp" style={{ textDecoration: 'none', color: '#334155', fontWeight: 600 }}>Camp</Link>
            <Link to="/rankings" style={{ textDecoration: 'none', color: '#334155', fontWeight: 600 }}>Rankings</Link>
            <Link to="/analytics" style={{ textDecoration: 'none', color: '#334155', fontWeight: 600 }}>Analytics</Link>
          </nav>
        </div>

        <div ref={authCardRef} style={{ position: 'relative' }}>
          <button
            onClick={() => onAuthCardOpenChange?.(!authCardOpen)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              border: '1px solid #e2e8f0',
              borderRadius: 12,
              backgroundColor: '#FFFFFF',
              padding: '10px 14px',
              boxShadow: '0 8px 20px rgba(15, 23, 42, 0.08)',
              cursor: 'pointer'
            }}
            aria-expanded={authCardOpen}
            aria-label={isLoggedIn ? '마이페이지 열기' : '로그인 열기'}
          >
            {isLoggedIn ? <User size={18} color="#334155" /> : <User size={18} color="#334155" />}
            <span style={{ color: '#334155', fontWeight: 600, fontSize: 14 }}>
              {isLoggedIn ? (user?.nickname ?? '마이페이지') : 'Guest'}
            </span>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                border: 'none',
                borderRadius: 10,
                padding: '8px 12px',
                color: '#FFFFFF',
                fontWeight: 700,
                fontSize: 14,
                background: 'linear-gradient(135deg, #3B82F6 0%, #0EA5E9 100%)'
              }}
            >
              <LogIn size={14} color="#FFFFFF" />
              {isLoggedIn ? '마이페이지' : '로그인'}
            </span>
          </button>

          {authCardOpen && (
            <div
              style={{
                position: openBesideChat ? 'fixed' : 'absolute',
                top: openBesideChat ? authCardLayout.top : 'calc(100% + 10px)',
                right: openBesideChat ? authCardLayout.right : 0,
                width: 340,
                maxHeight: openBesideChat ? authCardLayout.maxHeight : 'min(75vh, 760px)',
                overflowY: 'auto',
                backgroundColor: '#FFFFFF',
                border: '1px solid #e2e8f0',
                borderRadius: 14,
                boxShadow: '0 18px 40px rgba(15, 23, 42, 0.18)',
                padding: 16,
                zIndex: 1003,
                transition: 'top 0.3s ease, right 0.3s ease, max-height 0.3s ease'
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 12,
                  marginBottom: 12
                }}
              >
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#0f172a' }}>
                  {isLoggedIn ? '마이페이지' : '로그인'}
                </h3>
                <button
                  onClick={() => onAuthCardOpenChange?.(false)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 32,
                    height: 32,
                    borderRadius: 10,
                    border: '1px solid #e2e8f0',
                    backgroundColor: '#FFFFFF',
                    color: '#64748b',
                    cursor: 'pointer'
                  }}
                  aria-label="접기"
                  title="접기"
                >
                  <X size={16} />
                </button>
              </div>
              {isLoggedIn ? (
                <>
                  <UserProfile />
                  <NotificationPanel />
                </>
              ) : (
                <LoginForm />
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  )
}