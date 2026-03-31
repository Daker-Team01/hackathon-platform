import { useEffect, useMemo, useRef, useState } from "react"
import { useSearchParams, useNavigate, Link } from "react-router-dom"
import { 
  Users, MessageSquare, Plus, ArrowLeft, Filter, 
  Settings, Edit, Lock, Unlock, ExternalLink, Shield, Flame
} from "lucide-react"

import {
  useCancelTeamRequest,
  useCreateTeamRequest,
  useTeam,
  useTeamRequestsForUser,
  useTeams,
  useTeamsByLeader,
  useUpdateTeam
} from "../hooks/useTeams"
import { useUser } from "../contexts/UserContext"
import { useLog } from "../contexts/LogContext"
import { supabase } from "../lib/supabase"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { normalizedHackathons } from "@/lib/hackathonData"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog"
import type { EventLog } from "../types/log"
import type { TeamMember } from "../types/team"
import {
  getCollaborationEligibility,
  getUserCollaborationTemperature,
  saveCollaborationTemperatureReview
} from "../lib/collaborationTemperature"

export default function Camp() {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const hackathonFilter = params.get("hackathon") || "all"
  const statusFilterParam = params.get("status")
  const statusFilter = statusFilterParam === "open" || statusFilterParam === "closed" ? statusFilterParam : "all"
  const ownerFilterParam = params.get("owner")
  const ownerFilter = ownerFilterParam === "leader" ? "leader" : "all"
  const slug = hackathonFilter === "all" ? undefined : hackathonFilter
  const selectedTeamCode = params.get("team") || ""

  const { user } = useUser()
  const { recordEvent } = useLog()
  const teamDetailOpenedAtRef = useRef<number | null>(null)
  const closingTeamCodeRef = useRef<string | null>(null)
  const lastImpressionKeyRef = useRef<string>("")
  const { data: teams, isLoading, isError: isTeamsError, error: teamsError } = useTeams(slug)
  const currentUserId = user?.id || user?.userId || ""
  const {
    data: leaderTeams,
    isLoading: isLeaderTeamsLoading,
    isError: isLeaderTeamsError,
    error: leaderTeamsError
  } = useTeamsByLeader(currentUserId, { enabled: ownerFilter === "leader" })
  const {
    data: selectedTeamDetail,
    isLoading: isSelectedTeamLoading,
    isError: isSelectedTeamError,
    error: selectedTeamError
  } = useTeam(selectedTeamCode)
  const { data: myRequests = [] } = useTeamRequestsForUser(currentUserId)
  const mutation = useUpdateTeam()
  const createTeamRequestMutation = useCreateTeamRequest()
  const cancelTeamRequestMutation = useCancelTeamRequest()
  const [teamInteractionLogs, setTeamInteractionLogs] = useState<EventLog[]>([])
  const [selectedReviewMember, setSelectedReviewMember] = useState<TeamMember | null>(null)
  const [reviewScore, setReviewScore] = useState(0)
  const [reviewError, setReviewError] = useState('')

  const hackathonTitleMap = useMemo(
    () => new Map(normalizedHackathons.map((hackathon) => [hackathon.slug, hackathon.title] as const)),
    []
  )
  const selectableHackathons = useMemo(
    () => normalizedHackathons.filter((hackathon) => hackathon.status !== "ended"),
    []
  )

  const selectedTeam = selectedTeamDetail || teams?.find((team) => team.teamCode === selectedTeamCode)
  const selectedTeamMemberIds = useMemo(() => {
    if (!selectedTeam) return []

    return Array.from(new Set([selectedTeam.leaderId, ...selectedTeam.members.map((member) => member.userId)].filter(Boolean)))
  }, [selectedTeam])
  const currentSelectedTeamMember = useMemo(() => {
    if (!selectedTeam || !currentUserId) return null
    return selectedTeam.members.find((member) => member.userId === currentUserId) ?? null
  }, [currentUserId, selectedTeam])
  const selectedTeamHackathonStatus = selectedTeam?.hackathonSlug
    ? normalizedHackathons.find((hackathon) => hackathon.slug === selectedTeam.hackathonSlug)?.status
    : undefined
  const isRequestAllowedByHackathonStatus = selectedTeamHackathonStatus !== "ended"
  const isSelectedTeamMember = !!selectedTeam && !!currentUserId && selectedTeam.members.some((member) => member.userId === currentUserId)
  const isSelectedTeamLeader = !!selectedTeam && !!currentUserId && selectedTeam.leaderId === currentUserId
  const pendingJoinRequest = myRequests.find(
    (request) => request.teamId === selectedTeamCode && request.requestType === 'JOIN' && request.status === 'PENDING'
  )
  const pendingLeaveRequest = myRequests.find(
    (request) => request.teamId === selectedTeamCode && request.requestType === 'LEAVE' && request.status === 'PENDING'
  )
  const hasJoinedAnotherTeamInSameHackathon = useMemo(() => {
    if (!selectedTeam?.hackathonSlug || !currentUserId) return false

    return (teams || []).some((team) => {
      if (!team.hackathonSlug || team.hackathonSlug !== selectedTeam.hackathonSlug) return false
      if (team.teamCode === selectedTeam.teamCode) return false
      return team.leaderId === currentUserId || team.members.some((member) => member.userId === currentUserId)
    })
  }, [currentUserId, selectedTeam, teams])

  const sourceTeams = useMemo(() => {
    if (ownerFilter !== "leader") {
      return teams || []
    }

    const byLeader = leaderTeams || []
    if (hackathonFilter === "all") return byLeader
    return byLeader.filter((team) => team.hackathonSlug === hackathonFilter)
  }, [hackathonFilter, leaderTeams, ownerFilter, teams])

  const filteredTeams = useMemo(() => {
    const source = sourceTeams

    if (statusFilter === "open") {
      return source.filter((team) => team.isOpen)
    }

    if (statusFilter === "closed") {
      return source.filter((team) => !team.isOpen)
    }

    return source
  }, [sourceTeams, statusFilter])

  const prioritizedTeams = useMemo(() => {
    return [...filteredTeams].sort((left, right) => {
      const leftMine = !!currentUserId && (left.leaderId === currentUserId || left.members.some((member) => member.userId === currentUserId))
      const rightMine = !!currentUserId && (right.leaderId === currentUserId || right.members.some((member) => member.userId === currentUserId))

      if (leftMine === rightMine) return 0
      return leftMine ? -1 : 1
    })
  }, [filteredTeams, currentUserId])

  const effectiveIsLoading = ownerFilter === "leader" ? isLeaderTeamsLoading : isLoading
  const effectiveIsError = ownerFilter === "leader" ? isLeaderTeamsError : isTeamsError
  const openCount = useMemo(() => sourceTeams.filter((team) => team.isOpen).length, [sourceTeams])
  const closedCount = useMemo(() => sourceTeams.filter((team) => !team.isOpen).length, [sourceTeams])
  const hasLoadError = effectiveIsError || (Boolean(selectedTeamCode) && isSelectedTeamError)
  const loadErrorMessage =
    (leaderTeamsError instanceof Error ? leaderTeamsError.message : null) ||
    (teamsError instanceof Error ? teamsError.message : null) ||
    (selectedTeamError instanceof Error ? selectedTeamError.message : null) ||
    '데이터를 불러오는 중 오류가 발생했습니다.'

  const getHackathonLabel = (hackathonSlug?: string) => {
    if (!hackathonSlug) return "일반 프로젝트"
    return hackathonTitleMap.get(hackathonSlug) || hackathonSlug
  }

  useEffect(() => {
    if (!selectedTeam || selectedTeamMemberIds.length === 0) {
      setTeamInteractionLogs([])
      return
    }

    let cancelled = false

    async function fetchTeamInteractionLogs() {
      const { data, error } = await supabase
        .from('user_logs')
        .select('*')
        .in('user_id', selectedTeamMemberIds)
        .gte('created_at', selectedTeam.createdAt)
        .order('created_at', { ascending: false })
        .limit(1000)

      if (error) {
        console.error('Failed to fetch team interaction logs:', error)
        if (!cancelled) {
          setTeamInteractionLogs([])
        }
        return
      }

      if (!cancelled) {
        setTeamInteractionLogs((data || []) as EventLog[])
      }
    }

    void fetchTeamInteractionLogs()

    return () => {
      cancelled = true
    }
  }, [selectedTeam, selectedTeamMemberIds])

  const getMemberCollaborationEligibility = (member: TeamMember) => {
    if (!selectedTeam) {
      return { canReview: false, reason: '팀 정보를 찾을 수 없습니다.' }
    }

    if (!isSelectedTeamMember) {
      return { canReview: false, reason: '소속된 팀원만 협업 온도를 평가할 수 있습니다.' }
    }

    return getCollaborationEligibility({
      reviewerUserId: currentUserId,
      revieweeUserId: member.userId,
      teamCode: selectedTeam.teamCode,
      teamCreatedAt: selectedTeam.createdAt,
      reviewerJoinedAt: currentSelectedTeamMember?.joinedAt ?? selectedTeam.createdAt,
      revieweeJoinedAt: member.joinedAt,
      interactionLogs: teamInteractionLogs
    })
  }

  const handleOpenCollaborationReview = (member: TeamMember) => {
    setSelectedReviewMember(member)
    setReviewScore(0)
    setReviewError('')
  }

  const handleSubmitCollaborationReview = () => {
    if (!selectedTeam || !selectedReviewMember || !currentUserId) return
    if (reviewScore < 1 || reviewScore > 5) {
      setReviewError('협업 온도 점수를 선택해주세요.')
      return
    }

    const eligibility = getMemberCollaborationEligibility(selectedReviewMember)
    if (!eligibility.canReview) {
      setReviewError(eligibility.reason)
      return
    }

    try {
      saveCollaborationTemperatureReview({
        reviewerUserId: currentUserId,
        revieweeUserId: selectedReviewMember.userId,
        teamCode: selectedTeam.teamCode,
        score: reviewScore,
        createdAt: new Date().toISOString()
      })
      setSelectedReviewMember(null)
      setReviewScore(0)
      setReviewError('')
      window.alert('협업 온도 평가를 저장했습니다.')
    } catch (error) {
      setReviewError(error instanceof Error ? error.message : '협업 온도 평가 저장에 실패했습니다.')
    }
  }

  useEffect(() => {
    recordEvent('page_view', 'page', '/camp', {
      page: 'camp',
      hackathonFilter,
      statusFilter,
      ownerFilter
    })
  }, [hackathonFilter, ownerFilter, recordEvent, statusFilter])

  useEffect(() => {
    if (selectedTeamCode) {
      teamDetailOpenedAtRef.current = Date.now()
      return
    }

    const closedTeamCode = closingTeamCodeRef.current
    const openedAt = teamDetailOpenedAtRef.current

    if (closedTeamCode && openedAt) {
      recordEvent('team_detail_dwell', 'team', closedTeamCode, {
        page: 'camp',
        durationMs: Date.now() - openedAt
      })
    }

    teamDetailOpenedAtRef.current = null
    closingTeamCodeRef.current = null
  }, [recordEvent, selectedTeamCode])

  useEffect(() => {
    if (effectiveIsLoading || hasLoadError || prioritizedTeams.length === 0) return

    const impressionKey = `${hackathonFilter}|${statusFilter}|${prioritizedTeams.map((team) => team.teamCode).join(',')}`
    if (lastImpressionKeyRef.current === impressionKey) return
    lastImpressionKeyRef.current = impressionKey

    recordEvent('recommendation_impression', 'team', hackathonFilter === 'all' ? 'all' : hackathonFilter, {
      page: 'camp',
      statusFilter,
      ownerFilter,
      resultCount: prioritizedTeams.length,
      teamCodes: prioritizedTeams.slice(0, 20).map((team) => team.teamCode)
    })
  }, [effectiveIsLoading, hackathonFilter, hasLoadError, ownerFilter, prioritizedTeams, recordEvent, statusFilter])

  const handleToggleOpen = (teamCode: string, currentIsOpen: boolean) => {
    mutation.mutate(
      { teamCode, updates: { isOpen: !currentIsOpen } },
      {
        onSuccess: () => {
          recordEvent('team_recruit_toggle', 'team', teamCode, {
            nextIsOpen: !currentIsOpen
          })
        },
        onError: (error) => {
          recordEvent('api_error', 'team', teamCode, {
            api: 'updateTeam',
            action: 'team_recruit_toggle',
            message: error instanceof Error ? error.message : 'unknown_error'
          })
        }
      }
    )
  }

  const openTeamDetail = (teamCode: string) => {
    const position = prioritizedTeams.findIndex((team) => team.teamCode === teamCode) + 1

    recordEvent('card_click', 'team', teamCode, {
      page: 'camp',
      action: 'openTeamDetail'
    })
    recordEvent('recommendation_click', 'team', teamCode, {
      page: 'camp',
      position: position > 0 ? position : null,
      hackathonFilter,
      statusFilter,
      ownerFilter
    })
    recordEvent('team_detail_open', 'team', teamCode, {
      page: 'camp'
    })

    const nextParams = new URLSearchParams(params)
    nextParams.set("team", teamCode)
    setParams(nextParams)
  }

  const closeTeamDetail = () => {
    if (selectedTeamCode) {
      recordEvent('team_detail_close', 'team', selectedTeamCode, {
        page: 'camp'
      })
      closingTeamCodeRef.current = selectedTeamCode
    }

    const nextParams = new URLSearchParams(params)
    nextParams.delete("team")
    setParams(nextParams)
  }

  const handleCreateRequest = (requestType: 'JOIN' | 'LEAVE') => {
    if (!selectedTeam || !user) return

    createTeamRequestMutation.mutate(
      {
        teamId: selectedTeam.teamCode,
        requestType,
        requesterUserId: user.id,
        requesterUserName: user.nickname
      },
      {
        onSuccess: () => {
          recordEvent('team_request_create', 'team', selectedTeam.teamCode, {
            requestType,
            teamName: selectedTeam.name,
            hackathonSlug: selectedTeam.hackathonSlug ?? null
          })
          alert(requestType === 'JOIN' ? '가입 신청을 보냈습니다.' : '탈퇴 신청을 보냈습니다.')
        },
        onError: (error) => {
          recordEvent('api_error', 'team', selectedTeam.teamCode, {
            api: 'createTeamRequest',
            action: 'team_request_create',
            requestType,
            message: error instanceof Error ? error.message : 'unknown_error'
          })
          alert(error instanceof Error ? error.message : '요청 처리에 실패했습니다.')
        }
      }
    )
  }

  const handleCancelRequest = (requestId: string) => {
    if (!user) return

    cancelTeamRequestMutation.mutate(
      { requestId, requesterUserId: user.id },
      {
        onSuccess: () => {
          recordEvent('team_request_cancel', 'team', selectedTeamCode || requestId, {
            requestId,
            page: 'camp'
          })
          alert('요청을 취소했습니다.')
        },
        onError: (error) => {
          recordEvent('api_error', 'team', selectedTeamCode || requestId, {
            api: 'cancelTeamRequest',
            action: 'team_request_cancel',
            requestId,
            message: error instanceof Error ? error.message : 'unknown_error'
          })
          alert(error instanceof Error ? error.message : '요청 취소에 실패했습니다.')
        }
      }
    )
  }

  const updateHackathonFilter = (nextHackathonSlug: string) => {
    recordEvent('team_filter', 'team', nextHackathonSlug === 'all' ? 'all' : nextHackathonSlug, {
      filterType: 'hackathon',
      filterValue: nextHackathonSlug
    })

    const nextParams = new URLSearchParams(params)

    if (nextHackathonSlug === "all") {
      nextParams.delete("hackathon")
    } else {
      nextParams.set("hackathon", nextHackathonSlug)
    }

    nextParams.delete("team")
    setParams(nextParams)
  }

  const updateStatusFilter = (nextStatus: "all" | "open" | "closed") => {
    recordEvent('team_filter', 'team', nextStatus, {
      filterType: 'status',
      filterValue: nextStatus
    })

    const nextParams = new URLSearchParams(params)

    if (nextStatus === "all") {
      nextParams.delete("status")
    } else {
      nextParams.set("status", nextStatus)
    }

    nextParams.delete("team")
    setParams(nextParams)
  }

  const updateOwnerFilter = (nextOwner: "all" | "leader") => {
    recordEvent('team_filter', 'team', nextOwner, {
      filterType: 'owner',
      filterValue: nextOwner
    })

    const nextParams = new URLSearchParams(params)

    if (nextOwner === "all") {
      nextParams.delete("owner")
    } else {
      nextParams.set("owner", nextOwner)
    }

    nextParams.delete("team")
    setParams(nextParams)
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Navigation & Header */}
      <div className="flex items-center justify-between mb-8">
        <Button 
          variant="ghost" 
          onClick={() => navigate('/')}
          className="hover:bg-gray-100 -ml-2 text-gray-600"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          메인으로
        </Button>
        <div className="flex gap-3">
          <Link to="/camp/new">
            <Button className="bg-gradient-to-r from-[#3B82F6] to-[#0EA5E9] text-white hover:opacity-90 shadow-lg rounded-xl px-6">
              <Plus className="w-4 h-4 mr-2" />
              팀 모집글 생성
            </Button>
          </Link>
        </div>
      </div>

      <div className="mb-10">
        <h1 className="text-4xl font-extrabold text-gray-900 mb-4 tracking-tight flex items-center gap-3">
          <Users className="w-10 h-10 text-[#3B82F6]" />
          팀원 모집
        </h1>
        <p className="text-gray-600 text-lg max-w-2xl font-medium">
          함께 혁신을 만들어갈 최고의 팀원을 찾아보세요.
        </p>

        <div className="mt-6 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm space-y-4">
          <div className="flex items-center gap-2 text-sm font-bold text-gray-600">
            <Filter className="w-4 h-4" />
            팀 필터
          </div>

          <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3 items-center">
            <div className="space-y-1">
              <p className="text-xs text-gray-500">해커톤</p>
              <select
                value={hackathonFilter}
                onChange={(event) => updateHackathonFilter(event.target.value)}
                className="h-10 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-300"
              >
                <option value="all">전체 해커톤</option>
                {selectableHackathons.map((hackathon) => (
                  <option key={hackathon.slug} value={hackathon.slug}>
                    {hackathon.title}
                  </option>
                ))}
              </select>
            </div>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/camp')}
              className="text-gray-400 hover:text-gray-600 text-xs md:mt-5"
            >
              필터 해제
            </Button>
          </div>

          <div className="space-y-1">
            <p className="text-xs text-gray-500">모집 상태</p>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant={statusFilter === "all" ? "default" : "outline"}
                onClick={() => updateStatusFilter("all")}
                className="rounded-full"
              >
                전체 ({sourceTeams.length})
              </Button>
              <Button
                size="sm"
                variant={statusFilter === "open" ? "default" : "outline"}
                onClick={() => updateStatusFilter("open")}
                className="rounded-full"
              >
                모집중 ({openCount})
              </Button>
              <Button
                size="sm"
                variant={statusFilter === "closed" ? "default" : "outline"}
                onClick={() => updateStatusFilter("closed")}
                className="rounded-full"
              >
                모집마감 ({closedCount})
              </Button>
            </div>
          </div>

          <div className="space-y-1">
            <p className="text-xs text-gray-500">소유 구분</p>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant={ownerFilter === "all" ? "default" : "outline"}
                onClick={() => updateOwnerFilter("all")}
                className="rounded-full"
              >
                전체 팀
              </Button>
              <Button
                size="sm"
                variant={ownerFilter === "leader" ? "default" : "outline"}
                onClick={() => updateOwnerFilter("leader")}
                className="rounded-full"
                disabled={!currentUserId}
              >
                내 팀
              </Button>
            </div>
          </div>
        </div>
      </div>

      {effectiveIsLoading ? (
        <div className="space-y-6">
          <div className="flex items-center justify-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
            <span className="h-4 w-4 rounded-full border-2 border-slate-300 border-t-slate-600 animate-spin" />
            <span>팀 목록을 불러오는 중입니다...</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-64 bg-gray-50 rounded-3xl animate-pulse" />
            ))}
          </div>
        </div>
      ) : hasLoadError ? (
        <Card className="p-12 text-center bg-red-50 border-red-100">
          <div className="text-5xl mb-4">⚠️</div>
          <h2 className="text-2xl font-bold text-red-900 mb-2">오류가 발생했습니다</h2>
          <p className="text-red-700 mb-6">{loadErrorMessage}</p>
          <Button variant="destructive" onClick={() => window.location.reload()}>
            다시 시도
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {prioritizedTeams.map((team) => {
            const isAuthor = !!currentUserId && currentUserId === team.leaderId
            const isMember = !!currentUserId && team.members.some((member) => member.userId === currentUserId)
            
            return (
              <Card 
                key={team.teamCode} 
                role="button"
                tabIndex={0}
                onClick={() => openTeamDetail(team.teamCode)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault()
                    openTeamDetail(team.teamCode)
                  }
                }}
                className={`p-8 border-0 shadow-xl bg-white rounded-3xl hover:shadow-2xl transition-all duration-300 group relative overflow-hidden cursor-pointer`}
              >
                {/* Status Badge Overlays */}
                <div className="absolute top-0 right-0 p-6 flex gap-2">
                  <Badge className={`${team.isOpen ? 'bg-emerald-500' : 'bg-red-500'} text-white border-0 shadow-sm`}>
                    {team.isOpen ? "모집중" : "모집마감"}
                  </Badge>
                  {isAuthor && (
                    <Badge className="bg-blue-600 text-white border-0 shadow-sm flex items-center gap-1">
                      <Shield className="w-3 h-3" />
                      내 팀
                    </Badge>
                  )}
                  {!isAuthor && isMember && (
                    <Badge className="bg-violet-600 text-white border-0 shadow-sm">
                      내 소속팀
                    </Badge>
                  )}
                </div>

                {/* Content */}
                <div className="mb-6">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs font-bold text-gray-300 tracking-widest uppercase">{team.teamCode}</span>
                    <span className="text-gray-200">•</span>
                    <span className="text-xs font-bold text-blue-500 uppercase tracking-widest">{getHackathonLabel(team.hackathonSlug)}</span>
                  </div>
                  <h3 className="text-2xl font-black text-gray-900 group-hover:text-blue-600 transition-colors flex items-center gap-3 mb-4">
                    {team.name}
                    <span className="text-lg font-bold text-gray-400">({team.memberCount}/{team.maxMembers}명)</span>
                  </h3>
                  <p className="text-gray-600 leading-relaxed min-h-[3rem] line-clamp-2">
                    {team.intro}
                  </p>
                </div>

                <div className="space-y-4 mb-8">
                  <div className="flex flex-wrap gap-2">
                    <span className="text-sm font-bold text-gray-400 mr-2 self-center uppercase tracking-tighter">Looking for:</span>
                    {team.lookingFor.length > 0 ? (
                      team.lookingFor.map(role => (
                        <Badge key={role} variant="outline" className="bg-gray-50 text-gray-600 border-gray-100 rounded-lg px-3">
                          {role}
                        </Badge>
                      ))
                    ) : (
                      <span className="text-sm text-gray-400 italic">모집 인원 없음</span>
                    )}
                  </div>
                </div>
                
                <div
                  className="flex flex-wrap items-center gap-3 pt-6 border-t border-gray-50 mt-auto"
                  onClick={(event) => event.stopPropagation()}
                  onKeyDown={(event) => event.stopPropagation()}
                >
                  {team.contact.url && (
                    <a href={team.contact.url} target="_blank" rel="noopener noreferrer" className="flex-grow sm:flex-grow-0">
                      <Button className="w-full bg-blue-50 text-blue-600 hover:bg-blue-100 border-0 rounded-xl font-bold">
                        <MessageSquare className="w-4 h-4 mr-2" />
                        연락하기
                        <ExternalLink className="w-3 h-3 ml-2 opacity-50" />
                      </Button>
                    </a>
                  )}
                  
                  {isAuthor && (
                    <div className="flex flex-wrap gap-2 w-full sm:w-auto">
                      <Button 
                        variant="secondary"
                        onClick={() => handleToggleOpen(team.teamCode, team.isOpen)}
                        className={`rounded-xl font-bold ${team.isOpen ? 'bg-amber-100 text-amber-700 hover:bg-amber-200' : 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'}`}
                      >
                        {team.isOpen ? <Lock className="w-4 h-4 mr-2" /> : <Unlock className="w-4 h-4 mr-2" />}
                        {team.isOpen ? "마감" : "재모집"}
                      </Button>

                      <Link to={`/camp/edit/${team.teamCode}`}>
                        <Button variant="outline" className="rounded-xl font-bold border-gray-100 hover:bg-gray-50">
                          <Edit className="w-4 h-4 mr-2 text-gray-400" />
                          수정
                        </Button>
                      </Link>

                      <Link to={`/team/${team.teamCode}/manage`}>
                        <Button className="bg-gray-900 text-white hover:bg-gray-800 rounded-xl font-bold shadow-lg">
                          <Settings className="w-4 h-4 mr-2" />
                          관리
                        </Button>
                      </Link>
                    </div>
                  )}
                </div>
              </Card>
            )
          })}
        </div>
      )}

      <Dialog open={!!selectedTeamCode} onOpenChange={(isOpen) => (!isOpen ? closeTeamDetail() : undefined)}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedTeam?.name || "팀 정보"}
              {selectedTeam ? (
                <span className="text-sm text-gray-500 font-medium">({selectedTeam.memberCount}/{selectedTeam.maxMembers}명)</span>
              ) : null}
            </DialogTitle>
            <DialogDescription>
              {selectedTeam
                ? `${selectedTeam.teamCode} · ${getHackathonLabel(selectedTeam.hackathonSlug)}`
                : "팀 정보를 불러오는 중입니다."}
            </DialogDescription>
          </DialogHeader>

          {isSelectedTeamLoading ? (
            <div className="text-sm text-gray-500 py-2">팀 정보를 불러오는 중입니다...</div>
          ) : isSelectedTeamError ? (
            <div className="text-sm text-red-500 py-2">
              {selectedTeamError instanceof Error ? selectedTeamError.message : '팀 정보를 불러오는 중 오류가 발생했습니다.'}
            </div>
          ) : !selectedTeam ? (
            <div className="text-sm text-red-500 py-2">팀 정보를 찾을 수 없습니다.</div>
          ) : (
            <div className="space-y-6">
              <div>
                <h4 className="text-sm font-bold text-gray-500 mb-2">팀 소개</h4>
                <p className="text-gray-700 leading-relaxed">{selectedTeam.intro || "소개가 없습니다."}</p>
              </div>

              <div>
                <h4 className="text-sm font-bold text-gray-500 mb-2">모집 상태</h4>
                <Badge className={`${selectedTeam.isOpen ? 'bg-emerald-500' : 'bg-red-500'} text-white border-0`}>
                  {selectedTeam.isOpen ? "모집중" : "모집마감"}
                </Badge>
              </div>

              <div>
                <h4 className="text-sm font-bold text-gray-500 mb-2">모집 포지션</h4>
                <div className="flex flex-wrap gap-2">
                  {selectedTeam.lookingFor.length > 0 ? (
                    selectedTeam.lookingFor.map((role) => (
                      <Badge key={role} variant="outline" className="bg-gray-50 text-gray-700">
                        {role}
                      </Badge>
                    ))
                  ) : (
                    <span className="text-sm text-gray-400 italic">모집 중인 포지션이 없습니다.</span>
                  )}
                </div>
              </div>

              <div>
                <h4 className="text-sm font-bold text-gray-500 mb-2">팀원 목록</h4>
                {selectedTeam.members.length > 0 ? (
                  <div className="space-y-2">
                    {selectedTeam.members.map((member) => {
                      const collaborationTemperature = getUserCollaborationTemperature(member.userId)
                      const eligibility = getMemberCollaborationEligibility(member)

                      return (
                      <div key={member.userId} className="rounded-xl border border-gray-100 bg-white shadow-sm overflow-hidden">
                        {/* 상단: 이름 + 역할 */}
                        <div className="flex items-center justify-between px-4 py-3 gap-3">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-100 to-blue-200 flex items-center justify-center flex-shrink-0">
                              <span className="text-sm font-bold text-indigo-700">
                                {member.userName.charAt(0)}
                              </span>
                            </div>
                            <div>
                              <p className="font-semibold text-gray-900 flex items-center gap-1.5">
                                {member.userName}
                                {member.userId === selectedTeam.leaderId && (
                                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium">팀장</span>
                                )}
                              </p>
                              <p className="text-xs text-gray-400 mt-0.5">{member.userId}</p>
                            </div>
                          </div>
                          <div className="flex flex-col items-end gap-1">
                            <Badge variant="secondary" className="text-xs">{member.role || '미지정'}</Badge>
                            <p className="text-[11px] text-gray-400">참여일: {new Date(member.joinedAt).toLocaleDateString()}</p>
                          </div>
                        </div>

                        {/* 하단: 협업 온도 + 평가 버튼 (내가 소속된 팀원이고, 본인 제외) */}
                        {isSelectedTeamMember && member.userId !== currentUserId ? (
                          <div className="border-t border-gray-100 bg-gray-50/60 px-4 py-2.5 flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <div className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold whitespace-nowrap ${
                                collaborationTemperature.temperature >= 37.5
                                  ? 'bg-orange-100 text-orange-600'
                                  : collaborationTemperature.temperature >= 36.5
                                  ? 'bg-blue-50 text-blue-500'
                                  : 'bg-gray-100 text-gray-500'
                              }`}>
                                <Flame className={`w-3 h-3 flex-shrink-0 ${collaborationTemperature.reviewCount === 0 ? 'opacity-40' : ''}`} />
                                {`${collaborationTemperature.temperature.toFixed(1)}°C`}
                                {collaborationTemperature.reviewCount === 0 && (
                                  <span className="font-normal opacity-60 ml-0.5">(미평가)</span>
                                )}
                              </div>
                              {user && !eligibility.canReview ? (
                                <span className="text-[11px] text-gray-400 whitespace-nowrap truncate">{eligibility.reason}</span>
                              ) : null}
                            </div>
                            {user ? (
                              <Button
                                size="sm"
                                disabled={!eligibility.canReview}
                                onClick={() => handleOpenCollaborationReview(member)}
                                className={`h-7 rounded-full text-xs px-3 flex-shrink-0 ${
                                  eligibility.canReview
                                    ? 'bg-orange-500 hover:bg-orange-600 text-white border-0'
                                    : 'bg-white text-gray-400 border border-gray-200'
                                }`}
                              >
                                <Flame className="w-3 h-3 mr-1" />
                                협업 평가
                              </Button>
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                    )})}
                  </div>
                ) : (
                  <p className="text-sm text-gray-400 italic">아직 등록된 팀원이 없습니다.</p>
                )}
              </div>

              {selectedTeam.contact.url ? (
                <div className="pt-1">
                  <a href={selectedTeam.contact.url} target="_blank" rel="noopener noreferrer">
                    <Button className="w-full bg-blue-600 text-white hover:bg-blue-700">
                      <MessageSquare className="w-4 h-4 mr-2" />
                      연락 링크 열기
                    </Button>
                  </a>
                </div>
              ) : null}

              <div className="space-y-3 border-t border-gray-100 pt-4">
                <h4 className="text-sm font-bold text-gray-500">가입/탈퇴 요청</h4>

                {!user ? (
                  <p className="text-sm text-gray-500">요청 기능은 로그인 후 사용할 수 있습니다.</p>
                ) : !isRequestAllowedByHackathonStatus ? (
                  <p className="text-sm text-gray-500">종료된 해커톤 팀은 가입/탈퇴 요청이 불가능합니다.</p>
                ) : isSelectedTeamLeader ? (
                  <p className="text-sm text-gray-500">팀장은 탈퇴 요청을 보낼 수 없습니다.</p>
                ) : isSelectedTeamMember ? (
                  pendingLeaveRequest ? (
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <Button disabled className="sm:w-auto w-full">탈퇴 요청 대기중</Button>
                      <Button
                        variant="outline"
                        className="sm:w-auto w-full"
                        disabled={cancelTeamRequestMutation.isPending}
                        onClick={() => handleCancelRequest(pendingLeaveRequest.id)}
                      >
                        요청 취소
                      </Button>
                    </div>
                  ) : (
                    <Button
                      className="w-full sm:w-auto"
                      disabled={createTeamRequestMutation.isPending}
                      onClick={() => handleCreateRequest('LEAVE')}
                    >
                      팀 탈퇴 신청
                    </Button>
                  )
                ) : pendingJoinRequest ? (
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Button disabled className="sm:w-auto w-full">가입 요청 대기중</Button>
                    <Button
                      variant="outline"
                      className="sm:w-auto w-full"
                      disabled={cancelTeamRequestMutation.isPending}
                      onClick={() => handleCancelRequest(pendingJoinRequest.id)}
                    >
                      요청 취소
                    </Button>
                  </div>
                ) : !selectedTeam.isOpen ? (
                  <p className="text-sm text-gray-500">모집 마감 팀은 가입 신청이 불가능합니다.</p>
                ) : selectedTeam.memberCount >= selectedTeam.maxMembers ? (
                  <p className="text-sm text-gray-500">정원이 가득 차 가입 신청이 불가능합니다.</p>
                ) : hasJoinedAnotherTeamInSameHackathon ? (
                  <p className="text-sm text-gray-500">같은 해커톤에는 한 팀만 가입할 수 있습니다.</p>
                ) : (
                  <Button
                    className="w-full sm:w-auto"
                    disabled={createTeamRequestMutation.isPending}
                    onClick={() => handleCreateRequest('JOIN')}
                  >
                    가입 신청
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!selectedReviewMember} onOpenChange={(isOpen) => (!isOpen ? setSelectedReviewMember(null) : undefined)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Flame className="w-5 h-5 text-orange-500" />
              협업 온도 평가
            </DialogTitle>
            <DialogDescription>
              {selectedReviewMember
                ? `${selectedReviewMember.userName}님과의 실제 협업 경험을 기준으로 평가해주세요.`
                : '협업 온도를 평가합니다.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-5 gap-2">
              {[1, 2, 3, 4, 5].map((score) => (
                <Button
                  key={score}
                  type="button"
                  variant={reviewScore === score ? 'default' : 'outline'}
                  onClick={() => {
                    setReviewScore(score)
                    setReviewError('')
                  }}
                  className="rounded-xl"
                >
                  {score}점
                </Button>
              ))}
            </div>

            <div className="rounded-xl bg-orange-50 border border-orange-100 px-4 py-3 text-xs text-orange-700 space-y-1">
              <p>평가는 실제 같은 팀 경험, 24시간 이상 협업, 팀 활동 로그가 있을 때만 가능합니다.</p>
              <p>한 사용자는 다른 사용자를 한 번만 평가할 수 있습니다.</p>
            </div>

            {reviewError ? (
              <p className="text-sm text-red-500">{reviewError}</p>
            ) : null}

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setSelectedReviewMember(null)}>
                취소
              </Button>
              <Button onClick={handleSubmitCollaborationReview}>
                평가 저장
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {!effectiveIsLoading && !hasLoadError && sourceTeams.length === 0 && (
        <div className="text-center py-32 bg-gray-50/50 border-2 border-dashed border-gray-100 rounded-[3rem]">
          <Users className="w-16 h-16 text-gray-200 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-gray-900 mb-2">모집 중인 팀이 없습니다.</h3>
          <p className="text-gray-500 mb-8">첫 번째로 팀 모집글을 작성해보세요!</p>
          <Link to="/camp/new">
            <Button className="bg-[#3B82F6] text-white rounded-xl px-8 py-6 text-lg font-bold shadow-xl">
              <Plus className="w-5 h-5 mr-2" />
              팀 모집글 생성하기
            </Button>
          </Link>
        </div>
      )}

      {!effectiveIsLoading && !hasLoadError && sourceTeams.length > 0 && filteredTeams.length === 0 && (
        <div className="text-center py-32 bg-gray-50/50 border-2 border-dashed border-gray-100 rounded-[3rem]">
          <Users className="w-16 h-16 text-gray-200 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-gray-900 mb-2">조건에 맞는 팀이 없습니다.</h3>
          <p className="text-gray-500 mb-8">필터를 바꾸거나 팀 모집글을 작성해보세요!</p>
          <Link to="/camp/new">
            <Button className="bg-[#3B82F6] text-white rounded-xl px-8 py-6 text-lg font-bold shadow-xl">
              <Plus className="w-5 h-5 mr-2" />
              팀 모집글 생성하기
            </Button>
          </Link>
        </div>
      )}
    </div>
  )
}
