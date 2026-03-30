import { useMemo } from 'react'
import { getHackathonDetailBySlug } from '../lib/hackathonDetailData'

type EvalProps = {
  hackathonSlug: string
}

type EvalBreakdownItem = {
  key: string
  label?: string
  weightPercent: number
}

type EvalSection = {
  metricName?: string
  description?: string
  scoreSource?: string
  limits?: {
    maxRuntimeSec?: number
    maxSubmissionsPerDay?: number
  }
  scoreDisplay?: {
    label?: string
    breakdown?: EvalBreakdownItem[]
  }
}

function getEvalSectionBySlug(slug: string): EvalSection | null {
  const detail = getHackathonDetailBySlug(slug)
  return detail?.sections?.eval ?? null
}

export default function Eval({ hackathonSlug }: EvalProps) {
  const evalSection = useMemo(() => getEvalSectionBySlug(hackathonSlug), [hackathonSlug])

  if (!evalSection) {
    return (
      <section>
        <h2>Eval</h2>
        <p>평가 기준 정보가 없습니다.</p>
      </section>
    )
  }

  const breakdown = evalSection.scoreDisplay?.breakdown ?? []

  return (
    <section className="space-y-8">
      <div className="rounded-[28px] border border-blue-100 bg-gradient-to-br from-blue-50 via-white to-cyan-50 p-6 sm:p-8">
        <p className="text-xs font-black uppercase tracking-[0.25em] text-blue-600/70">Scoring System</p>
        <h2 className="mt-3 text-3xl font-black tracking-tight text-slate-900">Eval</h2>
        {evalSection.description ? (
          <p className="mt-4 max-w-4xl whitespace-pre-line text-sm font-medium leading-7 text-slate-700 sm:text-base">
            {evalSection.description}
          </p>
        ) : (
          <p className="mt-4 text-slate-600">평가 기준 정보가 없습니다.</p>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-3xl border border-sky-100 bg-sky-50/70 p-6">
          <p className="text-[11px] font-black uppercase tracking-[0.2em] text-sky-600/70">Metric</p>
          <p className="mt-3 break-words text-2xl font-black text-slate-900">
            {evalSection.metricName ?? '정보 없음'}
          </p>
        </div>

        <div className="rounded-3xl border border-indigo-100 bg-indigo-50/70 p-6">
          <p className="text-[11px] font-black uppercase tracking-[0.2em] text-indigo-600/70">Score Source</p>
          <p className="mt-3 break-words text-2xl font-black text-slate-900">
            {evalSection.scoreSource ?? '정보 없음'}
          </p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-3xl border border-slate-100 bg-slate-50/80 p-6">
          <p className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-500">Runtime Limit</p>
          <p className="mt-3 text-2xl font-black text-slate-900">
            {typeof evalSection.limits?.maxRuntimeSec === 'number'
              ? `${evalSection.limits.maxRuntimeSec}초`
              : '제한 없음'}
          </p>
        </div>

        <div className="rounded-3xl border border-slate-100 bg-slate-50/80 p-6">
          <p className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-500">Submission Limit</p>
          <p className="mt-3 text-2xl font-black text-slate-900">
            {typeof evalSection.limits?.maxSubmissionsPerDay === 'number'
              ? `일 ${evalSection.limits.maxSubmissionsPerDay}회`
              : '제한 없음'}
          </p>
        </div>
      </div>

      {breakdown.length > 0 ? (
        <div>
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-500">Weighting</p>
              <h3 className="mt-2 text-2xl font-black tracking-tight text-slate-900">
                {evalSection.scoreDisplay?.label ?? 'Score Breakdown'}
              </h3>
            </div>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {breakdown.map((item, index) => (
              <div
                key={item.key}
                className="rounded-[28px] border border-cyan-100 bg-gradient-to-br from-white to-cyan-50 px-5 py-6 shadow-sm"
              >
                <p className="text-[11px] font-black uppercase tracking-[0.2em] text-cyan-700/70">
                  Factor {index + 1}
                </p>
                <p className="mt-3 break-words text-lg font-black text-slate-900">
                  {item.label ?? item.key}
                </p>
                <p className="mt-2 text-3xl font-black tracking-tight text-slate-900">
                  {item.weightPercent}%
                </p>
              </div>
            ))}
          </div>
        </div>
      ) : null}

    </section>
  )
}
