import { useParams, useNavigate } from 'react-router-dom';
import {
  useTeam,
  useKickMember,
  useInviteUser,
  useSendTeamNotice,
  useTeamInvites,
  useCancelInvite,
  useRespondToTeamRequest,
  useTeamRequestsByTeam,
  useUpdateMemberRole
} from '../hooks/useTeams';
import { useUser, allUsers } from '../contexts/UserContext';
import { useEffect, useState } from 'react';
import { useLog } from '../contexts/LogContext';
import { Button } from '../components/ui/button';

const DEFAULT_ROLE_OPTIONS = [
  '기획',
  'PM',
  '프론트엔드',
  '백엔드',
  '디자이너',
  'AI/ML',
  '데이터 분석',
  'DevOps',
  '모바일',
  '풀스택',
  'QA'
];

const getAllRoleOptions = (): string[] => {
  const existingRoles = allUsers.flatMap(u => 
    Array.isArray(u.preferredRoles) ? u.preferredRoles : []
  );
  const allOptions = new Set([...DEFAULT_ROLE_OPTIONS, ...existingRoles]);
  return Array.from(allOptions).sort();
};

const filterRoles = (options: string[], query: string, selected: string[]): string[] => {
  const trimmedQuery = query.trim().toLowerCase();
  const selectedSet = new Set(selected.map(item => item.toLowerCase()));
  
  return options.filter(option => {
    if (selectedSet.has(option.toLowerCase())) return false;
    if (!trimmedQuery) return true;
    return option.toLowerCase().includes(trimmedQuery);
  }).slice(0, 8);
};

export default function TeamManagement() {
  const { teamCode } = useParams<{ teamCode: string }>();
  const navigate = useNavigate();
  const { user } = useUser();
  const { recordEvent } = useLog();
  const { data: team, isLoading } = useTeam(teamCode || '');
  const { data: invites } = useTeamInvites(teamCode || '');
  const { data: teamRequests } = useTeamRequestsByTeam(teamCode || '');
  const kickMutation = useKickMember();
  const inviteMutation = useInviteUser();
  const cancelInviteMutation = useCancelInvite();
  const respondToTeamRequestMutation = useRespondToTeamRequest();
  const noticeMutation = useSendTeamNotice();
  const updateRoleMutation = useUpdateMemberRole();

  const [inviteUserName, setInviteUserName] = useState('');
  const [teamNotice, setTeamNotice] = useState('');
  const [editingMemberId, setEditingMemberId] = useState<string | null>(null);
  const [editingRole, setEditingRole] = useState('');
  const [roleQuery, setRoleQuery] = useState('');

  useEffect(() => {
    if (!teamCode) return
    recordEvent('page_view', 'page', `/team/${teamCode}/manage`, {
      page: 'team_management',
      teamCode
    })
  }, [recordEvent, teamCode])

  if (isLoading) return <div className="p-8">Loading...</div>;
  if (!team) return <div className="p-8 text-center text-muted-foreground">Team not found.</div>;

  const isLeader = team.leaderId === user?.userId;

  const handleKick = (userId: string) => {
    if (window.confirm('정말 이 팀원을 내보내시겠습니까?')) {
      kickMutation.mutate(
        { teamCode: team.teamCode, userId },
        {
          onSuccess: () => {
            recordEvent('team_member_kick', 'team', team.teamCode, {
              userId
            })
          },
          onError: (error) => {
            recordEvent('api_error', 'team', team.teamCode, {
              api: 'kickMember',
              action: 'team_member_kick',
              userId,
              message: error instanceof Error ? error.message : 'unknown_error'
            })
          }
        }
      );
    }
  };

  const handleUpdateRole = (userId: string, newRole: string) => {
    if (!user?.userId) return;
    if (!newRole.trim()) {
      alert('역할을 입력해주세요.');
      return;
    }

    updateRoleMutation.mutate(
      {
        teamCode: team.teamCode,
        userId,
        newRole: newRole.trim(),
        updatedByUserId: user.userId
      },
      {
        onSuccess: () => {
          recordEvent('team_member_role_update', 'team', team.teamCode, {
            userId,
            newRole: newRole.trim()
          })
          setEditingMemberId(null);
          setEditingRole('');
          setRoleQuery('');
          alert('역할을 변경했습니다.');
        },
        onError: (error) => {
          recordEvent('api_error', 'team', team.teamCode, {
            api: 'updateMemberRole',
            action: 'team_member_role_update',
            userId,
            message: error instanceof Error ? error.message : 'unknown_error'
          })
          alert(error instanceof Error ? error.message : '역할 변경에 실패했습니다.');
        }
      }
    );
  };

  const handleInvite = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteUserName) {
      alert('초대할 유저의 이름을 입력해주세요.');
      return;
    }

    const targetUser = allUsers.find(u => u.nickname === inviteUserName);
    if (!targetUser) {
      alert('존재하지 않는 유저입니다.');
      return;
    }

    if (team.members?.some(m => m.userId === targetUser.userId)) {
      alert('이미 팀에 소속된 유저입니다.');
      return;
    }
    
    inviteMutation.mutate({
      teamId: team.teamCode,
      teamName: team.name,
      invitedUserId: targetUser.userId,
      invitedUserName: targetUser.nickname,
    }, {
      onSuccess: () => {
        recordEvent('invite_send', 'team', team.teamCode, {
          invitedUserId: targetUser.userId,
          invitedUserName: targetUser.nickname
        })
        alert(`${targetUser.nickname}님에게 초대를 보냈습니다.`);
        setInviteUserName('');
      },
      onError: (error) => {
        recordEvent('api_error', 'team', team.teamCode, {
          api: 'inviteUser',
          action: 'invite_send',
          invitedUserId: targetUser.userId,
          message: error instanceof Error ? error.message : 'unknown_error'
        })
      }
    });
  };

  const handleSendNotice = (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.userId) return;
    const trimmedNotice = teamNotice.trim();
    if (!trimmedNotice) {
      alert('공지 내용을 입력해주세요.');
      return;
    }

    const preview = `[${team.name}] : ${trimmedNotice}`;
    const shouldSend = window.confirm(`아래 내용으로 팀 공지를 전송할까요?\n\n${preview}`);
    if (!shouldSend) return;

    noticeMutation.mutate(
      {
        teamCode: team.teamCode,
        senderId: user.userId,
        content: trimmedNotice,
      },
      {
        onSuccess: () => {
          recordEvent('team_notice_send', 'team', team.teamCode, {
            messageLength: trimmedNotice.length
          })
          alert('팀 공지를 보냈습니다.');
          setTeamNotice('');
        },
        onError: (error) => {
          recordEvent('api_error', 'team', team.teamCode, {
            api: 'sendTeamNotice',
            action: 'team_notice_send',
            message: error instanceof Error ? error.message : 'unknown_error'
          })
          alert(error instanceof Error ? error.message : '팀 공지 전송에 실패했습니다.');
        }
      }
    )
  }

  const handleCancelInvite = (inviteId: string) => {
    if (!window.confirm('대기중인 초대를 취소하시겠습니까?')) return

    cancelInviteMutation.mutate(inviteId, {
      onSuccess: () => {
        recordEvent('invite_cancel', 'team', team.teamCode, {
          inviteId
        })
        alert('초대를 취소했습니다.')
      },
      onError: (error) => {
        recordEvent('api_error', 'team', team.teamCode, {
          api: 'cancelInvite',
          action: 'invite_cancel',
          inviteId,
          message: error instanceof Error ? error.message : 'unknown_error'
        })
        alert(error instanceof Error ? error.message : '초대 취소에 실패했습니다.')
      }
    })
  }

  const handleRespondTeamRequest = (requestId: string, status: 'APPROVED' | 'REJECTED') => {
    if (!user?.userId) return
    const targetRequest = teamRequests?.find((request) => request.id === requestId)

    respondToTeamRequestMutation.mutate(
      {
        requestId,
        reviewerUserId: user.userId,
        status
      },
      {
        onSuccess: () => {
          recordEvent('team_request_review', 'team', team.teamCode, {
            requestId,
            requestType: targetRequest?.requestType ?? null,
            requesterUserId: targetRequest?.requesterUserId ?? null,
            status
          })
          recordEvent('team_request_result', 'team', team.teamCode, {
            requestId,
            requestType: targetRequest?.requestType ?? null,
            requesterUserId: targetRequest?.requesterUserId ?? null,
            status
          })
          alert(`요청을 ${status === 'APPROVED' ? '승인' : '거절'}했습니다.`)
        },
        onError: (error) => {
          recordEvent('api_error', 'team', team.teamCode, {
            api: 'respondToTeamRequest',
            action: 'team_request_review',
            requestId,
            status,
            message: error instanceof Error ? error.message : 'unknown_error'
          })
          alert(error instanceof Error ? error.message : '요청 처리에 실패했습니다.')
        }
      }
    )
  }

  const inputClasses = "flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-base transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm"

  return (
    <div className="max-w-3xl mx-auto p-8 space-y-8">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
          &larr; 뒤로가기
        </Button>
      </div>
      
      <div className="space-y-2">
        <h1 className="text-3xl font-bold">팀 관리: {team.name}</h1>
        <p className="text-muted-foreground">{team.intro}</p>
      </div>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold">팀원 목록 ({team.memberCount}명)</h2>
        <div className="grid gap-3">
          {team.members?.map((member) => {
            const isEditing = editingMemberId === member.userId;
            const allRoleOptions = getAllRoleOptions();
            const filteredRoles = filterRoles(allRoleOptions, roleQuery, []);
            const defaultRoleButtonsToShow = DEFAULT_ROLE_OPTIONS.slice(0, 8);

            return (
              <div key={member.userId} className="border p-4 rounded-lg bg-background">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold">{member.userName}</span>
                      <span className="text-xs text-muted-foreground">({member.userId})</span>
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      합류일: {new Date(member.joinedAt).toLocaleDateString()}
                    </div>
                  </div>
                  {isLeader && !isEditing && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setEditingMemberId(member.userId);
                        setEditingRole(member.role ?? '');
                        setRoleQuery('');
                      }}
                    >
                      역할 변경
                    </Button>
                  )}
                </div>

                {isEditing ? (
                  <div className="space-y-3 pt-3 border-t">
                    <div>
                      <label className="text-xs font-semibold text-gray-600 block mb-2">현재 역할</label>
                      <div className="flex gap-2 flex-wrap mb-3">
                        <button
                          onClick={() => {
                            setEditingRole('');
                            setRoleQuery('');
                          }}
                          style={{
                            padding: '6px 10px',
                            border: '2px solid #0891b2',
                            backgroundColor: '#cffafe',
                            color: '#155e75',
                            borderRadius: 999,
                            fontSize: 12,
                            fontWeight: 600,
                            cursor: 'pointer'
                          }}
                        >
                          {editingRole || member.role || '미지정'}
                        </button>
                      </div>
                    </div>

                    <div>
                      <input
                        type="text"
                        value={roleQuery}
                        onChange={(e) => setRoleQuery(e.target.value)}
                        placeholder="역할 검색"
                        style={{
                          width: '100%',
                          padding: '8px 10px',
                          fontSize: 12,
                          border: '1px solid #d1d5db',
                          borderRadius: 8,
                          backgroundColor: '#ffffff'
                        }}
                      />
                    </div>

                    {roleQuery.trim().length > 0 ? (
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {filteredRoles.length > 0 ? (
                          filteredRoles.map((role) => (
                            <button
                              key={`searched-role-${role}`}
                              onClick={() => {
                                setEditingRole(role);
                                setRoleQuery('');
                              }}
                              style={{
                                padding: '6px 10px',
                                border: '1px solid #d1d5db',
                                backgroundColor: '#ffffff',
                                color: '#475569',
                                borderRadius: 999,
                                fontSize: 12,
                                fontWeight: 600,
                                cursor: 'pointer'
                              }}
                            >
                              {role}
                            </button>
                          ))
                        ) : (
                          <span style={{ fontSize: 12, color: '#94a3b8' }}>검색 결과가 없습니다.</span>
                        )}
                      </div>
                    ) : null}

                    <div>
                      <label className="text-xs font-semibold text-gray-600 block mb-2">추천 역할</label>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {defaultRoleButtonsToShow.map((role) => (
                          <button
                            key={role}
                            onClick={() => {
                              setEditingRole(role);
                              setRoleQuery('');
                            }}
                            style={{
                              padding: '6px 10px',
                              border: editingRole === role ? '2px solid #0891b2' : '1px solid #d1d5db',
                              backgroundColor: editingRole === role ? '#cffafe' : '#ffffff',
                              color: editingRole === role ? '#155e75' : '#475569',
                              borderRadius: 999,
                              fontSize: 12,
                              fontWeight: 600,
                              cursor: 'pointer'
                            }}
                          >
                            {role}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="flex gap-2 pt-2">
                      <Button
                        size="sm"
                        onClick={() => handleUpdateRole(member.userId, editingRole)}
                        disabled={updateRoleMutation.isPending || !editingRole?.trim()}
                      >
                        {updateRoleMutation.isPending ? '저장 중...' : '저장'}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setEditingMemberId(null);
                          setEditingRole('');
                          setRoleQuery('');
                        }}
                      >
                        취소
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between pt-2">
                    <div>
                      <span className="text-sm font-medium">역할: {member.role || '미지정'}</span>
                    </div>
                    {isLeader && member.userId !== team.leaderId && (
                      <Button 
                        variant="destructive"
                        size="sm"
                        onClick={() => handleKick(member.userId)}
                      >
                        내보내기
                      </Button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {isLeader && (
        <section className="p-6 border rounded-xl bg-background space-y-6">
          <div className="space-y-3">
            <h2 className="text-xl font-semibold">팀 공지 보내기</h2>
            <form onSubmit={handleSendNotice} className="space-y-3">
              <textarea
                placeholder="팀원 전체의 공지 채팅방으로 보낼 메세지를 입력하세요"
                value={teamNotice}
                onChange={(e) => setTeamNotice(e.target.value)}
                className="flex min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              />
              <div className="flex justify-end">
                <Button type="submit" disabled={noticeMutation.isPending}>
                  {noticeMutation.isPending ? '전송 중...' : '공지 보내기'}
                </Button>
              </div>
            </form>
          </div>

          <h2 className="text-xl font-semibold">새 팀원 초대</h2>
          <form onSubmit={handleInvite} className="flex gap-2">
            <input 
              type="text" 
              placeholder="초대할 유저의 닉네임 입력" 
              value={inviteUserName}
              onChange={(e) => setInviteUserName(e.target.value)}
              className={inputClasses}
            />
            <Button type="submit">초대 보내기</Button>
          </form>

          <div className="space-y-3 pt-4 border-t">
            <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">보낸 초대 현황</h3>
            {invites && invites.length > 0 ? (
              <ul className="divide-y border rounded-md">
                {invites.map((inv) => (
                  <li key={inv.id} className="p-3 flex justify-between items-center bg-background">
                    <div>
                      <span className="font-medium">{inv.invitedUserName}</span>
                      <span className="text-xs text-muted-foreground ml-2">({inv.invitedUserId})</span>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className={`text-xs font-bold px-2 py-1 rounded-full ${
                        inv.status === 'PENDING' ? 'bg-amber-100 text-amber-700' : 
                        inv.status === 'ACCEPTED' ? 'bg-emerald-100 text-emerald-700' : 
                        inv.status === 'REJECTED' ? 'bg-red-100 text-red-700' :
                        'bg-slate-100 text-slate-700'
                      }`}>
                        {inv.status}
                      </span>
                      {inv.status === 'PENDING' && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => handleCancelInvite(inv.id)}
                          disabled={cancelInviteMutation.isPending}
                        >
                          취소
                        </Button>
                      )}
                      <span className="text-[10px] text-muted-foreground">
                        {new Date(inv.createdAt).toLocaleString()}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">보낸 초대가 없습니다.</p>
            )}
          </div>

          <div className="space-y-3 pt-4 border-t">
            <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">가입/탈퇴 요청</h3>
            {teamRequests && teamRequests.length > 0 ? (
              <ul className="divide-y border rounded-md">
                {teamRequests.map((request) => (
                  <li key={request.id} className="p-3 flex flex-col gap-2 bg-background sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="font-medium">
                        {request.requesterUserName}
                        <span className="text-xs text-muted-foreground ml-2">({request.requesterUserId})</span>
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {request.requestType === 'JOIN' ? '가입 요청' : '탈퇴 요청'} · {new Date(request.createdAt).toLocaleString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-bold px-2 py-1 rounded-full ${
                        request.status === 'PENDING'
                          ? 'bg-amber-100 text-amber-700'
                          : request.status === 'APPROVED'
                          ? 'bg-emerald-100 text-emerald-700'
                          : request.status === 'REJECTED'
                          ? 'bg-red-100 text-red-700'
                          : 'bg-slate-100 text-slate-700'
                      }`}>
                        {request.status}
                      </span>

                      {request.status === 'PENDING' && (
                        <>
                          <Button
                            type="button"
                            size="sm"
                            onClick={() => handleRespondTeamRequest(request.id, 'APPROVED')}
                            disabled={respondToTeamRequestMutation.isPending}
                          >
                            승인
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => handleRespondTeamRequest(request.id, 'REJECTED')}
                            disabled={respondToTeamRequestMutation.isPending}
                          >
                            거절
                          </Button>
                        </>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">들어온 요청이 없습니다.</p>
            )}
          </div>
        </section>
      )}

      <section className="space-y-4">
        <h2 className="text-xl font-semibold">참가한 해커톤</h2>
        {team.hackathonSlug ? (
          <div className="border border-emerald-200 p-4 rounded-lg bg-emerald-50/50">
            <h3 className="font-bold text-emerald-900">{team.hackathonSlug}</h3>
            <p className="text-sm text-emerald-700">현재 이 해커톤에 참여 중입니다.</p>
          </div>
        ) : (
          <div className="border p-4 rounded-lg border-dashed text-center text-muted-foreground">
            현재 참여 중인 해커톤이 없습니다.
          </div>
        )}
      </section>
    </div>
  );
}
