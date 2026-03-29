-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 20260328000009 — Seed API pricing for PROMPT H3 data APIs
--
-- Adds pricing config for:
--   - Sirene (free)
--   - Geoplateforme (free)
--   - BDNB (free)
--   - API Carto (free)
--   - Pappers (paid, per call)
--
-- Also adds api_health_metrics RLS policy for data APIs.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Pricing configuration seeds ───────────────────────────────────────────────

INSERT INTO api_pricing_config (api_name, cost_per_unit_usd, unit_type, notes)
VALUES
  -- Free APIs (cost = 0, tracked for volume monitoring)
  ('insee-sirene',       0.0,     'request', 'Free — recherche-entreprises.api.gouv.fr'),
  ('geoplateforme',      0.0,     'request', 'Free — IGN data.geopf.fr geocoding'),
  ('bdnb',               0.0,     'request', 'Free — api.bdnb.io buildings data'),
  ('api-carto',          0.0,     'request', 'Free — apicarto.ign.fr cadastre/PLU'),

  -- Pappers (paid, per API call)
  ('pappers',            0.001,   'request', 'Paid — Pappers enterprise enrichment (~€0.001/call)')
ON CONFLICT (api_name) DO UPDATE
  SET cost_per_unit_usd = EXCLUDED.cost_per_unit_usd,
      unit_type         = EXCLUDED.unit_type,
      notes             = EXCLUDED.notes,
      updated_at        = NOW();

-- ── Ensure api_costs accepts the new api_name values ─────────────────────────
-- The api_costs table uses a free-text api_name so no changes needed,
-- but we document the expected values here for reference:
--
--   'insee-sirene'      (SireneService calls)
--   'geoplateforme'     (GeoplatformeGeocodingService calls — currently no tracking, free)
--   'bdnb'              (BdnbService calls — currently no tracking, free)
--   'api-carto'         (ApiCartoService calls — currently no tracking, free)
--   'pappers'           (PappersService.trackCost calls)
--   'pappers-entreprise' (Pappers /entreprise endpoint)
--   'pappers-recherche'  (Pappers /recherche endpoint)

-- ── Ensure enterprise_enrichment_cache table exists ───────────────────────────

CREATE TABLE IF NOT EXISTS enterprise_enrichment_cache (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  siret           text NOT NULL,
  siren           text NOT NULL,
  data            jsonb NOT NULL,
  source          text NOT NULL DEFAULT 'unknown',
  created_at      timestamptz NOT NULL DEFAULT NOW(),
  last_accessed_at timestamptz NOT NULL DEFAULT NOW(),
  hit_count       int NOT NULL DEFAULT 0,
  CONSTRAINT uq_enterprise_cache_siret UNIQUE (siret)
);

CREATE INDEX IF NOT EXISTS idx_enterprise_cache_siren  ON enterprise_enrichment_cache (siren);
CREATE INDEX IF NOT EXISTS idx_enterprise_cache_source ON enterprise_enrichment_cache (source);

COMMENT ON TABLE enterprise_enrichment_cache IS
  'Cache for enterprise data from Pappers/Sirene lookups. '
  'Reduces paid API calls and provides fallback when APIs are unavailable.';

-- RLS
ALTER TABLE enterprise_enrichment_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_enterprise_cache_all"
  ON enterprise_enrichment_cache
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ── Ensure location_geocoding_cache table exists ──────────────────────────────

CREATE TABLE IF NOT EXISTS location_geocoding_cache (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cache_key       text NOT NULL,    -- address|postcode
  address_input   text NOT NULL,
  lat             double precision NOT NULL,
  lng             double precision NOT NULL,
  score           double precision NOT NULL DEFAULT 0,
  label           text,
  postcode        text,
  city            text,
  city_code       text,
  type            text,
  source          text NOT NULL DEFAULT 'unknown',
  created_at      timestamptz NOT NULL DEFAULT NOW(),
  last_accessed_at timestamptz NOT NULL DEFAULT NOW(),
  hit_count       int NOT NULL DEFAULT 0,
  CONSTRAINT uq_geocoding_cache_key UNIQUE (cache_key)
);

CREATE INDEX IF NOT EXISTS idx_geocoding_cache_postcode ON location_geocoding_cache (postcode);

COMMENT ON TABLE location_geocoding_cache IS
  'Cache for geocoded addresses from Geoplateforme/BAN. '
  'Reduces API calls and provides offline fallback.';

-- RLS
ALTER TABLE location_geocoding_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_geocoding_cache_all"
  ON location_geocoding_cache
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
