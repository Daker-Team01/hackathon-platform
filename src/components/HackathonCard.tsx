import { useNavigate } from 'react-router-dom'

export default function HackathonCard({ hackathon }: any) {

  const navigate = useNavigate()

  return (
    <div
      onClick={() => navigate(`/hackathons/${hackathon.slug}`)}
      style={{border:'1px solid gray',padding:20,margin:10}}
    >
      <h3>{hackathon.title}</h3>
      <p>{hackathon.status}</p>
      <p>{hackathon.startDate} ~ {hackathon.endDate}</p>
      <p>참가자 {hackathon.participants}</p>
    </div>
  )
}