import { useParams, useNavigate } from 'react-router-dom';
import {
  useTeam,
  useKickMember,
  useInviteUser,
  useSendTeamNotice,
  useTeamInvites,
  useCancelInvite,
  useRespondToTeamRequest,
  useTeamRequestsByTeam
} from '../hooks/useTeams';
import { useUser, allUsers } from '../contexts/UserContext';
import { useState } from 'react';
import { Button } from '../components/ui/button';

export default function TeamManagement() {
  const { teamCode } = useParams<{ teamCode: string }>();
  const navigate = useNavigate();
  const { user } = useUser();
  const { data: team, isLoading } = useTeam(teamCode || '');
  const { data: invites } = useTeamInvites(teamCode || '');
  const { data: teamRequests } = useTeamRequestsByTeam(teamCode || '');
  const kickMutation = useKickMember();
  const inviteMutation = useInviteUser();
  const cancelInviteMutation = useCancelInvite();
  const respondToTeamRequestMutation = useRespondToTeamRequest();
  const noticeMutation = useSendTeamNotice();

  const [inviteUserName, setInviteUserName] = useState('');
  const [teamNotice, setTeamNotice] = useState('');

  if (isLoading) return <div className="p-8">Loading...</div>;
  if (!team) return <div className="p-8 text-center text-muted-foreground">Team not found.</div>;

  const isLeader = team.leaderId === user?.userId;

  const handleKick = (userId: string) => {
    if (window.confirm('정말 이 팀원을 내보내시겠습니까?')) {
      kickMutation.mutate({ teamCode: team.teamCode, userId });
    }
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
        alert(`${targetUser.nickname}님에게 초대를 보냈습니다.`);
        setInviteUserName('');
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
          alert('팀 공지를 보냈습니다.');
          setTeamNotice('');
        },
        onError: (error) => {
          alert(error instanceof Error ? error.message : '팀 공지 전송에 실패했습니다.');
        }
      }
    )
  }

  const handleCancelInvite = (inviteId: string) => {
    if (!window.confirm('대기중인 초대를 취소하시겠습니까?')) return

    cancelInviteMutation.mutate(inviteId, {
      onSuccess: () => alert('초대를 취소했습니다.'),
      onError: (error) => alert(error instanceof Error ? error.message : '초대 취소에 실패했습니다.')
    })
  }

  const handleRespondTeamRequest = (requestId: string, status: 'APPROVED' | 'REJECTED') => {
    if (!user?.userId) return

    respondToTeamRequestMutation.mutate(
      {
        requestId,
        reviewerUserId: user.userId,
        status
      },
      {
        onSuccess: () => alert(`요청을 ${status === 'APPROVED' ? '승인' : '거절'}했습니다.`),
        onError: (error) => alert(error instanceof Error ? error.message : '요청 처리에 실패했습니다.')
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
          {team.members?.map((member) => (
            <div key={member.userId} className="border p-4 rounded-lg flex justify-between items-center bg-background">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold">{member.userName}</span>
                  <span className="text-xs text-muted-foreground">({member.userId})</span>
                </div>
                <div className="text-xs text-muted-foreground">
                  {member.role === 'LEADER' ? '👑 팀장' : '멤버'} | 합류일: {new Date(member.joinedAt).toLocaleDateString()}
                </div>
              </div>
              {isLeader && member.role !== 'LEADER' && (
                <Button 
                  variant="destructive"
                  size="sm"
                  onClick={() => handleKick(member.userId)}
                >
                  내보내기
                </Button>
              )}
            </div>
          ))}
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
