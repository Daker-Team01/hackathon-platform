import { Link } from 'react-router-dom'

export default function Navbar() {
  return (
    <nav>
      <Link to="/">Home</Link>
      <Link to="/hackathons">Hackathons</Link>
      <Link to="/camp">Camp</Link>
      <Link to="/rankings">Rankings</Link>
      <Link to="/analytics">Analytics</Link>
    </nav>
  )
}