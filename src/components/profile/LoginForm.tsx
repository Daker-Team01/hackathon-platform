import { useState } from 'react'
import { useUser } from '../../contexts/UserContext'

export default function LoginForm() {
  const { login } = useUser()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!username.trim() || !password.trim()) {
      setError('아이디와 비밀번호를 입력해주세요.')
      return
    }

    const success = login(username, password)
    if (!success) {
      setError('아이디 또는 비밀번호가 올바르지 않습니다.')
      setPassword('')
    } else {
      setUsername('')
      setPassword('')
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <input
        type="text"
        placeholder="아이디"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
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
          backgroundColor: '#4f46e5',
          color: 'white',
          border: 'none',
          borderRadius: 6,
          fontSize: 14,
          fontWeight: 500,
          cursor: 'pointer',
          transition: 'background-color 0.2s'
        }}
        onMouseOver={(e) => (e.currentTarget.style.backgroundColor = '#4338ca')}
        onMouseOut={(e) => (e.currentTarget.style.backgroundColor = '#4f46e5')}
      >
        로그인
      </button>
      <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 8, paddingTop: 8, borderTop: '1px solid #e5e7eb' }}>
        <p style={{ margin: '4px 0' }}>테스트 계정:</p>
        <p style={{ margin: '2px 0' }}>• alice / alice1234</p>
        <p style={{ margin: '2px 0' }}>• bob / bob1234</p>
        <p style={{ margin: '2px 0' }}>• charlie / charlie1234</p>
      </div>
    </form>
  )
}
