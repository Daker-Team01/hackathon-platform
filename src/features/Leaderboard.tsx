import { useMemo } from 'react'
import hackathonDetailData from '../data/public_hackathon_detail.json'

type LeaderboardProps = {
  hackathonSlug: string
}

type Team = {
  id: string
  hackathonSlug: string
  name: string
}

type Submission = {
  hackathonSlug?: string
  teamId?: string
  teamName?: string
}

type EvalBreakdownItem = {
  key: string
  weightPercent: number
}

type EvalSection = {
  scoreDisplay?: {
    breakdown?: EvalBreakdownItem[]
  }
}

type HackathonDetailItem = {
  slug: string
  sections?: {
    eval?: EvalSection
  }
}

type LeaderboardRow = {
  teamId: string
  teamName: string
  score: number | null
  status: '제출' | '미제출'
  rank: number | null
}

const TEAMS_STORAGE_KEY = 'teams'
const SUBMISSIONS_STORAGE_KEY = 'submissions'

function hashTo100(seed: string): number {
  let hash = 0
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) % 101
  }
  return hash
}

function normalizeTeam(item: unknown): Team | null {
  if (typeof item !== 'object' || item === null) return null
  const candidate = item as Record<string, unknown>

  const hackathonSlug = typeof candidate.hackathonSlug === 'string' ? candidate.hackathonSlug : ''
  const name = typeof candidate.name === 'string' ? candidate.name : ''
  const idValue = candidate.id
  const teamCodeValue = candidate.teamCode
  const id =
    typeof idValue === 'string'
      ? idValue
      : typeof teamCodeValue === 'string'
      ? teamCodeValue
      : `${hackathonSlug}-${name}`

  if (!hackathonSlug || !name) return null
  return { id, hackathonSlug, name }
}

function getTeamsFromStorage(): Team[] {
  const raw = localStorage.getItem(TEAMS_STORAGE_KEY)
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed
      .map((item) => normalizeTeam(item))
      .filter((item): item is Team => item !== null)
  } catch {
    return []
  }
}

function normalizeSubmission(item: unknown): Submission | null {
  if (typeof item !== 'object' || item === null) return null
  const candidate = item as Record<string, unknown>
  const hackathonSlug =
    typeof candidate.hackathonSlug === 'string' ? candidate.hackathonSlug : undefined
  const teamId = typeof candidate.teamId === 'string' ? candidate.teamId : undefined
  const teamName = typeof candidate.teamName === 'string' ? candidate.teamName : undefined
  return { hackathonSlug, teamId, teamName }
}

function getSubmissionsFromStorage(): Submission[] {
  const raw = localStorage.getItem(SUBMISSIONS_STORAGE_KEY)
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed
      .map((item) => normalizeSubmission(item))
      .filter((item): item is Submission => item !== null)
  } catch {
    return []
  }
}

function getEvalSectionBySlug(slug: string): EvalSection | null {
  const root = hackathonDetailData as HackathonDetailItem & {
    extraDetails?: HackathonDetailItem[]
  }
  if (root.slug === slug) return root.sections?.eval ?? null
  const detail = root.extraDetails?.find((item) => item.slug === slug)
  return detail?.sections?.eval ?? null
}

function getScoreForTeam(teamId: string, breakdown: EvalBreakdownItem[] | undefined): number {
  if (!breakdown || breakdown.length === 0) {
    return hashTo100(`score:${teamId}`)
  }

  const total = breakdown.reduce((sum, item) => {
    const voteValue = hashTo100(`${item.key}:${teamId}`)
    const weight = (Number(item.weightPercent) || 0) / 100
    return sum + voteValue * weight
  }, 0)
  return Math.round(total)
}

export default function Leaderboard({ hackathonSlug }: LeaderboardProps) {
  const rows = useMemo(() => {
    const teams = getTeamsFromStorage().filter((team) => team.hackathonSlug === hackathonSlug)
    const submissions = getSubmissionsFromStorage().filter(
      (submission) => submission.hackathonSlug === hackathonSlug
    )
    const breakdown = getEvalSectionBySlug(hackathonSlug)?.scoreDisplay?.breakdown

    const baseRows: LeaderboardRow[] = teams.map((team) => {
      const hasSubmission = submissions.some(
        (submission) =>
          submission.teamId === team.id ||
          (submission.teamName && submission.teamName === team.name)
      )

      if (!hasSubmission) {
        return {
          teamId: team.id,
          teamName: team.name,
          score: null,
          status: '미제출',
          rank: null,
        }
      }

      return {
        teamId: team.id,
        teamName: team.name,
        score: getScoreForTeam(team.id, breakdown),
        status: '제출',
        rank: null,
      }
    })

    const ranked = baseRows
      .filter((row) => row.status === '제출' && row.score !== null)
      .sort((a, b) => (b.score ?? -1) - (a.score ?? -1))
      .map((row, index) => ({ ...row, rank: index + 1 }))

    const rankByTeamId = new Map(ranked.map((row) => [row.teamId, row.rank]))
    return baseRows.map((row) => ({
      ...row,
      rank: row.status === '제출' ? (rankByTeamId.get(row.teamId) ?? null) : null,
    }))
  }, [hackathonSlug])

  return (
    <section>
      <h2>Leaderboard</h2>
      <table>
        <thead>
          <tr>
            <th>Rank</th>
            <th>Team name</th>
            <th>Score</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.teamId}>
              <td>{row.rank ?? '-'}</td>
              <td>{row.teamName}</td>
              <td>{row.score ?? '-'}</td>
              <td>{row.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}
