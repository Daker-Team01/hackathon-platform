import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { buildHackathons, buildTeamProfileDocument, buildUserProfileDocument, createHackathonMap, } from '../src/lib/profileDocuments.js';
const projectRoot = process.cwd();
const outputPath = path.join(projectRoot, 'tmp', 'profile_documents.json');
const defaultHackathonPath = path.join(projectRoot, 'src', 'data', 'hackathon_dummy_v4.json');
const defaultUserPath = path.join(projectRoot, 'src', 'data', 'user_dummy_v2.json');
const loadEnvFile = async (envPath) => {
    try {
        const raw = await readFile(envPath, 'utf-8');
        raw
            .split(/\r?\n/)
            .map((line) => line.trim())
            .filter((line) => line && !line.startsWith('#') && line.includes('='))
            .forEach((line) => {
            const separatorIndex = line.indexOf('=');
            const key = line.slice(0, separatorIndex).trim();
            const value = line.slice(separatorIndex + 1).trim();
            if (key && !(key in process.env)) {
                process.env[key] = value;
            }
        });
    }
    catch {
        // ignore missing .env
    }
};
const createSupabaseClient = async () => {
    await loadEnvFile(path.join(projectRoot, '.env'));
    const supabaseUrl = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.VITE_SUPABASE_KEY;
    if (!supabaseUrl || !supabaseKey) {
        throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or VITE_* fallbacks) are required');
    }
    return createClient(supabaseUrl, supabaseKey);
};
const loadJsonArray = async (filePath) => {
    const raw = await readFile(filePath, 'utf-8');
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
        throw new Error(`Expected JSON array in ${filePath}`);
    }
    return parsed;
};
const mapSupabaseTeamToRawTeam = (row) => {
    return {
        teamCode: typeof row.team_code === 'string' ? row.team_code : '',
        hackathonSlug: typeof row.hackathon_slug === 'string' ? row.hackathon_slug : null,
        lookingFor: Array.isArray(row.looking_for) ? row.looking_for : [],
        requiredSkills: Array.isArray(row.required_skills) ? row.required_skills : [],
        preferredPersonality: Array.isArray(row.preferred_personality) ? row.preferred_personality : [],
        intro: typeof row.intro === 'string' ? row.intro : '',
        tags: Array.isArray(row.tags) ? row.tags : [],
        isOpen: typeof row.is_open === 'boolean' ? row.is_open : null,
        memberCount: typeof row.member_count === 'number' ? row.member_count : 0,
        maxMembers: typeof row.max_members === 'number' ? row.max_members : 0,
        members: Array.isArray(row.members) ? row.members : [],
    };
};
const fetchTeamsFromSupabase = async () => {
    const supabase = await createSupabaseClient();
    const { data, error } = await supabase
        .from('teams')
        .select('team_code, intro, members, is_open, max_members, member_count, looking_for, required_skills, preferred_personality, tags, hackathon_slug')
        .order('created_at', { ascending: false });
    if (error) {
        throw error;
    }
    return (data ?? []).map((row) => mapSupabaseTeamToRawTeam(row));
};
async function main() {
    const [rawUsers, rawHackathons, rawTeams] = await Promise.all([
        loadJsonArray(defaultUserPath),
        loadJsonArray(defaultHackathonPath),
        fetchTeamsFromSupabase(),
    ]);
    const hackathons = buildHackathons(rawHackathons);
    const hackathonMap = createHackathonMap(hackathons);
    const documents = [
        ...rawUsers.map((user) => buildUserProfileDocument(user, hackathonMap)),
        ...rawTeams.map((team) => buildTeamProfileDocument(team, hackathonMap)),
    ].filter((item) => item !== null);
    await mkdir(path.dirname(outputPath), { recursive: true });
    await writeFile(outputPath, JSON.stringify(documents, null, 2), 'utf-8');
    console.log(`Exported ${documents.length} profile documents to ${outputPath}`);
}
main().catch((error) => {
    console.error('Failed to export profile documents:', error);
    process.exitCode = 1;
});
