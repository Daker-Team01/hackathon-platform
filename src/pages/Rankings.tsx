import { useState, useEffect } from "react"
import { useNavigate } from 'react-router-dom'
import { Trophy, Medal, Award, TrendingUp, Star, Crown, ArrowLeft, Users, Zap } from "lucide-react"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { allUsers } from '../contexts/UserContext'
import { normalizedHackathons as hackathonData } from '../lib/hackathonData'

interface RankingUser {
  rank: number
  nickname: string
  points: number
  reputation: number
  activityScore: number
  primaryRole: string
  avatar?: string
}

interface RankingData {
  all: RankingUser[]
  days30: RankingUser[]
  days7: RankingUser[]
}

const AVATARS = ["👑", "🧙", "🥷", "🤖", "🦸", "🎯", "🚀", "💡", "⚡", "🔥"]

const PAGE_SIZE = 10

export default function Rankings() {
  const navigate = useNavigate()

  const [filter, setFilter] = useState<keyof RankingData>("all")
  const [rankingData, setRankingData] = useState<RankingData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)

  // 통계 수치 (더미 데이터 기반)
  const totalParticipations = allUsers.reduce((sum, u) => sum + u.participations.length, 0)
  const totalHackathons = hackathonData.length

  useEffect(() => {
    try {
      setError(null)

      const sorted = [...allUsers].sort((a, b) => {
        if (b.points !== a.points) return b.points - a.points
        return b.reputation - a.reputation
      })

      const toEntry = (user: typeof sorted[0], index: number, pointMultiplier: number): RankingUser => ({
        rank: index + 1,
        nickname: user.nickname,
        points: Math.floor(user.points * pointMultiplier),
        reputation: user.reputation,
        activityScore: user.activityScore,
        primaryRole: user.preferredRoles[0] ?? user.techStack[0] ?? '참여자',
        avatar: AVATARS[index % AVATARS.length]
      })

      const data: RankingData = {
        all:    sorted.map((u, i) => toEntry(u, i, 1)),
        days30: sorted.map((u, i) => toEntry(u, i, 0.6)),
        days7:  sorted.map((u, i) => toEntry(u, i, 0.3)),
      }

      setRankingData(data)
      setVisibleCount(PAGE_SIZE)
    } catch (err) {
      setError(err instanceof Error ? err.message : '랭킹 데이터를 불러오는 중 오류가 발생했습니다.')
    }
  }, [])

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
          Global Rankings
        </h1>
        <p className="text-gray-600 text-lg max-w-2xl">
          전 세계 해커톤 참가자들의 실력을 확인하고 당신의 위치를 파악해보세요.
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

          {/* Rankings List */}
          {/* Top 3 - 가로 포디움 */}
          {(() => {
            const top = rankingData[filter].slice(0, 3)
            // 포디움 순서: 1위(왼), 2위(가운데), 3위(오른) → 배열 인덱스 그대로 사용
            const podiumOrder = [top[0], top[1], top[2]].filter(Boolean)
            return (
              <div className="grid grid-cols-3 gap-3 mb-2 items-end">
                {podiumOrder.map((user) => {
                  const isFirst = user.rank === 1
                  return (
                    <Card
                      key={user.rank}
                      className={`flex flex-col items-center text-center gap-2 transition-all hover:shadow-lg hover:scale-[1.02] ${getRankBg(user.rank)} border shadow-sm ${
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

          {/* 4위 이하 - 컴팩트 테이블 */}
          {rankingData[filter].length > 3 && (
            <div className="border border-gray-100 rounded-xl overflow-hidden shadow-sm">
              {rankingData[filter].slice(3, visibleCount).map((user, idx) => (
                <div
                  key={user.rank}
                  className={`flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 transition-colors ${
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

              {visibleCount < rankingData[filter].length && (
                <div className="border-t border-gray-100 px-4 py-3 text-center">
                  <button
                    onClick={() => setVisibleCount((v) => v + PAGE_SIZE)}
                    className="text-sm text-blue-600 hover:text-blue-700 font-semibold hover:underline"
                  >
                    더보기 ({rankingData[filter].length - visibleCount}명 남음)
                  </button>
                </div>
              )}
            </div>
          )}
        </>
      ) : (
        <div className="text-center py-20">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-4 text-gray-500">데이터를 불러오는 중입니다...</p>
        </div>
      )}
    </div>
  )
}
