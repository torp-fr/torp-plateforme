-- ============================================================
-- Migration: platform_settings
-- Phase 3B — Admin Settings backend
-- ============================================================

CREATE TABLE IF NOT EXISTS public.platform_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Identité plateforme
  platform_name        VARCHAR(255)  NOT NULL DEFAULT 'TORP',
  platform_url         VARCHAR(2048) NOT NULL DEFAULT 'https://torp.example.com',
  platform_description TEXT,

  -- Mode système
  maintenance_mode     BOOLEAN NOT NULL DEFAULT FALSE,
  maintenance_message  TEXT,

  -- Notifications
  email_notifications_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  daily_summary_enabled       BOOLEAN NOT NULL DEFAULT TRUE,
  security_alerts_enabled     BOOLEAN NOT NULL DEFAULT TRUE,

  -- Sécurité
  session_timeout_minutes INTEGER NOT NULL DEFAULT 60
    CHECK (session_timeout_minutes > 0),
  require_2fa_for_admins  BOOLEAN NOT NULL DEFAULT TRUE,
  ip_whitelist_enabled    BOOLEAN NOT NULL DEFAULT FALSE,
  ip_whitelist            TEXT,    -- JSON array of IPs

  -- Intégrations (future use)
  slack_webhook_url       VARCHAR(2048),
  webhook_encryption_key  VARCHAR(255),

  -- Audit
  created_at  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_by  UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- ── RLS ────────────────────────────────────────────────────

ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read settings"
  ON public.platform_settings FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND role IN ('admin', 'super_admin')
    )
  );

CREATE POLICY "Admins can update settings"
  ON public.platform_settings FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND role IN ('admin', 'super_admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND role IN ('admin', 'super_admin')
    )
  );

-- ── Audit trigger ──────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.update_platform_settings_audit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  NEW.updated_at = NOW();
  NEW.updated_by = auth.uid();
  RETURN NEW;
END;
$$;

CREATE TRIGGER platform_settings_audit
  BEFORE UPDATE ON public.platform_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_platform_settings_audit();

-- ── Seed: single canonical row ─────────────────────────────

INSERT INTO public.platform_settings (
  id,
  platform_name,
  platform_url
)
VALUES (
  '00000000-0000-0000-0000-000000000000',
  'TORP',
  'https://torp.example.com'
)
ON CONFLICT (id) DO NOTHING;
