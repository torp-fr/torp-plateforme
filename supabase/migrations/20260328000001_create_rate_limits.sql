-- ============================================================================
-- MIGRATION: Create rate_limits table — Phase 3B Jalon 1
-- Purpose: Per-user API rate limiting configuration
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.rate_limits (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Configurable limits (defaults match free tier)
  requests_per_minute  INTEGER NOT NULL DEFAULT 100,
  requests_per_hour    INTEGER NOT NULL DEFAULT 1000,
  requests_per_day     INTEGER NOT NULL DEFAULT 10000,

  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- One row per user
CREATE UNIQUE INDEX IF NOT EXISTS idx_rate_limits_user_id ON public.rate_limits(user_id);

-- updated_at trigger (reuse function created in Phase 3A)
CREATE TRIGGER set_rate_limits_updated_at
  BEFORE UPDATE ON public.rate_limits
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── RLS ──────────────────────────────────────────────────────────────────────
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;

-- Users can read their own limits (useful for frontend quota display)
CREATE POLICY "Users can read own rate limits" ON public.rate_limits
  FOR SELECT USING (auth.uid() = user_id);

-- Admins can read all rate limits
CREATE POLICY "Admins can read all rate limits" ON public.rate_limits
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'super_admin')
    )
  );

-- Admins can update rate limits
CREATE POLICY "Admins can update rate limits" ON public.rate_limits
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'super_admin')
    )
  );

-- ============================================================================
-- END MIGRATION
-- ============================================================================
