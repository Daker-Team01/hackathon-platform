import type { Team } from "../types/team"
import publicTeams from "../data/public_teams.json"

const LOCAL_STORAGE_KEY = "hackathon_teams"

const getStoredTeams = (): Team[] => {
  const stored = localStorage.getItem(LOCAL_STORAGE_KEY)
  if (stored) {
    return JSON.parse(stored)
  }
  
  // 초기 데이터가 없는 경우 public_teams.json에서 가져오기
  // authorId가 없는 초기 데이터들에 대해 기본값 '1'(Alice) 부여
  const initialTeams = (publicTeams as any[]).map(team => ({
    ...team,
    authorId: team.authorId || "1"
  })) as Team[]
  
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
