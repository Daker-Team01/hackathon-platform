import { useParams, useNavigate } from 'react-router-dom';
import { useTeam, useKickMember, useInviteUser, useTeamInvites } from '../hooks/useTeams';
import { useUser, allUsers } from '../contexts/UserContext';
import { useState } from 'react';
import { Button } from '../components/ui/button';

export default function TeamManagement() {
  const { teamCode } = useParams<{ teamCode: string }>();
  const navigate = useNavigate();
  const { user } = useUser();
  const { data: team, isLoading } = useTeam(teamCode || '');
  const { data: invites } = useTeamInvites(teamCode || '');
  const kickMutation = useKickMember();
  const inviteMutation = useInviteUser();

  const [inviteUserName, setInviteUserName] = useState('');

  if (isLoading) return <div className="p-8">Loading...</div>;
  if (!team) return <div className="p-8 text-center text-muted-foreground">Team not found.</div>;

  const isLeader = team.leaderId === user?.id;

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
                {[...invites].reverse().map((inv) => (
                  <li key={inv.id} className="p-3 flex justify-between items-center bg-background">
                    <div>
                      <span className="font-medium">{inv.invitedUserName}</span>
                      <span className="text-xs text-muted-foreground ml-2">({inv.invitedUserId})</span>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className={`text-xs font-bold px-2 py-1 rounded-full ${
                        inv.status === 'PENDING' ? 'bg-amber-100 text-amber-700' : 
                        inv.status === 'ACCEPTED' ? 'bg-emerald-100 text-emerald-700' : 
                        'bg-red-100 text-red-700'
                      }`}>
                        {inv.status}
                      </span>
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
