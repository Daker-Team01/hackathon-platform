import { useMemo, useState, type FormEvent } from 'react'
import { FileUp, Info, Link2, Send } from 'lucide-react'
import { getHackathonDetailBySlug } from '../lib/hackathonDetailData'
import { useLog } from '../contexts/LogContext'
import { useUser } from '../contexts/UserContext'
import { useTeams } from '../hooks/useTeams'
import { Button } from '@/components/ui/button'

type SubmitProps = {
  hackathonSlug: string
}

type SubmitSection = {
  allowedArtifactTypes?: string[]
  guide?: string[]
}

type EvalBreakdownItem = {
  key: string
  weightPercent: number
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

type LeaderboardSubmission = {
  submissionId: string
  hackathonSlug: string
  teamId: string
  submittedAt: string
  totalScore: number
}

const SUBMISSIONS_STORAGE_KEY = 'submissions'
const LEADERBOARD_SUBMISSIONS_STORAGE_KEY = 'leaderboard_submissions'
const ACCEPT_BY_TYPE: Record<string, string> = {
  zip: '.zip,application/zip',
  pdf: '.pdf,application/pdf',
}

type TeamOption = {
  id: string
  name: string
  hackathonSlug: string
  leaderId?: string
}

function getSubmitSectionBySlug(slug: string): SubmitSection | null {
  const detail = getHackathonDetailBySlug(slug)
  return detail?.sections?.submit ?? null
}

function getEvalBreakdownBySlug(slug: string): EvalBreakdownItem[] | undefined {
  const detail = getHackathonDetailBySlug(slug)
  return detail?.sections?.eval?.scoreDisplay?.breakdown
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

function getLeaderboardSubmissionsFromStorage(): LeaderboardSubmission[] {
  const raw = localStorage.getItem(LEADERBOARD_SUBMISSIONS_STORAGE_KEY)
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as LeaderboardSubmission[]) : []
  } catch {
    return []
  }
}

function hashTo100(seed: string): number {
  let hash = 0
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) % 101
  }
  return hash
}

function getTotalScore(
  teamId: string,
  submissionId: string,
  breakdown: EvalBreakdownItem[] | undefined
): number {
  if (!breakdown || breakdown.length === 0) {
    return hashTo100(`score:${teamId}:${submissionId}`)
  }

  const totalWeight = breakdown.reduce((sum, item) => sum + (Number(item.weightPercent) || 0), 0)
  if (totalWeight <= 0) {
    return hashTo100(`score:${teamId}:${submissionId}`)
  }

  const weightedSum = breakdown.reduce((sum, item) => {
    const weight = Number(item.weightPercent) || 0
    const score = hashTo100(`${item.key}:${teamId}:${submissionId}`)
    return sum + score * weight
  }, 0)

  return Math.round((weightedSum / totalWeight) * 10) / 10
}

export default function Submit({ hackathonSlug }: SubmitProps) {
  const { recordEvent } = useLog()
  const { user } = useUser()
  const { data: teams = [] } = useTeams(hackathonSlug)
  const submitSection = useMemo(() => getSubmitSectionBySlug(hackathonSlug), [hackathonSlug])
  const teamOptions = useMemo<TeamOption[]>(() => {
    return teams
      .map((team) => ({
        id: team.teamCode,
        name: team.name,
        hackathonSlug: team.hackathonSlug || '',
        leaderId: team.leaderId
      }))
      .filter((item) => item.hackathonSlug === hackathonSlug)
      .filter((item) => !user?.id || item.leaderId === user.id)
  }, [teams, hackathonSlug, user?.id])
  const evalBreakdown = useMemo(() => getEvalBreakdownBySlug(hackathonSlug), [hackathonSlug])

  const isEnded = useMemo(() => {
    const raw = localStorage.getItem('hackathons')
    if (!raw) return false
    try {
      const parsed = JSON.parse(raw)
      const h = Array.isArray(parsed)
        ? parsed.find((item) => {
            if (typeof item !== 'object' || item === null) return false
            return (item as { slug?: unknown }).slug === hackathonSlug
          })
        : null
      return (h as { status?: unknown } | null)?.status === 'ended'
    } catch {
      return false
    }
  }, [hackathonSlug])

  const allowedArtifactTypes = submitSection?.allowedArtifactTypes ?? []
  const defaultType = allowedArtifactTypes[0] ?? 'zip'

  const [notes, setNotes] = useState('')
  const [teamId, setTeamId] = useState('')
  const [artifactType, setArtifactType] = useState(defaultType)
  const [artifactFile, setArtifactFile] = useState<File | null>(null)
  const [artifactUrl, setArtifactUrl] = useState('')
  const [message, setMessage] = useState('')

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    let artifact = ''
    if (artifactType === 'url') {
      artifact = artifactUrl.trim()
    } else {
      artifact = artifactFile?.name ?? ''
    }

    if (!artifact) {
      setMessage('제출할 artifact를 입력해 주세요.')
      return
    }

    const selectedTeam = teamOptions.find((team) => team.id === teamId)
    if (!selectedTeam) {
      setMessage('제출할 팀을 선택해 주세요.')
      return
    }

    const submittedAt = new Date().toISOString()
    const submissionId = `LB-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
    const totalScore = getTotalScore(selectedTeam.id, submissionId, evalBreakdown)

    const newSubmission: Submission = {
      hackathonSlug,
      notes: notes.trim(),
      artifact,
      createdAt: submittedAt,
      artifactType,
      teamId: selectedTeam.id,
      teamName: selectedTeam.name,
    }

    const submissions = getSubmissionsFromStorage()
    const updated = [...submissions, newSubmission]
    localStorage.setItem(SUBMISSIONS_STORAGE_KEY, JSON.stringify(updated))

    const leaderboardSubmission: LeaderboardSubmission = {
      submissionId,
      hackathonSlug,
      teamId: selectedTeam.id,
      submittedAt,
      totalScore,
    }

    const leaderboardSubmissions = getLeaderboardSubmissionsFromStorage()
    localStorage.setItem(
      LEADERBOARD_SUBMISSIONS_STORAGE_KEY,
      JSON.stringify([leaderboardSubmission, ...leaderboardSubmissions])
    )

    recordEvent('submit_project', 'hackathon', hackathonSlug, {
      teamId: selectedTeam.id,
      teamName: selectedTeam.name,
    })

    setNotes('')
    setTeamId('')
    setArtifactFile(null)
    setArtifactUrl('')
    setMessage('제출이 완료되었습니다.')
  }

  return (
    <section className="space-y-8">
      <div className="rounded-[28px] border border-fuchsia-100 bg-gradient-to-br from-rose-50 via-white to-sky-50 p-6 sm:p-8">
        <p className="text-xs font-black uppercase tracking-[0.25em] text-rose-600/70">Submission Desk</p>
        <h2 className="mt-3 text-3xl font-black tracking-tight text-slate-900">Submit</h2>
        <p className="mt-4 max-w-4xl text-sm font-medium leading-7 text-slate-700 sm:text-base">
          팀장이 최종 결과물을 제출하는 구간입니다. 제출 형식과 가이드를 확인한 뒤 정확한 팀을 선택해 제출하세요.
        </p>
      </div>

      {isEnded ? (
        <div className="flex flex-col items-center gap-4 rounded-3xl border border-amber-200 bg-amber-50 px-6 py-8 text-center text-amber-800 shadow-sm">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-100 text-amber-500">
            <Info className="h-8 w-8" />
          </div>
          <div>
            <h3 className="mb-1 text-xl font-black">해커톤 종료</h3>
            <p className="text-sm font-bold leading-relaxed opacity-80">
              이미 종료된 해커톤입니다.
              <br />
              프로젝트 제출 및 수정이 불가합니다.
            </p>
          </div>
        </div>
      ) : (
        <>
          <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="rounded-[28px] border border-slate-100 bg-gradient-to-b from-white to-slate-50 p-6 shadow-sm">
              <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-500">Submission Guide</p>
              <h3 className="mt-3 text-2xl font-black tracking-tight text-slate-900">제출 전 확인사항</h3>
              {submitSection?.guide && submitSection.guide.length > 0 ? (
                <div className="mt-5 space-y-3">
                  {submitSection.guide.map((item, index) => (
                    <div
                      key={`${item}-${index}`}
                      className="rounded-2xl border border-sky-100 bg-sky-50/70 px-4 py-4"
                    >
                      <p className="text-sm font-semibold leading-7 text-slate-700">{item}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-5 text-slate-600">제출 가이드가 없습니다.</p>
              )}
            </div>

            <div className="grid gap-4">
              <div className="rounded-3xl border border-sky-100 bg-sky-50/70 p-6">
                <p className="text-[11px] font-black uppercase tracking-[0.2em] text-sky-600/70">Allowed Types</p>
                <p className="mt-3 break-words text-lg font-black text-slate-900">
                  {allowedArtifactTypes.length > 0 ? allowedArtifactTypes.join(', ') : 'zip'}
                </p>
              </div>

              <div className="rounded-3xl border border-violet-100 bg-violet-50/70 p-6">
                <p className="text-[11px] font-black uppercase tracking-[0.2em] text-violet-600/70">Submission Policy</p>
                <p className="mt-3 text-sm font-semibold leading-7 text-slate-700">
                  제출은 팀장만 가능하며, 선택한 팀 기준으로 리더보드 점수가 기록됩니다.
                </p>
              </div>
            </div>
          </div>

          <form
            onSubmit={handleSubmit}
            className="rounded-[28px] border border-slate-100 bg-white p-6 shadow-sm sm:p-8"
          >
            <div className="grid gap-6 lg:grid-cols-2">
              <div className="grid gap-2">
                <label htmlFor="submit-team" className="text-sm font-black uppercase tracking-[0.18em] text-slate-500">
                  Team
                </label>
                <select
                  id="submit-team"
                  value={teamId}
                  onChange={(event) => setTeamId(event.target.value)}
                  required
                  className="h-12 rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-semibold text-slate-800 outline-none transition focus:border-sky-400 focus:bg-white"
                >
                  <option value="">팀을 선택하세요</option>
                  {teamOptions.map((team) => (
                    <option key={team.id} value={team.id}>
                      {team.name}
                    </option>
                  ))}
                </select>
                {teamOptions.length === 0 && user ? (
                  <p className="text-sm font-semibold leading-6 text-rose-500">
                    제출 가능한 내 팀이 없습니다. 제출은 팀장만 가능합니다.
                  </p>
                ) : null}
              </div>

              <div className="grid gap-2">
                <label htmlFor="artifact-type" className="text-sm font-black uppercase tracking-[0.18em] text-slate-500">
                  Artifact Type
                </label>
                <select
                  id="artifact-type"
                  value={artifactType}
                  onChange={(event) => {
                    const nextType = event.target.value
                    setArtifactType(nextType)
                    setArtifactFile(null)
                    setArtifactUrl('')
                  }}
                  className="h-12 rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-semibold text-slate-800 outline-none transition focus:border-sky-400 focus:bg-white"
                >
                  {allowedArtifactTypes.length > 0 ? (
                    allowedArtifactTypes.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))
                  ) : (
                    <option value="zip">zip</option>
                  )}
                </select>
              </div>

              <div className="grid gap-2 lg:col-span-2">
                <label htmlFor="submit-notes" className="text-sm font-black uppercase tracking-[0.18em] text-slate-500">
                  Notes
                </label>
                <textarea
                  id="submit-notes"
                  placeholder="제출에 대한 간단한 설명이나 비고를 입력하세요."
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  rows={5}
                  className="min-h-36 rounded-[24px] border border-slate-200 bg-slate-50 px-4 py-4 text-sm font-medium leading-7 text-slate-800 outline-none transition focus:border-sky-400 focus:bg-white"
                />
              </div>

              <div className="grid gap-2 lg:col-span-2">
                <label className="text-sm font-black uppercase tracking-[0.18em] text-slate-500">Artifact</label>
                {artifactType === 'url' ? (
                  <div className="flex items-center gap-3 rounded-[24px] border border-slate-200 bg-slate-50 px-4 py-3">
                    <Link2 className="h-5 w-5 shrink-0 text-slate-400" />
                    <input
                      type="url"
                      placeholder="https://..."
                      value={artifactUrl}
                      onChange={(event) => setArtifactUrl(event.target.value)}
                      required
                      className="w-full bg-transparent text-sm font-medium text-slate-800 outline-none placeholder:text-slate-400"
                    />
                  </div>
                ) : (
                  <div className="rounded-[24px] border border-dashed border-slate-300 bg-slate-50 px-4 py-5">
                    <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-600">
                      <FileUp className="h-4 w-4" />
                      업로드 가능한 형식: {artifactType}
                    </div>
                    <input
                      key={artifactType}
                      type="file"
                      accept={ACCEPT_BY_TYPE[artifactType] ?? ''}
                      onChange={(event) => setArtifactFile(event.target.files?.[0] ?? null)}
                      required
                      className="block w-full text-sm font-medium text-slate-700 file:mr-4 file:rounded-xl file:border-0 file:bg-slate-900 file:px-4 file:py-2 file:font-semibold file:text-white hover:file:bg-slate-800"
                    />
                  </div>
                )}
              </div>
            </div>

            <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm leading-6 text-slate-500">
                제출 후 점수가 계산되어 리더보드에 반영됩니다.
              </p>
              <Button
                type="submit"
                disabled={teamOptions.length === 0}
                className="rounded-2xl bg-gradient-to-r from-slate-900 to-slate-700 px-6 py-6 font-bold text-white shadow-lg hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Send className="mr-2 h-4 w-4" />
                최종 제출하기
              </Button>
            </div>
          </form>
        </>
      )}

      {message ? (
        <div className="rounded-2xl border border-sky-100 bg-sky-50 px-5 py-4 text-sm font-semibold text-sky-700">
          {message}
        </div>
      ) : null}
    </section>
  )
}
