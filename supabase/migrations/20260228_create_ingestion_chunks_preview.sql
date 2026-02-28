-- Phase 41: Create ingestion_chunks_preview table for intelligent text chunking
-- Stores preview of chunks before final embedding generation

-- Create chunk status enum
CREATE TYPE public.chunk_status AS ENUM (
  'pending_ocr',       -- Chunk requires OCR (no text extracted)
  'preview_ready',     -- Preview chunk ready for review
  'verified',          -- Chunk verified and ready for embedding
  'embedded',          -- Chunk has embeddings
  'failed'             -- Chunk processing failed
);

-- Create ingestion_chunks_preview table
CREATE TABLE public.ingestion_chunks_preview (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Ownership
  job_id UUID NOT NULL REFERENCES public.ingestion_jobs(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,

  -- Chunk content
  chunk_number INTEGER NOT NULL,           -- Sequential chunk number (0-indexed)
  start_page INTEGER NOT NULL,             -- First page of chunk
  end_page INTEGER NOT NULL,               -- Last page of chunk
  section_title TEXT,                      -- Section heading from document (e.g., "1.2.3")

  -- Text content
  content TEXT NOT NULL,                   -- Full chunk text (before embedding)
  content_hash VARCHAR(64) NOT NULL,       -- SHA256 hash of content for deduplication
  content_summary TEXT,                    -- 1-2 sentence summary of chunk
  content_preview VARCHAR(200),            -- First 200 chars (for UI preview)

  -- Token metrics
  estimated_tokens INTEGER NOT NULL,       -- Estimated tokens in this chunk
  actual_tokens INTEGER,                   -- Actual tokens after embedding (if embedded)
  min_tokens INTEGER DEFAULT 800,          -- Minimum target tokens
  max_tokens INTEGER DEFAULT 1200,         -- Maximum target tokens

  -- OCR tracking
  requires_ocr BOOLEAN DEFAULT FALSE,      -- True if pages had no extractable text
  ocr_pages TEXT[],                        -- Array of page numbers needing OCR

  -- Quality metrics
  status public.chunk_status DEFAULT 'preview_ready',
  quality_score NUMERIC(3, 2),             -- 0.0-1.0 quality rating
  is_duplicate BOOLEAN DEFAULT FALSE,      -- True if similar to previous chunk
  duplicate_of UUID REFERENCES public.ingestion_chunks_preview(id),

  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ,
  verified_at TIMESTAMPTZ,

  -- Error tracking
  error_message TEXT,
  failure_reason TEXT,

  -- Constraints
  CONSTRAINT valid_page_range CHECK (start_page <= end_page AND start_page >= 0),
  CONSTRAINT valid_tokens CHECK (estimated_tokens > 0),
  CONSTRAINT valid_quality_score CHECK (quality_score IS NULL OR (quality_score >= 0 AND quality_score <= 1))
);

-- Create indexes for common queries
CREATE INDEX idx_chunks_preview_job_id ON public.ingestion_chunks_preview(job_id);
CREATE INDEX idx_chunks_preview_company_id ON public.ingestion_chunks_preview(company_id);
CREATE INDEX idx_chunks_preview_status ON public.ingestion_chunks_preview(status);
CREATE INDEX idx_chunks_preview_hash ON public.ingestion_chunks_preview(content_hash);
CREATE INDEX idx_chunks_preview_created_at ON public.ingestion_chunks_preview(created_at DESC);
CREATE INDEX idx_chunks_preview_job_chunk_number ON public.ingestion_chunks_preview(job_id, chunk_number);
CREATE INDEX idx_chunks_preview_duplicate ON public.ingestion_chunks_preview(is_duplicate) WHERE is_duplicate = TRUE;
CREATE INDEX idx_chunks_preview_ocr ON public.ingestion_chunks_preview(requires_ocr) WHERE requires_ocr = TRUE;

-- Enable RLS
ALTER TABLE public.ingestion_chunks_preview ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can see their company's chunks
CREATE POLICY "Users can see their company's chunks"
  ON public.ingestion_chunks_preview
  FOR SELECT
  USING (
    company_id IN (SELECT company_id FROM user_company WHERE user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin'))
  );

-- RLS Policy: Users can insert chunks for their jobs
CREATE POLICY "Users can create chunks for their jobs"
  ON public.ingestion_chunks_preview
  FOR INSERT
  WITH CHECK (
    job_id IN (
      SELECT id FROM ingestion_jobs
      WHERE company_id IN (SELECT company_id FROM user_company WHERE user_id = auth.uid())
    )
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin'))
  );

-- RLS Policy: Service role can update chunks
CREATE POLICY "Service role can update chunks"
  ON public.ingestion_chunks_preview
  FOR UPDATE
  USING (true)
  WITH CHECK (true);

-- Create function to auto-update updated_at
CREATE OR REPLACE FUNCTION public.update_chunks_preview_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updated_at
CREATE TRIGGER trigger_chunks_preview_updated_at
  BEFORE UPDATE ON public.ingestion_chunks_preview
  FOR EACH ROW
  EXECUTE FUNCTION public.update_chunks_preview_updated_at();

-- Create chunk audit log
CREATE TABLE public.ingestion_chunks_preview_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chunk_id UUID NOT NULL REFERENCES public.ingestion_chunks_preview(id) ON DELETE CASCADE,

  -- State transition
  old_status public.chunk_status,
  new_status public.chunk_status,
  transition_reason TEXT,

  -- Quality updates
  quality_score_changed NUMERIC(3, 2),
  duplicate_detected BOOLEAN,

  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_chunks_audit_chunk_id ON public.ingestion_chunks_preview_audit(chunk_id);
CREATE INDEX idx_chunks_audit_created_at ON public.ingestion_chunks_preview_audit(created_at DESC);

-- Create function to log chunk transitions
CREATE OR REPLACE FUNCTION public.log_chunk_preview_state_transition()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status OR OLD.quality_score IS DISTINCT FROM NEW.quality_score THEN
    INSERT INTO public.ingestion_chunks_preview_audit (
      chunk_id,
      old_status,
      new_status,
      transition_reason,
      quality_score_changed,
      duplicate_detected
    ) VALUES (
      NEW.id,
      OLD.status,
      NEW.status,
      'Status/Quality update',
      CASE WHEN OLD.quality_score IS DISTINCT FROM NEW.quality_score THEN NEW.quality_score ELSE NULL END,
      NEW.is_duplicate
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for audit logging
CREATE TRIGGER trigger_chunks_preview_audit
  AFTER UPDATE ON public.ingestion_chunks_preview
  FOR EACH ROW
  EXECUTE FUNCTION public.log_chunk_preview_state_transition();

-- Metadata comments
COMMENT ON TABLE public.ingestion_chunks_preview IS 'Phase 41: Preview chunks for document ingestion - stores text chunks before embedding generation';
COMMENT ON COLUMN public.ingestion_chunks_preview.status IS 'Chunk status: pending_ocr, preview_ready, verified, embedded, failed';
COMMENT ON COLUMN public.ingestion_chunks_preview.content_hash IS 'SHA256 hash of chunk content for deduplication and integrity';
COMMENT ON COLUMN public.ingestion_chunks_preview.estimated_tokens IS 'Estimated token count for this chunk (used for cost estimation)';
COMMENT ON COLUMN public.ingestion_chunks_preview.requires_ocr IS 'True if chunk pages had insufficient text extraction';
COMMENT ON COLUMN public.ingestion_chunks_preview.quality_score IS 'Quality rating 0.0-1.0 based on content analysis';
COMMENT ON COLUMN public.ingestion_chunks_preview.is_duplicate IS 'True if chunk appears to be duplicate of previous chunk';
