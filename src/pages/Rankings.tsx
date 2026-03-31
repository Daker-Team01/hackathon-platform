import { useState, useEffect, useMemo } from "react"
import { useNavigate } from 'react-router-dom'
import { Trophy, Medal, Award, TrendingUp, Star, Crown, ArrowLeft, Users, Zap, Search, X, ChevronDown, ChevronUp, MessageCircle } from "lucide-react"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { allUsers, useUser } from '../contexts/UserContext'
import { normalizedHackathons as hackathonData } from '../lib/hackathonData'
import { useDmRequests } from '../contexts/DmRequestContext'
import { useChat } from '../contexts/ChatContext'
import { supabase } from '../lib/supabase'
import { buildActivityScoreMap } from '../lib/activityScore'
import { ALL_TECH_STACK_OPTIONS } from '../lib/userProfileOptions'
import type { EventLog } from '../types/log'
import type { UserWorkStyle } from '../contexts/UserContext'

interface RankingUser {
  rank: number
  id: string
  userId: string
  nickname: string
  points: number
  reputation: number
  activityScore: number
  primaryRole: string
  avatar?: string
  techStack: string[]
  personalityTags: string[]
  preferredRoles: string[]
  workStyle: UserWorkStyle
}

interface RankingData {
  all: RankingUser[]
  days30: RankingUser[]
  days7: RankingUser[]
}

const AVATARS = ["👑", "🧙", "🥷", "🤖", "🦸", "🎯", "🚀", "💡", "⚡", "🔥"]
const WORK_STYLE_LABELS: Record<string, string> = {
  high: '높음',
  medium: '보통',
  low: '낮음'
}

const PAGE_SIZE = 10
const FILTER_SHOW_LIMIT = 8

/* ─── 유저 상세 모달 ─── */
function UserInfoModal({ user, open, onClose }: { user: RankingUser | null; open: boolean; onClose: () => void }) {
  const { user: currentUser } = useUser()
  const { sendDmRequest, hasSentPendingRequest } = useDmRequests()
  const { getOrCreateDirectRoomWithUser, findDirectRoomWithUser } = useChat()
  const [isLoading, setIsLoading] = useState(false)
  const [existingDirectRoomId, setExistingDirectRoomId] = useState<string | null>(null)

  const normalizeIdentity = (value?: string | null) => (value ?? '').trim().toLowerCase()
  const targetUserId = user?.userId ?? ''
  const targetUserInternalId = user?.id ?? ''
  const isSelf = currentUser
    ? [normalizeIdentity(currentUser.userId), normalizeIdentity(currentUser.id)].some(
        (currentIdentity) =>
          currentIdentity.length > 0 &&
          (currentIdentity === normalizeIdentity(targetUserId) || currentIdentity === normalizeIdentity(targetUserInternalId))
      )
    : false
  const alreadySent = currentUser && targetUserId ? hasSentPendingRequest(currentUser.userId, targetUserId) : false

  useEffect(() => {
    if (!open || !currentUser || !user || isSelf) {
      setExistingDirectRoomId(null)
      return
    }

    let cancelled = false

    void findDirectRoomWithUser(currentUser.userId, user.userId)
      .then((roomId) => {
        if (!cancelled) {
          setExistingDirectRoomId(roomId)
        }
      })
      .catch((error) => {
        console.error('Failed to resolve direct room in Rankings modal:', error)
        if (!cancelled) {
          setExistingDirectRoomId(null)
        }
      })

    return () => {
      cancelled = true
    }
  }, [currentUser, findDirectRoomWithUser, isSelf, open, user])

  const hasExistingDirectRoom = Boolean(existingDirectRoomId)

  const handleChatRequest = async () => {
    if (!currentUser || !user) return
    try {
      setIsLoading(true)
      await sendDmRequest(currentUser.userId, currentUser.nickname, user.userId, user.nickname)
      alert('채팅 신청을 보냈습니다!')
    } catch (error) {
      console.error('Failed to send chat request:', error)
      alert(error instanceof Error ? error.message : '채팅 신청 전송에 실패했습니다.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleNavigateToChat = async () => {
    if (!currentUser || !user) return
    setIsLoading(true)
    try {
      const roomId = await getOrCreateDirectRoomWithUser(
        currentUser.userId,
        currentUser.nickname,
        user.userId,
        user.nickname
      )
      if (roomId) {
        // sessionStorage에 room id 저장해서 ChatPanel이 감지하도록
        sessionStorage.setItem('nextDirectRoomId', roomId)
        // ChatPanel을 open하도록 신호
        sessionStorage.setItem('openChatPanel', 'true')
        // 커스텀 이벤트 발생 (같은 탭에서 변경사항 감지용)
        window.dispatchEvent(new Event('sessionStorageChanged'))
        onClose()
      }
    } finally {
      setIsLoading(false)
    }
  }

  if (!user) return null

  const activityPct = Math.round(user.activityScore * 100)

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md w-full rounded-2xl p-0 overflow-hidden">
        {/* 헤더 영역 */}
        <div className="bg-gradient-to-br from-indigo-50 via-blue-50 to-purple-50 px-6 pt-6 pb-5 border-b border-gray-100">
          <DialogHeader>
            <div className="flex items-center gap-4">
              <div className="text-4xl w-16 h-16 bg-white rounded-2xl flex items-center justify-center shadow-sm border border-gray-100 flex-shrink-0">
                {user.avatar}
              </div>
              <div className="min-w-0">
                <DialogTitle className="text-xl font-bold text-gray-900 truncate">
                  {user.nickname}
                </DialogTitle>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <Badge className="bg-indigo-100 text-indigo-700 border-indigo-200 text-xs">
                    #{user.rank} 위
                  </Badge>
                  {user.preferredRoles[0] && (
                    <Badge variant="outline" className="text-xs text-gray-500 border-gray-200">
                      {user.preferredRoles[0]}
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          </DialogHeader>
        </div>

        {/* 본문 */}
        <div className="px-6 py-5 space-y-5">
          {/* 점수 요약 */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-yellow-50 rounded-xl p-3 text-center border border-yellow-100">
              <div className="text-lg font-black text-gray-900">{user.points.toLocaleString()}</div>
              <div className="text-xs text-gray-500 mt-0.5">총 포인트</div>
            </div>
            <div className="bg-blue-50 rounded-xl p-3 text-center border border-blue-100">
              <div className="flex items-center justify-center gap-0.5 text-lg font-black text-gray-900">
                <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                {user.reputation.toFixed(1)}
              </div>
              <div className="text-xs text-gray-500 mt-0.5">평판</div>
            </div>
            <div className="bg-green-50 rounded-xl p-3 text-center border border-green-100">
              <div className="text-lg font-black text-gray-900">{activityPct}점</div>
              <div className="text-xs text-gray-500 mt-0.5">활동점수</div>
            </div>
          </div>

          {/* 활동점수 바 */}
          <div>
            <div className="flex justify-between text-xs text-gray-500 mb-1.5">
              <span className="flex items-center gap-1"><TrendingUp className="w-3 h-3 text-green-500" />활동점수</span>
              <span className="font-semibold text-gray-700">{activityPct} / 100</span>
            </div>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-green-400 to-emerald-500 rounded-full transition-all"
                style={{ width: `${activityPct}%` }}
              />
            </div>
          </div>

          <div>
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">협업 스타일</div>
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-center">
                <div className="text-[11px] text-slate-500 mb-1">소통</div>
                <div className="text-sm font-bold text-slate-900">
                  {WORK_STYLE_LABELS[user.workStyle.communication] ?? user.workStyle.communication}
                </div>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-center">
                <div className="text-[11px] text-slate-500 mb-1">리더십</div>
                <div className="text-sm font-bold text-slate-900">
                  {WORK_STYLE_LABELS[user.workStyle.leadership] ?? user.workStyle.leadership}
                </div>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-center">
                <div className="text-[11px] text-slate-500 mb-1">실행력</div>
                <div className="text-sm font-bold text-slate-900">
                  {WORK_STYLE_LABELS[user.workStyle.execution] ?? user.workStyle.execution}
                </div>
              </div>
            </div>
          </div>

          {/* 선호 역할 */}
          {user.preferredRoles.length > 0 && (
            <div>
              <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">선호 역할</div>
              <div className="flex flex-wrap gap-1.5">
                {user.preferredRoles.map((role) => (
                  <Badge key={role} className="bg-indigo-100 text-indigo-700 border-indigo-200 text-xs font-medium">
                    {role}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* 성격 태그 */}
          {user.personalityTags.length > 0 && (
            <div>
              <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">성격 태그</div>
              <div className="flex flex-wrap gap-1.5">
                {user.personalityTags.map((tag) => (
                  <Badge key={tag} variant="outline" className="text-xs border-purple-200 text-purple-700 bg-purple-50">
                    # {tag}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* 기술 스택 */}
          {user.techStack.length > 0 && (
            <div>
              <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">기술 스택</div>
              <div className="flex flex-wrap gap-1.5">
                {user.techStack.map((s) => (
                  <Badge key={s} variant="outline" className="text-xs border-blue-200 text-blue-700 bg-blue-50 font-mono">
                    {s}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* 채팅 버튼 */}
          {currentUser && !isSelf && (
            <>
              {hasExistingDirectRoom ? (
                <Button
                  onClick={handleNavigateToChat}
                  disabled={isLoading}
                  className="w-full mt-1 gap-2 bg-green-600 hover:bg-green-700 text-white"
                >
                  <MessageCircle className="w-4 h-4" />
                  {isLoading ? '로딩 중...' : '채팅방으로 이동하기'}
                </Button>
              ) : (
                <Button
                  onClick={handleChatRequest}
                  disabled={alreadySent || isLoading}
                  variant={alreadySent ? 'outline' : 'default'}
                  className={`w-full mt-1 gap-2 ${
                    alreadySent || isLoading ? 'text-gray-400 border-gray-200' : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                  }`}
                >
                  <MessageCircle className="w-4 h-4" />
                  {isLoading ? '전송 중...' : alreadySent ? '✓ 채팅 신청함' : '채팅 신청하기'}
                </Button>
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default function Rankings() {
  const navigate = useNavigate()

  const [filter, setFilter] = useState<keyof RankingData>("all")
  const [rankingData, setRankingData] = useState<RankingData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)

  /* ─── 검색/필터 상태 ─── */
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedStacks, setSelectedStacks] = useState<string[]>([])
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [selectedRoles, setSelectedRoles] = useState<string[]>([])
  const [showMoreStacks, setShowMoreStacks] = useState(false)
  const [showMoreTags, setShowMoreTags] = useState(false)
  const [showMoreRoles, setShowMoreRoles] = useState(false)
  const [selectedUser, setSelectedUser] = useState<RankingUser | null>(null)

  // 통계 수치 (더미 데이터 기반)
  const totalParticipations = allUsers.reduce((sum, u) => sum + u.participations.length, 0)
  const totalHackathons = hackathonData.length

  /* ─── 필터 옵션 (빈도순) ─── */
  const allTechStacks = ALL_TECH_STACK_OPTIONS

  const allPersonalityTags = useMemo(() => {
    const counts = new Map<string, number>()
    allUsers.forEach((u) => u.personalityTags.forEach((t) => counts.set(t, (counts.get(t) ?? 0) + 1)))
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([t]) => t)
  }, [])

  const allRoles = useMemo(() => {
    const counts = new Map<string, number>()
    allUsers.forEach((u) => u.preferredRoles.forEach((r) => counts.set(r, (counts.get(r) ?? 0) + 1)))
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([r]) => r)
  }, [])

  const hasActiveFilter = searchQuery.trim() || selectedStacks.length > 0 || selectedTags.length > 0 || selectedRoles.length > 0

  const clearAllFilters = () => {
    setSearchQuery("")
    setSelectedStacks([])
    setSelectedTags([])
    setSelectedRoles([])
  }

  const toggleItem = (list: string[], set: (v: string[]) => void, item: string) => {
    set(list.includes(item) ? list.filter((v) => v !== item) : [...list, item])
  }

  useEffect(() => {
    let cancelled = false

    async function loadRankingData() {
      try {
        setError(null)

        const pageSize = 1000
        const maxLogs = 20000
        const allLogs: EventLog[] = []
        let from = 0

        while (allLogs.length < maxLogs) {
          const remaining = maxLogs - allLogs.length
          const currentPageSize = Math.min(pageSize, remaining)
          const { data, error } = await supabase
            .from('user_logs')
            .select('*')
            .order('created_at', { ascending: false })
            .range(from, from + currentPageSize - 1)

          if (error) {
            throw error
          }

          const rows = (data || []) as EventLog[]
          allLogs.push(...rows)

          if (rows.length < currentPageSize) {
            break
          }

          from += currentPageSize
        }

        if (cancelled) return

        const activityScoreAll = buildActivityScoreMap(allUsers, allLogs)
        const activityScore30 = buildActivityScoreMap(allUsers, allLogs, 30)
        const activityScore7 = buildActivityScoreMap(allUsers, allLogs, 7)

        const sorted = [...allUsers].sort((a, b) => {
          if (b.points !== a.points) return b.points - a.points

          const activityGap = (activityScoreAll.get(b.id) ?? b.activityScore) - (activityScoreAll.get(a.id) ?? a.activityScore)
          if (Math.abs(activityGap) > 0.0001) return activityGap

          return b.reputation - a.reputation
        })

        const toEntry = (
          user: typeof sorted[0],
          index: number,
          pointMultiplier: number,
          activityScoreMap: Map<string, number>
        ): RankingUser => ({
          rank: index + 1,
          id: user.id,
          userId: user.userId,
          nickname: user.nickname,
          points: Math.floor(user.points * pointMultiplier),
          reputation: user.reputation,
          activityScore: activityScoreMap.get(user.id) ?? activityScoreMap.get(user.userId) ?? user.activityScore,
          primaryRole: user.preferredRoles[0] ?? user.techStack[0] ?? '참여자',
          avatar: AVATARS[index % AVATARS.length],
          techStack: user.techStack,
          personalityTags: user.personalityTags,
          preferredRoles: user.preferredRoles,
          workStyle: user.workStyle,
        })

        const data: RankingData = {
          all: sorted.map((u, i) => toEntry(u, i, 1, activityScoreAll)),
          days30: sorted.map((u, i) => toEntry(u, i, 0.6, activityScore30)),
          days7: sorted.map((u, i) => toEntry(u, i, 0.3, activityScore7)),
        }

        if (cancelled) return

        setRankingData(data)
        setVisibleCount(PAGE_SIZE)
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : '랭킹 데이터를 불러오는 중 오류가 발생했습니다.')
        }
      }
    }

    void loadRankingData()

    return () => {
      cancelled = true
    }
  }, [])

  /* ─── 필터링된 유저 목록 ─── */
  const filteredUsers = useMemo(() => {
    if (!rankingData) return []
    let list = rankingData[filter]

    const q = searchQuery.trim().toLowerCase()
    if (q) list = list.filter((u) => u.nickname.toLowerCase().includes(q))

    if (selectedStacks.length > 0)
      list = list.filter((u) => selectedStacks.every((s) => u.techStack.includes(s)))

    if (selectedTags.length > 0)
      list = list.filter((u) => selectedTags.every((t) => u.personalityTags.includes(t)))

    if (selectedRoles.length > 0)
      list = list.filter((u) => selectedRoles.some((r) => u.preferredRoles.includes(r)))

    return list
  }, [rankingData, filter, searchQuery, selectedStacks, selectedTags, selectedRoles])

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1: return <Crown className="w-6 h-6 text-yellow-500" />
      case 2: return <Medal className="w-6 h-6 text-gray-400" />
      case 3: return <Award className="w-6 h-6 text-orange-600" />
      default: return <span className="text-lg font-bold text-gray-400">#{rank}</span>
    }
  }

  const getRankBg = (rank: number) => {
    if (rank === 1) return "bg-gradient-to-r from-yellow-50 to-yellow-100 border-yellow-200"
    if (rank === 2) return "bg-gradient-to-r from-gray-50 to-gray-100 border-gray-200"
    if (rank === 3) return "bg-gradient-to-r from-orange-50 to-orange-100 border-orange-200"
    return "bg-white border-gray-100"
  }

  const handleFilterChange = (next: keyof RankingData) => {
    setFilter(next)
    setVisibleCount(PAGE_SIZE)
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* Navigation */}
      <Button
        variant="ghost"
        onClick={() => navigate('/')}
        className="mb-6 hover:bg-gray-100 -ml-2 text-gray-600"
      >
        <ArrowLeft className="w-4 h-4 mr-2" />
        메인으로
      </Button>

      {/* Header */}
      <div className="mb-10">
        <h1 className="text-4xl font-extrabold text-gray-900 mb-4 tracking-tight flex items-center gap-3">
          <Trophy className="w-10 h-10 text-yellow-500" />
          User Rankings
        </h1>
        <p className="text-gray-600 text-lg max-w-2xl">
          전체 해커톤 참가자들의 실력을 확인하고 당신의 위치를 파악해보세요.
        </p>
      </div>

      {error ? (
        <Card className="p-12 text-center bg-red-50 border-red-100">
          <div className="text-5xl mb-4">⚠️</div>
          <h2 className="text-2xl font-bold text-red-900 mb-2">오류가 발생했습니다</h2>
          <p className="text-red-700 mb-6">{error}</p>
          <Button variant="destructive" onClick={() => window.location.reload()}>
            다시 시도
          </Button>
        </Card>
      ) : rankingData ? (
        <>
          {/* Stats Overview */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
            <Card className="p-6 bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-100 shadow-sm text-center">
              <Users className="w-8 h-8 text-blue-500 mx-auto mb-3" />
              <div className="text-2xl font-bold text-gray-900 mb-1">{allUsers.length.toLocaleString()}</div>
              <div className="text-sm text-gray-600 font-medium tracking-wide uppercase">총 활성 유저</div>
            </Card>
            <Card className="p-6 bg-gradient-to-br from-purple-50 to-pink-50 border-purple-100 shadow-sm text-center">
              <Zap className="w-8 h-8 text-purple-500 mx-auto mb-3" />
              <div className="text-2xl font-bold text-gray-900 mb-1">{totalParticipations.toLocaleString()}</div>
              <div className="text-sm text-gray-600 font-medium tracking-wide uppercase">누적 참여 이력</div>
            </Card>
            <Card className="p-6 bg-gradient-to-br from-emerald-50 to-teal-50 border-emerald-100 shadow-sm text-center">
              <Trophy className="w-8 h-8 text-emerald-500 mx-auto mb-3" />
              <div className="text-2xl font-bold text-gray-900 mb-1">{totalHackathons.toLocaleString()}</div>
              <div className="text-sm text-gray-600 font-medium tracking-wide uppercase">누적 해커톤</div>
            </Card>
          </div>

          {/* ─── 유저 검색 & 필터 ─── */}
          <Card className="p-5 mb-6 border-gray-100 shadow-sm space-y-4">
            {/* 검색 입력 */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              <Input
                placeholder="닉네임으로 검색..."
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setVisibleCount(PAGE_SIZE) }}
                className="pl-9 h-10 bg-gray-50 border-gray-200 focus:bg-white"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* 기술 스택 필터 */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">기술 스택</span>
                {allTechStacks.length > FILTER_SHOW_LIMIT && (
                  <button
                    onClick={() => setShowMoreStacks((v) => !v)}
                    className="text-xs text-blue-500 hover:text-blue-600 flex items-center gap-0.5"
                  >
                    {showMoreStacks ? <><ChevronUp className="w-3 h-3" />접기</> : <><ChevronDown className="w-3 h-3" />{allTechStacks.length - FILTER_SHOW_LIMIT}개 더보기</>}
                  </button>
                )}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {(showMoreStacks ? allTechStacks : allTechStacks.slice(0, FILTER_SHOW_LIMIT)).map((s) => {
                  const active = selectedStacks.includes(s)
                  return (
                    <button
                      key={s}
                      onClick={() => { toggleItem(selectedStacks, setSelectedStacks, s); setVisibleCount(PAGE_SIZE) }}
                      className={`text-xs px-2.5 py-1 rounded-full border font-mono transition-colors ${
                        active
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300 hover:text-blue-600'
                      }`}
                    >
                      {s}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* 성격 태그 필터 */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">성격 태그</span>
                {allPersonalityTags.length > FILTER_SHOW_LIMIT && (
                  <button
                    onClick={() => setShowMoreTags((v) => !v)}
                    className="text-xs text-purple-500 hover:text-purple-600 flex items-center gap-0.5"
                  >
                    {showMoreTags ? <><ChevronUp className="w-3 h-3" />접기</> : <><ChevronDown className="w-3 h-3" />{allPersonalityTags.length - FILTER_SHOW_LIMIT}개 더보기</>}
                  </button>
                )}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {(showMoreTags ? allPersonalityTags : allPersonalityTags.slice(0, FILTER_SHOW_LIMIT)).map((t) => {
                  const active = selectedTags.includes(t)
                  return (
                    <button
                      key={t}
                      onClick={() => { toggleItem(selectedTags, setSelectedTags, t); setVisibleCount(PAGE_SIZE) }}
                      className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                        active
                          ? 'bg-purple-600 text-white border-purple-600'
                          : 'bg-white text-gray-600 border-gray-200 hover:border-purple-300 hover:text-purple-600'
                      }`}
                    >
                      # {t}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* 포지션 필터 */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">포지션</span>
                {allRoles.length > FILTER_SHOW_LIMIT && (
                  <button
                    onClick={() => setShowMoreRoles((v) => !v)}
                    className="text-xs text-indigo-500 hover:text-indigo-600 flex items-center gap-0.5"
                  >
                    {showMoreRoles ? <><ChevronUp className="w-3 h-3" />접기</> : <><ChevronDown className="w-3 h-3" />{allRoles.length - FILTER_SHOW_LIMIT}개 더보기</>}
                  </button>
                )}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {(showMoreRoles ? allRoles : allRoles.slice(0, FILTER_SHOW_LIMIT)).map((r) => {
                  const active = selectedRoles.includes(r)
                  return (
                    <button
                      key={r}
                      onClick={() => { toggleItem(selectedRoles, setSelectedRoles, r); setVisibleCount(PAGE_SIZE) }}
                      className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                        active
                          ? 'bg-indigo-600 text-white border-indigo-600'
                          : 'bg-white text-gray-600 border-gray-200 hover:border-indigo-300 hover:text-indigo-600'
                      }`}
                    >
                      {r}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* 활성 필터 요약 & 초기화 */}
            {hasActiveFilter && (
              <div className="flex items-center justify-between pt-1 border-t border-gray-100">
                <span className="text-xs text-gray-500">
                  <span className="font-semibold text-gray-700">{filteredUsers.length}명</span> 검색됨
                </span>
                <button
                  onClick={clearAllFilters}
                  className="text-xs text-red-500 hover:text-red-600 flex items-center gap-1 font-medium"
                >
                  <X className="w-3 h-3" />
                  필터 초기화
                </button>
              </div>
            )}
          </Card>

          {/* Period Filter */}
          <div className="flex gap-2 mb-8 bg-gray-100/50 p-1.5 rounded-xl w-fit">
            <Button
              variant={filter === "all" ? "default" : "ghost"}
              onClick={() => handleFilterChange("all")}
              className={filter === "all" ? "bg-white text-gray-900 shadow-sm hover:bg-white" : "text-gray-500"}
              size="sm"
            >
              전체
            </Button>
            <Button
              variant={filter === "days30" ? "default" : "ghost"}
              onClick={() => handleFilterChange("days30")}
              className={filter === "days30" ? "bg-white text-gray-900 shadow-sm hover:bg-white" : "text-gray-500"}
              size="sm"
            >
              최근 30일
            </Button>
            <Button
              variant={filter === "days7" ? "default" : "ghost"}
              onClick={() => handleFilterChange("days7")}
              className={filter === "days7" ? "bg-white text-gray-900 shadow-sm hover:bg-white" : "text-gray-500"}
              size="sm"
            >
              최근 7일
            </Button>
          </div>

          {filteredUsers.length === 0 ? (
            <Card className="p-12 text-center border-gray-100">
              <div className="text-5xl mb-4">🔍</div>
              <p className="text-gray-500 font-medium">조건에 맞는 유저가 없습니다.</p>
              <button onClick={clearAllFilters} className="mt-3 text-sm text-blue-500 hover:underline font-semibold">
                필터 초기화
              </button>
            </Card>
          ) : (
            <>
              {/* Top 3 포디움 — 필터 결과 기준 상위 3명 */}
              {(() => {
                const top = filteredUsers.slice(0, 3)
                return (
                  <div className="grid grid-cols-3 gap-3 mb-2 items-end">
                    {top.map((user) => {
                      const isFirst = user.rank === filteredUsers[0].rank
                      return (
                        <Card
                          key={user.rank}
                          onClick={() => setSelectedUser(user)}
                          className={`flex flex-col items-center text-center gap-2 transition-all hover:shadow-lg hover:scale-[1.02] cursor-pointer ${getRankBg(user.rank)} border shadow-sm ${
                            isFirst ? 'p-5' : 'p-4'
                          }`}
                        >
                          <div className={isFirst ? 'mb-1' : ''}>
                            {getRankIcon(user.rank)}
                          </div>
                          <div
                            className={`bg-white rounded-2xl flex items-center justify-center shadow-inner border border-gray-100 ${
                              isFirst ? 'text-4xl w-16 h-16' : 'text-3xl w-12 h-12'
                            }`}
                          >
                            {user.avatar}
                          </div>
                          <div className="w-full min-w-0">
                            <p className={`font-bold text-gray-900 truncate ${isFirst ? 'text-base' : 'text-sm'}`}>
                              {user.nickname}
                            </p>
                            <Badge variant="outline" className="text-xs bg-white/60 border-gray-200 text-gray-500 mt-1">
                              {user.primaryRole}
                            </Badge>
                          </div>
                          <div className="flex flex-col items-center gap-0.5 w-full">
                            <span className={`font-black text-gray-900 ${isFirst ? 'text-xl' : 'text-base'}`}>
                              {user.points.toLocaleString()}
                              <span className="text-xs font-normal text-gray-400 ml-1">pts</span>
                            </span>
                            <div className="flex gap-2 text-xs text-gray-400 justify-center">
                              <span className="flex items-center gap-0.5">
                                <Star className="w-3 h-3 text-yellow-400" />{user.reputation.toFixed(1)}
                              </span>
                              <span className="flex items-center gap-0.5">
                                <TrendingUp className="w-3 h-3 text-green-500" />{Math.round(user.activityScore * 100)}점
                              </span>
                            </div>
                          </div>
                        </Card>
                      )
                    })}
                  </div>
                )
              })()}

              {/* 4위 이하 — 컴팩트 테이블 */}
              {filteredUsers.length > 3 && (
                <div className="border border-gray-100 rounded-xl overflow-hidden shadow-sm">
                  {filteredUsers.slice(3, visibleCount).map((user, idx) => (
                    <div
                      key={user.rank}
                      onClick={() => setSelectedUser(user)}
                      className={`flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 transition-colors cursor-pointer ${
                        idx !== 0 ? 'border-t border-gray-100' : ''
                      }`}
                    >
                      <span className="w-8 text-sm font-bold text-gray-400 text-center flex-shrink-0">#{user.rank}</span>
                      <span className="text-lg w-7 text-center flex-shrink-0">{user.avatar}</span>
                      <span className="flex-1 font-semibold text-gray-800 text-sm truncate">{user.nickname}</span>
                      <Badge variant="outline" className="text-xs text-gray-400 border-gray-200 hidden sm:inline-flex flex-shrink-0">
                        {user.primaryRole}
                      </Badge>
                      <span className="flex items-center gap-0.5 text-xs text-gray-400 flex-shrink-0">
                        <Star className="w-3 h-3 text-yellow-400" />{user.reputation.toFixed(1)}
                      </span>
                      <span className="text-sm font-bold text-gray-700 w-20 text-right flex-shrink-0">
                        {user.points.toLocaleString()} <span className="text-xs font-normal text-gray-400">pts</span>
                      </span>
                    </div>
                  ))}

                  {visibleCount < filteredUsers.length && (
                    <div className="border-t border-gray-100 px-4 py-3 text-center">
                      <button
                        onClick={() => setVisibleCount((v) => v + PAGE_SIZE)}
                        className="text-sm text-blue-600 hover:text-blue-700 font-semibold hover:underline"
                      >
                        더보기 ({filteredUsers.length - visibleCount}명 남음)
                      </button>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </>
      ) : (
        <div className="text-center py-20">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-4 text-gray-500">데이터를 불러오는 중입니다...</p>
        </div>
      )}

      {/* 유저 상세 모달 */}
      <UserInfoModal
        user={selectedUser}
        open={Boolean(selectedUser)}
        onClose={() => setSelectedUser(null)}
      />
    </div>
  )
}
