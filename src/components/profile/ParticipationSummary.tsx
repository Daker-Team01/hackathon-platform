import { useMemo, useState } from 'react'
import { useUser } from '../../contexts/UserContext'

const HACKATHON_STATUS_META: Record<string, { label: string; backgroundColor: string; color: string }> = {
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

export default function ParticipationSummary() {
  const { user } = useUser()
  const [isCollapsed, setIsCollapsed] = useState(false)

  const participations = useMemo(() => {
    if (!user) return []

    return [...user.participations].sort((left, right) => {
      if (left.status === 'ongoing' && right.status !== 'ongoing') {
        return -1
      }

      if (left.status !== 'ongoing' && right.status === 'ongoing') {
        return 1
      }

      return right.contributionScore - left.contributionScore
    })
  }, [user])

  if (!user || participations.length === 0) {
    return null
  }

  return (
    <div style={{ marginTop: 20, borderTop: '1px solid #e5e7eb', paddingTop: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h4 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#111827' }}>
          참여 중인 해커톤
        </h4>
        <button
          type="button"
          onClick={() => setIsCollapsed((prev) => !prev)}
          style={{
            border: 'none',
            backgroundColor: '#eef2ff',
            color: '#4338ca',
            padding: '6px 10px',
            borderRadius: 8,
            fontSize: 12,
            fontWeight: 700,
            cursor: 'pointer'
          }}
          aria-expanded={!isCollapsed}
        >
          {isCollapsed ? '펼치기' : '접기'}
        </button>
      </div>

      {!isCollapsed && (
        <div style={{ display: 'grid', gap: 10 }}>
          {participations.map((participation) => {
            const statusMeta = HACKATHON_STATUS_META[participation.status] || {
              label: participation.status,
              backgroundColor: '#f3f4f6',
              color: '#4b5563'
            }

            return (
              <div
                key={`${participation.hackathonSlug}-${participation.teamCode}`}
                style={{
                  border: '1px solid #dbeafe',
                  backgroundColor: '#f8fbff',
                  borderRadius: 10,
                  padding: 12
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'flex-start' }}>
                  <div>
                    <p style={{ margin: '0 0 4px 0', fontSize: 13, fontWeight: 700, color: '#1f2937' }}>
                      {participation.hackathonSlug}
                    </p>
                    <p style={{ margin: 0, fontSize: 12, color: '#4b5563' }}>
                      팀 코드 {participation.teamCode}
                    </p>
                  </div>

                  {statusMeta && (
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
                  )}
                </div>

                <div style={{ marginTop: 10, display: 'grid', gap: 4 }}>
                  <p style={{ margin: 0, fontSize: 12, color: '#4b5563' }}>내 역할: {participation.role}</p>
                  <p style={{ margin: 0, fontSize: 12, color: '#4b5563' }}>리더 여부: {participation.isLeader ? '팀장' : '팀원'}</p>
                  <p style={{ margin: 0, fontSize: 12, color: '#4b5563' }}>
                    기여도: {Math.round(participation.contributionScore * 100)}점
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}