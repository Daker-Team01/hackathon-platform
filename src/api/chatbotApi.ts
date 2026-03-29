// 챗봇 RAG (Retrieval Augmented Generation) API
// 내부 데이터만 사용하여 챗봇 응답 생성

import { normalizedHackathons as hackathons } from '../lib/hackathonData'
import teams from '../data/team_dummy_data.json'
import { allUsers } from '../contexts/UserContext'
import type { User } from '../contexts/UserContext'
import type { EventLog } from '../types/log'
import { retrieveVectorContext } from './chatbotVectorApi'


type HackathonData = (typeof hackathons)[0]
type TeamData = (typeof teams)[0]
type Intent =
  | 'ongoing_hackathons'
  | 'upcoming_hackathons'
  | 'team_ranking'
  | 'leaderboard'
  | 'teams'
  | 'hackathons'
  | 'help'
  | 'general'

interface UserData {
  id: string
  userId: string
  email: string
  nickname: string
  points: number
  ranking: number
  reputation: number
}

export type ChatbotAction = {
  label: string
  path: string
}

// 개인 사용자 데이터
const users: UserData[] = allUsers.map((user) => ({
  id: user.id,
  userId: user.userId,
  email: user.email,
  nickname: user.nickname,
  points: user.points,
  ranking: user.ranking,
  reputation: user.reputation
}))

// 포인트 기준 정렬
const usersByPoints = [...users].sort((a, b) => {
  if (b.points !== a.points) return b.points - a.points
  return b.reputation - a.reputation
})

const rankingByUserId = new Map(usersByPoints.map((u, idx) => [u.userId, idx + 1] as const))

const getCanonicalUserRank = (user: User): number => {
  return rankingByUserId.get(user.userId) ?? rankingByUserId.get(user.id) ?? user.ranking
}

// 로그인 유저 컨텍스트 문자열 생성
const buildCurrentUserContext = (user: User): string => {
  const canonicalRank = getCanonicalUserRank(user)
  const parts: string[] = [
    `사용자 고유키: ${user.userId}`,
    `닉네임: ${user.nickname}`,
    `이메일: ${user.email}`,
    `포인트: ${user.points}점`,
    `현재 랭킹: ${canonicalRank}위 (userId 기준 계산)`,
    `활동 점수: ${user.activityScore}`,
    `평판 점수: ${user.reputation}`,
  ]
  if (user.techStack.length > 0) {
    parts.push(`기술 스택: ${user.techStack.join(', ')}`)
  }
  if (user.preferredRoles.length > 0) {
    parts.push(`선호 역할: ${user.preferredRoles.join(', ')}`)
  }
  if (user.personalityTags.length > 0) {
    parts.push(`성향 태그: ${user.personalityTags.join(', ')}`)
  }
  const ws = user.workStyle
  parts.push(`업무 스타일: 소통(${ws.communication}), 리더십(${ws.leadership}), 실행력(${ws.execution})`)
  if (user.participations.length > 0) {
    const lines = user.participations.map(
      (p) =>
        `  - 해커톤:${p.hackathonSlug} | 팀:${p.teamCode} | 역할:${p.role} | ${
          p.isLeader ? '팀장' : '팀원'
        } | 기여점수:${p.contributionScore} | 상태:${p.status}`
    )
    parts.push(`참여 해커톤 이력:\n${lines.join('\n')}`)
  } else {
    parts.push('참여 해커톤 이력: 없음')
  }
  return parts.join('\n')
}

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
const detectIntent = (query: string): Intent => {
  const queryLower = query.toLowerCase()
  const compactQuery = queryLower.replace(/\s+/g, '')
  
  if (compactQuery.includes('진행중') || queryLower.includes('현재') || queryLower.includes('ongoing')) {
    return 'ongoing_hackathons'
  }
  if (compactQuery.includes('앞으로') || compactQuery.includes('예정') || queryLower.includes('upcoming')) {
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

const getActionByIntent = (intent: Intent): ChatbotAction | undefined => {
  switch (intent) {
    case 'ongoing_hackathons':
    case 'hackathons':
      return { label: '해커톤 페이지로 이동', path: '/hackathons' }
    case 'teams':
    case 'team_ranking':
      return { label: '팀 찾기 페이지로 이동', path: '/camp' }
    case 'leaderboard':
      return { label: '랭킹 페이지로 이동', path: '/rankings' }
    default:
      return undefined
  }
}

export const getChatbotAction = (userMessage: string): ChatbotAction | undefined => {
  const intent = detectIntent(userMessage)
  return getActionByIntent(intent)
}

// ─── OpenAI ──────────────────────────────────────────────────────────────────
const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions'
const OPENAI_API_KEY = import.meta.env.VITE_OPENAI_API_KEY as string | undefined
const OPENAI_CHATBOT_MODEL = 'gpt-4o-mini'
const OPENAI_CHATBOT_FALLBACK_NOTICE = '현재 OpenAI 챗봇 응답이 불가능해 기본 답변 모드로 동작 중입니다. (API 키/모델 설정 확인 필요)'
const OPENAI_PERSONAL_ANALYSIS_MODEL = 'gpt-4o-mini'
const OPENAI_PERSONAL_ANALYSIS_FALLBACK_NOTICE = '현재 OpenAI 개인 분석 응답이 불가능해 기본 분석 모드로 동작 중입니다. (API 키/모델 설정 확인 필요)'

const FALLBACK_ACTION_WEIGHTS: Record<string, number> = {
  submit_project: 1.0,
  team_create: 0.9,
  hackathon_join: 0.85,
  team_join: 0.8,
  team_request_create: 0.7,
  invite_send: 0.65,
  chatbot_query: 0.3,
  hackathon_view: 0.2,
  tab_view: 0.1,
}

/**
 * GPT-4o-mini로 액션 타입별 중요도를 0~1 사이 점수로 분류합니다.
 * API 키 미설정 또는 오류 시 규칙 기반 fallback 가중치를 반환합니다.
 */
export const classifyLogImportance = async (): Promise<Record<string, number>> => {
  if (!OPENAI_API_KEY) return FALLBACK_ACTION_WEIGHTS

  const actionList = Object.keys(FALLBACK_ACTION_WEIGHTS).join(', ')

  try {
    const res = await fetch(OPENAI_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        max_tokens: 250,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content:
              '당신은 개발자 해커톤 플랫폼의 데이터 분석 전문가입니다. ' +
              '주어진 사용자 액션 타입이 "개발자의 기술 성장 및 협업 행동 분석"에 얼마나 중요한지 0.0~1.0 점수로 평가합니다. ' +
              '단순 조회(view, tab_view)는 낮게, 실질적 참여·제출·협업 행동은 높게 평가하세요. ' +
              '반드시 JSON 객체({action_type: score}) 형식으로만 응답하세요.',
          },
          {
            role: 'user',
            content: `다음 액션 타입들의 중요도를 0.0~1.0 사이 숫자로 평가해 JSON으로만 반환하세요:\n${actionList}`,
          },
        ],
      }),
    })

    if (!res.ok) return FALLBACK_ACTION_WEIGHTS

    const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> }
    const content = data.choices?.[0]?.message?.content
    if (!content) return FALLBACK_ACTION_WEIGHTS

    const parsed = JSON.parse(content) as Record<string, unknown>
    const result: Record<string, number> = {}
    for (const [key, fallback] of Object.entries(FALLBACK_ACTION_WEIGHTS)) {
      const v = parsed[key]
      result[key] = typeof v === 'number' ? Math.max(0, Math.min(1, v)) : fallback
    }
    return result
  } catch {
    return FALLBACK_ACTION_WEIGHTS
  }
}

const isPersonalQuery = (query: string): boolean => {
  return /(\bme\b|\bmy\b|나|내|저|내정보|내 정보|프로필|개인|분석)/i.test(query)
}

const buildIntentContext = (userMessage: string, intent: Intent, currentUser?: User): string => {

  const parts: string[] = [
    `[QUERY]\n${userMessage}`,
    `[INTENT]\n${intent}`
  ]

  if (intent === 'ongoing_hackathons') {
    const ongoing = getHackathonsByStatus('ongoing').slice(0, 4)
    const lines = ongoing.length
      ? ongoing.map((h) => `${h.title} | 마감:${new Date(h.period.submissionDeadlineAt).toLocaleDateString('ko-KR')} | 태그:${h.tags.slice(0, 3).join(',')}`).join('\n')
      : '없음'
    parts.push(`[HACKATHONS]\n${lines}`)
  }

  if (intent === 'upcoming_hackathons') {
    const upcoming = getHackathonsByStatus('upcoming').slice(0, 4)
    const lines = upcoming.length
      ? upcoming.map((h) => `${h.title} | 마감:${new Date(h.period.submissionDeadlineAt).toLocaleDateString('ko-KR')} | 태그:${h.tags.slice(0, 3).join(',')}`).join('\n')
      : '없음'
    parts.push(`[HACKATHONS]\n${lines}`)
  }

  if (intent === 'hackathons' || intent === 'general') {
    const searched = searchHackathons(userMessage).slice(0, 4)
    if (searched.length > 0) {
      parts.push(`[HACKATHONS]\n${searched.map((h) => `${h.title} | 상태:${h.status} | 태그:${h.tags.slice(0, 3).join(',')}`).join('\n')}`)
    }
  }

  if (intent === 'teams' || intent === 'team_ranking' || intent === 'general') {
    const searchedTeams = searchTeams(userMessage)
    const targetTeams = searchedTeams.length > 0 ? searchedTeams.slice(0, 4) : teams.filter((t) => t.isOpen).slice(0, 4)
    if (targetTeams.length > 0) {
      parts.push(`[TEAMS]\n${targetTeams.map((t) => `${t.name} | 모집:${t.isOpen ? '열림' : '닫힘'} | 역할:${t.lookingFor.slice(0, 3).join(',')}`).join('\n')}`)
    }
  }

  if (intent === 'leaderboard' || intent === 'team_ranking') {
    const topUsers = usersByPoints.slice(0, 5)
    parts.push(`[RANKING]\n${topUsers.map((u, idx) => `${idx + 1}위 ${u.nickname} ${u.points}점`).join('\n')}`)
  }

  if (currentUser && (isPersonalQuery(userMessage) || intent === 'leaderboard')) {
    parts.push(`[CURRENT_USER]\n${buildCurrentUserContext(currentUser)}`)
  }

  if (intent === 'help') {
    parts.push('[SUPPORTED_FEATURES]\n해커톤 검색, 진행/예정 해커톤 조회, 팀 찾기, 팀 랭킹, 개인 랭킹, 로그인 유저 프로필 분석')
  }

  return parts.join('\n\n')
}

const generateOpenAIResponse = async (userMessage: string, currentUser?: User): Promise<string | null> => {
  if (!OPENAI_API_KEY) {
    return null
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 10000)

  try {
    const intent = detectIntent(userMessage)
    const selectedContext = buildIntentContext(userMessage, intent, currentUser)
    const vectorContext = await retrieveVectorContext(userMessage, intent)
    const finalContext = vectorContext ? `${selectedContext}\n\n${vectorContext}` : selectedContext

    const systemPrompt = [
      '당신은 해커톤 플랫폼 AI입니다.',
      '항상 한국어로 답하세요.',
      '반드시 전달된 컨텍스트만 사용하세요.',
      '질문 의도([INTENT])와 관련된 섹션만 우선 사용하세요.',
      '데이터가 있으면 구체 항목(이름/상태/점수)을 반드시 포함하세요.',
      '불필요한 반복/장황한 설명은 금지합니다.',
      '답변 형식: 요약 1~2문장 + 핵심 목록 2~5개 + 마지막 한 줄 제안.'
    ].join('\n')

    const response = await fetch(OPENAI_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: OPENAI_CHATBOT_MODEL,
        temperature: 0.4,
        max_tokens: 520,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `질문:\n${userMessage}\n\n선택된 컨텍스트:\n${finalContext}` }
        ]
      }),
      signal: controller.signal
    })

    if (!response.ok) {
      let reason = `${response.status}`
      try {
        const errorData = (await response.json()) as { error?: { message?: string; type?: string; code?: string } }
        reason = `${response.status} ${errorData.error?.type ?? ''} ${errorData.error?.code ?? ''} ${errorData.error?.message ?? ''}`.trim()
      } catch {
        // no-op: keep status-only reason
      }
      console.warn('OpenAI API non-OK response:', reason)
      return null
    }

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>
    }

    const content = data.choices?.[0]?.message?.content?.trim()
    return content || null
  } catch (error) {
    console.warn('OpenAI response failed, fallback to local rule response:', error)
    return null
  } finally {
    clearTimeout(timer)
  }
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

export const generateChatbotResponseWithFallback = async (
  userMessage: string,
  currentUser?: User
): Promise<string> => {
  const openAIResponse = await generateOpenAIResponse(userMessage, currentUser)
  if (openAIResponse) {
    return openAIResponse
  }
  const ruleBased = generateChatbotResponse(userMessage)
  if (OPENAI_API_KEY) {
    return `${OPENAI_CHATBOT_FALLBACK_NOTICE}\n\n${ruleBased}`
  }
  return ruleBased
}

const buildPersonalRuleBasedReport = (user: User, logs: EventLog[]): string => {
  const totalLogs = logs.length
  const actionCounts = logs.reduce<Record<string, number>>((acc, log) => {
    acc[log.action_type] = (acc[log.action_type] || 0) + 1
    return acc
  }, {})

  const topActions = Object.entries(actionCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([name, count]) => `- ${name}: ${count}회`)

  const recommendations: string[] = []
  if ((actionCounts.team_create || 0) === 0) {
    recommendations.push('- 팀 생성/팀장 경험을 1회 이상 시도해 협업 리더십 로그를 확보하세요.')
  }
  if ((actionCounts.submit_project || 0) < 2) {
    recommendations.push('- 제출 경험이 적으니 작은 기능 단위라도 주 1회 제출 루틴을 만드세요.')
  }
  if ((actionCounts.hackathon_view || 0) > (actionCounts.hackathon_join || 0) * 4) {
    recommendations.push('- 조회 대비 참가 전환이 낮습니다. 관심 해커톤 3개를 고정해 바로 지원하세요.')
  }
  if (recommendations.length === 0) {
    recommendations.push('- 현재 전환 흐름이 안정적입니다. 다음 목표는 팀 빌딩 속도 개선입니다.')
  }

  return [
    `개인 분석 요약: ${user.nickname}님의 최근 활동 로그 ${totalLogs}건을 기반으로 분석했습니다.`,
    '',
    '핵심 지표',
    `- 포인트: ${user.points}점`,
    `- 랭킹: ${user.ranking}위`,
    `- 활동 점수: ${user.activityScore}`,
    `- 평판: ${user.reputation}`,
    '',
    '자주 한 활동',
    ...(topActions.length > 0 ? topActions : ['- 활동 로그가 충분하지 않습니다.']),
    '',
    '추천 액션',
    ...recommendations,
    '- 다음 7일 동안 참가 1회 + 팀 협업 1회 + 제출 1회를 목표로 설정하세요.'
  ].join('\n')
}

export const generatePersonalAnalyticsWithFallback = async (
  currentUser: User,
  userLogs: EventLog[]
): Promise<string> => {
  const actionCounts = userLogs.reduce<Record<string, number>>((acc, log) => {
    acc[log.action_type] = (acc[log.action_type] || 0) + 1
    return acc
  }, {})

  const recentLogs = [...userLogs]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 120)

  const compactRecentLogs = recentLogs.map((log) => {
    const metaSummary = log.metadata ? JSON.stringify(log.metadata).slice(0, 180) : ''
    return `${log.created_at} | ${log.action_type} | target=${log.target_id}${metaSummary ? ` | meta=${metaSummary}` : ''}`
  })

  const prompt = [
    '[USER_PROFILE]',
    `userId: ${currentUser.userId}`,
    `nickname: ${currentUser.nickname}`,
    `points: ${currentUser.points}`,
    `ranking: ${currentUser.ranking}`,
    `activityScore: ${currentUser.activityScore}`,
    `reputation: ${currentUser.reputation}`,
    `preferredRoles: ${currentUser.preferredRoles.join(', ') || '없음'}`,
    `techStack: ${currentUser.techStack.join(', ') || '없음'}`,
    `personalityTags: ${currentUser.personalityTags.join(', ') || '없음'}`,
    '',
    '[ACTION_COUNTS]',
    ...Object.entries(actionCounts)
      .sort((a, b) => b[1] - a[1])
      .map(([name, count]) => `${name}: ${count}`),
    '',
    '[RECENT_LOGS]',
    ...compactRecentLogs
  ].join('\n')

  if (!OPENAI_API_KEY) {
    return buildPersonalRuleBasedReport(currentUser, userLogs)
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 15000)

  try {
    const response = await fetch(OPENAI_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: OPENAI_PERSONAL_ANALYSIS_MODEL,
        temperature: 0.35,
        max_tokens: 900,
        messages: [
          {
            role: 'system',
            content: [
              '당신은 해커톤 활동 분석 코치입니다.',
              '항상 한국어로 답하세요.',
              '주어진 사용자 정보와 로그만 기반으로 분석하세요.',
              '형식: 1)한줄 요약 2)강점 3)병목/리스크 4)추천 액션 5개 5)다음 7일 실행 계획.',
              '추천 액션은 구체적이며 바로 실행 가능한 형태로 작성하세요.'
            ].join('\n')
          },
          {
            role: 'user',
            content: `아래 데이터를 기반으로 개인 분석 보고서를 작성해줘.\n\n${prompt}`
          }
        ]
      }),
      signal: controller.signal
    })

    if (!response.ok) {
      return `${OPENAI_PERSONAL_ANALYSIS_FALLBACK_NOTICE}\n\n${buildPersonalRuleBasedReport(currentUser, userLogs)}`
    }

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>
    }
    const content = data.choices?.[0]?.message?.content?.trim()

    if (!content) {
      return `${OPENAI_PERSONAL_ANALYSIS_FALLBACK_NOTICE}\n\n${buildPersonalRuleBasedReport(currentUser, userLogs)}`
    }

    return content
  } catch {
    return `${OPENAI_PERSONAL_ANALYSIS_FALLBACK_NOTICE}\n\n${buildPersonalRuleBasedReport(currentUser, userLogs)}`
  } finally {
    clearTimeout(timer)
  }
}
