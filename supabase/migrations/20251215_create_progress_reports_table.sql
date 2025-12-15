-- Migration: Create progress_reports table for Phase 3
-- Description: Table pour stocker les rapports d'avancement hebdomadaires générés par l'IA

-- ============================================================================
-- TABLE: progress_reports - Rapports d'avancement
-- ============================================================================
CREATE TABLE IF NOT EXISTS progress_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    projet_id UUID NOT NULL REFERENCES projets(id) ON DELETE CASCADE,
    semaine VARCHAR(10) NOT NULL, -- Format: YYYY-Wxx (ex: 2025-W01)
    type VARCHAR(50) DEFAULT 'hebdomadaire' CHECK (type IN ('hebdomadaire', 'mensuel', 'exceptionnel')),

    -- Contenu du rapport (JSON structuré)
    contenu JSONB NOT NULL DEFAULT '{}',

    -- Métriques clés pour requêtes rapides
    avancement_global DECIMAL(5,2) CHECK (avancement_global >= 0 AND avancement_global <= 100),
    tendance VARCHAR(20) CHECK (tendance IN ('en_avance', 'conforme', 'leger_retard', 'retard_critique')),
    alertes_count INTEGER DEFAULT 0,
    alertes_critiques INTEGER DEFAULT 0,

    -- Métadonnées
    genere_par VARCHAR(100) DEFAULT 'SiteMonitoringAgent',
    version_agent VARCHAR(20) DEFAULT '1.0.0',
    temps_generation_ms INTEGER,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index pour les recherches fréquentes
CREATE INDEX IF NOT EXISTS idx_progress_reports_projet_id ON progress_reports(projet_id);
CREATE INDEX IF NOT EXISTS idx_progress_reports_semaine ON progress_reports(semaine);
CREATE INDEX IF NOT EXISTS idx_progress_reports_created_at ON progress_reports(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_progress_reports_tendance ON progress_reports(tendance);

-- Index unique pour éviter les doublons par semaine
CREATE UNIQUE INDEX IF NOT EXISTS idx_progress_reports_projet_semaine
    ON progress_reports(projet_id, semaine, type);

-- Trigger pour updated_at
CREATE OR REPLACE FUNCTION update_progress_reports_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_progress_reports_updated_at
    BEFORE UPDATE ON progress_reports
    FOR EACH ROW
    EXECUTE FUNCTION update_progress_reports_updated_at();

-- ============================================================================
-- TABLE: quality_scores - Scores qualité historiques
-- ============================================================================
CREATE TABLE IF NOT EXISTS quality_scores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    projet_id UUID NOT NULL REFERENCES projets(id) ON DELETE CASCADE,
    date_calcul TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Score global
    score_global DECIMAL(5,2) CHECK (score_global >= 0 AND score_global <= 100),
    tendance VARCHAR(20) CHECK (tendance IN ('amelioration', 'stable', 'degradation')),

    -- Détail par lot (JSON)
    scores_par_lot JSONB DEFAULT '[]',
    points_forts TEXT[] DEFAULT '{}',
    points_faibles TEXT[] DEFAULT '{}',

    -- Métadonnées
    genere_par VARCHAR(100) DEFAULT 'QualityAgent',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index
CREATE INDEX IF NOT EXISTS idx_quality_scores_projet_id ON quality_scores(projet_id);
CREATE INDEX IF NOT EXISTS idx_quality_scores_date ON quality_scores(date_calcul DESC);

-- ============================================================================
-- TABLE: photo_analyses - Analyses de photos par IA
-- ============================================================================
CREATE TABLE IF NOT EXISTS photo_analyses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    projet_id UUID NOT NULL REFERENCES projets(id) ON DELETE CASCADE,
    lot_id UUID REFERENCES lots(id) ON DELETE SET NULL,

    -- Photo
    photo_url TEXT NOT NULL,
    photo_storage_path TEXT,
    zone VARCHAR(100),

    -- Résultats d'analyse
    elements_detectes JSONB DEFAULT '[]',
    anomalies JSONB DEFAULT '[]',
    avancement_estime DECIMAL(5,2) CHECK (avancement_estime >= 0 AND avancement_estime <= 100),
    conformite_generale VARCHAR(20) CHECK (conformite_generale IN ('conforme', 'attention', 'non_conforme')),
    commentaire_ia TEXT,
    tags TEXT[] DEFAULT '{}',
    confiance DECIMAL(5,2) CHECK (confiance >= 0 AND confiance <= 100),

    -- Métadonnées
    modele_ia VARCHAR(50) DEFAULT 'gpt-4o',
    temps_analyse_ms INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index
CREATE INDEX IF NOT EXISTS idx_photo_analyses_projet_id ON photo_analyses(projet_id);
CREATE INDEX IF NOT EXISTS idx_photo_analyses_lot_id ON photo_analyses(lot_id);
CREATE INDEX IF NOT EXISTS idx_photo_analyses_conformite ON photo_analyses(conformite_generale);
CREATE INDEX IF NOT EXISTS idx_photo_analyses_created_at ON photo_analyses(created_at DESC);

-- Index GIN pour recherche dans les tags
CREATE INDEX IF NOT EXISTS idx_photo_analyses_tags ON photo_analyses USING GIN(tags);

-- ============================================================================
-- RLS Policies
-- ============================================================================

-- Enable RLS
ALTER TABLE progress_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE quality_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE photo_analyses ENABLE ROW LEVEL SECURITY;

-- Policies pour progress_reports
CREATE POLICY "Users can view progress reports of their projects"
    ON progress_reports FOR SELECT
    USING (
        projet_id IN (
            SELECT id FROM projets
            WHERE user_id = auth.uid()
            OR id IN (SELECT projet_id FROM projet_membres WHERE user_id = auth.uid())
        )
    );

CREATE POLICY "Users can insert progress reports for their projects"
    ON progress_reports FOR INSERT
    WITH CHECK (
        projet_id IN (
            SELECT id FROM projets
            WHERE user_id = auth.uid()
            OR id IN (SELECT projet_id FROM projet_membres WHERE user_id = auth.uid() AND role IN ('admin', 'editeur'))
        )
    );

-- Policies pour quality_scores
CREATE POLICY "Users can view quality scores of their projects"
    ON quality_scores FOR SELECT
    USING (
        projet_id IN (
            SELECT id FROM projets
            WHERE user_id = auth.uid()
            OR id IN (SELECT projet_id FROM projet_membres WHERE user_id = auth.uid())
        )
    );

CREATE POLICY "Users can insert quality scores for their projects"
    ON quality_scores FOR INSERT
    WITH CHECK (
        projet_id IN (
            SELECT id FROM projets
            WHERE user_id = auth.uid()
            OR id IN (SELECT projet_id FROM projet_membres WHERE user_id = auth.uid() AND role IN ('admin', 'editeur'))
        )
    );

-- Policies pour photo_analyses
CREATE POLICY "Users can view photo analyses of their projects"
    ON photo_analyses FOR SELECT
    USING (
        projet_id IN (
            SELECT id FROM projets
            WHERE user_id = auth.uid()
            OR id IN (SELECT projet_id FROM projet_membres WHERE user_id = auth.uid())
        )
    );

CREATE POLICY "Users can insert photo analyses for their projects"
    ON photo_analyses FOR INSERT
    WITH CHECK (
        projet_id IN (
            SELECT id FROM projets
            WHERE user_id = auth.uid()
            OR id IN (SELECT projet_id FROM projet_membres WHERE user_id = auth.uid() AND role IN ('admin', 'editeur'))
        )
    );

-- ============================================================================
-- Comments
-- ============================================================================
COMMENT ON TABLE progress_reports IS 'Rapports d''avancement hebdomadaires générés par SiteMonitoringAgent';
COMMENT ON TABLE quality_scores IS 'Historique des scores qualité calculés par QualityAgent';
COMMENT ON TABLE photo_analyses IS 'Résultats d''analyse des photos de chantier par PhotoAnalysisAgent';

COMMENT ON COLUMN progress_reports.contenu IS 'Contenu JSON structuré du rapport: resume, alertes, actionsPrioritaires, etc.';
COMMENT ON COLUMN progress_reports.semaine IS 'Semaine ISO au format YYYY-Wxx';
COMMENT ON COLUMN photo_analyses.elements_detectes IS 'Éléments détectés sur la photo: {type, description, zone, etat, confiance}';
COMMENT ON COLUMN photo_analyses.anomalies IS 'Anomalies détectées: {type, severite, description, localisation, actionRequise}';
