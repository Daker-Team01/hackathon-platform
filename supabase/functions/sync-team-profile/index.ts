import { createClient } from 'npm:@supabase/supabase-js@2'

type TeamSyncAction = 'upsert' | 'delete'

type TeamMember = {
  role?: unknown
}

type TeamRow = {
  team_code: string
  intro: string | null
  members: TeamMember[] | null
  is_open: boolean | null
  max_members: number | null
  member_count: number | null
  looking_for: string[] | null
  required_skills: string[] | null
  preferred_personality: string[] | null
  tags: string[] | null
  hackathon_slug: string | null
}

type TeamProfileDocument = {
  id: string
  source_id: string
  type: 'team'
  hackathon_slug: string | null
  is_hackathon_linked: boolean
  is_open: boolean | null
  current_team_id: null
  profile: {
    role: string[]
    skills: string[]
    personality: string[]
    context: string[]
  }
  content: string
  embedding: string
}

const UUID_NAMESPACE = '5c7b0e7d-99c4-4c9d-9b0e-1a6bc4d7c5f0'
const OPENAI_EMBEDDING_MODEL = 'text-embedding-3-small'
const EMBEDDING_DIM = 384

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const ensureString = (value: unknown): string | null => {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

const toStringArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) return []
  return value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter(Boolean)
}

const dedupeStrings = (values: string[]) => Array.from(new Set(values))

const normalizeValue = (value: string) => value.trim().toLowerCase().replace(/\s+/g, ' ')

const normalizeValues = (values: string[]) => dedupeStrings(values.map(normalizeValue).filter(Boolean)).sort((a, b) => a.localeCompare(b))

const formatList = (values: string[]) => (values.length > 0 ? values.join(', ') : 'none')

const toVectorString = (values: number[]) => `[${values.join(',')}]`

const embedText = async (text: string, apiKeyOverride?: string | null): Promise<number[]> => {
  const apiKey = apiKeyOverride ?? Deno.env.get('OPENAI_API_KEY') ?? Deno.env.get('VITE_OPENAI_API_KEY')
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is required')
  }

  const response = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      input: [text],
      model: OPENAI_EMBEDDING_MODEL,
      dimensions: EMBEDDING_DIM,
    }),
  })

  if (!response.ok) {
    throw new Error(`OpenAI embeddings request failed: ${response.status} ${await response.text()}`)
  }

  const payload = await response.json()
  const embedding = payload?.data?.[0]?.embedding
  if (!Array.isArray(embedding)) {
    throw new Error('Invalid embeddings response from OpenAI API')
  }

  return embedding as number[]
}

const deterministicId = async (docType: string, sourceId: string) => {
  const payload = new TextEncoder().encode(`${docType}:${sourceId}`)
  const namespaceBytes = Uint8Array.from(UUID_NAMESPACE.replace(/-/g, '').match(/.{1,2}/g)!.map((value) => parseInt(value, 16)))
  const buffer = new Uint8Array(namespaceBytes.length + payload.length)
  buffer.set(namespaceBytes)
  buffer.set(payload, namespaceBytes.length)
  const hash = new Uint8Array(await crypto.subtle.digest('SHA-1', buffer))
  hash[6] = (hash[6] & 0x0f) | 0x50
  hash[8] = (hash[8] & 0x3f) | 0x80
  const bytes = Array.from(hash.slice(0, 16))
  const hex = bytes.map((value) => value.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`
}

const buildTeamProfileDocument = async (team: TeamRow, apiKeyOverride?: string | null): Promise<TeamProfileDocument> => {
  const sourceId = team.team_code
  const hackathonSlug = ensureString(team.hackathon_slug)
  const members = Array.isArray(team.members) ? team.members : []
  const memberRoles = members
    .map((member) => ensureString(member.role))
    .filter((value): value is string => value !== null)
  const lookingFor = toStringArray(team.looking_for)
  const requiredSkills = toStringArray(team.required_skills)
  const preferredPersonality = toStringArray(team.preferred_personality)
  const tags = toStringArray(team.tags)
  const intro = ensureString(team.intro)
  const memberCount = typeof team.member_count === 'number' ? team.member_count : 0
  const maxMembers = typeof team.max_members === 'number' ? team.max_members : 0
  const isOpen = typeof team.is_open === 'boolean' ? team.is_open : null

  const profile = {
    role: dedupeStrings([...lookingFor, ...memberRoles]),
    skills: requiredSkills,
    personality: preferredPersonality,
    context: dedupeStrings(
      [
        intro,
        ...tags,
        hackathonSlug ? `hackathon_slug=${hackathonSlug}` : null,
        `recruiting=${Boolean(isOpen)}`,
        `capacity=${memberCount}/${maxMembers}`,
      ].filter((value): value is string => value !== null),
    ),
  }

  const content = [
    `Role: ${formatList(normalizeValues(lookingFor))}`,
    `Skills: ${formatList(normalizeValues(requiredSkills))}`,
    `Personality: ${formatList(normalizeValues(preferredPersonality))}`,
    `Context: ${formatList(profile.context.map((item) => item.trim()).filter(Boolean))}`,
  ].join(' | ')

  const embedding = await embedText(`passage: ${content}`, apiKeyOverride)

  return {
    id: await deterministicId('team', sourceId),
    source_id: sourceId,
    type: 'team',
    hackathon_slug: hackathonSlug,
    is_hackathon_linked: hackathonSlug !== null,
    is_open: isOpen,
    current_team_id: null,
    profile,
    content,
    embedding: toVectorString(embedding),
  }
}

const getSupabaseAdmin = () => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required')
  }

  return createClient(supabaseUrl, serviceRoleKey)
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { teamCode, action, openAIApiKey } = await request.json() as { teamCode?: unknown; action?: unknown; openAIApiKey?: unknown }
    const normalizedTeamCode = ensureString(teamCode)
    const normalizedAction = action === 'delete' ? 'delete' : action === 'upsert' ? 'upsert' : null
    const normalizedOpenAIApiKey = ensureString(openAIApiKey)

    if (!normalizedTeamCode || !normalizedAction) {
      return new Response(JSON.stringify({ error: 'teamCode and action are required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabase = getSupabaseAdmin()

    if (normalizedAction === 'delete') {
      const { error } = await supabase
        .from('profile_documents')
        .delete()
        .eq('type', 'team')
        .eq('source_id', normalizedTeamCode)

      if (error) throw error

      return new Response(JSON.stringify({ ok: true, action: normalizedAction, teamCode: normalizedTeamCode }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data, error } = await supabase
      .from('teams')
      .select('team_code, intro, members, is_open, max_members, member_count, looking_for, required_skills, preferred_personality, tags, hackathon_slug')
      .eq('team_code', normalizedTeamCode)
      .single()

    if (error) throw error

    const document = await buildTeamProfileDocument(data as TeamRow, normalizedOpenAIApiKey)

    const { error: upsertError } = await supabase
      .from('profile_documents')
      .upsert(document, { onConflict: 'id' })

    if (upsertError) throw upsertError

    return new Response(JSON.stringify({ ok: true, action: normalizedAction, teamCode: normalizedTeamCode }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : 'Unknown error',
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
