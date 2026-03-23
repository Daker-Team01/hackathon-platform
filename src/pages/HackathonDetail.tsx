import { useNavigate, useParams } from 'react-router-dom'
import { useMemo, useEffect, useRef, useState } from 'react'
import { 
  Calendar, MapPin, Users, Trophy, Clock, Award, 
  Target, CheckCircle, ArrowLeft, Heart, Share2, Info
} from "lucide-react"

import Overview from '../features/Overview'
import Eval from '../features/Eval'
import Schedule from '../features/Schedule'
import Prize from '../features/Prize'
import Teams from '../features/Teams'
import Submit from '../features/Submit'
import Leaderboard from '../features/Leaderboard'
import hackathonDetailDefaultImage from '../assets/hackathon_detail_default.png'

import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

import type { Hackathon } from '../types/hackathon'
import { useLog } from '../contexts/LogContext'
import { useUser } from '../contexts/UserContext'
import { isHackathonInterested, toggleHackathonInterest } from '../utils/interestStorage'

const HACKATHONS_STORAGE_KEY = 'hackathons'

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

export default function HackathonDetail() {
  const { slug } = useParams()
  const navigate = useNavigate()
  const { recordEvent } = useLog()
  const { user } = useUser()
  const hasLoggedView = useRef(false)
  const [activeSection, setActiveSection] = useState<string>('overview')
  const [isInterested, setIsInterested] = useState(false)
  const [heroImageLoadFailed, setHeroImageLoadFailed] = useState(false)

  const hackathon = useMemo(() => {
    const hackathons = getHackathonsFromStorage()
    return hackathons.find((item) => item.slug === slug)
  }, [slug])

  useEffect(() => {
    if (hackathon && !hasLoggedView.current) {
      recordEvent('hackathon_view', 'hackathon', hackathon.slug)
      hasLoggedView.current = true
    }
  }, [hackathon, recordEvent])

  useEffect(() => {
    if (!user || !hackathon) {
      setIsInterested(false)
      return
    }
    setIsInterested(isHackathonInterested(user.id, hackathon.slug))
  }, [hackathon, user])

  useEffect(() => {
    setHeroImageLoadFailed(false)
  }, [hackathon?.slug])

  if (!slug || !hackathon) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-center">
        <Info className="w-16 h-16 text-gray-200 mb-4" />
        <h2 className="text-2xl font-bold text-gray-900 mb-2">해커톤을 찾을 수 없습니다</h2>
        <Button onClick={() => navigate('/hackathons')} variant="outline">목록으로 돌아가기</Button>
      </div>
    )
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case '진행 중':
      case '진행중':
        return 'bg-green-500 text-white'
      case '모집 중':
      case '모집중':
        return 'bg-blue-500 text-white'
      default:
        return 'bg-gray-500 text-white'
    }
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Navigation & Actions */}
      <div className="flex items-center justify-between mb-8">
        <Button 
          variant="ghost" 
          onClick={() => navigate('/hackathons')}
          className="hover:bg-gray-100 -ml-2 text-gray-600"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          목록으로 돌아가기
        </Button>
        <div className="flex gap-2">
          <Button variant="outline" size="icon" className="rounded-full">
            <Share2 className="w-4 h-4" />
          </Button>
          <Button
            variant={isInterested ? "secondary" : "outline"}
            size="icon"
            className={`rounded-full transition-colors ${isInterested ? 'bg-red-50 text-red-500 border-red-100' : ''}`}
            onClick={() => {
              if (!user) {
                alert('로그인 후 관심 등록할 수 있습니다.')
                return
              }
              const next = toggleHackathonInterest(user.id, hackathon.slug)
              setIsInterested(next)
            }}
          >
            <Heart className={`w-4 h-4 ${isInterested ? 'fill-current' : ''}`} />
          </Button>
        </div>
      </div>

      {/* Hero Card */}
      <Card className="bg-white border-0 shadow-2xl mb-10 overflow-hidden rounded-3xl">
        <div className="relative h-72 bg-gray-900">
          <img 
            src={heroImageLoadFailed || !hackathon.thumbnailUrl ? hackathonDetailDefaultImage : hackathon.thumbnailUrl} 
            alt={hackathon.title} 
            className="w-full h-full object-cover opacity-60"
            onError={() => setHeroImageLoadFailed(true)}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-gray-900 via-transparent to-transparent" />
          <div className="absolute bottom-8 left-8 right-8">
            <Badge className={`${getStatusColor(hackathon.status)} mb-4 px-4 py-1.5 text-sm font-bold shadow-lg`}>
              {hackathon.status}
            </Badge>
            <h1 className="text-5xl font-black text-white mb-2 tracking-tight">{hackathon.title}</h1>
            <p className="text-xl text-gray-300 font-medium tracking-wide italic">Tech Innovation Series 2026</p>
          </div>
        </div>

        <div className="p-8 bg-white">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="flex items-center gap-4 p-5 bg-blue-50/50 rounded-2xl border border-blue-100/50 group hover:bg-blue-50 transition-colors">
              <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center text-[#3B82F6] group-hover:scale-110 transition-transform">
                <Calendar className="w-6 h-6" />
              </div>
              <div>
                <div className="text-xs font-bold text-blue-600/60 uppercase tracking-widest mb-1">마감일</div>
                <div className="text-base font-bold text-gray-900">
                  {new Date(hackathon.period.submissionDeadlineAt).toLocaleDateString()}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-4 p-5 bg-emerald-50/50 rounded-2xl border border-emerald-100/50 group hover:bg-emerald-50 transition-colors">
              <div className="w-12 h-12 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-600 group-hover:scale-110 transition-transform">
                <MapPin className="w-6 h-6" />
              </div>
              <div>
                <div className="text-xs font-bold text-emerald-600/60 uppercase tracking-widest mb-1">장소</div>
                <div className="text-base font-bold text-gray-900">{hackathon.location || '온/오프라인'}</div>
              </div>
            </div>

            <div className="flex items-center gap-4 p-5 bg-purple-50/50 rounded-2xl border border-purple-100/50 group hover:bg-purple-50 transition-colors">
              <div className="w-12 h-12 rounded-xl bg-purple-100 flex items-center justify-center text-purple-600 group-hover:scale-110 transition-transform">
                <Users className="w-6 h-6" />
              </div>
              <div>
                <div className="text-xs font-bold text-purple-600/60 uppercase tracking-widest mb-1">참가 규모</div>
                <div className="text-base font-bold text-gray-900">150+ 팀 참여 중</div>
              </div>
            </div>

            <div className="flex items-center gap-4 p-5 bg-amber-50/50 rounded-2xl border border-amber-100/50 group hover:bg-amber-50 transition-colors">
              <div className="w-12 h-12 rounded-xl bg-amber-100 flex items-center justify-center text-amber-600 group-hover:scale-110 transition-transform">
                <Trophy className="w-6 h-6" />
              </div>
              <div>
                <div className="text-xs font-bold text-amber-600/60 uppercase tracking-widest mb-1">총 상금</div>
                <div className="text-base font-bold text-gray-900">₩20,000,000</div>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Tabs Section */}
      <Tabs defaultValue="overview" className="space-y-8" onValueChange={setActiveSection}>
        <div className="sticky top-0 z-30 bg-background/80 backdrop-blur-md py-4 border-b border-gray-100">
          <TabsList className="grid grid-cols-4 md:grid-cols-7 w-full h-auto p-1 bg-gray-100/50 rounded-2xl">
            <TabsTrigger value="overview" className="rounded-xl py-3 data-[state=active]:bg-white data-[state=active]:shadow-sm font-bold text-sm">Overview</TabsTrigger>
            <TabsTrigger value="eval" className="rounded-xl py-3 data-[state=active]:bg-white data-[state=active]:shadow-sm font-bold text-sm">Eval</TabsTrigger>
            <TabsTrigger value="schedule" className="rounded-xl py-3 data-[state=active]:bg-white data-[state=active]:shadow-sm font-bold text-sm">Schedule</TabsTrigger>
            <TabsTrigger value="prize" className="rounded-xl py-3 data-[state=active]:bg-white data-[state=active]:shadow-sm font-bold text-sm">Prize</TabsTrigger>
            <TabsTrigger value="teams" className="rounded-xl py-3 data-[state=active]:bg-white data-[state=active]:shadow-sm font-bold text-sm">Teams</TabsTrigger>
            <TabsTrigger value="submit" className="rounded-xl py-3 data-[state=active]:bg-white data-[state=active]:shadow-sm font-bold text-sm">Submit</TabsTrigger>
            <TabsTrigger value="leaderboard" className="rounded-xl py-3 data-[state=active]:bg-white data-[state=active]:shadow-sm font-bold text-sm">Leaderboard</TabsTrigger>
          </TabsList>
        </div>

        <div className="mt-8 min-h-[500px]">
          <TabsContent value="overview" className="m-0 focus-visible:ring-0">
            <Card className="p-8 border-0 shadow-lg bg-white rounded-3xl">
              <Overview />
            </Card>
          </TabsContent>
          <TabsContent value="eval" className="m-0 focus-visible:ring-0">
            <Card className="p-8 border-0 shadow-lg bg-white rounded-3xl">
              <Eval hackathonSlug={hackathon.slug} />
            </Card>
          </TabsContent>
          <TabsContent value="schedule" className="m-0 focus-visible:ring-0">
            <Card className="p-8 border-0 shadow-lg bg-white rounded-3xl">
              <Schedule />
            </Card>
          </TabsContent>
          <TabsContent value="prize" className="m-0 focus-visible:ring-0">
            <Card className="p-8 border-0 shadow-lg bg-white rounded-3xl">
              <Prize />
            </Card>
          </TabsContent>
          <TabsContent value="teams" className="m-0 focus-visible:ring-0">
            <Card className="p-8 border-0 shadow-lg bg-white rounded-3xl">
              <Teams hackathonSlug={hackathon.slug} />
            </Card>
          </TabsContent>
          <TabsContent value="submit" className="m-0 focus-visible:ring-0">
            <Card className="p-8 border-0 shadow-lg bg-white rounded-3xl">
              <Submit hackathonSlug={hackathon.slug} />
            </Card>
          </TabsContent>
          <TabsContent value="leaderboard" className="m-0 focus-visible:ring-0">
            <Card className="p-8 border-0 shadow-lg bg-white rounded-3xl">
              <Leaderboard hackathonSlug={hackathon.slug} />
            </Card>
          </TabsContent>
        </div>
      </Tabs>
    </div>
  )
}
