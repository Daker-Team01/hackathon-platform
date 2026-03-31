import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRightLeft, ArrowUpRight, Bot, ExternalLink, MessageCircle, Sparkles, Users, UserRound } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { supabase } from '@/lib/supabase'
import { useChat } from '@/contexts/ChatContext'
import { useDmRequests } from '@/contexts/DmRequestContext'
import { useLog } from '@/contexts/LogContext'
import { useUser } from '@/contexts/UserContext'
import { getTeamsByLeaderId } from '@/api/teamApi'
import { useCancelTeamRequest, useCreateTeamRequest, useTeamRequestsForUser } from '@/hooks/useTeams'
import type { Team } from '@/types/team'
import usersData from '../data/user_dummy_v2.json'

type DocType = 'user' | 'team'

type ProfileSlots = {
  role?: string[]
  skills?: string[]
  personality?: string[]
  context?: string[]
}

type ProfileDocument = {
  id: string
  source_id: string
  type: DocType
  hackathon_slug: string | null
  is_hackathon_linked: boolean
  is_open: boolean | null
  current_team_id: string | null
  profile: ProfileSlots | null
  content: string
}

type MatchResult = ProfileDocument & {
  similarity: number
}

type RawUser = (typeof usersData)[number]
type TeamDetails = {
  teamCode: string
  name: string
  intro: string
  lookingFor: string[]
  requiredSkills: string[]
  preferredPersonality: string[]
  tags: string[]
  isOpen: boolean
  memberCount: number
  maxMembers: number
  hackathonSlug?: string
  leaderId?: string
  contact?: {
    type: string
    url: string
  }
  members: Array<{
    userId: string
    userName: string
    role: string
  }>
}

const sourceTypeOptions: Array<{ value: DocType; label: string; icon: typeof Users }> = [
  { value: 'team', label: '팀 기준으로 팀원 찾기', icon: Users },
  { value: 'user', label: '나와 맞는 팀 찾기', icon: UserRound },
]

function InfoBlock({
  label,
  value,
}: {
  label: string
  value: string
}) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-slate-100 bg-slate-50/80 px-4 py-3">
      <p className="min-w-20 text-xs font-bold text-slate-500">{label}</p>
      <p className="text-sm font-semibold leading-6 text-slate-700">{value}</p>
    </div>
  )
}

function TagGroup({
  label,
  values,
  tone = 'slate',
}: {
  label: string
  values?: string[]
  tone?: 'slate' | 'sky' | 'violet'
}) {
  const toneClassName =
    tone === 'sky'
      ? 'border-sky-100 bg-sky-50 text-sky-700'
      : tone === 'violet'
        ? 'border-violet-100 bg-violet-50 text-violet-700'
        : 'border-slate-200 bg-white text-slate-700'

  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50/70 px-4 py-3">
      <p className="text-xs font-bold text-slate-500">{label}</p>
      {values && values.length > 0 ? (
        <div className="mt-2 flex flex-wrap gap-2">
          {values.map((value) => (
            <span
              key={`${label}-${value}`}
              className={`rounded-full border px-3 py-1.5 text-xs font-bold ${toneClassName}`}
            >
              {value}
            </span>
          ))}
        </div>
      ) : (
        <p className="mt-2 text-sm font-medium text-slate-400">없음</p>
      )}
    </div>
  )
}

function SourceSummary({
  doc,
  userMap,
  teamMap,
}: {
  doc: ProfileDocument | MatchResult
  userMap: Map<string, RawUser>
  teamMap: Map<string, TeamDetails>
}) {
  if (doc.type === 'team') {
    const team = teamMap.get(doc.source_id)
    return (
      <div className="space-y-3">
        <InfoBlock label="팀명" value={team?.name ?? doc.source_id} />
        <InfoBlock label="소개" value={team?.intro ?? '상세 정보 없음'} />
        <div className="grid gap-3 xl:grid-cols-2">
          <TagGroup label="모집 역할" values={team?.lookingFor} tone="sky" />
          <TagGroup label="기술" values={team?.requiredSkills} tone="violet" />
        </div>
        <div className="grid gap-3 xl:grid-cols-2">
          <TagGroup label="선호 성향" values={team?.preferredPersonality} />
          <TagGroup label="태그" values={team?.tags} />
        </div>
      </div>
    )
  }

  const user = userMap.get(doc.source_id)
  return (
    <div className="space-y-3">
      <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_220px]">
        <InfoBlock label="닉네임" value={user?.nickname ?? doc.source_id} />
        <InfoBlock label="현재 참여 팀" value={doc.current_team_id ?? '없음'} />
      </div>
      <div className="grid gap-3 xl:grid-cols-2">
        <TagGroup label="선호 역할" values={user?.preferredRoles} tone="sky" />
        <TagGroup label="기술 스택" values={user?.skills} tone="violet" />
      </div>
      <TagGroup label="성향" values={user?.personalityTags} />
    </div>
  )
}

function MatchActionButton({
  currentUserId,
  currentUserInternalId,
  currentUserNickname,
  targetUserId,
  targetNickname,
}: {
  currentUserId?: string
  currentUserInternalId?: string
  currentUserNickname?: string
  targetUserId: string
  targetNickname: string
}) {
  const { sendDmRequest, hasSentPendingRequest } = useDmRequests()
  const { findDirectRoomWithUser } = useChat()
  const [isLoading, setIsLoading] = useState(false)
  const [existingDirectRoomId, setExistingDirectRoomId] = useState<string | null>(null)

  const normalizeIdentity = (value?: string | null) => (value ?? '').trim().toLowerCase()
  const isSelf = [normalizeIdentity(currentUserId), normalizeIdentity(currentUserInternalId)].some(
    (currentIdentity) => currentIdentity.length > 0 && currentIdentity === normalizeIdentity(targetUserId)
  )
  const alreadySent =
    !!currentUserId && !!targetUserId && hasSentPendingRequest(currentUserId, targetUserId)

  useEffect(() => {
    if (!currentUserId || !targetUserId || isSelf) {
      setExistingDirectRoomId(null)
      return
    }

    let cancelled = false

    void findDirectRoomWithUser(currentUserId, targetUserId)
      .then((roomId) => {
        if (!cancelled) {
          setExistingDirectRoomId(roomId)
        }
      })
      .catch((error) => {
        console.error('Failed to resolve direct room in Matcher:', error)
        if (!cancelled) {
          setExistingDirectRoomId(null)
        }
      })

    return () => {
      cancelled = true
    }
  }, [currentUserId, findDirectRoomWithUser, isSelf, targetUserId])

  if (!currentUserId || !currentUserNickname || !targetUserId || isSelf) {
    return null
  }

  const hasExistingDirectRoom = Boolean(existingDirectRoomId)

  const handleChatRequest = async () => {
    try {
      setIsLoading(true)
      await sendDmRequest(currentUserId, currentUserNickname, targetUserId, targetNickname)
      alert('채팅 신청을 보냈습니다!')
    } catch (error) {
      console.error('Failed to send chat request in Matcher:', error)
      alert(error instanceof Error ? error.message : '채팅 신청 전송에 실패했습니다.')
    } finally {
      setIsLoading(false)
    }
  }

  if (hasExistingDirectRoom) {
    return (
      <div className="mt-4 inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700">
        <MessageCircle className="h-4 w-4" />
        이미 연락중입니다.
      </div>
    )
  }

  return (
    <Button
      onClick={() => void handleChatRequest()}
      disabled={alreadySent || isLoading}
      variant={alreadySent ? 'outline' : 'default'}
      className={`mt-4 gap-2 ${
        alreadySent || isLoading ? 'text-gray-400 border-gray-200' : 'bg-indigo-600 hover:bg-indigo-700 text-white'
      }`}
    >
      <MessageCircle className="h-4 w-4" />
      {isLoading ? '전송 중...' : alreadySent ? '✓ 채팅 신청함' : '채팅 신청하기'}
    </Button>
  )
}

function MatchTeamActionButtons({
  team,
  allTeams,
  currentUserId,
  currentUserNickname,
}: {
  team: TeamDetails
  allTeams: Map<string, TeamDetails>
  currentUserId?: string
  currentUserNickname?: string
}) {
  const createTeamRequestMutation = useCreateTeamRequest()
  const cancelTeamRequestMutation = useCancelTeamRequest()
  const { data: myRequests = [] } = useTeamRequestsForUser(currentUserId || '')
  const members = team.members ?? []

  const pendingJoinRequest = myRequests.find(
    (request) => request.teamId === team.teamCode && request.requestType === 'JOIN' && request.status === 'PENDING'
  )
  const isTeamMember = !!currentUserId && members.some((member) => member.userId === currentUserId)
  const isTeamLeader = !!currentUserId && team.leaderId === currentUserId
  const hasJoinedAnotherTeamInSameHackathon =
    !!currentUserId &&
    !!team.hackathonSlug &&
    Array.from(allTeams.values()).some((candidate) => {
      if (!candidate.hackathonSlug || candidate.hackathonSlug !== team.hackathonSlug) return false
      if (candidate.teamCode === team.teamCode) return false
      if (candidate.leaderId === currentUserId) return true
      return (candidate.members ?? []).some((member) => member.userId === currentUserId)
    })

  const handleCreateRequest = () => {
    if (!currentUserId || !currentUserNickname) return

    createTeamRequestMutation.mutate(
      {
        teamId: team.teamCode,
        requestType: 'JOIN',
        requesterUserId: currentUserId,
        requesterUserName: currentUserNickname
      },
      {
        onSuccess: () => {
          alert('가입 신청을 보냈습니다.')
        },
        onError: (error) => {
          alert(error instanceof Error ? error.message : '요청 처리에 실패했습니다.')
        }
      }
    )
  }

  const handleCancelRequest = () => {
    if (!currentUserId || !pendingJoinRequest) return

    cancelTeamRequestMutation.mutate(
      { requestId: pendingJoinRequest.id, requesterUserId: currentUserId },
      {
        onSuccess: () => {
          alert('요청을 취소했습니다.')
        },
        onError: (error) => {
          alert(error instanceof Error ? error.message : '요청 취소에 실패했습니다.')
        }
      }
    )
  }

  return (
    <div className="mt-4 flex flex-wrap items-center gap-3">
      {team.contact?.url ? (
        <a href={team.contact.url} target="_blank" rel="noopener noreferrer">
          <Button className="bg-blue-50 text-blue-600 hover:bg-blue-100 border-0 rounded-xl font-bold">
            <MessageCircle className="h-4 w-4 mr-2" />
            연락하기
            <ExternalLink className="h-3 w-3 ml-2 opacity-50" />
          </Button>
        </a>
      ) : null}

      {team.isOpen ? (
        !currentUserId || !currentUserNickname ? (
          <Button disabled variant="outline" className="rounded-xl font-bold">
            로그인 후 신청 가능
          </Button>
        ) : isTeamLeader || isTeamMember ? (
          <div className="inline-flex items-center rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-600">
            이미 참여중인 팀입니다.
          </div>
        ) : hasJoinedAnotherTeamInSameHackathon ? (
          <div className="inline-flex items-center rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-700">
            같은 해커톤에는 한 팀만 가입할 수 있습니다.
          </div>
        ) : pendingJoinRequest ? (
          <div className="flex flex-wrap gap-2">
            <Button disabled variant="outline" className="rounded-xl font-bold">
              ✓ 팀 신청함
            </Button>
            <Button
              variant="outline"
              className="rounded-xl font-bold"
              disabled={cancelTeamRequestMutation.isPending}
              onClick={() => handleCancelRequest()}
            >
              요청 취소
            </Button>
          </div>
        ) : (
          <Button
            className="rounded-xl bg-gradient-to-r from-[#3B82F6] to-[#0EA5E9] font-bold text-white shadow-lg hover:opacity-95"
            disabled={createTeamRequestMutation.isPending}
            onClick={() => handleCreateRequest()}
          >
            {createTeamRequestMutation.isPending ? '신청 중...' : '팀 신청하기'}
          </Button>
        )
      ) : null}
    </div>
  )
}

export default function Matcher() {
  const { recordEvent } = useLog()
  const { user } = useUser()
  const currentUserId = user?.userId || ''

  // 내가 팀장인 팀 목록 (DB에서 조회)
  const [myLeaderTeams, setMyLeaderTeams] = useState<Team[]>([])

  const userMap = useMemo(
    () => new Map<string, RawUser>(usersData.map((item) => [item.userId, item] as const)),
    [],
  )

  const [documents, setDocuments] = useState<ProfileDocument[]>([])
  const [sourceType, setSourceType] = useState<DocType>('team')
  const [selectedSourceId, setSelectedSourceId] = useState('')
  const [openOnly, setOpenOnly] = useState<'all' | 'open'>('all')
  const [results, setResults] = useState<MatchResult[]>([])
  const [loadingDocs, setLoadingDocs] = useState(true)
  const [loadingMatches, setLoadingMatches] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [teamMap, setTeamMap] = useState<Map<string, TeamDetails>>(new Map())

  // 내가 팀장인 팀 목록 조회
  useEffect(() => {
    if (!user?.userId) {
      setMyLeaderTeams([])
      return
    }
    const loadMyTeams = async () => {
      const teams = await getTeamsByLeaderId(user.userId)
      setMyLeaderTeams(teams)
    }
    void loadMyTeams()
  }, [user?.userId])

  useEffect(() => {
    const loadDocuments = async () => {
      setLoadingDocs(true)
      setError(null)
      const { data, error: fetchError } = await supabase.rpc('list_matcher_profile_documents', {
        filter_type: null,
      })

      if (fetchError) {
        setError(fetchError.message)
        setLoadingDocs(false)
        return
      }

      setDocuments((data ?? []) as ProfileDocument[])
      setLoadingDocs(false)
    }

    void loadDocuments()
  }, [])

  useEffect(() => {
    const loadTeamDetails = async () => {
      const { data, error: fetchError } = await supabase
        .from('teams')
        .select('team_code, name, intro, looking_for, required_skills, preferred_personality, tags, is_open, member_count, max_members, hackathon_slug, leader_id, contact_type, contact_url, members')

      if (fetchError) {
        console.error('Failed to load matcher teams:', fetchError)
        return
      }

      const mappedEntries: Array<readonly [string, TeamDetails]> = []

      for (const row of (data ?? []) as Array<Record<string, unknown>>) {
        const teamCode = typeof row.team_code === 'string' ? row.team_code : ''
        if (!teamCode) continue

        mappedEntries.push([
          teamCode,
          {
            teamCode,
            name: typeof row.name === 'string' && row.name ? row.name : teamCode,
            intro: typeof row.intro === 'string' ? row.intro : '',
            lookingFor: Array.isArray(row.looking_for) ? row.looking_for.filter((item): item is string => typeof item === 'string') : [],
            requiredSkills: Array.isArray(row.required_skills) ? row.required_skills.filter((item): item is string => typeof item === 'string') : [],
            preferredPersonality: Array.isArray(row.preferred_personality) ? row.preferred_personality.filter((item): item is string => typeof item === 'string') : [],
            tags: Array.isArray(row.tags) ? row.tags.filter((item): item is string => typeof item === 'string') : [],
            isOpen: Boolean(row.is_open),
            memberCount: typeof row.member_count === 'number' ? row.member_count : 0,
            maxMembers: typeof row.max_members === 'number' ? row.max_members : 0,
            hackathonSlug: typeof row.hackathon_slug === 'string' ? row.hackathon_slug : undefined,
            leaderId: typeof row.leader_id === 'string' ? row.leader_id : undefined,
            contact: {
              type: typeof row.contact_type === 'string' ? row.contact_type : 'link',
              url: typeof row.contact_url === 'string' ? row.contact_url : '',
            },
            members: Array.isArray(row.members)
              ? row.members.flatMap((member) =>
                  typeof member === 'object' && member !== null
                    ? [{
                        userId: typeof (member as { userId?: unknown }).userId === 'string' ? (member as { userId: string }).userId : '',
                        userName: typeof (member as { userName?: unknown }).userName === 'string' ? (member as { userName: string }).userName : '',
                        role: typeof (member as { role?: unknown }).role === 'string' ? (member as { role: string }).role : '',
                      }]
                    : []
                )
              : [],
          },
        ] as const)
      }

      const mapped = new Map<string, TeamDetails>(mappedEntries)

      setTeamMap(mapped)
    }

    void loadTeamDetails()
  }, [])

  const selectedSource = useMemo(() => {
    if (sourceType === 'team') {
      // 팀 모드: profile_documents에서 해당 팀 조회
      return documents.find((doc) => doc.type === 'team' && doc.source_id === selectedSourceId) ?? null
    } else {
      // 유저 모드: profile_documents에서 내 프로필 조회
      return documents.find((doc) => doc.type === 'user' && doc.source_id === selectedSourceId) ?? null
    }
  }, [selectedSourceId, documents, sourceType])

  const targetType: DocType = sourceType === 'team' ? 'user' : 'team'
  const visibleResults = useMemo(() => {
    if (sourceType !== 'user' || !currentUserId) {
      return results
    }

    return results.filter((result) => {
      if (result.type !== 'team') {
        return true
      }

      const team = teamMap.get(result.source_id)
      if (!team) {
        return true
      }

      if (team.leaderId === currentUserId) {
        return false
      }

      return !team.members.some((member) => member.userId === currentUserId)
    })
  }, [currentUserId, results, sourceType, teamMap])
  const shouldShowRefreshHint =
    sourceType === 'team' &&
    !!selectedSource &&
    !loadingMatches &&
    !error &&
    visibleResults.length === 0

  useEffect(() => {
    if (sourceType === 'team') {
      // 팀 모드: myLeaderTeams 기준
      if (myLeaderTeams.length === 0) {
        setSelectedSourceId('')
        return
      }
      if (!myLeaderTeams.some((t) => t.teamCode === selectedSourceId)) {
        const firstTeamCode = myLeaderTeams[0].teamCode
        setSelectedSourceId(firstTeamCode)
        recordEvent('matcher_profile_select', sourceType, firstTeamCode, { actionType: 'autoSelect' })
      }
    } else {
      // 유저 모드: 로그인 유저 자동 설정
      if (user?.userId && selectedSourceId !== user.userId) {
        setSelectedSourceId(user.userId)
        recordEvent('matcher_profile_select', sourceType, user.userId, { actionType: 'autoSelect' })
      }
    }
  }, [selectedSourceId, sourceType, myLeaderTeams, user?.userId, recordEvent])

  const runMatch = async () => {
    if (!selectedSource) return

    setLoadingMatches(true)
    setError(null)

    const { data, error: rpcError } = await supabase.rpc('match_profile_documents_by_source', {
      query_source_id: selectedSource.source_id,
      query_source_type: selectedSource.type,
      match_count: 6,
      filter_type: targetType,
      filter_hackathon_slug: null,
      filter_is_open: targetType === 'team' && openOnly === 'open' ? true : null,
      exclude_source_id: selectedSource.source_id,
    })

    if (rpcError) {
      setError(rpcError.message)
      setResults([])
      setLoadingMatches(false)
      return
    }

    setResults((data ?? []) as MatchResult[])
    setLoadingMatches(false)
  }

  useEffect(() => {
    if (!selectedSource) {
      setResults([])
      return
    }
    void runMatch()
  }, [selectedSourceId, sourceType, openOnly])

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
      <section className="mb-10 rounded-[2rem] border border-white/60 bg-white/80 p-8 shadow-[0_24px_80px_rgba(14,165,233,0.12)] backdrop-blur-xl">
        <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex-1">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-[#3B82F6]/15 bg-[#3B82F6]/5 px-4 py-2 text-sm font-semibold text-[#2563EB]">
              <Sparkles className="h-4 w-4" />
              팀·팀원 매칭 서비스
            </div>
            <h1 className="text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl mb-3">
              AI 매칭 랩
            </h1>
            <p className="text-base leading-7 text-slate-600 sm:text-lg">
              AI 기반 팀·팀원 매칭으로 개인과 팀을 정밀하게 연결합니다
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Button asChild className="rounded-xl bg-gradient-to-r from-[#3B82F6] to-[#0EA5E9] px-5 text-white shadow-lg hover:opacity-95">
              <Link to="/">
                메인으로
                <ArrowUpRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      <div className="grid gap-8 lg:grid-cols-[340px_minmax(0,1fr)]">
        <Card className="border border-slate-200/80 bg-white p-7 shadow-[0_18px_50px_rgba(15,23,42,0.08)]">
          <div className="mb-6 flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-[#3B82F6] to-[#0EA5E9] text-white">
              <Bot className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900">매칭 설정</h2>
              <p className="text-sm text-slate-500">기준과 필터를 편하게 조정하세요</p>
            </div>
          </div>

          <div className="space-y-5">
            <div>
              <p className="mb-2 text-sm font-semibold text-slate-700">모드</p>
              <div className="grid gap-2">
                {sourceTypeOptions.map((option) => {
                  const active = option.value === sourceType
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => {
                        setSourceType(option.value)
                        recordEvent('matcher_filter', option.value === 'team' ? 'team' : 'user', option.value, { filterType: 'sourceType', filterValue: option.value })
                      }}
                      className={`flex items-center gap-3 rounded-2xl border px-4 py-3 text-left transition-all ${active ? 'border-[#3B82F6]/30 bg-[#3B82F6]/8 shadow-sm' : 'border-slate-200 bg-white hover:border-[#3B82F6]/20 hover:bg-slate-50'}`}
                    >
                      <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${active ? 'bg-gradient-to-br from-[#3B82F6] to-[#0EA5E9] text-white' : 'bg-slate-100 text-slate-500'}`}>
                        <option.icon className="h-5 w-5" />
                      </div>
                      <div>
                        <div className="font-semibold text-slate-900">{option.label}</div>
                        <div className="text-xs text-slate-500">{option.value === 'team' ? '팀 기준 추천' : '내 기준 추천'}</div>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>

            {sourceType === 'team' && (
              <div>
                <p className="mb-2 text-sm font-semibold text-slate-700">선택한 팀</p>
                {myLeaderTeams.length === 0 ? (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
                    선택 가능한 팀이 없습니다. 팀장으로 소속된 팀만 선택할 수 있습니다.
                  </div>
                ) : (
                  <select
                    value={selectedSourceId}
                    onChange={(event) => {
                      const newSourceId = event.target.value
                      setSelectedSourceId(newSourceId)
                      recordEvent('matcher_profile_select', sourceType, newSourceId, { actionType: 'profileSelect' })
                    }}
                    className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-[#3B82F6]/40 focus:ring-4 focus:ring-[#3B82F6]/10"
                  >
                    {myLeaderTeams.map((team) => (
                      <option key={team.teamCode} value={team.teamCode}>
                        {team.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            )}

            {targetType === 'team' && (
              <div>
                <p className="mb-2 text-sm font-semibold text-slate-700">모집 상태</p>
                <select
                  value={openOnly}
                  onChange={(event) => {
                    const newFilter = event.target.value as 'all' | 'open'
                    setOpenOnly(newFilter)
                    recordEvent('matcher_filter', sourceType, newFilter, { filterType: 'openOnly', filterValue: newFilter })
                  }}
                  className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-[#3B82F6]/40 focus:ring-4 focus:ring-[#3B82F6]/10"
                >
                  <option value="all">전체</option>
                  <option value="open">모집중만</option>
                </select>
              </div>
            )}

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
              <p className="font-semibold text-slate-900">현재 보기</p>
              <p className="mt-1">{targetType === 'team' ? '추천 팀' : '추천 팀원'}을 잘 맞는 순으로 보여줍니다.</p>
            </div>
          </div>
        </Card>

        <div className="space-y-8">
          <Card className="border border-slate-200/80 bg-white p-7 shadow-[0_18px_50px_rgba(15,23,42,0.08)]">
            <div className="mb-4">
              <h2 className="text-2xl font-bold text-slate-900">{sourceType === 'user' ? '내 프로필' : '선택한 팀'}</h2>
              <p className="text-sm text-slate-600 mt-1">
                {sourceType === 'user' ? '나와 잘 맞는 팀을 찾아드려요' : '매칭 기준이 될 팀이에요'}
              </p>
            </div>

            {loadingDocs ? (
              <p className="text-sm text-slate-500">추천 데이터를 불러오는 중입니다.</p>
            ) : sourceType === 'team' ? (
              // 팀 모드: myLeaderTeams에서 선택된 팀 표시
              (() => {
                const selectedTeam = myLeaderTeams.find((t) => t.teamCode === selectedSourceId)
                return selectedTeam ? (
                  <div className="rounded-3xl border border-slate-200 bg-slate-50 p-6">
                    <div className="mb-4 flex flex-wrap items-center gap-2">
                      <Badge className={`rounded-full px-3 py-1 hover:bg-transparent ${selectedTeam.isOpen ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-200 text-slate-600'}`}>
                        {selectedTeam.isOpen ? '모집중' : '모집 마감'}
                      </Badge>
                    </div>
                    <div className="space-y-4">
                      <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_220px]">
                        <InfoBlock label="팀명" value={selectedTeam.name} />
                        <InfoBlock label="팀원" value={`${selectedTeam.memberCount}/${selectedTeam.maxMembers}명`} />
                      </div>
                      <InfoBlock label="소개" value={selectedTeam.intro || '상세 정보 없음'} />
                      <div className="grid gap-3 xl:grid-cols-2">
                        <TagGroup label="모집 역할" values={selectedTeam.lookingFor} tone="sky" />
                        <TagGroup label="태그" values={selectedTeam.tags} />
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-slate-500">왼쪽에서 팀을 선택해주세요.</p>
                )
              })()
            ) : selectedSource ? (
              // 유저 모드: profile_documents에서 내 프로필 표시
              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-6">
                <SourceSummary doc={selectedSource} userMap={userMap} teamMap={teamMap} />
              </div>
            ) : (
              <p className="text-sm text-slate-500">로그인이 필요합니다.</p>
            )}
          </Card>

          <Card className="border border-slate-200/80 bg-white p-7 shadow-[0_18px_50px_rgba(15,23,42,0.08)]">
            <div className="mb-6 flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#0EA5E9]">추천 결과</p>
                <h2 className="text-2xl font-bold text-slate-900">추천 리스트</h2>
              </div>
              <Badge className="rounded-full bg-slate-100 px-3 py-1 text-slate-600 hover:bg-slate-100">
                {loadingMatches ? '계산 중' : `${visibleResults.length}개 결과`}
              </Badge>
            </div>

            {error && (
              <div className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600">
                {error}
              </div>
            )}

            <div className="space-y-4">
              {loadingMatches ? (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-5 py-10 text-center">
                  <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-[#3B82F6]" />
                  <p className="mt-4 text-sm font-semibold text-slate-700">추천 결과를 계산하고 있습니다.</p>
                  <p className="mt-1 text-sm text-slate-500">프로필과 팀 정보를 바탕으로 매칭 중입니다.</p>
                </div>
              ) : null}

              {visibleResults.map((result) => (
                <div key={`${result.type}-${result.source_id}`} className="rounded-[1.5rem] border border-slate-200 bg-slate-50/70 p-5 transition-all hover:border-[#3B82F6]/25 hover:bg-white">
                  {(() => {
                    const matchedTeam = result.type === 'team' ? teamMap.get(result.source_id) : null
                    const effectiveTeamIsOpen = matchedTeam?.isOpen ?? result.is_open ?? null

                    return (
                      <div>
                        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div>
                            <h3 className="text-lg font-bold text-slate-900">
                              {result.type === 'team'
                                ? teamMap.get(result.source_id)?.name ?? result.source_id
                                : userMap.get(result.source_id)?.nickname ?? result.source_id}
                            </h3>
                            <p className="mt-2 text-sm leading-6 text-slate-500">
                              {result.type === 'team' ? '조건에 잘 맞는 팀입니다.' : '조건에 잘 맞는 팀원입니다.'}
                            </p>
                          </div>

                          <div className="rounded-2xl bg-gradient-to-br from-[#3B82F6] to-[#0EA5E9] px-4 py-3 text-right text-white shadow-lg">
                            <div className="text-xs uppercase tracking-[0.2em] text-white/80">매칭 점수</div>
                            <div className="text-2xl font-black">{result.similarity.toFixed(3)}</div>
                          </div>
                        </div>

                        <div className="rounded-3xl border border-white bg-white p-5">
                          <div className="mb-4 flex flex-wrap items-center gap-2">
                            {result.type === 'team' && effectiveTeamIsOpen !== null && (
                              <Badge className={`rounded-full px-3 py-1 hover:bg-transparent ${effectiveTeamIsOpen ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-200 text-slate-600'}`}>
                                {effectiveTeamIsOpen ? '모집중' : '모집 마감'}
                              </Badge>
                            )}
                          </div>
                          <SourceSummary doc={result} userMap={userMap} teamMap={teamMap} />
                          {sourceType === 'team' && result.type === 'user' ? (
                            <MatchActionButton
                              currentUserId={user?.userId}
                              currentUserInternalId={user?.id}
                              currentUserNickname={user?.nickname}
                              targetUserId={result.source_id}
                              targetNickname={userMap.get(result.source_id)?.nickname ?? result.source_id}
                            />
                          ) : null}
                          {sourceType === 'user' && result.type === 'team' && matchedTeam ? (
                            <MatchTeamActionButtons
                              team={matchedTeam}
                              allTeams={teamMap}
                              currentUserId={currentUserId}
                              currentUserNickname={user?.nickname}
                            />
                          ) : null}
                        </div>
                      </div>
                    )
                  })()}
                </div>
              ))}

              {!loadingMatches && visibleResults.length === 0 && !error && (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-5 py-10 text-center">
                  <p className="text-sm text-slate-500">
                    {shouldShowRefreshHint
                      ? '결과가 나타나지 않는 경우 결과 새로보기를 눌러주세요.'
                      : '현재 조건에서 추천 리스트가 없습니다.'}
                  </p>
                  {shouldShowRefreshHint ? (
                    <Button
                      variant="outline"
                      onClick={() => void runMatch()}
                      className="mt-4 rounded-xl border-[#3B82F6]/20 bg-white text-slate-700"
                    >
                      결과 새로보기
                      <ArrowRightLeft className="h-4 w-4" />
                    </Button>
                  ) : null}
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}
