import { useState, useEffect, useRef, useMemo } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import { useCreateTeam } from "../hooks/useTeams"
import { useUser } from "../contexts/UserContext"
import type { Hackathon } from "../types/hackathon"
import { Button } from "../components/ui/button"
import { Label } from "../components/ui/label"

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
  const allHackathons = useMemo(() => getHackathonsFromStorage(), [])
  const hackathons = useMemo(() => allHackathons.filter(h => h.status !== "ended"), [allHackathons])
  const hasAlerted = useRef(false)

  const [name, setName] = useState("")
  const [intro, setIntro] = useState("")
  const [isOpen, setIsOpen] = useState(true)
  const [memberCount, setMemberCount] = useState(1)
  const [maxMembers, setMaxMembers] = useState(5)
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
      maxMembers,
      lookingFor: lookingFor ? lookingFor.split(",").map((v) => v.trim()) : [],
      contact: {
        type: "link",
        url: contactUrl
      },
      hackathonSlug: (hackathonSlug && hackathonSlug !== "none") ? hackathonSlug : undefined,
      leaderId: user.id,
      leaderName: user.nickname
    }, {
      onSuccess: () => {
        const finalSlug = (hackathonSlug && hackathonSlug !== "none") ? hackathonSlug : ""
        navigate(finalSlug ? `/camp?hackathon=${finalSlug}` : "/camp")
      }
    })
  }

  if (!isLoggedIn) return null

  // Common input classes for visibility and styling
  const inputClasses = "flex h-9 w-full rounded-md border border-input bg-input-background px-3 py-1 text-base transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm"
  const textareaClasses = "flex min-h-[80px] w-full rounded-md border border-input bg-input-background px-3 py-2 text-base transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm"

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">팀 모집글 생성</h1>
      
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="space-y-2">
          <Label>대상 해커톤 {initialHackathonSlug && "(고정)"}</Label>
          <select 
            value={hackathonSlug || "none"} 
            onChange={(e) => setHackathonSlug(e.target.value)}
            disabled={!!initialHackathonSlug}
            className={`${inputClasses} ${initialHackathonSlug ? "bg-muted cursor-not-allowed" : ""}`}
          >
            <option value="none">해커톤 미지정 (나중에 신청하기)</option>
            {hackathons?.map((h) => (
              <option key={h.slug} value={h.slug}>
                {h.title}
              </option>
            ))}
          </select>
          <p className="text-sm text-muted-foreground">
            {initialHackathonSlug 
              ? `* ${hackathons.find(h => h.slug === initialHackathonSlug)?.title || initialHackathonSlug} 해커톤 참여를 위해 팀을 생성합니다.`
              : "* 지금 해커톤을 고르지 않아도 팀을 먼저 생성하고 나중에 참여 신청을 할 수 있습니다."}
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="name">팀명 *</Label>
          <input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            placeholder="팀명을 입력하세요"
            className={inputClasses}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="intro">소개 *</Label>
          <textarea
            id="intro"
            value={intro}
            onChange={(e) => setIntro(e.target.value)}
            required
            rows={5}
            placeholder="팀과 프로젝트에 대해 소개해 주세요"
            className={textareaClasses}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="memberCount">현재 인원</Label>
            <input
              id="memberCount"
              type="number"
              value={memberCount}
              onChange={(e) => setMemberCount(Number(e.target.value))}
              min={1}
              className={inputClasses}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="maxMembers">모집 정원</Label>
            <input
              id="maxMembers"
              type="number"
              value={maxMembers}
              onChange={(e) => setMaxMembers(Number(e.target.value))}
              min={1}
              className={inputClasses}
            />
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <input
            id="isOpen"
            type="checkbox"
            checked={isOpen}
            onChange={(e) => setIsOpen(e.target.checked)}
            className="h-4 w-4 rounded border-input text-primary focus:ring-primary"
          />
          <Label htmlFor="isOpen">모집 중</Label>
        </div>

        <div className="space-y-2">
          <Label htmlFor="lookingFor">모집 포지션 (쉼표로 구분)</Label>
          <input
            id="lookingFor"
            value={lookingFor}
            onChange={(e) => setLookingFor(e.target.value)}
            placeholder="Frontend, Backend"
            className={inputClasses}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="contactUrl">연락 링크 (오픈카톡/구글폼 등)</Label>
          <input
            id="contactUrl"
            value={contactUrl}
            onChange={(e) => setContactUrl(e.target.value)}
            placeholder="https://..."
            className={inputClasses}
          />
        </div>

        <div className="flex gap-4 pt-4">
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? "생성 중..." : "생성"}
          </Button>
          <Button type="button" variant="secondary" onClick={() => navigate(-1)}>
            취소
          </Button>
        </div>
      </form>
    </div>
  )
}
