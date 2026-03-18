import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTeams, useUpdateTeam, useUserInvites, useRespondToInvite } from '../hooks/useTeams'
import { useUser } from '../contexts/UserContext'

type TeamsProps = {
  hackathonSlug: string
}

export default function Teams({ hackathonSlug }: TeamsProps) {
  const navigate = useNavigate()
  const { user } = useUser()
  const { data: teams, isLoading } = useTeams(hackathonSlug)
  const { data: allTeams } = useTeams() // 내 팀을 찾기 위해 전체 목록 가져오기
  const { data: userInvites } = useUserInvites(user?.id || '')
  const respondMutation = useRespondToInvite()
  const updateMutation = useUpdateTeam()
  
  const [noticeOpen, setNoticeOpen] = useState(false)
  const [applyModalOpen, setApplyModalOpen] = useState(false)

  // 내가 만든 팀 중 이 해커톤에 참여하지 않은 팀들 필터링
  const myAvailableTeams = (allTeams || []).filter(
    (team) => team.authorId === user?.id && team.hackathonSlug !== hackathonSlug
  )

  function handleOpenCreateNotice() {
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
    if (window.confirm('이 팀으로 해커톤 참여 신청을 하시겠습니까?')) {
      updateMutation.mutate({
        teamCode,
        updates: { hackathonSlug }
      }, {
        onSuccess: () => {
          alert('참여 신청이 완료되었습니다!')
          setApplyModalOpen(false)
        }
      })
    }
  }

  const handleRespond = (inviteId: string, status: 'ACCEPTED' | 'REJECTED') => {
    if (window.confirm(`초대를 ${status === 'ACCEPTED' ? '수락' : '거절'}하시겠습니까? 한번 선택하면 변경할 수 없습니다.`)) {
      respondMutation.mutate({ inviteId, status });
    }
  };

  return (
    <section>
      <h2>Teams</h2>

      <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
        <button type="button" onClick={handleOpenCreateNotice}>
          새 팀 생성하기
        </button>
        {user && myAvailableTeams && myAvailableTeams.length > 0 && (
          <button 
            type="button" 
            onClick={() => setApplyModalOpen(true)}
            style={{ backgroundColor: '#10b981', color: 'white', border: 'none', padding: '8px 16px', borderRadius: '4px', cursor: 'pointer' }}
          >
            내 팀으로 신청하기 ({myAvailableTeams.length})
          </button>
        )}
      </div>

      {isLoading ? (
        <p>팀 목록을 불러오는 중입니다.</p>
      ) : !teams || teams.length === 0 ? (
        <p>등록된 팀이 없습니다.</p>
      ) : (
        teams.map((team) => {
          // 해당 팀에서 온 초대 중 PENDING인 것을 먼저 찾고, 없으면 가장 최근의 것을 찾음
          const teamInvites = userInvites?.filter(inv => inv.teamId === team.teamCode) || [];
          const invite = teamInvites.find(inv => inv.status === 'PENDING') || 
                         (teamInvites.length > 0 ? [...teamInvites].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0] : null);
          
          const isLeader = team.authorId === user?.id;
          
          return (
            <article
              key={team.teamCode}
              style={{ border: '1px solid #ccc', padding: 12, marginBottom: 8, borderRadius: 8 }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                <div>
                  <h3>{team.name}</h3>
                  <p>{team.intro}</p>
                  <p>Members: {team.memberCount}명</p>
                  <p>Status: {team.isOpen ? '모집중' : '모집마감'}</p>
                  <p>Looking For: {team.lookingFor.join(', ') || '-'}</p>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {isLeader && (
                    <button 
                      onClick={() => navigate(`/team/${team.teamCode}/manage`)}
                      style={{ backgroundColor: '#3b82f6', color: 'white', border: 'none', padding: '8px 12px', borderRadius: 4, cursor: 'pointer' }}
                    >
                      관리
                    </button>
                  )}
                  
                  {invite && (
                    <div style={{ border: '1px solid #eee', padding: 8, borderRadius: 4, backgroundColor: '#f9fafb' }}>
                      <p style={{ margin: '0 0 8px 0', fontSize: '0.85rem', fontWeight: 'bold' }}>팀 초대</p>
                      {invite.status === 'PENDING' ? (
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button 
                            onClick={() => handleRespond(invite.id, 'ACCEPTED')}
                            disabled={respondMutation.isPending}
                            style={{ backgroundColor: '#10b981', color: 'white', border: 'none', padding: '4px 8px', borderRadius: 4, fontSize: '0.8rem', cursor: 'pointer' }}
                          >
                            수락
                          </button>
                          <button 
                            onClick={() => handleRespond(invite.id, 'REJECTED')}
                            disabled={respondMutation.isPending}
                            style={{ backgroundColor: '#ef4444', color: 'white', border: 'none', padding: '4px 8px', borderRadius: 4, fontSize: '0.8rem', cursor: 'pointer' }}
                          >
                            거절
                          </button>
                        </div>
                      ) : (
                        <span style={{ 
                          fontSize: '0.85rem', 
                          fontWeight: 'bold',
                          color: invite.status === 'ACCEPTED' ? '#10b981' : '#ef4444' 
                        }}>
                          {invite.status === 'ACCEPTED' ? '초대 수락됨' : '초대 거절됨'}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
              <p style={{ marginTop: 10, fontSize: '0.9rem', color: '#666' }}>Contact: {team.contact.url}</p>
            </article>
          );
        })
      )}

      {/* 팀 생성 안내 모달 */}
      {noticeOpen ? (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.45)',
            display: 'grid',
            placeItems: 'center',
            padding: 16,
            zIndex: 1000,
          }}
        >
          <div style={{ backgroundColor: '#fff', color: '#111', maxWidth: 560, padding: 16, borderRadius: 8 }}>
            <h3>Team Participation Notice</h3>
            <p>팀 생성/참여 전 아래 규칙을 확인하세요.</p>
            <ul>
              <li>한 해커톤에서 활동 정책을 준수해야 합니다.</li>
              <li>팀원 간 연락과 역할 분담은 팀 내부에서 명확히 합의해야 합니다.</li>
              <li>운영 정책 위반 시 팀 참여가 제한될 수 있습니다.</li>
            </ul>
            <button type="button" onClick={handleConfirmNotice}>
              Confirm
            </button>
            <button type="button" onClick={handleCloseNotice} style={{ marginLeft: 8, backgroundColor: '#eee', color: '#333' }}>
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      {/* 내 팀으로 신청하기 모달 */}
      {applyModalOpen ? (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.45)',
            display: 'grid',
            placeItems: 'center',
            padding: 16,
            zIndex: 1000,
          }}
        >
          <div style={{ backgroundColor: '#fff', color: '#111', width: '100%', maxWidth: 500, padding: 20, borderRadius: 8 }}>
            <h3>참여할 팀 선택</h3>
            <p>이 해커톤에 참여 신청할 팀을 선택해주세요.</p>
            <div style={{ maxHeight: '300px', overflowY: 'auto', margin: '20px 0' }}>
              {myAvailableTeams?.map((team) => (
                <div 
                  key={team.teamCode} 
                  style={{ border: '1px solid #eee', padding: 12, marginBottom: 10, borderRadius: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                >
                  <div>
                    <div style={{ fontWeight: 'bold' }}>{team.name}</div>
                    <div style={{ fontSize: '0.8rem', color: '#666' }}>
                      {team.hackathonSlug ? `현재 참여: ${team.hackathonSlug}` : '해커톤 미지정'}
                    </div>
                  </div>
                  <button 
                    onClick={() => handleApplyWithTeam(team.teamCode)}
                    disabled={updateMutation.isPending}
                    style={{ padding: '6px 12px', fontSize: '0.9rem' }}
                  >
                    신청
                  </button>
                </div>
              ))}
            </div>
            <button 
              type="button" 
              onClick={() => setApplyModalOpen(false)} 
              style={{ width: '100%', backgroundColor: '#eee', color: '#333' }}
            >
              닫기
            </button>
          </div>
        </div>
      ) : null}
    </section>
  )
}
