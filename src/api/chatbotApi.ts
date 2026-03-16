// 챗봇 RAG (Retrieval Augmented Generation) API
// 개선된 구조: User Question → retrieveContext() → Context 생성 → OpenAI LLM → Response

import OpenAI from 'openai'
import hackathons from '../data/public_hackathons.json'
import teams from '../data/public_teams.json'
import leaderboard from '../data/public_leaderboard.json'

// OpenAI 클라이언트 초기화
const openai = new OpenAI({
  apiKey: import.meta.env.VITE_OPENAI_API_KEY || '',
  dangerouslyAllowBrowser: true // 브라우저 환경에서만 사용
})

// ==================== 1. 토큰화 및 유사도 계산 ====================
const tokenize = (text: string): string[] => {
  return text
    .toLowerCase()
    .replace(/[^\w가-힣\s]/g, '')
    .split(/\s+/)
    .filter(token => token.length > 1)
}

const calculateCosineSimilarity = (vec1: string[], vec2: string[]): number => {
  const tokens1 = new Set(vec1)
  const tokens2 = new Set(vec2)
  
  const intersection = [...tokens1].filter(t => tokens2.has(t)).length
  const union = new Set([...tokens1, ...tokens2]).size
  
  if (union === 0) return 0
  return intersection / union
}

// ==================== 2. Context 검색 ====================
interface RetrievedContext {
  type: 'hackathon' | 'team' | 'info' | 'leaderboard'
  data: string
  relevance: number
}

const retrieveContext = (query: string, topK: number = 5): RetrievedContext[] => {
  const queryTokens = tokenize(query)
  const results: RetrievedContext[] = []

  // 해커톤 데이터 검색
  hackathons.forEach(h => {
    const content = `${h.title} ${h.tags.join(' ')}`
    const contentTokens = tokenize(content)
    const similarity = calculateCosineSimilarity(queryTokens, contentTokens)
    
    if (similarity > 0) {
      results.push({
        type: 'hackathon',
        data: JSON.stringify({
          title: h.title,
          status: h.status,
          tags: h.tags,
          deadline: h.period.submissionDeadlineAt
        }),
        relevance: similarity
      })
    }
  })

  // 팀 데이터 검색
  teams.forEach(t => {
    const content = `${t.name} ${t.intro} ${t.lookingFor.join(' ')}`
    const contentTokens = tokenize(content)
    const similarity = calculateCosineSimilarity(queryTokens, contentTokens)
    
    if (similarity > 0) {
      results.push({
        type: 'team',
        data: JSON.stringify({
          name: t.name,
          intro: t.intro,
          lookingFor: t.lookingFor,
          isOpen: t.isOpen,
          memberCount: t.memberCount
        }),
        relevance: similarity
      })
    }
  })

  // 랭킹 데이터 검색
  if (queryTokens.some(t => ['랭킹', '순위', '성적', '점수'].includes(t))) {
    if (leaderboard.entries && leaderboard.entries.length > 0) {
      const leaderboardData = leaderboard.entries.slice(0, 5).map(e => ({
        rank: e.rank,
        teamName: e.teamName,
        score: e.score
      }))
      
      results.push({
        type: 'leaderboard',
        data: JSON.stringify(leaderboardData),
        relevance: 0.8
      })
    }
  }

  // 추가 정보 검색
  const infoData = JSON.stringify({
    totalHackathons: hackathons.length,
    totalTeams: teams.length,
    ongoingCount: hackathons.filter(h => h.status === 'ongoing').length
  })
  const infoTokens = tokenize(infoData)
  const infoSimilarity = calculateCosineSimilarity(queryTokens, infoTokens)
  
  results.push({
    type: 'info',
    data: infoData,
    relevance: infoSimilarity
  })

  // 유사도 순으로 정렬 후 상위 K개 반환
  return results.sort((a, b) => b.relevance - a.relevance).slice(0, topK)
}

// ==================== 3. Context를 문자열로 포맷팅 ====================
const formatContextAsString = (contexts: RetrievedContext[]): string => {
  let contextString = '=== 관련 정보 ===\n\n'
  
  const hackathonContexts = contexts.filter(c => c.type === 'hackathon')
  const teamContexts = contexts.filter(c => c.type === 'team')
  const leaderboardContexts = contexts.filter(c => c.type === 'leaderboard')
  const infoContexts = contexts.filter(c => c.type === 'info')
  
  if (hackathonContexts.length > 0) {
    contextString += '📋 해커톤 정보:\n'
    hackathonContexts.forEach((ctx, idx) => {
      const data = JSON.parse(ctx.data)
      contextString += `${idx + 1}. ${data.title}\n`
      contextString += `   상태: ${data.status === 'ongoing' ? '진행중' : data.status === 'upcoming' ? '예정' : '종료'}\n`
      contextString += `   태그: ${data.tags.join(', ')}\n`
      contextString += `   마감: ${new Date(data.deadline).toLocaleDateString('ko-KR')}\n\n`
    })
  }
  
  if (teamContexts.length > 0) {
    contextString += '👥 팀 정보:\n'
    teamContexts.forEach((ctx, idx) => {
      const data = JSON.parse(ctx.data)
      contextString += `${idx + 1}. ${data.name} (${data.memberCount}명)\n`
      contextString += `   모집: ${data.isOpen ? '진행중' : '마감'}\n`
      contextString += `   찾는 역할: ${data.lookingFor.join(', ')}\n`
      contextString += `   소개: ${data.intro}\n\n`
    })
  }
  
  if (leaderboardContexts.length > 0) {
    contextString += '🏆 랭킹 정보:\n'
    const rankings = JSON.parse(leaderboardContexts[0].data)
    rankings.forEach((entry: { rank: number; teamName: string; score: number }) => {
      const medal = entry.rank === 1 ? '🥇' : entry.rank === 2 ? '🥈' : entry.rank === 3 ? '🥉' : '📍'
      contextString += `${medal} ${entry.rank}등: ${entry.teamName} (${entry.score}점)\n`
    })
    contextString += '\n'
  }
  
  if (infoContexts.length > 0) {
    const info = JSON.parse(infoContexts[0].data)
    contextString += '📊 플랫폼 정보:\n'
    contextString += `• 전체 해커톤: ${info.totalHackathons}개 (진행중: ${info.ongoingCount}개)\n`
    contextString += `• 전체 팀: ${info.totalTeams}개\n`
  }
  
  return contextString
}

// ==================== 4. OpenAI LLM 호출 ====================
const callOpenAIWithContext = async (userMessage: string, contextString: string): Promise<string> => {
  try {
    if (!import.meta.env.VITE_OPENAI_API_KEY) {
      return '⚠️ OpenAI API 키가 설정되지 않았습니다.\n.env.local 파일에 VITE_OPENAI_API_KEY를 추가해주세요.'
    }

    const systemPrompt = `당신은 해커톤 플랫폼의 친절한 AI 어시스턴트입니다.
사용자의 질문에 대해 제공된 관련 정보(Context)를 활용하여 정확하고 도움이 되는 답변을 제공합니다.
답변은 한국어로 자연스럽고 친근하게 작성하세요.
이모지를 적절히 사용하여 표현을 더 생생하게 만들 수 있습니다.
질문과 관련된 정보가 없으면 솔직하게 알 수 없다고 말하세요.`

    const userPrompt = `<Context>
${contextString}
</Context>

사용자 질문: ${userMessage}

위 Context 정보를 활용하여 사용자의 질문에 답해주세요.`

    const response = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      max_tokens: 1024,
      messages: [
        {
          role: 'system',
          content: systemPrompt
        },
        {
          role: 'user',
          content: userPrompt
        }
      ]
    })

    const assistantMessage = response.choices[0]?.message?.content
    
    if (assistantMessage) {
      return assistantMessage
    }
    
    return '응답 생성에 실패했습니다.'
  } catch (error: unknown) {
    console.error('OpenAI API 호출 오류:', error)
    
    const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류'
    
    // API 키 오류
    if (errorMessage.includes('401')) {
      return '❌ API 키 인증 실패.\n올바른 OpenAI API 키를 확인해주세요.'
    }
    
    // 네트워크 오류
    if (errorMessage.includes('fetch') || errorMessage.includes('network')) {
      return '🌐 네트워크 연결을 확인해주세요.'
    }
    
    // 기본 오류 메시지
    return '죄송하지만 지금 응답을 생성할 수 없습니다. 잠시 후 다시 시도해주세요. 😅'
  }
}

// ==================== 5. 최종 응답 생성 함수 (RAG 완전 구조) ====================
/**
 * RAG 구조:
 * User Question
 *     ↓
 * retrieveContext() - 관련 데이터 검색
 *     ↓
 * Context 생성 (formatContextAsString)
 *     ↓
 * OpenAI LLM 호출
 *     ↓
 * Response 반환
 */
export const generateChatbotResponse = async (userMessage: string): Promise<string> => {
  try {
    // 1. retrieveContext() - 관련 데이터 검색
    const retrievedContexts = retrieveContext(userMessage, 5)
    
    // 2. Context 생성
    const contextString = formatContextAsString(retrievedContexts)
    
    // 3. OpenAI LLM 호출
    const response = await callOpenAIWithContext(userMessage, contextString)
    
    // 4. Response 반환
    return response
  } catch (error) {
    console.error('챗봇 응답 생성 오류:', error)
    return '죄송하지만 응답을 생성할 수 없습니다. 잠시 후 다시 시도해주세요. 😅'
  }
}
