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
    <section>
      <h2>Eval</h2>
      {evalSection.metricName ? (
        <p>
          <strong>Metric:</strong> {evalSection.metricName}
        </p>
      ) : null}
      {evalSection.description ? <p>{evalSection.description}</p> : null}
      {evalSection.scoreSource ? (
        <p>
          <strong>Score Source:</strong> {evalSection.scoreSource}
        </p>
      ) : null}

      {typeof evalSection.limits?.maxRuntimeSec === 'number' ? (
        <p>
          <strong>Max Runtime:</strong> {evalSection.limits.maxRuntimeSec}s
        </p>
      ) : null}
      {typeof evalSection.limits?.maxSubmissionsPerDay === 'number' ? (
        <p>
          <strong>Max Submissions / Day:</strong> {evalSection.limits.maxSubmissionsPerDay}
        </p>
      ) : null}

      {breakdown.length > 0 ? (
        <div>
          <h3>{evalSection.scoreDisplay?.label ?? 'Score Breakdown'}</h3>
          <ul>
            {breakdown.map((item) => (
              <li key={item.key}>
                {(item.label ?? item.key)}: {item.weightPercent}%
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  )
}
