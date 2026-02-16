-- PHASE 30 — LIVE INTELLIGENCE ACTIVATION
-- Migration: Live Data Integration & API Caching
-- Date: 2026-02-16
-- Status: Production-Ready

-- ============================================================================
-- TABLE: doctrine_sources
-- ============================================================================
-- Authoritative doctrine sources (DTU, norms, guides, jurisprudence)
-- Stores metadata for 40+ predefined sources + user-ingested documents

CREATE TABLE IF NOT EXISTS doctrine_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Source identification
  source_id VARCHAR(100) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  source_type VARCHAR(50) NOT NULL, -- DTU, NORME, GUIDE, JURISPRUDENCE, TECHNIQUE, GUIDE_ADEME
  description TEXT,

  -- Authority and legal weight
  authority_level SMALLINT NOT NULL CHECK (authority_level >= 1 AND authority_level <= 5),
  legal_weight SMALLINT NOT NULL CHECK (legal_weight >= 1 AND legal_weight <= 5),
  enforceable BOOLEAN DEFAULT FALSE,

  -- Classification
  sector_tags TEXT[] DEFAULT ARRAY[]::TEXT[],
  issuing_authority VARCHAR(100),

  -- Validity
  valid_from TIMESTAMP WITH TIME ZONE,
  valid_until TIMESTAMP WITH TIME ZONE,

  -- Document reference
  document_url VARCHAR(500),

  -- Audit
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  CONSTRAINT valid_source_type CHECK (
    source_type IN ('DTU', 'NORME', 'GUIDE', 'JURISPRUDENCE', 'TECHNIQUE', 'GUIDE_ADEME')
  )
);

CREATE INDEX IF NOT EXISTS idx_doctrine_sources_type ON doctrine_sources(source_type);
CREATE INDEX IF NOT EXISTS idx_doctrine_sources_authority ON doctrine_sources(authority_level DESC);
CREATE INDEX IF NOT EXISTS idx_doctrine_sources_sectors ON doctrine_sources USING GIN(sector_tags);

-- ============================================================================
-- TABLE: enterprise_verifications
-- ============================================================================
-- Cached enterprise verification results from INSEE API
-- Prevents repeated API calls for same SIRET

CREATE TABLE IF NOT EXISTS enterprise_verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Enterprise identification
  siret VARCHAR(14) UNIQUE NOT NULL,
  siren VARCHAR(9),
  name VARCHAR(255),

  -- Status and verification
  status VARCHAR(50) NOT NULL, -- active, inactive, closed, unknown
  verification_score SMALLINT DEFAULT 0 CHECK (verification_score >= 0 AND verification_score <= 100),

  -- Details
  creation_date DATE,
  naf_code VARCHAR(10),
  naf_label VARCHAR(255),
  address TEXT,
  city VARCHAR(100),
  zip_code VARCHAR(10),

  -- Cache management
  last_verified_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  verified_by VARCHAR(50) DEFAULT 'insee-api',
  cache_ttl_seconds INTEGER DEFAULT 86400, -- 24 hours

  -- Audit
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  CONSTRAINT valid_status CHECK (status IN ('active', 'inactive', 'closed', 'unknown'))
);

CREATE INDEX IF NOT EXISTS idx_enterprise_verifications_siret ON enterprise_verifications(siret);
CREATE INDEX IF NOT EXISTS idx_enterprise_verifications_naf ON enterprise_verifications(naf_code);
CREATE INDEX IF NOT EXISTS idx_enterprise_verifications_verified_at ON enterprise_verifications(last_verified_at DESC);

-- ============================================================================
-- TABLE: rge_certifications
-- ============================================================================
-- RGE (Reconnu Garant de l'Environnement) certification status
-- Tracks certified contractors and their domains

CREATE TABLE IF NOT EXISTS rge_certifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Enterprise link
  siret VARCHAR(14) NOT NULL REFERENCES enterprise_verifications(siret),

  -- Certification status
  certified BOOLEAN NOT NULL DEFAULT FALSE,
  certification_number VARCHAR(100),

  -- Valid periods
  valid_from DATE,
  valid_until DATE,

  -- Certified domains
  certified_domains TEXT[] DEFAULT ARRAY[]::TEXT[], -- isolation, chauffage, eau-chaude-sanitaire, enr, ventilation, audit-energetique

  -- Cache management
  last_checked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  checked_by VARCHAR(50) DEFAULT 'ademe-api',

  -- Audit
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  CONSTRAINT single_cert_per_siret UNIQUE(siret)
);

CREATE INDEX IF NOT EXISTS idx_rge_certifications_siret ON rge_certifications(siret);
CREATE INDEX IF NOT EXISTS idx_rge_certifications_certified ON rge_certifications(certified);
CREATE INDEX IF NOT EXISTS idx_rge_certifications_domains ON rge_certifications USING GIN(certified_domains);

-- ============================================================================
-- TABLE: geo_context_cache
-- ============================================================================
-- Cached geographic context from BAN, Cadastre, GeoRisques
-- Stores address validation, parcel info, and risk assessments

CREATE TABLE IF NOT EXISTS geo_context_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Location identification
  latitude NUMERIC(10, 6) NOT NULL,
  longitude NUMERIC(10, 6) NOT NULL,
  location_hash VARCHAR(64) UNIQUE, -- Hash of lat/lon for quick lookup

  -- Address (BAN)
  address_validated BOOLEAN DEFAULT FALSE,
  address_street VARCHAR(255),
  address_municipality VARCHAR(100),
  address_zip_code VARCHAR(10),
  address_city VARCHAR(100),
  ban_id VARCHAR(100),
  address_accuracy VARCHAR(50), -- rooftop, street, municipality, unknown

  -- Parcel (Cadastre)
  parcel_id VARCHAR(100),
  parcel_section VARCHAR(10),
  parcel_number VARCHAR(10),
  parcel_area_m2 NUMERIC(15, 2),
  parcel_classification VARCHAR(50), -- residential, commercial, industrial, agricultural, forest, water, other
  parcel_buildable BOOLEAN,

  -- Risks (GeoRisques)
  flood_risk VARCHAR(50), -- none, low, moderate, high
  flood_zone VARCHAR(100),
  seismic_zone SMALLINT CHECK (seismic_zone >= 0 AND seismic_zone <= 5),
  slope_risk VARCHAR(50), -- none, low, moderate, high
  subsidence_risk VARCHAR(50), -- none, low, moderate, high
  radon_risk VARCHAR(50), -- low, moderate, high
  heritage_protected BOOLEAN DEFAULT FALSE,
  overall_risk_score SMALLINT DEFAULT 0 CHECK (overall_risk_score >= 0 AND overall_risk_score <= 100),

  -- Cache management
  last_verified_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  verification_confidence NUMERIC(3, 2) DEFAULT 0.5 CHECK (verification_confidence >= 0 AND verification_confidence <= 1),

  -- Audit
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  CONSTRAINT valid_location CHECK (latitude >= -90 AND latitude <= 90 AND longitude >= -180 AND longitude <= 180)
);

CREATE INDEX IF NOT EXISTS idx_geo_context_location_hash ON geo_context_cache(location_hash);
CREATE INDEX IF NOT EXISTS idx_geo_context_address_validated ON geo_context_cache(address_validated);
CREATE INDEX IF NOT EXISTS idx_geo_context_risk_score ON geo_context_cache(overall_risk_score DESC);
CREATE INDEX IF NOT EXISTS idx_geo_context_created_at ON geo_context_cache(created_at DESC);

-- Spatial index for location queries (if PostGIS available)
-- CREATE INDEX idx_geo_context_location_gist ON geo_context_cache USING GIST(ll_to_earth(latitude, longitude));

-- ============================================================================
-- TABLE: api_call_logs
-- ============================================================================
-- Audit trail for external API calls (INSEE, RGE, BAN, Cadastre, GeoRisques)
-- For compliance and debugging

CREATE TABLE IF NOT EXISTS api_call_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- API identification
  api_name VARCHAR(50) NOT NULL, -- insee, rge, ban, cadastre, georisques
  endpoint VARCHAR(255),
  method VARCHAR(10) DEFAULT 'GET',

  -- Request/Response
  request_params JSONB,
  response_code SMALLINT,
  response_time_ms INTEGER,
  error_message TEXT,

  -- Linking
  related_siret VARCHAR(14),
  related_address VARCHAR(255),
  related_coordinate POINT,

  -- Audit
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  CONSTRAINT valid_api_name CHECK (api_name IN ('insee', 'rge', 'ban', 'cadastre', 'georisques'))
);

CREATE INDEX IF NOT EXISTS idx_api_call_logs_api ON api_call_logs(api_name);
CREATE INDEX IF NOT EXISTS idx_api_call_logs_siret ON api_call_logs(related_siret);
CREATE INDEX IF NOT EXISTS idx_api_call_logs_created_at ON api_call_logs(created_at DESC);

-- Retention: Archive logs older than 90 days (can be automated)

-- ============================================================================
-- TABLE: live_intelligence_snapshots
-- ============================================================================
-- Store snapshots of live intelligence enrichment for analysis
-- Helps track verification patterns over time

CREATE TABLE IF NOT EXISTS live_intelligence_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Context reference
  analysis_result_id UUID REFERENCES analysis_results(id),

  -- Enterprise data
  siret VARCHAR(14),
  enterprise_verified BOOLEAN,
  enterprise_status VARCHAR(50),
  enterprise_naf_code VARCHAR(10),

  -- RGE data
  rge_certified BOOLEAN,
  rge_domains TEXT[] DEFAULT ARRAY[]::TEXT[],

  -- Geo data
  address_validated BOOLEAN,
  parcel_buildable BOOLEAN,
  overall_risk_score SMALLINT,

  -- Scores
  legal_risk_score SMALLINT,
  doctrine_confidence_score SMALLINT,
  enrichment_status VARCHAR(50), -- complete, partial, degraded

  -- Doctrine matches
  matched_doctrines TEXT[] DEFAULT ARRAY[]::TEXT[],

  -- Audit
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  CONSTRAINT valid_status CHECK (enrichment_status IN ('complete', 'partial', 'degraded')),
  CONSTRAINT valid_scores CHECK (
    legal_risk_score >= 0 AND legal_risk_score <= 100 AND
    doctrine_confidence_score >= 0 AND doctrine_confidence_score <= 100
  )
);

CREATE INDEX IF NOT EXISTS idx_live_intelligence_snapshots_siret ON live_intelligence_snapshots(siret);
CREATE INDEX IF NOT EXISTS idx_live_intelligence_snapshots_analysis ON live_intelligence_snapshots(analysis_result_id);
CREATE INDEX IF NOT EXISTS idx_live_intelligence_snapshots_created_at ON live_intelligence_snapshots(created_at DESC);

-- ============================================================================
-- FUNCTION: update_doctrine_sources_timestamp
-- ============================================================================
CREATE OR REPLACE FUNCTION update_doctrine_sources_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER doctrine_sources_updated_at
  BEFORE UPDATE ON doctrine_sources
  FOR EACH ROW
  EXECUTE FUNCTION update_doctrine_sources_timestamp();

-- ============================================================================
-- FUNCTION: update_enterprise_verifications_timestamp
-- ============================================================================
CREATE OR REPLACE FUNCTION update_enterprise_verifications_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER enterprise_verifications_updated_at
  BEFORE UPDATE ON enterprise_verifications
  FOR EACH ROW
  EXECUTE FUNCTION update_enterprise_verifications_timestamp();

-- ============================================================================
-- VIEW: live_intelligence_status
-- ============================================================================
-- Shows current verification coverage and patterns

CREATE OR REPLACE VIEW live_intelligence_status AS
SELECT
  (SELECT COUNT(*) FROM enterprise_verifications WHERE status = 'active') as verified_enterprises,
  (SELECT COUNT(*) FROM rge_certifications WHERE certified = TRUE) as rge_certified_count,
  (SELECT COUNT(*) FROM geo_context_cache WHERE address_validated = TRUE) as addresses_validated,
  (SELECT COUNT(*) FROM api_call_logs WHERE DATE(created_at) = CURRENT_DATE) as api_calls_today,
  (SELECT AVG(overall_risk_score) FROM geo_context_cache) as avg_geo_risk_score;

-- ============================================================================
-- ROLLBACK INSTRUCTIONS
-- ============================================================================
-- If needed, run:
--
-- DROP VIEW IF EXISTS live_intelligence_status;
-- DROP TRIGGER IF EXISTS enterprise_verifications_updated_at ON enterprise_verifications;
-- DROP TRIGGER IF EXISTS doctrine_sources_updated_at ON doctrine_sources;
-- DROP FUNCTION IF EXISTS update_enterprise_verifications_timestamp();
-- DROP FUNCTION IF EXISTS update_doctrine_sources_timestamp();
-- DROP TABLE IF EXISTS live_intelligence_snapshots;
-- DROP TABLE IF EXISTS api_call_logs;
-- DROP TABLE IF EXISTS geo_context_cache;
-- DROP TABLE IF EXISTS rge_certifications;
-- DROP TABLE IF EXISTS enterprise_verifications;
-- DROP TABLE IF EXISTS doctrine_sources;
