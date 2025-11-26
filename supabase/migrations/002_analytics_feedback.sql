-- =====================================================
-- TORP Analytics & Feedback System
-- Migration: 002_analytics_feedback.sql
-- Description: Tables pour tracking métriques et feedback testeurs
-- Date: 2025-11-26
-- =====================================================

-- =====================================================
-- TABLE: analytics_events
-- Description: Tracking de tous les événements utilisateurs
-- =====================================================
CREATE TABLE IF NOT EXISTS analytics_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- User info
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id TEXT NOT NULL,

  -- Event details
  event_type TEXT NOT NULL, -- 'signup', 'login', 'devis_upload', 'devis_analyzed', 'score_viewed', etc.
  event_category TEXT NOT NULL, -- 'auth', 'devis', 'payment', 'feedback', etc.

  -- User type
  user_type TEXT CHECK (user_type IN ('B2C', 'B2B')),

  -- Event metadata (JSON flexible)
  metadata JSONB DEFAULT '{}',

  -- Technical info
  user_agent TEXT,
  ip_address INET,
  referrer TEXT,

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index pour performance
CREATE INDEX idx_analytics_events_user_id ON analytics_events(user_id);
CREATE INDEX idx_analytics_events_event_type ON analytics_events(event_type);
CREATE INDEX idx_analytics_events_created_at ON analytics_events(created_at DESC);
CREATE INDEX idx_analytics_events_user_type ON analytics_events(user_type);

-- RLS Policies
ALTER TABLE analytics_events ENABLE ROW LEVEL SECURITY;

-- Les utilisateurs peuvent voir leurs propres événements
CREATE POLICY "Users can view their own events"
  ON analytics_events
  FOR SELECT
  USING (auth.uid() = user_id);

-- Tout le monde peut insérer des événements (tracking)
CREATE POLICY "Anyone can insert events"
  ON analytics_events
  FOR INSERT
  WITH CHECK (true);

-- =====================================================
-- TABLE: user_feedback
-- Description: Collecte des retours utilisateurs
-- =====================================================
CREATE TABLE IF NOT EXISTS user_feedback (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- User info
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  user_email TEXT,
  user_type TEXT CHECK (user_type IN ('B2C', 'B2B')),

  -- Feedback details
  feedback_type TEXT NOT NULL, -- 'bug', 'feature_request', 'improvement', 'praise', 'other'
  category TEXT, -- 'ui', 'performance', 'feature', 'documentation', etc.

  -- Rating
  satisfaction_score INTEGER CHECK (satisfaction_score >= 1 AND satisfaction_score <= 5),

  -- Content
  title TEXT,
  message TEXT NOT NULL,

  -- Context
  page_url TEXT,
  screenshot_url TEXT,

  -- Metadata
  metadata JSONB DEFAULT '{}',

  -- Status
  status TEXT DEFAULT 'new' CHECK (status IN ('new', 'reviewed', 'in_progress', 'resolved', 'closed')),
  admin_notes TEXT,

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index pour performance
CREATE INDEX idx_user_feedback_user_id ON user_feedback(user_id);
CREATE INDEX idx_user_feedback_status ON user_feedback(status);
CREATE INDEX idx_user_feedback_created_at ON user_feedback(created_at DESC);
CREATE INDEX idx_user_feedback_user_type ON user_feedback(user_type);

-- RLS Policies
ALTER TABLE user_feedback ENABLE ROW LEVEL SECURITY;

-- Les utilisateurs peuvent voir leur propre feedback
CREATE POLICY "Users can view their own feedback"
  ON user_feedback
  FOR SELECT
  USING (auth.uid() = user_id);

-- Les utilisateurs peuvent insérer leur feedback
CREATE POLICY "Users can insert feedback"
  ON user_feedback
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Les utilisateurs peuvent mettre à jour leur propre feedback (avant résolution)
CREATE POLICY "Users can update their own feedback"
  ON user_feedback
  FOR UPDATE
  USING (auth.uid() = user_id AND status = 'new');

-- =====================================================
-- TABLE: devis_analysis_metrics
-- Description: Métriques détaillées pour chaque analyse de devis
-- =====================================================
CREATE TABLE IF NOT EXISTS devis_analysis_metrics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- References
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  devis_id UUID, -- Reference to devis table if exists

  -- User type
  user_type TEXT CHECK (user_type IN ('B2C', 'B2B')),

  -- Analysis metrics
  torp_score_overall DECIMAL(3,1), -- Score global (0.0 - 10.0)
  torp_score_transparency DECIMAL(3,1),
  torp_score_offer DECIMAL(3,1),
  torp_score_robustness DECIMAL(3,1),
  torp_score_price DECIMAL(3,1),
  grade TEXT, -- 'A+', 'A', 'B+', etc.

  -- Performance metrics
  analysis_duration_ms INTEGER, -- Temps d'analyse en millisecondes
  file_size_bytes INTEGER,
  file_type TEXT,

  -- Upload metrics
  upload_success BOOLEAN DEFAULT true,
  upload_error TEXT,

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index pour performance
CREATE INDEX idx_devis_analysis_user_id ON devis_analysis_metrics(user_id);
CREATE INDEX idx_devis_analysis_user_type ON devis_analysis_metrics(user_type);
CREATE INDEX idx_devis_analysis_created_at ON devis_analysis_metrics(created_at DESC);

-- RLS Policies
ALTER TABLE devis_analysis_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own metrics"
  ON devis_analysis_metrics
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert metrics"
  ON devis_analysis_metrics
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- =====================================================
-- VIEWS: Aggregated Metrics
-- Description: Vues pour faciliter les requêtes de métriques
-- =====================================================

-- Vue: Statistiques générales
CREATE OR REPLACE VIEW analytics_overview AS
SELECT
  -- Inscriptions
  COUNT(DISTINCT CASE WHEN event_type = 'signup' THEN user_id END) as total_signups,

  -- Analyses
  COUNT(CASE WHEN event_type = 'devis_analyzed' THEN 1 END) as total_analyses,

  -- Par user type
  COUNT(DISTINCT CASE WHEN event_type = 'signup' AND user_type = 'B2C' THEN user_id END) as b2c_signups,
  COUNT(DISTINCT CASE WHEN event_type = 'signup' AND user_type = 'B2B' THEN user_id END) as b2b_signups,

  COUNT(CASE WHEN event_type = 'devis_analyzed' AND user_type = 'B2C' THEN 1 END) as b2c_analyses,
  COUNT(CASE WHEN event_type = 'devis_analyzed' AND user_type = 'B2B' THEN 1 END) as b2b_analyses,

  -- Période
  MIN(created_at) as first_event,
  MAX(created_at) as last_event
FROM analytics_events;

-- Vue: Scores TORP moyens
CREATE OR REPLACE VIEW torp_score_averages AS
SELECT
  user_type,
  COUNT(*) as total_analyses,
  ROUND(AVG(torp_score_overall), 2) as avg_overall_score,
  ROUND(AVG(torp_score_transparency), 2) as avg_transparency,
  ROUND(AVG(torp_score_offer), 2) as avg_offer,
  ROUND(AVG(torp_score_robustness), 2) as avg_robustness,
  ROUND(AVG(torp_score_price), 2) as avg_price,
  ROUND(AVG(analysis_duration_ms), 0) as avg_duration_ms
FROM devis_analysis_metrics
WHERE upload_success = true
GROUP BY user_type;

-- Vue: Feedback summary
CREATE OR REPLACE VIEW feedback_summary AS
SELECT
  status,
  feedback_type,
  user_type,
  COUNT(*) as count,
  ROUND(AVG(satisfaction_score), 2) as avg_satisfaction
FROM user_feedback
GROUP BY status, feedback_type, user_type;

-- =====================================================
-- FUNCTIONS: Helper functions
-- =====================================================

-- Function: Track event
CREATE OR REPLACE FUNCTION track_event(
  p_event_type TEXT,
  p_event_category TEXT,
  p_user_type TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_event_id UUID;
BEGIN
  INSERT INTO analytics_events (
    user_id,
    session_id,
    event_type,
    event_category,
    user_type,
    metadata
  ) VALUES (
    auth.uid(),
    gen_random_uuid()::TEXT,
    p_event_type,
    p_event_category,
    p_user_type,
    p_metadata
  )
  RETURNING id INTO v_event_id;

  RETURN v_event_id;
END;
$$;

-- Function: Get user stats
CREATE OR REPLACE FUNCTION get_user_stats(p_user_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_stats JSON;
BEGIN
  SELECT json_build_object(
    'total_analyses', COUNT(*),
    'avg_score', ROUND(AVG(torp_score_overall), 2),
    'best_score', MAX(torp_score_overall),
    'worst_score', MIN(torp_score_overall),
    'total_upload_errors', COUNT(CASE WHEN upload_success = false THEN 1 END)
  )
  INTO v_stats
  FROM devis_analysis_metrics
  WHERE user_id = p_user_id;

  RETURN v_stats;
END;
$$;

-- =====================================================
-- TRIGGERS: Auto-update timestamps
-- =====================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_user_feedback_updated_at
  BEFORE UPDATE ON user_feedback
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- COMMENTS
-- =====================================================
COMMENT ON TABLE analytics_events IS 'Tracking de tous les événements utilisateurs (signups, analyses, etc.)';
COMMENT ON TABLE user_feedback IS 'Collecte des retours et suggestions des testeurs';
COMMENT ON TABLE devis_analysis_metrics IS 'Métriques détaillées de chaque analyse de devis';
COMMENT ON VIEW analytics_overview IS 'Vue d''ensemble des statistiques globales';
COMMENT ON VIEW torp_score_averages IS 'Moyennes des scores TORP par type d''utilisateur';
COMMENT ON VIEW feedback_summary IS 'Résumé des feedbacks par statut et type';

-- =====================================================
-- END OF MIGRATION
-- =====================================================
