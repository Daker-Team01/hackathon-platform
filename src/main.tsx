import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { RouterProvider } from "react-router-dom"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"

import { router } from "./router/router"
import hackathonsData from "./data/public_hackathons.json"
import teamsData from "./data/public_teams.json"

const queryClient = new QueryClient()

const HACKATHONS_STORAGE_KEY = "hackathons"
const TEAMS_STORAGE_KEY = "teams"

const storedHackathons = localStorage.getItem(HACKATHONS_STORAGE_KEY)
if (storedHackathons === null) {
  localStorage.setItem(HACKATHONS_STORAGE_KEY, JSON.stringify(hackathonsData))
}

const storedTeams = localStorage.getItem(TEAMS_STORAGE_KEY)
if (storedTeams === null) {
  localStorage.setItem(TEAMS_STORAGE_KEY, JSON.stringify(teamsData))
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>
)