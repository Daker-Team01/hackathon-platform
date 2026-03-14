import { createBrowserRouter } from 'react-router-dom'
import Home from '../pages/Home'
import Hackathons from '../pages/Hackathons'
import HackathonDetail from '../pages/HackathonDetail'
import Camp from '../pages/Camp'
import Rankings from '../pages/Rankings'
import CampCreate from "../pages/CampCreate"

export const router = createBrowserRouter([
  { path: '/', element: <Home /> },
  { path: '/hackathons', element: <Hackathons /> },
  { path: '/hackathons/:slug', element: <HackathonDetail /> },
  { path: '/camp', element: <Camp /> },
  { path: '/rankings', element: <Rankings /> },
  { path: "/camp/new", element: <CampCreate /> }
])