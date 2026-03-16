import { useState } from 'react'
import { useUser } from '../../contexts/UserContext'

export default function LoginForm() {
  const { login } = useUser()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (username.trim() && password.trim()) {
      login(username, password)
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
          border: '1px solid #e5e7eb',
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
          border: '1px solid #e5e7eb',
          borderRadius: 6,
          fontSize: 14,
          fontFamily: 'inherit'
        }}
      />
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
    </form>
  )
}
