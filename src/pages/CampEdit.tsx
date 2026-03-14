import { useState, useEffect } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { useTeam, useUpdateTeam } from "../hooks/useTeams"

export default function CampEdit() {
  const { id: teamCode } = useParams()
  const navigate = useNavigate()
  const { data: team, isLoading } = useTeam(teamCode || "")
  const mutation = useUpdateTeam()

  const [name, setName] = useState("")
  const [intro, setIntro] = useState("")
  const [isOpen, setIsOpen] = useState(true)
  const [memberCount, setMemberCount] = useState(1)
  const [lookingFor, setLookingFor] = useState("")
  const [contactUrl, setContactUrl] = useState("")

  useEffect(() => {
    if (team) {
      setName(team.name)
      setIntro(team.intro)
      setIsOpen(team.isOpen)
      setMemberCount(team.memberCount)
      setLookingFor(team.lookingFor.join(", "))
      setContactUrl(team.contact.url)
    }
  }, [team])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!teamCode || !name || !intro) {
      alert("팀명과 소개는 필수입니다.")
      return
    }

    await mutation.mutateAsync({
      teamCode,
      updates: {
        name,
        intro,
        isOpen,
        memberCount,
        lookingFor: lookingFor ? lookingFor.split(",").map((v) => v.trim()) : [],
        contact: {
          type: "link",
          url: contactUrl
        }
      }
    })

    navigate("/camp")
  }

  if (isLoading) return <div>Loading...</div>
  if (!team) return <div>팀을 찾을 수 없습니다.</div>

  return (
    <div style={{ padding: "20px" }}>
      <h1>팀 모집글 수정</h1>

      <form onSubmit={handleSubmit}>
        <div>
          <label>팀명 *</label>
          <br />
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            style={{ width: "100%", marginBottom: "10px" }}
          />
        </div>

        <div>
          <label>소개 *</label>
          <br />
          <textarea
            value={intro}
            onChange={(e) => setIntro(e.target.value)}
            required
            rows={5}
            style={{ width: "100%", marginBottom: "10px" }}
          />
        </div>

        <div>
          <label>팀원 수</label>
          <br />
          <input
            type="number"
            value={memberCount}
            onChange={(e) => setMemberCount(Number(e.target.value))}
            min={1}
            style={{ marginBottom: "10px" }}
          />
        </div>

        <div>
          <label>
            <input
              type="checkbox"
              checked={isOpen}
              onChange={(e) => setIsOpen(e.target.checked)}
            />
            모집 중
          </label>
        </div>

        <div style={{ marginTop: "10px" }}>
          <label>모집 포지션 (쉼표로 구분)</label>
          <br />
          <input
            value={lookingFor}
            onChange={(e) => setLookingFor(e.target.value)}
            placeholder="Frontend, Backend"
            style={{ width: "100%", marginBottom: "10px" }}
          />
        </div>

        <div>
          <label>연락 링크</label>
          <br />
          <input
            value={contactUrl}
            onChange={(e) => setContactUrl(e.target.value)}
            placeholder="https://..."
            style={{ width: "100%", marginBottom: "10px" }}
          />
        </div>

        <div style={{ marginTop: "20px" }}>
          <button type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? "저장 중..." : "수정 완료"}
          </button>
          <button type="button" onClick={() => navigate(-1)} style={{ marginLeft: "10px", backgroundColor: "#eee", color: "#333" }}>
            취소
          </button>
        </div>
      </form>
    </div>
  )
}
