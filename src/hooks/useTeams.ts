import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { getTeams, updateTeam, getTeamByCode } from "../api/teamApi"

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

export const useUpdateTeam = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ teamCode, updates }: { teamCode: string; updates: any }) => updateTeam(teamCode, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["teams"] })
    }
  })
}
