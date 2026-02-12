-- ============================================================================
-- Migration 011: Essential Tables for MVP
-- ============================================================================
-- Creates additional tables needed for full MVP functionality
-- Complements 000-010 migrations
--

-- ============================================================================
-- TABLE: profiles (User profiles)
-- ============================================================================

CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  company_name TEXT,
  company_siret TEXT,
  phone TEXT,
  address TEXT,
  city TEXT,
  postal_code TEXT,
  country TEXT DEFAULT 'FR',

  -- Profile completion tracking
  profile_complete BOOLEAN DEFAULT FALSE,
  completion_percentage INTEGER DEFAULT 0,

  -- Preferences
  language TEXT DEFAULT 'fr',
  notifications_enabled BOOLEAN DEFAULT TRUE,

  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

CREATE INDEX idx_profiles_email ON profiles(email);
CREATE INDEX idx_profiles_company_siret ON profiles(company_siret);

-- RLS for profiles
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_can_read_own_profile" ON profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "users_can_update_own_profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "users_can_insert_own_profile" ON profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- ============================================================================
-- TABLE: devis_photos (Photo attachments for quotes)
-- ============================================================================

CREATE TABLE IF NOT EXISTS devis_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  devis_id UUID REFERENCES devis(id) ON DELETE CASCADE,
  ccf_id UUID REFERENCES ccf(id) ON DELETE CASCADE,

  -- Photo info
  photo_url TEXT NOT NULL,
  photo_type TEXT CHECK (photo_type IN ('before', 'after', 'context', 'detail')),
  description TEXT,

  -- Metadata
  uploaded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  uploaded_at TIMESTAMP DEFAULT now(),
  created_at TIMESTAMP DEFAULT now()
);

CREATE INDEX idx_devis_photos_devis_id ON devis_photos(devis_id);
CREATE INDEX idx_devis_photos_ccf_id ON devis_photos(ccf_id);
CREATE INDEX idx_devis_photos_uploaded_by ON devis_photos(uploaded_by);

-- ============================================================================
-- TABLE: search_history (Track user searches)
-- ============================================================================

CREATE TABLE IF NOT EXISTS search_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  ccf_id UUID REFERENCES ccf(id) ON DELETE CASCADE,

  -- Search details
  search_query TEXT,
  search_type TEXT CHECK (search_type IN ('company', 'devis', 'material', 'supplier')),
  search_filters JSONB,

  -- Results
  results_count INTEGER DEFAULT 0,
  selected_result_id TEXT,

  created_at TIMESTAMP DEFAULT now()
);

CREATE INDEX idx_search_history_user_id ON search_history(user_id);
CREATE INDEX idx_search_history_ccf_id ON search_history(ccf_id);
CREATE INDEX idx_search_history_created_at ON search_history(created_at DESC);

-- ============================================================================
-- TABLE: api_rate_limits (Track API usage)
-- ============================================================================

CREATE TABLE IF NOT EXISTS api_rate_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Rate limit tracking
  endpoint TEXT NOT NULL,
  requests_count INTEGER DEFAULT 0,
  requests_limit INTEGER DEFAULT 100,

  -- Time window
  window_start TIMESTAMP DEFAULT now(),
  window_end TIMESTAMP DEFAULT now() + INTERVAL '1 hour',

  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

CREATE INDEX idx_api_rate_limits_user_id ON api_rate_limits(user_id);
CREATE INDEX idx_api_rate_limits_endpoint ON api_rate_limits(endpoint);

-- ============================================================================
-- TABLE: audit_trail (Complete audit of all actions)
-- ============================================================================

CREATE TABLE IF NOT EXISTS audit_trail (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ccf_id UUID REFERENCES ccf(id) ON DELETE CASCADE,

  -- Action details
  action TEXT NOT NULL CHECK (action IN (
    'ccf_created', 'ccf_updated', 'ccf_deleted',
    'devis_uploaded', 'devis_analyzed', 'devis_deleted',
    'user_login', 'user_logout', 'profile_updated',
    'analysis_run', 'export_generated'
  )),

  resource_type TEXT CHECK (resource_type IN ('ccf', 'devis', 'profile', 'analysis', 'export')),
  resource_id TEXT,

  -- Changes
  old_values JSONB,
  new_values JSONB,
  change_description TEXT,

  -- IP & User Agent
  ip_address INET,
  user_agent TEXT,

  created_at TIMESTAMP DEFAULT now()
);

CREATE INDEX idx_audit_trail_user_id ON audit_trail(user_id);
CREATE INDEX idx_audit_trail_ccf_id ON audit_trail(ccf_id);
CREATE INDEX idx_audit_trail_action ON audit_trail(action);
CREATE INDEX idx_audit_trail_created_at ON audit_trail(created_at DESC);

-- ============================================================================
-- TABLE: feature_flags (Feature toggles for MVP)
-- ============================================================================

CREATE TABLE IF NOT EXISTS feature_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  feature_name TEXT UNIQUE NOT NULL,
  enabled BOOLEAN DEFAULT FALSE,

  -- Configuration
  description TEXT,
  config JSONB,

  -- Control
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

CREATE INDEX idx_feature_flags_name ON feature_flags(feature_name);

-- ============================================================================
-- FUNCTION: update_updated_at_column
-- Automatically updates updated_at timestamp
-- ============================================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply to profiles
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Apply to audit_trail
CREATE TRIGGER update_audit_trail_updated_at BEFORE UPDATE ON audit_trail
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Apply to api_rate_limits
CREATE TRIGGER update_api_rate_limits_updated_at BEFORE UPDATE ON api_rate_limits
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Apply to feature_flags
CREATE TRIGGER update_feature_flags_updated_at BEFORE UPDATE ON feature_flags
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- FUNCTION: handle_new_user
-- Auto-create profile when user signs up
-- ============================================================================

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, created_at, updated_at)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    now(),
    now()
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================================================
-- GRANTS for public schema
-- ============================================================================

GRANT SELECT, INSERT, UPDATE ON profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE ON devis_photos TO authenticated;
GRANT SELECT, INSERT ON search_history TO authenticated;
GRANT SELECT, INSERT ON api_rate_limits TO authenticated;
GRANT SELECT, INSERT ON audit_trail TO authenticated;
GRANT SELECT ON feature_flags TO authenticated;

-- Public read for analytics
GRANT SELECT ON audit_trail TO anon;

-- ============================================================================
-- FUNCTION: get_user_stats
-- Get user activity statistics
-- ============================================================================

CREATE OR REPLACE FUNCTION get_user_stats(user_id UUID)
RETURNS TABLE (
  ccf_count BIGINT,
  devis_count BIGINT,
  analyses_run BIGINT,
  last_activity TIMESTAMP,
  profile_complete BOOLEAN
) LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  SELECT
    (SELECT COUNT(*) FROM ccf WHERE ccf.id::TEXT = user_id::TEXT)::BIGINT,
    (SELECT COUNT(*) FROM devis WHERE devis.user_id = user_id)::BIGINT,
    (SELECT COUNT(*) FROM audit_trail WHERE audit_trail.action = 'analysis_run' AND audit_trail.user_id = user_id)::BIGINT,
    (SELECT MAX(created_at) FROM audit_trail WHERE audit_trail.user_id = user_id),
    (SELECT profile_complete FROM profiles WHERE id = user_id);
END;
$$;

-- ============================================================================
-- VERIFICATION
-- ============================================================================

-- After applying this migration, verify tables exist:
-- SELECT table_name FROM information_schema.tables
-- WHERE table_schema = 'public' ORDER BY table_name;
--
-- Expected new tables:
-- - profiles
-- - devis_photos
-- - search_history
-- - api_rate_limits
-- - audit_trail
-- - feature_flags
--
