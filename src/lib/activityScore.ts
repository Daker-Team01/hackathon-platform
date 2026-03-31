import type { EventLog, EventType } from '../types/log'

type ActivityCategory = 'exploration' | 'intent' | 'action' | 'engagement' | 'outcome' | 'neutral'

type ActivityRule = {
  weight: number
  category: ActivityCategory
  dailyCapPoints?: number
}

const EXPLORATION_SHARE_LIMIT = 0.3
const EXPLORATION_TO_NON_EXPLORATION_RATIO = EXPLORATION_SHARE_LIMIT / (1 - EXPLORATION_SHARE_LIMIT)
const EXPLORATION_BASELINE_CAP = 30
const NORMALIZATION_SCALE = 90
const MAX_DYNAMIC_SCORE_BLEND = 0.55
const FULL_CONFIDENCE_LOG_COUNT = 12

const ACTIVITY_RULES: Record<EventType, ActivityRule> = {
  page_view: { weight: 1, category: 'exploration', dailyCapPoints: 20 },
  card_click: { weight: 2, category: 'exploration', dailyCapPoints: 24 },
  recommendation_impression: { weight: 1, category: 'exploration', dailyCapPoints: 12 },
  recommendation_click: { weight: 3, category: 'exploration', dailyCapPoints: 18 },
  chatbot_query: { weight: 2, category: 'intent', dailyCapPoints: 16 },
  chatbot_response: { weight: 0, category: 'neutral' },
  hackathon_view: { weight: 2, category: 'exploration', dailyCapPoints: 20 },
  hackathon_join: { weight: 8, category: 'action' },
  hackathon_filter: { weight: 1, category: 'exploration', dailyCapPoints: 12 },
  hackathon_interest_toggle: { weight: 4, category: 'intent', dailyCapPoints: 16 },
  tab_view: { weight: 1, category: 'exploration', dailyCapPoints: 10 },
  matcher_profile_select: { weight: 3, category: 'intent', dailyCapPoints: 18 },
  matcher_filter: { weight: 1, category: 'exploration', dailyCapPoints: 12 },
  team_filter: { weight: 1, category: 'exploration', dailyCapPoints: 12 },
  team_detail_open: { weight: 3, category: 'intent', dailyCapPoints: 18 },
  team_detail_close: { weight: 0, category: 'neutral' },
  team_detail_dwell: { weight: 4, category: 'intent', dailyCapPoints: 20 },
  team_create: { weight: 12, category: 'engagement' },
  team_create_attempt: { weight: 4, category: 'intent', dailyCapPoints: 12 },
  team_join: { weight: 10, category: 'action' },
  team_request_create: { weight: 6, category: 'action' },
  team_request_cancel: { weight: -2, category: 'action' },
  team_request_review: { weight: 5, category: 'engagement' },
  team_request_result: { weight: 4, category: 'engagement' },
  invite_response: { weight: 5, category: 'engagement' },
  invite_send: { weight: 6, category: 'engagement' },
  invite_cancel: { weight: -2, category: 'engagement' },
  team_member_kick: { weight: 2, category: 'engagement' },
  team_notice_send: { weight: 5, category: 'engagement' },
  team_recruit_toggle: { weight: 3, category: 'intent', dailyCapPoints: 12 },
  api_error: { weight: 0, category: 'neutral' },
  submit_project: { weight: 18, category: 'outcome' }
}

export type ActivityScoreBreakdown = {
  rawScore: number
  normalizedScore: number
  explorationScore: number
  cappedExplorationScore: number
  nonExplorationScore: number
}

const getRecencyMultiplier = (createdAt: string, nowMs: number) => {
  const createdMs = Date.parse(createdAt)
  if (Number.isNaN(createdMs)) return 0.4

  const ageInDays = (nowMs - createdMs) / (1000 * 60 * 60 * 24)
  if (ageInDays <= 7) return 1
  if (ageInDays <= 30) return 0.7
  return 0.4
}

const getDayKey = (createdAt: string) => {
  const createdMs = Date.parse(createdAt)
  if (Number.isNaN(createdMs)) return 'unknown'
  return new Date(createdMs).toISOString().slice(0, 10)
}

export const filterLogsWithinDays = (logs: EventLog[], days?: number, now = new Date()) => {
  if (!days || days <= 0) return logs

  const nowMs = now.getTime()
  const windowMs = days * 24 * 60 * 60 * 1000

  return logs.filter((log) => {
    const createdMs = Date.parse(log.created_at)
    return !Number.isNaN(createdMs) && nowMs - createdMs <= windowMs
  })
}

export const calculateActivityScoreBreakdown = (logs: EventLog[], now = new Date()): ActivityScoreBreakdown => {
  if (logs.length === 0) {
    return {
      rawScore: 0,
      normalizedScore: 0,
      explorationScore: 0,
      cappedExplorationScore: 0,
      nonExplorationScore: 0
    }
  }

  const nowMs = now.getTime()
  const pointsByDayAction = new Map<string, { action: EventType; category: ActivityCategory; points: number }>()

  logs.forEach((log) => {
    const rule = ACTIVITY_RULES[log.action_type]
    if (!rule || rule.weight === 0) return

    const dayKey = getDayKey(log.created_at)
    const bucketKey = `${dayKey}:${log.action_type}`
    const weightedPoint = rule.weight * getRecencyMultiplier(log.created_at, nowMs)
    const existing = pointsByDayAction.get(bucketKey)

    if (existing) {
      existing.points += weightedPoint
      return
    }

    pointsByDayAction.set(bucketKey, {
      action: log.action_type,
      category: rule.category,
      points: weightedPoint
    })
  })

  let explorationScore = 0
  let nonExplorationScore = 0

  pointsByDayAction.forEach(({ action, category, points }) => {
    const cap = ACTIVITY_RULES[action].dailyCapPoints
    const cappedPoints = cap === undefined
      ? points
      : points >= 0
        ? Math.min(points, cap)
        : Math.max(points, -cap)

    if (category === 'exploration') {
      explorationScore += cappedPoints
      return
    }

    nonExplorationScore += cappedPoints
  })

  nonExplorationScore = Math.max(nonExplorationScore, 0)

  const cappedExplorationScore = nonExplorationScore > 0
    ? Math.min(Math.max(explorationScore, 0), nonExplorationScore * EXPLORATION_TO_NON_EXPLORATION_RATIO)
    : Math.min(Math.max(explorationScore, 0), EXPLORATION_BASELINE_CAP)

  const rawScore = Math.max(nonExplorationScore + cappedExplorationScore, 0)
  const normalizedScore = rawScore <= 0 ? 0 : Math.min(0.99, 1 - Math.exp(-rawScore / NORMALIZATION_SCALE))

  return {
    rawScore,
    normalizedScore,
    explorationScore,
    cappedExplorationScore,
    nonExplorationScore
  }
}

export const calculateActivityScore = (logs: EventLog[], now = new Date()) => {
  return calculateActivityScoreBreakdown(logs, now).normalizedScore
}

export const buildActivityScoreMap = <T extends { id: string; userId?: string; activityScore?: number }>(
  users: T[],
  logs: EventLog[],
  days?: number,
  now = new Date()
) => {
  const filteredLogs = filterLogsWithinDays(logs, days, now)
  const normalizedUsers = users.map((user) => ({
    ...user,
    identities: new Set([user.id, user.userId].filter((value): value is string => Boolean(value)))
  }))

  const logsByIdentity = new Map<string, EventLog[]>()
  filteredLogs.forEach((log) => {
    if (!log.user_id) return
    const bucket = logsByIdentity.get(log.user_id) ?? []
    bucket.push(log)
    logsByIdentity.set(log.user_id, bucket)
  })

  const scoreMap = new Map<string, number>()

  normalizedUsers.forEach((user) => {
    const collectedLogs: EventLog[] = []

    user.identities.forEach((identity) => {
      const matchedLogs = logsByIdentity.get(identity)
      if (matchedLogs) {
        collectedLogs.push(...matchedLogs)
      }
    })

    const dynamicScore = calculateActivityScore(collectedLogs, now)
    const baselineScore = typeof user.activityScore === 'number' && Number.isFinite(user.activityScore)
      ? user.activityScore
      : 0
    const confidenceRatio = Math.min(1, collectedLogs.length / FULL_CONFIDENCE_LOG_COUNT)
    const dynamicBlend = MAX_DYNAMIC_SCORE_BLEND * confidenceRatio
    const score = baselineScore * (1 - dynamicBlend) + dynamicScore * dynamicBlend

    scoreMap.set(user.id, score)
    if (user.userId) {
      scoreMap.set(user.userId, score)
    }
  })

  return scoreMap
}