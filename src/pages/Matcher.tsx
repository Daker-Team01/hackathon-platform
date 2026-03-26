import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRightLeft, ArrowUpRight, Bot, Sparkles, Users, UserRound } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { supabase } from '@/lib/supabase'
import { useLog } from '@/contexts/LogContext'
import teamsData from '../data/team_dummy_data.json'
import usersData from '../data/user_dummy_data.json'

type DocType = 'user' | 'team'
type FilterValue = 'all' | string

type ProfileSlots = {
  role?: string[]
  skills?: string[]
  personality?: string[]
  context?: string[]
}

type ProfileDocument = {
  id: string
  source_id: string
  type: DocType
  hackathon_slug: string | null
  is_hackathon_linked: boolean
  is_open: boolean | null
  current_team_id: string | null
  profile: ProfileSlots | null
  content: string
  embedding: string | number[]
}

type MatchResult = Omit<ProfileDocument, 'embedding'> & {
  similarity: number
}

type RawUser = (typeof usersData)[number]
type RawTeam = (typeof teamsData)[number]

const sourceTypeOptions: Array<{ value: DocType; label: string; icon: typeof Users }> = [
  { value: 'team', label: '팀 기준으로 팀원 찾기', icon: Users },
  { value: 'user', label: '팀원 기준으로 팀 찾기', icon: UserRound },
]

const formatList = (values?: string[]) => {
  if (!values || values.length === 0) return '없음'
  return values.join(', ')
}

const normalizeEmbedding = (embedding: string | number[]) => {
  if (typeof embedding === 'string') return embedding
  return `[${embedding.join(',')}]`
}

function SourceSummary({
  doc,
  userMap,
  teamMap,
}: {
  doc: ProfileDocument | MatchResult
  userMap: Map<string, RawUser>
  teamMap: Map<string, RawTeam>
}) {
  if (doc.type === 'team') {
    const team = teamMap.get(doc.source_id)
    return (
      <div className="space-y-2 text-sm text-slate-600">
        <p><span className="font-semibold text-slate-900">팀명</span> {team?.name ?? doc.source_id}</p>
        <p><span className="font-semibold text-slate-900">소개</span> {team?.intro ?? '상세 정보 없음'}</p>
        <p><span className="font-semibold text-slate-900">모집 역할</span> {formatList(team?.lookingFor)}</p>
        <p><span className="font-semibold text-slate-900">기술</span> {formatList(team?.requiredSkills)}</p>
        <p><span className="font-semibold text-slate-900">성향</span> {formatList(team?.preferredPersonality)}</p>
        <p><span className="font-semibold text-slate-900">태그</span> {formatList(team?.tags)}</p>
      </div>
    )
  }

  const user = userMap.get(doc.source_id)
  return (
    <div className="space-y-2 text-sm text-slate-600">
      <p><span className="font-semibold text-slate-900">닉네임</span> {user?.nickname ?? doc.source_id}</p>
      <p><span className="font-semibold text-slate-900">선호 역할</span> {formatList(user?.preferredRoles)}</p>
      <p><span className="font-semibold text-slate-900">기술</span> {formatList(user?.skills)}</p>
      <p><span className="font-semibold text-slate-900">성향</span> {formatList(user?.personalityTags)}</p>
      <p><span className="font-semibold text-slate-900">현재 참여 팀</span> {doc.current_team_id ?? '없음'}</p>
    </div>
  )
}

export default function Matcher() {
  const { recordEvent } = useLog()
  const userMap = useMemo(
    () => new Map(usersData.map((item) => [item.userId, item] as const)),
    [],
  )
  const teamMap = useMemo(
    () => new Map(teamsData.map((item) => [item.teamCode, item] as const)),
    [],
  )

  const [documents, setDocuments] = useState<ProfileDocument[]>([])
  const [sourceType, setSourceType] = useState<DocType>('team')
  const [selectedSourceId, setSelectedSourceId] = useState('')
  const [hackathonFilter, setHackathonFilter] = useState<FilterValue>('all')
  const [openOnly, setOpenOnly] = useState<'all' | 'open'>('all')
  const [results, setResults] = useState<MatchResult[]>([])
  const [loadingDocs, setLoadingDocs] = useState(true)
  const [loadingMatches, setLoadingMatches] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const loadDocuments = async () => {
      setLoadingDocs(true)
      setError(null)
      const { data, error: fetchError } = await supabase
        .from('profile_documents')
        .select('id, source_id, type, hackathon_slug, is_hackathon_linked, is_open, current_team_id, profile, content, embedding')
        .order('type')
        .order('source_id')

      if (fetchError) {
        setError(fetchError.message)
        setLoadingDocs(false)
        return
      }

      setDocuments((data ?? []) as ProfileDocument[])
      setLoadingDocs(false)
    }

    void loadDocuments()
  }, [])

  const sourceDocuments = useMemo(
    () => documents.filter((doc) => doc.type === sourceType),
    [documents, sourceType],
  )

  const selectedSource = useMemo(
    () => sourceDocuments.find((doc) => doc.source_id === selectedSourceId) ?? null,
    [selectedSourceId, sourceDocuments],
  )

  const targetType: DocType = sourceType === 'team' ? 'user' : 'team'

  const availableHackathons = useMemo(
    () =>
      Array.from(
        new Set(
          documents
            .map((doc) => doc.hackathon_slug)
            .filter((slug): slug is string => Boolean(slug)),
        ),
      ).sort(),
    [documents],
  )

  useEffect(() => {
    if (sourceDocuments.length === 0) {
      setSelectedSourceId('')
      return
    }

    if (!sourceDocuments.some((doc) => doc.source_id === selectedSourceId)) {
      const firstSourceId = sourceDocuments[0].source_id
      setSelectedSourceId(firstSourceId)
      recordEvent('matcher_profile_select', sourceType, firstSourceId, { actionType: 'autoSelect' })
    }
  }, [selectedSourceId, sourceDocuments, sourceType, recordEvent])

  const runMatch = async () => {
    if (!selectedSource) return

    setLoadingMatches(true)
    setError(null)

    const { data, error: rpcError } = await supabase.rpc('match_profile_documents', {
      query_embedding: normalizeEmbedding(selectedSource.embedding),
      match_count: 6,
      filter_type: targetType,
      filter_hackathon_slug: hackathonFilter === 'all' ? null : hackathonFilter,
      filter_is_open: targetType === 'team' && openOnly === 'open' ? true : null,
      exclude_source_id: selectedSource.source_id,
    })

    if (rpcError) {
      setError(rpcError.message)
      setResults([])
      setLoadingMatches(false)
      return
    }

    setResults((data ?? []) as MatchResult[])
    setLoadingMatches(false)
  }

  useEffect(() => {
    if (!selectedSource) return
    void runMatch()
  }, [selectedSourceId, sourceType, hackathonFilter, openOnly])

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
      <section className="mb-10 rounded-[2rem] border border-white/60 bg-white/80 p-8 shadow-[0_24px_80px_rgba(14,165,233,0.12)] backdrop-blur-xl">
        <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-[#3B82F6]/15 bg-[#3B82F6]/5 px-4 py-2 text-sm font-semibold text-[#2563EB]">
              <Sparkles className="h-4 w-4" />
              AI 매칭 랩
            </div>
            <h1 className="text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl">
              팀과 팀원을 더 자연스럽게 연결해보세요
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600 sm:text-lg">
              선택한 프로필을 기준으로 잘 맞는 팀 또는 팀원을 바로 비교해볼 수 있는 테스트 공간입니다.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Button asChild className="rounded-xl bg-gradient-to-r from-[#3B82F6] to-[#0EA5E9] px-5 text-white shadow-lg hover:opacity-95">
              <Link to="/">
                메인으로
                <ArrowUpRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button variant="outline" onClick={() => void runMatch()} className="rounded-xl border-[#3B82F6]/20 bg-white/90 text-slate-700">
              결과 새로보기
              <ArrowRightLeft className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </section>

      <div className="grid gap-8 lg:grid-cols-[340px_minmax(0,1fr)]">
        <Card className="border border-slate-200/80 bg-white p-7 shadow-[0_18px_50px_rgba(15,23,42,0.08)]">
          <div className="mb-6 flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-[#3B82F6] to-[#0EA5E9] text-white">
              <Bot className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900">매칭 설정</h2>
              <p className="text-sm text-slate-500">기준과 필터를 편하게 조정하세요</p>
            </div>
          </div>

          <div className="space-y-5">
            <div>
              <p className="mb-2 text-sm font-semibold text-slate-700">모드</p>
              <div className="grid gap-2">
                {sourceTypeOptions.map((option) => {
                  const active = option.value === sourceType
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => {
                        setSourceType(option.value)
                        recordEvent('matcher_filter', option.value === 'team' ? 'team' : 'user', option.value, { filterType: 'sourceType', filterValue: option.value })
                      }}
                      className={`flex items-center gap-3 rounded-2xl border px-4 py-3 text-left transition-all ${active ? 'border-[#3B82F6]/30 bg-[#3B82F6]/8 shadow-sm' : 'border-slate-200 bg-white hover:border-[#3B82F6]/20 hover:bg-slate-50'}`}
                    >
                      <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${active ? 'bg-gradient-to-br from-[#3B82F6] to-[#0EA5E9] text-white' : 'bg-slate-100 text-slate-500'}`}>
                        <option.icon className="h-5 w-5" />
                      </div>
                      <div>
                        <div className="font-semibold text-slate-900">{option.label}</div>
                        <div className="text-xs text-slate-500">{option.value === 'team' ? '팀 기준 추천' : '팀원 기준 추천'}</div>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>

            <div>
              <p className="mb-2 text-sm font-semibold text-slate-700">선택한 프로필</p>
              <select
                value={selectedSourceId}
                onChange={(event) => {
                  const newSourceId = event.target.value
                  setSelectedSourceId(newSourceId)
                  recordEvent('matcher_profile_select', sourceType, newSourceId, { actionType: 'profileSelect' })
                }}
                className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-[#3B82F6]/40 focus:ring-4 focus:ring-[#3B82F6]/10"
              >
                {sourceDocuments.map((doc) => {
                  const label = doc.type === 'team'
                    ? teamMap.get(doc.source_id)?.name ?? doc.source_id
                    : userMap.get(doc.source_id)?.nickname ?? doc.source_id
                  return (
                    <option key={doc.source_id} value={doc.source_id}>
                      {label} ({doc.source_id})
                    </option>
                  )
                })}
              </select>
            </div>

            <div>
              <p className="mb-2 text-sm font-semibold text-slate-700">해커톤 필터</p>
              <select
                value={hackathonFilter}
                onChange={(event) => {
                  const newFilter = event.target.value as FilterValue
                  setHackathonFilter(newFilter)
                  recordEvent('matcher_filter', sourceType, newFilter, { filterType: 'hackathon', filterValue: newFilter })
                }}
                className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-[#3B82F6]/40 focus:ring-4 focus:ring-[#3B82F6]/10"
              >
                <option value="all">전체</option>
                {availableHackathons.map((slug) => (
                  <option key={slug} value={slug}>
                    {slug}
                  </option>
                ))}
              </select>
            </div>

            {targetType === 'team' && (
              <div>
                <p className="mb-2 text-sm font-semibold text-slate-700">모집 상태</p>
                <select
                  value={openOnly}
                  onChange={(event) => {
                    const newFilter = event.target.value as 'all' | 'open'
                    setOpenOnly(newFilter)
                    recordEvent('matcher_filter', sourceType, newFilter, { filterType: 'openOnly', filterValue: newFilter })
                  }}
                  className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-[#3B82F6]/40 focus:ring-4 focus:ring-[#3B82F6]/10"
                >
                  <option value="all">전체</option>
                  <option value="open">모집중만</option>
                </select>
              </div>
            )}

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
              <p className="font-semibold text-slate-900">현재 보기</p>
              <p className="mt-1">{targetType === 'team' ? '추천 팀' : '추천 팀원'}을 잘 맞는 순으로 보여줍니다.</p>
            </div>
          </div>
        </Card>

        <div className="space-y-8">
          <Card className="border border-slate-200/80 bg-white p-7 shadow-[0_18px_50px_rgba(15,23,42,0.08)]">
            <div className="mb-4 flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#3B82F6]">선택한 프로필</p>
                <h2 className="text-2xl font-bold text-slate-900">선택한 프로필</h2>
              </div>
              {selectedSource && (
                <Badge className="rounded-full bg-[#3B82F6]/10 px-3 py-1 text-[#2563EB] hover:bg-[#3B82F6]/10">
                  {selectedSource.type === 'team' ? '팀' : '팀원'} · {selectedSource.source_id}
                </Badge>
              )}
            </div>

            {loadingDocs ? (
              <p className="text-sm text-slate-500">추천 데이터를 불러오는 중입니다.</p>
            ) : selectedSource ? (
              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-6">
                <div className="mb-4 flex flex-wrap items-center gap-2">
                  <Badge className="rounded-full bg-white px-3 py-1 text-slate-600 hover:bg-white">
                    {selectedSource.source_id}
                  </Badge>
                  {selectedSource.hackathon_slug && (
                    <Badge className="rounded-full bg-[#EAF6FF] px-3 py-1 text-[#2563EB] hover:bg-[#EAF6FF]">
                      {selectedSource.hackathon_slug}
                    </Badge>
                  )}
                  {selectedSource.type === 'team' && selectedSource.is_open !== null && (
                    <Badge className={`rounded-full px-3 py-1 hover:bg-transparent ${selectedSource.is_open ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-200 text-slate-600'}`}>
                      {selectedSource.is_open ? '모집중' : '모집 마감'}
                    </Badge>
                  )}
                </div>
                <SourceSummary doc={selectedSource} userMap={userMap} teamMap={teamMap} />
              </div>
            ) : (
              <p className="text-sm text-slate-500">왼쪽에서 기준이 될 프로필을 골라주세요.</p>
            )}
          </Card>

          <Card className="border border-slate-200/80 bg-white p-7 shadow-[0_18px_50px_rgba(15,23,42,0.08)]">
            <div className="mb-6 flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#0EA5E9]">추천 결과</p>
                <h2 className="text-2xl font-bold text-slate-900">추천 리스트</h2>
              </div>
              <Badge className="rounded-full bg-slate-100 px-3 py-1 text-slate-600 hover:bg-slate-100">
                {loadingMatches ? '계산 중' : `${results.length}개 결과`}
              </Badge>
            </div>

            {error && (
              <div className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600">
                {error}
              </div>
            )}

            <div className="space-y-4">
              {results.map((result) => (
                <div key={`${result.type}-${result.source_id}`} className="rounded-[1.5rem] border border-slate-200 bg-slate-50/70 p-5 transition-all hover:border-[#3B82F6]/25 hover:bg-white">
                  <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-lg font-bold text-slate-900">
                          {result.type === 'team'
                            ? teamMap.get(result.source_id)?.name ?? result.source_id
                            : userMap.get(result.source_id)?.nickname ?? result.source_id}
                        </h3>
                        <Badge className="rounded-full bg-white px-3 py-1 text-slate-500 hover:bg-white">
                          {result.source_id}
                        </Badge>
                      </div>
                      <p className="mt-2 text-sm leading-6 text-slate-500">{result.type === 'team' ? '조건에 잘 맞는 팀입니다.' : '조건에 잘 맞는 팀원입니다.'}</p>
                    </div>

                    <div className="rounded-2xl bg-gradient-to-br from-[#3B82F6] to-[#0EA5E9] px-4 py-3 text-right text-white shadow-lg">
                      <div className="text-xs uppercase tracking-[0.2em] text-white/80">매칭 점수</div>
                      <div className="text-2xl font-black">{result.similarity.toFixed(3)}</div>
                    </div>
                  </div>

                  <div className="rounded-3xl border border-white bg-white p-5">
                    <div className="mb-4 flex flex-wrap items-center gap-2">
                      {result.hackathon_slug && (
                        <Badge className="rounded-full bg-[#EAF6FF] px-3 py-1 text-[#2563EB] hover:bg-[#EAF6FF]">
                          {result.hackathon_slug}
                        </Badge>
                      )}
                      {result.type === 'team' && result.is_open !== null && (
                        <Badge className={`rounded-full px-3 py-1 hover:bg-transparent ${result.is_open ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-200 text-slate-600'}`}>
                          {result.is_open ? '모집중' : '모집 마감'}
                        </Badge>
                      )}
                    </div>
                    <SourceSummary doc={result} userMap={userMap} teamMap={teamMap} />
                  </div>
                </div>
              ))}

              {!loadingMatches && results.length === 0 && !error && (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-5 py-10 text-center text-sm text-slate-500">
                  현재 조건에서 추천 리스트가 없습니다.
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}
