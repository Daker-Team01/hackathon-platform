import { useSearchParams, useNavigate, Link } from "react-router-dom"
import { 
  Users, MessageSquare, Plus, ArrowLeft, Filter, 
  Settings, Edit, Lock, Unlock, ExternalLink, Shield
} from "lucide-react"

import { useTeams, useUpdateTeam } from "../hooks/useTeams"
import { useUser } from "../contexts/UserContext"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

export default function Camp() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const slug = params.get("hackathon") || undefined

  const { data: teams, isLoading } = useTeams(slug)
  const mutation = useUpdateTeam()
  const { user } = useUser()

  const handleToggleOpen = (teamCode: string, currentIsOpen: boolean) => {
    mutation.mutate({ teamCode, updates: { isOpen: !currentIsOpen } })
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Navigation & Header */}
      <div className="flex items-center justify-between mb-8">
        <Button 
          variant="ghost" 
          onClick={() => navigate('/')}
          className="hover:bg-gray-100 -ml-2 text-gray-600"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          메인으로
        </Button>
        <div className="flex gap-3">
          <Link to="/camp/new">
            <Button className="bg-gradient-to-r from-[#3B82F6] to-[#0EA5E9] text-white hover:opacity-90 shadow-lg rounded-xl px-6">
              <Plus className="w-4 h-4 mr-2" />
              팀 모집글 생성
            </Button>
          </Link>
        </div>
      </div>

      <div className="mb-10">
        <h1 className="text-4xl font-extrabold text-gray-900 mb-4 tracking-tight flex items-center gap-3">
          <Users className="w-10 h-10 text-[#3B82F6]" />
          팀원 모집
        </h1>
        <p className="text-gray-600 text-lg max-w-2xl font-medium">
          함께 혁신을 만들어갈 최고의 팀원을 찾아보세요.
        </p>
        
        {slug && (
          <div className="mt-6 flex items-center gap-2">
            <Badge variant="secondary" className="bg-blue-50 text-blue-700 px-4 py-1.5 border-blue-100 flex items-center gap-2 text-sm">
              <Filter className="w-3 h-3" />
              해커톤: {slug}
            </Badge>
            <Button variant="ghost" size="sm" onClick={() => navigate('/camp')} className="text-gray-400 hover:text-gray-600 text-xs">
              필터 해제
            </Button>
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-64 bg-gray-50 rounded-3xl animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {teams?.map((team) => {
            const isAuthor = user && user.id === team.leaderId
            
            return (
              <Card 
                key={team.teamCode} 
                className={`p-8 border-0 shadow-xl bg-white rounded-3xl hover:shadow-2xl transition-all duration-300 group relative overflow-hidden`}
              >
                {/* Status Badge Overlays */}
                <div className="absolute top-0 right-0 p-6 flex gap-2">
                  <Badge className={`${team.isOpen ? 'bg-emerald-500' : 'bg-red-500'} text-white border-0 shadow-sm`}>
                    {team.isOpen ? "모집중" : "모집마감"}
                  </Badge>
                  {isAuthor && (
                    <Badge className="bg-blue-600 text-white border-0 shadow-sm flex items-center gap-1">
                      <Shield className="w-3 h-3" />
                      내 팀
                    </Badge>
                  )}
                </div>

                {/* Content */}
                <div className="mb-6">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs font-bold text-gray-300 tracking-widest uppercase">{team.teamCode}</span>
                    <span className="text-gray-200">•</span>
                    <span className="text-xs font-bold text-blue-500 uppercase tracking-widest">{team.hackathonSlug || '일반 프로젝트'}</span>
                  </div>
                  <h3 className="text-2xl font-black text-gray-900 group-hover:text-blue-600 transition-colors flex items-center gap-3 mb-4">
                    {team.name}
                    <span className="text-lg font-bold text-gray-400">({team.memberCount}/{team.maxMembers}명)</span>
                  </h3>
                  <p className="text-gray-600 leading-relaxed min-h-[3rem] line-clamp-2">
                    {team.intro}
                  </p>
                </div>

                <div className="space-y-4 mb-8">
                  <div className="flex flex-wrap gap-2">
                    <span className="text-sm font-bold text-gray-400 mr-2 self-center uppercase tracking-tighter">Looking for:</span>
                    {team.lookingFor.length > 0 ? (
                      team.lookingFor.map(role => (
                        <Badge key={role} variant="outline" className="bg-gray-50 text-gray-600 border-gray-100 rounded-lg px-3">
                          {role}
                        </Badge>
                      ))
                    ) : (
                      <span className="text-sm text-gray-400 italic">모집 인원 없음</span>
                    )}
                  </div>
                </div>
                
                <div className="flex flex-wrap items-center gap-3 pt-6 border-t border-gray-50 mt-auto">
                  {team.contact.url && (
                    <a href={team.contact.url} target="_blank" rel="noopener noreferrer" className="flex-grow sm:flex-grow-0">
                      <Button className="w-full bg-blue-50 text-blue-600 hover:bg-blue-100 border-0 rounded-xl font-bold">
                        <MessageSquare className="w-4 h-4 mr-2" />
                        연락하기
                        <ExternalLink className="w-3 h-3 ml-2 opacity-50" />
                      </Button>
                    </a>
                  )}
                  
                  {isAuthor && (
                    <div className="flex flex-wrap gap-2 w-full sm:w-auto">
                      <Button 
                        variant="secondary"
                        onClick={() => handleToggleOpen(team.teamCode, team.isOpen)}
                        className={`rounded-xl font-bold ${team.isOpen ? 'bg-amber-100 text-amber-700 hover:bg-amber-200' : 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'}`}
                      >
                        {team.isOpen ? <Lock className="w-4 h-4 mr-2" /> : <Unlock className="w-4 h-4 mr-2" />}
                        {team.isOpen ? "마감" : "재모집"}
                      </Button>

                      <Link to={`/camp/edit/${team.teamCode}`}>
                        <Button variant="outline" className="rounded-xl font-bold border-gray-100 hover:bg-gray-50">
                          <Edit className="w-4 h-4 mr-2 text-gray-400" />
                          수정
                        </Button>
                      </Link>

                      <Link to={`/team/${team.teamCode}/manage`}>
                        <Button className="bg-gray-900 text-white hover:bg-gray-800 rounded-xl font-bold shadow-lg">
                          <Settings className="w-4 h-4 mr-2" />
                          관리
                        </Button>
                      </Link>
                    </div>
                  )}
                </div>
              </Card>
            )
          })}
        </div>
      )}

      {!isLoading && teams?.length === 0 && (
        <div className="text-center py-32 bg-gray-50/50 border-2 border-dashed border-gray-100 rounded-[3rem]">
          <Users className="w-16 h-16 text-gray-200 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-gray-900 mb-2">모집 중인 팀이 없습니다.</h3>
          <p className="text-gray-500 mb-8">첫 번째로 팀 모집글을 작성해보세요!</p>
          <Link to="/camp/new">
            <Button className="bg-[#3B82F6] text-white rounded-xl px-8 py-6 text-lg font-bold shadow-xl">
              <Plus className="w-5 h-5 mr-2" />
              팀 모집글 생성하기
            </Button>
          </Link>
        </div>
      )}
    </div>
  )
}
