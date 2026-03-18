import { useState, useEffect, useRef, useMemo } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import { useCreateTeam } from "../hooks/useTeams"
import { useUser } from "../contexts/UserContext"
import type { Hackathon } from "../types/hackathon"

const HACKATHONS_STORAGE_KEY = "hackathons"

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

export default function CampCreate() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const initialHackathonSlug = params.get("hackathon") || ""
  const { user, isLoggedIn } = useUser()
  const mutation = useCreateTeam()
  const hackathons = useMemo(() => getHackathonsFromStorage(), [])
  const hasAlerted = useRef(false)

  const [name, setName] = useState("")
  const [intro, setIntro] = useState("")
  const [isOpen, setIsOpen] = useState(true)
  const [memberCount, setMemberCount] = useState(1)
  const [lookingFor, setLookingFor] = useState("")
  const [contactUrl, setContactUrl] = useState("")
  const [hackathonSlug, setHackathonSlug] = useState(initialHackathonSlug)

  useEffect(() => {
    if (!isLoggedIn && !hasAlerted.current) {
      hasAlerted.current = true
      alert("로그인이 필요한 서비스입니다.")
      navigate("/camp")
    }
  }, [isLoggedIn, navigate])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!user) return

    if (!name || !intro) {
      alert("팀명과 소개는 필수입니다.")
      return
    }

    mutation.mutate({
      name,
      intro,
      isOpen,
      memberCount,
      lookingFor: lookingFor ? lookingFor.split(",").map((v) => v.trim()) : [],
      contact: {
        type: "link",
        url: contactUrl
      },
      hackathonSlug: hackathonSlug || undefined,
      authorId: user.id,
      leaderName: user.nickname
    }, {
      onSuccess: () => {
        navigate(hackathonSlug ? `/camp?hackathon=${hackathonSlug}` : "/camp")
      }
    })
  }

  if (!isLoggedIn) return null

  return (
    <div style={{ padding: "20px" }}>
      <h1>팀 모집글 생성</h1>
      
      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: "15px" }}>
          <label>대상 해커톤 {initialHackathonSlug && "(고정)"}</label>
          <br />
          <select 
            value={hackathonSlug} 
            onChange={(e) => setHackathonSlug(e.target.value)}
            disabled={!!initialHackathonSlug}
            style={{ 
              width: "100%", 
              padding: "8px",
              backgroundColor: initialHackathonSlug ? "#f3f4f6" : "#fff",
              cursor: initialHackathonSlug ? "not-allowed" : "default"
            }}
          >
            <option value="">해커톤 미지정 (나중에 신청하기)</option>
            {hackathons?.map((h) => (
              <option key={h.slug} value={h.slug}>
                {h.title}
              </option>
            ))}
          </select>
          <p style={{ fontSize: "0.85rem", color: "#666", marginTop: "4px" }}>
            {initialHackathonSlug 
              ? `* ${hackathons.find(h => h.slug === initialHackathonSlug)?.title || initialHackathonSlug} 해커톤 참여를 위해 팀을 생성합니다.`
              : "* 지금 해커톤을 고르지 않아도 팀을 먼저 생성하고 나중에 참여 신청을 할 수 있습니다."}
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
          <label>연락 링크 (오픈카톡/구글폼 등)</label>
          <br />
          <input
            value={contactUrl}
            onChange={(event) => setContactUrl(event.target.value)}
            placeholder="https://..."
            style={{ width: "100%", marginBottom: "10px" }}
          />
        </div>

        <div style={{ marginTop: "20px" }}>
          <button type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? "생성 중..." : "생성"}
          </button>
          <button type="button" onClick={() => navigate(-1)} style={{ marginLeft: "10px", backgroundColor: "#eee", color: "#333" }}>
            취소
          </button>
        </div>
      </form>
    </div>
  )
}
