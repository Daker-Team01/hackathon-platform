import { useEffect, useState } from 'react';
import { useUser } from '../../contexts/UserContext';
import { useUserInvites, useRespondToInvite, useClearResolvedInvitesForUser } from '../../hooks/useTeams';
import { useDmRequests } from '../../contexts/DmRequestContext';
import { useChat } from '../../contexts/ChatContext';

export default function NotificationPanel() {
  const { user } = useUser();
  const { data: invites, isLoading } = useUserInvites(user?.id || '');
  const respondMutation = useRespondToInvite();
  const clearResolvedMutation = useClearResolvedInvitesForUser();
  const { getPendingForUser, respondToRequest } = useDmRequests();
  const { openDirectRoom } = useChat();

  // DM 요청 목록 (현재 유저가 받은 것)
  const [dmAccepting, setDmAccepting] = useState<string | null>(null);
  const dmRequests = user ? getPendingForUser(user.userId) : [];

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

  if (pendingInvites.length === 0 && dmRequests.length === 0) return null;

  const handleRespond = (inviteId: string, status: 'ACCEPTED' | 'REJECTED') => {
    if (window.confirm(`초대를 ${status === 'ACCEPTED' ? '수락' : '거절'}하시겠습니까?`)) {
      respondMutation.mutate({ inviteId, status });
    }
  };

  const handleDmRespond = async (requestId: string, status: 'ACCEPTED' | 'REJECTED') => {
    if (!user) return;
    if (status === 'REJECTED') {
      respondToRequest(requestId, user.userId, 'REJECTED');
      return;
    }
    const req = dmRequests.find((r) => r.id === requestId);
    if (!req) return;
    setDmAccepting(requestId);
    try {
      await openDirectRoom(req.fromUserId, req.fromNickname, user.userId, user.nickname);
      respondToRequest(requestId, user.userId, 'ACCEPTED');
    } finally {
      setDmAccepting(null);
    }
  };

  return (
    <div style={{ marginTop: 24, borderTop: '1px solid #eee', paddingTop: 20 }}>
      <h3 style={{ margin: '0 0 12px 0', fontSize: 16, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
        🔔 알림
        {(pendingInvites.length + dmRequests.length) > 0 && (
          <span style={{ backgroundColor: '#ef4444', color: 'white', fontSize: 10, padding: '2px 6px', borderRadius: 10 }}>
            {pendingInvites.length + dmRequests.length}
          </span>
        )}
      </h3>

      <div style={{ display: 'grid', gap: 10 }}>
        {/* 팀 초대 알림 */}
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

        {/* 채팅 신청 알림 */}
        {dmRequests.map((req) => (
          <div key={req.id} style={{ backgroundColor: '#fdf4ff', padding: 12, borderRadius: 8, border: '1px solid #e9d5ff' }}>
            <p style={{ margin: '0 0 4px 0', fontSize: 13, color: '#7c3aed', fontWeight: 600 }}>💬 채팅 신청</p>
            <p style={{ margin: '0 0 10px 0', fontSize: 14 }}>
              <strong>{req.fromNickname}</strong>님이 1:1 채팅을 신청했습니다.
            </p>
            <div style={{ display: 'flex', gap: 6 }}>
              <button
                onClick={() => handleDmRespond(req.id, 'ACCEPTED')}
                disabled={dmAccepting === req.id}
                style={{
                  flex: 1,
                  backgroundColor: dmAccepting === req.id ? '#a78bfa' : '#7c3aed',
                  color: 'white',
                  border: 'none',
                  padding: '6px',
                  borderRadius: 4,
                  fontSize: 13,
                  cursor: dmAccepting === req.id ? 'default' : 'pointer'
                }}
              >
                {dmAccepting === req.id ? '생성 중…' : '수락'}
              </button>
              <button
                onClick={() => handleDmRespond(req.id, 'REJECTED')}
                disabled={dmAccepting === req.id}
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
