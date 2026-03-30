import { useEffect, useMemo, useState } from 'react'
import { CheckCircle2, Trophy } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useTeams } from '../hooks/useTeams'
import { useUser } from '../contexts/UserContext'
import { getVoteEligibility } from '../lib/voteEligibility'

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

type Submission = {
  hackathonSlug: string
  notes: string
  artifact: string
  createdAt: string
  artifactType?: string
  teamId?: string
  teamName?: string
}

type VoteRecord = {
  [hackathonSlug: string]: {
    [userId: string]: {
      teamCode: string
      teamName: string
      votedAt: string
    }
  }
}

const LEADERBOARD_SUBMISSIONS_STORAGE_KEY = 'leaderboard_submissions'
const SUBMISSIONS_STORAGE_KEY = 'submissions'
const VOTE_STORAGE_KEY = 'hackathon_votes_v1'
const HACKATHONS_STORAGE_KEY = 'hackathons'

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

function getSubmissionsFromStorage(): Submission[] {
  const raw = localStorage.getItem(SUBMISSIONS_STORAGE_KEY)
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as Submission[]) : []
  } catch {
    return []
  }
}

function loadVoteRecord(): VoteRecord {
  const raw = localStorage.getItem(VOTE_STORAGE_KEY)
  if (!raw) return {}
  try {
    const parsed = JSON.parse(raw)
    return typeof parsed === 'object' && parsed !== null ? (parsed as VoteRecord) : {}
  } catch {
    return {}
  }
}

function saveVoteRecord(record: VoteRecord) {
  localStorage.setItem(VOTE_STORAGE_KEY, JSON.stringify(record))
}

function getVotingPhase(hackathonSlug: string): 'before' | 'open' | 'ended' | 'unknown' {
  const raw = localStorage.getItem(HACKATHONS_STORAGE_KEY)
  if (!raw) return 'unknown'

  try {
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return 'unknown'

    const target = parsed.find((item) => {
      if (typeof item !== 'object' || item === null) return false
      return (item as { slug?: unknown }).slug === hackathonSlug
    }) as { period?: { submissionDeadlineAt?: string; endAt?: string } } | undefined

    const submissionTime = Date.parse(target?.period?.submissionDeadlineAt ?? '')
    const endTime = Date.parse(target?.period?.endAt ?? '')
    if (!Number.isFinite(submissionTime) || !Number.isFinite(endTime)) {
      return 'unknown'
    }

    const now = Date.now()
    if (now < submissionTime) return 'before'
    if (now > endTime) return 'ended'
    return 'open'
  } catch {
    return 'unknown'
  }
}

function isAfterSubmissionDeadline(hackathonSlug: string): boolean {
  const raw = localStorage.getItem(HACKATHONS_STORAGE_KEY)
  if (!raw) return false

  try {
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return false

    const target = parsed.find((item) => {
      if (typeof item !== 'object' || item === null) return false
      return (item as { slug?: unknown }).slug === hackathonSlug
    }) as { period?: { submissionDeadlineAt?: string } } | undefined

    const submissionTime = Date.parse(target?.period?.submissionDeadlineAt ?? '')
    if (!Number.isFinite(submissionTime)) {
      return false
    }

    return Date.now() >= submissionTime
  } catch {
    return false
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
  const { user } = useUser()
  const { data: teams = [] } = useTeams(hackathonSlug)
  const voteEligibility = useMemo(() => getVoteEligibility(hackathonSlug, user), [hackathonSlug, user])
  const votingPhase = useMemo(() => getVotingPhase(hackathonSlug), [hackathonSlug])
  const isVoteHackathon = voteEligibility.isVoteSource
  const canPreviewSubmissions = useMemo(() => isAfterSubmissionDeadline(hackathonSlug), [hackathonSlug])

  const isParticipantByTeamMembership = useMemo(() => {
    if (!user) return false

    const userIds = new Set([user.id, user.userId].filter(Boolean))

    return teams.some((team) => {
      if (team.hackathonSlug !== hackathonSlug) return false

      const isLeader = userIds.has(team.leaderId)
      const isMember = team.members.some((member) => userIds.has(member.userId))
      return isLeader || isMember
    })
  }, [hackathonSlug, teams, user])

  // 팀-유저 연결이 존재하면 participations 더미가 없어도 참여자로 인정한다.
  const canVoteOnLeaderboard = voteEligibility.isVoteSource && voteEligibility.isWithinVotingPeriod && (
    voteEligibility.isParticipant || isParticipantByTeamMembership
  )

  const [previewTeamId, setPreviewTeamId] = useState<string | null>(null)
  const [votedTeamCode, setVotedTeamCode] = useState<string>(() => {
    if (!user) return ''
    const voteRecord = loadVoteRecord()
    return voteRecord[hackathonSlug]?.[user.userId]?.teamCode ?? ''
  })

  useEffect(() => {
    if (!user) {
      setVotedTeamCode('')
      return
    }

    const voteRecord = loadVoteRecord()
    setVotedTeamCode(voteRecord[hackathonSlug]?.[user.userId]?.teamCode ?? '')
  }, [hackathonSlug, user])

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

  const previewSubmissionByTeamId = useMemo(() => {
    const map = new Map<string, Submission>()
    const submissions = getSubmissionsFromStorage().filter(
      (submission) => submission.hackathonSlug === hackathonSlug && submission.teamId
    )

    submissions.forEach((submission) => {
      const teamId = submission.teamId as string
      const existing = map.get(teamId)
      if (!existing || toTimestamp(submission.createdAt) > toTimestamp(existing.createdAt)) {
        map.set(teamId, submission)
      }
    })

    return map
  }, [hackathonSlug])

  const previewSubmission = previewTeamId ? previewSubmissionByTeamId.get(previewTeamId) : null

  const onVoteTeam = (row: LeaderboardRow) => {
    if (!user || !canVoteOnLeaderboard || row.status !== '제출') {
      return
    }

    const voteRecord = loadVoteRecord()
    const nextRecord: VoteRecord = {
      ...voteRecord,
      [hackathonSlug]: {
        ...(voteRecord[hackathonSlug] ?? {}),
        [user.userId]: {
          teamCode: row.teamId,
          teamName: row.teamName,
          votedAt: new Date().toISOString()
        }
      }
    }

    saveVoteRecord(nextRecord)
    setVotedTeamCode(row.teamId)
  }

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

      {previewSubmission ? (
        <div className="rounded-3xl border border-sky-200 bg-sky-50 px-6 py-5">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-sky-700/80">제출물 안내</p>
          <h3 className="mt-2 text-xl font-black text-slate-900">{previewSubmission.teamName ?? previewTeamId} 제출물</h3>
          <p className="mt-2 text-sm text-slate-700">
            제출 시각: {formatDateTime(previewSubmission.createdAt)}
          </p>
          <p className="mt-1 text-sm text-slate-700 break-all">
            제출물: {previewSubmission.artifact}
          </p>
          {previewSubmission.notes ? (
            <p className="mt-2 text-sm text-slate-700 whitespace-pre-line">비고: {previewSubmission.notes}</p>
          ) : null}
        </div>
      ) : null}

      {isVoteHackathon ? (
        <div className={`rounded-3xl px-6 py-5 ${canVoteOnLeaderboard ? 'border border-emerald-200 bg-emerald-50' : 'border border-rose-100 bg-rose-50'}`}>
          <p className={`text-xs font-black uppercase tracking-[0.2em] ${canVoteOnLeaderboard ? 'text-emerald-700/80' : 'text-rose-700/80'}`}>
            Vote Status
          </p>
          <h3 className="mt-2 text-lg font-black text-slate-900">
            {canVoteOnLeaderboard ? '현재 투표 가능합니다.' : '현재 투표할 수 없습니다.'}
          </h3>

          <div className="mt-3 flex flex-wrap gap-2">
            <span className={`rounded-full px-3 py-1 text-xs font-bold ${
              votingPhase === 'open' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-700'
            }`}>
              투표 기간: {
                votingPhase === 'before'
                  ? '투표 시작 전'
                  : votingPhase === 'open'
                    ? '진행중'
                    : votingPhase === 'ended'
                      ? '종료됨'
                      : '확인 불가'
              }
            </span>
            <span className={`rounded-full px-3 py-1 text-xs font-bold ${
              voteEligibility.isParticipant || isParticipantByTeamMembership
                ? 'bg-emerald-100 text-emerald-700'
                : 'bg-slate-200 text-slate-700'
            }`}>
              참가자 여부: {voteEligibility.isParticipant || isParticipantByTeamMembership ? '참가자' : '미참가'}
            </span>
          </div>

          {!canVoteOnLeaderboard ? (
            <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-slate-700">
              {[...voteEligibility.reasons, '팀 참여 정보가 있으면 투표 권한으로 인정됩니다.'].map((reason) => (
                <li key={reason}>{reason}</li>
              ))}
            </ul>
          ) : votedTeamCode ? (
            <div className="mt-3 flex items-center gap-2 text-emerald-700 font-bold">
              <CheckCircle2 className="h-5 w-5" />
              투표 완료: {rows.find((row) => row.teamId === votedTeamCode)?.teamName ?? votedTeamCode}
            </div>
          ) : (
            <p className="mt-3 text-sm text-emerald-700/90">아직 투표하지 않았습니다. 아래 테이블에서 팀을 선택하세요.</p>
          )}

          {canVoteOnLeaderboard ? (
            <p className="mt-2 text-sm text-emerald-700/90">마감 전까지 다른 팀으로 다시 투표해 변경할 수 있습니다.</p>
          ) : null}
        </div>
      ) : null}

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
                <th className="border-b border-slate-200 px-5 py-4 text-left text-xs font-black uppercase tracking-[0.18em] text-slate-500">
                  Submit
                </th>
                {isVoteHackathon ? (
                  <th className="border-b border-slate-200 px-5 py-4 text-left text-xs font-black uppercase tracking-[0.18em] text-slate-500">
                    Vote
                  </th>
                ) : null}
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
                  <td className="border-b border-slate-100 px-5 py-4 align-top">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={
                        row.status !== '제출' ||
                        !previewSubmissionByTeamId.get(row.teamId) ||
                        !canPreviewSubmissions
                      }
                      onClick={() => setPreviewTeamId(row.teamId)}
                    >
                      제출물보기
                    </Button>
                  </td>
                  {isVoteHackathon ? (
                    <td className="border-b border-slate-100 px-5 py-4 align-top">
                      <Button
                        size="sm"
                        disabled={
                          row.status !== '제출' ||
                          !canVoteOnLeaderboard
                        }
                        onClick={() => onVoteTeam(row)}
                        variant={votedTeamCode === row.teamId ? 'secondary' : 'default'}
                      >
                        {votedTeamCode === row.teamId ? '선택됨' : '이 팀에 투표'}
                      </Button>
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  )
}
