import { useState, useEffect, useRef, useMemo } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { useTeam, useUpdateTeam, useDeleteTeam } from "../hooks/useTeams"
import { useUser } from "../contexts/UserContext"
import type { Hackathon } from "../types/hackathon"

const HACKATHONS_STORAGE_KEY = "hackathons"
const SUBMISSIONS_STORAGE_KEY = "submissions"

function getHackathonsFromStorage(): Hackathon[] {
  const raw = localStorage.getItem(HACKATHONS_STORAGE_KEY)
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as Hackathon[]) : []
  } catch {
    return []
  }
}

function hasSubmission(teamId: string, hackathonSlug: string): boolean {
  const raw = localStorage.getItem(SUBMISSIONS_STORAGE_KEY)
  if (!raw) return false
  try {
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return false
    return parsed.some((s: any) => s.teamId === teamId && s.hackathonSlug === hackathonSlug)
  } catch {
    return false
  }
}

export default function CampEdit() {
  const { id: teamCode } = useParams()
  const navigate = useNavigate()
  const { user } = useUser()
  const { data: team, isLoading } = useTeam(teamCode || "")
  const hackathons = useMemo(() => getHackathonsFromStorage(), [])
  const updateMutation = useUpdateTeam()
  const deleteMutation = useDeleteTeam()
  const hasAlerted = useRef(false)

  const [name, setName] = useState("")
  const [intro, setIntro] = useState("")
  const [isOpen, setIsOpen] = useState(true)
  const [memberCount, setMemberCount] = useState(1)
  const [lookingFor, setLookingFor] = useState("")
  const [contactUrl, setContactUrl] = useState("")
  const [hackathonSlug, setHackathonSlug] = useState("")
  const [isChangingHackathon, setIsChangingHackathon] = useState(false)

  useEffect(() => {
    if (team) {
      if (!user) {
        if (!hasAlerted.current) {
          hasAlerted.current = true
          alert("로그인이 필요한 서비스입니다. 왼쪽 사이드바에서 로그인해 주세요.")
          navigate("/camp")
        }
        return
      }
      
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
      setHackathonSlug(team.hackathonSlug || "")
    }
  }, [team, user, navigate])

  const handleUnlinkHackathon = () => {
    if (!team) return
    
    if (team.hackathonSlug && hasSubmission(team.teamCode, team.hackathonSlug)) {
      if (!window.confirm("이미 제출한 결과물이 있습니다. 해커톤 연결을 해제하면 제출 데이터가 관리에서 누락될 수 있습니다. 계속하시겠습니까?")) {
        return
      }
    } else {
      if (!window.confirm("이 해커톤 참여를 취소하시겠습니까?")) {
        return
      }
    }
    
    setHackathonSlug("")
    setIsChangingHackathon(false)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!teamCode || !name || !intro) {
      alert("팀명과 소개는 필수입니다.")
      return
    }

    // 해커톤이 변경되는 경우 경고
    if (team?.hackathonSlug && hackathonSlug !== team.hackathonSlug) {
      if (hasSubmission(team.teamCode, team.hackathonSlug)) {
        if (!window.confirm("이미 제출한 결과물이 있습니다. 해커톤을 변경하면 기존 제출 데이터가 더 이상 표시되지 않을 수 있습니다. 정말 변경하시겠습니까?")) {
          return
        }
      }
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
        },
        hackathonSlug: hackathonSlug || undefined
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
        <div style={{ marginBottom: "20px", padding: "15px", border: "1px solid #e2e8f0", borderRadius: "8px", backgroundColor: "#f8fafc" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <label style={{ fontWeight: "bold" }}>참여 해커톤 관리</label>
            {hackathonSlug !== (team.hackathonSlug || "") && (
              <span style={{ fontSize: "0.75rem", color: "#e53e3e", backgroundColor: "#fff5f5", padding: "2px 6px", borderRadius: "4px", border: "1px solid #feb2b2" }}>
                변경됨 (저장 필요)
              </span>
            )}
          </div>
          
          <div style={{ marginTop: "10px" }}>
            {hackathonSlug && !isChangingHackathon ? (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span>현재 참여 중: <strong>{hackathons.find(h => h.slug === hackathonSlug)?.title || hackathonSlug}</strong></span>
                <div>
                  <button 
                    type="button" 
                    onClick={() => setIsChangingHackathon(true)}
                    style={{ fontSize: "0.85rem", padding: "5px 10px", backgroundColor: "#edf2f7", color: "#4a5568" }}
                  >
                    변경
                  </button>
                  <button 
                    type="button" 
                    onClick={handleUnlinkHackathon}
                    style={{ fontSize: "0.85rem", padding: "5px 10px", backgroundColor: "#fff5f5", color: "#c53030", marginLeft: "5px" }}
                  >
                    연결 해제
                  </button>
                </div>
              </div>
            ) : !hackathonSlug && !isChangingHackathon ? (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ color: "#a0aec0" }}>연결된 해커톤이 없습니다 (미지정)</span>
                <button 
                  type="button" 
                  onClick={() => setIsChangingHackathon(true)}
                  style={{ fontSize: "0.85rem", padding: "5px 10px", backgroundColor: "#ebf8ff", color: "#2b6cb0" }}
                >
                  해커톤 연결하기
                </button>
              </div>
            ) : (
              <div>
                <select 
                  value={hackathonSlug} 
                  onChange={(e) => setHackathonSlug(e.target.value)}
                  style={{ width: "100%", padding: "8px", marginBottom: "5px" }}
                >
                  <option value="">해커톤 미지정</option>
                  {hackathons?.map((h) => (
                    <option key={h.slug} value={h.slug}>
                      {h.title}
                    </option>
                  ))}
                </select>
                <div style={{ display: "flex", gap: "5px" }}>
                  <button 
                    type="button" 
                    onClick={() => setIsChangingHackathon(false)}
                    style={{ fontSize: "0.85rem", padding: "5px 10px", backgroundColor: "#4a5568", color: "white" }}
                  >
                    확인
                  </button>
                  <button 
                    type="button" 
                    onClick={() => {
                      setIsChangingHackathon(false)
                      setHackathonSlug(team.hackathonSlug || "")
                    }}
                    style={{ fontSize: "0.85rem", padding: "5px 10px", backgroundColor: "#eee", color: "#333" }}
                  >
                    취소 (되돌리기)
                  </button>
                </div>
              </div>
            )}
          </div>
          <p style={{ fontSize: "0.85rem", color: "#666", marginTop: "8px", marginBottom: 0 }}>
            * 해커톤을 변경하거나 해제한 후 하단의 <strong>[수정 완료]</strong> 버튼을 눌러야 최종 저장됩니다.
          </p>
        </div>

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
