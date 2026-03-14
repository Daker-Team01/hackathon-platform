import { useMemo, useState, type FormEvent } from 'react'

type Team = {
  id: string
  hackathonSlug: string
  name: string
  description: string
  lookingFor: string[]
  contact: string
}

type TeamsProps = {
  hackathonSlug: string
}

type TeamFormState = {
  name: string
  description: string
  lookingFor: string
  contact: string
}

type InvitationStatus = 'pending' | 'accepted' | 'declined'

type Invitation = {
  id: string
  teamId: string
  teamName: string
  hackathonSlug: string
  invitedUser: string
  status: InvitationStatus
  createdAt: string
}

type NoticeAction =
  | {
      kind: 'create-team'
      payload: TeamFormState
    }
  | {
      kind: 'accept-invitation'
      payload: { invitationId: string }
    }

const TEAMS_STORAGE_KEY = 'teams'
const INVITATIONS_STORAGE_KEY = 'invitations'
const CURRENT_USER_STORAGE_KEY = 'currentUser'

function normalizeTeam(item: unknown): Team | null {
  if (typeof item !== 'object' || item === null) return null

  const candidate = item as Record<string, unknown>
  const idValue = candidate.id
  const teamCodeValue = candidate.teamCode
  const hackathonSlug = typeof candidate.hackathonSlug === 'string' ? candidate.hackathonSlug : ''
  const name = typeof candidate.name === 'string' ? candidate.name : ''
  const contactValue = candidate.contact
  const intro = typeof candidate.intro === 'string' ? candidate.intro : ''
  const id =
    typeof idValue === 'string'
      ? idValue
      : typeof teamCodeValue === 'string'
      ? teamCodeValue
      : `${hackathonSlug}-${name}`

  let contact = ''
  if (typeof contactValue === 'string') {
    contact = contactValue
  } else if (typeof contactValue === 'object' && contactValue !== null) {
    const url = (contactValue as Record<string, unknown>).url
    contact = typeof url === 'string' ? url : ''
  }

  const description =
    typeof candidate.description === 'string' ? candidate.description : intro

  let lookingFor: string[] = []
  if (Array.isArray(candidate.lookingFor)) {
    lookingFor = candidate.lookingFor.filter(
      (value): value is string => typeof value === 'string'
    )
  } else if (typeof candidate.lookingFor === 'string') {
    lookingFor = candidate.lookingFor
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean)
  }

  if (!hackathonSlug || !name || !description || !contact) return null

  return {
    id,
    hackathonSlug,
    name,
    description,
    lookingFor,
    contact,
  }
}

function normalizeInvitation(item: unknown): Invitation | null {
  if (typeof item !== 'object' || item === null) return null
  const candidate = item as Record<string, unknown>

  const id = typeof candidate.id === 'string' ? candidate.id : ''
  const teamId = typeof candidate.teamId === 'string' ? candidate.teamId : ''
  const teamName = typeof candidate.teamName === 'string' ? candidate.teamName : ''
  const hackathonSlug = typeof candidate.hackathonSlug === 'string' ? candidate.hackathonSlug : ''
  const invitedUser = typeof candidate.invitedUser === 'string' ? candidate.invitedUser : ''
  const status = candidate.status
  const createdAt = typeof candidate.createdAt === 'string' ? candidate.createdAt : ''

  if (!id || !teamId || !teamName || !hackathonSlug || !invitedUser || !createdAt) return null
  if (status !== 'pending' && status !== 'accepted' && status !== 'declined') return null

  return {
    id,
    teamId,
    teamName,
    hackathonSlug,
    invitedUser,
    status,
    createdAt,
  }
}

function getTeamsFromStorage(): Team[] {
  const raw = localStorage.getItem(TEAMS_STORAGE_KEY)
  if (!raw) return []

  try {
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []

    return parsed
      .map((item) => normalizeTeam(item))
      .filter((team): team is Team => team !== null)
  } catch {
    return []
  }
}

function getInvitationsFromStorage(): Invitation[] {
  const raw = localStorage.getItem(INVITATIONS_STORAGE_KEY)
  if (!raw) return []

  try {
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed
      .map((item) => normalizeInvitation(item))
      .filter((item): item is Invitation => item !== null)
  } catch {
    return []
  }
}

function generateId(prefix: string): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}-${crypto.randomUUID()}`
  }
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 10000)}`
}

export default function Teams({ hackathonSlug }: TeamsProps) {
  const [teams, setTeams] = useState<Team[]>(() => getTeamsFromStorage())
  const [invitations, setInvitations] = useState<Invitation[]>(() => getInvitationsFromStorage())
  const [currentUser, setCurrentUser] = useState<string>(
    () => localStorage.getItem(CURRENT_USER_STORAGE_KEY) ?? 'guest'
  )
  const [form, setForm] = useState<TeamFormState>({
    name: '',
    description: '',
    lookingFor: '',
    contact: '',
  })
  const [noticeOpen, setNoticeOpen] = useState(false)
  const [pendingAction, setPendingAction] = useState<NoticeAction | null>(null)

  const hackathonTeams = useMemo(
    () => teams.filter((team) => team.hackathonSlug === hackathonSlug),
    [teams, hackathonSlug]
  )

  const visibleInvitations = useMemo(
    () =>
      invitations.filter(
        (invitation) =>
          invitation.hackathonSlug === hackathonSlug &&
          invitation.invitedUser === currentUser &&
          invitation.status === 'pending'
      ),
    [invitations, hackathonSlug, currentUser]
  )

  function persistTeams(updatedTeams: Team[]) {
    setTeams(updatedTeams)
    localStorage.setItem(TEAMS_STORAGE_KEY, JSON.stringify(updatedTeams))
  }

  function persistInvitations(updatedInvitations: Invitation[]) {
    setInvitations(updatedInvitations)
    localStorage.setItem(INVITATIONS_STORAGE_KEY, JSON.stringify(updatedInvitations))
  }

  function createTeam(payload: TeamFormState) {
    const name = payload.name.trim()
    const description = payload.description.trim()
    const contact = payload.contact.trim()
    const lookingFor = payload.lookingFor
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean)

    if (!name || !description || !contact) return

    const newTeam: Team = {
      id: generateId('team'),
      hackathonSlug,
      name,
      description,
      lookingFor,
      contact,
    }

    const updatedTeams = [...teams, newTeam]
    persistTeams(updatedTeams)
    setForm({
      name: '',
      description: '',
      lookingFor: '',
      contact: '',
    })
  }

  function updateInvitationStatus(invitationId: string, status: InvitationStatus) {
    const updatedInvitations = invitations.map((invitation) =>
      invitation.id === invitationId ? { ...invitation, status } : invitation
    )
    persistInvitations(updatedInvitations)
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setPendingAction({
      kind: 'create-team',
      payload: { ...form },
    })
    setNoticeOpen(true)
  }

  function handleInvite(team: Team) {
    const invitedUser = window.prompt('초대할 사용자 ID를 입력하세요.')
    if (!invitedUser) return

    const newInvitation: Invitation = {
      id: generateId('invite'),
      teamId: team.id,
      teamName: team.name,
      hackathonSlug,
      invitedUser: invitedUser.trim(),
      status: 'pending',
      createdAt: new Date().toISOString(),
    }
    if (!newInvitation.invitedUser) return

    const updatedInvitations = [...invitations, newInvitation]
    persistInvitations(updatedInvitations)
  }

  function handleAccept(invitationId: string) {
    setPendingAction({
      kind: 'accept-invitation',
      payload: { invitationId },
    })
    setNoticeOpen(true)
  }

  function handleConfirmNotice() {
    if (!pendingAction) return

    if (pendingAction.kind === 'create-team') {
      createTeam(pendingAction.payload)
    } else if (pendingAction.kind === 'accept-invitation') {
      updateInvitationStatus(pendingAction.payload.invitationId, 'accepted')
    }

    setPendingAction(null)
    setNoticeOpen(false)
  }

  function handleCloseNotice() {
    setPendingAction(null)
    setNoticeOpen(false)
  }

  function handleCurrentUserChange(user: string) {
    setCurrentUser(user)
    localStorage.setItem(CURRENT_USER_STORAGE_KEY, user)
  }

  return (
    <section>
      <h2>Teams</h2>
      <div style={{ marginBottom: 12 }}>
        <label htmlFor="current-user">Current User: </label>
        <input
          id="current-user"
          value={currentUser}
          onChange={(event) => handleCurrentUserChange(event.target.value)}
          placeholder="current user id"
        />
      </div>

      {hackathonTeams.length === 0 ? (
        <p>등록된 팀이 없습니다.</p>
      ) : (
        hackathonTeams.map((team) => (
          <article
            key={team.id}
            style={{ border: '1px solid #ccc', padding: 12, marginBottom: 8 }}
          >
            <h3>{team.name}</h3>
            <p>{team.description}</p>
            <p>Looking For: {team.lookingFor.join(', ') || '-'}</p>
            <p>Contact: {team.contact}</p>
            <button type="button" onClick={() => handleInvite(team)}>
              Invite
            </button>
          </article>
        ))
      )}

      <h3>Invitations</h3>
      {visibleInvitations.length === 0 ? (
        <p>현재 사용자에게 도착한 초대가 없습니다.</p>
      ) : (
        visibleInvitations.map((invitation) => (
          <article
            key={invitation.id}
            style={{ border: '1px dashed #999', padding: 12, marginBottom: 8 }}
          >
            <p>
              Team: <strong>{invitation.teamName}</strong>
            </p>
            <button type="button" onClick={() => handleAccept(invitation.id)}>
              Accept
            </button>
            <button
              type="button"
              onClick={() => updateInvitationStatus(invitation.id, 'declined')}
              style={{ marginLeft: 8 }}
            >
              Decline
            </button>
          </article>
        ))
      )}

      <h3>Create Team</h3>
      <form onSubmit={handleSubmit}>
        <input
          value={form.name}
          onChange={(event) => setForm({ ...form, name: event.target.value })}
          placeholder="name"
          required
        />
        <br />
        <textarea
          value={form.description}
          onChange={(event) => setForm({ ...form, description: event.target.value })}
          placeholder="description"
          required
        />
        <br />
        <input
          value={form.lookingFor}
          onChange={(event) => setForm({ ...form, lookingFor: event.target.value })}
          placeholder="lookingFor (comma-separated)"
        />
        <br />
        <input
          value={form.contact}
          onChange={(event) => setForm({ ...form, contact: event.target.value })}
          placeholder="contact"
          required
        />
        <br />
        <button type="submit">Create Team</button>
      </form>

      {noticeOpen ? (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.45)',
            display: 'grid',
            placeItems: 'center',
            padding: 16,
          }}
        >
          <div style={{ backgroundColor: '#fff', color: '#111', maxWidth: 560, padding: 16 }}>
            <h3>Team Participation Notice</h3>
            <p>팀 생성/참여 전 아래 규칙을 확인하세요.</p>
            <ul>
              <li>한 해커톤에서 활동 정책을 준수해야 합니다.</li>
              <li>팀원 간 연락과 역할 분담은 팀 내부에서 명확히 합의해야 합니다.</li>
              <li>운영 정책 위반 시 팀 참여가 제한될 수 있습니다.</li>
            </ul>
            <button type="button" onClick={handleConfirmNotice}>
              Confirm
            </button>
            <button type="button" onClick={handleCloseNotice} style={{ marginLeft: 8 }}>
              Cancel
            </button>
          </div>
        </div>
      ) : null}
    </section>
  )
}
