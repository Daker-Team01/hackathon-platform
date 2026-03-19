import { useEffect } from 'react';
import { useUser } from '../../contexts/UserContext';
import { useUserInvites, useRespondToInvite, useClearResolvedInvitesForUser } from '../../hooks/useTeams';

export default function NotificationPanel() {
  const { user } = useUser();
  const { data: invites, isLoading } = useUserInvites(user?.id || '');
  const respondMutation = useRespondToInvite();
  const clearResolvedMutation = useClearResolvedInvitesForUser();

  // 아직 결정하지 않은(PENDING) 알림만 유지
  const pendingInvites = invites?.filter(inv => inv.status === 'PENDING') || [];
  const hasResolvedInvites = invites?.some((inv) => inv.status !== 'PENDING') || false;

  useEffect(() => {
    if (!user?.id || !hasResolvedInvites || clearResolvedMutation.isPending) return;

    if (hasResolvedInvites) {
      clearResolvedMutation.mutate(user.id);
    }
  }, [clearResolvedMutation, hasResolvedInvites, user?.id]);

  if (!user || isLoading) return null;

  if (pendingInvites.length === 0) return null;

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
        {/* 결정 대기 중인 초대 */}
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
      </div>
    </div>
  );
}
