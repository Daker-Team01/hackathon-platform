type ProfileSlots = {
  role: string[]
  skills: string[]
  personality: string[]
  context: string[]
}

export type UserParticipationForProfile = {
  hackathonSlug?: string
  isLeader?: boolean
}

export type UserForProfileText = {
  preferredRoles?: string[]
  techStack?: string[]
  personalityTags?: string[]
  participations?: UserParticipationForProfile[]
}

export type TeamForProfileText = {
  lookingFor?: string[]
  requiredSkills?: string[]
  preferredPersonality?: string[]
  isOpen?: boolean
  memberCount?: number
  maxMembers?: number
  hackathonSlug?: string
}

export type HackathonForProfileText = {
  slug: string
  title?: string
  tags?: string[]
  summaryKeywords?: string[]
}

type BuildUserProfileTextOptions = {
  recentLimit?: number
  hackathons?: HackathonForProfileText[]
}

type BuildTeamProfileTextOptions = {
  hackathons?: HackathonForProfileText[]
}

const NONE = "none"

const dedupe = (values: string[]): string[] => {
  return Array.from(new Set(values))
}

const normalizeValue = (value: string): string => {
  return value.trim().toLowerCase().replace(/\s+/g, " ")
}

const normalizeValues = (values: string[] = []): string[] => {
  return dedupe(values.map(normalizeValue).filter(Boolean)).sort((a, b) => a.localeCompare(b))
}

const formatList = (values: string[]) => {
  return values.length > 0 ? values.join(", ") : NONE
}

const buildProfileText = (slots: ProfileSlots): string => {
  return [
    `Role: ${formatList(normalizeValues(slots.role))}`,
    `Skills: ${formatList(normalizeValues(slots.skills))}`,
    `Personality: ${formatList(normalizeValues(slots.personality))}`,
    `Context: ${formatList(slots.context.map((item) => item.trim()).filter(Boolean))}`
  ].join(" | ")
}

const createHackathonMap = (hackathons: HackathonForProfileText[] = []) => {
  return new Map(hackathons.map((hackathon) => [hackathon.slug, hackathon]))
}

export const buildUserProfileText = (
  user: UserForProfileText,
  options: BuildUserProfileTextOptions = {}
): string => {
  const recentLimit = options.recentLimit ?? 3
  const participations = Array.isArray(user.participations) ? user.participations : []
  const validParticipations = participations.filter((item) => Boolean(item.hackathonSlug))
  const recentParticipations = validParticipations.slice(-recentLimit)

  const totalCount = validParticipations.length
  const leaderCount = validParticipations.filter((item) => Boolean(item.isLeader)).length
  const leaderExp = `${leaderCount}/${totalCount}`

  const hackathonMap = createHackathonMap(options.hackathons)
  const recentHackathons = recentParticipations.map((item) => {
    const slug = item.hackathonSlug as string
    const found = hackathonMap.get(slug)
    return found?.title ? normalizeValue(found.title) : normalizeValue(slug)
  })

  const recentHackathonTags = recentParticipations.flatMap((item) => {
    const slug = item.hackathonSlug as string
    return hackathonMap.get(slug)?.tags ?? []
  })

  return buildProfileText({
    role: user.preferredRoles ?? [],
    skills: user.techStack ?? [],
    personality: user.personalityTags ?? [],
    context: [
      `leader_exp=${totalCount > 0 ? leaderExp : NONE}`,
      `recent_hackathons=${formatList(normalizeValues(recentHackathons))}`,
      `recent_hackathon_tags=${formatList(normalizeValues(recentHackathonTags))}`
    ]
  })
}

export const buildTeamProfileText = (
  team: TeamForProfileText,
  options: BuildTeamProfileTextOptions = {}
): string => {
  const hackathonMap = createHackathonMap(options.hackathons)
  const linkedHackathon = team.hackathonSlug ? hackathonMap.get(team.hackathonSlug) : undefined

  const context: string[] = [
    `recruiting=${Boolean(team.isOpen)}`,
    `capacity=${team.memberCount ?? 0}/${team.maxMembers ?? 0}`
  ]

  if (linkedHackathon) {
    context.unshift(
      `hackathon_title=${normalizeValue(linkedHackathon.title ?? linkedHackathon.slug)}`,
      `hackathon_tags=${formatList(normalizeValues(linkedHackathon.tags ?? []))}`,
      `hackathon_summary=${formatList(normalizeValues(linkedHackathon.summaryKeywords ?? []))}`
    )
  }

  return buildProfileText({
    role: team.lookingFor ?? [],
    skills: team.requiredSkills ?? [],
    personality: team.preferredPersonality ?? [],
    context
  })
}
