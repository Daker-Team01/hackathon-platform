import { useState } from "react"
import { useNavigate } from 'react-router-dom'

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

export default function Rankings(){

  const navigate = useNavigate()

  // 더미 데이터
  const rankingData: RankingData = {
    all: [
      { rank: 1, nickname: "Alice", points: 1200 },
      { rank: 2, nickname: "Bob", points: 1100 },
      { rank: 3, nickname: "Charlie", points: 950 }
    ],
    days30: [
      { rank: 1, nickname: "Bob", points: 500 },
      { rank: 2, nickname: "Alice", points: 420 },
      { rank: 3, nickname: "David", points: 390 }
    ],
    days7: [
      { rank: 1, nickname: "David", points: 200 },
      { rank: 2, nickname: "Charlie", points: 180 },
      { rank: 3, nickname: "Bob", points: 150 }
    ]
  }

  // 현재 선택된 필터
  const [filter, setFilter] = useState<keyof RankingData>("all")

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

    </div>
  )

}