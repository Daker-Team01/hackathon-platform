import { useMemo } from 'react'
import { Trophy } from 'lucide-react'
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
  return date.toLocaleString('ko-KR')
}

function formatScore(value: number | null): string {
  if (value === null) return '-'
  return Number.isInteger(value) ? String(value) : value.toFixed(1)
}

function getRankStyle(rank: number | null): string {
  if (rank === 1) return 'border-amber-200 bg-amber-50 text-amber-700'
  if (rank === 2) return 'border-slate-200 bg-slate-100 text-slate-700'
  if (rank === 3) return 'border-orange-200 bg-orange-50 text-orange-700'
  return 'border-slate-200 bg-white text-slate-600'
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

  const submittedRows = rows.filter((row) => row.status === '제출')
  const topRow = rows.find((row) => row.rank === 1) ?? null

  return (
    <section className="space-y-8">
      <div className="rounded-[28px] border border-amber-100 bg-gradient-to-br from-amber-50 via-white to-orange-50 p-6 sm:p-8">
        <p className="text-xs font-black uppercase tracking-[0.25em] text-amber-600/70">Ranking Board</p>
        <h2 className="mt-3 text-3xl font-black tracking-tight text-slate-900">Leaderboard</h2>
        <p className="mt-4 max-w-4xl text-sm font-medium leading-7 text-slate-700 sm:text-base">
          제출 기록을 기준으로 팀별 최고 점수와 현재 순위를 확인할 수 있습니다.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-3xl border border-sky-100 bg-sky-50/70 p-6">
          <p className="text-[11px] font-black uppercase tracking-[0.2em] text-sky-600/70">Teams</p>
          <p className="mt-3 text-3xl font-black text-slate-900">{rows.length}</p>
        </div>
        <div className="rounded-3xl border border-emerald-100 bg-emerald-50/70 p-6">
          <p className="text-[11px] font-black uppercase tracking-[0.2em] text-emerald-600/70">Submitted</p>
          <p className="mt-3 text-3xl font-black text-slate-900">{submittedRows.length}</p>
        </div>
        <div className="rounded-3xl border border-amber-100 bg-amber-50/70 p-6">
          <p className="text-[11px] font-black uppercase tracking-[0.2em] text-amber-600/70">Top Team</p>
          <p className="mt-3 break-words text-xl font-black text-slate-900">
            {topRow?.teamName ?? '아직 없음'}
          </p>
        </div>
      </div>

      <div className="overflow-hidden rounded-[28px] border border-slate-100 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full border-separate border-spacing-0">
            <thead>
              <tr className="bg-slate-50">
                <th className="border-b border-slate-200 px-5 py-4 text-left text-xs font-black uppercase tracking-[0.18em] text-slate-500">
                  Rank
                </th>
                <th className="border-b border-slate-200 px-5 py-4 text-left text-xs font-black uppercase tracking-[0.18em] text-slate-500">
                  Team
                </th>
                <th className="border-b border-slate-200 px-5 py-4 text-left text-xs font-black uppercase tracking-[0.18em] text-slate-500">
                  Score
                </th>
                <th className="border-b border-slate-200 px-5 py-4 text-left text-xs font-black uppercase tracking-[0.18em] text-slate-500">
                  Submissions
                </th>
                <th className="border-b border-slate-200 px-5 py-4 text-left text-xs font-black uppercase tracking-[0.18em] text-slate-500">
                  Best Submitted At
                </th>
                <th className="border-b border-slate-200 px-5 py-4 text-left text-xs font-black uppercase tracking-[0.18em] text-slate-500">
                  Status
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={row.teamId} className={index % 2 === 0 ? 'bg-white' : 'bg-slate-50/40'}>
                  <td className="border-b border-slate-100 px-5 py-4 align-top">
                    <span
                      className={`inline-flex min-w-12 items-center justify-center rounded-full border px-3 py-1.5 text-sm font-black ${getRankStyle(row.rank)}`}
                    >
                      {row.rank ?? '-'}
                    </span>
                  </td>
                  <td className="border-b border-slate-100 px-5 py-4 align-top">
                    <div className="flex items-start gap-3">
                      {row.rank && row.rank <= 3 ? (
                        <div className="rounded-2xl bg-amber-50 p-2 text-amber-500">
                          <Trophy className="h-4 w-4" />
                        </div>
                      ) : null}
                      <div className="min-w-0">
                        <p className="break-words text-sm font-black leading-6 text-slate-900">{row.teamName}</p>
                        <p className="mt-1 text-xs font-semibold text-slate-500">{row.teamId}</p>
                      </div>
                    </div>
                  </td>
                  <td className="border-b border-slate-100 px-5 py-4 align-top">
                    <p className="text-lg font-black text-slate-900">{formatScore(row.bestScore)}</p>
                  </td>
                  <td className="border-b border-slate-100 px-5 py-4 align-top">
                    <p className="text-sm font-semibold text-slate-700">{row.submissionCount}</p>
                  </td>
                  <td className="border-b border-slate-100 px-5 py-4 align-top">
                    <p className="max-w-[220px] text-sm leading-6 text-slate-600 break-words">
                      {formatDateTime(row.bestSubmittedAt)}
                    </p>
                  </td>
                  <td className="border-b border-slate-100 px-5 py-4 align-top">
                    <span
                      className={`inline-flex rounded-full px-3 py-1.5 text-xs font-bold ${
                        row.status === '제출'
                          ? 'bg-emerald-50 text-emerald-700'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {row.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  )
}
