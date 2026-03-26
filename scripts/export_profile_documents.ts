import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  buildTeamProfileText,
  buildUserProfileText,
  type HackathonForProfileText,
} from '../src/utils/profileText.js'

type ProfileSlots = {
  role: string[]
  skills: string[]
  personality: string[]
  context: string[]
}

type ProfileMetadata = {
  source_id: string
  type: 'user' | 'team'
  hackathon_slug: string | null
  is_hackathon_linked: boolean
  is_open: boolean | null
  current_team_id: string | null
}

type ProfileDocument = ProfileMetadata & {
  profile: ProfileSlots
  content: string
}

type RawParticipation = {
  hackathonSlug?: unknown
  teamCode?: unknown
  isLeader?: unknown
  status?: unknown
}

type RawUser = {
  userId?: unknown
  skills?: unknown
  techStack?: unknown
  preferredRoles?: unknown
  personalityTags?: unknown
  participations?: unknown
}

type RawTeamMember = {
  role?: unknown
}

type RawTeam = {
  teamCode?: unknown
  hackathonSlug?: unknown
  lookingFor?: unknown
  requiredSkills?: unknown
  preferredPersonality?: unknown
  intro?: unknown
  tags?: unknown
  isOpen?: unknown
  memberCount?: unknown
  maxMembers?: unknown
  members?: unknown
}

type RawHackathon = {
  slug?: unknown
  title?: unknown
  tags?: unknown
  requiredSkills?: unknown
  type?: unknown
}

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const projectRoot = process.cwd()
const outputPath = path.join(projectRoot, 'tmp', 'profile_documents.json')

const ensureString = (value: unknown): string | null => {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

const toStringArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) {
    return []
  }

  return value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter(Boolean)
}

const dedupe = (values: string[]): string[] => {
  return Array.from(new Set(values))
}

const formatList = (values: string[]): string => {
  return values.length > 0 ? values.join(', ') : 'none'
}

const createHackathonMap = (hackathons: HackathonForProfileText[]) => {
  return new Map(hackathons.map((hackathon) => [hackathon.slug, hackathon]))
}

const buildHackathons = (rawHackathons: RawHackathon[]): HackathonForProfileText[] => {
  const hackathons: HackathonForProfileText[] = []

  for (const item of rawHackathons) {
    const slug = ensureString(item.slug)
    if (!slug) {
      continue
    }

    const tags = toStringArray(item.tags)
    const summaryKeywords = dedupe([
      ...toStringArray(item.requiredSkills),
      ...tags,
      ...[ensureString(item.type)].filter((value): value is string => value !== null),
    ])

    hackathons.push({
      slug,
      title: ensureString(item.title) ?? slug,
      tags,
      summaryKeywords,
    })
  }

  return hackathons
}

const buildUserProfile = (
  user: RawUser,
  hackathonMap: Map<string, HackathonForProfileText>,
): ProfileDocument | null => {
  const sourceId = ensureString(user.userId)
  if (!sourceId) {
    return null
  }

  const participations = Array.isArray(user.participations)
    ? (user.participations as RawParticipation[])
    : []
  const validParticipations = participations.filter((item) => ensureString(item.hackathonSlug) && ensureString(item.teamCode))
  const recentParticipations = validParticipations.slice(-3)
  const totalCount = validParticipations.length
  const leaderCount = validParticipations.filter((item) => Boolean(item.isLeader)).length
  const currentParticipation = [...validParticipations]
    .reverse()
    .find((item) => ensureString(item.status)?.toLowerCase() === 'ongoing')

  const recentHackathons = recentParticipations
    .map((item) => {
      const slug = ensureString(item.hackathonSlug)
      if (!slug) {
        return null
      }
      return hackathonMap.get(slug)?.title ?? slug
    })
    .filter((item): item is string => Boolean(item))

  const recentHackathonTags = recentParticipations.flatMap((item) => {
    const slug = ensureString(item.hackathonSlug)
    return slug ? hackathonMap.get(slug)?.tags ?? [] : []
  })

  const profile: ProfileSlots = {
    role: toStringArray(user.preferredRoles),
    skills: toStringArray(user.techStack ?? user.skills),
    personality: toStringArray(user.personalityTags),
    context: [
      `leader_exp=${totalCount > 0 ? `${leaderCount}/${totalCount}` : 'none'}`,
      `recent_hackathons=${formatList(dedupe(recentHackathons))}`,
      `recent_hackathon_tags=${formatList(dedupe(recentHackathonTags))}`,
    ],
  }

  const hackathonSlug = ensureString(currentParticipation?.hackathonSlug) ?? null
  const currentTeamId = ensureString(currentParticipation?.teamCode) ?? null

  return {
    source_id: sourceId,
    type: 'user',
    hackathon_slug: hackathonSlug,
    is_hackathon_linked: hackathonSlug !== null,
    is_open: null,
    current_team_id: currentTeamId,
    profile,
    content: buildUserProfileText(
      {
        preferredRoles: profile.role,
        techStack: profile.skills,
        personalityTags: profile.personality,
        participations: validParticipations.map((item) => ({
          hackathonSlug: ensureString(item.hackathonSlug) ?? undefined,
          isLeader: Boolean(item.isLeader),
        })),
      },
      {
        hackathons: Array.from(hackathonMap.values()),
      },
    ),
  }
}

const buildTeamProfile = (
  team: RawTeam,
  hackathonMap: Map<string, HackathonForProfileText>,
): ProfileDocument | null => {
  const sourceId = ensureString(team.teamCode)
  if (!sourceId) {
    return null
  }

  const hackathonSlug = ensureString(team.hackathonSlug) ?? null
  const members = Array.isArray(team.members) ? (team.members as RawTeamMember[]) : []
  const memberRoles = members
    .map((member) => ensureString(member.role))
    .filter((value): value is string => value !== null)

  const linkedHackathon = hackathonSlug ? hackathonMap.get(hackathonSlug) : undefined
  const memberCount = typeof team.memberCount === 'number' ? team.memberCount : 0
  const maxMembers = typeof team.maxMembers === 'number' ? team.maxMembers : 0
  const isOpen = typeof team.isOpen === 'boolean' ? team.isOpen : null

  const profile: ProfileSlots = {
    role: dedupe([...toStringArray(team.lookingFor), ...memberRoles]),
    skills: toStringArray(team.requiredSkills),
    personality: toStringArray(team.preferredPersonality),
    context: dedupe(
      [
        ensureString(team.intro),
        ...toStringArray(team.tags),
        linkedHackathon?.title,
        ...(linkedHackathon?.tags ?? []),
        ...(linkedHackathon?.summaryKeywords ?? []),
        `recruiting=${Boolean(isOpen)}`,
        `capacity=${memberCount}/${maxMembers}`,
      ].filter((value): value is string => value !== null),
    ),
  }

  return {
    source_id: sourceId,
    type: 'team',
    hackathon_slug: hackathonSlug,
    is_hackathon_linked: hackathonSlug !== null,
    is_open: isOpen,
    current_team_id: null,
    profile,
    content: buildTeamProfileText(
      {
        lookingFor: toStringArray(team.lookingFor),
        requiredSkills: profile.skills,
        preferredPersonality: profile.personality,
        isOpen: isOpen ?? undefined,
        memberCount,
        maxMembers,
        hackathonSlug: hackathonSlug ?? undefined,
      },
      {
        hackathons: Array.from(hackathonMap.values()),
      },
    ),
  }
}

async function main() {
  const [usersRaw, teamsRaw, hackathonsRaw] = await Promise.all([
    readFile(path.join(projectRoot, 'src', 'data', 'user_dummy_data.json'), 'utf-8'),
    readFile(path.join(projectRoot, 'src', 'data', 'team_dummy_data.json'), 'utf-8'),
    readFile(path.join(projectRoot, 'src', 'data', 'hackathon_dummy_data.json'), 'utf-8'),
  ])

  const rawUsers = JSON.parse(usersRaw) as RawUser[]
  const rawTeams = JSON.parse(teamsRaw) as RawTeam[]
  const rawHackathons = JSON.parse(hackathonsRaw) as RawHackathon[]

  const hackathons = buildHackathons(rawHackathons)
  const hackathonMap = createHackathonMap(hackathons)

  const documents = [
    ...rawUsers.map((user) => buildUserProfile(user, hackathonMap)),
    ...rawTeams.map((team) => buildTeamProfile(team, hackathonMap)),
  ].filter((item): item is ProfileDocument => item !== null)

  await mkdir(path.dirname(outputPath), { recursive: true })
  await writeFile(outputPath, JSON.stringify(documents, null, 2), 'utf-8')

  console.log(`Exported ${documents.length} profile documents to ${outputPath}`)
}

main().catch((error) => {
  console.error('Failed to export profile documents:', error)
  process.exitCode = 1
})
