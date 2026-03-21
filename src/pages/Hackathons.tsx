import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Calendar, MapPin, Users, Trophy, Heart, ArrowLeft } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { Hackathon } from '../types/hackathon'
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

export default function Hackathons() {
  const navigate = useNavigate()
  const { user } = useUser()
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [tagFilter, setTagFilter] = useState<string>('all')
  const [, setInterestVersion] = useState(0)

  const hackathons = useMemo(() => getHackathonsFromStorage(), [])
  
  const statusOptions = useMemo(
    () => Array.from(new Set(hackathons.map((hackathon) => hackathon.status))),
    [hackathons]
  )
  const tagOptions = useMemo(
    () => Array.from(new Set(hackathons.flatMap((hackathon) => hackathon.tags))),
    [hackathons]
  )

  const filteredHackathons = useMemo(() => {
    return hackathons.filter((hackathon) => {
      const matchesStatus = statusFilter === 'all' || hackathon.status === statusFilter
      const matchesTag = tagFilter === 'all' || hackathon.tags.includes(tagFilter)
      return matchesStatus && matchesTag
    })
  }, [hackathons, statusFilter, tagFilter])

  const getStatusColor = (status: string) => {
    switch (status) {
      case '진행 중':
      case '진행중':
        return 'bg-green-100 text-green-700 border-green-200'
      case '모집 중':
      case '모집중':
        return 'bg-blue-100 text-blue-700 border-blue-200'
      case '마감':
        return 'bg-gray-100 text-gray-700 border-gray-200'
      default:
        return 'bg-yellow-100 text-yellow-700 border-yellow-200'
    }
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Navigation & Header */}
      <div className="mb-10">
        <Button 
          variant="ghost" 
          onClick={() => navigate('/')}
          className="mb-6 hover:bg-gray-100 -ml-2 text-gray-600"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          메인으로
        </Button>
        <h1 className="text-4xl font-extrabold text-gray-900 mb-4 tracking-tight">해커톤 찾기</h1>
        <p className="text-gray-600 text-lg max-w-2xl">
          당신의 꿈을 실현할 최적의 해커톤을 찾아보세요. 전 세계의 혁신가들이 당신을 기다립니다.
        </p>
      </div>

      {/* Filters Section */}
      <Card className="p-6 mb-10 bg-white/50 backdrop-blur-sm border-gray-100 shadow-sm">
        <div className="space-y-6">
          <div>
            <h3 className="text-sm font-semibold text-gray-500 mb-3 uppercase tracking-wider">진행 상태</h3>
            <div className="flex gap-2 flex-wrap">
              <Button
                variant={statusFilter === 'all' ? 'default' : 'outline'}
                onClick={() => setStatusFilter('all')}
                className={statusFilter === 'all' ? 'bg-[#3B82F6] hover:bg-[#2563EB]' : 'hover:border-[#3B82F6] hover:text-[#3B82F6]'}
                size="sm"
              >
                전체
              </Button>
              {statusOptions.map((status) => (
                <Button
                  key={status}
                  variant={statusFilter === status ? 'default' : 'outline'}
                  onClick={() => setStatusFilter(status)}
                  className={statusFilter === status ? 'bg-[#3B82F6] hover:bg-[#2563EB]' : 'hover:border-[#3B82F6] hover:text-[#3B82F6]'}
                  size="sm"
                >
                  {status}
                </Button>
              ))}
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-gray-500 mb-3 uppercase tracking-wider">기술 태그</h3>
            <div className="flex gap-2 flex-wrap">
              <Button
                variant={tagFilter === 'all' ? 'secondary' : 'outline'}
                onClick={() => setTagFilter('all')}
                className={tagFilter === 'all' ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200 border-0' : 'hover:border-emerald-500 hover:text-emerald-500'}
                size="sm"
              >
                태그 전체
              </Button>
              {tagOptions.map((tag) => (
                <Button
                  key={tag}
                  variant={tagFilter === tag ? 'secondary' : 'outline'}
                  onClick={() => setTagFilter(tag)}
                  className={tagFilter === tag ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200 border-0' : 'hover:border-emerald-500 hover:text-emerald-500'}
                  size="sm"
                >
                  {tag}
                </Button>
              ))}
            </div>
          </div>
        </div>
      </Card>

      {/* Hackathon Grid */}
      {filteredHackathons.length === 0 ? (
        <div className="text-center py-20 bg-gray-50 rounded-3xl border-2 border-dashed border-gray-200">
          <Search className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500 text-lg font-medium">검색 조건에 맞는 해커톤이 없습니다.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {filteredHackathons.map((hackathon) => {
            const isInterested = user ? isHackathonInterested(user.id, hackathon.slug) : false
            
            return (
              <Card 
                key={hackathon.slug} 
                className="group bg-white border-0 shadow-xl hover:shadow-2xl hover:scale-[1.03] transition-all duration-300 overflow-hidden flex flex-col h-full cursor-pointer"
                onClick={() => navigate(`/hackathons/${hackathon.slug}`)}
              >
                {/* Thumbnail Area */}
                <div className="relative h-48 bg-gray-100 overflow-hidden">
                  {hackathon.thumbnailUrl ? (
                    <img 
                      src={hackathon.thumbnailUrl} 
                      alt={hackathon.title} 
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-[#3B82F6]/20 to-[#0EA5E9]/20 flex items-center justify-center">
                      <Trophy className="w-12 h-12 text-[#3B82F6]/40" />
                    </div>
                  )}
                  <div className="absolute top-4 right-4">
                    <Button
                      size="icon"
                      variant="secondary"
                      className={`rounded-full shadow-md backdrop-blur-md transition-colors ${
                        isInterested ? 'bg-red-50 text-red-500 hover:bg-red-100' : 'bg-white/80 text-gray-400 hover:text-red-500'
                      }`}
                      onClick={(e) => {
                        e.stopPropagation()
                        if (!user) {
                          alert('로그인 후 관심 등록할 수 있습니다.')
                          return
                        }
                        toggleHackathonInterest(user.id, hackathon.slug)
                        setInterestVersion((prev) => prev + 1)
                      }}
                    >
                      <Heart className={`w-5 h-5 ${isInterested ? 'fill-current' : ''}`} />
                    </Button>
                  </div>
                  <div className="absolute top-4 left-4">
                    <Badge className={`${getStatusColor(hackathon.status)} px-3 py-1 font-bold border shadow-sm`}>
                      {hackathon.status}
                    </Badge>
                  </div>
                </div>

                {/* Content Area */}
                <div className="p-6 flex flex-col flex-grow">
                  <h3 className="text-xl font-bold text-gray-900 mb-3 group-hover:text-[#3B82F6] transition-colors line-clamp-2 min-h-[3.5rem]">
                    {hackathon.title}
                  </h3>
                  
                  <div className="space-y-2.5 mb-6 flex-grow">
                    <div className="flex items-center gap-2.5 text-sm text-gray-600">
                      <Calendar className="w-4 h-4 text-[#3B82F6]" />
                      <span className="font-medium">
                        D-Day: {new Date(hackathon.period.submissionDeadlineAt).toLocaleDateString()} 까지
                      </span>
                    </div>
                    <div className="flex items-center gap-2.5 text-sm text-gray-600">
                      <MapPin className="w-4 h-4 text-[#3B82F6]" />
                      <span>{hackathon.location || '온라인/오프라인'}</span>
                    </div>
                    <div className="flex items-center gap-2.5 text-sm font-semibold text-gray-900">
                      <Trophy className="w-4 h-4 text-amber-500" />
                      <span>총 상금 ₩20,000,000+</span>
                    </div>
                  </div>

                  {/* Tags */}
                  <div className="flex flex-wrap gap-1.5">
                    {hackathon.tags.slice(0, 3).map((tag) => (
                      <Badge 
                        key={tag} 
                        variant="secondary" 
                        className="bg-blue-50 text-blue-600 border-0 hover:bg-blue-100 transition-colors"
                      >
                        #{tag}
                      </Badge>
                    ))}
                    {hackathon.tags.length > 3 && (
                      <Badge variant="outline" className="text-gray-400 border-gray-100">
                        +{hackathon.tags.length - 3}
                      </Badge>
                    )}
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
