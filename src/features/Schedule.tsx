import { useMemo } from 'react'
import { getHackathonDetailBySlug } from '../lib/hackathonDetailData'
import { normalizedHackathons } from '../lib/hackathonData'

type ScheduleProps = {
  hackathonSlug: string
}

type Milestone = {
  name?: string
  at?: string
}

type ScheduleSection = {
  timezone?: string
  milestones?: Milestone[]
}

type HackathonPeriod = {
  submissionDeadlineAt?: string
  endAt?: string
}

function getScheduleSectionBySlug(slug: string): ScheduleSection | null {
  const detail = getHackathonDetailBySlug(slug) as
    | { sections?: { schedule?: ScheduleSection } }
    | null
  return detail?.sections?.schedule ?? null
}

function getHackathonPeriodBySlug(slug: string): HackathonPeriod | null {
  const hackathon = normalizedHackathons.find((item) => item.slug === slug)
  return hackathon?.period ?? null
}

function syncMilestonesWithPeriod(milestones: Milestone[], period: HackathonPeriod | null): Milestone[] {
  if (!period) return milestones

  const endTime = Date.parse(period.endAt ?? '')
  const resultAnnouncementAt =
    Number.isFinite(endTime) ? new Date(endTime + 7 * 24 * 60 * 60 * 1000).toISOString() : null

  return milestones.map((item) => {
    if (item.name?.includes('제출 마감') && period.submissionDeadlineAt) {
      return { ...item, at: period.submissionDeadlineAt }
    }

    if (item.name?.includes('대회 종료') && period.endAt) {
      return { ...item, at: period.endAt }
    }

    if (item.name?.includes('결과 발표') && resultAnnouncementAt) {
      return { ...item, at: resultAnnouncementAt }
    }

    return item
  })
}

function formatDate(value?: string): string {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString('ko-KR')
}

export default function Schedule({ hackathonSlug }: ScheduleProps) {
  const schedule = useMemo(() => getScheduleSectionBySlug(hackathonSlug), [hackathonSlug])
  const period = useMemo(() => getHackathonPeriodBySlug(hackathonSlug), [hackathonSlug])
  const milestones = useMemo(
    () => syncMilestonesWithPeriod(schedule?.milestones ?? [], period),
    [period, schedule]
  )

  if (!schedule || milestones.length === 0) {
    return (
      <section>
        <h2 className="text-2xl font-bold text-gray-900">Schedule</h2>
        <p className="mt-4 text-gray-600">일정 정보가 없습니다.</p>
      </section>
    )
  }

  return (
    <section>
      <div className="rounded-[28px] border border-slate-100 bg-gradient-to-br from-white via-slate-50 to-sky-50 p-6 sm:p-8">
        <p className="text-xs font-black uppercase tracking-[0.25em] text-slate-500">Timeline</p>
        <h2 className="mt-3 text-3xl font-black tracking-tight text-slate-900">Schedule</h2>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
          각 단계를 따라 진행되는 일정 흐름입니다. 준비부터 제출, 결과 발표까지 한눈에 확인할 수 있습니다.
        </p>
        {schedule.timezone ? (
          <p className="mt-3 text-sm text-gray-500">Timezone: {schedule.timezone}</p>
        ) : null}
      </div>

      <div className="relative mt-8 pl-4 sm:pl-6">
        <div className="absolute left-[11px] top-2 bottom-2 w-px bg-gradient-to-b from-sky-300 via-cyan-400 to-slate-200 sm:left-[15px]" />

        {milestones.map((item, index) => (
          <div
            key={`${item.name ?? 'milestone'}-${index}`}
            className="relative mb-5 pl-7 sm:pl-10"
          >
            <div className="absolute left-0 top-4 flex h-6 w-6 items-center justify-center rounded-full border-4 border-white bg-gradient-to-br from-sky-500 to-cyan-500 shadow-md sm:h-8 sm:w-8" />
            <div className="rounded-[28px] border border-slate-100 bg-white px-5 py-5 shadow-sm transition-shadow hover:shadow-md">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <p className="text-[11px] font-black uppercase tracking-[0.2em] text-sky-600/70">
                    Step {index + 1}
                  </p>
                  <p className="mt-2 text-base font-bold leading-6 text-slate-900 break-words">
                    {item.name ?? `일정 ${index + 1}`}
                  </p>
                </div>
                <div className="shrink-0 rounded-2xl bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-600">
                  {formatDate(item.at)}
                </div>
              </div>

              {index < milestones.length - 1 ? (
                <div className="mt-4 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-slate-400">
                  <span className="inline-block h-px flex-1 bg-gradient-to-r from-sky-200 to-slate-200" />
                  Next
                </div>
              ) : (
                <div className="mt-4 text-xs font-bold uppercase tracking-[0.16em] text-emerald-500">
                  Final Step
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
