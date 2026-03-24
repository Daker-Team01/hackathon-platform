import type { Team, TeamInvite, TeamMember } from "../types/team"
import teamDummyData from "../data/team_dummy_data.json"
import userDummyData from "../data/user_dummy_data.json"
import {
  GENERAL_ROOM_ID,
  createChatTimestamp,
  createTeamRoom,
  mutateUserChatData,
  upsertMessageInChatData,
  upsertRoomInChatData,
  type ChatMessage
} from "../utils/chatStorage"

const LOCAL_STORAGE_KEY = "teams"
const INVITES_STORAGE_KEY = "team_invites"
const TEAM_BOT_NAME = "Team Bot"

const getNicknameByUserId = (userId: string) => {
  return userDummyData.find((user) => user.userId === userId)?.nickname || "Unknown User"
}

const getUniqueUsernames = (userIds: string[]) => {
  return Array.from(
    new Set(
      userIds
        .map((userId) => getNicknameByUserId(userId))
    )
  )
}

const createInviteChatMessage = (invite: TeamInvite): ChatMessage => ({
  id: `team-invite:${invite.id}`,
  user: TEAM_BOT_NAME,
  text: `${invite.teamName} 팀에서 초대가 도착했습니다.\n수락하면 ${invite.teamName} 팀 채팅방에 바로 참여합니다.`,
  timestamp: createChatTimestamp(new Date(invite.createdAt)),
  invite: {
    inviteId: invite.id,
    teamId: invite.teamId,
    teamName: invite.teamName,
    status: invite.status
  }
})

const createInviteResponseMessage = (invite: TeamInvite): ChatMessage => ({
  id: `team-invite-response:${invite.id}`,
  user: TEAM_BOT_NAME,
  text:
    invite.status === 'ACCEPTED'
      ? `${invite.teamName} 팀 초대를 수락했습니다.\n${invite.teamName} 팀 채팅방이 생성되었고 바로 참여되었습니다.`
      : `${invite.teamName} 팀 초대를 거절했습니다.`,
  timestamp: createChatTimestamp()
})

const createTeamWelcomeMessage = (team: Team): ChatMessage => ({
  id: `team-room-welcome:${team.teamCode}`,
  user: TEAM_BOT_NAME,
  text: `${team.name} 팀 채팅방이 생성되었습니다.\n참여자: ${team.members.map((member) => member.userName).join(', ') || '팀원 확인 중'}`,
  timestamp: createChatTimestamp(new Date(team.createdAt))
})

const createTeamJoinMessage = (team: Team, member: TeamMember): ChatMessage => ({
  id: `team-room-joined:${team.teamCode}:${member.userId}`,
  user: TEAM_BOT_NAME,
  text: `${member.userName}님이 ${team.name} 팀 채팅방에 참여했습니다.`,
  timestamp: createChatTimestamp()
})

const syncInviteToGeneralChat = (invite: TeamInvite) => {
  const nickname = getNicknameByUserId(invite.invitedUserId)

  mutateUserChatData(nickname, (chatData) => {
    return upsertMessageInChatData(chatData, GENERAL_ROOM_ID, createInviteChatMessage(invite))
  })
}

const appendInviteResponseToGeneralChat = (invite: TeamInvite) => {
  const nickname = getNicknameByUserId(invite.invitedUserId)

  mutateUserChatData(nickname, (chatData) => {
    const nextChatData = upsertMessageInChatData(
      chatData,
      GENERAL_ROOM_ID,
      createInviteChatMessage(invite)
    )

    return upsertMessageInChatData(nextChatData, GENERAL_ROOM_ID, createInviteResponseMessage(invite))
  })
}

const syncTeamChatRoom = (team: Team, joinedMember?: TeamMember) => {
  const nicknames = getUniqueUsernames([
    team.leaderId,
    ...team.members.map((member) => member.userId)
  ])

  const room = createTeamRoom(team.teamCode, team.name)
  const welcomeMessage = createTeamWelcomeMessage(team)

  nicknames.forEach((nickname) => {
    mutateUserChatData(nickname, (chatData) => {
      let nextChatData = upsertRoomInChatData(chatData, room)
      nextChatData = upsertMessageInChatData(nextChatData, room.id, welcomeMessage)

      if (joinedMember) {
        nextChatData = upsertMessageInChatData(
          nextChatData,
          room.id,
          createTeamJoinMessage(team, joinedMember)
        )
      }

      return nextChatData
    })
  })
}

const normalizeTeam = (team: any): Team => {
  const leaderId = team.leaderId || team.authorId || ''
  const rawMembers = Array.isArray(team.members) ? team.members : []
  
  const members: TeamMember[] = rawMembers.map((m: any) => ({
    userId: m.userId,
    userName: m.userName || getNicknameByUserId(m.userId),
    role: m.role || (m.userId === leaderId ? 'LEADER' : 'MEMBER'),
    joinedAt: m.joinedAt || team.createdAt || new Date().toISOString()
  }))

  return {
    ...team,
    leaderId,
    members,
    maxMembers: team.maxMembers || 5,
    memberCount: members.length
  }
}

const getStoredTeams = (): Team[] => {
  const stored = localStorage.getItem(LOCAL_STORAGE_KEY)
  if (stored) {
    try {
      const parsed = JSON.parse(stored) as any[]
      return parsed.map(normalizeTeam)
    } catch (e) {
      console.error("Failed to parse stored teams", e)
    }
  }
  
  const initialTeams = (teamDummyData as any[]).map(normalizeTeam)
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
      userId: team.leaderId,
      userName: leaderName || getNicknameByUserId(team.leaderId),
      role: 'LEADER',
      joinedAt: new Date().toISOString()
    }],
    ...teamData
  } as Team

  const updatedTeams = [newTeam, ...teams]
  saveTeams(updatedTeams)
  syncTeamChatRoom(newTeam)
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
  syncInviteToGeneralChat(newInvite)
  return newInvite
}

export const getInvitesForUser = async (userId: string): Promise<TeamInvite[]> => {
  const invites = getStoredInvites()
  return invites.filter(inv => inv.invitedUserId === userId)
}

export const clearResolvedInvitesForUser = async (userId: string): Promise<number> => {
  const invites = getStoredInvites()
  const nextInvites = invites.filter((inv) => inv.invitedUserId !== userId || inv.status === 'PENDING')
  const removedCount = invites.length - nextInvites.length

  if (removedCount > 0) {
    saveInvites(nextInvites)
  }

  return removedCount
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
      const existingMember = team.members.some((member) => member.userId === updatedInvite.invitedUserId)

      if (!existingMember) {
        const newMember: TeamMember = {
          userId: updatedInvite.invitedUserId,
          userName: updatedInvite.invitedUserName,
          role: 'MEMBER',
          joinedAt: new Date().toISOString()
        }

        team.members = [...(team.members || []), newMember]
        team.memberCount = team.members.length
        saveTeams(teams)
        syncTeamChatRoom(team, newMember)
      } else {
        syncTeamChatRoom(team)
      }
    }
  }

  appendInviteResponseToGeneralChat(updatedInvite)

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
