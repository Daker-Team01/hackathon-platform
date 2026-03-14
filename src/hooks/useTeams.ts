import { useQuery } from "@tanstack/react-query"
import { getTeams } from "../api/teamApi"

export const useTeams = (hackathonSlug?: string) => {
  return useQuery({
    queryKey: ["teams", hackathonSlug],
    queryFn: () => getTeams(hackathonSlug)
  })
}