import { useParams, useNavigate } from 'react-router-dom';
import { useTeam, useKickMember, useInviteUser, useTeamInvites } from '../hooks/useTeams';
import { useUser, allUsers } from '../contexts/UserContext';
import { useState } from 'react';

export default function TeamManagement() {
  const { teamCode } = useParams<{ teamCode: string }>();
  const navigate = useNavigate();
  const { user } = useUser();
  const { data: team, isLoading } = useTeam(teamCode || '');
  const { data: invites } = useTeamInvites(teamCode || '');
  const kickMutation = useKickMember();
  const inviteMutation = useInviteUser();

  const [inviteUserName, setInviteUserName] = useState('');

  if (isLoading) return <div style={{ padding: 20 }}>Loading...</div>;
  if (!team) return <div style={{ padding: 20 }}>Team not found.</div>;

  const isLeader = team.authorId === user?.id;

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

    if (team.members?.some(m => m.userId === targetUser.id)) {
      alert('이미 팀에 소속된 유저입니다.');
      return;
    }
    
    inviteMutation.mutate({
      teamId: team.teamCode,
      teamName: team.name,
      invitedUserId: targetUser.id,
      invitedUserName: targetUser.nickname,
    }, {
      onSuccess: () => {
        alert(`${targetUser.nickname}님에게 초대를 보냈습니다.`);
        setInviteUserName('');
      }
    });
  };

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: 20 }}>
      <button onClick={() => navigate(-1)} style={{ marginBottom: 20 }}>&larr; 뒤로가기</button>
      
      <h1>팀 관리: {team.name}</h1>
      <p>{team.intro}</p>

      <section style={{ marginTop: 30 }}>
        <h2>팀원 목록 ({team.memberCount}명)</h2>
        <div style={{ display: 'grid', gap: 10 }}>
          {team.members?.map((member) => (
            <div key={member.userId} style={{ border: '1px solid #ddd', padding: 12, borderRadius: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <strong>{member.userName}</strong> ({member.userId})
                <span style={{ marginLeft: 10, fontSize: '0.8rem', color: '#666' }}>
                  {member.role === 'LEADER' ? '👑 팀장' : '멤버'} | 합류일: {new Date(member.joinedAt).toLocaleDateString()}
                </span>
              </div>
              {isLeader && member.role !== 'LEADER' && (
                <button 
                  onClick={() => handleKick(member.userId)}
                  style={{ backgroundColor: '#ef4444', color: 'white', border: 'none', padding: '4px 8px', borderRadius: 4, cursor: 'pointer' }}
                >
                  내보내기
                </button>
              )}
            </div>
          ))}
        </div>
      </section>

      {isLeader && (
        <section style={{ marginTop: 40, padding: 20, backgroundColor: '#f9f9f9', borderRadius: 8 }}>
          <h2>새 팀원 초대</h2>
          <form onSubmit={handleInvite} style={{ display: 'flex', gap: 10 }}>
            <input 
              type="text" 
              placeholder="초대할 유저의 닉네임 입력" 
              value={inviteUserName}
              onChange={(e) => setInviteUserName(e.target.value)}
              style={{ padding: 8, flex: 1 }}
            />
            <button type="submit" style={{ padding: '8px 16px' }}>초대 보내기</button>
          </form>

          <div style={{ marginTop: 20 }}>
            <h3>보낸 초대 현황</h3>
            {invites && invites.length > 0 ? (
              <ul style={{ listStyle: 'none', padding: 0 }}>
                {[...invites].reverse().map((inv) => (
                  <li key={inv.id} style={{ padding: '8px 0', borderBottom: '1px solid #eee' }}>
                    {inv.invitedUserName} ({inv.invitedUserId}) - 
                    <span style={{ 
                      marginLeft: 8, 
                      fontWeight: 'bold',
                      color: inv.status === 'PENDING' ? '#f59e0b' : inv.status === 'ACCEPTED' ? '#10b981' : '#ef4444' 
                    }}>
                      {inv.status}
                    </span>
                    <span style={{ marginLeft: 10, fontSize: '0.75rem', color: '#999' }}>
                      {new Date(inv.createdAt).toLocaleString()}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p style={{ color: '#666', fontSize: '0.9rem' }}>보낸 초대가 없습니다.</p>
            )}
          </div>
        </section>
      )}

      <section style={{ marginTop: 40 }}>
        <h2>참가한 해커톤</h2>
        {team.hackathonSlug ? (
          <div style={{ border: '1px solid #10b981', padding: 15, borderRadius: 8, backgroundColor: '#ecfdf5' }}>
            <h3 style={{ margin: 0 }}>{team.hackathonSlug}</h3>
            <p style={{ marginBottom: 0 }}>현재 이 해커톤에 참여 중입니다.</p>
          </div>
        ) : (
          <p>현재 참여 중인 해커톤이 없습니다.</p>
        )}
      </section>
    </div>
  );
}
