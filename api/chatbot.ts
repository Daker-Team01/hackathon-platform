import Groq from 'groq-sdk'

// ==================== RAG 함수들 ====================
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

// 데이터 로드
const loadData = () => {
  const hackathons = [
    {
      slug: "aimers-8-model-lite",
      title: "Aimers 8기 : 모델 경량화 온라인 해커톤",
      status: "ended",
      tags: ["LLM", "Compression", "vLLM"],
      period: {
        submissionDeadlineAt: "2026-02-25T10:00:00+09:00"
      }
    },
    {
      slug: "monthly-vibe-coding-2026-02",
      title: "월간 해커톤 : 바이브 코딩 개선 AI 아이디어 공모전 (2026.02)",
      status: "ongoing",
      tags: ["Idea", "GenAI", "Workflow"],
      period: {
        submissionDeadlineAt: "2026-03-03T10:00:00+09:00"
      }
    },
    {
      slug: "daker-handover-2026-03",
      title: "긴급 인수인계 해커톤: 명세서만 보고 구현하라",
      status: "upcoming",
      tags: ["VibeCoding", "Web", "Vercel", "Handover"],
      period: {
        submissionDeadlineAt: "2026-03-30T10:00:00+09:00"
      }
    }
  ]
  
  const teams = [
    {
      teamCode: "T-ALPHA",
      name: "Team Alpha",
      isOpen: true,
      memberCount: 3,
      lookingFor: ["Backend", "ML Engineer"],
      intro: "추론 최적화/경량화 실험을 함께 진행할 팀원을 찾습니다."
    },
    {
      teamCode: "T-BETA",
      name: "PromptRunners",
      isOpen: true,
      memberCount: 1,
      lookingFor: ["Frontend", "Designer"],
      intro: "프롬프트 품질 점수화 + 개선 가이드 UX를 기획합니다."
    },
    {
      teamCode: "T-HANDOVER-01",
      name: "404found",
      isOpen: true,
      memberCount: 3,
      lookingFor: ["Frontend", "Designer"],
      intro: "명세서 기반으로 기본 기능을 빠르게 완성하고 UX 확장을 노립니다."
    },
    {
      teamCode: "T-HANDOVER-02",
      name: "LGTM",
      isOpen: false,
      memberCount: 5,
      lookingFor: [],
      intro: "기획서-구현-문서화를 깔끔하게 맞추는 방향으로 진행합니다."
    }
  ]

  const leaderboard = {
    entries: [
      { rank: 1, teamName: "Team Alpha", score: 0.7421 },
      { rank: 2, teamName: "Team Gamma", score: 0.7013 }
    ]
  }

  return { hackathons, teams, leaderboard }
}

const retrieveContext = (query: string, data: any, topK: number = 5) => {
  const queryTokens = tokenize(query)
  const results: any[] = []

  // 해커톤 데이터 검색
  data.hackathons.forEach((h: any) => {
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
  data.teams.forEach((t: any) => {
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
    if (data.leaderboard.entries && data.leaderboard.entries.length > 0) {
      const leaderboardData = data.leaderboard.entries.slice(0, 5)
      results.push({
        type: 'leaderboard',
        data: JSON.stringify(leaderboardData),
        relevance: 0.8
      })
    }
  }

  // 정보 데이터
  const infoData = JSON.stringify({
    totalHackathons: data.hackathons.length,
    totalTeams: data.teams.length,
    ongoingCount: data.hackathons.filter((h: any) => h.status === 'ongoing').length
  })
  const infoTokens = tokenize(infoData)
  const infoSimilarity = calculateCosineSimilarity(queryTokens, infoTokens)
  
  results.push({
    type: 'info',
    data: infoData,
    relevance: infoSimilarity
  })

  return results.sort((a, b) => b.relevance - a.relevance).slice(0, topK)
}

const formatContextAsString = (contexts: any[]): string => {
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
    rankings.forEach((entry: any) => {
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

// ==================== Vercel Serverless Function ====================
export default async function handler(req: any, res: any) {
  // CORS 헤더 설정
  res.setHeader('Access-Control-Allow-Credentials', 'true')
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT')
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  )

  if (req.method === 'OPTIONS') {
    res.status(200).end()
    return
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { message } = req.body

    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'Invalid message' })
    }

    // API 키 확인
    const apiKey = process.env.GROQ_API_KEY
    if (!apiKey) {
      console.error('Groq API 키가 누락되었습니다.')
      return res.status(500).json({ error: '서버 환경 설정 오류' })
    }

    // 데이터 로드
    const data = loadData()

    // Context 검색
    const contexts = retrieveContext(message, data, 5)
    const contextString = formatContextAsString(contexts)

    // Groq 호출 (서버 사이드에서만 실행, 무료!)
    const groq = new Groq({ apiKey })

    const systemPrompt = `당신은 해커톤 플랫폼의 친절한 AI 어시스턴트입니다.
사용자의 질문에 대해 제공된 관련 정보(Context)를 활용하여 정확하고 도움이 되는 답변을 제공합니다.
답변은 한국어로 자연스럽고 친근하게 작성하세요.
이모지를 적절히 사용하여 표현을 더 생생하게 만들 수 있습니다.
질문과 관련된 정보가 없으면 솔직하게 알 수 없다고 말하세요.`

    const userPrompt = `<Context>
${contextString}
</Context>

사용자 질문: ${message}

위 Context 정보를 활용하여 사용자의 질문에 답해주세요.`

    const response = await groq.chat.completions.create({
      model: 'mixtral-8x7b-32768',
      max_tokens: 1024,
      temperature: 0.3,
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

    if (!assistantMessage) {
      return res.status(500).json({ error: '응답 생성 실패' })
    }

    return res.status(200).json({ response: assistantMessage })
  } catch (error) {
    console.error('Chatbot API 오류:', error)
    
    const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류'
    
    if (errorMessage.includes('401')) {
      return res.status(401).json({ error: 'API 키 인증 실패' })
    }
    
    return res.status(500).json({ error: '챗봇 응답 생성 중 오류 발생' })
  }
}
