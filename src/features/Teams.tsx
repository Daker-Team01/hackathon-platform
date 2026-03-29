import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle, CheckCircle2, ExternalLink, Info, Users } from 'lucide-react'
import { useTeams, useUpdateTeam, useUserInvites, useRespondToInvite } from '../hooks/useTeams'
import { useUser } from '../contexts/UserContext'
import { useLog } from '../contexts/LogContext'
import { Button } from '@/components/ui/button'

type TeamsProps = {
  hackathonSlug: string
}

export default function Teams({ hackathonSlug }: TeamsProps) {
  const navigate = useNavigate()
  const { user } = useUser()
  const { recordEvent } = useLog()
  const { data: teams, isLoading } = useTeams(hackathonSlug)
  const { data: allTeams } = useTeams() // 내 팀을 찾기 위해 전체 목록 가져오기
  const { data: userInvites } = useUserInvites(user?.id || '')
  
  // 해커톤 상태 확인
  const hackathon = useMemo(() => {
    const raw = localStorage.getItem('hackathons')
    if (!raw) return null
    try {
      const parsed = JSON.parse(raw)
      return Array.isArray(parsed) ? parsed.find((h: any) => h.slug === hackathonSlug) : null
    } catch {
      return null
    }
  }, [hackathonSlug])

  const isEnded = hackathon?.status === 'ended'
  const respondMutation = useRespondToInvite()
  const updateMutation = useUpdateTeam()

  const [noticeOpen, setNoticeOpen] = useState(false)
  const [noticeConfirmed, setNoticeConfirmed] = useState(false)
  const [applyModalOpen, setApplyModalOpen] = useState(false)

  // 내가 만든 팀 중 이 해커톤에 참여하지 않은 팀들 필터링
  const myAvailableTeams = (allTeams || []).filter(
    (team) => team.leaderId === user?.id && team.hackathonSlug !== hackathonSlug
  )
  const hasMyTeamInHackathon = (allTeams || []).some(
    (team) => team.leaderId === user?.id && team.hackathonSlug === hackathonSlug
  )

  function handleOpenCreateNotice() {
    setNoticeConfirmed(false)
    setNoticeOpen(true)
  }

  function handleConfirmNotice() {
    setNoticeOpen(false)
    navigate(`/camp/new?hackathon=${hackathonSlug}`)
  }

  function handleCloseNotice() {
    setNoticeOpen(false)
  }

  function handleApplyWithTeam(teamCode: string) {
    if (hasMyTeamInHackathon) {
      alert('이미 해당 해커톤으로 만든 팀이 있어 중복 신청할 수 없습니다.')
      setApplyModalOpen(false)
      return
    }

    updateMutation.mutate(
      {
        teamCode,
        updates: { hackathonSlug }
      },
      {
        onSuccess: () => {
          alert('참여 신청이 완료되었습니다!')
          setApplyModalOpen(false)
          // 로그 수집: hackathon_join
          recordEvent('hackathon_join', 'hackathon', hackathonSlug, { teamCode })
        },
        onError: (error) => {
          alert(error instanceof Error ? error.message : '참여 신청에 실패했습니다.')
        }
      }
    )
  }

  const handleRespond = (inviteId: string, status: 'ACCEPTED' | 'REJECTED') => {
    if (window.confirm(`초대를 ${status === 'ACCEPTED' ? '수락' : '거절'}하시겠습니까? 한번 선택하면 변경할 수 없습니다.`)) {
      respondMutation.mutate(
        { inviteId, status },
        {
          onError: (error) => {
            alert(error instanceof Error ? error.message : '초대 처리에 실패했습니다.')
          }
        }
      )
    }
  }

  return (
    <section className="space-y-6">
      <div className="rounded-[28px] border border-sky-100 bg-gradient-to-br from-sky-50 via-white to-cyan-50 p-6 sm:p-8">
        <p className="text-xs font-black uppercase tracking-[0.25em] text-sky-600/70">Collaboration</p>
        <h2 className="mt-3 text-3xl font-black tracking-tight text-slate-900">Teams</h2>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600 sm:text-base">
          이 해커톤에 참여 중인 팀을 확인하고, 새 팀을 만들거나 기존 내 팀으로 참여를 신청할 수 있습니다.
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-3">
        {!isEnded ? (
          <>
            <Button
              onClick={handleOpenCreateNotice}
              variant="outline"
              className="rounded-2xl border-sky-200 bg-sky-50 px-5 py-6 font-bold text-sky-700 hover:bg-sky-100"
            >
              새 팀 생성하기
            </Button>
            {user && myAvailableTeams && myAvailableTeams.length > 0 && !hasMyTeamInHackathon && (
              <Button
                onClick={() => setApplyModalOpen(true)}
                className="rounded-2xl bg-gradient-to-r from-[#3B82F6] to-[#0EA5E9] px-5 py-6 font-bold text-white shadow-lg hover:opacity-95"
              >
                내 팀으로 신청하기 ({myAvailableTeams.length})
              </Button>
            )}
            {user && hasMyTeamInHackathon && (
              <span className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold leading-6 text-amber-700">
                이미 이 해커톤에 참여 중인 내 팀이 있어 중복 신청할 수 없습니다.
              </span>
            )}
          </>
        ) : (
          <div className="bg-amber-50 border border-amber-200 text-amber-800 px-6 py-3 rounded-2xl flex items-center gap-3 font-bold text-sm shadow-sm animate-in fade-in slide-in-from-top-2 duration-500">
            <Info className="w-5 h-5 text-amber-500" />
            이미 종료된 해커톤입니다. 팀 생성 및 신청이 제한됩니다.
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="rounded-3xl border border-slate-100 bg-slate-50 p-8 text-center text-slate-600">
          팀 목록을 불러오는 중입니다.
        </div>
      ) : !teams || teams.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 p-10 text-center">
          <p className="text-base font-semibold text-slate-700">등록된 팀이 없습니다.</p>
          <p className="mt-2 text-sm text-slate-500">첫 번째 팀을 만들어 해커톤 참여를 시작해보세요.</p>
        </div>
      ) : (
        <div className="grid gap-5 lg:grid-cols-2">
        {teams.map((team) => {
          // 해당 팀에서 온 초대 중 PENDING인 것을 먼저 찾고, 없으면 가장 최근의 것을 찾음
          const teamInvites = userInvites?.filter((inv) => inv.teamId === team.teamCode) || []
          const invite =
            teamInvites.find((inv) => inv.status === 'PENDING') ||
            (teamInvites.length > 0
              ? [...teamInvites].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0]
              : null)

          const isLeader = team.leaderId === user?.id

          return (
            <article
              key={team.teamCode}
              className="rounded-[28px] border border-slate-100 bg-gradient-to-b from-white to-slate-50 p-6 shadow-sm transition-shadow hover:shadow-lg"
            >
              <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="break-words text-xl font-black tracking-tight text-slate-900">{team.name}</h3>
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-bold ${
                        team.isOpen
                          ? 'border border-emerald-200 bg-emerald-50 text-emerald-700'
                          : 'border border-slate-200 bg-slate-100 text-slate-600'
                      }`}
                    >
                      {team.isOpen ? '모집중' : '모집마감'}
                    </span>
                  </div>

                  <p className="mt-3 whitespace-pre-line break-words text-sm leading-7 text-slate-600">
                    {team.intro || '팀 소개가 아직 등록되지 않았습니다.'}
                  </p>

                  <div className="mt-5 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-2xl border border-sky-100 bg-sky-50/70 p-4">
                      <p className="text-[11px] font-black uppercase tracking-[0.18em] text-sky-600/70">Members</p>
                      <p className="mt-2 text-lg font-black text-slate-900">
                        {team.memberCount}/{team.maxMembers}명
                      </p>
                    </div>
                    <div className="rounded-2xl border border-violet-100 bg-violet-50/70 p-4">
                      <p className="text-[11px] font-black uppercase tracking-[0.18em] text-violet-600/70">Roles Needed</p>
                      <p className="mt-2 break-words text-sm font-semibold leading-6 text-slate-700">
                        {team.lookingFor.join(', ') || '모집 역할 정보 없음'}
                      </p>
                    </div>
                  </div>

                  {team.members.length > 0 ? (
                    <div className="mt-5">
                      <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">Team Members</p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {team.members.map((member) => (
                          <span
                            key={`${team.teamCode}-${member.userId}`}
                            className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700"
                          >
                            {member.userName} · {member.role === 'LEADER' ? '리더' : '팀원'}
                          </span>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  <div className="mt-5 rounded-2xl border border-slate-100 bg-white px-4 py-4">
                    <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">Contact</p>
                    <div className="mt-2 flex items-start gap-2">
                      <ExternalLink className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                      <p className="break-all text-sm leading-6 text-slate-600">
                        {team.contact.url || '연락처 정보 없음'}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex w-full flex-col gap-3 xl:w-44">
                  {isLeader && (
                    <Button
                      onClick={() => navigate(`/team/${team.teamCode}/manage`)}
                      className="rounded-2xl bg-slate-900 font-bold text-white hover:bg-slate-800"
                    >
                      관리
                    </Button>
                  )}

                  {invite && (
                    <div className="rounded-2xl border border-slate-200 bg-white p-4">
                      <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">팀 초대</p>
                      {invite.status === 'PENDING' ? (
                        <div className="mt-3 flex gap-2">
                          <Button
                            onClick={() => handleRespond(invite.id, 'ACCEPTED')}
                            disabled={respondMutation.isPending}
                            className="flex-1 rounded-xl bg-emerald-500 text-white hover:bg-emerald-600"
                          >
                            수락
                          </Button>
                          <Button
                            onClick={() => handleRespond(invite.id, 'REJECTED')}
                            disabled={respondMutation.isPending}
                            className="flex-1 rounded-xl bg-rose-500 text-white hover:bg-rose-600"
                          >
                            거절
                          </Button>
                        </div>
                      ) : (
                        <span
                          className={`mt-3 inline-flex rounded-full px-3 py-1.5 text-xs font-bold ${
                            invite.status === 'ACCEPTED'
                              ? 'bg-emerald-50 text-emerald-700'
                              : 'bg-rose-50 text-rose-600'
                          }`}
                        >
                          {invite.status === 'ACCEPTED' ? '초대 수락됨' : '초대 거절됨'}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </article>
          )
        })}
        </div>
      )}

      {/* 팀 생성 안내 모달 */}
      {noticeOpen ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="team-create-notice-title"
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.5)',
            display: 'grid',
            placeItems: 'center',
            padding: 16,
            zIndex: 1000,
            backdropFilter: 'blur(6px)'
          }}
        >
          <div className="w-full max-w-2xl rounded-3xl border border-blue-100/80 bg-gradient-to-b from-white via-sky-50/50 to-white p-6 shadow-2xl sm:p-8">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-[#3B82F6] to-[#0EA5E9] text-white shadow-lg">
              <Info className="h-7 w-7" />
            </div>
            <h3 id="team-create-notice-title" className="text-center text-2xl font-extrabold tracking-tight text-slate-900">
              팀 생성 전 확인사항
            </h3>
            <p className="mx-auto mt-2 max-w-xl text-center text-sm font-medium text-slate-600 sm:text-base">
              원활한 협업을 위해 아래 항목을 먼저 확인해주세요.
            </p>

            <div className="mt-6 space-y-3">
              <div className="rounded-2xl border border-sky-100 bg-white/90 p-4 shadow-sm">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-sky-500" />
                  <p className="text-sm font-semibold text-slate-700">한 해커톤 내 운영 정책 및 제출 가이드를 준수해야 합니다.</p>
                </div>
              </div>
              <div className="rounded-2xl border border-sky-100 bg-white/90 p-4 shadow-sm">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-sky-500" />
                  <p className="text-sm font-semibold text-slate-700">팀 내 역할과 일정은 사전에 합의하고, 변경 시 즉시 공유해주세요.</p>
                </div>
              </div>
              <div className="rounded-2xl border border-amber-100 bg-amber-50/70 p-4 shadow-sm">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
                  <p className="text-sm font-semibold text-slate-700">운영 정책 위반 시 팀 활동 또는 해커톤 참여가 제한될 수 있습니다.</p>
                </div>
              </div>
            </div>

            <label className="mt-5 flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700">
              <input
                type="checkbox"
                checked={noticeConfirmed}
                onChange={(event) => setNoticeConfirmed(event.target.checked)}
                className="h-4 w-4 accent-[#3B82F6]"
              />
              안내사항을 모두 확인했습니다.
            </label>

            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              <Button
                type="button"
                onClick={handleCloseNotice}
                variant="outline"
                className="min-w-32 rounded-xl border-slate-200 bg-white font-semibold text-slate-700 hover:bg-slate-50"
              >
                취소
              </Button>
              <Button
                type="button"
                onClick={handleConfirmNotice}
                disabled={!noticeConfirmed}
                className="min-w-40 rounded-xl bg-gradient-to-r from-[#3B82F6] to-[#0EA5E9] font-semibold text-white shadow-md hover:opacity-95"
              >
                확인하고 생성하기
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {/* 내 팀으로 신청하기 모달 */}
      {applyModalOpen ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="team-apply-modal-title"
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.5)',
            display: 'grid',
            placeItems: 'center',
            padding: 16,
            zIndex: 1000,
            backdropFilter: 'blur(6px)'
          }}
        >
          <div className="w-full max-w-2xl rounded-3xl border border-blue-100/80 bg-gradient-to-b from-white via-sky-50/50 to-white p-6 shadow-2xl sm:p-8">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-[#3B82F6] to-[#0EA5E9] text-white shadow-lg">
              <Users className="h-7 w-7" />
            </div>
            <h3 id="team-apply-modal-title" className="text-center text-2xl font-extrabold tracking-tight text-slate-900">
              참여할 팀 선택
            </h3>
            <p className="mx-auto mt-2 max-w-xl text-center text-sm font-medium text-slate-600 sm:text-base">
              이 해커톤에 참여 신청할 내 팀을 선택해주세요.
            </p>

            <div className="mt-6 max-h-[300px] space-y-3 overflow-y-auto pr-1">
              {myAvailableTeams?.map((team) => (
                <div
                  key={team.teamCode}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-sky-100 bg-white/90 p-4 shadow-sm"
                >
                  <div>
                    <div className="text-base font-bold text-slate-900">{team.name}</div>
                    <div className="text-xs font-medium text-slate-500">
                      {team.hackathonSlug ? `현재 참여: ${team.hackathonSlug}` : '해커톤 미지정'}
                    </div>
                  </div>
                  <Button
                    type="button"
                    onClick={() => handleApplyWithTeam(team.teamCode)}
                    disabled={updateMutation.isPending}
                    className="rounded-xl bg-gradient-to-r from-[#3B82F6] to-[#0EA5E9] font-semibold text-white shadow-md hover:opacity-95"
                  >
                    {updateMutation.isPending ? '신청 중...' : '이 팀으로 신청'}
                  </Button>
                </div>
              ))}
            </div>

            <div className="mt-6 flex justify-center">
              <Button
                type="button"
                onClick={() => setApplyModalOpen(false)}
                variant="outline"
                className="min-w-40 rounded-xl border-slate-200 bg-white font-semibold text-slate-700 hover:bg-slate-50"
              >
                닫기
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  )
}
