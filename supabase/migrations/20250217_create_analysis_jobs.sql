-- Phase 32.1: Create analysis_jobs table for async orchestration
-- This table manages the lifecycle of analysis jobs for devis/projects

-- Create job status enum
CREATE TYPE public.job_status AS ENUM (
  'pending',
  'processing',
  'completed',
  'failed',
  'cancelled'
);

-- Create analysis_jobs table
CREATE TABLE public.analysis_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  project_id UUID,
  devis_id UUID,
  status public.job_status NOT NULL DEFAULT 'pending',
  progress INTEGER NOT NULL DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  error_message TEXT,
  result_snapshot_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Constraints
  CONSTRAINT valid_progress CHECK (progress >= 0 AND progress <= 100),
  CONSTRAINT started_before_completed CHECK (started_at IS NULL OR completed_at IS NULL OR started_at <= completed_at)
);

-- Create indexes for common queries
CREATE INDEX idx_analysis_jobs_status ON public.analysis_jobs(status);
CREATE INDEX idx_analysis_jobs_user_id ON public.analysis_jobs(user_id);
CREATE INDEX idx_analysis_jobs_created_at ON public.analysis_jobs(created_at DESC);
CREATE INDEX idx_analysis_jobs_devis_id ON public.analysis_jobs(devis_id);
CREATE INDEX idx_analysis_jobs_pending ON public.analysis_jobs(status, created_at) WHERE status = 'pending';

-- Enable RLS
ALTER TABLE public.analysis_jobs ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can see their own jobs
CREATE POLICY "Users can see their own jobs"
  ON public.analysis_jobs
  FOR SELECT
  USING (auth.uid() = user_id OR is_admin());

-- RLS Policy: Users can insert their own jobs
CREATE POLICY "Users can create their own jobs"
  ON public.analysis_jobs
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- RLS Policy: Users can update their own jobs (only allowed fields)
CREATE POLICY "Users can update their own jobs"
  ON public.analysis_jobs
  FOR UPDATE
  USING (auth.uid() = user_id OR is_admin())
  WITH CHECK (auth.uid() = user_id OR is_admin());

-- RLS Policy: Admins can see all jobs
CREATE POLICY "Admins can see all jobs"
  ON public.analysis_jobs
  FOR SELECT
  USING (is_admin());

-- Helper function to check if user is admin
-- (assumes is_admin() function exists from previous phases)

-- Create function to auto-update updated_at
CREATE OR REPLACE FUNCTION public.update_analysis_jobs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updated_at
CREATE TRIGGER trigger_analysis_jobs_updated_at
  BEFORE UPDATE ON public.analysis_jobs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_analysis_jobs_updated_at();

-- Metadata comment
COMMENT ON TABLE public.analysis_jobs IS 'Phase 32.1: Async job queue for analysis orchestration - tracks devis/project analysis job lifecycle';
COMMENT ON COLUMN public.analysis_jobs.status IS 'Job status: pending, processing, completed, failed, cancelled';
COMMENT ON COLUMN public.analysis_jobs.progress IS 'Job progress percentage (0-100)';
COMMENT ON COLUMN public.analysis_jobs.error_message IS 'Error message if job failed';
COMMENT ON COLUMN public.analysis_jobs.result_snapshot_id IS 'Reference to analysis result snapshot';
