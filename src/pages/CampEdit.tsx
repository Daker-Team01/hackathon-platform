import { useState, useEffect, useRef, useMemo } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { useTeam, useUpdateTeam, useDeleteTeam } from "../hooks/useTeams"
import { useUser } from "../contexts/UserContext"
import type { Hackathon } from "../types/hackathon"
import { Button } from "../components/ui/button"
import { Label } from "../components/ui/label"

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
        hackathonSlug: (hackathonSlug && hackathonSlug !== "none") ? hackathonSlug : undefined
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

  if (isLoading) return <div className="p-8">Loading...</div>
  if (!team) return <div className="p-8">팀을 찾을 수 없습니다.</div>
  
  // 로그인하지 않았거나, 본인의 팀이 아닌 경우 즉시 차단
  if (!user || user.id !== team.authorId) {
    return null
  }

  // Common input classes for visibility and styling
  const inputClasses = "flex h-9 w-full rounded-md border border-input bg-input-background px-3 py-1 text-base transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm"
  const textareaClasses = "flex min-h-[80px] w-full rounded-md border border-input bg-input-background px-3 py-2 text-base transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm"

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">팀 모집글 수정</h1>
        <Button 
          variant="destructive"
          onClick={handleDelete}
          disabled={deleteMutation.isPending}
        >
          {deleteMutation.isPending ? "삭제 중..." : "글 삭제"}
        </Button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="p-4 border rounded-lg bg-background space-y-4">
          <div className="flex justify-between items-center">
            <Label className="font-bold">참여 해커톤 관리</Label>
            {hackathonSlug !== (team.hackathonSlug || "") && (
              <span className="text-xs text-destructive bg-destructive/10 px-2 py-1 rounded border border-destructive/20">
                변경됨 (저장 필요)
              </span>
            )}
          </div>
          
          <div className="mt-2">
            {hackathonSlug && !isChangingHackathon ? (
              <div className="flex items-center justify-between">
                <span>현재 참여 중: <strong>{hackathons.find(h => h.slug === hackathonSlug)?.title || hackathonSlug}</strong></span>
                <div className="space-x-2">
                  <Button 
                    type="button" 
                    variant="outline"
                    size="sm"
                    onClick={() => setIsChangingHackathon(true)}
                  >
                    변경
                  </Button>
                  <Button 
                    type="button" 
                    variant="destructive"
                    size="sm"
                    onClick={handleUnlinkHackathon}
                  >
                    연결 해제
                  </Button>
                </div>
              </div>
            ) : !hackathonSlug && !isChangingHackathon ? (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">연결된 해커톤이 없습니다 (미지정)</span>
                <Button 
                  type="button" 
                  variant="outline"
                  size="sm"
                  onClick={() => setIsChangingHackathon(true)}
                >
                  해커톤 연결하기
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                <select 
                  value={hackathonSlug || "none"} 
                  onChange={(e) => setHackathonSlug(e.target.value)}
                  className={inputClasses}
                >
                  <option value="none">해커톤 미지정</option>
                  {hackathons?.map((h) => (
                    <option key={h.slug} value={h.slug}>
                      {h.title}
                    </option>
                  ))}
                </select>
                <div className="flex gap-2">
                  <Button 
                    type="button" 
                    size="sm"
                    onClick={() => setIsChangingHackathon(false)}
                  >
                    확인
                  </Button>
                  <Button 
                    type="button" 
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setIsChangingHackathon(false)
                      setHackathonSlug(team.hackathonSlug || "")
                    }}
                  >
                    취소 (되돌리기)
                  </Button>
                </div>
              </div>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            * 해커톤을 변경하거나 해제한 후 하단의 <strong>[수정 완료]</strong> 버튼을 눌러야 최종 저장됩니다.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="name">팀명 *</Label>
          <input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
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
            className={textareaClasses}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="memberCount">팀원 수</Label>
          <input
            id="memberCount"
            type="number"
            value={memberCount}
            onChange={(e) => setMemberCount(Number(e.target.value))}
            min={1}
            className={`${inputClasses} w-32`}
          />
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
          <Label htmlFor="contactUrl">연락 링크</Label>
          <input
            id="contactUrl"
            value={contactUrl}
            onChange={(e) => setContactUrl(e.target.value)}
            placeholder="https://..."
            className={inputClasses}
          />
        </div>

        <div className="flex gap-4 pt-4">
          <Button type="submit" disabled={updateMutation.isPending}>
            {updateMutation.isPending ? "저장 중..." : "수정 완료"}
          </Button>
          <Button type="button" variant="secondary" onClick={() => navigate(-1)}>
            취소
          </Button>
        </div>
      </form>
    </div>
  )
}
