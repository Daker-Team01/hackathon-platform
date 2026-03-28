import type { Team, TeamInvite, TeamMember, TeamRequest } from "../types/team"
import userDummyData from "../data/user_dummy_data.json"
import { supabase } from "../lib/supabase"
import { enqueueGeneralChatNotification } from '../utils/generalChatNotifications'
import {
  createTeamChatRoom,
  fetchTeamChatRoom,
  addChatMember,
  removeChatMember,
  addTeamMembersToChatRoom,
  ensureNoticeRoomForUser,
  sendSystemMessage,
  deactivateTeamChatRoom
} from "./realtimeChatApi"

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
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'CANCELED'
  created_at: string
}

type SupabaseTeamRequestRow = {
  id: string
  team_id: string
  team_name: string
  request_type: 'JOIN' | 'LEAVE'
  requester_user_id: string
  requester_user_name: string
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELED'
  reviewed_by: string | null
  reviewed_at: string | null
  created_at: string
}

const getNicknameByUserId = (userId: string) => {
  return userDummyData.find((user) => user.userId === userId)?.nickname || "Unknown User"
}

const announceGeneralToUsers = (userIds: string[], text: string) => {
  const uniqueUserIds = Array.from(new Set(userIds.filter(Boolean)))
  uniqueUserIds.forEach((userId) => enqueueGeneralChatNotification(userId, text))
}

const announceGeneralToUser = (userId: string, text: string) => {
  if (!userId) return
  enqueueGeneralChatNotification(userId, text)
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

const mapSupabaseRequestToRequest = (row: SupabaseTeamRequestRow): TeamRequest => ({
  id: row.id,
  teamId: row.team_id,
  teamName: row.team_name,
  requestType: row.request_type,
  requesterUserId: row.requester_user_id,
  requesterUserName: row.requester_user_name,
  status: row.status,
  createdAt: row.created_at,
  reviewedBy: row.reviewed_by,
  reviewedAt: row.reviewed_at
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

const ensureLeaderHasNoTeamInHackathon = async (
  leaderId: string,
  hackathonSlug?: string,
  excludeTeamCode?: string
) => {
  if (!hackathonSlug) return

  const { data, error } = await supabase
    .from("teams")
    .select("team_code")
    .eq("leader_id", leaderId)
    .eq("hackathon_slug", hackathonSlug)

  if (error) {
    throw error
  }

  const duplicated = (data || []).some((team) => team.team_code !== excludeTeamCode)
  if (duplicated) {
    throw new Error("이미 해당 해커톤으로 만든 팀이 있어 중복 생성할 수 없습니다.")
  }
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

export const getTeamsByLeaderId = async (leaderId: string): Promise<Team[]> => {
  const { data, error } = await supabase
    .from("teams")
    .select("*")
    .eq("leader_id", leaderId)
    .order("created_at", { ascending: false })

  if (error) {
    console.error("Failed to fetch teams by leader:", error)
    return []
  }

  return (data || []).map((row) => mapSupabaseTeamToTeam(row as SupabaseTeamRow))
}

export const createTeam = async (
  team: Omit<Team, "teamCode" | "createdAt" | "members"> & { leaderName?: string }
): Promise<Team> => {
  const { leaderName, ...teamData } = team
  const nowIso = new Date().toISOString()

  await ensureLeaderHasNoTeamInHackathon(team.leaderId, team.hackathonSlug)

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

  announceGeneralToUser(createdTeam.leaderId, `${createdTeam.name} 팀을 생성했습니다. 팀 채팅방이 생성되었습니다.`)

  return createdTeam
}

export const updateTeam = async (
  teamCode: string,
  updates: Partial<Omit<Team, "teamCode" | "createdAt">>
): Promise<Team> => {
  const { data: currentTeamRow, error: currentError } = await supabase
    .from("teams")
    .select("team_code, leader_id, hackathon_slug")
    .eq("team_code", teamCode)
    .single()

  if (currentError) {
    if (currentError.code === "PGRST116") {
      throw new Error("Team not found")
    }
    throw currentError
  }

  const currentLeaderId = (currentTeamRow as { leader_id: string }).leader_id
  const currentHackathonSlug = (currentTeamRow as { hackathon_slug?: string | null }).hackathon_slug || undefined
  const targetLeaderId = updates.leaderId ?? currentLeaderId
  const targetHackathonSlug = Object.prototype.hasOwnProperty.call(updates, "hackathonSlug")
    ? updates.hackathonSlug
    : currentHackathonSlug

  await ensureLeaderHasNoTeamInHackathon(targetLeaderId, targetHackathonSlug, teamCode)

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

  const memberIds = Array.from(
    new Set([
      targetTeam.leaderId,
      ...targetTeam.members.map((member) => member.userId)
    ])
  )

  announceGeneralToUsers(memberIds, `${targetTeam.name} 팀이 삭제되어 팀 채팅방이 종료되었습니다.`)
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
  const team = await getTeamByCodeFromDb(newInvite.teamId)
  const inviterId = team?.leaderId || ''
  const inviterName = inviterId ? getNicknameByUserId(inviterId) : '팀장'
  announceGeneralToUser(inviterId, `${newInvite.invitedUserName}님에게 ${newInvite.teamName} 팀 참여 초대장을 보냈습니다.`)
  announceGeneralToUser(newInvite.invitedUserId, `${inviterName}님이 ${newInvite.teamName} 팀 참여 초대장을 보냈습니다.`)
  return newInvite
}

export const cancelInvite = async (inviteId: string): Promise<TeamInvite> => {
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
  if (currentInvite.status !== 'PENDING') {
    throw new Error("Pending invite only can be canceled")
  }

  const { data: updatedRow, error: updateError } = await supabase
    .from("team_invites")
    .update({ status: 'CANCELED' })
    .eq("id", inviteId)
    .select("*")
    .single()

  if (updateError) throw updateError

  const updatedInvite = mapSupabaseInviteToInvite(updatedRow as SupabaseInviteRow)
  announceGeneralToUser(updatedInvite.invitedUserId, `${updatedInvite.teamName} 팀 초대장이 취소되었습니다.`)
  return updatedInvite
}

export const createTeamRequest = async (payload: {
  teamId: string
  requestType: 'JOIN' | 'LEAVE'
  requesterUserId: string
  requesterUserName: string
}): Promise<TeamRequest> => {
  const team = await getTeamByCodeFromDb(payload.teamId)
  if (!team) throw new Error("Team not found")

  const isMember = team.members.some((member) => member.userId === payload.requesterUserId)

  if (payload.requestType === 'JOIN') {
    if (isMember) throw new Error("이미 팀에 소속되어 있습니다.")
    if (!team.isOpen) throw new Error("모집 마감 팀에는 가입 신청할 수 없습니다.")
    if (team.memberCount >= team.maxMembers) throw new Error("정원이 가득 찼습니다.")
  }

  if (payload.requestType === 'LEAVE') {
    if (team.leaderId === payload.requesterUserId) throw new Error("팀장은 탈퇴 요청할 수 없습니다.")
    if (!isMember) throw new Error("팀원만 탈퇴 요청할 수 있습니다.")
  }

  const { data: existingRows, error: existingError } = await supabase
    .from("team_requests")
    .select("id")
    .eq("team_id", payload.teamId)
    .eq("request_type", payload.requestType)
    .eq("requester_user_id", payload.requesterUserId)
    .eq("status", "PENDING")

  if (existingError) throw existingError
  if ((existingRows || []).length > 0) throw new Error("이미 처리 대기 중인 요청이 있습니다.")

  const nowIso = new Date().toISOString()
  const { data, error } = await supabase
    .from("team_requests")
    .insert({
      team_id: payload.teamId,
      team_name: team.name,
      request_type: payload.requestType,
      requester_user_id: payload.requesterUserId,
      requester_user_name: payload.requesterUserName,
      status: 'PENDING',
      created_at: nowIso
    })
    .select("*")
    .single()

  if (error) throw error

  const request = mapSupabaseRequestToRequest(data as SupabaseTeamRequestRow)
  const requestLabel = request.requestType === 'JOIN' ? '가입' : '탈퇴'
  announceGeneralToUser(team.leaderId, `${request.requesterUserName}님이 ${team.name} 팀 ${requestLabel} 요청을 보냈습니다.`)

  return request
}

export const cancelTeamRequest = async (requestId: string, requesterUserId: string): Promise<TeamRequest> => {
  const { data: row, error: fetchError } = await supabase
    .from("team_requests")
    .select("*")
    .eq("id", requestId)
    .single()

  if (fetchError) {
    if (fetchError.code === "PGRST116") throw new Error("요청을 찾을 수 없습니다.")
    throw fetchError
  }

  const request = mapSupabaseRequestToRequest(row as SupabaseTeamRequestRow)
  if (request.requesterUserId !== requesterUserId) throw new Error("요청 취소 권한이 없습니다.")
  if (request.status !== 'PENDING') throw new Error("대기 중 요청만 취소할 수 있습니다.")

  const { data: updatedRow, error: updateError } = await supabase
    .from("team_requests")
    .update({ status: 'CANCELED' })
    .eq("id", requestId)
    .select("*")
    .single()

  if (updateError) throw updateError

  const updatedRequest = mapSupabaseRequestToRequest(updatedRow as SupabaseTeamRequestRow)
  const team = await getTeamByCodeFromDb(updatedRequest.teamId)
  if (team?.leaderId) {
    announceGeneralToUser(team.leaderId, `${updatedRequest.requesterUserName}님이 ${team.name} 팀 요청을 취소했습니다.`)
  }

  return updatedRequest
}

export const getTeamRequestsByTeam = async (teamId: string): Promise<TeamRequest[]> => {
  const { data, error } = await supabase
    .from("team_requests")
    .select("*")
    .eq("team_id", teamId)
    .order("created_at", { ascending: false })

  if (error) {
    console.error("Failed to fetch team requests by team:", error)
    return []
  }

  return (data || []).map((row) => mapSupabaseRequestToRequest(row as SupabaseTeamRequestRow))
}

export const getTeamRequestsForUser = async (userId: string): Promise<TeamRequest[]> => {
  const { data, error } = await supabase
    .from("team_requests")
    .select("*")
    .eq("requester_user_id", userId)
    .order("created_at", { ascending: false })

  if (error) {
    console.error("Failed to fetch team requests for user:", error)
    return []
  }

  return (data || []).map((row) => mapSupabaseRequestToRequest(row as SupabaseTeamRequestRow))
}

export const getPendingTeamRequestsForLeader = async (leaderId: string): Promise<TeamRequest[]> => {
  const { data: ownedTeams, error: teamError } = await supabase
    .from("teams")
    .select("team_code")
    .eq("leader_id", leaderId)

  if (teamError) {
    console.error("Failed to fetch leader teams:", teamError)
    return []
  }

  const teamCodes = (ownedTeams || []).map((team) => team.team_code).filter(Boolean)
  if (!teamCodes.length) return []

  const { data, error } = await supabase
    .from("team_requests")
    .select("*")
    .eq("status", "PENDING")
    .in("team_id", teamCodes)
    .order("created_at", { ascending: false })

  if (error) {
    console.error("Failed to fetch pending team requests for leader:", error)
    return []
  }

  return (data || []).map((row) => mapSupabaseRequestToRequest(row as SupabaseTeamRequestRow))
}

export const respondToTeamRequest = async (
  requestId: string,
  reviewerUserId: string,
  status: 'APPROVED' | 'REJECTED'
): Promise<TeamRequest> => {
  const { data: row, error: fetchError } = await supabase
    .from("team_requests")
    .select("*")
    .eq("id", requestId)
    .single()

  if (fetchError) {
    if (fetchError.code === "PGRST116") throw new Error("요청을 찾을 수 없습니다.")
    throw fetchError
  }

  const request = mapSupabaseRequestToRequest(row as SupabaseTeamRequestRow)
  if (request.status !== 'PENDING') throw new Error("이미 처리된 요청입니다.")

  const team = await getTeamByCodeFromDb(request.teamId)
  if (!team) throw new Error("Team not found")
  if (team.leaderId !== reviewerUserId) throw new Error("팀장만 요청을 처리할 수 있습니다.")

  if (status === 'APPROVED' && request.requestType === 'JOIN') {
    if (!team.isOpen) throw new Error("모집 마감 팀에는 가입 승인할 수 없습니다.")
    if (team.memberCount >= team.maxMembers) throw new Error("정원이 가득 찼습니다.")

    if (team.hackathonSlug) {
      const teamsInHackathon = await getTeams(team.hackathonSlug)
      const joinedTeam = teamsInHackathon.find((target) =>
        target.teamCode !== team.teamCode &&
        (target.leaderId === request.requesterUserId || target.members.some((member) => member.userId === request.requesterUserId))
      )

      if (joinedTeam) {
        throw new Error("같은 해커톤에는 한 팀만 가입할 수 있습니다.")
      }
    }

    const alreadyMember = team.members.some((member) => member.userId === request.requesterUserId)
    if (!alreadyMember) {
      const newMember: TeamMember = {
        userId: request.requesterUserId,
        userName: request.requesterUserName,
        role: 'MEMBER',
        joinedAt: new Date().toISOString()
      }

      const nextMembers = [...team.members, newMember]
      await updateTeam(team.teamCode, {
        members: nextMembers,
        memberCount: nextMembers.length
      })

      try {
        const roomId = await ensureSupabaseTeamChatRoom(team)
        if (roomId) {
          await addChatMember(roomId, request.requesterUserId, request.requesterUserName)
          await sendSystemMessage(roomId, `${request.requesterUserName}님이 ${team.name} 팀 채팅방에 참여했습니다.`)
        }
      } catch (error) {
        console.error('Failed to add member to Supabase chat room (team request):', error)
      }
    }
  }

  if (status === 'APPROVED' && request.requestType === 'LEAVE') {
    if (request.requesterUserId === team.leaderId) throw new Error("팀장은 탈퇴 승인 대상이 아닙니다.")
    const targetMember = team.members.find((member) => member.userId === request.requesterUserId)
    if (!targetMember) throw new Error("이미 팀에서 나간 사용자입니다.")

    const nextMembers = team.members.filter((member) => member.userId !== request.requesterUserId)
    await updateTeam(team.teamCode, {
      members: nextMembers,
      memberCount: nextMembers.length
    })

    try {
      const room = await fetchTeamChatRoom(team.teamCode)
      if (room) {
        await removeChatMember(room.id, request.requesterUserId)
        await sendSystemMessage(room.id, `${request.requesterUserName}님이 ${team.name} 팀에서 탈퇴했습니다.`)
      }
    } catch (error) {
      console.error('Failed to remove member from Supabase chat room (team leave request):', error)
    }
  }

  const nowIso = new Date().toISOString()
  const { data: updatedRow, error: updateError } = await supabase
    .from("team_requests")
    .update({
      status,
      reviewed_by: reviewerUserId,
      reviewed_at: nowIso
    })
    .eq("id", requestId)
    .select("*")
    .single()

  if (updateError) throw updateError

  const updatedRequest = mapSupabaseRequestToRequest(updatedRow as SupabaseTeamRequestRow)
  announceGeneralToUser(
    updatedRequest.requesterUserId,
    `${updatedRequest.teamName} 팀 ${updatedRequest.requestType === 'JOIN' ? '가입' : '탈퇴'} 요청이 ${status === 'APPROVED' ? '승인' : '거절'}되었습니다.`
  )

  return updatedRequest
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

  // 이력 보존 정책: resolved 초대는 삭제하지 않는다.
  return (resolvedRows || []).length
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

  // 같은 해커톤 내 중복 팀 참여 방지 (초대 수락 경로)
  if (status === 'ACCEPTED') {
    const targetTeam = await getTeamByCodeFromDb(currentInvite.teamId)
    if (!targetTeam) {
      throw new Error("Team not found")
    }

    if (targetTeam.hackathonSlug) {
      const teamsInHackathon = await getTeams(targetTeam.hackathonSlug)
      const joinedTeam = teamsInHackathon.find((team) =>
        team.teamCode !== targetTeam.teamCode &&
        (team.leaderId === currentInvite.invitedUserId || team.members.some((member) => member.userId === currentInvite.invitedUserId))
      )

      if (joinedTeam) {
        throw new Error("같은 해커톤에는 한 팀만 가입할 수 있습니다.")
      }
    }
  }

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
      }

      announceGeneralToUser(
        updatedInvite.invitedUserId,
        `${team.name} 팀 초대장을 수락했습니다. 팀 채팅방에 자동으로 입장했습니다.`
      )
      announceGeneralToUser(
        team.leaderId,
        `${updatedInvite.invitedUserName}님이 ${team.name} 팀 초대장을 수락했습니다.`
      )
    }
  } else {
    const team = await getTeamByCodeFromDb(updatedInvite.teamId)
    announceGeneralToUser(
      updatedInvite.invitedUserId,
      `${updatedInvite.teamName} 팀 초대장을 거절했습니다.`
    )
    if (team?.leaderId) {
      announceGeneralToUser(
        team.leaderId,
        `${updatedInvite.invitedUserName}님이 ${updatedInvite.teamName} 팀 초대장을 거절했습니다.`
      )
    }
  }

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

  announceGeneralToUsers(
    [userId, team.leaderId],
    `${kickedMember?.userName ?? getNicknameByUserId(userId)}님이 ${team.name} 팀에서 제외되어 팀 채팅방에서 나갔습니다.`
  )

  return team
}

export const sendTeamNotice = async (teamCode: string, senderId: string, content: string): Promise<void> => {
  const trimmedContent = content.trim()
  if (!trimmedContent) {
    throw new Error('공지 내용을 입력해주세요.')
  }

  const team = await getTeamByCodeFromDb(teamCode)
  if (!team) throw new Error('Team not found')
  if (team.leaderId !== senderId) throw new Error('팀장만 공지를 보낼 수 있습니다.')

  const message = `[${team.name}] : ${trimmedContent}`

  await Promise.all(
    team.members.map(async (member) => {
      const room = await ensureNoticeRoomForUser(member.userId, member.userName)
      if (!room) return
      await sendSystemMessage(room.id, message)
    })
  )
}
