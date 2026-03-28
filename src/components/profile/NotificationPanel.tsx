import { useCallback, useEffect, useMemo, useState } from 'react';
import { useUser } from '../../contexts/UserContext';
import {
  useUserInvites,
  useRespondToInvite,
  usePendingTeamRequestsForLeader,
  useRespondToTeamRequest
} from '../../hooks/useTeams';
import { useDmRequests } from '../../contexts/DmRequestContext';
import { useChat } from '../../contexts/ChatContext';
import { useLog } from '../../contexts/LogContext';
import { loadSeenNotificationIds, saveSeenNotificationIds } from '../../utils/profileNotifications'

type Props = {
  onUnreadCountChange?: (count: number) => void
  seenNotificationIds?: string[]
  onSeenNotificationIdsChange?: (ids: string[]) => void
}

export default function NotificationPanel({ onUnreadCountChange, seenNotificationIds: controlledSeenNotificationIds, onSeenNotificationIdsChange }: Props) {
  const { user } = useUser();
  const { data: invites, isLoading } = useUserInvites(user?.id || '');
  const { data: pendingTeamRequests = [] } = usePendingTeamRequestsForLeader(user?.id || '');
  const respondMutation = useRespondToInvite();
  const respondTeamRequestMutation = useRespondToTeamRequest();
  const { recordEvent } = useLog();
  const { getPendingForUser, respondToRequest } = useDmRequests();
  const { openDirectRoom } = useChat();

  // DM 요청 목록 (현재 유저가 받은 것)
  const [dmAccepting, setDmAccepting] = useState<string | null>(null);
  const [internalSeenNotificationIds, setInternalSeenNotificationIds] = useState<string[]>([])
  const [hiddenInviteIds, setHiddenInviteIds] = useState<string[]>([])
  const [hiddenTeamRequestIds, setHiddenTeamRequestIds] = useState<string[]>([])
  const dmRequests = useMemo(() => (user ? getPendingForUser(user.userId) : []), [getPendingForUser, user]);

  // 아직 결정하지 않은(PENDING) 알림만 유지
  const pendingInvites = (invites || []).filter(
    (inv) => inv.status === 'PENDING' && !hiddenInviteIds.includes(inv.id)
  );
  const visiblePendingTeamRequests = pendingTeamRequests.filter(
    (request) => !hiddenTeamRequestIds.includes(request.id)
  )
  const notificationIds = useMemo(
    () => [
      ...pendingInvites.map((invite) => `invite:${invite.id}`),
      ...visiblePendingTeamRequests.map((request) => `teamRequest:${request.id}`),
      ...dmRequests.map((request) => `dm:${request.id}`)
    ],
    [dmRequests, pendingInvites, visiblePendingTeamRequests]
  )
  const unreadNotificationIds = useMemo(
    () => notificationIds.filter((id) => !(controlledSeenNotificationIds ?? internalSeenNotificationIds).includes(id)),
    [controlledSeenNotificationIds, internalSeenNotificationIds, notificationIds]
  )
  const unreadCount = unreadNotificationIds.length

  const activeSeenNotificationIds = controlledSeenNotificationIds ?? internalSeenNotificationIds

  const updateSeenIds = useCallback((ids: string[]) => {
    if (!user?.userId) return

    if (controlledSeenNotificationIds === undefined) {
      setInternalSeenNotificationIds(ids)
    }

    onSeenNotificationIdsChange?.(ids)
    saveSeenNotificationIds(user.userId, ids)
  }, [controlledSeenNotificationIds, onSeenNotificationIdsChange, user?.userId])

  useEffect(() => {
    if (!user?.userId) {
      setInternalSeenNotificationIds([])
      return
    }

    if (controlledSeenNotificationIds === undefined) {
      setInternalSeenNotificationIds(loadSeenNotificationIds(user.userId))
    }
  }, [controlledSeenNotificationIds, user?.userId])

  useEffect(() => {
    if (!user?.userId) return

    const currentIds = new Set(notificationIds)
    const normalizedSeenIds = activeSeenNotificationIds.filter((id) => currentIds.has(id))

    if (normalizedSeenIds.length !== activeSeenNotificationIds.length) {
      updateSeenIds(normalizedSeenIds)
    }
  }, [activeSeenNotificationIds, notificationIds, updateSeenIds, user?.userId])

  useEffect(() => {
    onUnreadCountChange?.(user ? unreadCount : 0)
  }, [onUnreadCountChange, unreadCount, user])

  if (!user || isLoading) return null;

  if (pendingInvites.length === 0 && visiblePendingTeamRequests.length === 0 && dmRequests.length === 0) return null;

  const markAllAsSeen = () => {
    if (!user) return
    const nextSeenIds = Array.from(new Set([...activeSeenNotificationIds, ...notificationIds]))
    updateSeenIds(nextSeenIds)
  }

  const isUnread = (notificationId: string) => unreadNotificationIds.includes(notificationId)

  const handleRespond = (inviteId: string, status: 'ACCEPTED' | 'REJECTED') => {
    if (window.confirm(`초대를 ${status === 'ACCEPTED' ? '수락' : '거절'}하시겠습니까?`)) {
      setHiddenInviteIds((prev) => Array.from(new Set([...prev, inviteId])))
      respondMutation.mutate(
        { inviteId, status },
        {
          onSuccess: () => {
            recordEvent('invite_response', 'team', inviteId, {
              status,
              source: 'notification_panel'
            })
          },
          onError: (error) => {
            setHiddenInviteIds((prev) => prev.filter((id) => id !== inviteId))
            recordEvent('api_error', 'team', inviteId, {
              api: 'respondToInvite',
              action: 'invite_response',
              status,
              source: 'notification_panel',
              message: error instanceof Error ? error.message : 'unknown_error'
            })
            alert(error instanceof Error ? error.message : '초대 처리에 실패했습니다.')
          }
        }
      );
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

  const handleTeamRequestRespond = (requestId: string, status: 'APPROVED' | 'REJECTED') => {
    if (!user) return

    setHiddenTeamRequestIds((prev) => Array.from(new Set([...prev, requestId])))
    respondTeamRequestMutation.mutate(
      {
        requestId,
        reviewerUserId: user.id,
        status
      },
      {
        onSuccess: () => {
          const request = pendingTeamRequests.find((item) => item.id === requestId)
          recordEvent('team_request_result', 'team', request?.teamId ?? requestId, {
            requestId,
            requestType: request?.requestType ?? null,
            requesterUserId: request?.requesterUserId ?? null,
            status,
            source: 'notification_panel'
          })
        },
        onError: (error) => {
          setHiddenTeamRequestIds((prev) => prev.filter((id) => id !== requestId))
          recordEvent('api_error', 'team', requestId, {
            api: 'respondToTeamRequest',
            action: 'team_request_result',
            status,
            source: 'notification_panel',
            message: error instanceof Error ? error.message : 'unknown_error'
          })
          alert(error instanceof Error ? error.message : '요청 처리에 실패했습니다.')
        }
      }
    )
  }

  return (
    <div style={{ marginBottom: 16, padding: 14, border: '1px solid #fbcfe8', borderRadius: 12, backgroundColor: '#fffafc' }}>
      <div style={{ margin: '0 0 12px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
          🔔 알림
          {(pendingInvites.length + visiblePendingTeamRequests.length + dmRequests.length) > 0 && (
            <span style={{ backgroundColor: unreadCount > 0 ? '#ef4444' : '#94a3b8', color: 'white', fontSize: 10, padding: '2px 6px', borderRadius: 10 }}>
              {unreadCount > 0 ? `N ${unreadCount}` : pendingInvites.length + visiblePendingTeamRequests.length + dmRequests.length}
            </span>
          )}
        </h3>
        {unreadCount > 0 && (
          <button
            onClick={markAllAsSeen}
            style={{
              border: 'none',
              backgroundColor: '#fce7f3',
              color: '#be185d',
              borderRadius: 999,
              padding: '4px 10px',
              fontSize: 11,
              fontWeight: 700,
              cursor: 'pointer'
            }}
          >
            모두 확인
          </button>
        )}
      </div>

      <div style={{ display: 'grid', gap: 10 }}>
        {/* 팀 초대 알림 */}
        {pendingInvites.map((inv) => {
          const notificationId = `invite:${inv.id}`

          return (
          <div key={inv.id} style={{ backgroundColor: isUnread(notificationId) ? '#e0f2fe' : '#f0f9ff', padding: 12, borderRadius: 8, border: isUnread(notificationId) ? '1px solid #38bdf8' : '1px solid #bae6fd', boxShadow: isUnread(notificationId) ? '0 0 0 3px rgba(56, 189, 248, 0.12)' : 'none' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 8 }}>
              <p style={{ margin: 0, fontSize: 12, color: '#0369a1', fontWeight: 700 }}>팀 초대</p>
              {isUnread(notificationId) && (
                <span style={{ backgroundColor: '#0ea5e9', color: 'white', fontSize: 10, padding: '2px 6px', borderRadius: 999 }}>
                  NEW
                </span>
              )}
            </div>
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
        )})}

        {/* 팀 가입/탈퇴 요청 알림 (팀장용) */}
        {visiblePendingTeamRequests.map((request) => {
          const notificationId = `teamRequest:${request.id}`

          return (
            <div
              key={request.id}
              style={{
                backgroundColor: isUnread(notificationId) ? '#ecfeff' : '#f0fdfa',
                padding: 12,
                borderRadius: 8,
                border: isUnread(notificationId) ? '1px solid #06b6d4' : '1px solid #99f6e4',
                boxShadow: isUnread(notificationId) ? '0 0 0 3px rgba(6, 182, 212, 0.12)' : 'none'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 8 }}>
                <p style={{ margin: 0, fontSize: 12, color: '#0e7490', fontWeight: 700 }}>팀 요청</p>
                {isUnread(notificationId) && (
                  <span style={{ backgroundColor: '#0891b2', color: 'white', fontSize: 10, padding: '2px 6px', borderRadius: 999 }}>
                    NEW
                  </span>
                )}
              </div>
              <p style={{ margin: '0 0 8px 0', fontSize: 14 }}>
                <strong>{request.requesterUserName}</strong>님이 <strong>{request.teamName}</strong> 팀에
                {' '}{request.requestType === 'JOIN' ? '가입' : '탈퇴'} 요청을 보냈습니다.
              </p>
              <div style={{ display: 'flex', gap: 6 }}>
                <button
                  onClick={() => handleTeamRequestRespond(request.id, 'APPROVED')}
                  disabled={respondTeamRequestMutation.isPending}
                  style={{ flex: 1, backgroundColor: '#10b981', color: 'white', border: 'none', padding: '6px', borderRadius: 4, fontSize: 13, cursor: 'pointer' }}
                >
                  승인
                </button>
                <button
                  onClick={() => handleTeamRequestRespond(request.id, 'REJECTED')}
                  disabled={respondTeamRequestMutation.isPending}
                  style={{ flex: 1, backgroundColor: '#ef4444', color: 'white', border: 'none', padding: '6px', borderRadius: 4, fontSize: 13, cursor: 'pointer' }}
                >
                  거절
                </button>
              </div>
            </div>
          )
        })}

        {/* 채팅 신청 알림 */}
        {dmRequests.map((req) => {
          const notificationId = `dm:${req.id}`

          return (
          <div key={req.id} style={{ backgroundColor: isUnread(notificationId) ? '#faf5ff' : '#fdf4ff', padding: 12, borderRadius: 8, border: isUnread(notificationId) ? '1px solid #c084fc' : '1px solid #e9d5ff', boxShadow: isUnread(notificationId) ? '0 0 0 3px rgba(192, 132, 252, 0.12)' : 'none' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 4 }}>
              <p style={{ margin: 0, fontSize: 13, color: '#7c3aed', fontWeight: 600 }}>💬 채팅 신청</p>
              {isUnread(notificationId) && (
                <span style={{ backgroundColor: '#7c3aed', color: 'white', fontSize: 10, padding: '2px 6px', borderRadius: 999 }}>
                  NEW
                </span>
              )}
            </div>
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
        )})}
      </div>
    </div>
  );
}
