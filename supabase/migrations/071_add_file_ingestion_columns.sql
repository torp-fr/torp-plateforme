-- PHASE 42: Server-side PDF ingestion columns
-- Add file storage path and metadata for Edge Function processing

ALTER TABLE knowledge_documents
ADD COLUMN IF NOT EXISTS file_path TEXT,
ADD COLUMN IF NOT EXISTS file_size INTEGER,
ADD COLUMN IF NOT EXISTS mime_type TEXT;

-- Create index for file_path lookups
CREATE INDEX IF NOT EXISTS idx_knowledge_docs_file_path
  ON knowledge_documents(file_path)
  WHERE file_path IS NOT NULL;
