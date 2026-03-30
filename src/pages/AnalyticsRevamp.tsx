import { useMemo, useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from 'recharts'
import {
  ArrowLeft,
  BarChart3,
  Sparkles,
  Trophy,
  Users,
  Target,
  Activity,
  Hash,
  Clock,
  CheckCircle,
  TrendingUp
} from 'lucide-react'

import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useLog } from '../contexts/LogContext'
import { allUsers, useUser } from '../contexts/UserContext'
import { supabase } from '../lib/supabase'
import { normalizedHackathons } from '../lib/hackathonData'
import { getTeams } from '../api/teamApi'
import type { Hackathon } from '../types/hackathon'
import type { EventLog } from '../types/log'
import { generatePersonalAnalyticsWithFallback } from '../api/chatbotApi'
import { classifyLogImportance } from '../api/chatbotApi'
import { generateStackRecommendationReasonsWithFallback } from '../api/chatbotApi'

const HACKATHONS_STORAGE_KEY = 'hackathons'

function getFromStorage<T>(key: string): T[] {
  const raw = localStorage.getItem(key)
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

type SimilarUserResult = {
  userId: string
  nickname: string
  similarity: number
  profileSimilarity: number
  behaviorSimilarity: number
  commonTech: string[]
  newTech: string[]
}

type StackRecommendation = {
  tech: string
  score: number
  supporters: number
  supporterNicknames: string[]
  reason: string
}

type HackathonRecommendation = {
  slug: string
  title: string
  score: number
  supporters: number
  supporterNicknames: string[]
  tags: string[]
}

type CfRecommendationItem = {
  itemId: string
  score: number
}

type CfRecommendationMeta = {
  shape: string
  nnz: number
  sparsity: number
}

const fetchCfRecommendationsForUser = async (userId: string): Promise<{
  meta: CfRecommendationMeta | null
  recommendations: CfRecommendationItem[]
}> => {
  try {
    const response = await fetch('/cf_recommendations.json', { cache: 'no-store' })
    if (!response.ok) return { meta: null, recommendations: [] }

    const payload = (await response.json()) as {
      meta?: Partial<CfRecommendationMeta>
      byUser?: Record<string, CfRecommendationItem[]>
    }

    const recommendations = payload.byUser?.[userId] ?? []
    const meta = payload.meta
      ? {
          shape: String(payload.meta.shape ?? '-'),
          nnz: Number(payload.meta.nnz ?? 0),
          sparsity: Number(payload.meta.sparsity ?? 0)
        }
      : null

    return { meta, recommendations }
  } catch (error) {
    console.error('Failed to fetch CF recommendations:', error)
    return { meta: null, recommendations: [] }
  }
}

const BEHAVIOR_ACTIONS = [
  'hackathon_view',
  'hackathon_join',
  'submit_project',
  'team_create',
  'team_join',
  'team_request_create',
  'invite_send',
  'chatbot_query',
  'tab_view'
] as const

const DEFAULT_ACTION_WEIGHTS: Record<string, number> = {
  hackathon_view: 0.6,
  hackathon_join: 1.0,
  submit_project: 1.2,
  team_create: 1.0,
  team_join: 0.9,
  team_request_create: 0.7,
  invite_send: 0.6,
  chatbot_query: 0.5,
  tab_view: 0.4
}

const toStyleValue = (value: string) => {
  if (value === 'high') return 1
  if (value === 'medium') return 0.5
  return 0
}

const cosineSimilarity = (left: number[], right: number[]): number => {
  if (left.length !== right.length || left.length === 0) return 0

  let dot = 0
  let leftNorm = 0
  let rightNorm = 0

  for (let i = 0; i < left.length; i += 1) {
    dot += left[i] * right[i]
    leftNorm += left[i] * left[i]
    rightNorm += right[i] * right[i]
  }

  if (leftNorm === 0 || rightNorm === 0) return 0
  return dot / (Math.sqrt(leftNorm) * Math.sqrt(rightNorm))
}

export default function AnalyticsRevamp() {
  const navigate = useNavigate()
  const { user } = useUser()
  const { refreshLogs, loading } = useLog()

  const [dbLogs, setDbLogs] = useState<EventLog[]>([])
  const [activeTeamCount, setActiveTeamCount] = useState(0)
  const [isFetching, setIsFetching] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)

  const [personalModalOpen, setPersonalModalOpen] = useState(false)
  const [personalResultModalOpen, setPersonalResultModalOpen] = useState(false)
  const [personalAnalyzing, setPersonalAnalyzing] = useState(false)
  const [personalAnalysisText, setPersonalAnalysisText] = useState('')
  const [personalAnalysisError, setPersonalAnalysisError] = useState('')
  const [recommendedStacks, setRecommendedStacks] = useState<StackRecommendation[]>([])
  const [cfRecommendations, setCfRecommendations] = useState<CfRecommendationItem[]>([])

  const hackathons = useMemo(() => {
    const fromStorage = getFromStorage<Hackathon>(HACKATHONS_STORAGE_KEY)
    return fromStorage.length > 0 ? fromStorage : normalizedHackathons
  }, [])

  const endedHackathonSlugSet = useMemo(() => {
    const nowMs = Date.now()

    return new Set(
      hackathons
        .filter((hackathon) => {
          if (hackathon.status === 'ended') return true
          const endAt = hackathon.period?.endAt
          if (!endAt) return false

          const endMs = Date.parse(endAt)
          if (Number.isNaN(endMs)) return false

          return endMs < nowMs
        })
        .map((hackathon) => hackathon.slug)
    )
  }, [hackathons])

  useEffect(() => {
    let mounted = true

    async function fetchAnalyticsLogs() {
      setIsFetching(true)
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
          console.error('Failed to fetch analytics logs:', error)
          break
        }

        const rows = (data || []) as EventLog[]
        allLogs.push(...rows)

        if (rows.length < currentPageSize) {
          break
        }

        from += currentPageSize
      }

      if (mounted) {
        setDbLogs(allLogs)
        setIsFetching(false)
      }
    }

    fetchAnalyticsLogs()

    return () => {
      mounted = false
    }
  }, [reloadKey])

  useEffect(() => {
    let mounted = true

    async function fetchTeamsSnapshot() {
      try {
        const teams = await getTeams()
        if (!mounted) return
        setActiveTeamCount(
          teams.filter((team) => !team.hackathonSlug || !endedHackathonSlugSet.has(team.hackathonSlug)).length
        )
      } catch (error) {
        console.error('Failed to fetch teams snapshot:', error)
      }
    }

    fetchTeamsSnapshot()

    return () => {
      mounted = false
    }
  }, [endedHackathonSlugSet, reloadKey])

  const joinCount = useMemo(
    () => dbLogs.filter((log) => log.action_type === 'hackathon_join').length,
    [dbLogs]
  )
  const submitCount = useMemo(
    () => dbLogs.filter((log) => log.action_type === 'submit_project').length,
    [dbLogs]
  )

  const completionRate = useMemo(() => {
    if (joinCount === 0) return 0
    return Math.round((submitCount / joinCount) * 100)
  }, [joinCount, submitCount])

  const statsSummary = useMemo(() => {
    return [
      {
        title: '누적 해커톤',
        value: hackathons.length,
        icon: Trophy,
        color: 'text-blue-600',
        bg: 'bg-blue-50'
      },
      {
        title: '전체 사용자',
        value: allUsers.length,
        icon: Users,
        color: 'text-emerald-600',
        bg: 'bg-emerald-50'
      },
      {
        title: '완주율 (신청→제출)',
        value: `${completionRate}%`,
        icon: CheckCircle,
        color: 'text-purple-600',
        bg: 'bg-purple-50'
      },
      {
        title: '현재 활동중인 팀',
        value: activeTeamCount,
        icon: Target,
        color: 'text-amber-600',
        bg: 'bg-amber-50'
      }
    ]
  }, [activeTeamCount, completionRate, hackathons.length])

  const hourlyUsageData = useMemo(() => {
    const byHour = Array.from({ length: 24 }, (_, hour) => ({
      hour,
      label: `${String(hour).padStart(2, '0')}시`,
      count: 0
    }))

    dbLogs.forEach((log) => {
      const hour = new Date(log.created_at).getHours()
      byHour[hour].count += 1
    })

    return byHour
  }, [dbLogs])

  const peakHours = useMemo(() => {
    return [...hourlyUsageData]
      .sort((a, b) => b.count - a.count)
      .slice(0, 2)
      .filter((item) => item.count > 0)
  }, [hourlyUsageData])

  const popularHackathonsTop3 = useMemo(() => {
    const stats: Record<string, { title: string; views: number; joins: number }> = {}

    hackathons.forEach((hackathon) => {
      stats[hackathon.slug] = {
        title: hackathon.title,
        views: 0,
        joins: 0
      }
    })

    dbLogs.forEach((log) => {
      if (!stats[log.target_id]) return
      if (log.action_type === 'hackathon_view') stats[log.target_id].views += 1
      if (log.action_type === 'hackathon_join') stats[log.target_id].joins += 1
    })

    return Object.entries(stats)
      .map(([slug, item]) => {
        const conversion = item.views > 0 ? (item.joins / item.views) * 100 : item.joins > 0 ? 100 : 0
        return {
          slug,
          title: item.title,
          views: item.views,
          joins: item.joins,
          conversion: Math.round(conversion)
        }
      })
      .sort((a, b) => {
        if (b.joins !== a.joins) return b.joins - a.joins
        if (b.conversion !== a.conversion) return b.conversion - a.conversion
        return b.views - a.views
      })
      .slice(0, 3)
  }, [dbLogs, hackathons])

  const hackathonTagStats = useMemo(() => {
    const counts: Record<string, number> = {}

    hackathons.forEach((hackathon) => {
      hackathon.tags.forEach((tag) => {
        counts[tag] = (counts[tag] || 0) + 1
      })
    })

    const totalMentions = Object.values(counts).reduce((sum, value) => sum + value, 0)

    return Object.entries(counts)
      .map(([name, value]) => ({
        name,
        value,
        percentage: totalMentions > 0 ? Math.round((value / totalMentions) * 100) : 0
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8)
  }, [hackathons])

  const userTechStackStats = useMemo(() => {
    const counts: Record<string, number> = {}

    allUsers.forEach((user) => {
      user.techStack.forEach((tech) => {
        counts[tech] = (counts[tech] || 0) + 1
      })
    })

    const totalMentions = Object.values(counts).reduce((sum, value) => sum + value, 0)

    return Object.entries(counts)
      .map(([name, value]) => ({
        name,
        value,
        percentage: totalMentions > 0 ? Math.round((value / totalMentions) * 100) : 0
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10)
  }, [])

  const fetchAllUserLogs = useCallback(async (userId: string) => {
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
        .eq('user_id', userId)
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

    return allLogs
  }, [])

  const fetchAllLogsForSimilarity = useCallback(async () => {
    const pageSize = 1000
    const maxLogs = 30000
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

    return allLogs
  }, [])

  const buildSimilarityInsights = useCallback(
    (currentUserId: string, allLogs: EventLog[], actionWeights: Record<string, number>) => {
      const globalTechs = Array.from(new Set(allUsers.flatMap((item) => item.techStack))).sort()
      const globalRoles = Array.from(new Set(allUsers.flatMap((item) => item.preferredRoles))).sort()
      const globalTraits = Array.from(new Set(allUsers.flatMap((item) => item.personalityTags))).sort()

      const maxPoints = Math.max(...allUsers.map((item) => item.points), 1)
      const maxReputation = Math.max(...allUsers.map((item) => item.reputation), 1)
      const maxActivity = Math.max(...allUsers.map((item) => item.activityScore), 1)

      const actionCountsByUser = new Map<string, Record<string, number>>()
      const totalActionByUser = new Map<string, number>()

      allLogs.forEach((log) => {
        if (!log.user_id) return
        const counts = actionCountsByUser.get(log.user_id) ?? {}
        counts[log.action_type] = (counts[log.action_type] || 0) + 1
        actionCountsByUser.set(log.user_id, counts)
        totalActionByUser.set(log.user_id, (totalActionByUser.get(log.user_id) || 0) + 1)
      })

      const makeProfileVector = (candidate: (typeof allUsers)[number]) => {
        const techSet = new Set(candidate.techStack)
        const roleSet = new Set(candidate.preferredRoles)
        const traitSet = new Set(candidate.personalityTags)

        const vec: number[] = []
        globalTechs.forEach((item) => vec.push(techSet.has(item) ? 1 : 0))
        globalRoles.forEach((item) => vec.push(roleSet.has(item) ? 1 : 0))
        globalTraits.forEach((item) => vec.push(traitSet.has(item) ? 1 : 0))

        vec.push(candidate.points / maxPoints)
        vec.push(candidate.reputation / maxReputation)
        vec.push(candidate.activityScore / maxActivity)
        vec.push(toStyleValue(candidate.workStyle.communication))
        vec.push(toStyleValue(candidate.workStyle.leadership))
        vec.push(toStyleValue(candidate.workStyle.execution))

        return vec
      }

      const makeBehaviorVector = (candidate: (typeof allUsers)[number]) => {
        const ids = [candidate.id, candidate.userId]
        const foundId = ids.find((id) => actionCountsByUser.has(id))
        const counts = (foundId && actionCountsByUser.get(foundId)) || {}
        const total = (foundId && totalActionByUser.get(foundId)) || 0
        return BEHAVIOR_ACTIONS.map((action) =>
          total > 0 ? ((counts[action] || 0) * (actionWeights[action] ?? 0.5)) / total : 0
        )
      }

      const me = allUsers.find((item) => item.id === currentUserId || item.userId === currentUserId)
      if (!me) {
        return { neighbors: [], recommendations: [] as StackRecommendation[] }
      }

      const meProfile = makeProfileVector(me)
      const meBehavior = makeBehaviorVector(me)
      const myTechSet = new Set(me.techStack)

      const neighbors: SimilarUserResult[] = allUsers
        .filter((candidate) => candidate.id !== me.id)
        .map((candidate) => {
          const profileSimilarity = cosineSimilarity(meProfile, makeProfileVector(candidate))
          const behaviorSimilarity = cosineSimilarity(meBehavior, makeBehaviorVector(candidate))
          const similarity = 0.4 * profileSimilarity + 0.6 * behaviorSimilarity
          const commonTech = candidate.techStack.filter((item) => myTechSet.has(item)).slice(0, 3)
          const newTech = candidate.techStack.filter((item) => !myTechSet.has(item)).slice(0, 3)

          return {
            userId: candidate.userId,
            nickname: candidate.nickname,
            similarity,
            profileSimilarity,
            behaviorSimilarity,
            commonTech,
            newTech
          }
        })
        .filter((item) => item.similarity > 0.15)
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, 5)

      const stackScoreMap = new Map<string, { score: number; supporterNicknames: Set<string> }>()
      neighbors.forEach((neighbor) => {
        const candidate = allUsers.find((item) => item.userId === neighbor.userId)
        if (!candidate) return

        candidate.techStack.forEach((tech) => {
          if (myTechSet.has(tech)) return
          const prev = stackScoreMap.get(tech) ?? { score: 0, supporterNicknames: new Set<string>() }
          prev.supporterNicknames.add(candidate.nickname)
          stackScoreMap.set(tech, {
            score: prev.score + neighbor.similarity,
            supporterNicknames: prev.supporterNicknames
          })
        })
      })

      const recommendations = [...stackScoreMap.entries()]
        .map(([tech, value]) => ({
          tech,
          score: value.score,
          supporters: value.supporterNicknames.size,
          supporterNicknames: [...value.supporterNicknames].slice(0, 3),
          reason: ''
        }))
        .sort((a, b) => b.score - a.score)
        .slice(0, 5)

      return { neighbors, recommendations }
    },
    []
  )

  const similarityDigest = useMemo(() => {
    if (!user) {
      return { neighbors: [] as SimilarUserResult[], stackRecommendations: [] as StackRecommendation[] }
    }
    const { neighbors, recommendations } = buildSimilarityInsights(user.id, dbLogs, DEFAULT_ACTION_WEIGHTS)
    return { neighbors, stackRecommendations: recommendations }
  }, [buildSimilarityInsights, dbLogs, user])

  const hackathonRecommendations = useMemo(() => {
    if (!user) return [] as HackathonRecommendation[]

    const me = allUsers.find((item) => item.id === user.id || item.userId === user.id)
    if (!me) return [] as HackathonRecommendation[]

    const myJoined = new Set(me.participations.map((item) => item.hackathonSlug).filter(Boolean))
    const scoreMap = new Map<string, { score: number; supporters: Set<string> }>()

    similarityDigest.neighbors.forEach((neighbor) => {
      const candidate = allUsers.find((item) => item.userId === neighbor.userId)
      if (!candidate) return

      candidate.participations.forEach((participation) => {
        const slug = participation.hackathonSlug
        if (!slug || myJoined.has(slug)) return

        const prev = scoreMap.get(slug) ?? { score: 0, supporters: new Set<string>() }
        const weighted = neighbor.similarity * (participation.isLeader ? 1.15 : 1)
        prev.score += weighted
        prev.supporters.add(candidate.nickname)
        scoreMap.set(slug, prev)
      })
    })

    const hackathonMap = new Map(hackathons.map((item) => [item.slug, item]))

    return [...scoreMap.entries()]
      .map(([slug, value]) => {
        const info = hackathonMap.get(slug)
        return {
          slug,
          title: info?.title || slug,
          tags: info?.tags || [],
          score: value.score,
          supporters: value.supporters.size,
          supporterNicknames: [...value.supporters].slice(0, 3)
        }
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)
  }, [hackathons, similarityDigest.neighbors, user])

  useEffect(() => {
    let mounted = true

    async function fetchCfResult() {
      if (!user) {
        if (!mounted) return
        setCfRecommendations([])
        return
      }

      const result = await fetchCfRecommendationsForUser(user.userId || user.id)
      if (!mounted) return

      setCfRecommendations(result.recommendations)
    }

    fetchCfResult()

    return () => {
      mounted = false
    }
  }, [user])

  const handleStartPersonalAnalysis = useCallback(async () => {
    if (!user) {
      setPersonalAnalysisError('로그인한 사용자 정보가 필요합니다.')
      return
    }

    setPersonalAnalyzing(true)
    setPersonalAnalysisError('')

    try {
      const userLogs = await fetchAllUserLogs(user.id)
      const allLogs = await fetchAllLogsForSimilarity()
      const weights = await classifyLogImportance()
      const { recommendations } = buildSimilarityInsights(user.id, allLogs, weights)
      const report = await generatePersonalAnalyticsWithFallback(user, userLogs)
      const reasonMap = await generateStackRecommendationReasonsWithFallback(
        user,
        recommendations.map((item) => ({
          tech: item.tech,
          supporters: item.supporters,
          supporterNicknames: item.supporterNicknames ?? []
        }))
      )
      const recommendationsWithReasons = recommendations.map((item) => ({
        ...item,
        supporterNicknames: item.supporterNicknames ?? [],
        reason: reasonMap[item.tech] || ''
      }))

      setRecommendedStacks(recommendationsWithReasons)
      setPersonalAnalysisText(report)
      setPersonalModalOpen(false)
      setPersonalResultModalOpen(true)
    } catch (error) {
      setPersonalAnalysisError(error instanceof Error ? error.message : '개인 분석에 실패했습니다.')
    } finally {
      setPersonalAnalyzing(false)
    }
  }, [buildSimilarityInsights, fetchAllLogsForSimilarity, fetchAllUserLogs, user])

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <Button
          variant="ghost"
          onClick={() => navigate('/')}
          className="hover:bg-gray-100 -ml-2 text-gray-600"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          메인으로
        </Button>
      </div>

      <div className="mb-10 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-4xl font-extrabold text-gray-900 mb-3 tracking-tight flex items-center gap-3">
            <BarChart3 className="w-10 h-10 text-[#3B82F6]" />
            Analytics
          </h1>
          <p className="text-gray-600 text-lg font-medium">
            인사이톤 핵심 지표 대시보드
            {(isFetching || loading) && <span className="text-blue-500 animate-pulse ml-2 font-bold">(동기화 중...)</span>}
          </p>
        </div>
        <Button
          onClick={() => {
            refreshLogs()
            setReloadKey((prev) => prev + 1)
          }}
          variant="outline"
          size="sm"
          className="rounded-xl font-bold"
        >
          새로고침
        </Button>
      </div>

      {personalAnalysisError && (
        <Card className="mb-8 p-4 border-red-100 bg-red-50 text-red-700 rounded-2xl">
          개인 분석 오류: {personalAnalysisError}
        </Card>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
        {statsSummary.map((stat) => (
          <Card key={stat.title} className="p-6 border-0 shadow-lg bg-white rounded-3xl">
            <div className="flex items-center justify-between mb-4">
              <div className={`w-12 h-12 rounded-2xl ${stat.bg} flex items-center justify-center ${stat.color}`}>
                <stat.icon className="w-6 h-6" />
              </div>
              <Badge variant="outline" className="text-emerald-500 border-emerald-100 bg-emerald-50">
                <TrendingUp className="w-3 h-3 mr-1" />
                Live
              </Badge>
            </div>
            <div className="text-3xl font-black text-gray-900 mb-1">{typeof stat.value === 'number' ? stat.value.toLocaleString() : stat.value}</div>
            <div className="text-sm font-bold text-gray-400 uppercase tracking-widest">{stat.title}</div>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-10">
        <Card className="lg:col-span-2 p-8 border-0 shadow-xl bg-white rounded-3xl">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <Clock className="w-5 h-5 text-blue-500" />
              시간대별 활동
            </h3>
            <div className="text-xs text-gray-500 font-semibold">
              피크: {peakHours.map((item) => item.label).join(', ') || '데이터 없음'}
            </div>
          </div>
          <div className="h-[280px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={hourlyUsageData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis
                  dataKey="label"
                  interval={2}
                  tick={{ fontSize: 11, fill: '#94a3b8', fontWeight: 600 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis hide />
                <Tooltip
                  cursor={{ fill: '#f8fafc' }}
                  contentStyle={{ borderRadius: '14px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                />
                <Bar dataKey="count" fill="#3B82F6" radius={[6, 6, 0, 0]} name="활동 수" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-8 border-0 shadow-xl bg-white rounded-3xl">
          <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2 mb-6">
            <Trophy className="w-5 h-5 text-amber-500" />
            인기 해커톤 TOP 3
          </h3>
          <div className="space-y-4">
            {popularHackathonsTop3.length > 0 ? (
              popularHackathonsTop3.map((item, index) => (
                <div key={item.slug} className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="font-bold text-slate-900 text-sm">#{index + 1} {item.title}</div>
                    <Badge className="bg-emerald-100 text-emerald-700 border-0">전환률 {item.conversion}%</Badge>
                  </div>
                  <div className="text-xs text-slate-500 font-semibold">
                    조회 {item.views.toLocaleString()} · 참가 {item.joins.toLocaleString()}
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-slate-500">인기 해커톤 지표를 만들 로그가 아직 없습니다.</p>
            )}
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-10">
        <Card className="p-8 border-0 shadow-xl bg-white rounded-3xl">
          <h3 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
            <Hash className="w-5 h-5 text-purple-500" />
            해커톤 기술 태그
          </h3>
          <div className="space-y-5">
            {hackathonTagStats.map((tag) => (
              <div key={tag.name}>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-bold text-gray-700">{tag.name}</span>
                  <span className="text-xs text-gray-500 font-semibold">{tag.value}회 · {tag.percentage}%</span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-2">
                  <div className="h-full rounded-full bg-violet-500" style={{ width: `${tag.percentage}%` }} />
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-8 border-0 shadow-xl bg-white rounded-3xl">
          <h3 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
            <Activity className="w-5 h-5 text-cyan-500" />
            인기 기술 스택
          </h3>
          <div className="space-y-5">
            {userTechStackStats.map((tech) => (
              <div key={tech.name}>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-bold text-gray-700">{tech.name}</span>
                  <span className="text-xs text-gray-500 font-semibold">{tech.value}명 · {tech.percentage}%</span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-2">
                  <div className="h-full rounded-full bg-cyan-500" style={{ width: `${tech.percentage}%` }} />
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-10">
        <Card className="p-8 border-0 shadow-xl bg-white rounded-3xl">
          <h3 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
            <Target className="w-5 h-5 text-indigo-500" />
            해커톤 추천
          </h3>
          <div className="space-y-4">
            {cfRecommendations.length > 0 ? (
              cfRecommendations.map((item, index) => {
                const matchedHackathon = hackathons.find((hackathon) => hackathon.slug === item.itemId)
                const fallbackByPrefix = item.itemId.replace(/^hack[-_]/, '')
                const resolvedHackathon = matchedHackathon || hackathons.find((hackathon) => hackathon.slug === fallbackByPrefix)

                return (
                  <div key={item.itemId} className="rounded-2xl border border-indigo-100 bg-indigo-50/60 p-4">
                    <div className="text-sm font-extrabold text-slate-900 mb-1">#{index + 1} {resolvedHackathon?.title || item.itemId}</div>
                    {resolvedHackathon?.tags?.length ? (
                      <div className="flex flex-wrap gap-1.5">
                        {resolvedHackathon.tags.slice(0, 4).map((tag) => (
                          <span key={tag} className="rounded-full bg-white border border-indigo-200 px-2 py-0.5 text-[11px] font-bold text-indigo-600">
                            {tag}
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </div>
                )
              })
            ) : hackathonRecommendations.length > 0 ? (
              hackathonRecommendations.map((item, index) => (
                <div key={item.slug} className="rounded-2xl border border-slate-100 bg-slate-50/80 p-4">
                  <div className="text-sm font-extrabold text-slate-900 mb-1">#{index + 1} {item.title}</div>
                  <div className="text-xs text-slate-600">유사 유저 기반 백업 추천</div>
                </div>
              ))
            ) : (
              <p className="text-sm text-slate-500">추천 데이터가 부족합니다.</p>
            )}
          </div>
        </Card>

        <Card className="p-8 border-0 shadow-xl bg-white rounded-3xl">
          <div className="flex items-start justify-between mb-6">
            <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-blue-500" />
              개인적 성장 인사이트
            </h3>
            <Button
              onClick={() => setPersonalModalOpen(true)}
              variant="default"
              size="sm"
              className="rounded-xl font-bold bg-gradient-to-r from-blue-600 to-cyan-500 text-white hover:opacity-95"
            >
              개인 분석
            </Button>
          </div>

          <div className="space-y-3">
            {(similarityDigest.stackRecommendations.length > 0
              ? similarityDigest.stackRecommendations
              : recommendedStacks
            )
              .slice(0, 4)
              .map((item) => (
                <div key={item.tech} className="rounded-xl border border-emerald-200 bg-emerald-50/70 px-3 py-2.5">
                  <div className="flex flex-wrap items-center gap-1.5 mb-1">
                    <span className="inline-flex items-center rounded-full border border-emerald-200 bg-white px-2.5 py-0.5 text-xs font-bold text-emerald-700">
                      {item.tech}
                    </span>
                    <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-bold text-emerald-600">
                      유사 유저 {item.supporters}명 선택
                    </span>
                  </div>
                  {(item.supporterNicknames?.length ?? 0) > 0 && (
                    <p className="text-[11px] text-slate-500 mt-1">근거 유저: {(item.supporterNicknames ?? []).join(', ')}</p>
                  )}
                </div>
              ))}

            {similarityDigest.stackRecommendations.length === 0 && recommendedStacks.length === 0 && (
              <p className="text-sm text-slate-500">추천 가능한 신규 기술 스택이 아직 없습니다.</p>
            )}
          </div>
        </Card>
      </div>

      {personalModalOpen && (
        <div className="fixed inset-0 z-[1200] bg-slate-900/45 backdrop-blur-[2px] flex items-center justify-center px-4">
          <div className="w-full max-w-xl rounded-3xl bg-white shadow-2xl border border-slate-200 p-7">
            <div className="flex items-start justify-between gap-3 mb-4">
              <h3 className="text-xl font-extrabold text-slate-900 flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-cyan-500" />
                개인 분석 안내
              </h3>
              <button
                type="button"
                onClick={() => setPersonalModalOpen(false)}
                className="text-slate-500 hover:text-slate-700 text-sm font-semibold"
                disabled={personalAnalyzing}
              >
                닫기
              </button>
            </div>

            <div className="space-y-3 text-sm text-slate-600 leading-6">
              <p>개인 분석은 유저의 해커톤 활동 로그를 기반으로 성장 인사이트를 제공하는 맞춤형 리포트입니다.</p>
              <p>유사한 활동 패턴의 사용자와 비교해 다음 학습 방향과 강점을 함께 제시합니다.</p>
            </div>

            {personalAnalyzing && (
              <div className="mt-4 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3">
                <p className="text-sm font-semibold text-blue-700 animate-pulse">AI가 개인맞춤 분석을 생성하는 중입니다...</p>
                <p className="text-xs text-blue-600 mt-1">잠시만 기다려주세요.</p>
              </div>
            )}

            <div className="mt-6 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setPersonalModalOpen(false)} disabled={personalAnalyzing}>
                취소
              </Button>
              <Button
                onClick={handleStartPersonalAnalysis}
                disabled={personalAnalyzing || !user}
                className="bg-gradient-to-r from-blue-600 to-cyan-500 text-white"
              >
                {personalAnalyzing ? '분석 중...' : '개인 분석 시작하기'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {personalResultModalOpen && (
        <div className="fixed inset-0 z-[1200] bg-slate-900/45 backdrop-blur-[2px] flex items-center justify-center px-4">
          <div className="w-full max-w-2xl rounded-3xl bg-white shadow-2xl border border-slate-200 p-7">
            <div className="flex items-start justify-between gap-3 mb-4">
              <h3 className="text-xl font-extrabold text-slate-900 flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-blue-500" />
                개인 분석 결과
              </h3>
              <button
                type="button"
                onClick={() => setPersonalResultModalOpen(false)}
                className="text-slate-500 hover:text-slate-700 text-sm font-semibold"
              >
                닫기
              </button>
            </div>

            <div className="max-h-[60vh] overflow-y-auto rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="mb-5 rounded-xl border border-slate-200 bg-white p-4">
                <p className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-blue-500" />
                  AI 개인 분석
                </p>
                <div className="text-sm text-slate-700 leading-7">
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={{
                      h1: ({ children }) => <h1 className="text-lg font-extrabold text-slate-900 mt-3 mb-2">{children}</h1>,
                      h2: ({ children }) => <h2 className="text-base font-bold text-slate-900 mt-3 mb-2">{children}</h2>,
                      h3: ({ children }) => <h3 className="text-sm font-bold text-slate-900 mt-2 mb-1">{children}</h3>,
                      p: ({ children }) => <p className="mb-2 whitespace-pre-wrap">{children}</p>,
                      ul: ({ children }) => <ul className="list-disc pl-5 mb-2 space-y-1">{children}</ul>,
                      ol: ({ children }) => <ol className="list-decimal pl-5 mb-2 space-y-1">{children}</ol>,
                      li: ({ children }) => <li className="text-slate-700">{children}</li>,
                      strong: ({ children }) => <strong className="font-bold text-slate-900">{children}</strong>,
                      em: ({ children }) => <em className="italic">{children}</em>,
                      code: ({ children }) => <code className="rounded bg-slate-100 px-1 py-0.5 text-[0.9em]">{children}</code>,
                      blockquote: ({ children }) => <blockquote className="border-l-4 border-slate-300 pl-3 text-slate-600 my-2">{children}</blockquote>
                    }}
                  >
                    {personalAnalysisText}
                  </ReactMarkdown>
                </div>
              </div>

              {recommendedStacks.length > 0 && (
                <div className="mb-4 flex items-center gap-3">
                  <div className="flex-1 h-px bg-slate-200" />
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest whitespace-nowrap">참가자 인사이트</span>
                  <div className="flex-1 h-px bg-slate-200" />
                </div>
              )}

              <div className="mb-2 rounded-xl border border-emerald-100 bg-white p-4">
                <p className="text-sm font-bold text-slate-800 mb-0.5">📚 무엇을 공부해야 할지 고민된다면?</p>
                <p className="text-xs text-slate-400 mb-3">지금 멈춰있다면, 이런 선택을 해보세요</p>
                {recommendedStacks.length > 0 ? (
                  <div className="space-y-2.5">
                    {recommendedStacks.map((item) => (
                      <div key={item.tech} className="rounded-xl border border-emerald-200 bg-emerald-50/70 px-3 py-2.5">
                        <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
                          <span className="inline-flex items-center rounded-full border border-emerald-200 bg-white px-2.5 py-0.5 text-xs font-bold text-emerald-700">
                            {item.tech}
                          </span>
                          <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-bold text-emerald-600">
                            나와 비슷한 유저 {item.supporters}명이 선택했어요
                          </span>
                        </div>
                        {item.reason && <p className="text-xs text-slate-700 leading-5">{item.reason}</p>}
                        {(item.supporterNicknames?.length ?? 0) > 0 && (
                          <p className="text-[11px] text-slate-500 mt-1">근거 유저: {(item.supporterNicknames ?? []).join(', ')}</p>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-500">추천 가능한 신규 기술 스택이 없습니다.</p>
                )}
              </div>
            </div>

            <div className="mt-4 flex justify-end">
              <Button variant="outline" onClick={() => setPersonalResultModalOpen(false)}>
                확인
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
