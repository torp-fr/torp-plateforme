-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 20260328000010 — H3-ENRICHI: Enrichment API tables
--
-- Creates:
--   georisques_cache         — risk reports cached by lat/lng
--   rge_professionals_cache  — RGE search results cached by postal code / SIRET
--   dpe_logements_cache      — DPE records cached by postal code
--   renovation_aids_cache    — MaPrimeRénov' / CEE simulation results
--   project_enrichment_data  — enrichment results per project (FK → projets)
--
-- Seeds api_pricing_config with enrichment API entries.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Géorisques cache ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS georisques_cache (
  id              uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  lat             numeric(9,6) NOT NULL,
  lng             numeric(9,6) NOT NULL,
  commune         text,
  url_rapport     text,
  risk_report     jsonb        NOT NULL DEFAULT '{}',
  seismic_zone    jsonb,
  fetched_at      timestamptz  NOT NULL DEFAULT now(),
  expires_at      timestamptz  NOT NULL DEFAULT (now() + INTERVAL '30 days'),
  UNIQUE (lat, lng)
);

CREATE INDEX IF NOT EXISTS idx_georisques_cache_coords
  ON georisques_cache (lat, lng);
CREATE INDEX IF NOT EXISTS idx_georisques_cache_expires
  ON georisques_cache (expires_at);

COMMENT ON TABLE georisques_cache IS
  'Cached natural hazard risk reports from Géorisques API. TTL: 30 days.';

-- ── 2. RGE professionals cache ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS rge_professionals_cache (
  id              uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  cache_key       text         NOT NULL UNIQUE, -- "postal:75001" or "siret:12345678901234"
  cache_type      text         NOT NULL CHECK (cache_type IN ('postal_code', 'siret', 'location')),
  results         jsonb        NOT NULL DEFAULT '[]',
  total           integer      NOT NULL DEFAULT 0,
  fetched_at      timestamptz  NOT NULL DEFAULT now(),
  expires_at      timestamptz  NOT NULL DEFAULT (now() + INTERVAL '7 days')
);

CREATE INDEX IF NOT EXISTS idx_rge_cache_key     ON rge_professionals_cache (cache_key);
CREATE INDEX IF NOT EXISTS idx_rge_cache_expires ON rge_professionals_cache (expires_at);

COMMENT ON TABLE rge_professionals_cache IS
  'Cached ADEME RGE certified professionals search results. TTL: 7 days.';

-- ── 3. DPE logements cache ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS dpe_logements_cache (
  id              uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  cache_key       text         NOT NULL UNIQUE, -- "postal:75001" or "dpe:XXXXXXXX"
  cache_type      text         NOT NULL CHECK (cache_type IN ('postal_code', 'dpe_number', 'location')),
  results         jsonb        NOT NULL DEFAULT '[]',
  total           integer      NOT NULL DEFAULT 0,
  area_stats      jsonb,       -- avg energy stats for the area
  fetched_at      timestamptz  NOT NULL DEFAULT now(),
  expires_at      timestamptz  NOT NULL DEFAULT (now() + INTERVAL '14 days')
);

CREATE INDEX IF NOT EXISTS idx_dpe_cache_key     ON dpe_logements_cache (cache_key);
CREATE INDEX IF NOT EXISTS idx_dpe_cache_expires ON dpe_logements_cache (expires_at);

COMMENT ON TABLE dpe_logements_cache IS
  'Cached ADEME DPE records and area energy statistics. TTL: 14 days.';

-- ── 4. Renovation aids cache ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS renovation_aids_cache (
  id                  uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Cache key = hash of input parameters
  input_hash          text         NOT NULL UNIQUE,
  code_postal         text         NOT NULL,
  revenue_category    text,        -- tres_modestes | modestes | intermediaires | superieurs
  work_types          text[]       NOT NULL DEFAULT '{}',
  eligible_aids       jsonb        NOT NULL DEFAULT '[]',
  total_estime_min    integer      NOT NULL DEFAULT 0,
  total_estime_max    integer      NOT NULL DEFAULT 0,
  simulation_note     text,
  computed_at         timestamptz  NOT NULL DEFAULT now(),
  expires_at          timestamptz  NOT NULL DEFAULT (now() + INTERVAL '90 days')
);

CREATE INDEX IF NOT EXISTS idx_renov_aids_hash       ON renovation_aids_cache (input_hash);
CREATE INDEX IF NOT EXISTS idx_renov_aids_code_postal ON renovation_aids_cache (code_postal);
CREATE INDEX IF NOT EXISTS idx_renov_aids_expires    ON renovation_aids_cache (expires_at);

COMMENT ON TABLE renovation_aids_cache IS
  'Cached MaPrimeRénov / CEE / Éco-PTZ simulation results. TTL: 90 days.';

-- ── 5. Project enrichment data ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS project_enrichment_data (
  id              uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id      uuid         NOT NULL,  -- references projets(id)
  risk_report     jsonb,                  -- GeorisquesRiskReport
  rge_nearby      jsonb,                  -- RGESearchResult
  aids_simulation jsonb,                  -- AidsSimulationResult
  enriched_at     timestamptz  NOT NULL DEFAULT now(),
  UNIQUE (project_id)
);

CREATE INDEX IF NOT EXISTS idx_project_enrichment_project_id
  ON project_enrichment_data (project_id);

COMMENT ON TABLE project_enrichment_data IS
  'Enrichment results (risks, RGE, aids) stored per project.';

-- ── 6. Seed api_pricing_config for enrichment APIs ───────────────────────────
-- These APIs are free (no per-request cost) — tracked for rate-limiting purposes

INSERT INTO api_pricing_config (api_name, price_per_request_usd, currency, updated_at)
VALUES
  ('Georisques',  0.000, 'USD', now()),
  ('ADEME-RGE',   0.000, 'USD', now()),
  ('ADEME-DPE',   0.000, 'USD', now())
ON CONFLICT (api_name) DO UPDATE SET
  price_per_request_usd = EXCLUDED.price_per_request_usd,
  updated_at            = EXCLUDED.updated_at;
