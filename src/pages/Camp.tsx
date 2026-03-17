import { useSearchParams, useNavigate } from "react-router-dom"
import { useTeams, useUpdateTeam } from "../hooks/useTeams"
import { Link } from "react-router-dom"
import { useUser } from "../contexts/UserContext"

export default function Camp() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const slug = params.get("hackathon") || undefined

  const { data: teams, isLoading } = useTeams(slug)
  const mutation = useUpdateTeam()
  const { user } = useUser()

  const handleToggleOpen = (teamCode: string, currentIsOpen: boolean) => {
    mutation.mutate({ teamCode, updates: { isOpen: !currentIsOpen } })
  }

  if (isLoading) return <div>Loading...</div>

  return (
    <div style={{ padding: "20px" }}>
      <button 
        onClick={() => navigate('/')}
        style={{ 
          padding: 10,
          marginBottom: 20,
          backgroundColor: "#6c757d",
          color: "white",
          border: "none",
          borderRadius: 4,
          cursor: "pointer",
          fontSize: 14
        }}
      >
        ← 메인으로
      </button>
      <h1>팀 모집</h1>
      {slug && <p>해커톤: <strong>{slug}</strong> 필터링됨</p>}
      
      <Link to="/camp/new">
        <button style={{ marginBottom: "20px" }}>팀 모집글 생성</button>
      </Link>

      <div style={{ display: "grid", gap: "20px" }}>
        {teams?.map((team) => {
          // user가 있고, team.authorId와 일치할 때만 본인으로 간주
          const isAuthor = user && user.id === team.authorId
          
          return (
            <div key={team.teamCode} style={{ border: "1px solid #ccc", padding: "15px", borderRadius: "8px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
                <div>
                  <span style={{ fontSize: "0.8rem", color: "#888" }}>{team.teamCode}</span>
                  <h3>{team.name} ({team.memberCount}명)</h3>
                </div>
                <span style={{ 
                  padding: "4px 8px", 
                  borderRadius: "4px", 
                  backgroundColor: team.isOpen ? "#e6fffa" : "#fff5f5",
                  color: team.isOpen ? "#2c7a7b" : "#c53030",
                  fontSize: "0.8rem",
                  fontWeight: "bold"
                }}>
                  {team.isOpen ? "모집중" : "모집마감"}
                </span>
              </div>
              
              <p>{team.intro}</p>
              {team.hackathonSlug && (
                <p style={{ fontSize: "0.9rem", color: "#666" }}>
                  연결된 해커톤: <strong>{team.hackathonSlug}</strong>
                </p>
              )}
              <p><strong>모집 포지션:</strong> {team.lookingFor.length > 0 ? team.lookingFor.join(", ") : "없음"}</p>
              
              <div style={{ marginTop: "15px", display: "flex", gap: "10px" }}>
                {team.contact.url && (
                  <a href={team.contact.url} target="_blank" rel="noopener noreferrer">
                    <button>연락하기</button>
                  </a>
                )}
                
                {isAuthor && (
                  <>
                    <button 
                      onClick={() => handleToggleOpen(team.teamCode, team.isOpen)}
                      style={{ backgroundColor: team.isOpen ? "#fbd38d" : "#cbd5e0" }}
                    >
                      {team.isOpen ? "모집 마감하기" : "다시 모집하기"}
                    </button>

                    <Link to={`/camp/edit/${team.teamCode}`}>
                      <button style={{ backgroundColor: "#edf2f7", color: "#4a5568" }}>
                        수정
                      </button>
                    </Link>
                  </>
                )}
              </div>
            </div>
          )
        })}
        {teams?.length === 0 && <p>모집 중인 팀이 없습니다.</p>}
      </div>
    </div>
  )
}
