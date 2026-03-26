import type { Team, TeamInvite, TeamMember } from "../types/team"
import userDummyData from "../data/user_dummy_data.json"
import { supabase } from "../lib/supabase"
import {
  GENERAL_ROOM_ID,
  createChatTimestamp,
  createTeamRoom,
  getTeamRoomId,
  mutateUserChatData,
  upsertMessageInChatData,
  upsertRoomInChatData,
  type ChatMessage
} from "../utils/chatStorage"
import {
  createTeamChatRoom,
  fetchTeamChatRoom,
  addChatMember,
  removeChatMember,
  addTeamMembersToChatRoom,
  sendSystemMessage,
  deactivateTeamChatRoom
} from "./realtimeChatApi"

const TEAM_BOT_NAME = "Team Bot"
const HACKATHON_TAG_PREFIX = "hackathon:"

type SupabaseTeamRow = {
  id: number
  team_code: string
  name: string
  intro: string | null
  leader_id: string
  members: TeamMember[] | null
  is_open: boolean
  max_members: number
  member_count: number
  looking_for: string[] | null
  tags: string[] | null
  contact_type: string | null
  contact_url: string | null
  created_at: string
  last_updated_at: string
  hackathon_slug?: string | null
}

type SupabaseInviteRow = {
  id: string
  team_id: string
  team_name: string
  invited_user_id: string
  invited_user_name: string
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED'
  created_at: string
}

const getNicknameByUserId = (userId: string) => {
  return userDummyData.find((user) => user.userId === userId)?.nickname || "Unknown User"
}

const getUserByUserId = (userId: string) => {
  return userDummyData.find((user) => user.userId === userId)
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

const ensureSupabaseTeamChatRoom = async (team: Team): Promise<string | null> => {
  const existingRoom = await fetchTeamChatRoom(team.teamCode)
  if (existingRoom) {
    return existingRoom.id
  }

  const createdRoom = await createTeamChatRoom(team.teamCode, team.name, team.leaderId)
  if (!createdRoom) {
    return null
  }

  // 레거시(기존 더미) 팀도 초대 수락 시점에 채팅방을 자동 복구 생성한다.
  await addTeamMembersToChatRoom(
    createdRoom.id,
    (team.members || []).map((member) => ({ userId: member.userId, userName: member.userName }))
  )

  await sendSystemMessage(
    createdRoom.id,
    `${team.name} 팀 채팅방이 생성되었습니다. 팀원: ${(team.members || []).map((m) => m.userName).join(', ')}`
  )

  return createdRoom.id
}

const normalizeTeam = (team: Record<string, unknown>): Team => {
  const leaderId = (typeof team.leaderId === "string" ? team.leaderId : (typeof team.authorId === "string" ? team.authorId : ''))
  const rawMembers = Array.isArray(team.members) ? team.members : []
  
  const members: TeamMember[] = rawMembers.map((member) => {
    const m = (member && typeof member === "object") ? (member as Record<string, unknown>) : {}
    const userId = typeof m.userId === "string" ? m.userId : ""

    return {
      userId,
      userName: typeof m.userName === "string" ? m.userName : getNicknameByUserId(userId),
      role: (m.role === 'LEADER' || m.role === 'MEMBER') ? m.role : (userId === leaderId ? 'LEADER' : 'MEMBER'),
      joinedAt: typeof m.joinedAt === "string"
        ? m.joinedAt
        : (typeof team.createdAt === "string" ? team.createdAt : new Date().toISOString())
    }
  })

  return {
    teamCode: typeof team.teamCode === "string" ? team.teamCode : "",
    leaderId,
    hackathonSlug: typeof team.hackathonSlug === "string" ? team.hackathonSlug : undefined,
    name: typeof team.name === "string" ? team.name : "",
    intro: typeof team.intro === "string" ? team.intro : "",
    isOpen: typeof team.isOpen === "boolean" ? team.isOpen : true,
    memberCount: members.length,
    maxMembers: typeof team.maxMembers === "number" ? team.maxMembers : 5,
    members,
    lookingFor: Array.isArray(team.lookingFor)
      ? team.lookingFor.filter((item): item is string => typeof item === "string")
      : [],
    contact: {
      type: typeof (team.contact as { type?: unknown } | undefined)?.type === "string"
        ? (team.contact as { type: string }).type
        : "link",
      url: typeof (team.contact as { url?: unknown } | undefined)?.url === "string"
        ? (team.contact as { url: string }).url
        : ""
    },
    createdAt: typeof team.createdAt === "string" ? team.createdAt : new Date().toISOString()
  }
}

const extractHackathonSlug = (row: SupabaseTeamRow): string | undefined => {
  if (row.hackathon_slug) {
    return row.hackathon_slug
  }

  const tags = Array.isArray(row.tags) ? row.tags : []
  const hackathonTag = tags.find((tag) => typeof tag === 'string' && tag.startsWith(HACKATHON_TAG_PREFIX))
  return hackathonTag ? hackathonTag.slice(HACKATHON_TAG_PREFIX.length) : undefined
}

const mapSupabaseTeamToTeam = (row: SupabaseTeamRow): Team => {
  const normalized = normalizeTeam({
    teamCode: row.team_code,
    leaderId: row.leader_id,
    hackathonSlug: extractHackathonSlug(row),
    name: row.name,
    intro: row.intro || "",
    isOpen: row.is_open,
    memberCount: row.member_count,
    maxMembers: row.max_members,
    members: Array.isArray(row.members) ? row.members : [],
    lookingFor: Array.isArray(row.looking_for) ? row.looking_for : [],
    contact: {
      type: row.contact_type || "link",
      url: row.contact_url || ""
    },
    createdAt: row.created_at
  })

  return {
    ...normalized,
    memberCount: row.member_count || normalized.members.length
  }
}

const mapSupabaseInviteToInvite = (row: SupabaseInviteRow): TeamInvite => ({
  id: row.id,
  teamId: row.team_id,
  teamName: row.team_name,
  invitedUserId: row.invited_user_id,
  invitedUserName: row.invited_user_name,
  status: row.status,
  createdAt: row.created_at
})

const getTeamByCodeFromDb = async (teamCode: string): Promise<Team | undefined> => {
  const { data, error } = await supabase
    .from("teams")
    .select("*")
    .eq("team_code", teamCode)
    .single()

  if (error) {
    if (error.code === "PGRST116") {
      return undefined
    }
    throw error
  }

  return mapSupabaseTeamToTeam(data as SupabaseTeamRow)
}

export const getTeams = async (hackathonSlug?: string): Promise<Team[]> => {
  const { data, error } = await supabase
    .from("teams")
    .select("*")
    .order("created_at", { ascending: false })

  if (error) {
    console.error("Failed to fetch teams from Supabase:", error)
    return []
  }

  const teams = (data || []).map((row) => mapSupabaseTeamToTeam(row as SupabaseTeamRow))

  if (!hackathonSlug) return teams

  return teams.filter((team) => team.hackathonSlug === hackathonSlug)
}

export const getTeamByCode = async (code: string): Promise<Team | undefined> => {
  try {
    return await getTeamByCodeFromDb(code)
  } catch (error) {
    console.error("Failed to fetch team by code:", error)
    return undefined
  }
}

export const createTeam = async (
  team: Omit<Team, "teamCode" | "createdAt" | "members"> & { leaderName?: string }
): Promise<Team> => {
  const { leaderName, ...teamData } = team
  const nowIso = new Date().toISOString()
  const newTeam: Team = {
    teamCode: `T-${Date.now().toString().slice(-6)}`,
    createdAt: nowIso,
    members: [{
      userId: team.leaderId,
      userName: leaderName || getNicknameByUserId(team.leaderId),
      role: 'LEADER',
      joinedAt: nowIso
    }],
    ...teamData
  } as Team

  const { data: createdRow, error: createError } = await supabase
    .from("teams")
    .insert({
      team_code: newTeam.teamCode,
      name: newTeam.name,
      intro: newTeam.intro,
      leader_id: newTeam.leaderId,
      members: newTeam.members,
      is_open: newTeam.isOpen,
      max_members: newTeam.maxMembers,
      member_count: newTeam.memberCount,
      looking_for: newTeam.lookingFor,
      required_skills: [],
      preferred_personality: [],
      tags: [],
      hackathon_slug: newTeam.hackathonSlug || null,
      contact_type: newTeam.contact?.type || "link",
      contact_url: newTeam.contact?.url || "",
      created_at: nowIso,
      last_updated_at: nowIso
    })
    .select("*")
    .single()

  if (createError) {
    throw createError
  }

  const createdTeam = mapSupabaseTeamToTeam(createdRow as SupabaseTeamRow)
  
  // Supabase에 팀 채팅방 생성
  try {
    const supabaseRoom = await createTeamChatRoom(
      createdTeam.teamCode,
      createdTeam.name,
      team.leaderId
    )

    if (supabaseRoom) {
      // 팀 리더를 채팅방 멤버로 추가
      await addChatMember(supabaseRoom.id, team.leaderId, leaderName || getNicknameByUserId(team.leaderId))
      
      // 다른 멤버들도 추가
      if (createdTeam.members.length > 1) {
        await addTeamMembersToChatRoom(
          supabaseRoom.id,
          createdTeam.members.map(m => ({ userId: m.userId, userName: m.userName }))
        )
      }

      // 채팅방 환영 메시지
      await sendSystemMessage(supabaseRoom.id, `${createdTeam.name} 팀 채팅방이 생성되었습니다. 팀원: ${createdTeam.members.map(m => m.userName).join(', ')}`)
    }
  } catch (error) {
    console.error('Failed to create Supabase chat room:', error)
    // 실패해도 팀은 생성됨
  }

  syncTeamChatRoom(createdTeam)
  return createdTeam
}

export const updateTeam = async (
  teamCode: string,
  updates: Partial<Omit<Team, "teamCode" | "createdAt">>
): Promise<Team> => {
  const { error: currentError } = await supabase
    .from("teams")
    .select("team_code")
    .eq("team_code", teamCode)
    .single()

  if (currentError) {
    if (currentError.code === "PGRST116") {
      throw new Error("Team not found")
    }
    throw currentError
  }

  const payload: Record<string, unknown> = {
    last_updated_at: new Date().toISOString()
  }

  if (updates.name !== undefined) payload.name = updates.name
  if (updates.intro !== undefined) payload.intro = updates.intro
  if (updates.leaderId !== undefined) payload.leader_id = updates.leaderId
  if (updates.members !== undefined) payload.members = updates.members
  if (updates.isOpen !== undefined) payload.is_open = updates.isOpen
  if (updates.maxMembers !== undefined) payload.max_members = updates.maxMembers
  if (updates.memberCount !== undefined) payload.member_count = updates.memberCount
  if (updates.lookingFor !== undefined) payload.looking_for = updates.lookingFor

  if (updates.contact !== undefined) {
    payload.contact_type = updates.contact?.type || "link"
    payload.contact_url = updates.contact?.url || ""
  }

  if (Object.prototype.hasOwnProperty.call(updates, "hackathonSlug")) {
    payload.hackathon_slug = updates.hackathonSlug || null
  }

  const { data: updatedRow, error: updateError } = await supabase
    .from("teams")
    .update(payload)
    .eq("team_code", teamCode)
    .select("*")
    .single()

  if (updateError) throw updateError

  return mapSupabaseTeamToTeam(updatedRow as SupabaseTeamRow)
}

export const deleteTeam = async (teamCode: string): Promise<void> => {
  const targetTeam = await getTeamByCodeFromDb(teamCode)

  const { error: deleteError } = await supabase
    .from("teams")
    .delete()
    .eq("team_code", teamCode)

  if (deleteError) {
    throw deleteError
  }

  if (!targetTeam) {
    return
  }

  // Supabase 팀 채팅방/멤버십 비활성화 (팀원 채팅 목록에서 실시간 제거)
  try {
    await deactivateTeamChatRoom(teamCode)
  } catch (error) {
    console.error('Failed to deactivate team chat room on team deletion:', error)
  }

  // local/session 채팅 목록에서도 팀 채팅방 제거
  const teamRoomId = getTeamRoomId(teamCode)
  const memberIds = Array.from(
    new Set([
      targetTeam.leaderId,
      ...targetTeam.members.map((member) => member.userId)
    ])
  )

  memberIds.forEach((memberId) => {
    const nickname = getNicknameByUserId(memberId)
    const user = getUserByUserId(memberId)
    const possibleSessionKeys = new Set<string>([
      nickname,
      memberId,
      user?.email || '',
      user?.userId || ''
    ].filter(Boolean))

    possibleSessionKeys.forEach((key) => {
      mutateUserChatData(key, (chatData) => {
        const nextRooms = chatData.rooms.filter((room) => room.id !== teamRoomId)
        const nextMessages = { ...chatData.messages }
        delete nextMessages[teamRoomId]

        return {
          ...chatData,
          rooms: nextRooms,
          messages: nextMessages
        }
      })
    })
  })
}

// Invitation APIs
export const inviteUser = async (invite: Omit<TeamInvite, "id" | "status" | "createdAt">): Promise<TeamInvite> => {
  const nowIso = new Date().toISOString()

  const { data, error } = await supabase
    .from("team_invites")
    .insert({
      team_id: invite.teamId,
      team_name: invite.teamName,
      invited_user_id: invite.invitedUserId,
      invited_user_name: invite.invitedUserName,
      status: 'PENDING',
      created_at: nowIso
    })
    .select("*")
    .single()

  if (error) {
    throw error
  }

  const newInvite = mapSupabaseInviteToInvite(data as SupabaseInviteRow)
  syncInviteToGeneralChat(newInvite)
  return newInvite
}

export const getInvitesForUser = async (userId: string): Promise<TeamInvite[]> => {
  const { data, error } = await supabase
    .from("team_invites")
    .select("*")
    .eq("invited_user_id", userId)
    .order("created_at", { ascending: false })

  if (error) {
    console.error("Failed to fetch invites for user:", error)
    return []
  }

  return (data || []).map((row) => mapSupabaseInviteToInvite(row as SupabaseInviteRow))
}

export const clearResolvedInvitesForUser = async (userId: string): Promise<number> => {
  const { data: resolvedRows, error: fetchError } = await supabase
    .from("team_invites")
    .select("id")
    .eq("invited_user_id", userId)
    .neq("status", "PENDING")

  if (fetchError) {
    throw fetchError
  }

  const ids = (resolvedRows || []).map((row) => row.id)
  if (!ids.length) {
    return 0
  }

  const { error: deleteError } = await supabase
    .from("team_invites")
    .delete()
    .in("id", ids)

  if (deleteError) {
    throw deleteError
  }

  return ids.length
}

export const getInvitesByTeam = async (teamId: string): Promise<TeamInvite[]> => {
  const { data, error } = await supabase
    .from("team_invites")
    .select("*")
    .eq("team_id", teamId)
    .order("created_at", { ascending: false })

  if (error) {
    console.error("Failed to fetch invites by team:", error)
    return []
  }

  return (data || []).map((row) => mapSupabaseInviteToInvite(row as SupabaseInviteRow))
}

export const respondToInvite = async (inviteId: string, status: 'ACCEPTED' | 'REJECTED'): Promise<TeamInvite> => {
  const { data: inviteRow, error: inviteError } = await supabase
    .from("team_invites")
    .select("*")
    .eq("id", inviteId)
    .single()

  if (inviteError) {
    if (inviteError.code === "PGRST116") throw new Error("Invite not found")
    throw inviteError
  }

  const currentInvite = mapSupabaseInviteToInvite(inviteRow as SupabaseInviteRow)
  if (currentInvite.status !== 'PENDING') throw new Error("Invite already processed")

  const { data: updatedRow, error: updateError } = await supabase
    .from("team_invites")
    .update({ status })
    .eq("id", inviteId)
    .select("*")
    .single()

  if (updateError) {
    throw updateError
  }

  const updatedInvite = mapSupabaseInviteToInvite(updatedRow as SupabaseInviteRow)

  if (status === 'ACCEPTED') {
    const team = await getTeamByCodeFromDb(updatedInvite.teamId)
    if (team) {
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

        await updateTeam(team.teamCode, {
          members: team.members,
          memberCount: team.memberCount
        })

        // Supabase 채팅방에 새 멤버 추가
        try {
          const roomId = await ensureSupabaseTeamChatRoom(team)
          if (roomId) {
            await addChatMember(roomId, updatedInvite.invitedUserId, updatedInvite.invitedUserName)
            await sendSystemMessage(roomId, `${updatedInvite.invitedUserName}님이 ${team.name} 팀 채팅방에 참여했습니다.`)
          }
        } catch (error) {
          console.error('Failed to add member to Supabase chat room:', error)
          // 실패해도 팀 멤버십은 성공
        }

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
  const team = await getTeamByCodeFromDb(teamCode)
  if (!team) throw new Error("Team not found")

  const kickedMember = team.members.find((m) => m.userId === userId)
  team.members = team.members.filter(m => m.userId !== userId)
  team.memberCount = team.members.length

  await updateTeam(teamCode, {
    members: team.members,
    memberCount: team.memberCount
  })

  try {
    const room = await fetchTeamChatRoom(teamCode)
    if (room) {
      await removeChatMember(room.id, userId)
      await sendSystemMessage(room.id, `${kickedMember?.userName ?? getNicknameByUserId(userId)}님이 ${team.name} 팀에서 제외되었습니다.`)
    }
  } catch (error) {
    console.error('Failed to remove kicked member from Supabase chat room:', error)
  }

  const kickedNickname = getNicknameByUserId(userId)
  const kickedUser = getUserByUserId(userId)
  const teamRoomId = getTeamRoomId(teamCode)

  const possibleSessionKeys = new Set<string>([
    kickedNickname,
    userId,
    kickedUser?.email || '',
    kickedUser?.userId || ''
  ].filter(Boolean))

  possibleSessionKeys.forEach((key) => {
    mutateUserChatData(key, (chatData) => {
      const nextRooms = chatData.rooms.filter((room) => room.id !== teamRoomId)
      const nextMessages = { ...chatData.messages }
      delete nextMessages[teamRoomId]

      return {
        ...chatData,
        rooms: nextRooms,
        messages: nextMessages
      }
    })
  })

  return team
}
