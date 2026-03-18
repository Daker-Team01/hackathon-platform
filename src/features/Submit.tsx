import { useMemo, useState, type FormEvent } from 'react'
import hackathonDetailData from '../data/public_hackathon_detail.json'
import { useLog } from '../contexts/LogContext'

type SubmitProps = {
  hackathonSlug: string
}

type SubmitSection = {
  allowedArtifactTypes?: string[]
  guide?: string[]
}

type HackathonDetailItem = {
  slug: string
  sections?: {
    submit?: SubmitSection
  }
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

const SUBMISSIONS_STORAGE_KEY = 'submissions'
const TEAMS_STORAGE_KEY = 'teams'
const ACCEPT_BY_TYPE: Record<string, string> = {
  zip: '.zip,application/zip',
  pdf: '.pdf,application/pdf',
}

type TeamOption = {
  id: string
  name: string
  hackathonSlug: string
}

function getSubmitSectionBySlug(slug: string): SubmitSection | null {
  const details = hackathonDetailData as HackathonDetailItem[]
  const detail = details.find((item) => item.slug === slug)
  return detail?.sections?.submit ?? null
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

function getTeamOptionsFromStorage(hackathonSlug: string): TeamOption[] {
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
        const idValue = candidate.id
        const teamCodeValue = candidate.teamCode
        const id =
          typeof idValue === 'string'
            ? idValue
            : typeof teamCodeValue === 'string'
            ? teamCodeValue
            : `${itemHackathonSlug}-${name}`
        if (!itemHackathonSlug || !name) return null
        return { id, name, hackathonSlug: itemHackathonSlug }
      })
      .filter((item): item is TeamOption => item !== null)
      .filter((item) => item.hackathonSlug === hackathonSlug)
  } catch {
    return []
  }
}

export default function Submit({ hackathonSlug }: SubmitProps) {
  const { recordEvent } = useLog()
  const submitSection = useMemo(() => getSubmitSectionBySlug(hackathonSlug), [hackathonSlug])
  const teamOptions = useMemo(() => getTeamOptionsFromStorage(hackathonSlug), [hackathonSlug])
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

    const newSubmission: Submission = {
      hackathonSlug,
      notes: notes.trim(),
      artifact,
      createdAt: new Date().toISOString(),
      artifactType,
      teamId: selectedTeam?.id,
      teamName: selectedTeam?.name,
    }

    const submissions = getSubmissionsFromStorage()
    const updated = [...submissions, newSubmission]
    localStorage.setItem(SUBMISSIONS_STORAGE_KEY, JSON.stringify(updated))

    recordEvent('submit_project', 'hackathon', hackathonSlug, {
      teamId: selectedTeam?.id,
      teamName: selectedTeam?.name,
    })

    setNotes('')
    setTeamId('')
    setArtifactFile(null)
    setArtifactUrl('')
    setMessage('제출이 완료되었습니다.')
  }

  return (
    <section>
      <h2>Submit</h2>

      <h3>Submission Guide</h3>
      {submitSection?.guide && submitSection.guide.length > 0 ? (
        <ul>
          {submitSection.guide.map((item, index) => (
            <li key={`${item}-${index}`}>{item}</li>
          ))}
        </ul>
      ) : (
        <p>제출 가이드가 없습니다.</p>
      )}

      <form onSubmit={handleSubmit}>
        <label htmlFor="submit-team">team: </label>
        <select
          id="submit-team"
          value={teamId}
          onChange={(event) => setTeamId(event.target.value)}
          required
        >
          <option value="">팀을 선택하세요</option>
          {teamOptions.map((team) => (
            <option key={team.id} value={team.id}>
              {team.name}
            </option>
          ))}
        </select>
        <br />

        <textarea
          placeholder="notes (optional)"
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
        />
        <br />

        <label htmlFor="artifact-type">artifact type: </label>
        <select
          id="artifact-type"
          value={artifactType}
          onChange={(event) => {
            const nextType = event.target.value
            setArtifactType(nextType)
            setArtifactFile(null)
            setArtifactUrl('')
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
        <br />

        {artifactType === 'url' ? (
          <input
            type="url"
            placeholder="https://..."
            value={artifactUrl}
            onChange={(event) => setArtifactUrl(event.target.value)}
            required
          />
        ) : (
          <input
            key={artifactType}
            type="file"
            accept={ACCEPT_BY_TYPE[artifactType] ?? ''}
            onChange={(event) => setArtifactFile(event.target.files?.[0] ?? null)}
            required
          />
        )}
        <br />

        <button type="submit">submit</button>
      </form>

      {message ? <p>{message}</p> : null}
    </section>
  )
}
