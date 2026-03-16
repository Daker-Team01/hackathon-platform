import { useUser } from '../../contexts/UserContext'

export default function UserProfile() {
  const { user, logout } = useUser()

  if (!user) return null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ textAlign: 'center' }}>
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
          {user.nickname}
        </h3>
        <p style={{ margin: 0, fontSize: 12, color: '#6b7280' }}>
          @{user.username}
        </p>
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
          <p style={{ margin: 0, fontSize: 12, color: '#6b7280' }}>랭킹</p>
          <p style={{ margin: '4px 0 0 0', fontSize: 16, fontWeight: 700, color: '#4f46e5' }}>
            #{user.ranking}
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
          <p style={{ margin: 0, fontSize: 12, color: '#6b7280' }}>포인트</p>
          <p style={{ margin: '4px 0 0 0', fontSize: 16, fontWeight: 700, color: '#f59e0b' }}>
            {user.points}
          </p>
        </div>
      </div>

      <div>
        <p style={{ margin: '0 0 8px 0', fontSize: 12, fontWeight: 600, color: '#1f2937' }}>
          기술 스택
        </p>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {user.techStack.map((tech) => (
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
      </div>

      <div>
        <p style={{ margin: '0 0 8px 0', fontSize: 12, fontWeight: 600, color: '#1f2937' }}>
          성격 태그
        </p>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {user.personalityTags.map((tag) => (
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
      </div>

      <button
        onClick={logout}
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
  )
}
