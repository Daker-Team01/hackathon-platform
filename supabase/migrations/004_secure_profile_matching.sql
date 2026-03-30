DROP POLICY IF EXISTS "Allow all profile_documents operations" ON profile_documents;

CREATE INDEX IF NOT EXISTS idx_profile_documents_embedding_ivfflat
ON profile_documents
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

CREATE OR REPLACE FUNCTION list_matcher_profile_documents(
  filter_type TEXT DEFAULT NULL
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
  content TEXT
)
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public
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
    profile_documents.content
  FROM profile_documents
  WHERE (filter_type IS NULL OR profile_documents.type = filter_type)
  ORDER BY profile_documents.type, profile_documents.source_id;
$$;

CREATE OR REPLACE FUNCTION match_profile_documents_by_source(
  query_source_id TEXT,
  query_source_type TEXT,
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
SECURITY DEFINER
SET search_path = public
AS $$
  WITH source_document AS (
    SELECT profile_documents.embedding
    FROM profile_documents
    WHERE profile_documents.source_id = query_source_id
      AND profile_documents.type = query_source_type
    LIMIT 1
  )
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
    1 - (profile_documents.embedding <=> source_document.embedding) AS similarity
  FROM profile_documents
  CROSS JOIN source_document
  WHERE (match_profile_documents_by_source.filter_type IS NULL OR profile_documents.type = match_profile_documents_by_source.filter_type)
    AND (match_profile_documents_by_source.filter_hackathon_slug IS NULL OR profile_documents.hackathon_slug = match_profile_documents_by_source.filter_hackathon_slug)
    AND (match_profile_documents_by_source.filter_is_open IS NULL OR profile_documents.is_open = match_profile_documents_by_source.filter_is_open)
    AND (match_profile_documents_by_source.exclude_source_id IS NULL OR profile_documents.source_id <> match_profile_documents_by_source.exclude_source_id)
  ORDER BY profile_documents.embedding <=> source_document.embedding
  LIMIT match_count;
$$;

REVOKE ALL ON FUNCTION match_profile_documents(VECTOR(384), INT, TEXT, TEXT, BOOLEAN, TEXT) FROM anon;
REVOKE ALL ON FUNCTION match_profile_documents(VECTOR(384), INT, TEXT, TEXT, BOOLEAN, TEXT) FROM authenticated;
GRANT EXECUTE ON FUNCTION match_profile_documents(VECTOR(384), INT, TEXT, TEXT, BOOLEAN, TEXT) TO service_role;

GRANT EXECUTE ON FUNCTION list_matcher_profile_documents(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION list_matcher_profile_documents(TEXT) TO authenticated;

GRANT EXECUTE ON FUNCTION match_profile_documents_by_source(TEXT, TEXT, INT, TEXT, TEXT, BOOLEAN, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION match_profile_documents_by_source(TEXT, TEXT, INT, TEXT, TEXT, BOOLEAN, TEXT) TO authenticated;
