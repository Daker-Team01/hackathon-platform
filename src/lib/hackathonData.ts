import rawHackathonData from "../data/hackathon_dummy_v4.json"
import type { Hackathon } from "../types/hackathon"

type RawHackathon = (typeof rawHackathonData)[number]

export const HACKATHON_DATA_VERSION = "2026-03-31-dummy-v4-hack3-vote-open"

function normalizeStatus(status: string): string {
  if (status === "ongoing" || status === "upcoming" || status === "ended") {
    return status
  }
  return "upcoming"
}

function buildLinks(slug: string) {
  return {
    detail: `/hackathons/${slug}`,
    rules: `https://example.com/hackathons/${slug}/rules`,
    faq: `https://example.com/hackathons/${slug}/faq`,
  }
}

export function normalizeHackathon(item: RawHackathon): Hackathon {
  const slug = item.slug
  const organization = item.host?.organization?.trim()

  return {
    slug,
    title: item.title,
    status: normalizeStatus(item.status),
    tags: Array.isArray(item.tags) ? item.tags : [],
    thumbnailUrl: item.host?.logoUrl || "",
    location: organization || "온라인/오프라인",
    period: {
      timezone: "Asia/Seoul",
      submissionDeadlineAt: item.period?.submissionDeadlineAt || "",
      endAt: item.period?.endAt || "",
    },
    stats: {
      participantCount: item.stats?.participantCount,
      teamCount: item.stats?.teamCount,
      submissionCount: item.stats?.submissionCount,
    },
    prize: {
      totalKRW: item.prize?.totalKRW,
    },
    links: buildLinks(slug),
  }
}

export function normalizeHackathons(data: RawHackathon[] = rawHackathonData): Hackathon[] {
  return data.map((item) => normalizeHackathon(item))
}

export const normalizedHackathons: Hackathon[] = normalizeHackathons()
