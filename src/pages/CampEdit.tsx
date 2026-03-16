import { useState, useEffect, useRef } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { useTeam, useUpdateTeam, useDeleteTeam } from "../hooks/useTeams"
import { useUser } from "../contexts/UserContext"

export default function CampEdit() {
  const { id: teamCode } = useParams()
  const navigate = useNavigate()
  const { user } = useUser()
  const { data: team, isLoading } = useTeam(teamCode || "")
  const updateMutation = useUpdateTeam()
  const deleteMutation = useDeleteTeam()
  const hasAlerted = useRef(false)

  const [name, setName] = useState("")
  const [intro, setIntro] = useState("")
  const [isOpen, setIsOpen] = useState(true)
  const [memberCount, setMemberCount] = useState(1)
  const [lookingFor, setLookingFor] = useState("")
  const [contactUrl, setContactUrl] = useState("")

  useEffect(() => {
    if (team) {
      // 로그인 여부 먼저 확인
      if (!user) {
        if (!hasAlerted.current) {
          hasAlerted.current = true
          alert("로그인이 필요한 서비스입니다. 왼쪽 사이드바에서 로그인해 주세요.")
          navigate("/camp")
        }
        return
      }
      
      // 작성자 본인이 아니면 접근 차단
      if (user.id !== team.authorId) {
        if (!hasAlerted.current) {
          hasAlerted.current = true
          alert("작성자만 수정할 수 있습니다.")
          navigate("/camp")
        }
        return
      }

      setName(team.name)
      setIntro(team.intro)
      setIsOpen(team.isOpen)
      setMemberCount(team.memberCount)
      setLookingFor(team.lookingFor.join(", "))
      setContactUrl(team.contact.url)
    }
  }, [team, user, navigate])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!teamCode || !name || !intro) {
      alert("팀명과 소개는 필수입니다.")
      return
    }

    updateMutation.mutate({
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
    }, {
      onSuccess: () => {
        navigate("/camp")
      }
    })
  }

  const handleDelete = () => {
    if (!teamCode) return
    
    if (window.confirm("정말로 이 팀 모집글을 삭제하시겠습니까?")) {
      deleteMutation.mutate(teamCode, {
        onSuccess: () => {
          alert("삭제되었습니다.")
          navigate("/camp")
        }
      })
    }
  }

  if (isLoading) return <div style={{ padding: "20px" }}>Loading...</div>
  if (!team) return <div style={{ padding: "20px" }}>팀을 찾을 수 없습니다.</div>
  if (user?.id !== team.authorId) return null

  return (
    <div style={{ padding: "20px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1>팀 모집글 수정</h1>
        <button 
          onClick={handleDelete}
          style={{ backgroundColor: "#feb2b2", color: "#c53030", border: "none", padding: "8px 16px", borderRadius: "4px", cursor: "pointer" }}
          disabled={deleteMutation.isPending}
        >
          {deleteMutation.isPending ? "삭제 중..." : "글 삭제"}
        </button>
      </div>

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
          <button type="submit" disabled={updateMutation.isPending}>
            {updateMutation.isPending ? "저장 중..." : "수정 완료"}
          </button>
          <button type="button" onClick={() => navigate(-1)} style={{ marginLeft: "10px", backgroundColor: "#eee", color: "#333" }}>
            취소
          </button>
        </div>
      </form>
    </div>
  )
}
