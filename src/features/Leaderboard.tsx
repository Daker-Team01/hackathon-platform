import { useMemo } from 'react'
import { useTeams } from '../hooks/useTeams'

type LeaderboardProps = {
  hackathonSlug: string
}

type LeaderboardSubmission = {
  submissionId: string
  hackathonSlug: string
  teamId: string
  submittedAt: string
  totalScore: number
}

type LeaderboardRow = {
  teamId: string
  teamName: string
  bestScore: number | null
  bestSubmittedAt: string | null
  submissionCount: number
  status: '제출' | '미제출'
  rank: number | null
}

const LEADERBOARD_SUBMISSIONS_STORAGE_KEY = 'leaderboard_submissions'

function normalizeLeaderboardSubmission(item: unknown): LeaderboardSubmission | null {
  if (typeof item !== 'object' || item === null) return null
  const candidate = item as Record<string, unknown>
  const submissionId = typeof candidate.submissionId === 'string' ? candidate.submissionId : ''
  const hackathonSlug = typeof candidate.hackathonSlug === 'string' ? candidate.hackathonSlug : ''
  const teamId = typeof candidate.teamId === 'string' ? candidate.teamId : ''
  const submittedAt = typeof candidate.submittedAt === 'string' ? candidate.submittedAt : ''
  const totalScore =
    typeof candidate.totalScore === 'number' && Number.isFinite(candidate.totalScore)
      ? candidate.totalScore
      : NaN

  if (!submissionId || !hackathonSlug || !teamId || !submittedAt || Number.isNaN(totalScore)) {
    return null
  }

  return { submissionId, hackathonSlug, teamId, submittedAt, totalScore }
}

function getLeaderboardSubmissionsFromStorage(): LeaderboardSubmission[] {
  const raw = localStorage.getItem(LEADERBOARD_SUBMISSIONS_STORAGE_KEY)
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed
      .map((item) => normalizeLeaderboardSubmission(item))
      .filter((item): item is LeaderboardSubmission => item !== null)
  } catch {
    return []
  }
}

function toTimestamp(value: string): number {
  const parsed = new Date(value).getTime()
  return Number.isNaN(parsed) ? Number.MAX_SAFE_INTEGER : parsed
}

function chooseBestSubmission(
  left: LeaderboardSubmission,
  right: LeaderboardSubmission
): LeaderboardSubmission {
  if (left.totalScore !== right.totalScore) {
    return left.totalScore > right.totalScore ? left : right
  }
  return toTimestamp(left.submittedAt) <= toTimestamp(right.submittedAt) ? left : right
}

function formatDateTime(value: string | null): string {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString()
}

function formatScore(value: number | null): string {
  if (value === null) return '-'
  return Number.isInteger(value) ? String(value) : value.toFixed(1)
}

export default function Leaderboard({ hackathonSlug }: LeaderboardProps) {
  const { data: teams = [] } = useTeams(hackathonSlug)

  const rows = useMemo(() => {
    const submissions = getLeaderboardSubmissionsFromStorage().filter(
      (submission) => submission.hackathonSlug === hackathonSlug
    )

    const submissionsByTeam = new Map<string, LeaderboardSubmission[]>()
    submissions.forEach((submission) => {
      const current = submissionsByTeam.get(submission.teamId) ?? []
      current.push(submission)
      submissionsByTeam.set(submission.teamId, current)
    })

    const baseRows: LeaderboardRow[] = teams.map((team) => {
      const teamSubmissions = submissionsByTeam.get(team.teamCode) ?? []
      if (teamSubmissions.length === 0) {
        return {
          teamId: team.teamCode,
          teamName: team.name,
          bestScore: null,
          bestSubmittedAt: null,
          submissionCount: 0,
          status: '미제출',
          rank: null,
        }
      }

      const bestSubmission = teamSubmissions.reduce((best, current) =>
        chooseBestSubmission(best, current)
      )
      return {
        teamId: team.teamCode,
        teamName: team.name,
        bestScore: bestSubmission.totalScore,
        bestSubmittedAt: bestSubmission.submittedAt,
        submissionCount: teamSubmissions.length,
        status: '제출',
        rank: null,
      }
    })

    const ranked = baseRows
      .filter((row) => row.status === '제출' && row.bestScore !== null)
      .sort((a, b) => {
        if ((a.bestScore ?? -1) !== (b.bestScore ?? -1)) {
          return (b.bestScore ?? -1) - (a.bestScore ?? -1)
        }
        return toTimestamp(a.bestSubmittedAt ?? '') - toTimestamp(b.bestSubmittedAt ?? '')
      })
      .map((row, index) => ({ ...row, rank: index + 1 }))

    const rankByTeamId = new Map(ranked.map((row) => [row.teamId, row.rank]))
    return baseRows
      .map((row) => ({
        ...row,
        rank: row.status === '제출' ? (rankByTeamId.get(row.teamId) ?? null) : null,
      }))
      .sort((a, b) => {
        if (a.rank !== null && b.rank !== null) return a.rank - b.rank
        if (a.rank !== null) return -1
        if (b.rank !== null) return 1
        return a.teamName.localeCompare(b.teamName)
      })
  }, [hackathonSlug, teams])

  return (
    <section style={{ marginTop: 12 }}>
      <h2 style={{ marginBottom: 12 }}>Leaderboard</h2>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0 }}>
          <thead>
            <tr style={{ backgroundColor: '#f8f9fa' }}>
              <th style={{ padding: '12px 14px', textAlign: 'left', borderBottom: '2px solid #dee2e6' }}>
                Rank
              </th>
              <th style={{ padding: '12px 14px', textAlign: 'left', borderBottom: '2px solid #dee2e6' }}>
                Team name
              </th>
              <th style={{ padding: '12px 14px', textAlign: 'left', borderBottom: '2px solid #dee2e6' }}>
                Score
              </th>
              <th style={{ padding: '12px 14px', textAlign: 'left', borderBottom: '2px solid #dee2e6' }}>
                Submissions
              </th>
              <th style={{ padding: '12px 14px', textAlign: 'left', borderBottom: '2px solid #dee2e6' }}>
                Best Submitted At
              </th>
              <th style={{ padding: '12px 14px', textAlign: 'left', borderBottom: '2px solid #dee2e6' }}>
                Status
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr
                key={row.teamId}
                style={{
                  backgroundColor: index % 2 === 0 ? '#ffffff' : '#fcfcfd',
                }}
              >
                <td style={{ padding: '11px 14px', borderBottom: '1px solid #eceff3' }}>{row.rank ?? '-'}</td>
                <td style={{ padding: '11px 14px', borderBottom: '1px solid #eceff3' }}>{row.teamName}</td>
                <td style={{ padding: '11px 14px', borderBottom: '1px solid #eceff3' }}>
                  {formatScore(row.bestScore)}
                </td>
                <td style={{ padding: '11px 14px', borderBottom: '1px solid #eceff3' }}>
                  {row.submissionCount}
                </td>
                <td style={{ padding: '11px 14px', borderBottom: '1px solid #eceff3' }}>
                  {formatDateTime(row.bestSubmittedAt)}
                </td>
                <td style={{ padding: '11px 14px', borderBottom: '1px solid #eceff3' }}>{row.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
