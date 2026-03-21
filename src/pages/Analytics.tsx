import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  Cell, PieChart, Pie, LineChart, Line, AreaChart, Area
} from 'recharts'
import { 
  ArrowLeft, TrendingUp, Users, Trophy, Target, 
  Activity, Calendar, BarChart3, PieChart as PieChartIcon, 
  Clock, Hash, CheckCircle
} from 'lucide-react'

import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useLog } from '../contexts/LogContext'
import type { Hackathon } from '../types/hackathon'

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

export default function Analytics() {
  const navigate = useNavigate()
  const { logs } = useLog()
  const [filterDays, setFilterDays] = useState<number | 'all'>('all')

  const hackathons = useMemo(() => getFromStorage<Hackathon>(HACKATHONS_STORAGE_KEY), [])

  const filteredLogs = useMemo(() => {
    if (filterDays === 'all') return logs
    const now = new Date()
    const cutoff = new Date(now.setDate(now.getDate() - filterDays))
    return logs.filter((log) => new Date(log.timestamp) >= cutoff)
  }, [logs, filterDays])

  const statsSummary = useMemo(() => {
    const joinCount = filteredLogs.filter((l) => l.eventType === 'hackathon_join').length
    const submitCount = filteredLogs.filter((l) => l.eventType === 'submit_project').length
    const viewCount = filteredLogs.filter((l) => l.eventType === 'hackathon_view').length
    const teamCount = filteredLogs.filter((l) => l.eventType === 'team_create').length
    
    return [
      { title: '누적 해커톤', value: hackathons.length, icon: Trophy, color: 'text-blue-600', bg: 'bg-blue-50' },
      { title: '전체 참가자', value: joinCount, icon: Users, color: 'text-emerald-600', bg: 'bg-emerald-50' },
      { title: '프로젝트 제출', value: submitCount, icon: CheckCircle, color: 'text-purple-600', bg: 'bg-purple-50' },
      { title: '팀 생성', value: teamCount, icon: Target, color: 'text-amber-600', bg: 'bg-amber-50' },
    ]
  }, [filteredLogs, hackathons])

  const tagData = useMemo(() => {
    const counts: Record<string, number> = {}
    hackathons.forEach((h) => {
      h.tags.forEach((tag) => {
        counts[tag] = (counts[tag] || 0) + 1
      })
    })
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([name, value]) => ({ name, value }))
  }, [hackathons])

  const popularData = useMemo(() => {
    const stats: Record<string, { views: number; joins: number; teams: number; title: string }> = {}
    hackathons.forEach(h => {
        stats[h.slug] = { views: 0, joins: 0, teams: 0, title: h.title }
    })

    filteredLogs.forEach((l) => {
      if (!stats[l.targetId]) return
      if (l.eventType === 'hackathon_view') stats[l.targetId].views++
      if (l.eventType === 'hackathon_join') stats[l.targetId].joins++
      if (l.eventType === 'team_create') stats[l.targetId].teams++
    })

    return Object.entries(stats)
      .map(([slug, data]) => ({ name: data.title.split(' ')[0], views: data.views, joins: data.joins, teams: data.teams }))
      .sort((a, b) => (b.views + b.joins * 2) - (a.views + a.joins * 2))
      .slice(0, 5)
  }, [filteredLogs, hackathons])

  const funnelData = useMemo(() => {
    const views = filteredLogs.filter(l => l.eventType === 'hackathon_view').length
    const joins = filteredLogs.filter(l => l.eventType === 'hackathon_join').length
    const teams = filteredLogs.filter(l => l.eventType === 'team_create').length
    const submits = filteredLogs.filter(l => l.eventType === 'submit_project').length

    return [
      { name: '조회', value: views, fill: '#3B82F6' },
      { name: '참가', value: joins, fill: '#10B981' },
      { name: '팀 빌딩', value: teams, fill: '#8B5CF6' },
      { name: '최종 제출', value: submits, fill: '#F59E0B' },
    ]
  }, [filteredLogs])

  const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899']

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

      <div className="mb-10">
        <h1 className="text-4xl font-extrabold text-gray-900 mb-4 tracking-tight flex items-center gap-3">
          <BarChart3 className="w-10 h-10 text-[#3B82F6]" />
          Platform Analytics
        </h1>
        <p className="text-gray-600 text-lg max-w-2xl font-medium">
          해커톤 플랫폼의 실시간 지표와 트렌드를 한눈에 파악하세요.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
        {statsSummary.map((stat, idx) => (
          <Card key={idx} className="p-6 border-0 shadow-lg bg-white rounded-3xl hover:scale-[1.02] transition-transform">
            <div className="flex items-center justify-between mb-4">
              <div className={`w-12 h-12 rounded-2xl ${stat.bg} flex items-center justify-center ${stat.color}`}>
                <stat.icon className="w-6 h-6" />
              </div>
              <Badge variant="outline" className="text-emerald-500 border-emerald-100 bg-emerald-50">
                <TrendingUp className="w-3 h-3 mr-1" />
                +12%
              </Badge>
            </div>
            <div className="text-3xl font-black text-gray-900 mb-1">{stat.value.toLocaleString()}</div>
            <div className="text-sm font-bold text-gray-400 uppercase tracking-widest">{stat.title}</div>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-10">
        <Card className="p-8 border-0 shadow-xl bg-white rounded-3xl">
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <Hash className="w-5 h-5 text-blue-500" />
              인기 기술 태그 TOP 6
            </h3>
            <PieChartIcon className="w-5 h-5 text-gray-300" />
          </div>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={tagData}
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={8}
                  dataKey="value"
                >
                  {tagData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="grid grid-cols-3 gap-4 mt-4">
            {tagData.map((tag, idx) => (
              <div key={tag.name} className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[idx % COLORS.length] }} />
                <span className="text-sm font-bold text-gray-600 truncate">{tag.name}</span>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-8 border-0 shadow-xl bg-white rounded-3xl">
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <Trophy className="w-5 h-5 text-amber-500" />
              해커톤별 활동 지표
            </h3>
            <Activity className="w-5 h-5 text-gray-300" />
          </div>
          <div className="h-[350px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={popularData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f0f0f0" />
                <XAxis type="number" hide />
                <YAxis dataKey="name" type="category" width={80} tick={{ fontSize: 12, fontWeight: 'bold' }} />
                <Tooltip 
                  cursor={{ fill: '#f8fafc' }}
                  contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                />
                <Bar dataKey="views" fill="#3B82F6" radius={[0, 4, 4, 0]} name="상세 조회" barSize={16} />
                <Bar dataKey="joins" fill="#10B981" radius={[0, 4, 4, 0]} name="참가 신청" barSize={16} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-10">
        <Card className="lg:col-span-1 p-8 border-0 shadow-xl bg-white rounded-3xl">
          <h3 className="text-xl font-bold text-gray-900 mb-8 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-emerald-500" />
            전환 파이프라인
          </h3>
          <div className="space-y-6">
            {funnelData.map((item, idx) => (
              <div key={item.name}>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-bold text-gray-600">{item.name}</span>
                  <span className="text-sm font-black text-gray-900">{item.value.toLocaleString()}</span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-3">
                  <div 
                    className="h-full rounded-full transition-all duration-1000" 
                    style={{ width: `${(item.value / (funnelData[0].value || 1)) * 100}%`, backgroundColor: item.fill }} 
                  />
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card className="lg:col-span-2 p-8 border-0 shadow-xl bg-white rounded-3xl overflow-hidden">
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <Clock className="w-5 h-5 text-purple-500" />
              실시간 활동 타임라인
            </h3>
            <Badge className="bg-purple-100 text-purple-700 border-0">Live Update</Badge>
          </div>
          <div className="space-y-6 max-h-[400px] overflow-y-auto pr-4 scrollbar-hide">
            {filteredLogs.slice().reverse().slice(0, 15).map((log, idx) => (
              <div key={log.id} className="relative flex gap-4">
                {idx !== 14 && (
                  <div className="absolute left-[19px] top-10 bottom-0 w-0.5 bg-gray-100" />
                )}
                <div className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center border border-gray-100 z-10 flex-shrink-0">
                  {log.eventType.includes('view') ? <TrendingUp className="w-4 h-4 text-blue-500" /> : 
                   log.eventType.includes('join') ? <Users className="w-4 h-4 text-emerald-500" /> :
                   <Activity className="w-4 h-4 text-amber-500" />}
                </div>
                <div className="flex-1 pb-6 border-b border-gray-50 last:border-0">
                  <div className="flex justify-between mb-1">
                    <span className="font-bold text-gray-900 text-sm">
                      {log.userId || 'Guest User'} <span className="font-normal text-gray-500 italic">가</span> {log.targetId} <span className="font-normal text-gray-500 italic">에 대해</span> {log.eventType}
                    </span>
                    <span className="text-xs text-gray-400 font-medium">
                      {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 font-medium uppercase tracking-wider">
                    {new Date(log.timestamp).toLocaleDateString()}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  )
}
