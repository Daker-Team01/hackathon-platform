import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { getTeams, updateTeam, getTeamByCode, deleteTeam, createTeam } from "../api/teamApi"
import type { Team } from "../types/team"

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
  return useMutation({
    mutationFn: (team: Omit<Team, "teamCode" | "createdAt">) => createTeam(team),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["teams"] })
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
