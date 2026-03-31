import { useState } from 'react'
import { useUser, type UserWorkStyle } from '../../contexts/UserContext'
import { router } from '../../router/router'
import usersData from '../../data/user_dummy_v2.json'
import { useTeams } from '../../hooks/useTeams'
import { ALL_TECH_STACK_OPTIONS, TECH_STACK_OPTIONS, buildSearchOptions, normalizeStringArray } from '../../lib/userProfileOptions'
import { getUserCollaborationTemperature } from '../../lib/collaborationTemperature'

type Props = {
  activePanel?: 'teams' | 'interests' | null
  onOpenPanel?: (panel: 'teams' | 'interests' | null) => void
}

const PERSONALITY_TAGS_OPTIONS = [
  '실행빠름',
  '분석적',
  '집중형',
  '소통형',
  '열정적',
  '독립적',
  '협력적'
]

const PREFERRED_ROLE_OPTIONS = [
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
]

const WORK_STYLE_OPTIONS = [
  { value: 'low', label: '낮음' },
  { value: 'medium', label: '보통' },
  { value: 'high', label: '높음' }
] as const

const WORK_STYLE_FIELDS: Array<{ key: keyof UserWorkStyle; label: string }> = [
  { key: 'communication', label: '소통' },
  { key: 'leadership', label: '리더십' },
  { key: 'execution', label: '실행력' }
]

const WORK_STYLE_LABELS: Record<string, string> = {
  low: '낮음',
  medium: '보통',
  high: '높음'
}

const ALL_ROLE_OPTIONS = buildSearchOptions([
  ...PREFERRED_ROLE_OPTIONS,
  ...usersData.flatMap((user) => normalizeStringArray(user.preferredRoles)),
])

const ALL_PERSONALITY_TAG_OPTIONS = buildSearchOptions([
  ...PERSONALITY_TAGS_OPTIONS,
  ...usersData.flatMap((user) => normalizeStringArray(user.personalityTags)),
])

const filterOptions = (options: string[], query: string, selected: string[]) => {
  const trimmedQuery = query.trim().toLowerCase()
  const selectedSet = new Set(selected.map((item) => item.toLowerCase()))

  return options.filter((option) => {
    if (selectedSet.has(option.toLowerCase())) return false
    if (!trimmedQuery) return true
    return option.toLowerCase().includes(trimmedQuery)
  })
}

export default function UserProfile({ activePanel = null, onOpenPanel }: Props) {
  const { user, logout, updateUser } = useUser()
  const { data: teams = [] } = useTeams(undefined, { enabled: !!user })
  const [isEditing, setIsEditing] = useState(false)
  const [roleQuery, setRoleQuery] = useState('')
  const [personalityQuery, setPersonalityQuery] = useState('')
  const [techQuery, setTechQuery] = useState('')
  const [editData, setEditData] = useState({
    nickname: user?.nickname || '',
    personalityTags: normalizeStringArray(user?.personalityTags),
    techStack: normalizeStringArray(user?.techStack),
    preferredRoles: normalizeStringArray(user?.preferredRoles),
    workStyle: {
      communication: user?.workStyle.communication ?? 'medium',
      leadership: user?.workStyle.leadership ?? 'medium',
      execution: user?.workStyle.execution ?? 'medium'
    }
  })

  if (!user) return null

  const personalityTags = normalizeStringArray(user.personalityTags)
  const techStack = normalizeStringArray(user.techStack)
  const preferredRoles = normalizeStringArray(user.preferredRoles)
  const localParticipationByTeamCode = new Map(user.participations.map((item) => [item.teamCode, item]))
  const supabaseTeamCodes = teams
    .filter((team) => team.members?.some((member) => member.userId === user.userId))
    .map((team) => team.teamCode)

  const mergedTeamCodes = new Set<string>([
    ...user.participations.map((item) => item.teamCode),
    ...supabaseTeamCodes
  ])

  const participationCount = mergedTeamCodes.size
  const ongoingParticipationCount = [...mergedTeamCodes].filter((teamCode) => {
    const localParticipation = localParticipationByTeamCode.get(teamCode)
    return (localParticipation?.status ?? 'ongoing') === 'ongoing'
  }).length
  const activityPercent = Math.round(user.activityScore * 100)
  const collaborationTemperature = getUserCollaborationTemperature(user.userId || user.id)
  const filteredRoleOptions = filterOptions(ALL_ROLE_OPTIONS, roleQuery, editData.preferredRoles).slice(0, 8)
  const filteredPersonalityOptions = filterOptions(
    ALL_PERSONALITY_TAG_OPTIONS,
    personalityQuery,
    editData.personalityTags
  ).slice(0, 8)
  const filteredTechOptions = filterOptions(ALL_TECH_STACK_OPTIONS, techQuery, editData.techStack).slice(0, 8)

  const actionButtonStyle = {
    padding: '8px 12px',
    border: 'none',
    borderRadius: 8,
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer'
  } as const

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
      techStack: normalizeStringArray(editData.techStack),
      preferredRoles: normalizeStringArray(editData.preferredRoles),
      workStyle: editData.workStyle
    })
    setIsEditing(false)
  }

  const handleCancel = () => {
    setRoleQuery('')
    setPersonalityQuery('')
    setTechQuery('')
    setEditData({
      nickname: user.nickname,
      personalityTags,
      techStack,
      preferredRoles,
      workStyle: {
        communication: user.workStyle.communication,
        leadership: user.workStyle.leadership,
        execution: user.workStyle.execution
      }
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

  const togglePreferredRole = (role: string) => {
    setEditData((prev) => {
      const isSelected = prev.preferredRoles.includes(role)
      return {
        ...prev,
        preferredRoles: isSelected
          ? prev.preferredRoles.filter((item) => item !== role)
          : [...prev.preferredRoles, role]
      }
    })
  }

  const updateWorkStyle = (field: keyof UserWorkStyle, value: string) => {
    setEditData((prev) => ({
      ...prev,
      workStyle: {
        ...prev.workStyle,
        [field]: value
      }
    }))
  }

  const handleLogout = () => {
    logout()
    router.navigate('/')
  }

  const toggleAuxPanel = (panel: 'teams' | 'interests') => {
    if (!onOpenPanel) return
    onOpenPanel(activePanel === panel ? null : panel)
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
        
        {isEditing ? (
          <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
            <button
              onClick={handleSave}
              style={{
                ...actionButtonStyle,
                backgroundColor: '#10b981',
                color: '#ffffff'
              }}
              onMouseOver={(e) => (e.currentTarget.style.backgroundColor = '#059669')}
              onMouseOut={(e) => (e.currentTarget.style.backgroundColor = '#10b981')}
            >
              적용
            </button>
            <button
              onClick={handleCancel}
              style={{
                ...actionButtonStyle,
                backgroundColor: '#e5e7eb',
                color: '#374151'
              }}
              onMouseOver={(e) => (e.currentTarget.style.backgroundColor = '#d1d5db')}
              onMouseOut={(e) => (e.currentTarget.style.backgroundColor = '#e5e7eb')}
            >
              취소
            </button>
          </div>
        ) : (
          <button
            onClick={() => setIsEditing(true)}
            style={{
              ...actionButtonStyle,
              backgroundColor: '#eff6ff',
              color: '#1d4ed8',
              flexShrink: 0
            }}
            onMouseOver={(e) => (e.currentTarget.style.backgroundColor = '#dbeafe')}
            onMouseOut={(e) => (e.currentTarget.style.backgroundColor = '#eff6ff')}
            title="Edit Profile"
          >
            Edit
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
          <p style={{ margin: 0, fontSize: 12, color: '#6b7280' }}>협업 온도</p>
          <p style={{ margin: '4px 0 0 0', fontSize: 16, fontWeight: 700, color: '#4f46e5' }}>
            {`${collaborationTemperature.temperature.toFixed(1)}°C`}
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
        {isEditing ? (
          <div style={{ display: 'grid', gap: 10, marginBottom: 12 }}>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {editData.preferredRoles.length > 0 ? editData.preferredRoles.map((role) => (
                <button
                  key={`selected-role-${role}`}
                  onClick={() => togglePreferredRole(role)}
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
                  {role}
                </button>
              )) : (
                <span style={{ fontSize: 12, color: '#94a3b8' }}>아직 선택한 역할이 없습니다.</span>
              )}
            </div>
            <div style={{ display: 'grid', gap: 8 }}>
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
              {roleQuery.trim().length > 0 ? (
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {filteredRoleOptions.length > 0 ? filteredRoleOptions.map((role) => (
                    <button
                      key={`searched-role-${role}`}
                      onClick={() => {
                        togglePreferredRole(role)
                        setRoleQuery('')
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
                  )) : (
                    <span style={{ fontSize: 12, color: '#94a3b8' }}>검색 결과가 없습니다.</span>
                  )}
                </div>
              ) : null}
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {PREFERRED_ROLE_OPTIONS.map((role) => {
                const selected = editData.preferredRoles.includes(role)

                return (
                  <button
                    key={role}
                    onClick={() => togglePreferredRole(role)}
                    style={{
                      padding: '6px 10px',
                      border: selected ? '2px solid #0891b2' : '1px solid #d1d5db',
                      backgroundColor: selected ? '#cffafe' : '#ffffff',
                      color: selected ? '#155e75' : '#475569',
                      borderRadius: 999,
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                  >
                    {role}
                  </button>
                )
              })}
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
            {preferredRoles.length > 0 ? preferredRoles.map((role) => (
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
            )) : (
              <span style={{ fontSize: 12, color: '#94a3b8' }}>아직 선택한 역할이 없습니다.</span>
            )}
          </div>
        )}

        {isEditing ? (
          <div style={{ display: 'grid', gap: 10 }}>
            {WORK_STYLE_FIELDS.map((field) => (
              <div key={field.key} style={{ padding: 10, borderRadius: 8, backgroundColor: '#ffffff' }}>
                <p style={{ margin: '0 0 8px 0', fontSize: 11, color: '#64748b' }}>{field.label}</p>
                <div style={{ display: 'flex', gap: 6 }}>
                  {WORK_STYLE_OPTIONS.map((option) => {
                    const selected = editData.workStyle[field.key] === option.value

                    return (
                      <button
                        key={option.value}
                        onClick={() => updateWorkStyle(field.key, option.value)}
                        style={{
                          flex: 1,
                          padding: '7px 0',
                          borderRadius: 8,
                          border: selected ? '2px solid #2563eb' : '1px solid #cbd5e1',
                          backgroundColor: selected ? '#dbeafe' : '#ffffff',
                          color: selected ? '#1d4ed8' : '#475569',
                          fontSize: 12,
                          fontWeight: 700,
                          cursor: 'pointer'
                        }}
                      >
                        {option.label}
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        ) : (
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
        )}
        <p style={{ margin: '10px 0 0 0', fontSize: 11, color: '#64748b' }}>
          현재 참여 중인 팀 {ongoingParticipationCount}개 · 가입일 {formatDate(user.createdAt)}
        </p>
      </div>

      <div>
        <p style={{ margin: '0 0 8px 0', fontSize: 12, fontWeight: 600, color: '#1f2937' }}>
          성격 태그 {isEditing && <span style={{fontSize: 11, color: '#6b7280'}}>({editData.personalityTags.length}/5)</span>}
        </p>
        {isEditing ? (
          <div style={{ display: 'grid', gap: 10 }}>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {editData.personalityTags.length > 0 ? editData.personalityTags.map(tag => (
                <button
                  key={`selected-tag-${tag}`}
                  onClick={() => togglePersonalityTag(tag)}
                  style={{
                    padding: '6px 10px',
                    border: '2px solid #be185d',
                    backgroundColor: '#fce7f3',
                    color: '#be185d',
                    borderRadius: 12,
                    fontSize: 12,
                    fontWeight: 500,
                    cursor: 'pointer'
                  }}
                >
                  {tag}
                </button>
              )) : (
                <span style={{ fontSize: 12, color: '#94a3b8' }}>아직 선택한 태그가 없습니다.</span>
              )}
            </div>
            <div style={{ display: 'grid', gap: 8 }}>
              <input
                type="text"
                value={personalityQuery}
                onChange={(e) => setPersonalityQuery(e.target.value)}
                placeholder="성격 태그 검색"
                style={{
                  width: '100%',
                  padding: '8px 10px',
                  fontSize: 12,
                  border: '1px solid #d1d5db',
                  borderRadius: 8,
                  backgroundColor: '#ffffff'
                }}
              />
              {personalityQuery.trim().length > 0 ? (
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {filteredPersonalityOptions.length > 0 ? filteredPersonalityOptions.map(tag => (
                    <button
                      key={`searched-tag-${tag}`}
                      onClick={() => {
                        togglePersonalityTag(tag)
                        setPersonalityQuery('')
                      }}
                      disabled={editData.personalityTags.length >= 5}
                      style={{
                        padding: '6px 10px',
                        border: '1px solid #d1d5db',
                        backgroundColor: editData.personalityTags.length >= 5 ? '#f3f4f6' : '#ffffff',
                        color: '#6b7280',
                        borderRadius: 12,
                        fontSize: 12,
                        fontWeight: 500,
                        cursor: editData.personalityTags.length >= 5 ? 'not-allowed' : 'pointer'
                      }}
                    >
                      {tag}
                    </button>
                  )) : (
                    <span style={{ fontSize: 12, color: '#94a3b8' }}>검색 결과가 없습니다.</span>
                  )}
                </div>
              ) : null}
            </div>
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
          <div style={{ display: 'grid', gap: 10 }}>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {editData.techStack.length > 0 ? editData.techStack.map(tech => (
                <button
                  key={`selected-tech-${tech}`}
                  onClick={() => toggleTechStack(tech)}
                  style={{
                    padding: '6px 10px',
                    border: '2px solid #1e40af',
                    backgroundColor: '#dbeafe',
                    color: '#1e40af',
                    borderRadius: 12,
                    fontSize: 12,
                    fontWeight: 500,
                    cursor: 'pointer'
                  }}
                >
                  {tech}
                </button>
              )) : (
                <span style={{ fontSize: 12, color: '#94a3b8' }}>아직 선택한 기술이 없습니다.</span>
              )}
            </div>
            <div style={{ display: 'grid', gap: 8 }}>
              <input
                type="text"
                value={techQuery}
                onChange={(e) => setTechQuery(e.target.value)}
                placeholder="기술 스택 검색"
                style={{
                  width: '100%',
                  padding: '8px 10px',
                  fontSize: 12,
                  border: '1px solid #d1d5db',
                  borderRadius: 8,
                  backgroundColor: '#ffffff'
                }}
              />
              {techQuery.trim().length > 0 ? (
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {filteredTechOptions.length > 0 ? filteredTechOptions.map(tech => (
                    <button
                      key={`searched-tech-${tech}`}
                      onClick={() => {
                        toggleTechStack(tech)
                        setTechQuery('')
                      }}
                      style={{
                        padding: '6px 10px',
                        border: '1px solid #d1d5db',
                        backgroundColor: '#ffffff',
                        color: '#6b7280',
                        borderRadius: 12,
                        fontSize: 12,
                        fontWeight: 500,
                        cursor: 'pointer'
                      }}
                    >
                      {tech}
                    </button>
                  )) : (
                    <span style={{ fontSize: 12, color: '#94a3b8' }}>검색 결과가 없습니다.</span>
                  )}
                </div>
              ) : null}
            </div>
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

      <div style={{ padding: 12, backgroundColor: '#f8fafc', borderRadius: 10, border: '1px solid #e2e8f0' }}>
        <p style={{ margin: '0 0 10px 0', fontSize: 12, fontWeight: 700, color: '#334155' }}>
          보조 창
        </p>
        <div style={{ display: 'grid', gap: 8 }}>
          <button
            type="button"
            onClick={() => toggleAuxPanel('teams')}
            style={{
              padding: '8px 10px',
              borderRadius: 8,
              border: activePanel === 'teams' ? '1px solid #2563eb' : '1px solid #cbd5e1',
              backgroundColor: activePanel === 'teams' ? '#eff6ff' : '#ffffff',
              color: activePanel === 'teams' ? '#1d4ed8' : '#334155',
              fontSize: 12,
              fontWeight: 700,
              cursor: 'pointer',
              transition: 'background-color 0.2s, border-color 0.2s'
            }}
            onMouseOver={(e) => {
              if (activePanel !== 'teams') {
                e.currentTarget.style.backgroundColor = '#f8fafc'
                e.currentTarget.style.borderColor = '#94a3b8'
              }
            }}
            onMouseOut={(e) => {
              if (activePanel !== 'teams') {
                e.currentTarget.style.backgroundColor = '#ffffff'
                e.currentTarget.style.borderColor = '#cbd5e1'
              }
            }}
          >
            참가중인 팀 열기
          </button>
          <button
            type="button"
            onClick={() => toggleAuxPanel('interests')}
            style={{
              padding: '8px 10px',
              borderRadius: 8,
              border: activePanel === 'interests' ? '1px solid #2563eb' : '1px solid #cbd5e1',
              backgroundColor: activePanel === 'interests' ? '#eff6ff' : '#ffffff',
              color: activePanel === 'interests' ? '#1d4ed8' : '#334155',
              fontSize: 12,
              fontWeight: 700,
              cursor: 'pointer',
              transition: 'background-color 0.2s, border-color 0.2s'
            }}
            onMouseOver={(e) => {
              if (activePanel !== 'interests') {
                e.currentTarget.style.backgroundColor = '#f8fafc'
                e.currentTarget.style.borderColor = '#94a3b8'
              }
            }}
            onMouseOut={(e) => {
              if (activePanel !== 'interests') {
                e.currentTarget.style.backgroundColor = '#ffffff'
                e.currentTarget.style.borderColor = '#cbd5e1'
              }
            }}
          >
            관심있는 해커톤 리스트 열기
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, flexDirection: 'column' }}>
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
      </div>
    </div>
  )
}
