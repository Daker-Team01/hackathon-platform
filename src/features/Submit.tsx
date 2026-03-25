import { useMemo, useState, type FormEvent } from 'react'
import { Info } from 'lucide-react'
import { getHackathonDetailBySlug } from '../lib/hackathonDetailData'
import { useLog } from '../contexts/LogContext'
import { useUser } from '../contexts/UserContext'

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
const TEAMS_STORAGE_KEY = 'teams'
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

function getTeamOptionsFromStorage(hackathonSlug: string, userId?: string): TeamOption[] {
  const raw = localStorage.getItem(TEAMS_STORAGE_KEY)
  if (!raw) return []

  try {
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed
      .map((item) => {
        if (typeof item !== 'object' || item === null) return null
        const candidate = item as Record<string, unknown>
        const itemHackathonSlug =
          typeof candidate.hackathonSlug === 'string' ? candidate.hackathonSlug : ''
        const name = typeof candidate.name === 'string' ? candidate.name : ''
        const leaderId = typeof candidate.leaderId === 'string' ? candidate.leaderId : ''
        const idValue = candidate.id
        const teamCodeValue = candidate.teamCode
        const id =
          typeof idValue === 'string'
            ? idValue
            : typeof teamCodeValue === 'string'
            ? teamCodeValue
            : `${itemHackathonSlug}-${name}`
        if (!itemHackathonSlug || !name) return null
        return { id, name, hackathonSlug: itemHackathonSlug, leaderId }
      })
      .filter((item): item is TeamOption => item !== null)
      .filter((item) => item.hackathonSlug === hackathonSlug)
      .filter((item) => !userId || item.leaderId === userId)
  } catch {
    return []
  }
}

export default function Submit({ hackathonSlug }: SubmitProps) {
  const { recordEvent } = useLog()
  const { user } = useUser()
  const submitSection = useMemo(() => getSubmitSectionBySlug(hackathonSlug), [hackathonSlug])
  const teamOptions = useMemo(() => getTeamOptionsFromStorage(hackathonSlug, user?.id), [hackathonSlug, user?.id])
  const evalBreakdown = useMemo(() => getEvalBreakdownBySlug(hackathonSlug), [hackathonSlug])
  
  // 해커톤 상태 확인
  const isEnded = useMemo(() => {
    const raw = localStorage.getItem('hackathons')
    if (!raw) return false
    try {
      const parsed = JSON.parse(raw)
      const h = Array.isArray(parsed) ? parsed.find((item: any) => item.slug === hackathonSlug) : null
      return h?.status === 'ended'
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
    <section style={{ marginTop: 12 }}>
      <h2 style={{ marginBottom: 12 }}>Submit</h2>

      {isEnded ? (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 px-6 py-8 rounded-3xl flex flex-col items-center gap-4 text-center shadow-sm animate-in fade-in zoom-in duration-500">
          <div className="w-16 h-16 rounded-2xl bg-amber-100 flex items-center justify-center text-amber-500">
            <Info className="w-8 h-8" />
          </div>
          <div>
            <h3 className="text-xl font-black mb-1">해커톤 종료</h3>
            <p className="font-bold text-sm opacity-80 leading-relaxed">
              이미 종료된 해커톤입니다.<br />프로젝트 제출 및 수정이 불가합니다.
            </p>
          </div>
        </div>
      ) : (
        <>
          <div
            style={{
              border: '1px solid #e5e7eb',
              borderRadius: 10,
              padding: 16,
              backgroundColor: '#fafafa',
              marginBottom: 16,
            }}
          >
            <h3 style={{ margin: '0 0 10px 0' }}>Submission Guide</h3>
            {submitSection?.guide && submitSection.guide.length > 0 ? (
              <ul style={{ margin: 0, paddingLeft: 20, lineHeight: 1.6 }}>
                {submitSection.guide.map((item, index) => (
                  <li key={`${item}-${index}`}>{item}</li>
                ))}
              </ul>
            ) : (
              <p style={{ margin: 0 }}>제출 가이드가 없습니다.</p>
            )}
          </div>

          <form
            onSubmit={handleSubmit}
            style={{
              border: '1px solid #e5e7eb',
              borderRadius: 10,
              padding: 16,
              display: 'grid',
              gap: 14,
            }}
          >
            <div style={{ display: 'grid', gap: 6 }}>
              <label htmlFor="submit-team" style={{ fontWeight: 600 }}>
                Team (팀장만 제출 가능)
              </label>
              <select
                id="submit-team"
                value={teamId}
                onChange={(event) => setTeamId(event.target.value)}
                required
                style={{
                  padding: '10px 12px',
                  border: '1px solid #d1d5db',
                  borderRadius: 8,
                  fontSize: 14,
                }}
              >
                <option value="">팀을 선택하세요</option>
                {teamOptions.map((team) => (
                  <option key={team.id} value={team.id}>
                    {team.name}
                  </option>
                ))}
              </select>
              {teamOptions.length === 0 && user && (
                <p style={{ fontSize: '0.75rem', color: '#ef4444', fontWeight: 'bold', marginTop: 4 }}>
                  * 귀하가 팀장인 팀이 없습니다. 제출은 팀장만 가능합니다.
                </p>
              )}
            </div>

            <div style={{ display: 'grid', gap: 6 }}>
              <label htmlFor="submit-notes" style={{ fontWeight: 600 }}>
                Notes
              </label>
              <textarea
                id="submit-notes"
                placeholder="notes (optional)"
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                rows={5}
                style={{
                  padding: '10px 12px',
                  border: '1px solid #d1d5db',
                  borderRadius: 8,
                  fontSize: 14,
                  resize: 'vertical',
                }}
              />
            </div>

            <div style={{ display: 'grid', gap: 6 }}>
              <label htmlFor="artifact-type" style={{ fontWeight: 600 }}>
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
                style={{
                  padding: '10px 12px',
                  border: '1px solid #d1d5db',
                  borderRadius: 8,
                  fontSize: 14,
                }}
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

            <div style={{ display: 'grid', gap: 6 }}>
              <label style={{ fontWeight: 600 }}>Artifact</label>
              {artifactType === 'url' ? (
                <input
                  type="url"
                  placeholder="https://..."
                  value={artifactUrl}
                  onChange={(event) => setArtifactUrl(event.target.value)}
                  required
                  style={{
                    padding: '10px 12px',
                    border: '1px solid #d1d5db',
                    borderRadius: 8,
                    fontSize: 14,
                  }}
                />
              ) : (
                <input
                  key={artifactType}
                  type="file"
                  accept={ACCEPT_BY_TYPE[artifactType] ?? ''}
                  onChange={(event) => setArtifactFile(event.target.files?.[0] ?? null)}
                  required
                  style={{
                    padding: '10px 12px',
                    border: '1px solid #d1d5db',
                    borderRadius: 8,
                    fontSize: 14,
                    backgroundColor: '#fff',
                  }}
                />
              )}
            </div>

            <div>
              <button
                type="submit"
                disabled={teamOptions.length === 0}
                style={{
                  padding: '10px 14px',
                  borderRadius: 8,
                  border: 'none',
                  backgroundColor: teamOptions.length === 0 ? '#9ca3af' : '#111827',
                  color: '#fff',
                  cursor: teamOptions.length === 0 ? 'not-allowed' : 'pointer',
                  fontWeight: 600,
                }}
              >
                submit
              </button>
            </div>
          </form>
        </>
      )}

      {message ? <p style={{ marginTop: 12 }}>{message}</p> : null}
    </section>
  )
  }