import { useMemo } from 'react'
import { getHackathonDetailBySlug } from '../lib/hackathonDetailData'

type PrizeProps = {
  hackathonSlug: string
}

type PrizeItem = {
  place?: string
  amountKRW?: number
}

type PrizeSection = {
  items?: PrizeItem[]
}

function getPrizeSectionBySlug(slug: string): PrizeSection | null {
  const detail = getHackathonDetailBySlug(slug) as
    | { sections?: { prize?: PrizeSection } }
    | null
  return detail?.sections?.prize ?? null
}

function formatCurrency(amount?: number): string {
  if (typeof amount !== 'number') return '-'
  return new Intl.NumberFormat('ko-KR', {
    style: 'currency',
    currency: 'KRW',
    maximumFractionDigits: 0,
  }).format(amount)
}

export default function Prize({ hackathonSlug }: PrizeProps) {
  const prize = useMemo(() => getPrizeSectionBySlug(hackathonSlug), [hackathonSlug])
  const items = prize?.items ?? []

  if (!prize || items.length === 0) {
    return (
      <section>
        <h2 className="text-2xl font-bold text-gray-900">Prize</h2>
        <p className="mt-4 text-gray-600">상금 정보가 없습니다.</p>
      </section>
    )
  }

  return (
    <section>
      <div className="rounded-[28px] border border-amber-100 bg-gradient-to-br from-amber-50 via-white to-orange-50 p-6 sm:p-8">
        <p className="text-xs font-black uppercase tracking-[0.25em] text-amber-600/70">Rewards</p>
        <h2 className="mt-3 text-3xl font-black tracking-tight text-slate-900">Prize</h2>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          최종 순위에 따라 아래 상금이 지급됩니다.
        </p>
      </div>
      <div className="mt-6 grid gap-4 md:grid-cols-3">
        {items.map((item, index) => (
          <div
            key={`${item.place ?? 'prize'}-${index}`}
            className="rounded-[28px] border border-amber-100 bg-gradient-to-b from-white to-amber-50 px-5 py-6 shadow-sm"
          >
            <p className="text-[11px] font-black uppercase tracking-[0.2em] text-amber-700/70">
              Rank {index + 1}
            </p>
            <p className="mt-3 text-lg font-black text-slate-900">{item.place ?? `${index + 1}위`}</p>
            <p className="mt-2 break-words text-2xl font-black text-slate-900">{formatCurrency(item.amountKRW)}</p>
          </div>
        ))}
      </div>
    </section>
  )
}
