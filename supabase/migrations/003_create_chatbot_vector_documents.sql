CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS chatbot_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doc_key TEXT NOT NULL UNIQUE,
  doc_type TEXT NOT NULL CHECK (doc_type IN ('hackathon', 'team', 'user', 'guide')),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  embedding VECTOR(768) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS idx_chatbot_documents_doc_type ON chatbot_documents(doc_type);

ALTER TABLE chatbot_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all chatbot_documents operations" ON chatbot_documents;
CREATE POLICY "Allow all chatbot_documents operations"
ON chatbot_documents FOR ALL
USING (true)
WITH CHECK (true);

CREATE OR REPLACE FUNCTION match_chatbot_documents (
  query_embedding VECTOR(768),
  match_count INT DEFAULT 6,
  filter_doc_type TEXT DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  doc_key TEXT,
  doc_type TEXT,
  title TEXT,
  content TEXT,
  metadata JSONB,
  similarity DOUBLE PRECISION
)
LANGUAGE SQL
AS $$
  SELECT
    chatbot_documents.id,
    chatbot_documents.doc_key,
    chatbot_documents.doc_type,
    chatbot_documents.title,
    chatbot_documents.content,
    chatbot_documents.metadata,
    1 - (chatbot_documents.embedding <=> query_embedding) AS similarity
  FROM chatbot_documents
  WHERE (filter_doc_type IS NULL OR chatbot_documents.doc_type = filter_doc_type)
  ORDER BY chatbot_documents.embedding <=> query_embedding
  LIMIT match_count;
$$;
