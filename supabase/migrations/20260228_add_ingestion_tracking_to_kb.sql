-- Phase 41: Add ingestion job tracking to knowledge base
-- Allows linking knowledge documents back to their ingestion jobs

-- Add ingestion_job_id column to knowledge_documents
ALTER TABLE public.knowledge_documents
ADD COLUMN IF NOT EXISTS ingestion_job_id UUID REFERENCES public.ingestion_jobs(id) ON DELETE SET NULL;

-- Add company_id column for company-scoped access (if not exists)
ALTER TABLE public.knowledge_documents
ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL;

-- Add is_active column if not exists (for soft delete)
ALTER TABLE public.knowledge_documents
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;

-- Create index for ingestion tracking
CREATE INDEX IF NOT EXISTS idx_kb_documents_ingestion_job_id
ON public.knowledge_documents(ingestion_job_id);

-- Create index for company scoping
CREATE INDEX IF NOT EXISTS idx_kb_documents_company_id
ON public.knowledge_documents(company_id);

-- Create index for active documents
CREATE INDEX IF NOT EXISTS idx_kb_documents_is_active
ON public.knowledge_documents(is_active)
WHERE is_active = true;

-- Add comment
COMMENT ON COLUMN public.knowledge_documents.ingestion_job_id IS 'Reference to ingestion job that created this document';
COMMENT ON COLUMN public.knowledge_documents.company_id IS 'Company that owns this knowledge document';
COMMENT ON COLUMN public.knowledge_documents.is_active IS 'Whether this document is active and searchable';
