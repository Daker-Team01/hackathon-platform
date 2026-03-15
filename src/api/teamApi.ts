import { mockTeams } from "../data/mockTeams"
import type { Team } from "../types/team"

export const getTeams = async (hackathonSlug?: string): Promise<Team[]> => {
  await new Promise((resolve) => setTimeout(resolve, 500))

  if (!hackathonSlug) return mockTeams

  return mockTeams.filter((team) => team.hackathonSlug === hackathonSlug)
}

export const getTeamByCode = async (code: string): Promise<Team | undefined> => {
  await new Promise((resolve) => setTimeout(resolve, 300))
  return mockTeams.find((team) => team.teamCode === code)
}

export const createTeam = async (
  team: Omit<Team, "teamCode" | "createdAt">
): Promise<Team> => {
  const newTeam: Team = {
    teamCode: `T-${Date.now().toString().slice(-6)}`,
    createdAt: new Date().toISOString(),
    ...team
  }

  mockTeams.push(newTeam)
  return newTeam
}

export const updateTeam = async (
  teamCode: string,
  updates: Partial<Omit<Team, "teamCode" | "createdAt">>
): Promise<Team> => {
  const index = mockTeams.findIndex((t) => t.teamCode === teamCode)
  if (index === -1) throw new Error("Team not found")

  mockTeams[index] = { ...mockTeams[index], ...updates }
  return mockTeams[index]
}
