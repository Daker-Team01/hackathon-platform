import { useMemo, useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  AreaChart, Area
} from 'recharts'
import { 
  ArrowLeft, TrendingUp, Users, Trophy, Target, 
  Activity, BarChart3, Clock, Hash, CheckCircle, Sparkles
} from 'lucide-react'

import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useLog } from '../contexts/LogContext'
import { allUsers, useUser } from '../contexts/UserContext'
import { supabase } from '../lib/supabase'
import type { Hackathon } from '../types/hackathon'
import type { EventLog } from '../types/log'
import { generatePersonalAnalyticsWithFallback } from '../api/chatbotApi'
import { classifyLogImportance } from '../api/chatbotApi'

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

export default function Analytics() {
  const navigate = useNavigate()
  const { user } = useUser()
  const { refreshLogs, loading } = useLog()
  const [filterDays, setFilterDays] = useState<number | 'all'>('all')
  const [dbLogs, setDbLogs] = useState<EventLog[]>([])
  const [isFetching, setIsFetching] = useState(false)
  const [personalModalOpen, setPersonalModalOpen] = useState(false)
  const [personalResultModalOpen, setPersonalResultModalOpen] = useState(false)
  const [personalAnalyzing, setPersonalAnalyzing] = useState(false)
  const [personalAnalysisText, setPersonalAnalysisText] = useState('')
  const [personalAnalysisError, setPersonalAnalysisError] = useState('')
  const [similarUsers, setSimilarUsers] = useState<SimilarUserResult[]>([])
  const [recommendedStacks, setRecommendedStacks] = useState<StackRecommendation[]>([])

  const hackathons = useMemo(() => getFromStorage<Hackathon>(HACKATHONS_STORAGE_KEY), [])

  // 전체 로그를 DB에서 직접 다시 한 번 가져오기 (필터링 대응)
  useEffect(() => {
    async function fetchAnalyticsLogs() {
      setIsFetching(true)
      const pageSize = 1000
      const maxLogs = 20000
      const allLogs: EventLog[] = []
      let from = 0

      while (allLogs.length < maxLogs) {
        const remaining = maxLogs - allLogs.length
        const currentPageSize = Math.min(pageSize, remaining)

        let query = supabase
          .from('user_logs')
          .select('*')
          .order('created_at', { ascending: false })
          .range(from, from + currentPageSize - 1)

        if (filterDays !== 'all') {
          const date = new Date()
          date.setDate(date.getDate() - filterDays)
          query = query.gte('created_at', date.toISOString())
        }

        const { data, error } = await query
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

      setDbLogs(allLogs)
      setIsFetching(false)
    }

    fetchAnalyticsLogs()
  }, [filterDays])

  const statsSummary = useMemo(() => {
    const joinCount = dbLogs.filter((l) => l.action_type === 'hackathon_join').length
    const submitCount = dbLogs.filter((l) => l.action_type === 'submit_project').length
    const teamCount = dbLogs.filter((l) => l.action_type === 'team_create').length
    
    return [
      { title: '누적 해커톤', value: hackathons.length, icon: Trophy, color: 'text-blue-600', bg: 'bg-blue-50' },
      { title: '전체 참가자', value: joinCount, icon: Users, color: 'text-emerald-600', bg: 'bg-emerald-50' },
      { title: '프로젝트 제출', value: submitCount, icon: CheckCircle, color: 'text-purple-600', bg: 'bg-purple-50' },
      { title: '팀 생성', value: teamCount, icon: Target, color: 'text-amber-600', bg: 'bg-amber-50' },
    ]
  }, [dbLogs, hackathons])

  // 일별 활동 추이 데이터 생성
  const dailyTrendData = useMemo(() => {
    if (dbLogs.length === 0) return []
    
    const counts: Record<string, { date: string; views: number; joins: number; submits: number }> = {}
    
    // 선택된 기간만큼의 날짜 초기화 (데이터가 없는 날도 표시하기 위함)
    const days = filterDays === 'all' ? 14 : filterDays
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date()
      d.setDate(d.getDate() - i)
      const dateStr = d.toISOString().split('T')[0]
      counts[dateStr] = { date: dateStr.split('-').slice(1).join('/'), views: 0, joins: 0, submits: 0 }
    }

    dbLogs.forEach(log => {
      const dateStr = new Date(log.created_at).toISOString().split('T')[0]
      if (counts[dateStr]) {
        if (log.action_type === 'hackathon_view') counts[dateStr].views++
        if (log.action_type === 'hackathon_join') counts[dateStr].joins++
        if (log.action_type === 'submit_project') counts[dateStr].submits++
      }
    })

    return Object.values(counts)
  }, [dbLogs, filterDays])

  // 기술 스택 트렌드 변화 분석 (로그 기반)
  const tagTrendData = useMemo(() => {
    const tagCounts: Record<string, number> = {}
    const hackathonMap = new Map(hackathons.map(h => [h.slug, h.tags]))
    
    dbLogs.forEach(log => {
      const tags = hackathonMap.get(log.target_id)
      if (tags) {
        tags.forEach(tag => {
          tagCounts[tag] = (tagCounts[tag] || 0) + 1
        })
      }
    })

    return Object.entries(tagCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([name, value]) => ({ 
        name, 
        value,
        percentage: dbLogs.length > 0 ? Math.round((value / dbLogs.length) * 100) : 0
      }))
  }, [dbLogs, hackathons])

  const popularData = useMemo(() => {
    const stats: Record<string, { views: number; joins: number; teams: number; title: string }> = {}
    hackathons.forEach(h => {
        stats[h.slug] = { views: 0, joins: 0, teams: 0, title: h.title }
    })

    dbLogs.forEach((l) => {
      if (!stats[l.target_id]) return
      if (l.action_type === 'hackathon_view') stats[l.target_id].views++
      if (l.action_type === 'hackathon_join') stats[l.target_id].joins++
      if (l.action_type === 'team_create') stats[l.target_id].teams++
    })

    return Object.entries(stats)
      .map(([slug, data]) => ({ slug, name: data.title.split(' ')[0], views: data.views, joins: data.joins, teams: data.teams }))
      .sort((a, b) => (b.views + b.joins * 2) - (a.views + a.joins * 2))
      .slice(0, 5)
  }, [dbLogs, hackathons])

  const funnelData = useMemo(() => {
    const views = dbLogs.filter(l => l.action_type === 'hackathon_view').length
    const joins = dbLogs.filter(l => l.action_type === 'hackathon_join').length
    const teams = dbLogs.filter(l => l.action_type === 'team_create').length
    const submits = dbLogs.filter(l => l.action_type === 'submit_project').length

    return [
      { name: '조회', value: views, fill: '#3B82F6' },
      { name: '참가', value: joins, fill: '#10B981' },
      { name: '팀 빌딩', value: teams, fill: '#8B5CF6' },
      { name: '최종 제출', value: submits, fill: '#F59E0B' },
    ]
  }, [dbLogs])

  const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899']

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

  const buildSimilarityInsights = useCallback((currentUserId: string, allLogs: EventLog[], actionWeights: Record<string, number>) => {
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
          const similarity = 0.40 * profileSimilarity + 0.60 * behaviorSimilarity
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

    const stackScoreMap = new Map<string, { score: number; supporters: number }>()
    neighbors.forEach((neighbor) => {
      const candidate = allUsers.find((item) => item.userId === neighbor.userId)
      if (!candidate) return

      candidate.techStack.forEach((tech) => {
        if (myTechSet.has(tech)) return
        const prev = stackScoreMap.get(tech) ?? { score: 0, supporters: 0 }
        stackScoreMap.set(tech, {
          score: prev.score + neighbor.similarity,
          supporters: prev.supporters + 1
        })
      })
    })

    const recommendations = [...stackScoreMap.entries()]
      .map(([tech, value]) => ({ tech, score: value.score, supporters: value.supporters }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 5)

    return { neighbors, recommendations }
  }, [])

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
        const { neighbors, recommendations } = buildSimilarityInsights(user.id, allLogs, weights)
      const report = await generatePersonalAnalyticsWithFallback(user, userLogs)

      setSimilarUsers(neighbors)
      setRecommendedStacks(recommendations)
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
        <div className="flex gap-2 bg-gray-100/50 p-1 rounded-xl">
          <Button 
            variant={filterDays === 7 ? "default" : "ghost"}
            size="sm"
            onClick={() => setFilterDays(7)}
            className={filterDays === 7 ? "bg-white text-gray-900 shadow-sm" : "text-gray-500"}
          >
            최근 7일
          </Button>
          <Button 
            variant={filterDays === 30 ? "default" : "ghost"}
            size="sm"
            onClick={() => setFilterDays(30)}
            className={filterDays === 30 ? "bg-white text-gray-900 shadow-sm" : "text-gray-500"}
          >
            최근 30일
          </Button>
          <Button 
            variant={filterDays === 'all' ? "default" : "ghost"}
            size="sm"
            onClick={() => setFilterDays('all')}
            className={filterDays === 'all' ? "bg-white text-gray-900 shadow-sm" : "text-gray-500"}
          >
            전체
          </Button>
        </div>
      </div>

      <div className="mb-10 flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-extrabold text-gray-900 mb-4 tracking-tight flex items-center gap-3">
            <BarChart3 className="w-10 h-10 text-[#3B82F6]" />
            Platform Analytics
          </h1>
          <p className="text-gray-600 text-lg max-w-2xl font-medium">
            Supabase 실시간 지표와 트렌드를 확인하세요. {(isFetching || loading) && <span className="text-blue-500 animate-pulse ml-2 font-bold">(동기화 중...)</span>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            onClick={() => setPersonalModalOpen(true)}
            variant="default"
            size="sm"
            className="rounded-xl font-bold bg-gradient-to-r from-blue-600 to-cyan-500 text-white hover:opacity-95"
          >
            <Sparkles className="w-4 h-4 mr-1" />
            개인 분석
          </Button>
          <Button onClick={() => refreshLogs()} variant="outline" size="sm" className="rounded-xl font-bold">
            새로고침
          </Button>
        </div>
      </div>

      {personalAnalysisError && (
        <Card className="mb-8 p-4 border-red-100 bg-red-50 text-red-700 rounded-2xl">
          개인 분석 오류: {personalAnalysisError}
        </Card>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
        {statsSummary.map((stat) => (
          <Card key={stat.title} className="p-6 border-0 shadow-lg bg-white rounded-3xl hover:scale-[1.02] transition-transform">
            <div className="flex items-center justify-between mb-4">
              <div className={`w-12 h-12 rounded-2xl ${stat.bg} flex items-center justify-center ${stat.color}`}>
                <stat.icon className="w-6 h-6" />
              </div>
              <Badge variant="outline" className="text-emerald-500 border-emerald-100 bg-emerald-50">
                <TrendingUp className="w-3 h-3 mr-1" />
                Live
              </Badge>
            </div>
            <div className="text-3xl font-black text-gray-900 mb-1">{stat.value.toLocaleString()}</div>
            <div className="text-sm font-bold text-gray-400 uppercase tracking-widest">{stat.title}</div>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-10">
        <Card className="lg:col-span-2 p-8 border-0 shadow-xl bg-white rounded-3xl">
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <Activity className="w-5 h-5 text-blue-500" />
              일별 활동 추이
            </h3>
            <div className="flex gap-4">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-blue-500" />
                <span className="text-xs text-gray-500 font-bold">조회</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-emerald-500" />
                <span className="text-xs text-gray-500 font-bold">참가</span>
              </div>
            </div>
          </div>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={dailyTrendData}>
                <defs>
                  <linearGradient id="colorViews" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#3B82F6" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorJoins" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10B981" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#10B981" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                <XAxis 
                  dataKey="date" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 12, fill: '#94a3b8', fontWeight: 600 }}
                  dy={10}
                />
                <YAxis hide />
                <Tooltip 
                  contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                />
                <Area type="monotone" dataKey="views" stroke="#3B82F6" strokeWidth={3} fillOpacity={1} fill="url(#colorViews)" name="상세 조회" />
                <Area type="monotone" dataKey="joins" stroke="#10B981" strokeWidth={3} fillOpacity={1} fill="url(#colorJoins)" name="참가 신청" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-8 border-0 shadow-xl bg-white rounded-3xl">
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <Hash className="w-5 h-5 text-purple-500" />
              기술 스택 분석
            </h3>
            <span className="text-xs font-bold text-gray-400">최근 활동 기준</span>
          </div>
          <div className="space-y-6">
            {tagTrendData.map((tag, idx) => (
              <div key={tag.name}>
                <div className="flex justify-between items-center mb-2">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[idx % COLORS.length] }} />
                    <span className="text-sm font-bold text-gray-700">{tag.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-gray-400">{tag.value}건</span>
                    <span className="text-sm font-black text-gray-900">{tag.percentage}%</span>
                  </div>
                </div>
                <div className="w-full bg-gray-50 rounded-full h-2">
                  <div 
                    className="h-full rounded-full" 
                    style={{ width: `${tag.percentage}%`, backgroundColor: COLORS[idx % COLORS.length] }} 
                  />
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-10">
        <Card className="p-8 border-0 shadow-xl bg-white rounded-3xl">
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <Trophy className="w-5 h-5 text-amber-500" />
              인기 해커톤 TOP 5
            </h3>
            <Activity className="w-5 h-5 text-gray-300" />
          </div>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={popularData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f0f0f0" />
                <XAxis type="number" hide />
                <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 12, fontWeight: 'bold' }} axisLine={false} tickLine={false} />
                <Tooltip 
                  cursor={{ fill: '#f8fafc' }}
                  contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                />
                <Bar dataKey="views" fill="#3B82F6" radius={[0, 4, 4, 0]} name="조회" barSize={12} />
                <Bar dataKey="joins" fill="#10B981" radius={[0, 4, 4, 0]} name="참가" barSize={12} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-8 border-0 shadow-xl bg-white rounded-3xl">
          <h3 className="text-xl font-bold text-gray-900 mb-8 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-emerald-500" />
            사용자 활동 파이프라인
          </h3>
          <div className="space-y-6">
            {funnelData.map((item) => (
              <div key={item.name}>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-bold text-gray-600">{item.name}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-gray-400">
                      {funnelData[0].value > 0 ? Math.round((item.value / funnelData[0].value) * 100) : 0}%
                    </span>
                    <span className="text-sm font-black text-gray-900">{item.value.toLocaleString()}</span>
                  </div>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden">
                  <div 
                    className="h-full transition-all duration-1000" 
                    style={{ 
                      width: `${funnelData[0].value > 0 ? (item.value / funnelData[0].value) * 100 : 0}%`, 
                      backgroundColor: item.fill 
                    }} 
                  />
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="mb-10">
        <Card className="p-8 border-0 shadow-xl bg-white rounded-3xl overflow-hidden">
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <Clock className="w-5 h-5 text-purple-500" />
              실시간 활동 타임라인 (Supabase)
            </h3>
            <Badge className="bg-purple-100 text-purple-700 border-0">Live Update</Badge>
          </div>
          <div className="space-y-6 max-h-[400px] overflow-y-auto pr-4 scrollbar-hide">
            {dbLogs.slice(0, 15).map((log, idx) => (
              <div key={log.id} className="relative flex gap-4">
                {idx !== 14 && (
                  <div className="absolute left-[19px] top-10 bottom-0 w-0.5 bg-gray-100" />
                )}
                <div className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center border border-gray-100 z-10 flex-shrink-0">
                  {log.action_type.includes('view') ? <TrendingUp className="w-4 h-4 text-blue-500" /> : 
                   log.action_type.includes('join') ? <Users className="w-4 h-4 text-emerald-500" /> :
                   <Activity className="w-4 h-4 text-amber-500" />}
                </div>
                <div className="flex-1 pb-6 border-b border-gray-50 last:border-0">
                  <div className="flex justify-between mb-1">
                    <span className="font-bold text-gray-900 text-sm">
                      {log.nickname || 'Guest User'} <span className="font-normal text-gray-500 italic">가</span> {log.target_id} <span className="font-normal text-gray-500 italic">에 대해</span> {log.action_type}
                    </span>
                    <span className="text-xs text-gray-400 font-medium">
                      {new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 font-medium uppercase tracking-wider">
                    {new Date(log.created_at).toLocaleDateString()}
                  </p>
                </div>
              </div>
            ))}
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
              <p>개인 분석은 현재 로그인한 유저의 프로필 정보와 활동 로그 전체를 기반으로 생성됩니다.</p>
              <p>분석 결과에는 현재 패턴 요약, 강점/병목 포인트, 그리고 바로 실행 가능한 개선 액션 제안이 포함됩니다.</p>
              <p className="text-slate-500">추천 항목은 초기 버전이며 이후 커스터마이징될 수 있습니다.</p>
            </div>

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
                {/* AI 개인 분석 — 최상단 */}
                <div className="mb-5 rounded-xl border border-slate-200 bg-white p-4">
                  <p className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-blue-500" />
                    AI 개인 분석
                  </p>
                  <pre className="whitespace-pre-wrap text-sm text-slate-700 leading-7 font-sans m-0">{personalAnalysisText}</pre>
                </div>

                {/* 참가자 인사이트 구분선 */}
                {(similarUsers.length > 0 || recommendedStacks.length > 0) && (
                  <div className="mb-4 flex items-center gap-3">
                    <div className="flex-1 h-px bg-slate-200" />
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest whitespace-nowrap">참가자 인사이트</span>
                    <div className="flex-1 h-px bg-slate-200" />
                  </div>
                )}

                {/* 비슷한 참가자들 */}
                <div className="mb-4 rounded-xl border border-blue-100 bg-white p-4">
                  <p className="text-sm font-bold text-slate-800 mb-1">🧑‍💻 비슷한 참가자들은 이런 기술을 선택했어요</p>
                  <p className="text-xs text-slate-400 mb-3">활동 로그와 프로필을 종합해 계산된 유사도 기반 TOP {similarUsers.length || 0}</p>
                  {similarUsers.length > 0 ? (
                    <div className="space-y-2">
                      {similarUsers.map((item) => (
                        <div key={item.userId} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                          <div className="flex items-center justify-between">
                            <p className="text-sm font-semibold text-slate-800">{item.nickname}</p>
                            <span className="text-xs font-bold text-blue-600">유사도 {(item.similarity * 100).toFixed(1)}%</span>
                          </div>
                          <p className="text-xs text-slate-500 mt-1">
                            프로필 {(item.profileSimilarity * 100).toFixed(1)}% · 활동 {(item.behaviorSimilarity * 100).toFixed(1)}%
                          </p>
                          {item.newTech.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-2">
                              {item.newTech.map((tech) => (
                                <span key={tech} className="rounded-full bg-blue-50 border border-blue-100 px-2 py-0.5 text-[11px] font-semibold text-blue-600">
                                  {tech}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-500">유사 참가자를 계산할 수 있는 데이터가 아직 부족합니다.</p>
                  )}
                </div>

                {/* 추천 기술 스택 */}
                <div className="mb-2 rounded-xl border border-emerald-100 bg-white p-4">
                  <p className="text-sm font-bold text-slate-800 mb-0.5">📚 무엇을 공부해야 할지 고민된다면?</p>
                  <p className="text-xs text-slate-400 mb-3">지금 멈춰있다면, 이런 선택을 해보세요</p>
                  {recommendedStacks.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {recommendedStacks.map((item) => (
                        <span
                          key={item.tech}
                          className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700"
                        >
                          {item.tech}
                          <span className="ml-1.5 rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-bold text-emerald-600">
                            {item.supporters}명 선택
                          </span>
                        </span>
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
