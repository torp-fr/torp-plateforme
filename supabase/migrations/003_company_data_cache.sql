-- Migration: Company Data Cache System
-- Description: Creates tables and functions for intelligent caching of company data
-- Author: Claude Code
-- Date: 2025-11-24

-- =============================================================================
-- TABLE: company_data_cache
-- Purpose: Cache company data from various APIs with intelligent refresh logic
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.company_data_cache (
    -- Primary identification
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    siret TEXT NOT NULL UNIQUE,
    siren TEXT NOT NULL,
    company_name TEXT NOT NULL,
    legal_name TEXT,

    -- Data source tracking
    data_source TEXT NOT NULL CHECK (data_source IN (
        'recherche-entreprises',
        'pappers',
        'combined',
        'manual'
    )),

    -- Cached data (flexible JSON structure)
    cached_data JSONB NOT NULL DEFAULT '{}'::jsonb,

    -- Quality & reliability metrics
    quality_score INTEGER DEFAULT 0 CHECK (quality_score >= 0 AND quality_score <= 100),
    data_completeness INTEGER DEFAULT 0 CHECK (data_completeness >= 0 AND data_completeness <= 100),

    -- Cache management
    fetch_count INTEGER DEFAULT 0,
    last_fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    next_refresh_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '90 days'),

    -- Refresh strategy
    refresh_strategy TEXT DEFAULT 'standard' CHECK (refresh_strategy IN (
        'standard',      -- 90 days TTL
        'frequent',      -- 30 days TTL (for active companies)
        'on-demand',     -- Manual refresh only
        'expired'        -- Needs immediate refresh
    )),

    -- Audit fields
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id),
    updated_by UUID REFERENCES auth.users(id)
);

-- =============================================================================
-- INDEXES
-- =============================================================================

-- Primary lookup indexes
CREATE INDEX idx_company_cache_siret ON public.company_data_cache(siret);
CREATE INDEX idx_company_cache_siren ON public.company_data_cache(siren);
CREATE INDEX idx_company_cache_company_name ON public.company_data_cache(company_name);

-- Cache management indexes
CREATE INDEX idx_company_cache_next_refresh ON public.company_data_cache(next_refresh_at);
CREATE INDEX idx_company_cache_last_fetched ON public.company_data_cache(last_fetched_at);
CREATE INDEX idx_company_cache_fetch_count ON public.company_data_cache(fetch_count);
CREATE INDEX idx_company_cache_quality_score ON public.company_data_cache(quality_score);

-- Data source index
CREATE INDEX idx_company_cache_data_source ON public.company_data_cache(data_source);

-- Composite index for refresh logic
CREATE INDEX idx_company_cache_refresh_logic ON public.company_data_cache(
    next_refresh_at,
    fetch_count,
    refresh_strategy
);

-- JSONB indexes for common queries
CREATE INDEX idx_company_cache_data_gin ON public.company_data_cache USING GIN (cached_data);

-- =============================================================================
-- TRIGGER: Update updated_at timestamp
-- =============================================================================

CREATE OR REPLACE FUNCTION update_company_cache_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_company_cache_timestamp
    BEFORE UPDATE ON public.company_data_cache
    FOR EACH ROW
    EXECUTE FUNCTION update_company_cache_updated_at();

-- =============================================================================
-- FUNCTION: Check if cache needs refresh
-- =============================================================================

CREATE OR REPLACE FUNCTION should_refresh_company_cache(
    p_siret TEXT
)
RETURNS BOOLEAN AS $$
DECLARE
    v_cache_record RECORD;
    v_age_days INTEGER;
BEGIN
    -- Get cache record
    SELECT * INTO v_cache_record
    FROM public.company_data_cache
    WHERE siret = p_siret;

    -- If no cache, needs refresh
    IF NOT FOUND THEN
        RETURN TRUE;
    END IF;

    -- Calculate age in days
    v_age_days := EXTRACT(EPOCH FROM (NOW() - v_cache_record.last_fetched_at)) / 86400;

    -- Check if next_refresh_at has passed
    IF NOW() >= v_cache_record.next_refresh_at THEN
        RETURN TRUE;
    END IF;

    -- Check refresh strategy
    CASE v_cache_record.refresh_strategy
        WHEN 'expired' THEN
            RETURN TRUE;
        WHEN 'frequent' THEN
            -- Refresh after 30 days
            RETURN v_age_days > 30;
        WHEN 'on-demand' THEN
            RETURN FALSE;
        ELSE -- 'standard'
            -- Smart refresh: if fetch_count > 10 AND age > 30 days
            IF v_cache_record.fetch_count > 10 AND v_age_days > 30 THEN
                RETURN TRUE;
            END IF;

            -- Otherwise respect the 90-day TTL
            RETURN v_age_days > 90;
    END CASE;

    RETURN FALSE;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- FUNCTION: Increment fetch count
-- =============================================================================

CREATE OR REPLACE FUNCTION increment_company_cache_fetch_count(
    p_siret TEXT
)
RETURNS INTEGER AS $$
DECLARE
    v_new_count INTEGER;
    v_age_days INTEGER;
BEGIN
    UPDATE public.company_data_cache
    SET
        fetch_count = fetch_count + 1,
        -- Auto-upgrade to 'frequent' strategy if highly solicited
        refresh_strategy = CASE
            WHEN fetch_count + 1 > 20 AND refresh_strategy = 'standard' THEN 'frequent'
            ELSE refresh_strategy
        END
    WHERE siret = p_siret
    RETURNING fetch_count INTO v_new_count;

    -- Check if we should anticipate refresh
    SELECT EXTRACT(EPOCH FROM (NOW() - last_fetched_at)) / 86400 INTO v_age_days
    FROM public.company_data_cache
    WHERE siret = p_siret;

    -- If highly solicited and getting old, mark for refresh
    IF v_new_count > 10 AND v_age_days > 30 THEN
        UPDATE public.company_data_cache
        SET next_refresh_at = NOW() + INTERVAL '1 day'
        WHERE siret = p_siret;
    END IF;

    RETURN v_new_count;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- FUNCTION: Upsert company cache data
-- =============================================================================

CREATE OR REPLACE FUNCTION upsert_company_cache(
    p_siret TEXT,
    p_siren TEXT,
    p_company_name TEXT,
    p_legal_name TEXT,
    p_data_source TEXT,
    p_cached_data JSONB,
    p_quality_score INTEGER DEFAULT NULL,
    p_data_completeness INTEGER DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    v_cache_id UUID;
    v_refresh_strategy TEXT;
BEGIN
    -- Determine refresh strategy based on data quality
    v_refresh_strategy := CASE
        WHEN p_quality_score >= 90 THEN 'standard'
        WHEN p_quality_score >= 70 THEN 'frequent'
        ELSE 'frequent'
    END;

    -- Upsert cache data
    INSERT INTO public.company_data_cache (
        siret,
        siren,
        company_name,
        legal_name,
        data_source,
        cached_data,
        quality_score,
        data_completeness,
        fetch_count,
        last_fetched_at,
        next_refresh_at,
        refresh_strategy
    ) VALUES (
        p_siret,
        p_siren,
        p_company_name,
        p_legal_name,
        p_data_source,
        p_cached_data,
        COALESCE(p_quality_score, 50),
        COALESCE(p_data_completeness, 50),
        1, -- Initial fetch count
        NOW(),
        NOW() + INTERVAL '90 days',
        v_refresh_strategy
    )
    ON CONFLICT (siret) DO UPDATE SET
        company_name = EXCLUDED.company_name,
        legal_name = EXCLUDED.legal_name,
        data_source = EXCLUDED.data_source,
        cached_data = EXCLUDED.cached_data,
        quality_score = EXCLUDED.quality_score,
        data_completeness = EXCLUDED.data_completeness,
        last_fetched_at = NOW(),
        next_refresh_at = NOW() + INTERVAL '90 days',
        refresh_strategy = v_refresh_strategy,
        updated_at = NOW()
    RETURNING id INTO v_cache_id;

    RETURN v_cache_id;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- FUNCTION: Get cached company data
-- =============================================================================

CREATE OR REPLACE FUNCTION get_cached_company_data(
    p_siret TEXT
)
RETURNS TABLE (
    id UUID,
    siret TEXT,
    siren TEXT,
    company_name TEXT,
    legal_name TEXT,
    data_source TEXT,
    cached_data JSONB,
    quality_score INTEGER,
    data_completeness INTEGER,
    fetch_count INTEGER,
    last_fetched_at TIMESTAMPTZ,
    needs_refresh BOOLEAN,
    age_days INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        c.id,
        c.siret,
        c.siren,
        c.company_name,
        c.legal_name,
        c.data_source,
        c.cached_data,
        c.quality_score,
        c.data_completeness,
        c.fetch_count,
        c.last_fetched_at,
        should_refresh_company_cache(c.siret) AS needs_refresh,
        CAST(EXTRACT(EPOCH FROM (NOW() - c.last_fetched_at)) / 86400 AS INTEGER) AS age_days
    FROM public.company_data_cache c
    WHERE c.siret = p_siret;

    -- Increment fetch count if found
    IF FOUND THEN
        PERFORM increment_company_cache_fetch_count(p_siret);
    END IF;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- FUNCTION: Clean expired cache entries
-- =============================================================================

CREATE OR REPLACE FUNCTION clean_expired_company_cache()
RETURNS INTEGER AS $$
DECLARE
    v_deleted_count INTEGER;
BEGIN
    -- Delete entries that are:
    -- 1. Older than 180 days AND fetch_count = 0 (never used)
    -- 2. Older than 365 days AND fetch_count < 5 (rarely used)
    WITH deleted AS (
        DELETE FROM public.company_data_cache
        WHERE
            (EXTRACT(EPOCH FROM (NOW() - last_fetched_at)) / 86400 > 180 AND fetch_count = 0)
            OR
            (EXTRACT(EPOCH FROM (NOW() - last_fetched_at)) / 86400 > 365 AND fetch_count < 5)
        RETURNING *
    )
    SELECT COUNT(*) INTO v_deleted_count FROM deleted;

    RETURN v_deleted_count;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- TABLE: company_search_history
-- Purpose: Track company searches for analytics and optimization
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.company_search_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    siret TEXT,
    siren TEXT,
    search_query TEXT,
    search_type TEXT CHECK (search_type IN ('siret', 'siren', 'name', 'extracted')),
    found BOOLEAN NOT NULL,
    cache_hit BOOLEAN NOT NULL DEFAULT FALSE,
    api_calls_made TEXT[], -- List of APIs called
    response_time_ms INTEGER,
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    devis_id UUID REFERENCES public.devis(id) ON DELETE SET NULL
);

-- Index for analytics
CREATE INDEX idx_company_search_history_siret ON public.company_search_history(siret);
CREATE INDEX idx_company_search_history_created_at ON public.company_search_history(created_at);
CREATE INDEX idx_company_search_history_cache_hit ON public.company_search_history(cache_hit);

-- =============================================================================
-- ROW LEVEL SECURITY (RLS)
-- =============================================================================

-- Enable RLS
ALTER TABLE public.company_data_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_search_history ENABLE ROW LEVEL SECURITY;

-- Service role has full access
CREATE POLICY "Service role full access to company cache"
    ON public.company_data_cache
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Service role full access to search history"
    ON public.company_search_history
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Authenticated users can read company cache
CREATE POLICY "Authenticated users can read company cache"
    ON public.company_data_cache
    FOR SELECT
    TO authenticated
    USING (true);

-- Admins can manage cache
CREATE POLICY "Admins can manage company cache"
    ON public.company_data_cache
    FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM auth.users
            WHERE auth.users.id = auth.uid()
            AND auth.users.role = 'admin'
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM auth.users
            WHERE auth.users.id = auth.uid()
            AND auth.users.role = 'admin'
        )
    );

-- =============================================================================
-- COMMENTS
-- =============================================================================

COMMENT ON TABLE public.company_data_cache IS 'Cache intelligent pour les données d''entreprise provenant de diverses APIs (Recherche Entreprises, Pappers, etc.)';
COMMENT ON COLUMN public.company_data_cache.siret IS 'Numéro SIRET unique de l''établissement (14 chiffres)';
COMMENT ON COLUMN public.company_data_cache.siren IS 'Numéro SIREN de l''unité légale (9 premiers chiffres du SIRET)';
COMMENT ON COLUMN public.company_data_cache.cached_data IS 'Données complètes de l''entreprise au format JSONB flexible';
COMMENT ON COLUMN public.company_data_cache.quality_score IS 'Score de qualité des données (0-100) basé sur la complétude et la fiabilité';
COMMENT ON COLUMN public.company_data_cache.fetch_count IS 'Nombre de fois où ces données ont été sollicitées (pour optimiser le rafraîchissement)';
COMMENT ON COLUMN public.company_data_cache.next_refresh_at IS 'Date calculée du prochain rafraîchissement (TTL: 90 jours par défaut)';
COMMENT ON COLUMN public.company_data_cache.refresh_strategy IS 'Stratégie de rafraîchissement: standard (90j), frequent (30j), on-demand, expired';

COMMENT ON FUNCTION should_refresh_company_cache(TEXT) IS 'Détermine si les données en cache doivent être rafraîchies selon la stratégie TTL et le fetch_count';
COMMENT ON FUNCTION increment_company_cache_fetch_count(TEXT) IS 'Incrémente le compteur d''utilisation et ajuste la stratégie de rafraîchissement si nécessaire';
COMMENT ON FUNCTION upsert_company_cache IS 'Insert ou update les données d''entreprise dans le cache avec gestion intelligente du TTL';
COMMENT ON FUNCTION get_cached_company_data(TEXT) IS 'Récupère les données d''entreprise du cache et incrémente automatiquement le fetch_count';
COMMENT ON FUNCTION clean_expired_company_cache() IS 'Nettoie les entrées de cache obsolètes selon leur âge et utilisation';

-- =============================================================================
-- GRANTS
-- =============================================================================

GRANT SELECT ON public.company_data_cache TO authenticated;
GRANT ALL ON public.company_data_cache TO service_role;
GRANT ALL ON public.company_search_history TO service_role;

-- =============================================================================
-- INITIAL DATA / SEED (Optional)
-- =============================================================================

-- No initial data needed for cache tables

-- =============================================================================
-- END OF MIGRATION
-- =============================================================================
