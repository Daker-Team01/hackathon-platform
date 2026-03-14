import { mockTeams } from "../data/mockTeams"
import type { Team } from "../types/team"

export const getTeams = async (hackathonSlug?: string): Promise<Team[]> => {

  await new Promise((resolve) => setTimeout(resolve, 500))

  if (!hackathonSlug) return mockTeams

  return mockTeams.filter(
    (team) => team.hackathonSlug === hackathonSlug
  )
}


export const createTeam = async (
  team: Omit<Team, "id" | "createdAt">
): Promise<Team> => {

  const newTeam: Team = {
    id: Date.now().toString(),
    createdAt: new Date().toISOString(),
    ...team
  }

  mockTeams.push(newTeam)

  return newTeam
}