import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTeams } from '../hooks/useTeams'

type TeamsProps = {
  hackathonSlug: string
}

export default function Teams({ hackathonSlug }: TeamsProps) {
  const navigate = useNavigate()
  const { data: teams, isLoading } = useTeams(hackathonSlug)
  const [noticeOpen, setNoticeOpen] = useState(false)

  function handleOpenCreateNotice() {
    setNoticeOpen(true)
  }

  function handleConfirmNotice() {
    setNoticeOpen(false)
    navigate(`/camp/new?hackathon=${hackathonSlug}`)
  }

  function handleCloseNotice() {
    setNoticeOpen(false)
  }

  return (
    <section>
      <h2>Teams</h2>

      <button type="button" onClick={handleOpenCreateNotice} style={{ marginBottom: 12 }}>
        팀 생성하기
      </button>

      {isLoading ? (
        <p>팀 목록을 불러오는 중입니다.</p>
      ) : !teams || teams.length === 0 ? (
        <p>등록된 팀이 없습니다.</p>
      ) : (
        teams.map((team) => (
          <article
            key={team.teamCode}
            style={{ border: '1px solid #ccc', padding: 12, marginBottom: 8 }}
          >
            <h3>{team.name}</h3>
            <p>{team.intro}</p>
            <p>Members: {team.memberCount}명</p>
            <p>Status: {team.isOpen ? '모집중' : '모집마감'}</p>
            <p>Looking For: {team.lookingFor.join(', ') || '-'}</p>
            <p>Contact: {team.contact.url}</p>
          </article>
        ))
      )}

      {noticeOpen ? (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.45)',
            display: 'grid',
            placeItems: 'center',
            padding: 16,
          }}
        >
          <div style={{ backgroundColor: '#fff', color: '#111', maxWidth: 560, padding: 16 }}>
            <h3>Team Participation Notice</h3>
            <p>팀 생성/참여 전 아래 규칙을 확인하세요.</p>
            <ul>
              <li>한 해커톤에서 활동 정책을 준수해야 합니다.</li>
              <li>팀원 간 연락과 역할 분담은 팀 내부에서 명확히 합의해야 합니다.</li>
              <li>운영 정책 위반 시 팀 참여가 제한될 수 있습니다.</li>
            </ul>
            <button type="button" onClick={handleConfirmNotice}>
              Confirm
            </button>
            <button type="button" onClick={handleCloseNotice} style={{ marginLeft: 8 }}>
              Cancel
            </button>
          </div>
        </div>
      ) : null}
    </section>
  )
}
