import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLog } from '../contexts/LogContext'
import type { Hackathon } from '../types/hackathon'

const HACKATHONS_STORAGE_KEY = 'hackathons'

function getFromStorage<T>(key: string): T[] {
  const raw = localStorage.getItem(key)
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export default function Analytics() {
  const navigate = useNavigate()
  const { logs } = useLog()
  const [filterDays, setFilterDays] = useState<number | 'all'>('all')

  const hackathons = useMemo(() => getFromStorage<Hackathon>(HACKATHONS_STORAGE_KEY), [])

  const filteredLogs = useMemo(() => {
    if (filterDays === 'all') return logs
    const now = new Date()
    const cutoff = new Date(now.setDate(now.getDate() - filterDays))
    return logs.filter((log) => new Date(log.timestamp) >= cutoff)
  }, [logs, filterDays])

  // 1. 기간별 해커톤 개최 수 (사실 이건 로그보다는 해커톤 생성일 기준이어야 함)
  // 여기서는 단순히 등록된 해커톤 수를 보여줌
  const hackathonsCount = hackathons.length

  // 2. 인기 태그 TOP 10
  const tagCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    hackathons.forEach((h) => {
      h.tags.forEach((tag) => {
        counts[tag] = (counts[tag] || 0) + 1
      })
    })
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
  }, [hackathons])

  // 3. 참가자 수 추이 (hackathon_join 로그 기준)
  const joinLogs = useMemo(() => filteredLogs.filter((l) => l.eventType === 'hackathon_join'), [
    filteredLogs,
  ])

  // 4. 팀 구성 평균 인원 (팀당 인원 데이터가 부족하므로 여기서는 시뮬레이션)
  // 실제로는 팀 멤버 수를 집계해야 함.
  const averageTeamSize = 3.5 // Mock value for visualization

  // 5. 제출 성공률 (참가 팀 대비 프로젝트 제출 팀 비율)
  const submissionRate = useMemo(() => {
    const joinCount = filteredLogs.filter((l) => l.eventType === 'hackathon_join').length
    const submitCount = filteredLogs.filter((l) => l.eventType === 'submit_project').length
    return joinCount > 0 ? ((submitCount / joinCount) * 100).toFixed(1) : '0'
  }, [filteredLogs])

  // 6. 인기 해커톤 (조회수 / 참가자 수 / 팀 생성 수 기반)
  const popularHackathons = useMemo(() => {
    const stats: Record<string, { views: number; joins: number; teams: number; title: string }> = {}
    
    // Initialize with titles
    hackathons.forEach(h => {
        stats[h.slug] = { views: 0, joins: 0, teams: 0, title: h.title }
    })

    filteredLogs.forEach((l) => {
      if (!stats[l.targetId]) return
      if (l.eventType === 'hackathon_view') stats[l.targetId].views++
      if (l.eventType === 'hackathon_join') stats[l.targetId].joins++
      if (l.eventType === 'team_create') stats[l.targetId].teams++
    })

    return Object.entries(stats)
      .map(([slug, data]) => ({ slug, ...data }))
      .sort((a, b) => (b.views + b.joins * 2 + b.teams * 3) - (a.views + a.joins * 2 + a.teams * 3))
      .slice(0, 5)
  }, [filteredLogs, hackathons])

  // 7. 전환율 분석
  const conversionStats = useMemo(() => {
    const views = filteredLogs.filter(l => l.eventType === 'hackathon_view').length
    const joins = filteredLogs.filter(l => l.eventType === 'hackathon_join').length
    const teamCreates = filteredLogs.filter(l => l.eventType === 'team_create').length
    const submits = filteredLogs.filter(l => l.eventType === 'submit_project').length

    return {
        viewToJoin: views > 0 ? (joins / views * 100).toFixed(1) : '0',
        joinToTeam: joins > 0 ? (teamCreates / joins * 100).toFixed(1) : '0',
        teamToSubmit: teamCreates > 0 ? (submits / teamCreates * 100).toFixed(1) : '0'
    }
  }, [filteredLogs])

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
      <h1>Analytics</h1>
      
      <div style={{ marginBottom: 20 }}>
        <button onClick={() => setFilterDays(7)}>최근 7일</button>
        <button onClick={() => setFilterDays(30)} style={{ marginLeft: 8 }}>최근 30일</button>
        <button onClick={() => setFilterDays('all')} style={{ marginLeft: 8 }}>전체</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 20 }}>
        
        <section style={{ border: '1px solid #ccc', padding: 15, borderRadius: 8 }}>
          <h3>전체 요약</h3>
          <p>등록된 해커톤: <strong>{hackathonsCount}</strong></p>
          <p>전체 활동 로그: <strong>{filteredLogs.length}</strong>건</p>
          <p>참가자 수: <strong>{joinLogs.length}</strong>명</p>
          <p>평균 팀 인원: <strong>{averageTeamSize}</strong>명</p>
          <p>프로젝트 제출 성공률: <strong>{submissionRate}%</strong></p>
        </section>

        <section style={{ border: '1px solid #ccc', padding: 15, borderRadius: 8 }}>
          <h3>인기 태그 TOP 10</h3>
          <ul style={{ paddingLeft: 20 }}>
            {tagCounts.map(([tag, count]) => (
              <li key={tag}>{tag}: {count}개</li>
            ))}
          </ul>
        </section>

        <section style={{ border: '1px solid #ccc', padding: 15, borderRadius: 8 }}>
          <h3>전환율 분석</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div>
                <strong>상세 조회 → 참가 신청</strong>
                <div style={{ width: '100%', backgroundColor: '#eee', borderRadius: 4, height: 20, marginTop: 4 }}>
                    <div style={{ width: `${conversionStats.viewToJoin}%`, backgroundColor: '#4caf50', height: '100%', borderRadius: 4 }} />
                </div>
                <span>{conversionStats.viewToJoin}%</span>
            </div>
            <div>
                <strong>참가 신청 → 팀 생성</strong>
                <div style={{ width: '100%', backgroundColor: '#eee', borderRadius: 4, height: 20, marginTop: 4 }}>
                    <div style={{ width: `${conversionStats.joinToTeam}%`, backgroundColor: '#2196f3', height: '100%', borderRadius: 4 }} />
                </div>
                <span>{conversionStats.joinToTeam}%</span>
            </div>
            <div>
                <strong>팀 생성 → 최종 제출</strong>
                <div style={{ width: '100%', backgroundColor: '#eee', borderRadius: 4, height: 20, marginTop: 4 }}>
                    <div style={{ width: `${conversionStats.teamToSubmit}%`, backgroundColor: '#ff9800', height: '100%', borderRadius: 4 }} />
                </div>
                <span>{conversionStats.teamToSubmit}%</span>
            </div>
          </div>
        </section>

        <section style={{ border: '1px solid #ccc', padding: 15, borderRadius: 8 }}>
          <h3>인기 해커톤 TOP 5</h3>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', borderBottom: '1px solid #eee' }}>해커톤</th>
                <th style={{ textAlign: 'right', borderBottom: '1px solid #eee' }}>조회</th>
                <th style={{ textAlign: 'right', borderBottom: '1px solid #eee' }}>참가</th>
                <th style={{ textAlign: 'right', borderBottom: '1px solid #eee' }}>팀</th>
              </tr>
            </thead>
            <tbody>
              {popularHackathons.map((h) => (
                <tr key={h.slug}>
                  <td style={{ borderBottom: '1px solid #eee' }}>{h.title}</td>
                  <td style={{ textAlign: 'right', borderBottom: '1px solid #eee' }}>{h.views}</td>
                  <td style={{ textAlign: 'right', borderBottom: '1px solid #eee' }}>{h.joins}</td>
                  <td style={{ textAlign: 'right', borderBottom: '1px solid #eee' }}>{h.teams}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

      </div>

      <section style={{ marginTop: 20, border: '1px solid #ccc', padding: 15, borderRadius: 8 }}>
        <h3>최근 활동 로그 (최근 20건)</h3>
        <ul style={{ fontSize: '0.9em', color: '#666' }}>
          {filteredLogs.slice().reverse().slice(0, 20).map(log => (
            <li key={log.id}>
              [{new Date(log.timestamp).toLocaleString()}] {log.userId || 'Guest'} 가 {log.targetId} 에 대해 <strong>{log.eventType}</strong> 실행
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
