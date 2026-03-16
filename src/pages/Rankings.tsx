import { useState, useEffect } from "react"
import { useNavigate } from 'react-router-dom'
import userAlice from '../data/UserData/user_alice.json'
import userBob from '../data/UserData/user_bob.json'
import userCharlie from '../data/UserData/user_charlie.json'
import userDiana from '../data/UserData/user_diana.json'
import userEvan from '../data/UserData/user_evan.json'

interface RankingUser {
  rank: number
  nickname: string
  points: number
}

interface RankingData {
  all: RankingUser[]
  days30: RankingUser[]
  days7: RankingUser[]
}

interface UserData {
  ranking: number
  nickname: string
  points: number
}

export default function Rankings(){

  const navigate = useNavigate()

  // 상태 관리
  const [filter, setFilter] = useState<keyof RankingData>("all")
  const [rankingData, setRankingData] = useState<RankingData | null>(null)
  const [error, setError] = useState<string | null>(null)

  // 랭킹 데이터 로드
  useEffect(() => {
    try {
      setError(null)
      
      // UserData JSON 파일들에서 랭킹 데이터 추출
      const users: UserData[] = [
        userAlice,
        userBob,
        userCharlie,
        userDiana,
        userEvan
      ]

      // ranking 필드로 정렬
      const sortedByRanking = users.sort((a, b) => a.ranking - b.ranking)

      // 각 필터별 데이터 생성
      const data: RankingData = {
        all: sortedByRanking.map((user, index) => ({
          rank: index + 1,
          nickname: user.nickname,
          points: user.points
        })),
        days30: sortedByRanking.map((user, index) => ({
          rank: index + 1,
          nickname: user.nickname,
          points: Math.floor(user.points * 0.6) // 30일 데이터는 60%로 시뮬레이션
        })),
        days7: sortedByRanking.map((user, index) => ({
          rank: index + 1,
          nickname: user.nickname,
          points: Math.floor(user.points * 0.3) // 7일 데이터는 30%로 시뮬레이션
        }))
      }

      setRankingData(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : '랭킹 데이터를 불러오는 중 오류가 발생했습니다.')
    }
  }, [])

  return (
    <div style={{ padding: 20 }}>
      <button 
        onClick={() => navigate('/')}
        style={{ 
          padding: 10,
          marginBottom: 20,
          backgroundColor: "#6c757d",
          color: "white",
          border: "none",
          borderRadius: 4,
          cursor: "pointer",
          fontSize: 14
        }}
      >
        ← 메인으로
      </button>
      
      <h1>Global Rankings</h1>

      {/* 오류 상태만 표시 */}
      {error && (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '400px',
          gap: 16,
          backgroundColor: '#f8d7da',
          border: '1px solid #f5c6cb',
          borderRadius: 8,
          padding: 30,
          color: '#721c24'
        }}>
          <span style={{ fontSize: 48 }}>⚠️</span>
          <h2 style={{ margin: '10px 0 0 0' }}>오류가 발생했습니다</h2>
          <p style={{ margin: '8px 0 0 0', textAlign: 'center' }}>{error}</p>
          <button 
            onClick={() => window.location.reload()}
            style={{
              marginTop: 16,
              padding: '10px 20px',
              backgroundColor: '#721c24',
              color: 'white',
              border: 'none',
              borderRadius: 4,
              cursor: 'pointer',
              fontSize: 14
            }}
          >
            다시 시도
          </button>
        </div>
      )}

      {/* 정상 상태 - 바로 표시 */}
      {!error && rankingData && (
        <>
          {/* 기간 필터 */}
          <div style={{ marginBottom: 20 }}>
            <button 
              onClick={() => setFilter("all")}
              style={{ 
                padding: 10, 
                marginRight: 10,
                backgroundColor: filter === "all" ? "#007bff" : "#e9ecef",
                color: filter === "all" ? "white" : "black",
                border: "none",
                borderRadius: 4,
                cursor: "pointer"
              }}
            >
              전체
            </button>
            <button 
              onClick={() => setFilter("days30")}
              style={{ 
                padding: 10, 
                marginRight: 10,
                backgroundColor: filter === "days30" ? "#007bff" : "#e9ecef",
                color: filter === "days30" ? "white" : "black",
                border: "none",
                borderRadius: 4,
                cursor: "pointer"
              }}
            >
              30일
            </button>
            <button 
              onClick={() => setFilter("days7")}
              style={{ 
                padding: 10,
                backgroundColor: filter === "days7" ? "#007bff" : "#e9ecef",
                color: filter === "days7" ? "white" : "black",
                border: "none",
                borderRadius: 4,
                cursor: "pointer"
              }}
            >
              최근 7일
            </button>
          </div>

          {/* 랭킹 테이블 */}
          <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 20 }}>
            <thead>
              <tr style={{ backgroundColor: "#f8f9fa", borderBottom: "2px solid #dee2e6" }}>
                <th style={{ padding: 12, textAlign: "left" }}>Rank</th>
                <th style={{ padding: 12, textAlign: "left" }}>Nickname</th>
                <th style={{ padding: 12, textAlign: "left" }}>Points</th>
              </tr>
            </thead>

            <tbody>
              {rankingData[filter].map((user) => (
                <tr key={user.rank} style={{ borderBottom: "1px solid #dee2e6" }}>
                  <td style={{ padding: 12 }}>{user.rank}</td>
                  <td style={{ padding: 12 }}>{user.nickname}</td>
                  <td style={{ padding: 12 }}>{user.points}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

    </div>
  )

}