import { useState } from 'react'
import { allUsers, useUser } from '../../contexts/UserContext'

export default function LoginForm() {
  const { login } = useUser()
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const demoAccounts = allUsers.slice(0, 4)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!identifier.trim() || !password.trim()) {
      setError('이메일 또는 닉네임과 비밀번호를 입력해주세요.')
      return
    }

    const success = login(identifier, password)
    if (!success) {
      setError('이메일, 닉네임 또는 비밀번호가 올바르지 않습니다.')
      setPassword('')
    } else {
      setIdentifier('')
      setPassword('')
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <input
        type="text"
        placeholder="이메일 또는 닉네임"
        value={identifier}
        onChange={(e) => setIdentifier(e.target.value)}
        style={{
          padding: '10px 12px',
          border: error ? '1px solid #ef4444' : '1px solid #e5e7eb',
          borderRadius: 6,
          fontSize: 14,
          fontFamily: 'inherit'
        }}
      />
      <input
        type="password"
        placeholder="비밀번호"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        style={{
          padding: '10px 12px',
          border: error ? '1px solid #ef4444' : '1px solid #e5e7eb',
          borderRadius: 6,
          fontSize: 14,
          fontFamily: 'inherit'
        }}
      />
      {error && (
        <p style={{ margin: 0, fontSize: 12, color: '#ef4444', fontWeight: 500 }}>
          {error}
        </p>
      )}
      <button
        type="submit"
        style={{
          padding: '10px 12px',
          background: 'linear-gradient(135deg, #3B82F6 0%, #0EA5E9 100%)',
          color: '#FFFFFF',
          border: 'none',
          borderRadius: 6,
          fontSize: 14,
          fontWeight: 500,
          cursor: 'pointer',
          transition: 'transform 0.2s ease, box-shadow 0.2s ease'
        }}
        onMouseOver={(e) => {
          e.currentTarget.style.transform = 'translateY(-1px)'
          e.currentTarget.style.boxShadow = '0 8px 16px rgba(14, 165, 233, 0.3)'
        }}
        onMouseOut={(e) => {
          e.currentTarget.style.transform = 'translateY(0)'
          e.currentTarget.style.boxShadow = 'none'
        }}
      >
        로그인
      </button>
      <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 8, paddingTop: 8, borderTop: '1px solid #e5e7eb' }}>
        <p style={{ margin: '4px 0' }}>테스트 계정:</p>
        {demoAccounts.map((account) => (
          <p key={account.id} style={{ margin: '2px 0' }}>
            • {account.nickname} / {account.email} / {account.password}
          </p>
        ))}
      </div>
    </form>
  )
}
