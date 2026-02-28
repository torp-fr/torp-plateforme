-- Phase 41: Create ingestion_jobs table for document analysis orchestration
-- Tracks the lifecycle of document ingestion jobs (analyze → extract → chunk → embed)

-- Create ingestion_job_status enum
CREATE TYPE public.ingestion_job_status AS ENUM (
  'pending',           -- Awaiting analysis
  'analyzed',          -- Analysis complete, ready for extraction
  'extracting',        -- Text extraction/OCR in progress
  'chunking',          -- Text chunking in progress
  'embedding',         -- Embedding generation in progress
  'completed',         -- All steps complete
  'failed',            -- Job failed at some stage
  'cancelled'          -- Job cancelled by user
);

-- Create ingestion_jobs table
CREATE TABLE public.ingestion_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Ownership
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,

  -- Storage reference
  file_path TEXT NOT NULL,              -- s3://bucket/path/to/file.pdf
  file_size_bytes BIGINT NOT NULL,      -- File size in bytes

  -- Job status
  status public.ingestion_job_status NOT NULL DEFAULT 'pending',
  progress INTEGER NOT NULL DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),

  -- Analysis results
  analysis_results JSONB,               -- {page_count, extractable_pages, ocr_pages, ...}
  estimated_embedding_tokens INTEGER,
  estimated_embedding_cost DECIMAL(10, 8),
  estimated_ocr_cost DECIMAL(10, 8),

  -- Error tracking
  error_message TEXT,
  error_details JSONB,
  failure_reason TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  started_at TIMESTAMPTZ,
  analyzed_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Retry tracking
  retry_count INTEGER DEFAULT 0,
  last_retry_at TIMESTAMPTZ,

  -- Constraints
  CONSTRAINT valid_progress CHECK (progress >= 0 AND progress <= 100),
  CONSTRAINT started_before_completed CHECK (started_at IS NULL OR completed_at IS NULL OR started_at <= completed_at),
  CONSTRAINT analyzed_before_extraction CHECK (analyzed_at IS NULL OR status NOT IN ('pending')),
  CONSTRAINT valid_costs CHECK (estimated_embedding_cost >= 0 AND estimated_ocr_cost >= 0)
);

-- Create indexes for common queries
CREATE INDEX idx_ingestion_jobs_status ON public.ingestion_jobs(status);
CREATE INDEX idx_ingestion_jobs_company_id ON public.ingestion_jobs(company_id);
CREATE INDEX idx_ingestion_jobs_user_id ON public.ingestion_jobs(user_id);
CREATE INDEX idx_ingestion_jobs_created_at ON public.ingestion_jobs(created_at DESC);
CREATE INDEX idx_ingestion_jobs_pending ON public.ingestion_jobs(status, created_at) WHERE status = 'pending';
CREATE INDEX idx_ingestion_jobs_analyzed ON public.ingestion_jobs(status, created_at) WHERE status = 'analyzed';
CREATE INDEX idx_ingestion_jobs_failing ON public.ingestion_jobs(status, created_at) WHERE status = 'failed';

-- Enable RLS
ALTER TABLE public.ingestion_jobs ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can see their own company's jobs
CREATE POLICY "Users can see their company's ingestion jobs"
  ON public.ingestion_jobs
  FOR SELECT
  USING (
    company_id IN (SELECT company_id FROM user_company WHERE user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin'))
  );

-- RLS Policy: Users can create jobs in their company
CREATE POLICY "Users can create ingestion jobs in their company"
  ON public.ingestion_jobs
  FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND company_id IN (SELECT company_id FROM user_company WHERE user_id = auth.uid())
  );

-- RLS Policy: Users can update their own jobs (only system can update status)
CREATE POLICY "Users can update their own ingestion jobs"
  ON public.ingestion_jobs
  FOR UPDATE
  USING (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin'))
  )
  WITH CHECK (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin'))
  );

-- RLS Policy: Service role can update job status
CREATE POLICY "Service role can update job status"
  ON public.ingestion_jobs
  FOR UPDATE
  USING (true)
  WITH CHECK (true);

-- Create function to auto-update updated_at
CREATE OR REPLACE FUNCTION public.update_ingestion_jobs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updated_at
CREATE TRIGGER trigger_ingestion_jobs_updated_at
  BEFORE UPDATE ON public.ingestion_jobs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_ingestion_jobs_updated_at();

-- Create ingestion job audit log
CREATE TABLE public.ingestion_job_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES public.ingestion_jobs(id) ON DELETE CASCADE,

  -- State transition
  old_status public.ingestion_job_status,
  new_status public.ingestion_job_status,
  transition_reason TEXT,

  -- Error tracking
  error_message TEXT,

  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_ingestion_job_audit_job_id ON public.ingestion_job_audit_log(job_id);
CREATE INDEX idx_ingestion_job_audit_created_at ON public.ingestion_job_audit_log(created_at DESC);

-- Create function to log state transitions
CREATE OR REPLACE FUNCTION public.log_ingestion_job_state_transition()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.ingestion_job_audit_log (
      job_id,
      old_status,
      new_status,
      transition_reason,
      error_message
    ) VALUES (
      NEW.id,
      OLD.status,
      NEW.status,
      'Status transition',
      NEW.error_message
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for audit logging
CREATE TRIGGER trigger_ingestion_job_audit_log
  AFTER UPDATE ON public.ingestion_jobs
  FOR EACH ROW
  EXECUTE FUNCTION public.log_ingestion_job_state_transition();

-- Metadata comments
COMMENT ON TABLE public.ingestion_jobs IS 'Phase 41: Ingestion job queue for document analysis orchestration - tracks document analysis job lifecycle';
COMMENT ON COLUMN public.ingestion_jobs.status IS 'Job status: pending, analyzed, extracting, chunking, embedding, completed, failed, cancelled';
COMMENT ON COLUMN public.ingestion_jobs.progress IS 'Job progress percentage (0-100)';
COMMENT ON COLUMN public.ingestion_jobs.analysis_results IS 'Results from document analysis: {page_count, extractable_pages, ocr_pages, etc.}';
COMMENT ON COLUMN public.ingestion_jobs.estimated_embedding_tokens IS 'Estimated tokens for embedding generation';
COMMENT ON COLUMN public.ingestion_jobs.estimated_embedding_cost IS 'Estimated cost for embedding generation in USD';
COMMENT ON COLUMN public.ingestion_jobs.estimated_ocr_cost IS 'Estimated cost for OCR in USD';
COMMENT ON COLUMN public.ingestion_jobs.file_path IS 'Path to file in Supabase Storage: s3://bucket/path/to/file';
