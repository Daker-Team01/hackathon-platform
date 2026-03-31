import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useUser, type UserParticipation } from '../../contexts/UserContext'
import { useTeams } from '../../hooks/useTeams'
import { normalizedHackathons } from '../../lib/hackathonData'

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
  const navigate = useNavigate()
  const { data: teams = [] } = useTeams(undefined, { enabled: !!user })
  const [isCollapsed, setIsCollapsed] = useState(false)

  const teamNameByCode = useMemo(() => {
    const map = new Map<string, string>()
    teams.forEach((team) => {
      map.set(team.teamCode, team.name)
    })
    return map
  }, [teams])

  const participations = useMemo(() => {
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
      const resolvedRole =
        (typeof myMembership.role === 'string' && myMembership.role.trim().length > 0
          ? myMembership.role.trim()
          : '') ||
        (existing?.role?.trim() || '') ||
        (team.leaderId === user.userId ? '팀장' : '팀원')

      mergedByTeamCode.set(team.teamCode, {
        hackathonSlug: existing?.hackathonSlug || team.hackathonSlug || '',
        teamCode: team.teamCode,
        role: resolvedRole,
        isLeader: existing?.isLeader ?? (team.leaderId === user.userId),
        contributionScore: existing?.contributionScore ?? 0,
        status: existing?.status ?? 'ongoing'
      })
    })

    return [...mergedByTeamCode.values()].sort((left, right) => {
      if (left.status === 'ongoing' && right.status !== 'ongoing') {
        return -1
      }

      if (left.status !== 'ongoing' && right.status === 'ongoing') {
        return 1
      }

      return right.contributionScore - left.contributionScore
    })
  }, [teams, user])

  const hackathonNameBySlug = useMemo(() => {
    const map = new Map<string, string>()
    normalizedHackathons.forEach((hackathon) => {
      map.set(hackathon.slug, hackathon.title)
    })
    return map
  }, [])

  if (!user || participations.length === 0) {
    return null
  }

  return (
    <div style={{ marginTop: 20, borderTop: '1px solid #e5e7eb', paddingTop: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h4 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#111827' }}>
          참여 중인 팀
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
          {participations.map((participation, index) => {
            const statusMeta = HACKATHON_STATUS_META[participation.status] || {
              label: participation.status,
              backgroundColor: '#f3f4f6',
              color: '#4b5563'
            }
            const resolvedTeamName = teamNameByCode.get(participation.teamCode) ?? participation.teamCode
            const normalizedRole = participation.role.trim()
            const shouldShowRole = Boolean(normalizedRole) && !['팀장', '팀원', 'LEADER', 'MEMBER'].includes(normalizedRole)

            return (
              <div
                key={`${participation.teamCode}-${index}`}
                style={{
                  position: 'relative',
                  border: '1px solid #dbeafe',
                  backgroundColor: '#f8fbff',
                  borderRadius: 10,
                  padding: 12,
                  paddingBottom: participation.isLeader ? 40 : 12
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'flex-start' }}>
                  <div>
                    <p style={{ margin: '0 0 4px 0', fontSize: 13, fontWeight: 700, color: '#1f2937' }}>
                      {resolvedTeamName}
                    </p>
                    {participation.hackathonSlug ? (
                      <p style={{ margin: 0, fontSize: 12, color: '#4b5563' }}>
                        {hackathonNameBySlug.get(participation.hackathonSlug) ?? participation.hackathonSlug}
                      </p>
                    ) : (
                      <p style={{ margin: 0, fontSize: 12, color: '#94a3b8' }}>
                        미지정 팀
                      </p>
                    )}
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
                  {shouldShowRole && (
                    <p style={{ margin: 0, fontSize: 12, color: '#4b5563' }}>내 역할: {normalizedRole}</p>
                  )}
                  <p style={{ margin: 0, fontSize: 12, color: '#4b5563' }}>리더 여부: {participation.isLeader ? '팀장' : '팀원'}</p>
                  <p style={{ margin: 0, fontSize: 12, color: '#4b5563' }}>
                    기여도: {Math.round(participation.contributionScore * 100)}점
                  </p>
                </div>

                {participation.isLeader && (
                  <button
                    type="button"
                    onClick={() => navigate(`/team/${participation.teamCode}/manage`)}
                    style={{
                      position: 'absolute',
                      right: 12,
                      bottom: 10,
                      border: '1px solid #bfdbfe',
                      backgroundColor: '#eff6ff',
                      color: '#1d4ed8',
                      padding: '4px 8px',
                      borderRadius: 8,
                      fontSize: 11,
                      fontWeight: 700,
                      cursor: 'pointer',
                      lineHeight: 1.2
                    }}
                  >
                    팀관리 페이지로 이동
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}