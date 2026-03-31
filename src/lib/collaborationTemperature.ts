import type { EventLog } from '../types/log'

const COLLABORATION_TEMPERATURE_STORAGE_KEY = 'collaboration_temperature_reviews_v1'
const MIN_SHARED_DURATION_MS = 24 * 60 * 60 * 1000

export const BASE_TEMPERATURE = 36.5
export const TEMPERATURE_DELTA_PER_SCORE = 1.0 // 점수 3 기준, 1점 차이 = ±1°C
// Score 5 → 38.5°C, Score 4 → 37.5°C, Score 3 → 36.5°C, Score 2 → 35.5°C, Score 1 → 34.5°C
export const MIN_TEMPERATURE = 18.0
export const MAX_TEMPERATURE = 99.9

export const scoreToTemperature = (avgScore: number): number => {
  const raw = BASE_TEMPERATURE + (avgScore - 3) * TEMPERATURE_DELTA_PER_SCORE
  return Math.round(Math.min(MAX_TEMPERATURE, Math.max(MIN_TEMPERATURE, raw)) * 10) / 10
}

const COLLABORATION_INTERACTION_ACTIONS = new Set([
  'team_create',
  'team_join',
  'team_request_create',
  'team_request_review',
  'team_request_result',
  'team_notice_send',
  'team_member_kick',
  'team_recruit_toggle',
  'invite_send',
  'invite_response',
  'hackathon_join',
  'submit_project'
])

export type CollaborationTemperatureReview = {
  reviewerUserId: string
  revieweeUserId: string
  teamCode: string
  score: number
  createdAt: string
}

export type CollaborationTemperatureSummary = {
  temperature: number   // °C 기준 (기본값 36.5)
  averageScore: number  // 원점수 평균 (1~5)
  reviewCount: number
}

export type CollaborationEligibilityInput = {
  reviewerUserId: string
  revieweeUserId: string
  teamCode: string
  teamCreatedAt: string
  reviewerJoinedAt?: string | null
  revieweeJoinedAt?: string | null
  interactionLogs: EventLog[]
  now?: Date
}

export type CollaborationEligibilityResult = {
  canReview: boolean
  reason: string
}

const canUseStorage = () => typeof window !== 'undefined' && typeof window.localStorage !== 'undefined'

const parseReviewArray = (value: unknown): CollaborationTemperatureReview[] => {
  if (!Array.isArray(value)) return []

  return value
    .filter((item): item is Record<string, unknown> => typeof item === 'object' && item !== null)
    .map((item) => ({
      reviewerUserId: typeof item.reviewerUserId === 'string' ? item.reviewerUserId : '',
      revieweeUserId: typeof item.revieweeUserId === 'string' ? item.revieweeUserId : '',
      teamCode: typeof item.teamCode === 'string' ? item.teamCode : '',
      score: typeof item.score === 'number' ? item.score : 0,
      createdAt: typeof item.createdAt === 'string' ? item.createdAt : ''
    }))
    .filter((item) => item.reviewerUserId && item.revieweeUserId && item.teamCode && item.score >= 1 && item.score <= 5)
}

export const loadCollaborationTemperatureReviews = (): CollaborationTemperatureReview[] => {
  if (!canUseStorage()) return []

  const raw = window.localStorage.getItem(COLLABORATION_TEMPERATURE_STORAGE_KEY)
  if (!raw) return []

  try {
    return parseReviewArray(JSON.parse(raw))
  } catch {
    return []
  }
}

const saveCollaborationTemperatureReviews = (reviews: CollaborationTemperatureReview[]) => {
  if (!canUseStorage()) return
  window.localStorage.setItem(COLLABORATION_TEMPERATURE_STORAGE_KEY, JSON.stringify(reviews))
}

export const hasExistingCollaborationReview = (reviewerUserId: string, revieweeUserId: string, teamCode: string) => {
  return loadCollaborationTemperatureReviews().some(
    (review) =>
      review.reviewerUserId === reviewerUserId &&
      review.revieweeUserId === revieweeUserId &&
      review.teamCode === teamCode
  )
}

export const saveCollaborationTemperatureReview = (review: CollaborationTemperatureReview) => {
  const reviews = loadCollaborationTemperatureReviews()
  const alreadyExists = reviews.some(
    (item) =>
      item.reviewerUserId === review.reviewerUserId &&
      item.revieweeUserId === review.revieweeUserId &&
      item.teamCode === review.teamCode
  )

  if (alreadyExists) {
    throw new Error('이미 해당 사용자에 대한 협업 온도 평가를 완료했습니다.')
  }

  saveCollaborationTemperatureReviews([review, ...reviews])
}

export const getUserCollaborationTemperature = (userId: string): CollaborationTemperatureSummary => {
  const reviews = loadCollaborationTemperatureReviews().filter((review) => review.revieweeUserId === userId)

  if (reviews.length === 0) {
    return {
      temperature: BASE_TEMPERATURE,
      averageScore: 3,
      reviewCount: 0
    }
  }

  const totalScore = reviews.reduce((sum, review) => sum + review.score, 0)
  const avgScore = totalScore / reviews.length
  return {
    temperature: scoreToTemperature(avgScore),
    averageScore: avgScore,
    reviewCount: reviews.length
  }
}

const resolveJoinedAtMs = (joinedAt: string | null | undefined, fallbackCreatedAt: string) => {
  const joinedMs = Date.parse(joinedAt || '')
  if (!Number.isNaN(joinedMs)) return joinedMs

  const fallbackMs = Date.parse(fallbackCreatedAt)
  if (!Number.isNaN(fallbackMs)) return fallbackMs

  return Date.now()
}

const isRelevantInteractionLog = (log: EventLog, teamCode: string) => {
  if (!COLLABORATION_INTERACTION_ACTIONS.has(log.action_type)) return false

  if (log.target_id === teamCode) return true

  const metadata = log.metadata
  if (!metadata || typeof metadata !== 'object') return false

  const metadataTeamCode = (metadata as Record<string, unknown>).teamCode
  return typeof metadataTeamCode === 'string' && metadataTeamCode === teamCode
}

export const getCollaborationEligibility = ({
  reviewerUserId,
  revieweeUserId,
  teamCode,
  teamCreatedAt,
  reviewerJoinedAt,
  revieweeJoinedAt,
  interactionLogs,
  now = new Date()
}: CollaborationEligibilityInput): CollaborationEligibilityResult => {
  if (!reviewerUserId) {
    return { canReview: false, reason: '로그인 후 협업 온도를 평가할 수 있습니다.' }
  }

  if (!revieweeUserId) {
    return { canReview: false, reason: '평가할 사용자 정보를 찾을 수 없습니다.' }
  }

  if (reviewerUserId === revieweeUserId) {
    return { canReview: false, reason: '자기 자신은 평가할 수 없습니다.' }
  }

  if (hasExistingCollaborationReview(reviewerUserId, revieweeUserId, teamCode)) {
    return { canReview: false, reason: '이 팀에서 이미 협업 온도 평가를 완료했습니다.' }
  }

  const sharedStartedAtMs = Math.max(
    resolveJoinedAtMs(reviewerJoinedAt, teamCreatedAt),
    resolveJoinedAtMs(revieweeJoinedAt, teamCreatedAt)
  )
  const sharedDurationMs = now.getTime() - sharedStartedAtMs

  if (sharedDurationMs < MIN_SHARED_DURATION_MS) {
    return { canReview: false, reason: '최소 24시간 이상 함께 활동한 뒤 평가할 수 있습니다.' }
  }

  const hasInteractionLog = interactionLogs.some((log) => {
    if (!log.user_id) return false
    if (log.user_id !== reviewerUserId && log.user_id !== revieweeUserId) return false

    const createdMs = Date.parse(log.created_at)
    if (Number.isNaN(createdMs) || createdMs < sharedStartedAtMs) return false

    return isRelevantInteractionLog(log, teamCode)
  })

  if (!hasInteractionLog) {
    return { canReview: false, reason: '함께한 팀 활동 로그가 있어야 협업 온도를 평가할 수 있습니다.' }
  }

  return { canReview: true, reason: '' }
}