// 챗봇 RAG (Retrieval Augmented Generation) API
// 내부 데이터만 사용하여 챗봇 응답 생성

import hackathons from '../data/public_hackathons.json'
import teams from '../data/public_teams.json'
import userAlice from '../data/UserData/user_alice.json'
import userBob from '../data/UserData/user_bob.json'
import userCharlie from '../data/UserData/user_charlie.json'
import userDiana from '../data/UserData/user_diana.json'
import userEvan from '../data/UserData/user_evan.json'

type HackathonData = (typeof hackathons)[0]
type TeamData = (typeof teams)[0]

interface UserData {
  id: string
  nickname: string
  points: number
  ranking: number
}

// 개인 사용자 데이터
const users: UserData[] = [
  { id: userAlice.id, nickname: userAlice.nickname, points: userAlice.points, ranking: userAlice.ranking },
  { id: userBob.id, nickname: userBob.nickname, points: userBob.points, ranking: userBob.ranking },
  { id: userCharlie.id, nickname: userCharlie.nickname, points: userCharlie.points, ranking: userCharlie.ranking },
  { id: userDiana.id, nickname: userDiana.nickname, points: userDiana.points, ranking: userDiana.ranking },
  { id: userEvan.id, nickname: userEvan.nickname, points: userEvan.points, ranking: userEvan.ranking }
]

// 포인트 기준 정렬
const usersByPoints = [...users].sort((a, b) => b.points - a.points)

// 텍스트 유사도 계산 (간단한 키워드 매칭)
const calculateSimilarity = (text1: string, text2: string): number => {
  const normalize = (s: string) => s.toLowerCase().trim()
  const t1 = normalize(text1).split(/\s+/)
  const t2 = normalize(text2).split(/\s+/)
  
  const matches = t1.filter(word => t2.some(w => w.includes(word) || word.includes(w)))
  return matches.length / Math.max(t1.length, t2.length)
}

// 해커톤 검색
const searchHackathons = (query: string): HackathonData[] => {
  const queryLower = query.toLowerCase()
  return hackathons
    .filter(h => 
      h.title.toLowerCase().includes(queryLower) ||
      h.tags.some(tag => tag.toLowerCase().includes(queryLower)) ||
      h.slug.toLowerCase().includes(queryLower)
    )
    .sort((a, b) => {
      const simA = calculateSimilarity(query, a.title)
      const simB = calculateSimilarity(query, b.title)
      return simB - simA
    })
}

// 팀 검색
const searchTeams = (query: string): TeamData[] => {
  const queryLower = query.toLowerCase()
  return teams
    .filter(t => 
      t.name.toLowerCase().includes(queryLower) ||
      t.intro.toLowerCase().includes(queryLower) ||
      t.lookingFor.some(role => role.toLowerCase().includes(queryLower))
    )
    .sort((a, b) => {
      const simA = calculateSimilarity(query, a.name)
      const simB = calculateSimilarity(query, b.name)
      return simB - simA
    })
}

// 상태별 해커톤 필터링
const getHackathonsByStatus = (status: 'ongoing' | 'upcoming' | 'ended'): HackathonData[] => {
  return hackathons.filter(h => h.status === status)
}

// 질문 의도 파악
const detectIntent = (query: string): string => {
  const queryLower = query.toLowerCase()
  
  if (queryLower.includes('진행중') || queryLower.includes('현재') || queryLower.includes('ongoing')) {
    return 'ongoing_hackathons'
  }
  if (queryLower.includes('앞으로') || queryLower.includes('예정') || queryLower.includes('upcoming')) {
    return 'upcoming_hackathons'
  }
  if ((queryLower.includes('팀') && queryLower.includes('랭킹')) || queryLower.includes('팀 순위')) {
    return 'team_ranking'
  }
  if (queryLower.includes('랭킹') || queryLower.includes('순위') || queryLower.includes('leaderboard')) {
    return 'leaderboard'
  }
  if (queryLower.includes('팀') || queryLower.includes('모집') || queryLower.includes('팀찾') || queryLower.includes('팀원')) {
    return 'teams'
  }
  if (queryLower.includes('해커톤') || queryLower.includes('대회') || queryLower.includes('hackathon')) {
    return 'hackathons'
  }
  if (queryLower.includes('도움말') || queryLower.includes('help') || queryLower.includes('?')) {
    return 'help'
  }
  
  return 'general'
}

// 챗봇 응답 생성
export const generateChatbotResponse = (userMessage: string): string => {
  const intent = detectIntent(userMessage)
  
  switch (intent) {
    case 'ongoing_hackathons': {
      const ongoing = getHackathonsByStatus('ongoing')
      if (ongoing.length === 0) {
        return '현재 진행 중인 해커톤이 없습니다. 다가오는 해커톤을 확인해보세요! 📅'
      }
      const list = ongoing
        .map(h => `• **${h.title}** (마감: ${new Date(h.period.submissionDeadlineAt).toLocaleDateString('ko-KR')})`)
        .join('\n')
      return `현재 진행 중인 해커톤입니다:\n\n${list}`
    }
    
    case 'upcoming_hackathons': {
      const upcoming = getHackathonsByStatus('upcoming')
      if (upcoming.length === 0) {
        return '예정된 해커톤이 없습니다. 다른 해커톤을 찾아보세요! 🔍'
      }
      const list = upcoming
        .map(h => `• **${h.title}** (시작: ${new Date(h.period.submissionDeadlineAt).toLocaleDateString('ko-KR')})`)
        .join('\n')
      return `앞으로 예정된 해커톤입니다:\n\n${list}`
    }
    
    case 'leaderboard': {
      if (usersByPoints.length === 0) {
        return '현재 이용 가능한 랭킹 정보가 없습니다. 😅'
      }
      const topUsers = usersByPoints.slice(0, 3)
      const list = topUsers
        .map((user, idx) => `${idx === 0 ? '🥇' : idx === 1 ? '🥈' : '🥉'} **${user.nickname}** (${user.points}점)`)
        .join('\n')
      return `**🏆 개인 포인트 랭킹** (상위 3명)\n\n${list}\n\n자세한 순위는 랭킹 페이지에서 확인하세요! 📊`
    }

    case 'team_ranking': {
      const teamsWithPoints = teams.map(team => ({
        ...team,
        totalPoints: team.memberCount * 100 // 팀원 수 기반 포인트 계산
      }))
      
      const topTeams = teamsWithPoints.sort((a, b) => b.totalPoints - a.totalPoints).slice(0, 3)
      
      if (topTeams.length === 0) {
        return '현재 팀 랭킹 정보가 없습니다. 😅'
      }
      
      const list = topTeams
        .map((team, idx) => `${idx === 0 ? '🥇' : idx === 1 ? '🥈' : '🥉'} **${team.name}** (${team.memberCount}명, ${team.totalPoints}점)`)
        .join('\n')
      return `**🏅 팀 랭킹** (상위 3팀)\n\n${list}\n\n더 많은 팀 정보는 팀 찾기 페이지에서 확인하세요! 👥`
    }
    
    case 'teams': {
      const openTeams = teams.filter(t => t.isOpen)
      
      // 팀 찾기 정보
      let response = ''
      if (openTeams.length === 0) {
        response = '현재 모집 중인 팀이 없습니다. 잠시 후 다시 확인해주세요! 👥'
      } else {
        const sample = openTeams.slice(0, 3)
        const teamList = sample
          .map(t => `• **${t.name}** (찾는 역할: ${t.lookingFor.join(', ')})`)
          .join('\n')
        response = `**👥 모집 중인 팀** (상위 3개):\n\n${teamList}\n\n`
      }
      
      // 팀 랭킹 추가
      const teamsWithPoints = teams.map(team => ({
        ...team,
        totalPoints: team.memberCount * 100
      }))
      
      const topTeams = teamsWithPoints.sort((a, b) => b.totalPoints - a.totalPoints).slice(0, 3)
      
      if (topTeams.length > 0) {
        const rankList = topTeams
          .map((team, idx) => `${idx === 0 ? '🥇' : idx === 1 ? '🥈' : '🥉'} **${team.name}** (${team.memberCount}명)`)
          .join('\n')
        response += `**🏅 팀 상위 랭킹**:\n\n${rankList}\n\n팀 찾기 페이지에서 더 많은 팀을 확인하세요! 🤝`
      } else {
        response += `팀 찾기 페이지에서 더 많은 팀을 확인하세요! 🤝`
      }
      
      return response
    }
    
    case 'hackathons': {
      const results = searchHackathons(userMessage)
      if (results.length === 0) {
        return '해당하는 해커톤을 찾을 수 없습니다. 다른 검색어로 시도해보세요! 🔍'
      }
      const sample = results.slice(0, 3)
      const list = sample
        .map(h => `• **${h.title}** (상태: ${h.status === 'ongoing' ? '진행중' : h.status === 'upcoming' ? '예정' : '종료'})`)
        .join('\n')
      return `찾은 해커톤입니다:\n\n${list}`
    }
    
    case 'help': {
      return `안녕하세요! 저는 해커톤 플랫폼 챗봇입니다. 다음과 같이 물어볼 수 있습니다:

📋 **해커톤 관련**
• "진행 중인 해커톤이 뭐가 있어?"
• "모델 경량화" (특정 해커톤 검색)
• "예정된 해커톤" (앞으로의 대회)

👥 **팀 관련**
• "팀 찾기" (모집 중인 팀)
• "팀 모집" (팀 정보)

📊 **순위 관련**
• "랭킹" (개인 포인트 순위)
• "팀 랭킹" (팀별 순위)

도움이 필요하면 언제든 물어봐주세요! 😊`
    }
    
    default: {
      // 키워드 기반 일반 검색
      const hackResults = searchHackathons(userMessage)
      const teamResults = searchTeams(userMessage)
      
      if (hackResults.length > 0) {
        return `**해커톤** 검색 결과:\n\n• **${hackResults[0].title}**\n태그: ${hackResults[0].tags.join(', ')}`
      }
      
      if (teamResults.length > 0) {
        return `**팀** 검색 결과:\n\n• **${teamResults[0].name}** (${teamResults[0].memberCount}명)\n${teamResults[0].intro}`
      }
      
      return `죄송하지만 정확히 이해하지 못했습니다. 😅\n다음과 같이 재시도해보세요:\n• "진행 중인 해커톤"\n• "팀 모집"\n• "도움말 (또는 ?)"을 입력해보세요!`
    }
  }
}
