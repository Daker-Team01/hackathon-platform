import { useNavigate, useParams } from 'react-router-dom'
import { useMemo, useEffect, useRef, useState } from 'react'
import Overview from '../features/Overview'
import Eval from '../features/Eval'
import Schedule from '../features/Schedule'
import Prize from '../features/Prize'
import Teams from '../features/Teams'
import Submit from '../features/Submit'
import Leaderboard from '../features/Leaderboard'
import type { Hackathon } from '../types/hackathon'
import { useLog } from '../contexts/LogContext'
import { useUser } from '../contexts/UserContext'
import { isHackathonInterested, toggleHackathonInterest } from '../utils/interestStorage'

const HACKATHONS_STORAGE_KEY = 'hackathons'
type SectionKey =
  | 'overview'
  | 'eval'
  | 'schedule'
  | 'prize'
  | 'teams'
  | 'submit'
  | 'leaderboard'

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

function formatDateTime(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString()
}

export default function HackathonDetail() {
  const { slug } = useParams()
  const navigate = useNavigate()
  const { recordEvent } = useLog()
  const { user } = useUser()
  const hasLoggedView = useRef(false)
  const [activeSection, setActiveSection] = useState<SectionKey>('overview')
  const [isInterested, setIsInterested] = useState(false)

  const hackathon = useMemo(() => {
    const hackathons = getHackathonsFromStorage()
    return hackathons.find((item) => item.slug === slug)
  }, [slug])

  useEffect(() => {
    if (hackathon && !hasLoggedView.current) {
      recordEvent('hackathon_view', 'hackathon', hackathon.slug)
      hasLoggedView.current = true
    }
  }, [hackathon, recordEvent])

  useEffect(() => {
    if (!user || !hackathon) {
      setIsInterested(false)
      return
    }

    setIsInterested(isHackathonInterested(user.id, hackathon.slug))
  }, [hackathon, user])

  if (!slug || !hackathon) {
    return <div>해당 해커톤을 찾을 수 없습니다.</div>
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
        <button
          onClick={() => navigate(-1)}
          style={{
            padding: 10,
            backgroundColor: '#6c757d',
            color: 'white',
            border: 'none',
            borderRadius: 4,
            cursor: 'pointer',
            fontSize: 14,
          }}
        >
          ← 뒤로가기
        </button>
        <button
          onClick={() => navigate('/')}
          style={{
            padding: 10,
            backgroundColor: '#6c757d',
            color: 'white',
            border: 'none',
            borderRadius: 4,
            cursor: 'pointer',
            fontSize: 14,
          }}
        >
          ← 메인으로
        </button>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <h1 style={{ margin: 0 }}>{hackathon.title}</h1>
        <button
          type="button"
          onClick={() => {
            if (!user) {
              alert('로그인 후 관심 등록할 수 있습니다.')
              return
            }

            const next = toggleHackathonInterest(user.id, hackathon.slug)
            setIsInterested(next)
          }}
          aria-label={isInterested ? '관심 해제' : '관심 등록'}
          title={isInterested ? '관심 해제' : '관심 등록'}
          style={{
            height: 36,
            padding: '0 14px',
            borderRadius: 9999,
            border: `1px solid ${isInterested ? '#fda4af' : '#d1d5db'}`,
            backgroundColor: isInterested ? '#fff1f2' : '#ffffff',
            color: isInterested ? '#be123c' : '#374151',
            cursor: 'pointer',
            fontSize: 13,
            fontWeight: 700,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <span aria-hidden="true" style={{ fontSize: 14 }}>
            {isInterested ? '♥' : '♡'}
          </span>
          <span>{isInterested ? '관심 있는 해커톤' : '관심 등록'}</span>
        </button>
      </div>
      <img
        src={hackathon.thumbnailUrl}
        alt={hackathon.title}
        style={{ width: '100%', maxWidth: 640, height: 280, objectFit: 'cover' }}
      />
      <p>Status: {hackathon.status}</p>
      <p>Tags: {hackathon.tags.join(', ')}</p>
      <p>Submission Deadline: {formatDateTime(hackathon.period.submissionDeadlineAt)}</p>
      <p>End: {formatDateTime(hackathon.period.endAt)}</p>

      <nav style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
        <button
          type="button"
          onClick={() => setActiveSection('overview')}
          style={{
            backgroundColor: activeSection === 'overview' ? '#4f46e5' : '#e5e7eb',
            color: activeSection === 'overview' ? '#fff' : '#111827',
          }}
        >
          Overview
        </button>
        <button
          type="button"
          onClick={() => setActiveSection('eval')}
          style={{
            backgroundColor: activeSection === 'eval' ? '#4f46e5' : '#e5e7eb',
            color: activeSection === 'eval' ? '#fff' : '#111827',
          }}
        >
          Eval
        </button>
        <button
          type="button"
          onClick={() => setActiveSection('schedule')}
          style={{
            backgroundColor: activeSection === 'schedule' ? '#4f46e5' : '#e5e7eb',
            color: activeSection === 'schedule' ? '#fff' : '#111827',
          }}
        >
          Schedule
        </button>
        <button
          type="button"
          onClick={() => setActiveSection('prize')}
          style={{
            backgroundColor: activeSection === 'prize' ? '#4f46e5' : '#e5e7eb',
            color: activeSection === 'prize' ? '#fff' : '#111827',
          }}
        >
          Prize
        </button>
        <button
          type="button"
          onClick={() => setActiveSection('teams')}
          style={{
            backgroundColor: activeSection === 'teams' ? '#4f46e5' : '#e5e7eb',
            color: activeSection === 'teams' ? '#fff' : '#111827',
          }}
        >
          Teams
        </button>
        <button
          type="button"
          onClick={() => setActiveSection('submit')}
          style={{
            backgroundColor: activeSection === 'submit' ? '#4f46e5' : '#e5e7eb',
            color: activeSection === 'submit' ? '#fff' : '#111827',
          }}
        >
          Submit
        </button>
        <button
          type="button"
          onClick={() => setActiveSection('leaderboard')}
          style={{
            backgroundColor: activeSection === 'leaderboard' ? '#4f46e5' : '#e5e7eb',
            color: activeSection === 'leaderboard' ? '#fff' : '#111827',
          }}
        >
          Leaderboard
        </button>
      </nav>

      {activeSection === 'overview' ? <Overview /> : null}
      {activeSection === 'eval' ? <Eval hackathonSlug={hackathon.slug} /> : null}
      {activeSection === 'schedule' ? <Schedule /> : null}
      {activeSection === 'prize' ? <Prize /> : null}
      {activeSection === 'teams' ? <Teams hackathonSlug={hackathon.slug} /> : null}
      {activeSection === 'submit' ? <Submit hackathonSlug={hackathon.slug} /> : null}
      {activeSection === 'leaderboard' ? <Leaderboard hackathonSlug={hackathon.slug} /> : null}
    </div>
  )
}
