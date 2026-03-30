import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, CheckCircle2, Vote } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'

import { useUser } from '../contexts/UserContext'
import { useTeams } from '../hooks/useTeams'
import { getVoteEligibility } from '../lib/voteEligibility'

const VOTE_STORAGE_KEY = 'hackathon_votes_v1'

type VoteRecord = {
  [hackathonSlug: string]: {
    [userId: string]: {
      teamCode: string
      teamName: string
      votedAt: string
    }
  }
}

function loadVoteRecord(): VoteRecord {
  const raw = localStorage.getItem(VOTE_STORAGE_KEY)
  if (!raw) return {}

  try {
    const parsed = JSON.parse(raw)
    if (typeof parsed === 'object' && parsed !== null) {
      return parsed as VoteRecord
    }
  } catch {
    return {}
  }

  return {}
}

function saveVoteRecord(record: VoteRecord) {
  localStorage.setItem(VOTE_STORAGE_KEY, JSON.stringify(record))
}

export default function HackathonVote() {
  const navigate = useNavigate()
  const { slug } = useParams()
  const { user } = useUser()

  const hackathonSlug = slug ?? ''
  const eligibility = useMemo(() => getVoteEligibility(hackathonSlug, user), [hackathonSlug, user])
  const { data: teams = [], isLoading: teamsLoading } = useTeams(hackathonSlug, { enabled: Boolean(hackathonSlug) })

  const initialVote = useMemo(() => {
    if (!user || !hackathonSlug) return null
    const record = loadVoteRecord()
    return record[hackathonSlug]?.[user.userId] ?? null
  }, [hackathonSlug, user])

  const [selectedTeamCode, setSelectedTeamCode] = useState<string>(initialVote?.teamCode ?? '')
  const [submittedVote, setSubmittedVote] = useState(initialVote)

  if (!hackathonSlug) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <Card className="p-8 rounded-3xl">
          <p className="text-lg font-bold text-slate-900">유효하지 않은 요청입니다.</p>
          <Button className="mt-4" variant="outline" onClick={() => navigate('/hackathons')}>
            목록으로 이동
          </Button>
        </Card>
      </div>
    )
  }

  const selectedTeam = teams.find((team) => team.teamCode === selectedTeamCode)

  const onSubmitVote = () => {
    if (!user || !eligibility.canVote || !selectedTeam) return

    const record = loadVoteRecord()
    const nextRecord: VoteRecord = {
      ...record,
      [hackathonSlug]: {
        ...(record[hackathonSlug] ?? {}),
        [user.userId]: {
          teamCode: selectedTeam.teamCode,
          teamName: selectedTeam.name,
          votedAt: new Date().toISOString()
        }
      }
    }

    saveVoteRecord(nextRecord)
    setSubmittedVote(nextRecord[hackathonSlug][user.userId])
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      <Button variant="ghost" className="-ml-2" onClick={() => navigate(`/hackathons/${hackathonSlug}`)}>
        <ArrowLeft className="w-4 h-4 mr-2" />
        해커톤 상세로 돌아가기
      </Button>

      <Card className="p-8 rounded-3xl border border-blue-100 bg-gradient-to-br from-blue-50 via-white to-cyan-50">
        <div className="flex items-center gap-3">
          <Vote className="w-6 h-6 text-blue-600" />
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900">해커톤 투표</h1>
        </div>
        <p className="mt-3 text-sm sm:text-base text-slate-700">
          투표는 해커톤 참여자만 가능하며, 제출 마감 이후부터 대회 종료 전까지 열립니다.
        </p>
      </Card>

      {!eligibility.canVote ? (
        <Card className="p-8 rounded-3xl border border-rose-100 bg-rose-50/50">
          <h2 className="text-xl font-black text-slate-900">현재 투표할 수 없습니다.</h2>
          <ul className="mt-4 space-y-2 text-sm text-slate-700 list-disc pl-5">
            {eligibility.reasons.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
        </Card>
      ) : (
        <Card className="p-8 rounded-3xl">
          {submittedVote ? (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
              <div className="flex items-center gap-2 text-emerald-700 font-bold">
                <CheckCircle2 className="w-5 h-5" />
                투표가 완료되었습니다.
              </div>
              <p className="mt-2 text-slate-700">선택 팀: {submittedVote.teamName}</p>
              <p className="mt-1 text-xs text-slate-500">투표 시각: {new Date(submittedVote.votedAt).toLocaleString('ko-KR')}</p>
            </div>
          ) : null}

          <div className="mt-6 space-y-3">
            <h2 className="text-xl font-black text-slate-900">투표 대상 팀</h2>
            {teamsLoading ? <p className="text-slate-600">팀 목록을 불러오는 중입니다...</p> : null}
            {!teamsLoading && teams.length === 0 ? (
              <p className="text-slate-600">현재 투표 가능한 팀이 없습니다.</p>
            ) : null}

            {!teamsLoading && teams.length > 0 ? (
              <div className="space-y-3">
                {teams.map((team) => (
                  <label
                    key={team.teamCode}
                    className={`block rounded-2xl border p-4 cursor-pointer transition-colors ${
                      selectedTeamCode === team.teamCode
                        ? 'border-blue-300 bg-blue-50'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <input
                        type="radio"
                        name="vote-team"
                        value={team.teamCode}
                        checked={selectedTeamCode === team.teamCode}
                        onChange={() => setSelectedTeamCode(team.teamCode)}
                        disabled={Boolean(submittedVote)}
                        className="mt-1"
                      />
                      <div>
                        <p className="font-bold text-slate-900">{team.name}</p>
                        <p className="mt-1 text-sm text-slate-600">팀 코드: {team.teamCode}</p>
                        <p className="mt-1 text-sm text-slate-600">현재 인원: {team.memberCount} / {team.maxMembers}</p>
                      </div>
                    </div>
                  </label>
                ))}
              </div>
            ) : null}
          </div>

          <Button
            className="mt-6"
            onClick={onSubmitVote}
            disabled={!selectedTeamCode || Boolean(submittedVote) || teams.length === 0}
          >
            투표 제출
          </Button>
        </Card>
      )}
    </div>
  )
}
