import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { 
  getTeams, 
  getTeamsByLeaderId,
  updateTeam, 
  getTeamByCode, 
  deleteTeam, 
  createTeam, 
  inviteUser, 
  getInvitesForUser, 
  getInvitesByTeam, 
  clearResolvedInvitesForUser,
  respondToInvite, 
  kickMember,
  sendTeamNotice,
  cancelInvite,
  createTeamRequest,
  cancelTeamRequest,
  getTeamRequestsByTeam,
  getTeamRequestsForUser,
  getPendingTeamRequestsForLeader,
  respondToTeamRequest,
  updateMemberRole
} from "../api/teamApi"
import type { Team, TeamInvite, TeamRequest } from "../types/team"
import { useLog } from "../contexts/LogContext"

export const useTeams = (hackathonSlug?: string, options?: { enabled?: boolean }) => {
  return useQuery({
    queryKey: ["teams", hackathonSlug],
    queryFn: () => getTeams(hackathonSlug),
    enabled: options?.enabled ?? true
  })
}

export const useTeamsByLeader = (leaderId: string, options?: { enabled?: boolean }) => {
  return useQuery({
    queryKey: ["teams", "leader", leaderId],
    queryFn: () => getTeamsByLeaderId(leaderId),
    enabled: (options?.enabled ?? true) && !!leaderId
  })
}

export const useTeam = (teamCode: string) => {
  return useQuery({
    queryKey: ["team", teamCode],
    queryFn: () => getTeamByCode(teamCode),
    enabled: !!teamCode
  })
}

export const useCreateTeam = () => {
  const queryClient = useQueryClient()
  const { recordEvent } = useLog()

  return useMutation({
    mutationFn: (team: Omit<Team, "teamCode" | "createdAt" | "members"> & { leaderName?: string }) => createTeam(team),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["teams"] })
      // 로그 수집: team_create
      recordEvent('team_create', 'team', data.teamCode, {
        teamName: data.name,
        hackathonSlug: data.hackathonSlug
      })
    }
  })
}

export const useUpdateTeam = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ teamCode, updates }: { teamCode: string; updates: Partial<Omit<Team, "teamCode" | "createdAt">> }) => 
      updateTeam(teamCode, updates),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["teams"] })
      queryClient.invalidateQueries({ queryKey: ["team", variables.teamCode] })
    }
  })
}

export const useDeleteTeam = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (teamCode: string) => deleteTeam(teamCode),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["teams"] })
    }
  })
}

export const useInviteUser = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (invite: Omit<TeamInvite, "id" | "status" | "createdAt">) => inviteUser(invite),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["invites", "team", variables.teamId] })
    }
  })
}

export const useCancelInvite = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (inviteId: string) => cancelInvite(inviteId),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["invites", "team", data.teamId] })
      queryClient.invalidateQueries({ queryKey: ["invites", "user", data.invitedUserId] })
    }
  })
}

export const useUserInvites = (userId: string) => {
  return useQuery({
    queryKey: ["invites", "user", userId],
    queryFn: () => getInvitesForUser(userId),
    enabled: !!userId
  })
}

export const useTeamInvites = (teamId: string) => {
  return useQuery({
    queryKey: ["invites", "team", teamId],
    queryFn: () => getInvitesByTeam(teamId),
    enabled: !!teamId
  })
}

export const useClearResolvedInvitesForUser = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (userId: string) => clearResolvedInvitesForUser(userId),
    onSuccess: (_, userId) => {
      queryClient.invalidateQueries({ queryKey: ["invites", "user", userId] })
    }
  })
}

export const useRespondToInvite = () => {
  const queryClient = useQueryClient()
  const { recordEvent } = useLog()

  return useMutation({
    mutationFn: ({ inviteId, status }: { inviteId: string; status: 'ACCEPTED' | 'REJECTED' }) => 
      respondToInvite(inviteId, status),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["invites", "user", data.invitedUserId] })
      queryClient.invalidateQueries({ queryKey: ["invites", "team", data.teamId] })
      queryClient.invalidateQueries({ queryKey: ["teams"] })
      queryClient.invalidateQueries({ queryKey: ["team", data.teamId] })

      // 로그 수집: team_join (수락 시에만)
      if (data.status === 'ACCEPTED') {
        recordEvent('team_join', 'team', data.teamId, {
          inviteId: data.id,
          teamName: data.teamName
        })
      }
    }
  })
}

export const useKickMember = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ teamCode, userId }: { teamCode: string; userId: string }) => kickMember(teamCode, userId),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["teams"] })
      queryClient.invalidateQueries({ queryKey: ["team", variables.teamCode] })
    }
  })
}

export const useSendTeamNotice = () => {
  return useMutation({
    mutationFn: ({ teamCode, senderId, content }: { teamCode: string; senderId: string; content: string }) =>
      sendTeamNotice(teamCode, senderId, content)
  })
}

export const useCreateTeamRequest = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (request: {
      teamId: string
      requestType: 'JOIN' | 'LEAVE'
      requesterUserId: string
      requesterUserName: string
    }) => createTeamRequest(request),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["teamRequests", "team", data.teamId] })
      queryClient.invalidateQueries({ queryKey: ["teamRequests", "user", data.requesterUserId] })
      queryClient.invalidateQueries({ queryKey: ["teams"] })
      queryClient.invalidateQueries({ queryKey: ["team", data.teamId] })
    }
  })
}

export const useCancelTeamRequest = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ requestId, requesterUserId }: { requestId: string; requesterUserId: string }) =>
      cancelTeamRequest(requestId, requesterUserId),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["teamRequests", "team", data.teamId] })
      queryClient.invalidateQueries({ queryKey: ["teamRequests", "user", data.requesterUserId] })
    }
  })
}

export const useTeamRequestsByTeam = (teamId: string) => {
  return useQuery<TeamRequest[]>({
    queryKey: ["teamRequests", "team", teamId],
    queryFn: () => getTeamRequestsByTeam(teamId),
    enabled: !!teamId
  })
}

export const useTeamRequestsForUser = (userId: string) => {
  return useQuery<TeamRequest[]>({
    queryKey: ["teamRequests", "user", userId],
    queryFn: () => getTeamRequestsForUser(userId),
    enabled: !!userId
  })
}

export const usePendingTeamRequestsForLeader = (leaderId: string) => {
  return useQuery<TeamRequest[]>({
    queryKey: ["teamRequests", "leader", leaderId],
    queryFn: () => getPendingTeamRequestsForLeader(leaderId),
    enabled: !!leaderId
  })
}

export const useRespondToTeamRequest = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ requestId, reviewerUserId, status }: { requestId: string; reviewerUserId: string; status: 'APPROVED' | 'REJECTED' }) =>
      respondToTeamRequest(requestId, reviewerUserId, status),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["teamRequests", "team", data.teamId] })
      queryClient.invalidateQueries({ queryKey: ["teamRequests", "user", data.requesterUserId] })
      queryClient.invalidateQueries({ queryKey: ["teams"] })
      queryClient.invalidateQueries({ queryKey: ["team", data.teamId] })
    }
  })
}

export const useUpdateMemberRole = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ teamCode, userId, newRole, updatedByUserId }: { teamCode: string; userId: string; newRole: string; updatedByUserId: string }) =>
      updateMemberRole(teamCode, userId, newRole, updatedByUserId),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["teams"] })
      queryClient.invalidateQueries({ queryKey: ["team", variables.teamCode] })
    }
  })
}
