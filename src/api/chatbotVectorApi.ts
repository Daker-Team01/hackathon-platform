import { normalizedHackathons as hackathons } from '../lib/hackathonData'
import teams from '../data/team_dummy_data.json'
import { allUsers } from '../contexts/UserContext'
import { supabase } from '../lib/supabase'

type Intent =
  | 'ongoing_hackathons'
  | 'upcoming_hackathons'
  | 'team_ranking'
  | 'leaderboard'
  | 'teams'
  | 'hackathons'
  | 'help'
  | 'general'

type VectorDocType = 'hackathon' | 'team' | 'user' | 'guide'

type ChatbotDocument = {
  doc_key: string
  doc_type: VectorDocType
  title: string
  content: string
  metadata: Record<string, unknown>
  embedding: string
}

type MatchRow = {
  doc_key: string
  doc_type: VectorDocType
  title: string
  content: string
  similarity: number
}
const EMBEDDING_DIM = 768

const MAX_HACKATHON_DOCS = 12
const MAX_TEAM_DOCS = 20
const MAX_USER_DOCS = 12

let isIndexed = false
let lastIndexAttemptAt = 0

const usersByPoints = [...allUsers].sort((a, b) => {
  if (b.points !== a.points) return b.points - a.points
  return b.reputation - a.reputation
})

const toVectorString = (values: number[]): string => `[${values.join(',')}]`

const normalizeL2 = (values: number[]): number[] => {
  const norm = Math.sqrt(values.reduce((sum, v) => sum + v * v, 0))
  if (norm === 0) return values
  return values.map((v) => v / norm)
}

const hashToken = (token: string): number => {
  let hash = 0
  for (let i = 0; i < token.length; i += 1) {
    hash = (hash * 31 + token.charCodeAt(i)) >>> 0
  }
  return hash
}

const buildLocalEmbedding = (text: string, dim = EMBEDDING_DIM): number[] => {
  const vec = new Array(dim).fill(0)
  const tokens = text.toLowerCase().split(/[^\p{L}\p{N}_]+/u).filter(Boolean)

  if (tokens.length === 0) return vec

  for (const token of tokens) {
    const base = hashToken(token)
    const idx1 = base % dim
    const idx2 = (base * 131 + 17) % dim
    const idx3 = (base * 197 + 97) % dim
    vec[idx1] += 1
    vec[idx2] += 0.7
    vec[idx3] += 0.4
  }

  return normalizeL2(vec)
}

const mapIntentToDocType = (intent: Intent): VectorDocType | null => {
  if (intent === 'teams' || intent === 'team_ranking') return 'team'
  if (intent === 'hackathons' || intent === 'ongoing_hackathons' || intent === 'upcoming_hackathons') return 'hackathon'
  if (intent === 'leaderboard') return 'user'
  return null
}

const buildSeedDocuments = (): Array<Omit<ChatbotDocument, 'embedding'>> => {
  const hackathonDocs = hackathons.slice(0, MAX_HACKATHON_DOCS).map((h) => ({
    doc_key: `hackathon:${h.slug}`,
    doc_type: 'hackathon' as const,
    title: h.title,
    content: `${h.title} 해커톤. 상태 ${h.status}. 태그 ${h.tags.join(', ')}. 제출 마감 ${new Date(
      h.period.submissionDeadlineAt
    ).toLocaleDateString('ko-KR')}.`,
    metadata: {
      slug: h.slug,
      status: h.status,
      tags: h.tags,
    },
  }))

  const teamDocs = teams
    .slice()
    .sort((a, b) => Number(b.isOpen) - Number(a.isOpen))
    .slice(0, MAX_TEAM_DOCS)
    .map((t) => ({
      doc_key: `team:${t.teamCode}`,
      doc_type: 'team' as const,
      title: t.name,
      content: `${t.name} 팀. 소개 ${t.intro}. 모집 상태 ${t.isOpen ? '열림' : '닫힘'}. 모집 역할 ${
        t.lookingFor.join(', ') || '없음'
      }. 필요 기술 ${t.requiredSkills?.join(', ') || '없음'}.`,
      metadata: {
        teamCode: t.teamCode,
        isOpen: t.isOpen,
        lookingFor: t.lookingFor,
      },
    }))

  const userDocs = usersByPoints.slice(0, MAX_USER_DOCS).map((u) => ({
    doc_key: `user:${u.userId}`,
    doc_type: 'user' as const,
    title: u.nickname,
    content: `${u.nickname} 사용자. 포인트 ${u.points}점. 선호 역할 ${u.preferredRoles.join(', ') || '없음'}. 기술 ${
      u.techStack.join(', ') || '없음'
    }. 성향 ${u.personalityTags.join(', ') || '없음'}.`,
    metadata: {
      userId: u.userId,
      points: u.points,
    },
  }))

  return [...hackathonDocs, ...teamDocs, ...userDocs]
}

const embedText = async (text: string): Promise<number[] | null> => {
  return buildLocalEmbedding(text)
}

const maybeIndexSeedDocuments = async (): Promise<void> => {
  if (isIndexed) return

  // 과도한 재인덱싱 방지 (1분)
  if (Date.now() - lastIndexAttemptAt < 60_000) return
  lastIndexAttemptAt = Date.now()

  const { count, error: countError } = await supabase
    .from('chatbot_documents')
    .select('id', { count: 'exact', head: true })

  if (!countError && (count ?? 0) > 0) {
    isIndexed = true
    return
  }

  const seeds = buildSeedDocuments()
  const docs: ChatbotDocument[] = []

  for (const seed of seeds) {
    const embedding = await embedText(seed.content)
    if (!embedding) continue

    docs.push({
      ...seed,
      embedding: toVectorString(embedding),
    })
  }

  if (docs.length === 0) return

  const { error } = await supabase.from('chatbot_documents').upsert(docs, {
    onConflict: 'doc_key',
    ignoreDuplicates: false,
  })

  if (!error) {
    isIndexed = true
  }
}

export const retrieveVectorContext = async (query: string, intent: Intent): Promise<string | null> => {
  const filterDocType = mapIntentToDocType(intent)

  await maybeIndexSeedDocuments()

  const queryEmbedding = await embedText(query)
  if (!queryEmbedding) return null

  const { data, error } = await supabase.rpc('match_chatbot_documents', {
    query_embedding: toVectorString(queryEmbedding),
    match_count: 5,
    filter_doc_type: filterDocType,
  })

  if (error) {
    console.warn('match_chatbot_documents rpc failed:', error.message)
    return null
  }

  const rows = ((data ?? []) as MatchRow[]).filter((row) => row.similarity >= 0.45)
  if (rows.length === 0) return null

  const lines = rows.map((row, idx) => {
    const score = Number.isFinite(row.similarity) ? row.similarity.toFixed(3) : '0.000'
    return `${idx + 1}. [${row.doc_type}] ${row.title} | 유사도:${score} | ${row.content}`
  })

  return `[VECTOR_MATCH]\n${lines.join('\n')}`
}
