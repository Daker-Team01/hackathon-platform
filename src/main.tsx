import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { RouterProvider } from "react-router-dom"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"

import App from "./App"
import { router } from "./router/router"
import { ChatProvider } from "./contexts/ChatContext"
import { UserProvider } from "./contexts/UserContext"
import { LogProvider } from "./contexts/LogContext"
import hackathonsData from "./data/public_hackathons.json"
import teamsData from "./data/public_teams.json"
import type { Team } from "./types/team"

const queryClient = new QueryClient()

const HACKATHONS_STORAGE_KEY = "hackathons"
const TEAMS_STORAGE_KEY = "teams"

function parseTeams(raw: string): Team[] | null {
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

const storedHackathons = localStorage.getItem(HACKATHONS_STORAGE_KEY)
if (storedHackathons === null) {
  localStorage.setItem(HACKATHONS_STORAGE_KEY, JSON.stringify(hackathonsData))
}

const storedTeams = localStorage.getItem(TEAMS_STORAGE_KEY)
if (storedTeams === null) {
  localStorage.setItem(TEAMS_STORAGE_KEY, JSON.stringify(teamsData))
} else {
  const parsedStoredTeams = parseTeams(storedTeams)
  if (parsedStoredTeams === null) {
    localStorage.setItem(TEAMS_STORAGE_KEY, JSON.stringify(teamsData))
  } else {
    const mergedTeams = mergeSeedTeams(parsedStoredTeams, teamsData as Team[])
    localStorage.setItem(TEAMS_STORAGE_KEY, JSON.stringify(mergedTeams))
  }
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <ChatProvider>
        <UserProvider>
          <LogProvider>
            <App>
              <RouterProvider router={router} />
            </App>
          </LogProvider>
        </UserProvider>
      </ChatProvider>
    </QueryClientProvider>
  </StrictMode>
)
