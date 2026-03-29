import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { LogIn, User, X } from 'lucide-react'
import insighthonLogo from '../assets/insighthon_logo.png'
import { useUser, type UserParticipation } from '../contexts/UserContext'
import LoginForm from './profile/LoginForm'
import UserProfile from './profile/UserProfile'
import NotificationPanel from './profile/NotificationPanel'
import { useTeams, useUserInvites } from '../hooks/useTeams'
import { useDmRequests, useSetupDmRequestSubscription } from '../contexts/DmRequestContext'
import { useChat } from '../contexts/ChatContext'
import { loadAnnouncedNotificationIds, loadSeenNotificationIds, saveAnnouncedNotificationIds, saveSeenNotificationIds } from '../utils/profileNotifications'
import { getUserHackathonInterests, toggleHackathonInterest } from '../utils/interestStorage'
import { normalizedHackathons } from '../lib/hackathonData'
import type { Hackathon } from '../types/hackathon'

type Props = {
  chatOpen?: boolean
  authCardOpen?: boolean
  onAuthCardOpenChange?: (open: boolean) => void
}

const HACKATHONS_STORAGE_KEY = 'hackathons'

const TEAM_STATUS_META: Record<string, { label: string; backgroundColor: string; color: string }> = {
  ongoing: {
    label: '진행중',
    backgroundColor: '#dcfce7',
    color: '#166534'
  },
  upcoming: {
    label: '예정',
    backgroundColor: '#dbeafe',
    color: '#1d4ed8'
  },
  ended: {
    label: '종료',
    backgroundColor: '#f3f4f6',
    color: '#4b5563'
  }
}

function getHackathonsFromStorage(): Hackathon[] {
  const raw = localStorage.getItem(HACKATHONS_STORAGE_KEY)
  if (!raw) return []

  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as Hackathon[]) : []
  } catch {
    return []
  }
}

export default function Navbar({
  chatOpen = false,
  authCardOpen = false,
  onAuthCardOpenChange
}: Props) {
  const navigate = useNavigate()
  const { isLoggedIn, user } = useUser()
  const { data: teams = [] } = useTeams(undefined, { enabled: !!user })
  const { data: invites } = useUserInvites(user?.id || '')
  const { getPendingForUser } = useDmRequests()
  const setupDmSubscription = useSetupDmRequestSubscription()
  const { addGeneralSystemMessage } = useChat()
  const authCardRef = useRef<HTMLDivElement>(null)
  const [windowWidth, setWindowWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1400)
  const [authCardLayout, setAuthCardLayout] = useState({ top: 96, right: 536, maxHeight: 640 })
  const [activeProfilePanel, setActiveProfilePanel] = useState<'teams' | 'interests' | null>(null)
  const [interestVersion, setInterestVersion] = useState(0)
  const [seenNotificationIds, setSeenNotificationIds] = useState<string[]>([])
  const [announcedNotificationIds, setAnnouncedNotificationIds] = useState<string[]>([])

  const hackathonBySlug = useMemo(() => {
    const map = new Map<string, Hackathon>()
    normalizedHackathons.forEach((hackathon) => {
      map.set(hackathon.slug, hackathon)
    })
    getHackathonsFromStorage().forEach((hackathon) => {
      map.set(hackathon.slug, hackathon)
    })
    return map
  }, [interestVersion])

  const interestedHackathons = useMemo(() => {
    if (!user) return []

    return getUserHackathonInterests(user.id)
      .sort((left, right) => new Date(right.interestedAt).getTime() - new Date(left.interestedAt).getTime())
      .map((interest) => ({
        slug: interest.hackathonId,
        title: hackathonBySlug.get(interest.hackathonId)?.title ?? interest.hackathonId,
        status: hackathonBySlug.get(interest.hackathonId)?.status ?? 'unknown',
        submissionDeadlineAt: hackathonBySlug.get(interest.hackathonId)?.period?.submissionDeadlineAt ?? '',
        interestedAt: interest.interestedAt
      }))
  }, [hackathonBySlug, user, interestVersion])

  const teamNameByCode = useMemo(() => {
    const map = new Map<string, string>()
    teams.forEach((team) => {
      map.set(team.teamCode, team.name)
    })
    return map
  }, [teams])

  const teamPanelItems = useMemo(() => {
    if (!user) return []

    const mergedByTeamCode = new Map<string, UserParticipation>()

    user.participations.forEach((participation) => {
      if (participation.teamCode) {
        mergedByTeamCode.set(participation.teamCode, participation)
      }
    })

    teams.forEach((team) => {
      const myMembership = team.members?.find((member) => member.userId === user.userId)
      if (!myMembership) return

      const existing = mergedByTeamCode.get(team.teamCode)
      mergedByTeamCode.set(team.teamCode, {
        hackathonSlug: existing?.hackathonSlug || team.hackathonSlug || '',
        teamCode: team.teamCode,
        role: existing?.role || (myMembership.role === 'LEADER' ? '팀장' : '팀원'),
        isLeader: existing?.isLeader ?? (myMembership.role === 'LEADER' || team.leaderId === user.userId),
        contributionScore: existing?.contributionScore ?? 0,
        status: existing?.status ?? 'ongoing'
      })
    })

    return [...mergedByTeamCode.values()].sort((left, right) => {
      if (left.status === 'ongoing' && right.status !== 'ongoing') return -1
      if (left.status !== 'ongoing' && right.status === 'ongoing') return 1
      return right.contributionScore - left.contributionScore
    })
  }, [teams, user])

  const pendingInvites = invites?.filter((invite) => invite.status === 'PENDING') || []
  const dmRequests = user ? getPendingForUser(user.userId) : []
  const notificationIds = useMemo(
    () => [
      ...pendingInvites.map((invite) => `invite:${invite.id}`),
      ...dmRequests.map((request) => `dm:${request.id}`)
    ],
    [dmRequests, pendingInvites]
  )
  const unreadNotificationCount = useMemo(
    () => notificationIds.filter((id) => !seenNotificationIds.includes(id)).length,
    [notificationIds, seenNotificationIds]
  )

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
    if (!user?.userId) {
      setSeenNotificationIds([])
      setAnnouncedNotificationIds([])
      setActiveProfilePanel(null)
      return
    }

    setSeenNotificationIds(loadSeenNotificationIds(user.userId))
    setAnnouncedNotificationIds(loadAnnouncedNotificationIds(user.userId))
  }, [user?.userId])

  useEffect(() => {
    if (!user?.userId) return
    setupDmSubscription(user.userId)
  }, [setupDmSubscription, user?.userId])

  useEffect(() => {
    if (!user?.userId) return

    const currentNotificationIds = new Set(notificationIds)
    const nextSeenIds = seenNotificationIds.filter((id) => currentNotificationIds.has(id))
    const nextAnnouncedIds = announcedNotificationIds.filter((id) => currentNotificationIds.has(id))

    if (nextSeenIds.length !== seenNotificationIds.length) {
      setSeenNotificationIds(nextSeenIds)
      saveSeenNotificationIds(user.userId, nextSeenIds)
    }

    if (nextAnnouncedIds.length !== announcedNotificationIds.length) {
      setAnnouncedNotificationIds(nextAnnouncedIds)
      saveAnnouncedNotificationIds(user.userId, nextAnnouncedIds)
    }
  }, [announcedNotificationIds, notificationIds, seenNotificationIds, user?.userId])

  useEffect(() => {
    if (!user?.userId) return

    const newInviteIds = pendingInvites
      .map((invite) => ({
        id: `invite:${invite.id}`,
        text: `알림: ${invite.teamName} 팀에서 팀 초대를 보냈습니다.`
      }))
      .filter((item) => !announcedNotificationIds.includes(item.id))

    const newDmRequestIds = dmRequests
      .map((request) => ({
        id: `dm:${request.id}`,
        text: `알림: ${request.fromNickname}님이 1:1 채팅을 신청했습니다.`
      }))
      .filter((item) => !announcedNotificationIds.includes(item.id))

    const newNotifications = [...newInviteIds, ...newDmRequestIds]

    if (newNotifications.length === 0) return

    newNotifications.forEach((notification) => {
      addGeneralSystemMessage(notification.text).catch((error) => {
        console.error('Failed to add general system message:', error)
      })
    })

    const nextAnnouncedIds = Array.from(new Set([...announcedNotificationIds, ...newNotifications.map((item) => item.id)]))
    setAnnouncedNotificationIds(nextAnnouncedIds)
    saveAnnouncedNotificationIds(user.userId, nextAnnouncedIds)
  }, [addGeneralSystemMessage, announcedNotificationIds, dmRequests, pendingInvites, user?.userId])

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

  useEffect(() => {
    if (!authCardOpen) {
      setActiveProfilePanel(null)
      return
    }

    setInterestVersion((prev) => prev + 1)
  }, [authCardOpen])

  useEffect(() => {
    const handleInterestRefresh = () => setInterestVersion((prev) => prev + 1)

    window.addEventListener('storage', handleInterestRefresh)
    window.addEventListener('focus', handleInterestRefresh)

    return () => {
      window.removeEventListener('storage', handleInterestRefresh)
      window.removeEventListener('focus', handleInterestRefresh)
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
              textDecoration: 'none'
            }}
          >
            <img
              src={insighthonLogo}
              alt="Insighthon"
              style={{ height: 36, width: 'auto', objectFit: 'contain' }}
            />
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
              position: 'relative',
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
            {isLoggedIn && unreadNotificationCount > 0 && (
              <span
                style={{
                  position: 'absolute',
                  top: -6,
                  right: -6,
                  minWidth: 22,
                  height: 22,
                  padding: '0 6px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: 999,
                  backgroundColor: '#ef4444',
                  color: '#ffffff',
                  fontSize: 11,
                  fontWeight: 800,
                  boxShadow: '0 4px 12px rgba(239, 68, 68, 0.35)'
                }}
              >
                N {unreadNotificationCount}
              </span>
            )}
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
                transition: 'top 0.36s cubic-bezier(0.22, 1, 0.36, 1), right 0.36s cubic-bezier(0.22, 1, 0.36, 1), max-height 0.36s cubic-bezier(0.22, 1, 0.36, 1)'
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
                  <NotificationPanel
                    onUnreadCountChange={() => undefined}
                    seenNotificationIds={seenNotificationIds}
                    onSeenNotificationIdsChange={setSeenNotificationIds}
                  />
                  <UserProfile activePanel={activeProfilePanel} onOpenPanel={setActiveProfilePanel} />
                </>
              ) : (
                <LoginForm />
              )}
            </div>
          )}

          {authCardOpen && isLoggedIn && activeProfilePanel && (
            <div
              data-preserve-auth-card="true"
              onMouseDown={(event) => event.stopPropagation()}
              style={{
                position: openBesideChat ? 'fixed' : 'absolute',
                top: openBesideChat ? authCardLayout.top : 'calc(100% + 10px)',
                right: openBesideChat ? authCardLayout.right + 350 : 350,
                width: 330,
                height: openBesideChat ? authCardLayout.maxHeight : 'min(75vh, 760px)',
                backgroundColor: '#ffffff',
                border: '1px solid #e2e8f0',
                borderRadius: 14,
                boxShadow: '0 18px 40px rgba(15, 23, 42, 0.18)',
                overflow: 'hidden',
                zIndex: 1004,
                display: 'flex',
                flexDirection: 'column',
                transition: 'top 0.36s cubic-bezier(0.22, 1, 0.36, 1), right 0.36s cubic-bezier(0.22, 1, 0.36, 1), height 0.36s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.2s ease'
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
                  {activeProfilePanel === 'teams' ? '참가중인 팀' : '관심있는 해커톤 리스트'}
                </strong>
                <button
                  type="button"
                  onClick={() => setActiveProfilePanel(null)}
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

              <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: 14 }}>
                {activeProfilePanel === 'teams' ? (
                  <div style={{ display: 'grid', gap: 10 }}>
                    {teamPanelItems.length > 0 ? (
                      teamPanelItems.map((participation, index) => {
                        const statusMeta = TEAM_STATUS_META[participation.status] || {
                          label: participation.status,
                          backgroundColor: '#f3f4f6',
                          color: '#4b5563'
                        }
                        const resolvedTeamName = teamNameByCode.get(participation.teamCode) ?? participation.teamCode
                        const normalizedRole = participation.role.trim()
                        const shouldShowRole = Boolean(normalizedRole) && !['팀장', '팀원', 'LEADER', 'MEMBER'].includes(normalizedRole)
                        const hackathonTitle = participation.hackathonSlug
                          ? (hackathonBySlug.get(participation.hackathonSlug)?.title ?? participation.hackathonSlug)
                          : '미지정 팀'

                        return (
                          <div
                            key={`${participation.teamCode}-${index}`}
                            style={{
                              border: '1px solid #dbeafe',
                              background: 'linear-gradient(180deg, #f8fbff 0%, #f1f7ff 100%)',
                              borderRadius: 12,
                              padding: 12,
                              boxShadow: '0 6px 14px rgba(37, 99, 235, 0.08)'
                            }}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'flex-start' }}>
                              <div>
                                <p style={{ margin: '0 0 4px 0', fontSize: 13, fontWeight: 800, color: '#1f2937' }}>
                                  {resolvedTeamName}
                                </p>
                                <p style={{ margin: 0, fontSize: 12, color: '#4b5563' }}>{hackathonTitle}</p>
                              </div>
                              <span
                                style={{
                                  padding: '4px 8px',
                                  borderRadius: 999,
                                  fontSize: 11,
                                  fontWeight: 700,
                                  backgroundColor: statusMeta.backgroundColor,
                                  color: statusMeta.color,
                                  whiteSpace: 'nowrap'
                                }}
                              >
                                {statusMeta.label}
                              </span>
                            </div>

                            <div style={{ marginTop: 10, display: 'grid', gap: 4 }}>
                              {shouldShowRole && (
                                <p style={{ margin: 0, fontSize: 12, color: '#4b5563' }}>내 역할: {normalizedRole}</p>
                              )}
                              <p style={{ margin: 0, fontSize: 12, color: '#4b5563' }}>
                                리더 여부: {participation.isLeader ? '팀장' : '팀원'}
                              </p>
                              <p style={{ margin: 0, fontSize: 12, color: '#4b5563' }}>
                                기여도: {Math.round(participation.contributionScore * 100)}점
                              </p>
                            </div>
                          </div>
                        )
                      })
                    ) : (
                      <p style={{ margin: 0, fontSize: 12, color: '#94a3b8' }}>
                        현재 참여 중인 팀이 없습니다.
                      </p>
                    )}
                  </div>
                ) : (
                  <div style={{ display: 'grid', gap: 10 }}>
                    {interestedHackathons.length > 0 ? (
                      interestedHackathons.map((hackathon) => (
                        <div
                          key={hackathon.slug}
                          style={{
                            textAlign: 'left',
                            border: '1px solid #dbeafe',
                            borderRadius: 10,
                            backgroundColor: '#f8fbff',
                            padding: 10
                          }}
                        >
                          <p style={{ margin: '0 0 4px 0', fontSize: 13, fontWeight: 700, color: '#1e293b' }}>
                            {hackathon.title}
                          </p>
                          <p style={{ margin: '0 0 4px 0', fontSize: 11, color: '#334155' }}>
                            상태: {hackathon.status}
                            {hackathon.submissionDeadlineAt ? ` · 마감 ${new Date(hackathon.submissionDeadlineAt).toLocaleDateString('ko-KR')}` : ''}
                          </p>
                          <p style={{ margin: 0, fontSize: 11, color: '#64748b' }}>
                            관심 등록일 {new Date(hackathon.interestedAt).toLocaleDateString('ko-KR')}
                          </p>

                          <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
                            <button
                              type="button"
                              onClick={() => {
                                if (!user) return
                                toggleHackathonInterest(user.id, hackathon.slug)
                                setInterestVersion((prev) => prev + 1)
                              }}
                              style={{
                                flex: 1,
                                border: '1px solid #fecaca',
                                backgroundColor: '#fff1f2',
                                color: '#be123c',
                                borderRadius: 8,
                                padding: '6px 8px',
                                fontSize: 12,
                                fontWeight: 700,
                                cursor: 'pointer',
                                transition: 'background-color 0.2s, border-color 0.2s'
                              }}
                              onMouseOver={(e) => {
                                e.currentTarget.style.backgroundColor = '#ffe4e6'
                                e.currentTarget.style.borderColor = '#fda4af'
                              }}
                              onMouseOut={(e) => {
                                e.currentTarget.style.backgroundColor = '#fff1f2'
                                e.currentTarget.style.borderColor = '#fecaca'
                              }}
                            >
                              관심 해제
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setActiveProfilePanel(null)
                                onAuthCardOpenChange?.(false)
                                navigate(`/hackathons/${hackathon.slug}`)
                              }}
                              style={{
                                flex: 1,
                                border: '1px solid #bfdbfe',
                                backgroundColor: '#eff6ff',
                                color: '#1d4ed8',
                                borderRadius: 8,
                                padding: '6px 8px',
                                fontSize: 12,
                                fontWeight: 700,
                                cursor: 'pointer',
                                transition: 'background-color 0.2s, border-color 0.2s'
                              }}
                              onMouseOver={(e) => {
                                e.currentTarget.style.backgroundColor = '#dbeafe'
                                e.currentTarget.style.borderColor = '#93c5fd'
                              }}
                              onMouseOut={(e) => {
                                e.currentTarget.style.backgroundColor = '#eff6ff'
                                e.currentTarget.style.borderColor = '#bfdbfe'
                              }}
                            >
                              해당 해커톤으로 이동
                            </button>
                          </div>
                        </div>
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
      </div>
    </header>
  )
}