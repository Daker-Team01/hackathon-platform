import rawHackathonDetailData from "../data/public_hackathon_detail.json"
import { normalizedHackathons } from "./hackathonData"

type EvalBreakdownItem = {
  key: string
  label?: string
  weightPercent: number
}

type HackathonDetailItem = {
  slug: string
  title?: string
  sections?: {
    eval?: {
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
    submit?: {
      allowedArtifactTypes?: string[]
      guide?: string[]
    }
  }
}

const DEFAULT_BREAKDOWN: EvalBreakdownItem[] = [
  { key: "innovation", label: "Innovation", weightPercent: 40 },
  { key: "execution", label: "Execution", weightPercent: 35 },
  { key: "impact", label: "Impact", weightPercent: 25 },
]

function createDefaultDetail(slug: string, title: string): HackathonDetailItem {
  return {
    slug,
    title,
    sections: {
      eval: {
        metricName: "FinalScore",
        description: `${title}의 제출물을 기준 점수 체계로 평가합니다.`,
        scoreSource: "Jury + Auto Evaluation",
        limits: {
          maxRuntimeSec: 1200,
          maxSubmissionsPerDay: 5,
        },
        scoreDisplay: {
          label: "Score Breakdown",
          breakdown: DEFAULT_BREAKDOWN,
        },
      },
      submit: {
        allowedArtifactTypes: ["zip", "pdf", "url"],
        guide: [
          "제출 전 팀/아티팩트 정보를 다시 확인해 주세요.",
          "최종 제출 후 리더보드 반영까지 수 초가 소요될 수 있습니다.",
        ],
      },
    },
  }
}

function mergeDetail(defaultDetail: HackathonDetailItem, sourceDetail?: HackathonDetailItem): HackathonDetailItem {
  if (!sourceDetail) return defaultDetail

  return {
    ...defaultDetail,
    ...sourceDetail,
    sections: {
      ...defaultDetail.sections,
      ...sourceDetail.sections,
      eval: {
        ...defaultDetail.sections?.eval,
        ...sourceDetail.sections?.eval,
        scoreDisplay: {
          ...defaultDetail.sections?.eval?.scoreDisplay,
          ...sourceDetail.sections?.eval?.scoreDisplay,
          breakdown:
            sourceDetail.sections?.eval?.scoreDisplay?.breakdown ??
            defaultDetail.sections?.eval?.scoreDisplay?.breakdown,
        },
      },
      submit: {
        ...defaultDetail.sections?.submit,
        ...sourceDetail.sections?.submit,
      },
    },
  }
}

const sourceDetails = rawHackathonDetailData as HackathonDetailItem[]
const sourceBySlug = new Map(sourceDetails.map((detail) => [detail.slug, detail]))

export const normalizedHackathonDetails: HackathonDetailItem[] = normalizedHackathons.map((hackathon) => {
  const defaultDetail = createDefaultDetail(hackathon.slug, hackathon.title)
  const sourceDetail = sourceBySlug.get(hackathon.slug)
  return mergeDetail(defaultDetail, sourceDetail)
})

export function getHackathonDetailBySlug(slug: string): HackathonDetailItem | null {
  return normalizedHackathonDetails.find((detail) => detail.slug === slug) ?? null
}
