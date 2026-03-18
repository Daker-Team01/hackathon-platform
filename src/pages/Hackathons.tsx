import { useMemo, useState } from 'react'
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
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [tagFilter, setTagFilter] = useState<string>('all')
  const hackathons = useMemo(() => getHackathonsFromStorage(), [])
  const statusOptions = useMemo(
    () => Array.from(new Set(hackathons.map((hackathon) => hackathon.status))),
    [hackathons]
  )
  const tagOptions = useMemo(
    () => Array.from(new Set(hackathons.flatMap((hackathon) => hackathon.tags))),
    [hackathons]
  )
  const filteredHackathons = useMemo(
    () => {
      return hackathons.filter((hackathon) => {
        const matchesStatus =
          statusFilter === 'all' || hackathon.status === statusFilter
        const matchesTag = tagFilter === 'all' || hackathon.tags.includes(tagFilter)
        return matchesStatus && matchesTag
      })
    },
    [hackathons, statusFilter, tagFilter]
  )

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
      <h1>Hackathons</h1>

      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        <button
          type="button"
          onClick={() => setStatusFilter('all')}
          style={{
            backgroundColor: statusFilter === 'all' ? '#4f46e5' : '#e5e7eb',
            color: statusFilter === 'all' ? '#fff' : '#111827',
          }}
        >
          전체
        </button>
        {statusOptions.map((status) => (
          <button
            key={status}
            type="button"
            onClick={() => setStatusFilter(status)}
            style={{
              backgroundColor: statusFilter === status ? '#4f46e5' : '#e5e7eb',
              color: statusFilter === status ? '#fff' : '#111827',
            }}
          >
            {status}
          </button>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={() => setTagFilter('all')}
          style={{
            backgroundColor: tagFilter === 'all' ? '#059669' : '#e5e7eb',
            color: tagFilter === 'all' ? '#fff' : '#111827',
          }}
        >
          태그 전체
        </button>
        {tagOptions.map((tag) => (
          <button
            key={tag}
            type="button"
            onClick={() => setTagFilter(tag)}
            style={{
              backgroundColor: tagFilter === tag ? '#059669' : '#e5e7eb',
              color: tagFilter === tag ? '#fff' : '#111827',
            }}
          >
            {tag}
          </button>
        ))}
      </div>

      {filteredHackathons.length === 0 ? (
        <p>해커톤 데이터가 없습니다.</p>
      ) : (
        filteredHackathons.map((hackathon) => (
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
