import { useUser } from '../../contexts/UserContext'
import LoginForm from './LoginForm'
import UserProfile from './UserProfile'
import NotificationPanel from './NotificationPanel'
import ParticipationSummary from './ParticipationSummary'
import { useEffect, useMemo, useRef, useState } from 'react'
import { getUserHackathonInterests } from '../../utils/interestStorage'
import { normalizedHackathons } from '../../lib/hackathonData'
import { router } from '../../router/router'

type Props = {
  chatOpen: boolean
}

export default function ProfileSidebar({ chatOpen }: Props) {
  const { isLoggedIn, user } = useUser()
  const sidebarRef = useRef<HTMLDivElement>(null)
  const [windowWidth, setWindowWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1400)
  const [activePanel, setActivePanel] = useState<'teams' | 'interests' | null>(null)

  const hackathonNameBySlug = useMemo(() => {
    const map = new Map<string, string>()
    normalizedHackathons.forEach((hackathon) => {
      map.set(hackathon.slug, hackathon.title)
    })
    return map
  }, [])

  const interestedHackathons = useMemo(() => {
    if (!user) return []

    return getUserHackathonInterests(user.id)
      .sort((left, right) => new Date(right.interestedAt).getTime() - new Date(left.interestedAt).getTime())
      .map((interest) => ({
        slug: interest.hackathonId,
        title: hackathonNameBySlug.get(interest.hackathonId) ?? interest.hackathonId,
        interestedAt: interest.interestedAt
      }))
  }, [hackathonNameBySlug, user])

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

  useEffect(() => {
    if (!isLoggedIn) {
      setActivePanel(null)
    }
  }, [isLoggedIn])

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
        padding: 0,
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
        zIndex: 999,
        overflow: 'visible',
        transition: 'right 0.3s ease',
        display: shouldHide ? 'none' : 'block'
      }}
    >
      <div
        style={{
          maxHeight: 'calc(100vh - 40px)',
          overflowY: 'auto',
          padding: 20,
          borderRadius: 12,
          backgroundColor: 'white'
        }}
      >
        <h2 style={{ margin: '0 0 20px 0', fontSize: 18, fontWeight: 700 }}>
          {isLoggedIn ? '마이페이지' : '로그인'}
        </h2>

        {isLoggedIn ? (
          <>
            <NotificationPanel />
            <UserProfile activePanel={activePanel} onOpenPanel={setActivePanel} />
          </>
        ) : <LoginForm />}
      </div>

      {isLoggedIn && activePanel && (
        <div
          style={{
            position: 'fixed',
            top: 20,
            right: (chatOpen ? 540 : 20) + 280 + 10,
            width: 330,
            maxHeight: 'calc(100vh - 40px)',
            backgroundColor: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: 12,
            boxShadow: '0 8px 20px rgba(15, 23, 42, 0.12)',
            overflow: 'hidden',
            zIndex: 1001
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '12px 14px',
              borderBottom: '1px solid #e2e8f0',
              backgroundColor: '#f8fafc'
            }}
          >
            <strong style={{ fontSize: 13, color: '#0f172a' }}>
              {activePanel === 'teams' ? '참가중인 팀' : '관심있는 해커톤 리스트'}
            </strong>
            <button
              type="button"
              onClick={() => setActivePanel(null)}
              style={{
                border: '1px solid #cbd5e1',
                backgroundColor: '#ffffff',
                color: '#475569',
                borderRadius: 8,
                fontSize: 11,
                fontWeight: 700,
                padding: '4px 8px',
                cursor: 'pointer'
              }}
            >
              닫기
            </button>
          </div>

          <div style={{ maxHeight: 'calc(100vh - 120px)', overflowY: 'auto', padding: 14 }}>
            {activePanel === 'teams' ? (
              <ParticipationSummary />
            ) : (
              <div style={{ display: 'grid', gap: 10 }}>
                {interestedHackathons.length > 0 ? (
                  interestedHackathons.map((hackathon) => (
                    <button
                      key={hackathon.slug}
                      type="button"
                      onClick={() => router.navigate(`/hackathons/${hackathon.slug}`)}
                      style={{
                        textAlign: 'left',
                        border: '1px solid #dbeafe',
                        borderRadius: 10,
                        backgroundColor: '#f8fbff',
                        padding: 10,
                        cursor: 'pointer'
                      }}
                    >
                      <p style={{ margin: '0 0 4px 0', fontSize: 13, fontWeight: 700, color: '#1e293b' }}>
                        {hackathon.title}
                      </p>
                      <p style={{ margin: 0, fontSize: 11, color: '#64748b' }}>
                        관심 등록일 {new Date(hackathon.interestedAt).toLocaleDateString('ko-KR')}
                      </p>
                    </button>
                  ))
                ) : (
                  <p style={{ margin: 0, fontSize: 12, color: '#94a3b8' }}>
                    아직 관심 등록한 해커톤이 없습니다.
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

