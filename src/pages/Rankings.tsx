import { useState, useEffect } from "react"
import { useNavigate } from 'react-router-dom'
import { Trophy, Medal, Award, TrendingUp, Star, Crown, ArrowLeft, Users, Globe } from "lucide-react"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

import userAlice from '../data/UserData/user_alice.json'
import userBob from '../data/UserData/user_bob.json'
import userCharlie from '../data/UserData/user_charlie.json'
import userDiana from '../data/UserData/user_diana.json'
import userEvan from '../data/UserData/user_evan.json'

interface RankingUser {
  rank: number
  nickname: string
  points: number
  avatar?: string
  country?: string
}

interface RankingData {
  all: RankingUser[]
  days30: RankingUser[]
  days7: RankingUser[]
}

interface UserData {
  ranking: number
  nickname: string
  points: number
}

export default function Rankings() {
  const navigate = useNavigate()

  // 상태 관리
  const [filter, setFilter] = useState<keyof RankingData>("all")
  const [rankingData, setRankingData] = useState<RankingData | null>(null)
  const [error, setError] = useState<string | null>(null)

  // 랭킹 데이터 로드
  useEffect(() => {
    try {
      setError(null)
      
      const users: UserData[] = [
        userAlice,
        userBob,
        userCharlie,
        userDiana,
        userEvan
      ]

      const sortedByRanking = users.sort((a, b) => a.ranking - b.ranking)

      const avatars = ["👑", "🧙", "🥷", "🤖", "🦸"]
      const countries = ["대한민국", "미국", "일본", "캐나다", "독일"]

      const data: RankingData = {
        all: sortedByRanking.map((user, index) => ({
          rank: index + 1,
          nickname: user.nickname,
          points: user.points,
          avatar: avatars[index % avatars.length],
          country: countries[index % countries.length]
        })),
        days30: sortedByRanking.map((user, index) => ({
          rank: index + 1,
          nickname: user.nickname,
          points: Math.floor(user.points * 0.6),
          avatar: avatars[index % avatars.length],
          country: countries[index % countries.length]
        })),
        days7: sortedByRanking.map((user, index) => ({
          rank: index + 1,
          nickname: user.nickname,
          points: Math.floor(user.points * 0.3),
          avatar: avatars[index % avatars.length],
          country: countries[index % countries.length]
        }))
      }

      setRankingData(data)
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
              <div className="text-2xl font-bold text-gray-900 mb-1">1,240</div>
              <div className="text-sm text-gray-600 font-medium tracking-wide uppercase">총 활성 유저</div>
            </Card>
            <Card className="p-6 bg-gradient-to-br from-purple-50 to-pink-50 border-purple-100 shadow-sm text-center">
              <Star className="w-8 h-8 text-purple-500 mx-auto mb-3" />
              <div className="text-2xl font-bold text-gray-900 mb-1">456</div>
              <div className="text-sm text-gray-600 font-medium tracking-wide uppercase">누적 해커톤</div>
            </Card>
            <Card className="p-6 bg-gradient-to-br from-emerald-50 to-teal-50 border-emerald-100 shadow-sm text-center">
              <Globe className="w-8 h-8 text-emerald-500 mx-auto mb-3" />
              <div className="text-2xl font-bold text-gray-900 mb-1">12</div>
              <div className="text-sm text-gray-600 font-medium tracking-wide uppercase">참여 국가</div>
            </Card>
          </div>

          {/* Period Filter */}
          <div className="flex gap-2 mb-8 bg-gray-100/50 p-1.5 rounded-xl w-fit">
            <Button 
              variant={filter === "all" ? "default" : "ghost"}
              onClick={() => setFilter("all")}
              className={filter === "all" ? "bg-white text-gray-900 shadow-sm hover:bg-white" : "text-gray-500"}
              size="sm"
            >
              전체
            </Button>
            <Button 
              variant={filter === "days30" ? "default" : "ghost"}
              onClick={() => setFilter("days30")}
              className={filter === "days30" ? "bg-white text-gray-900 shadow-sm hover:bg-white" : "text-gray-500"}
              size="sm"
            >
              최근 30일
            </Button>
            <Button 
              variant={filter === "days7" ? "default" : "ghost"}
              onClick={() => setFilter("days7")}
              className={filter === "days7" ? "bg-white text-gray-900 shadow-sm hover:bg-white" : "text-gray-500"}
              size="sm"
            >
              최근 7일
            </Button>
          </div>

          {/* Rankings List */}
          <div className="space-y-4">
            {rankingData[filter].map((user) => (
              <Card 
                key={user.rank}
                className={`flex items-center gap-4 p-5 transition-all hover:shadow-lg hover:scale-[1.01] ${getRankBg(user.rank)} border-0 shadow-sm`}
              >
                {/* Rank Icon */}
                <div className="w-12 flex items-center justify-center">
                  {getRankIcon(user.rank)}
                </div>

                {/* Avatar */}
                <div className="text-4xl bg-white w-14 h-14 rounded-2xl flex items-center justify-center shadow-inner border border-gray-100">
                  {user.avatar}
                </div>

                {/* User Info */}
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-1">
                    <h3 className="text-xl font-bold text-gray-900">{user.nickname}</h3>
                    <Badge variant="outline" className="bg-white/50 border-gray-200 font-medium text-gray-600">
                      {user.country}
                    </Badge>
                  </div>
                  <div className="flex gap-4 text-sm text-gray-500 font-medium">
                    <span className="flex items-center gap-1">
                      <TrendingUp className="w-3.5 h-3.5 text-green-500" />
                      순위 상승 중
                    </span>
                  </div>
                </div>

                {/* Points */}
                <div className="text-right pr-4">
                  <div className="text-2xl font-black text-gray-900 leading-none mb-1">
                    {user.points.toLocaleString()}
                  </div>
                  <div className="text-xs font-bold text-gray-400 uppercase tracking-widest">Points</div>
                </div>
              </Card>
            ))}
          </div>
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
