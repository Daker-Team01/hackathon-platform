import { useSearchParams } from "react-router-dom"
import { useTeams } from "../hooks/useTeams"
import { Link } from "react-router-dom"

export default function Camp() {

  // URL에서 ?hackathon=slug 가져오기
  const [params] = useSearchParams()
  const slug = params.get("hackathon") || undefined

  // React Query 호출
  const { data: teams, isLoading } = useTeams(slug)

  if (isLoading) return <div>Loading...</div>

  return (
    <div>
      <h1>팀 모집</h1>
      <Link to="/camp/new">
        <button>팀 모집글 생성</button>
      </Link>

      {teams?.map((team) => (
        <div key={team.id}>
          <h3>{team.name}</h3>
          <p>{team.description}</p>
          <p>모집 포지션: {team.lookingFor.join(", ")}</p>
        </div>
      ))}

    </div>
  )
}