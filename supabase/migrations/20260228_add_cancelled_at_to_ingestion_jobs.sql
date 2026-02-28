-- Phase 41: Add cancellation tracking to ingestion jobs
-- Enables tracking when ingestion jobs are cancelled

-- Add cancelled_at column to ingestion_jobs
ALTER TABLE public.ingestion_jobs
ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ;

-- Create index for cancelled jobs
CREATE INDEX IF NOT EXISTS idx_ingestion_jobs_cancelled_at
ON public.ingestion_jobs(cancelled_at)
WHERE cancelled_at IS NOT NULL;

-- Create index for jobs by status (for quick filtering)
CREATE INDEX IF NOT EXISTS idx_ingestion_jobs_status_created
ON public.ingestion_jobs(status, created_at DESC);

-- Create a view for active jobs (not cancelled or completed)
CREATE OR REPLACE VIEW active_ingestion_jobs AS
SELECT *
FROM public.ingestion_jobs
WHERE status NOT IN ('completed', 'failed', 'cancelled')
ORDER BY created_at DESC;

-- Create a view for cancelled jobs
CREATE OR REPLACE VIEW cancelled_ingestion_jobs AS
SELECT *
FROM public.ingestion_jobs
WHERE status = 'cancelled'
ORDER BY cancelled_at DESC;

-- Add comment
COMMENT ON COLUMN public.ingestion_jobs.cancelled_at IS 'Timestamp when the job was cancelled by user';
