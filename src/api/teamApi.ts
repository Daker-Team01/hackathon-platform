import type { Team, TeamInvite, InviteStatus, TeamMember } from "../types/team"
import publicTeams from "../data/public_teams.json"

const LOCAL_STORAGE_KEY = "teams"
const INVITES_STORAGE_KEY = "team_invites"

const getStoredTeams = (): Team[] => {
  const stored = localStorage.getItem(LOCAL_STORAGE_KEY)
  if (stored) {
    return JSON.parse(stored)
  }
  
  // 초기 데이터가 없는 경우 public_teams.json에서 가져오기
  const initialTeams = (publicTeams as any[]).map(team => ({
    ...team,
    authorId: team.authorId || "1",
    members: team.members || [{
      userId: team.authorId || "1",
      userName: "Alice", // Default for initial data if unknown
      role: 'LEADER',
      joinedAt: team.createdAt || new Date().toISOString()
    }]
  })) as Team[]
  
  localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(initialTeams))
  return initialTeams
}

const saveTeams = (teams: Team[]) => {
  localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(teams))
}

const getStoredInvites = (): TeamInvite[] => {
  const stored = localStorage.getItem(INVITES_STORAGE_KEY)
  return stored ? JSON.parse(stored) : []
}

const saveInvites = (invites: TeamInvite[]) => {
  localStorage.setItem(INVITES_STORAGE_KEY, JSON.stringify(invites))
}

export const getTeams = async (hackathonSlug?: string): Promise<Team[]> => {
  await new Promise((resolve) => setTimeout(resolve, 300))
  const teams = getStoredTeams()

  if (!hackathonSlug) return teams

  return teams.filter((team) => team.hackathonSlug === hackathonSlug)
}

export const getTeamByCode = async (code: string): Promise<Team | undefined> => {
  await new Promise((resolve) => setTimeout(resolve, 200))
  const teams = getStoredTeams()
  return teams.find((team) => team.teamCode === code)
}

export const createTeam = async (
  team: Omit<Team, "teamCode" | "createdAt" | "members"> & { leaderName?: string }
): Promise<Team> => {
  const teams = getStoredTeams()
  const { leaderName, ...teamData } = team;
  const newTeam: Team = {
    teamCode: `T-${Date.now().toString().slice(-6)}`,
    createdAt: new Date().toISOString(),
    members: [{
      userId: team.authorId,
      userName: leaderName || "Leader",
      role: 'LEADER',
      joinedAt: new Date().toISOString()
    }],
    ...teamData
  } as Team

  const updatedTeams = [newTeam, ...teams]
  saveTeams(updatedTeams)
  return newTeam
}

export const updateTeam = async (
  teamCode: string,
  updates: Partial<Omit<Team, "teamCode" | "createdAt">>
): Promise<Team> => {
  const teams = getStoredTeams()
  const index = teams.findIndex((t) => t.teamCode === teamCode)
  if (index === -1) throw new Error("Team not found")

  const updatedTeam = { ...teams[index], ...updates }
  teams[index] = updatedTeam
  saveTeams(teams)
  return updatedTeam
}

export const deleteTeam = async (teamCode: string): Promise<void> => {
  const teams = getStoredTeams()
  const updatedTeams = teams.filter((t) => t.teamCode !== teamCode)
  saveTeams(updatedTeams)
}

// Invitation APIs
export const inviteUser = async (invite: Omit<TeamInvite, "id" | "status" | "createdAt">): Promise<TeamInvite> => {
  const invites = getStoredInvites()
  const newInvite: TeamInvite = {
    id: `INV-${Date.now().toString().slice(-6)}`,
    status: 'PENDING',
    createdAt: new Date().toISOString(),
    ...invite
  }
  saveInvites([...invites, newInvite])
  return newInvite
}

export const getInvitesForUser = async (userId: string): Promise<TeamInvite[]> => {
  const invites = getStoredInvites()
  return invites.filter(inv => inv.invitedUserId === userId)
}

export const getInvitesByTeam = async (teamId: string): Promise<TeamInvite[]> => {
  const invites = getStoredInvites()
  return invites.filter(inv => inv.teamId === teamId)
}

export const respondToInvite = async (inviteId: string, status: 'ACCEPTED' | 'REJECTED'): Promise<TeamInvite> => {
  const invites = getStoredInvites()
  const index = invites.findIndex(inv => inv.id === inviteId)
  if (index === -1) throw new Error("Invite not found")
  if (invites[index].status !== 'PENDING') throw new Error("Invite already processed")

  const updatedInvite = { ...invites[index], status }
  invites[index] = updatedInvite
  saveInvites(invites)

  if (status === 'ACCEPTED') {
    const teams = getStoredTeams()
    const teamIndex = teams.findIndex(t => t.teamCode === updatedInvite.teamId)
    if (teamIndex !== -1) {
      const team = teams[teamIndex]
      const newMember: TeamMember = {
        userId: updatedInvite.invitedUserId,
        userName: updatedInvite.invitedUserName,
        role: 'MEMBER',
        joinedAt: new Date().toISOString()
      }
      team.members = [...(team.members || []), newMember]
      team.memberCount = team.members.length
      saveTeams(teams)
    }
  }

  return updatedInvite
}

export const kickMember = async (teamCode: string, userId: string): Promise<Team> => {
  const teams = getStoredTeams()
  const index = teams.findIndex(t => t.teamCode === teamCode)
  if (index === -1) throw new Error("Team not found")

  const team = teams[index]
  team.members = team.members.filter(m => m.userId !== userId)
  team.memberCount = team.members.length
  saveTeams(teams)
  return team
}
