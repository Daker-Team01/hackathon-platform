import ReactDOM from 'react-dom/client'
import { RouterProvider } from 'react-router-dom'
import { router } from './router/router'
import hackathonsData from './data/public_hackathons.json'
import teamsData from './data/public_teams.json'

const HACKATHONS_STORAGE_KEY = 'hackathons'
const TEAMS_STORAGE_KEY = 'teams'

const storedHackathons = localStorage.getItem(HACKATHONS_STORAGE_KEY)
if (storedHackathons === null) {
  localStorage.setItem(HACKATHONS_STORAGE_KEY, JSON.stringify(hackathonsData))
}

const storedTeams = localStorage.getItem(TEAMS_STORAGE_KEY)
if (storedTeams === null) {
  localStorage.setItem(TEAMS_STORAGE_KEY, JSON.stringify(teamsData))
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <RouterProvider router={router} />
)
