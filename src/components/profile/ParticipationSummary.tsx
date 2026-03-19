import { useMemo, useState } from 'react'
import { useUser } from '../../contexts/UserContext'
import { useTeams } from '../../hooks/useTeams'
import type { Hackathon } from '../../types/hackathon'

const HACKATHONS_STORAGE_KEY = 'hackathons'

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

function loadHackathonsFromStorage(): Hackathon[] {
  const raw = localStorage.getItem(HACKATHONS_STORAGE_KEY)

  if (!raw) return []

  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as Hackathon[]) : []
  } catch {
    return []
  }
}

export default function ParticipationSummary() {
  const { user } = useUser()
  const { data: teams, isLoading } = useTeams()
  const [isCollapsed, setIsCollapsed] = useState(false)
  const hackathons = useMemo(() => loadHackathonsFromStorage(), [])

  const participatingTeams = useMemo(() => {
    if (!user || !teams) return []

    return teams
      .filter((team) => {
        if (!team.hackathonSlug) return false

        if (team.authorId === user.id) {
          return true
        }

        return team.members?.some((member) => member.userId === user.id)
      })
      .map((team) => {
        const hackathon = hackathons.find((item) => item.slug === team.hackathonSlug)
        const member = team.members?.find((item) => item.userId === user.id)
        const roleLabel = team.authorId === user.id || member?.role === 'LEADER' ? '팀장' : '팀원'

        return {
          team,
          hackathon,
          roleLabel
        }
      })
  }, [hackathons, teams, user])

  if (!user || isLoading || participatingTeams.length === 0) {
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
          {participatingTeams.map(({ team, hackathon, roleLabel }) => {
            const statusMeta = hackathon
              ? HACKATHON_STATUS_META[hackathon.status] || {
                  label: hackathon.status,
                  backgroundColor: '#f3f4f6',
                  color: '#4b5563'
                }
              : null

            return (
              <div
                key={team.teamCode}
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
                      {hackathon?.title || team.hackathonSlug}
                    </p>
                    <p style={{ margin: 0, fontSize: 12, color: '#4b5563' }}>
                      팀 {team.name}
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
                  <p style={{ margin: 0, fontSize: 12, color: '#4b5563' }}>내 역할: {roleLabel}</p>
                  <p style={{ margin: 0, fontSize: 12, color: '#4b5563' }}>팀원 수: {team.memberCount}명</p>
                  {hackathon?.period.submissionDeadlineAt && (
                    <p style={{ margin: 0, fontSize: 12, color: '#4b5563' }}>
                      제출 마감: {new Date(hackathon.period.submissionDeadlineAt).toLocaleDateString('ko-KR')}
                    </p>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}