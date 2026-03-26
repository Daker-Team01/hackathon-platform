import { Link } from 'react-router-dom'
import { Search, Users, Trophy, BarChart3, ArrowRightLeft } from 'lucide-react'
import { Card } from '@/components/ui/card'
import insighthonLogo from '../assets/insighthon_logo.png'

export default function Home() {
  const features = [
    {
      title: '해커톤 찾기',
      description: '다양한 해커톤을 탐색하고 참여하세요',
      icon: Search,
      link: '/hackathons',
      gradient: 'from-[#3B82F6] to-[#0EA5E9]'
    },
    {
      title: '팀 찾기',
      description: '함께할 팀원을 찾거나 팀을 만드세요',
      icon: Users,
      link: '/camp',
      gradient: 'from-[#0EA5E9] to-[#3B82F6]'
    },
    {
      title: '랭킹',
      description: '글로벌 해커톤 랭킹을 확인하세요',
      icon: Trophy,
      link: '/rankings',
      gradient: 'from-[#3B82F6] to-[#0EA5E9]'
    },
    {
      title: '분석',
      description: '해커톤 트렌드와 통계를 살펴보세요',
      icon: BarChart3,
      link: '/analytics',
      gradient: 'from-[#0EA5E9] to-[#3B82F6]'
    },
    {
      title: 'AI 매칭 랩',
      description: '팀과 팀원을 벡터 검색으로 직접 비교해보세요',
      icon: ArrowRightLeft,
      link: '/matcher',
      gradient: 'from-[#2563EB] to-[#38BDF8]'
    }
  ]

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="text-center mb-16 pt-12">
        <h1 className="text-6xl font-bold mb-6 leading-tight bg-gradient-to-r from-[#3B82F6] to-[#0EA5E9] bg-clip-text text-transparent">
          해커톤의 인사이트를 켜다,
        </h1>
        <div className="flex justify-center mb-6">
          <img src={insighthonLogo} alt="Insighthon" className="h-28 w-auto object-contain" />
        </div>
        <p className="text-xl text-gray-700 mb-8 max-w-2xl mx-auto">
          전 세계의 해커톤을 탐색하고, 팀을 구성하고, 경쟁하세요
        </p>
        <div className="flex flex-wrap gap-4 justify-center">
          <Link to="/hackathons">
            <button className="px-8 py-4 bg-gradient-to-r from-[#3B82F6] to-[#0EA5E9] text-white font-semibold rounded-xl shadow-lg hover:shadow-2xl hover:scale-105 transition-all duration-300">
              시작하기
            </button>
          </Link>
          <Link to="/analytics">
            <button className="px-8 py-4 bg-white/90 border-2 border-[#3B82F6]/15 text-gray-900 font-semibold rounded-xl shadow-lg hover:shadow-2xl hover:scale-105 transition-all duration-300">
              더 알아보기
            </button>
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-16">
        {features.map((feature) => (
          <Link key={feature.title} to={feature.link} className="block">
            <Card className="p-8 bg-white/85 backdrop-blur-md border border-[#3B82F6]/10 shadow-xl hover:shadow-2xl hover:scale-[1.02] transition-all duration-300 cursor-pointer group h-full">
              <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${feature.gradient} flex items-center justify-center mb-6 group-hover:rotate-6 transition-transform duration-300`}>
                <feature.icon className="w-8 h-8 text-white" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-3">{feature.title}</h2>
              <p className="text-gray-600 leading-relaxed">{feature.description}</p>
            </Card>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-20">
        <Card className="p-8 bg-white/75 backdrop-blur-sm border border-[#3B82F6]/10 shadow-lg text-center">
          <div className="text-4xl font-extrabold text-[#3B82F6] mb-2">250+</div>
          <div className="text-gray-600 font-medium">진행중인 해커톤</div>
        </Card>
        <Card className="p-8 bg-white/75 backdrop-blur-sm border border-[#3B82F6]/10 shadow-lg text-center">
          <div className="text-4xl font-extrabold text-[#3B82F6] mb-2">15,000+</div>
          <div className="text-gray-600 font-medium">활성 사용자</div>
        </Card>
        <Card className="p-8 bg-white/75 backdrop-blur-sm border border-[#3B82F6]/10 shadow-lg text-center">
          <div className="text-4xl font-extrabold text-[#3B82F6] mb-2">500+</div>
          <div className="text-gray-600 font-medium">형성된 팀</div>
        </Card>
      </div>
    </div>
  )
}
