import { useParams } from 'react-router-dom'
import { useMemo } from 'react'
import Overview from '../features/Overview'
import Schedule from '../features/Schedule'
import Prize from '../features/Prize'
import Teams from '../features/Teams'
import Submit from '../features/Submit'
import Leaderboard from '../features/Leaderboard'
import type { Hackathon } from '../types/hackathon'

const HACKATHONS_STORAGE_KEY = 'hackathons'

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
  const hackathon = useMemo(() => {
    const hackathons = getHackathonsFromStorage()
    return hackathons.find((item) => item.slug === slug)
  }, [slug])

  if (!slug || !hackathon) {
    return <div>해당 해커톤을 찾을 수 없습니다.</div>
  }

  return (
    <div>
      <h1>{hackathon.title}</h1>
      <img
        src={hackathon.thumbnailUrl}
        alt={hackathon.title}
        style={{ width: '100%', maxWidth: 640, height: 280, objectFit: 'cover' }}
      />
      <p>Status: {hackathon.status}</p>
      <p>Tags: {hackathon.tags.join(', ')}</p>
      <p>Submission Deadline: {formatDateTime(hackathon.period.submissionDeadlineAt)}</p>
      <p>End: {formatDateTime(hackathon.period.endAt)}</p>

      <Overview />
      <Schedule />
      <Prize />
      <Teams hackathonSlug={hackathon.slug} />
      <Submit hackathonSlug={hackathon.slug} />
      <Leaderboard hackathonSlug={hackathon.slug} />
    </div>
  )
}
