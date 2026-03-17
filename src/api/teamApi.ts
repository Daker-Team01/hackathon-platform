import type { Team } from "../types/team"
import publicTeams from "../data/public_teams.json"

const LOCAL_STORAGE_KEY = "teams"

function parseTeamArray(raw: string): Team[] | null {
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as Team[]) : null
  } catch {
    return null
  }
}

function mergeSeedTeams(existing: Team[], seed: Team[]): Team[] {
  const merged = [...existing]
  const existingCodes = new Set(
    existing
      .map((team) => team.teamCode)
      .filter((teamCode): teamCode is string => typeof teamCode === "string")
  )

  for (const seedTeam of seed) {
    if (!existingCodes.has(seedTeam.teamCode)) {
      merged.push(seedTeam)
    }
  }

  return merged
}

const getStoredTeams = (): Team[] => {
  const stored = localStorage.getItem(LOCAL_STORAGE_KEY)
  if (stored) {
    const parsed = parseTeamArray(stored)
    if (parsed) {
      const merged = mergeSeedTeams(parsed, publicTeams as Team[])
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(merged))
      return merged
    }
  }

  const initialTeams = publicTeams as Team[]
  localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(initialTeams))
  return initialTeams
}

const saveTeams = (teams: Team[]) => {
  localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(teams))
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
  team: Omit<Team, "teamCode" | "createdAt">
): Promise<Team> => {
  const teams = getStoredTeams()
  const newTeam: Team = {
    teamCode: `T-${Date.now().toString().slice(-6)}`,
    createdAt: new Date().toISOString(),
    ...team
  }

  const updatedTeams = [newTeam, ...teams]
  saveTeams(updatedTeams)
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
