import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import HackathonCard from '../components/HackathonCard'
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

export default function Hackathons() {
  const navigate = useNavigate()
  const hackathons = useMemo(getHackathonsFromStorage, [])

  return (
    <div>
      <h1>Hackathons</h1>

      {hackathons.length === 0 ? (
        <p>해커톤 데이터가 없습니다.</p>
      ) : (
        hackathons.map((hackathon) => (
          <HackathonCard
            key={hackathon.slug}
            title={hackathon.title}
            status={hackathon.status}
            tags={hackathon.tags}
            thumbnailUrl={hackathon.thumbnailUrl}
            deadline={hackathon.period.submissionDeadlineAt}
            onClick={() => navigate(`/hackathons/${hackathon.slug}`)}
          />
        ))
      )}
    </div>
  )
}
