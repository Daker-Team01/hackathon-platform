import { createBrowserRouter, Outlet } from 'react-router-dom'
import App from '../App'
import Home from '../pages/Home'
import Hackathons from '../pages/Hackathons'
import HackathonDetail from '../pages/HackathonDetail'
import Camp from '../pages/Camp'
import Rankings from '../pages/Rankings'
import CampCreate from "../pages/CampCreate"
import CampEdit from "../pages/CampEdit"
import Analytics from "../pages/Analytics"
import TeamManagement from "../pages/TeamManagement"
import Matcher from '../pages/Matcher'

export const router = createBrowserRouter([
  {
    path: '/',
    element: (
      <App>
        <Outlet />
      </App>
    ),
    children: [
      { index: true, element: <Home /> },
      { path: 'hackathons', element: <Hackathons /> },
      { path: 'hackathons/:slug', element: <HackathonDetail /> },
      { path: 'camp', element: <Camp /> },
      { path: 'rankings', element: <Rankings /> },
      { path: "camp/new", element: <CampCreate /> },
      { path: "camp/edit/:id", element: <CampEdit /> },
      { path: "analytics", element: <Analytics /> },
      { path: "team/:teamCode/manage", element: <TeamManagement /> },
      { path: 'matcher', element: <Matcher /> }
    ]
  }
])
