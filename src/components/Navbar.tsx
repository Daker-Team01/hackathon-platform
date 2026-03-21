import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { LogIn, User } from 'lucide-react'
import { useUser } from '../contexts/UserContext'
import LoginForm from './profile/LoginForm'
import UserProfile from './profile/UserProfile'
import NotificationPanel from './profile/NotificationPanel'

export default function Navbar() {
  const { isLoggedIn, user } = useUser()
  const [openAuthCard, setOpenAuthCard] = useState(false)
  const authCardRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!authCardRef.current?.contains(event.target as Node)) {
        setOpenAuthCard(false)
      }
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpenAuthCard(false)
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
            onClick={() => setOpenAuthCard((prev) => !prev)}
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
            aria-expanded={openAuthCard}
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

          {openAuthCard && (
            <div
              style={{
                position: 'absolute',
                top: 'calc(100% + 10px)',
                right: 0,
                width: 340,
                maxHeight: 'min(75vh, 760px)',
                overflowY: 'auto',
                backgroundColor: '#FFFFFF',
                border: '1px solid #e2e8f0',
                borderRadius: 14,
                boxShadow: '0 18px 40px rgba(15, 23, 42, 0.18)',
                padding: 16,
                zIndex: 1003
              }}
            >
              <h3 style={{ margin: '0 0 12px 0', fontSize: 16, fontWeight: 700, color: '#0f172a' }}>
                {isLoggedIn ? '마이페이지' : '로그인'}
              </h3>
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