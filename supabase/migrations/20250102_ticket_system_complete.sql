-- =====================================================
-- MIGRATION: Système de Tickets TORP
-- Date: 2025-01-02
-- Description: Configuration complète pour la génération
--              et vérification publique des tickets TORP
-- =====================================================

-- =====================================================
-- ÉTAPE 1: Ajouter les colonnes ticket (si manquantes)
-- =====================================================

-- Vérifier et ajouter les colonnes manquantes dans pro_devis_analyses
DO $$ 
BEGIN
  -- ticket_genere
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'pro_devis_analyses' 
    AND column_name = 'ticket_genere'
  ) THEN
    ALTER TABLE pro_devis_analyses 
    ADD COLUMN ticket_genere boolean DEFAULT false;
    RAISE NOTICE 'Colonne ticket_genere ajoutée';
  END IF;

  -- ticket_code (UNIQUE)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'pro_devis_analyses' 
    AND column_name = 'ticket_code'
  ) THEN
    ALTER TABLE pro_devis_analyses 
    ADD COLUMN ticket_code text;
    RAISE NOTICE 'Colonne ticket_code ajoutée';
  END IF;

  -- ticket_url
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'pro_devis_analyses' 
    AND column_name = 'ticket_url'
  ) THEN
    ALTER TABLE pro_devis_analyses 
    ADD COLUMN ticket_url text;
    RAISE NOTICE 'Colonne ticket_url ajoutée';
  END IF;

  -- ticket_generated_at
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'pro_devis_analyses' 
    AND column_name = 'ticket_generated_at'
  ) THEN
    ALTER TABLE pro_devis_analyses 
    ADD COLUMN ticket_generated_at timestamptz;
    RAISE NOTICE 'Colonne ticket_generated_at ajoutée';
  END IF;

  -- ticket_view_count
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'pro_devis_analyses' 
    AND column_name = 'ticket_view_count'
  ) THEN
    ALTER TABLE pro_devis_analyses 
    ADD COLUMN ticket_view_count integer DEFAULT 0;
    RAISE NOTICE 'Colonne ticket_view_count ajoutée';
  END IF;

  -- ticket_last_viewed_at
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'pro_devis_analyses' 
    AND column_name = 'ticket_last_viewed_at'
  ) THEN
    ALTER TABLE pro_devis_analyses 
    ADD COLUMN ticket_last_viewed_at timestamptz;
    RAISE NOTICE 'Colonne ticket_last_viewed_at ajoutée';
  END IF;
END $$;

-- Index UNIQUE sur ticket_code (CRITICAL pour performance)
CREATE UNIQUE INDEX IF NOT EXISTS idx_ticket_code 
ON pro_devis_analyses(ticket_code) 
WHERE ticket_code IS NOT NULL;

-- Index pour recherche rapide par status et ticket
CREATE INDEX IF NOT EXISTS idx_analyses_ticket_status 
ON pro_devis_analyses(ticket_genere, status) 
WHERE ticket_genere = true;

COMMENT ON COLUMN pro_devis_analyses.ticket_code IS 'Code unique du ticket (6 caractères alphanumériques)';
COMMENT ON COLUMN pro_devis_analyses.ticket_url IS 'URL du PDF du ticket dans Storage';
COMMENT ON COLUMN pro_devis_analyses.ticket_view_count IS 'Nombre de fois que le ticket a été consulté';

-- =====================================================
-- ÉTAPE 2: Créer la table de tracking
-- =====================================================

CREATE TABLE IF NOT EXISTS ticket_tracking_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  analysis_id uuid NOT NULL REFERENCES pro_devis_analyses(id) ON DELETE CASCADE,
  event_type text NOT NULL CHECK (event_type IN ('qr_scanned', 'link_viewed', 'pdf_downloaded')),
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

-- Index pour performance
CREATE INDEX IF NOT EXISTS idx_tracking_analysis 
ON ticket_tracking_events(analysis_id);

CREATE INDEX IF NOT EXISTS idx_tracking_date 
ON ticket_tracking_events(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_tracking_event_type 
ON ticket_tracking_events(event_type);

COMMENT ON TABLE ticket_tracking_events IS 'Événements de tracking pour analytics des tickets TORP';
COMMENT ON COLUMN ticket_tracking_events.event_type IS 'Type: qr_scanned, link_viewed, pdf_downloaded';
COMMENT ON COLUMN ticket_tracking_events.metadata IS 'Données additionnelles: user_agent, referrer, etc.';

-- =====================================================
-- ÉTAPE 3: Créer la fonction d'incrémentation
-- =====================================================

CREATE OR REPLACE FUNCTION increment_ticket_view_count(p_analysis_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE pro_devis_analyses
  SET 
    ticket_view_count = COALESCE(ticket_view_count, 0) + 1,
    ticket_last_viewed_at = now()
  WHERE id = p_analysis_id;
END;
$$;

COMMENT ON FUNCTION increment_ticket_view_count IS 
'Incrémente le compteur de vues d''un ticket (accessible sans auth)';

-- =====================================================
-- ÉTAPE 4: Row Level Security (RLS)
-- =====================================================

-- Activer RLS sur les tables si pas déjà fait
ALTER TABLE pro_devis_analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE pro_company_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_tracking_events ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- Policies pour pro_devis_analyses
-- =====================================================

-- Policy: Utilisateurs authentifiés voient leurs propres analyses
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'pro_devis_analyses' 
    AND policyname = 'Users can view their own analyses'
  ) THEN
    CREATE POLICY "Users can view their own analyses"
    ON pro_devis_analyses FOR SELECT
    TO authenticated
    USING (user_id = auth.uid());
  END IF;
END $$;

-- Policy: Utilisateurs peuvent insérer leurs propres analyses
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'pro_devis_analyses' 
    AND policyname = 'Users can create analyses'
  ) THEN
    CREATE POLICY "Users can create analyses"
    ON pro_devis_analyses FOR INSERT
    TO authenticated
    WITH CHECK (user_id = auth.uid());
  END IF;
END $$;

-- Policy: Utilisateurs peuvent modifier leurs propres analyses
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'pro_devis_analyses' 
    AND policyname = 'Users can update their own analyses'
  ) THEN
    CREATE POLICY "Users can update their own analyses"
    ON pro_devis_analyses FOR UPDATE
    TO authenticated
    USING (user_id = auth.uid());
  END IF;
END $$;

-- Policy: PUBLIC peut voir les analyses avec ticket généré (CRITICAL)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'pro_devis_analyses' 
    AND policyname = 'Public can view ticket data'
  ) THEN
    CREATE POLICY "Public can view ticket data"
    ON pro_devis_analyses FOR SELECT
    TO public
    USING (ticket_genere = true AND ticket_code IS NOT NULL);
    RAISE NOTICE 'Policy PUBLIC créée pour accès tickets';
  END IF;
END $$;

-- =====================================================
-- Policies pour pro_company_profiles
-- =====================================================

-- Policy: Utilisateurs voient leur propre entreprise
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'pro_company_profiles' 
    AND policyname = 'Users can view their company'
  ) THEN
    CREATE POLICY "Users can view their company"
    ON pro_company_profiles FOR SELECT
    TO authenticated
    USING (user_id = auth.uid());
  END IF;
END $$;

-- Policy: PUBLIC peut voir les infos entreprise liées aux tickets (CRITICAL)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'pro_company_profiles' 
    AND policyname = 'Public can view company for tickets'
  ) THEN
    CREATE POLICY "Public can view company for tickets"
    ON pro_company_profiles FOR SELECT
    TO public
    USING (
      EXISTS (
        SELECT 1 FROM pro_devis_analyses
        WHERE company_id = pro_company_profiles.id
        AND ticket_genere = true
        AND ticket_code IS NOT NULL
      )
    );
    RAISE NOTICE 'Policy PUBLIC créée pour infos entreprise';
  END IF;
END $$;

-- =====================================================
-- Policies pour ticket_tracking_events
-- =====================================================

-- Policy: PUBLIC peut insérer des événements de tracking
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'ticket_tracking_events' 
    AND policyname = 'Public can track ticket views'
  ) THEN
    CREATE POLICY "Public can track ticket views"
    ON ticket_tracking_events FOR INSERT
    TO public
    WITH CHECK (true);
    RAISE NOTICE 'Policy PUBLIC créée pour tracking';
  END IF;
END $$;

-- Policy: Utilisateurs voient le tracking de leurs analyses
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'ticket_tracking_events' 
    AND policyname = 'Users can view their tracking'
  ) THEN
    CREATE POLICY "Users can view their tracking"
    ON ticket_tracking_events FOR SELECT
    TO authenticated
    USING (
      EXISTS (
        SELECT 1 FROM pro_devis_analyses
        WHERE id = ticket_tracking_events.analysis_id
        AND user_id = auth.uid()
      )
    );
  END IF;
END $$;

-- =====================================================
-- Policies pour company_documents (si nécessaire)
-- =====================================================

-- Policy: PUBLIC peut voir les documents des entreprises avec tickets
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'company_documents') THEN
    ALTER TABLE company_documents ENABLE ROW LEVEL SECURITY;
    
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies 
      WHERE tablename = 'company_documents' 
      AND policyname = 'Public can view documents for tickets'
    ) THEN
      CREATE POLICY "Public can view documents for tickets"
      ON company_documents FOR SELECT
      TO public
      USING (
        EXISTS (
          SELECT 1 FROM pro_devis_analyses
          WHERE company_id = company_documents.company_id
          AND ticket_genere = true
          AND ticket_code IS NOT NULL
        )
      );
      RAISE NOTICE 'Policy PUBLIC créée pour documents';
    END IF;
  END IF;
END $$;

-- =====================================================
-- ÉTAPE 5: Statistiques et vues utiles
-- =====================================================

-- Vue pour les statistiques de tickets
CREATE OR REPLACE VIEW ticket_stats AS
SELECT 
  COUNT(*) FILTER (WHERE ticket_genere = true) as total_tickets,
  COUNT(*) FILTER (WHERE ticket_genere = true AND ticket_view_count > 0) as tickets_viewed,
  SUM(ticket_view_count) as total_views,
  AVG(ticket_view_count) FILTER (WHERE ticket_genere = true) as avg_views_per_ticket,
  MAX(ticket_last_viewed_at) as last_view_at
FROM pro_devis_analyses;

COMMENT ON VIEW ticket_stats IS 'Statistiques globales sur les tickets TORP';

-- =====================================================
-- ÉTAPE 6: Vérifications post-migration
-- =====================================================

DO $$
DECLARE
  col_count integer;
  policy_count integer;
BEGIN
  -- Vérifier les colonnes
  SELECT COUNT(*) INTO col_count
  FROM information_schema.columns
  WHERE table_name = 'pro_devis_analyses'
  AND column_name IN ('ticket_genere', 'ticket_code', 'ticket_url', 'ticket_view_count');
  
  IF col_count = 4 THEN
    RAISE NOTICE '✅ Toutes les colonnes ticket sont présentes';
  ELSE
    RAISE WARNING '⚠️ Il manque des colonnes ticket (%/4)', col_count;
  END IF;

  -- Vérifier les policies publiques
  SELECT COUNT(*) INTO policy_count
  FROM pg_policies
  WHERE tablename IN ('pro_devis_analyses', 'pro_company_profiles')
  AND policyname LIKE '%Public%';
  
  IF policy_count >= 2 THEN
    RAISE NOTICE '✅ Policies publiques configurées';
  ELSE
    RAISE WARNING '⚠️ Il manque des policies publiques';
  END IF;

  -- Vérifier la fonction
  IF EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'increment_ticket_view_count'
  ) THEN
    RAISE NOTICE '✅ Fonction increment_ticket_view_count créée';
  ELSE
    RAISE WARNING '⚠️ Fonction increment_ticket_view_count manquante';
  END IF;

  -- Vérifier la table tracking
  IF EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_name = 'ticket_tracking_events'
  ) THEN
    RAISE NOTICE '✅ Table ticket_tracking_events créée';
  ELSE
    RAISE WARNING '⚠️ Table ticket_tracking_events manquante';
  END IF;

  RAISE NOTICE '========================================';
  RAISE NOTICE 'Migration terminée !';
  RAISE NOTICE 'N''oubliez pas de créer le bucket Storage "pro-tickets" dans l''interface Supabase';
  RAISE NOTICE '========================================';
END $$;

-- =====================================================
-- FIN DE LA MIGRATION
-- =====================================================
