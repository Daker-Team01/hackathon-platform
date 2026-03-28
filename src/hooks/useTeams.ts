import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { 
  getTeams, 
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
  sendTeamNotice
} from "../api/teamApi"
import type { Team, TeamInvite } from "../types/team"
import { useLog } from "../contexts/LogContext"

export const useTeams = (hackathonSlug?: string) => {
  return useQuery({
    queryKey: ["teams", hackathonSlug],
    queryFn: () => getTeams(hackathonSlug)
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
