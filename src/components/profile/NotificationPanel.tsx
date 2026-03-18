import { useUser } from '../../contexts/UserContext';
import { useUserInvites, useRespondToInvite } from '../../hooks/useTeams';

export default function NotificationPanel() {
  const { user } = useUser();
  const { data: invites, isLoading } = useUserInvites(user?.id || '');
  const respondMutation = useRespondToInvite();

  if (!user || isLoading) return null;

  // 보낸 초대 중 처리되지 않은(PENDING) 것과 최근 처리된 것들을 표시
  const pendingInvites = invites?.filter(inv => inv.status === 'PENDING') || [];
  const processedInvites = invites?.filter(inv => inv.status !== 'PENDING').slice(-2) || []; // 최근 처리된 2개만 표시

  if (pendingInvites.length === 0 && processedInvites.length === 0) return null;

  const handleRespond = (inviteId: string, status: 'ACCEPTED' | 'REJECTED') => {
    if (window.confirm(`초대를 ${status === 'ACCEPTED' ? '수락' : '거절'}하시겠습니까?`)) {
      respondMutation.mutate({ inviteId, status });
    }
  };

  return (
    <div style={{ marginTop: 24, borderTop: '1px solid #eee', paddingTop: 20 }}>
      <h3 style={{ margin: '0 0 12px 0', fontSize: 16, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
        🔔 알림
        {pendingInvites.length > 0 && (
          <span style={{ backgroundColor: '#ef4444', color: 'white', fontSize: 10, padding: '2px 6px', borderRadius: 10 }}>
            {pendingInvites.length}
          </span>
        )}
      </h3>
      
      <div style={{ display: 'grid', gap: 10 }}>
        {/* 대기 중인 초대 */}
        {pendingInvites.map((inv) => (
          <div key={inv.id} style={{ backgroundColor: '#f0f9ff', padding: 12, borderRadius: 8, border: '1px solid #bae6fd' }}>
            <p style={{ margin: '0 0 8px 0', fontSize: 14 }}>
              <strong>{inv.teamName}</strong> 팀에서 초대했습니다!
            </p>
            <div style={{ display: 'flex', gap: 6 }}>
              <button 
                onClick={() => handleRespond(inv.id, 'ACCEPTED')}
                disabled={respondMutation.isPending}
                style={{ flex: 1, backgroundColor: '#10b981', color: 'white', border: 'none', padding: '6px', borderRadius: 4, fontSize: 13, cursor: 'pointer' }}
              >
                수락
              </button>
              <button 
                onClick={() => handleRespond(inv.id, 'REJECTED')}
                disabled={respondMutation.isPending}
                style={{ flex: 1, backgroundColor: '#ef4444', color: 'white', border: 'none', padding: '6px', borderRadius: 4, fontSize: 13, cursor: 'pointer' }}
              >
                거절
              </button>
            </div>
          </div>
        ))}

        {/* 최근 처리된 초대 (읽기 전용) */}
        {processedInvites.map((inv) => (
          <div key={inv.id} style={{ backgroundColor: '#f9fafb', padding: 10, borderRadius: 8, border: '1px solid #e5e7eb', opacity: 0.8 }}>
            <p style={{ margin: 0, fontSize: 13, color: '#666' }}>
              <strong>{inv.teamName}</strong> 팀 초대: 
              <span style={{ marginLeft: 5, fontWeight: 'bold', color: inv.status === 'ACCEPTED' ? '#059669' : '#dc2626' }}>
                {inv.status === 'ACCEPTED' ? '수락됨' : '거절됨'}
              </span>
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
