import { useState } from 'react'
import { useUser } from '../../contexts/UserContext'
import { router } from '../../router/router'
import ParticipationSummary from './ParticipationSummary'

const PERSONALITY_TAGS_OPTIONS = [
  '실행빠름',
  '분석적',
  '집중형',
  '소통형',
  '열정적',
  '독립적',
  '협력적'
]

const TECH_STACK_OPTIONS = [
  'React',
  'Vue',
  'Angular',
  'TypeScript',
  'Python',
  'Java',
  'Node.js',
  'Django',
  'FastAPI',
  'PyTorch',
  'NLP',
  'PostgreSQL',
  'MongoDB',
  'GraphQL',
  'Docker',
  'AWS',
  'GCP',
  'Kubernetes',
  'UI/UX',
  'Mobile',
  'DevOps'
]

const WORK_STYLE_LABELS: Record<string, string> = {
  low: '낮음',
  medium: '보통',
  high: '높음'
}

const normalizeStringArray = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return value
      .filter((item): item is string => typeof item === 'string')
      .map((item) => item.trim())
      .filter(Boolean)
  }

  if (typeof value === 'string') {
    return value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean)
  }

  return []
}

export default function UserProfile() {
  const { user, logout, updateUser } = useUser()
  const [isEditing, setIsEditing] = useState(false)
  const [editData, setEditData] = useState({
    nickname: user?.nickname || '',
    personalityTags: normalizeStringArray(user?.personalityTags),
    techStack: normalizeStringArray(user?.techStack)
  })

  if (!user) return null

  const personalityTags = normalizeStringArray(user.personalityTags)
  const techStack = normalizeStringArray(user.techStack)
  const participationCount = user.participations.length
  const ongoingParticipationCount = user.participations.filter((item) => item.status === 'ongoing').length
  const activityPercent = Math.round(user.activityScore * 100)

  const formatDate = (value: string) => {
    if (!value) return '-'

    const date = new Date(value)

    if (Number.isNaN(date.getTime())) {
      return '-'
    }

    return date.toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  const handleSave = () => {
    updateUser({
      nickname: editData.nickname,
      personalityTags: normalizeStringArray(editData.personalityTags),
      techStack: normalizeStringArray(editData.techStack)
    })
    setIsEditing(false)
  }

  const handleCancel = () => {
    setEditData({
      nickname: user.nickname,
      personalityTags,
      techStack
    })
    setIsEditing(false)
  }

  const togglePersonalityTag = (tag: string) => {
    setEditData(prev => {
      const isSelected = prev.personalityTags.includes(tag)
      if (isSelected) {
        return {
          ...prev,
          personalityTags: prev.personalityTags.filter(t => t !== tag)
        }
      } else {
        // 최대 5개까지만 선택 가능
        if (prev.personalityTags.length < 5) {
          return {
            ...prev,
            personalityTags: [...prev.personalityTags, tag]
          }
        }
        return prev
      }
    })
  }

  const toggleTechStack = (tech: string) => {
    setEditData(prev => {
      const isSelected = prev.techStack.includes(tech)
      if (isSelected) {
        return {
          ...prev,
          techStack: prev.techStack.filter(t => t !== tech)
        }
      } else {
        return {
          ...prev,
          techStack: [...prev.techStack, tech]
        }
      }
    })
  }

  const handleLogout = () => {
    logout()
    router.navigate('/')
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ textAlign: 'center', flex: 1 }}>
          <img
            src={user.profileImage}
            alt={user.nickname}
            style={{
              width: 60,
              height: 60,
              borderRadius: '50%',
              marginBottom: 8
            }}
          />
          <h3 style={{ margin: '8px 0 4px 0', fontSize: 16, fontWeight: 600 }}>
            {isEditing ? (
              <input
                type="text"
                value={editData.nickname}
                onChange={(e) => setEditData({ ...editData, nickname: e.target.value })}
                style={{
                  width: '100%',
                  padding: '6px',
                  fontSize: 14,
                  border: '1px solid #d1d5db',
                  borderRadius: 4
                }}
              />
            ) : (
              user.nickname
            )}
          </h3>
          <p style={{ margin: '0 0 4px 0', fontSize: 12, color: '#6b7280' }}>
            {user.email}
          </p>
          <p style={{ margin: 0, fontSize: 11, color: '#94a3b8' }}>
            {user.userId} · 최근 로그인 {formatDate(user.lastLoginAt)}
          </p>
        </div>
        
        {!isEditing && (
          <button
            onClick={() => setIsEditing(true)}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: 0
            }}
            title="Edit Profile"
          >
            <img
              src="/assets/icons/edit-icon.png"
              alt="Edit"
              style={{ width: 24, height: 24 }}
            />
          </button>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <div
          style={{
            padding: 8,
            backgroundColor: '#f3f4f6',
            borderRadius: 6,
            textAlign: 'center'
          }}
        >
          <p style={{ margin: 0, fontSize: 12, color: '#6b7280' }}>총 포인트</p>
          <p style={{ margin: '4px 0 0 0', fontSize: 16, fontWeight: 700, color: '#f59e0b' }}>
            {user.points.toLocaleString()}
          </p>
        </div>
        <div
          style={{
            padding: 8,
            backgroundColor: '#f3f4f6',
            borderRadius: 6,
            textAlign: 'center'
          }}
        >
          <p style={{ margin: 0, fontSize: 12, color: '#6b7280' }}>평판</p>
          <p style={{ margin: '4px 0 0 0', fontSize: 16, fontWeight: 700, color: '#4f46e5' }}>
            {user.reputation.toFixed(1)} / 5.0
          </p>
        </div>
        <div
          style={{
            padding: 8,
            backgroundColor: '#f3f4f6',
            borderRadius: 6,
            textAlign: 'center'
          }}
        >
          <p style={{ margin: 0, fontSize: 12, color: '#6b7280' }}>활동 점수</p>
          <p style={{ margin: '4px 0 0 0', fontSize: 16, fontWeight: 700, color: '#0f766e' }}>
            {activityPercent}점
          </p>
        </div>
        <div
          style={{
            padding: 8,
            backgroundColor: '#f3f4f6',
            borderRadius: 6,
            textAlign: 'center'
          }}
        >
          <p style={{ margin: 0, fontSize: 12, color: '#6b7280' }}>참여 이력</p>
          <p style={{ margin: '4px 0 0 0', fontSize: 16, fontWeight: 700, color: '#1d4ed8' }}>
            {participationCount}회
          </p>
        </div>
      </div>

      <div style={{ padding: 12, backgroundColor: '#f8fafc', borderRadius: 10, border: '1px solid #e2e8f0' }}>
        <p style={{ margin: '0 0 8px 0', fontSize: 12, fontWeight: 600, color: '#1f2937' }}>선호 역할</p>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
          {user.preferredRoles.map((role) => (
            <span
              key={role}
              style={{
                padding: '4px 8px',
                backgroundColor: '#ecfeff',
                color: '#155e75',
                borderRadius: 12,
                fontSize: 12,
                fontWeight: 500
              }}
            >
              {role}
            </span>
          ))}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
          <div style={{ padding: 8, borderRadius: 8, backgroundColor: '#ffffff' }}>
            <p style={{ margin: 0, fontSize: 11, color: '#64748b' }}>소통</p>
            <p style={{ margin: '4px 0 0 0', fontSize: 13, fontWeight: 700, color: '#0f172a' }}>
              {WORK_STYLE_LABELS[user.workStyle.communication] ?? user.workStyle.communication}
            </p>
          </div>
          <div style={{ padding: 8, borderRadius: 8, backgroundColor: '#ffffff' }}>
            <p style={{ margin: 0, fontSize: 11, color: '#64748b' }}>리더십</p>
            <p style={{ margin: '4px 0 0 0', fontSize: 13, fontWeight: 700, color: '#0f172a' }}>
              {WORK_STYLE_LABELS[user.workStyle.leadership] ?? user.workStyle.leadership}
            </p>
          </div>
          <div style={{ padding: 8, borderRadius: 8, backgroundColor: '#ffffff' }}>
            <p style={{ margin: 0, fontSize: 11, color: '#64748b' }}>실행력</p>
            <p style={{ margin: '4px 0 0 0', fontSize: 13, fontWeight: 700, color: '#0f172a' }}>
              {WORK_STYLE_LABELS[user.workStyle.execution] ?? user.workStyle.execution}
            </p>
          </div>
        </div>
        <p style={{ margin: '10px 0 0 0', fontSize: 11, color: '#64748b' }}>
          현재 진행 중인 해커톤 {ongoingParticipationCount}개 · 가입일 {formatDate(user.createdAt)}
        </p>
      </div>

      <div>
        <p style={{ margin: '0 0 8px 0', fontSize: 12, fontWeight: 600, color: '#1f2937' }}>
          성격 태그 {isEditing && <span style={{fontSize: 11, color: '#6b7280'}}>({editData.personalityTags.length}/5)</span>}
        </p>
        {isEditing ? (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {PERSONALITY_TAGS_OPTIONS.map(tag => (
              <button
                key={tag}
                onClick={() => togglePersonalityTag(tag)}
                style={{
                  padding: '6px 10px',
                  border: editData.personalityTags.includes(tag)
                    ? '2px solid #be185d'
                    : '1px solid #d1d5db',
                  backgroundColor: editData.personalityTags.includes(tag)
                    ? '#fce7f3'
                    : '#f9fafb',
                  color: editData.personalityTags.includes(tag)
                    ? '#be185d'
                    : '#6b7280',
                  borderRadius: 12,
                  fontSize: 12,
                  fontWeight: 500,
                  cursor: editData.personalityTags.length >= 5 && !editData.personalityTags.includes(tag)
                    ? 'not-allowed'
                    : 'pointer',
                  opacity: editData.personalityTags.length >= 5 && !editData.personalityTags.includes(tag)
                    ? 0.5
                    : 1,
                  transition: 'all 0.2s'
                }}
                disabled={editData.personalityTags.length >= 5 && !editData.personalityTags.includes(tag)}
              >
                {tag}
              </button>
            ))}
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {personalityTags.map(tag => (
              <span
                key={tag}
                style={{
                  padding: '4px 8px',
                  backgroundColor: '#fce7f3',
                  color: '#be185d',
                  borderRadius: 12,
                  fontSize: 12,
                  fontWeight: 500
                }}
              >
                #{tag}
              </span>
            ))}
          </div>
        )}
      </div>

      <div>
        <p style={{ margin: '0 0 8px 0', fontSize: 12, fontWeight: 600, color: '#1f2937' }}>
          기술 스택
        </p>
        {isEditing ? (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {TECH_STACK_OPTIONS.map(tech => (
              <button
                key={tech}
                onClick={() => toggleTechStack(tech)}
                style={{
                  padding: '6px 10px',
                  border: editData.techStack.includes(tech)
                    ? '2px solid #1e40af'
                    : '1px solid #d1d5db',
                  backgroundColor: editData.techStack.includes(tech)
                    ? '#dbeafe'
                    : '#f9fafb',
                  color: editData.techStack.includes(tech)
                    ? '#1e40af'
                    : '#6b7280',
                  borderRadius: 12,
                  fontSize: 12,
                  fontWeight: 500,
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
              >
                {tech}
              </button>
            ))}
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {techStack.map(tech => (
              <span
                key={tech}
                style={{
                  padding: '4px 8px',
                  backgroundColor: '#dbeafe',
                  color: '#1e40af',
                  borderRadius: 12,
                  fontSize: 12,
                  fontWeight: 500
                }}
              >
                {tech}
              </span>
            ))}
          </div>
        )}
      </div>

      <ParticipationSummary />

      <div style={{ display: 'flex', gap: 8, flexDirection: 'column' }}>
        {isEditing ? (
          <>
            <button
              onClick={handleSave}
              style={{
                padding: '8px 12px',
                backgroundColor: '#10b981',
                color: 'white',
                border: 'none',
                borderRadius: 6,
                fontSize: 12,
                fontWeight: 500,
                cursor: 'pointer',
                transition: 'background-color 0.2s'
              }}
              onMouseOver={(e) => (e.currentTarget.style.backgroundColor = '#059669')}
              onMouseOut={(e) => (e.currentTarget.style.backgroundColor = '#10b981')}
            >
              저장
            </button>
            <button
              onClick={handleCancel}
              style={{
                padding: '8px 12px',
                backgroundColor: '#6b7280',
                color: 'white',
                border: 'none',
                borderRadius: 6,
                fontSize: 12,
                fontWeight: 500,
                cursor: 'pointer',
                transition: 'background-color 0.2s'
              }}
              onMouseOver={(e) => (e.currentTarget.style.backgroundColor = '#4b5563')}
              onMouseOut={(e) => (e.currentTarget.style.backgroundColor = '#6b7280')}
            >
              취소
            </button>
          </>
        ) : (
          <button
            onClick={handleLogout}
            style={{
              padding: '8px 12px',
              backgroundColor: '#ef4444',
              color: 'white',
              border: 'none',
              borderRadius: 6,
              fontSize: 12,
              fontWeight: 500,
              cursor: 'pointer',
              transition: 'background-color 0.2s'
            }}
            onMouseOver={(e) => (e.currentTarget.style.backgroundColor = '#dc2626')}
            onMouseOut={(e) => (e.currentTarget.style.backgroundColor = '#ef4444')}
          >
            로그아웃
          </button>
        )}
      </div>
    </div>
  )
}
