-- ─────────────────────────────────────────────────────────────────────────────
-- 20260328000006 — Orchestration tables: company_profiles, benchmark_results,
--                  risk_assessments, certification_scores, insurance_documents
-- ─────────────────────────────────────────────────────────────────────────────

-- ── company_profiles (learning system) ───────────────────────────────────────

CREATE TABLE IF NOT EXISTS company_profiles (
  siret                text          PRIMARY KEY,
  raison_sociale       text,
  region               text,
  secteur              text,
  tarifs               jsonb         NOT NULL DEFAULT '{}'::jsonb,
  formats              jsonb         NOT NULL DEFAULT '{}'::jsonb,
  processus            jsonb         NOT NULL DEFAULT '{}'::jsonb,
  insurance_profile    jsonb,
  devis_count          integer       NOT NULL DEFAULT 0,
  learning_confidence  float         NOT NULL DEFAULT 0,
  patterns             text[]        NOT NULL DEFAULT '{}',
  created_at           timestamptz   NOT NULL DEFAULT now(),
  updated_at           timestamptz   NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_company_profiles_region
  ON company_profiles (region);

CREATE INDEX IF NOT EXISTS idx_company_profiles_secteur
  ON company_profiles (secteur);

ALTER TABLE company_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role manages company_profiles"
  ON company_profiles FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ── benchmark_results (cached comparisons) ────────────────────────────────────

CREATE TABLE IF NOT EXISTS benchmark_results (
  id              uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  devis_id        uuid          NOT NULL,
  scope           text          NOT NULL CHECK (scope IN ('LOCAL', 'REGIONAL', 'NATIONAL')),
  sample_size     integer       NOT NULL DEFAULT 0,
  market_min      float,
  market_max      float,
  market_avg      float,
  market_median   float,
  market_p25      float,
  market_p75      float,
  your_price      float,
  percentile      integer,
  recommendation  text,
  anonymized_data jsonb,
  created_at      timestamptz   NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_benchmark_results_devis_id
  ON benchmark_results (devis_id);

ALTER TABLE benchmark_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role manages benchmark_results"
  ON benchmark_results FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ── risk_assessments (cached regional risks) ─────────────────────────────────

CREATE TABLE IF NOT EXISTS risk_assessments (
  id              uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  projet_id       uuid,
  adresse         text          NOT NULL,
  lat             float,
  lon             float,
  seismic         jsonb,
  flooding        jsonb,
  snow_load       jsonb,
  wind_exposure   jsonb,
  plu_restrictions jsonb,
  inferred_dtus   text[]        NOT NULL DEFAULT '{}',
  summary         text,
  assessed_at     timestamptz   NOT NULL DEFAULT now(),
  -- TTL: re-assess after 30 days (cron can filter on assessed_at)
  expires_at      timestamptz   NOT NULL DEFAULT (now() + interval '30 days')
);

CREATE INDEX IF NOT EXISTS idx_risk_assessments_projet
  ON risk_assessments (projet_id);

CREATE INDEX IF NOT EXISTS idx_risk_assessments_expires
  ON risk_assessments (expires_at);

ALTER TABLE risk_assessments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role manages risk_assessments"
  ON risk_assessments FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ── certification_scores ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS certification_scores (
  id                   uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  devis_id             uuid          NOT NULL,
  siret                text,
  total_score          integer       NOT NULL CHECK (total_score BETWEEN 0 AND 100),
  grade                text          NOT NULL CHECK (grade IN ('A', 'B', 'C', 'D', 'E')),
  quality_points       integer,
  conformity_points    integer,
  insurance_points     integer,
  benchmark_points     integer,
  responsiveness_points integer,
  avg_company_score    float,        -- Cached rolling avg (updated on each new devis)
  recommended_stars    integer       CHECK (recommended_stars BETWEEN 0 AND 5),
  eligible_for_stars   boolean       NOT NULL DEFAULT false,
  computed_at          timestamptz   NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_certification_scores_devis
  ON certification_scores (devis_id);

CREATE INDEX IF NOT EXISTS idx_certification_scores_siret
  ON certification_scores (siret, computed_at DESC);

ALTER TABLE certification_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role manages certification_scores"
  ON certification_scores FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ── insurance_documents (uploaded attestations metadata) ──────────────────────

CREATE TABLE IF NOT EXISTS insurance_documents (
  id                   uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id            uuid          NOT NULL,
  siret                text,
  file_url             text          NOT NULL,
  file_name            text          NOT NULL,
  policy_number        text,
  insurer              text,
  start_date           date,
  end_date             date,
  covered_activities   text[]        NOT NULL DEFAULT '{}',
  coverage_amounts     jsonb         NOT NULL DEFAULT '{}'::jsonb,
  garanties            text[]        NOT NULL DEFAULT '{}',
  exclusions           text[]        NOT NULL DEFAULT '{}',
  parse_confidence     float,
  alerts               text[]        NOT NULL DEFAULT '{}',
  created_at           timestamptz   NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_insurance_docs_client
  ON insurance_documents (client_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_insurance_docs_siret
  ON insurance_documents (siret);

CREATE INDEX IF NOT EXISTS idx_insurance_docs_expiry
  ON insurance_documents (end_date)
  WHERE end_date IS NOT NULL;

ALTER TABLE insurance_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role manages insurance_documents"
  ON insurance_documents FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ── Add columns to devis (if not already present) ─────────────────────────────

ALTER TABLE devis ADD COLUMN IF NOT EXISTS benchmark_analysis    jsonb;
ALTER TABLE devis ADD COLUMN IF NOT EXISTS insurance_validation  jsonb;
ALTER TABLE devis ADD COLUMN IF NOT EXISTS certification_score   integer;
ALTER TABLE devis ADD COLUMN IF NOT EXISTS analyzed_at           timestamptz;
ALTER TABLE devis ADD COLUMN IF NOT EXISTS region                text;
ALTER TABLE devis ADD COLUMN IF NOT EXISTS code_postal           text;

-- ── Add columns to projets (if not already present) ──────────────────────────

ALTER TABLE projets ADD COLUMN IF NOT EXISTS inferred_domains    text[];
ALTER TABLE projets ADD COLUMN IF NOT EXISTS regional_risks      jsonb;
ALTER TABLE projets ADD COLUMN IF NOT EXISTS region              text;
ALTER TABLE projets ADD COLUMN IF NOT EXISTS enriched_at         timestamptz;

-- ── Triggers: updated_at ──────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION update_company_profiles_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_company_profiles_updated_at
  BEFORE UPDATE ON company_profiles
  FOR EACH ROW EXECUTE FUNCTION update_company_profiles_updated_at();

-- ── Comments ──────────────────────────────────────────────────────────────────

COMMENT ON TABLE company_profiles IS
  'Persistent learning profiles per company (SIRET). '
  'Accumulates tarif patterns, format preferences, and insurance data over time.';

COMMENT ON TABLE benchmark_results IS
  'Cached anonymous market comparisons. '
  'Stores how a devis price compares to similar projects (LOCAL/REGIONAL/NATIONAL).';

COMMENT ON TABLE risk_assessments IS
  'Cached regional risk data per project address. '
  'Sources: Géorisques, IGN, PLU. Re-assessed after 30 days.';

COMMENT ON TABLE certification_scores IS
  'Per-devis certification scores (0–100) with grade A–E. '
  'Foundation for future star awards (Michelin BTP model).';

COMMENT ON TABLE insurance_documents IS
  'Parsed insurance attestations. '
  'Extracted by InsuranceValidator via Claude OCR.';
