import { useMemo } from 'react'
import { getHackathonDetailBySlug } from '../lib/hackathonDetailData'

type OverviewProps = {
  hackathonSlug: string
}

type OverviewSection = {
  summary?: string
  teamPolicy?: {
    allowSolo?: boolean
    maxTeamSize?: number
  }
}

function getOverviewSectionBySlug(slug: string): OverviewSection | null {
  const detail = getHackathonDetailBySlug(slug) as
    | { sections?: { overview?: OverviewSection } }
    | null
  return detail?.sections?.overview ?? null
}

export default function Overview({ hackathonSlug }: OverviewProps) {
  const overview = useMemo(() => getOverviewSectionBySlug(hackathonSlug), [hackathonSlug])

  if (!overview) {
    return (
      <section>
        <h2 className="text-2xl font-bold text-gray-900">Overview</h2>
        <p className="mt-4 text-gray-600">해커톤 설명 정보가 없습니다.</p>
      </section>
    )
  }

  return (
    <section className="space-y-8">
      <div className="rounded-[28px] border border-sky-100 bg-gradient-to-br from-sky-50 via-white to-cyan-50 p-6 sm:p-8">
        <p className="text-xs font-black uppercase tracking-[0.25em] text-sky-600/70">Hackathon Brief</p>
        <h2 className="mt-3 text-3xl font-black tracking-tight text-slate-900">Overview</h2>
        {overview.summary ? (
          <p className="mt-5 max-w-4xl whitespace-pre-line text-[15px] font-semibold leading-8 text-slate-700 sm:text-base">
            {overview.summary}
          </p>
        ) : (
          <p className="mt-5 text-slate-600">해커톤 설명 정보가 없습니다.</p>
        )}
      </div>

      {overview.teamPolicy ? (
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-3xl border border-emerald-100 bg-emerald-50/70 p-6">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-emerald-600/70">Participation</p>
            <h3 className="mt-3 text-lg font-black text-slate-900">개인 참가</h3>
            <p className="mt-2 text-sm leading-6 text-slate-700">
              {overview.teamPolicy.allowSolo
                ? '개인 참가가 가능하며, 필요 시 이후 팀을 구성할 수 있습니다.'
                : '개인 참가 없이 팀 단위로만 참여할 수 있습니다.'}
            </p>
            <p className="mt-4 text-2xl font-black text-slate-900">
              {overview.teamPolicy.allowSolo ? '가능' : '불가'}
            </p>
          </div>

          <div className="rounded-3xl border border-violet-100 bg-violet-50/70 p-6">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-violet-600/70">Team Size</p>
            <h3 className="mt-3 text-lg font-black text-slate-900">팀 구성 제한</h3>
            <p className="mt-2 text-sm leading-6 text-slate-700">
              팀을 운영할 경우 아래 인원 수 제한 안에서 구성해야 합니다.
            </p>
            <p className="mt-4 text-2xl font-black text-slate-900">
              {typeof overview.teamPolicy.maxTeamSize === 'number'
                ? `최대 ${overview.teamPolicy.maxTeamSize}명`
                : '정보 없음'}
            </p>
          </div>
        </div>
      ) : null}
    </section>
  )
}
