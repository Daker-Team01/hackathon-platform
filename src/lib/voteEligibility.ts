import { getHackathonDetailBySlug } from './hackathonDetailData'
import { normalizedHackathons } from './hackathonData'
import type { User } from '../contexts/UserContext'
import type { Hackathon } from '../types/hackathon'

const HACKATHONS_STORAGE_KEY = 'hackathons'
const IGNORE_VOTING_PERIOD_FOR_TEST = false

function getHackathonsFromStorage(): Hackathon[] {
  const raw = localStorage.getItem(HACKATHONS_STORAGE_KEY)
  if (!raw) {
    return normalizedHackathons
  }

  try {
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed)) {
      return parsed as Hackathon[]
    }
  } catch {
    // Ignore parse errors and fall back to normalized list.
  }

  return normalizedHackathons
}

export type VoteEligibility = {
  canVote: boolean
  isVoteSource: boolean
  isWithinVotingPeriod: boolean
  isParticipant: boolean
  hackathonFound: boolean
  scoreSource: string
  reasons: string[]
}

export function getVoteEligibility(hackathonSlug: string, user: User | null): VoteEligibility {
  const detail = getHackathonDetailBySlug(hackathonSlug)
  const scoreSource = (detail?.sections?.eval?.scoreSource ?? '').trim().toLowerCase()
  const isVoteSource = scoreSource === 'vote'

  const targetHackathon = getHackathonsFromStorage().find((item) => item.slug === hackathonSlug)
  const submissionTime = Date.parse(targetHackathon?.period.submissionDeadlineAt ?? '')
  const endTime = Date.parse(targetHackathon?.period.endAt ?? '')
  const now = Date.now()

  const hasValidPeriod = Number.isFinite(submissionTime) && Number.isFinite(endTime)
  const isWithinVotingPeriod = IGNORE_VOTING_PERIOD_FOR_TEST
    ? true
    : hasValidPeriod && now >= submissionTime && now <= endTime

  const isParticipant = Boolean(
    user &&
      user.participations.some((participation) => {
        const isSameHackathon = participation.hackathonSlug === hackathonSlug
        const isOngoingParticipation = participation.status.toLowerCase() === 'ongoing'
        return isSameHackathon && isOngoingParticipation
      })
  )

  const reasons: string[] = []

  if (!targetHackathon) {
    reasons.push('해커톤 정보를 찾을 수 없습니다.')
  }

  if (!isVoteSource) {
    reasons.push('이 해커톤은 투표형 평가(scoreSource: vote) 대상이 아닙니다.')
  }

  if (!isWithinVotingPeriod) {
    reasons.push('투표 기간은 제출 마감 시점부터 대회 종료 시점까지입니다.')
  }

  if (!user) {
    reasons.push('로그인한 사용자만 투표할 수 있습니다.')
  } else if (!isParticipant) {
    reasons.push('해당 해커톤 참여자만 투표할 수 있습니다.')
  }

  return {
    canVote: Boolean(targetHackathon) && isVoteSource && isWithinVotingPeriod && isParticipant,
    isVoteSource,
    isWithinVotingPeriod,
    isParticipant,
    hackathonFound: Boolean(targetHackathon),
    scoreSource,
    reasons
  }
}
