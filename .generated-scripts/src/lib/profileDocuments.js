import { buildTeamProfileText, buildUserProfileText, } from '../utils/profileText.js';
export const ensureString = (value) => {
    return typeof value === 'string' && value.trim() ? value.trim() : null;
};
export const toStringArray = (value) => {
    if (!Array.isArray(value)) {
        return [];
    }
    return value
        .filter((item) => typeof item === 'string')
        .map((item) => item.trim())
        .filter(Boolean);
};
export const dedupeStrings = (values) => {
    return Array.from(new Set(values));
};
const formatList = (values) => {
    return values.length > 0 ? values.join(', ') : 'none';
};
export const createHackathonMap = (hackathons) => {
    return new Map(hackathons.map((hackathon) => [hackathon.slug, hackathon]));
};
export const buildHackathons = (rawHackathons) => {
    const hackathons = [];
    for (const item of rawHackathons) {
        const slug = ensureString(item.slug);
        if (!slug) {
            continue;
        }
        const tags = toStringArray(item.tags);
        const summaryKeywords = dedupeStrings([
            ...toStringArray(item.requiredSkills),
            ...tags,
            ...[ensureString(item.type)].filter((value) => value !== null),
        ]);
        hackathons.push({
            slug,
            title: ensureString(item.title) ?? slug,
            tags,
            summaryKeywords,
        });
    }
    return hackathons;
};
export const buildUserProfileDocument = (user, hackathonMap) => {
    const sourceId = ensureString(user.userId);
    if (!sourceId) {
        return null;
    }
    const participations = Array.isArray(user.participations)
        ? user.participations
        : [];
    const validParticipations = participations.filter((item) => ensureString(item.hackathonSlug) && ensureString(item.teamCode));
    const recentParticipations = validParticipations.slice(-3);
    const totalCount = validParticipations.length;
    const leaderCount = validParticipations.filter((item) => Boolean(item.isLeader)).length;
    const currentParticipation = [...validParticipations]
        .reverse()
        .find((item) => ensureString(item.status)?.toLowerCase() === 'ongoing');
    const recentHackathons = recentParticipations
        .map((item) => {
        const slug = ensureString(item.hackathonSlug);
        if (!slug) {
            return null;
        }
        return hackathonMap.get(slug)?.title ?? slug;
    })
        .filter((item) => Boolean(item));
    const recentHackathonTags = recentParticipations.flatMap((item) => {
        const slug = ensureString(item.hackathonSlug);
        return slug ? hackathonMap.get(slug)?.tags ?? [] : [];
    });
    const profile = {
        role: toStringArray(user.preferredRoles),
        skills: toStringArray(user.techStack ?? user.skills),
        personality: toStringArray(user.personalityTags),
        context: [
            `leader_exp=${totalCount > 0 ? `${leaderCount}/${totalCount}` : 'none'}`,
            `recent_hackathons=${formatList(dedupeStrings(recentHackathons))}`,
            `recent_hackathon_tags=${formatList(dedupeStrings(recentHackathonTags))}`,
        ],
    };
    const hackathonSlug = ensureString(currentParticipation?.hackathonSlug) ?? null;
    const currentTeamId = ensureString(currentParticipation?.teamCode) ?? null;
    return {
        source_id: sourceId,
        type: 'user',
        hackathon_slug: hackathonSlug,
        is_hackathon_linked: hackathonSlug !== null,
        is_open: null,
        current_team_id: currentTeamId,
        profile,
        content: buildUserProfileText({
            preferredRoles: profile.role,
            techStack: profile.skills,
            personalityTags: profile.personality,
            participations: validParticipations.map((item) => ({
                hackathonSlug: ensureString(item.hackathonSlug) ?? undefined,
                isLeader: Boolean(item.isLeader),
            })),
        }, {
            hackathons: Array.from(hackathonMap.values()),
        }),
    };
};
export const buildTeamProfileDocument = (team, hackathonMap) => {
    const sourceId = ensureString(team.teamCode);
    if (!sourceId) {
        return null;
    }
    const hackathonSlug = ensureString(team.hackathonSlug) ?? null;
    const members = Array.isArray(team.members) ? team.members : [];
    const memberRoles = members
        .map((member) => ensureString(member.role))
        .filter((value) => value !== null);
    const linkedHackathon = hackathonSlug ? hackathonMap.get(hackathonSlug) : undefined;
    const memberCount = typeof team.memberCount === 'number' ? team.memberCount : 0;
    const maxMembers = typeof team.maxMembers === 'number' ? team.maxMembers : 0;
    const isOpen = typeof team.isOpen === 'boolean' ? team.isOpen : null;
    const profile = {
        role: dedupeStrings([...toStringArray(team.lookingFor), ...memberRoles]),
        skills: toStringArray(team.requiredSkills),
        personality: toStringArray(team.preferredPersonality),
        context: dedupeStrings([
            ensureString(team.intro),
            ...toStringArray(team.tags),
            linkedHackathon?.title,
            ...(linkedHackathon?.tags ?? []),
            ...(linkedHackathon?.summaryKeywords ?? []),
            `recruiting=${Boolean(isOpen)}`,
            `capacity=${memberCount}/${maxMembers}`,
        ].filter((value) => value !== null)),
    };
    return {
        source_id: sourceId,
        type: 'team',
        hackathon_slug: hackathonSlug,
        is_hackathon_linked: hackathonSlug !== null,
        is_open: isOpen,
        current_team_id: null,
        profile,
        content: buildTeamProfileText({
            lookingFor: toStringArray(team.lookingFor),
            requiredSkills: profile.skills,
            preferredPersonality: profile.personality,
            isOpen: isOpen ?? undefined,
            memberCount,
            maxMembers,
            hackathonSlug: hackathonSlug ?? undefined,
        }, {
            hackathons: Array.from(hackathonMap.values()),
        }),
    };
};
