import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { RouterProvider } from "react-router-dom"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"

import "./styles/tailwind.css"
import "./styles/theme.css"
import "./styles/index.css"

import { router } from "./router/router"
import { ChatProvider } from "./contexts/ChatContext"
import { UserProvider } from "./contexts/UserContext"
import { LogProvider } from "./contexts/LogContext"
import teamsData from "./data/team_dummy_data.json"
import { HACKATHON_DATA_VERSION, normalizedHackathons } from "./lib/hackathonData"

const queryClient = new QueryClient()

const HACKATHONS_STORAGE_KEY = "hackathons"
const HACKATHONS_VERSION_KEY = "hackathons_data_version"
const TEAMS_STORAGE_KEY = "teams"

const storedHackathonsVersion = localStorage.getItem(HACKATHONS_VERSION_KEY)
if (storedHackathonsVersion !== HACKATHON_DATA_VERSION) {
  localStorage.setItem(HACKATHONS_STORAGE_KEY, JSON.stringify(normalizedHackathons))
  localStorage.setItem(HACKATHONS_VERSION_KEY, HACKATHON_DATA_VERSION)
}

const storedTeams = localStorage.getItem(TEAMS_STORAGE_KEY)
if (storedTeams === null) {
  localStorage.setItem(TEAMS_STORAGE_KEY, JSON.stringify(teamsData))
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <ChatProvider>
        <UserProvider>
          <LogProvider>
            <RouterProvider router={router} />
          </LogProvider>
        </UserProvider>
      </ChatProvider>
    </QueryClientProvider>
  </StrictMode>
)
