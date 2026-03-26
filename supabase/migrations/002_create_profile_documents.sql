CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS profile_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('user', 'team')),
  hackathon_slug TEXT,
  is_hackathon_linked BOOLEAN NOT NULL DEFAULT false,
  is_open BOOLEAN,
  current_team_id TEXT,
  profile JSONB NOT NULL,
  content TEXT NOT NULL,
  embedding VECTOR(384) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  UNIQUE (type, source_id)
);

CREATE INDEX IF NOT EXISTS idx_profile_documents_type ON profile_documents(type);
CREATE INDEX IF NOT EXISTS idx_profile_documents_hackathon_slug ON profile_documents(hackathon_slug);
CREATE INDEX IF NOT EXISTS idx_profile_documents_is_open ON profile_documents(is_open);
CREATE INDEX IF NOT EXISTS idx_profile_documents_current_team_id ON profile_documents(current_team_id);

ALTER TABLE profile_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all profile_documents operations" ON profile_documents;
CREATE POLICY "Allow all profile_documents operations"
ON profile_documents FOR ALL
USING (true)
WITH CHECK (true);

CREATE OR REPLACE FUNCTION match_profile_documents (
  query_embedding VECTOR(384),
  match_count INT DEFAULT 10,
  filter_type TEXT DEFAULT NULL,
  filter_hackathon_slug TEXT DEFAULT NULL,
  filter_is_open BOOLEAN DEFAULT NULL,
  exclude_source_id TEXT DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  source_id TEXT,
  type TEXT,
  hackathon_slug TEXT,
  is_hackathon_linked BOOLEAN,
  is_open BOOLEAN,
  current_team_id TEXT,
  profile JSONB,
  content TEXT,
  similarity DOUBLE PRECISION
)
LANGUAGE SQL
AS $$
  SELECT
    profile_documents.id,
    profile_documents.source_id,
    profile_documents.type,
    profile_documents.hackathon_slug,
    profile_documents.is_hackathon_linked,
    profile_documents.is_open,
    profile_documents.current_team_id,
    profile_documents.profile,
    profile_documents.content,
    1 - (profile_documents.embedding <=> query_embedding) AS similarity
  FROM profile_documents
  WHERE (filter_type IS NULL OR profile_documents.type = filter_type)
    AND (filter_hackathon_slug IS NULL OR profile_documents.hackathon_slug = filter_hackathon_slug)
    AND (filter_is_open IS NULL OR profile_documents.is_open = filter_is_open)
    AND (exclude_source_id IS NULL OR profile_documents.source_id <> exclude_source_id)
  ORDER BY profile_documents.embedding <=> query_embedding
  LIMIT match_count;
$$;
