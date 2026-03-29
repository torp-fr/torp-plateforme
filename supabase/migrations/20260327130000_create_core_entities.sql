-- =====================================================================
-- Phase 3A — Core Entity Schema
-- Entreprises, Clients, Projets, Devis, Audits, QRCodes, Pipeline logs
-- =====================================================================

-- ─────────────────────────────────────────────────────────────────────
-- ENTREPRISES
-- ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.entreprises (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  siret TEXT UNIQUE NOT NULL,
  raison_sociale TEXT NOT NULL,

  -- RCS data (from Pappers) — stored as JSONB for schema flexibility
  rcs_data JSONB,
  -- { code_naf, libelle_naf, effectifs, chiffre_affaires, capital_social,
  --   forme_juridique, date_creation, adresse_siege, dirigeant }

  -- Certifications (from data.gouv)
  certifications JSONB,
  -- { rge: bool, qualiopi: bool, qualibat: bool, qualifelec: bool,
  --   labels: string[], certifications_raw: any, last_fetched_at: timestamp }

  -- Reputation (from Trustpilot / Google — optional paid API)
  reputation JSONB,
  -- { google: { note, count, last_fetched_at }, trustpilot: { note, count, last_fetched_at } }

  -- Manual profile (entered by the entreprise)
  contact_principal TEXT,
  email TEXT,
  telephone TEXT,
  adresse TEXT,
  ville TEXT,
  code_postal TEXT,
  website TEXT,
  logo_url TEXT,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'archived')),
  plan TEXT DEFAULT 'free' CHECK (plan IN ('free', 'starter', 'pro', 'enterprise')),

  -- Pipeline tracking
  pipeline_status JSONB
  -- { last_enrichment: timestamp, enrichment_status: 'pending'|'completed'|'failed' }
);

CREATE INDEX IF NOT EXISTS idx_entreprises_siret ON public.entreprises(siret);
CREATE INDEX IF NOT EXISTS idx_entreprises_status ON public.entreprises(status);
CREATE INDEX IF NOT EXISTS idx_entreprises_plan ON public.entreprises(plan);

-- ─────────────────────────────────────────────────────────────────────
-- CLIENTS
-- ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entreprise_id UUID NOT NULL REFERENCES public.entreprises(id) ON DELETE CASCADE,

  -- Minimal on-site entry (required)
  nom TEXT NOT NULL,
  prenom TEXT,
  email TEXT,
  telephone TEXT,

  -- Auto-lookup (lazy-loaded after address entry)
  localisation JSONB,
  -- { adresse_saisie, adresse_normalisee, code_postal, ville,
  --   lat, lng, parcelle_cadastrale, fetched_at }

  -- Contextual data (lazy-loaded by project type)
  contexte_local JSONB,
  -- { plu_info, abf_protection, secteur_protege, aides_etat,
  --   fetched_for_project_types: string[] }

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Pipeline tracking
  pipeline_status JSONB
  -- { last_localization: timestamp, localization_status: 'pending'|'completed'|'failed' }
);

CREATE INDEX IF NOT EXISTS idx_clients_entreprise_id ON public.clients(entreprise_id);
CREATE INDEX IF NOT EXISTS idx_clients_email ON public.clients(email);

-- ─────────────────────────────────────────────────────────────────────
-- PROJETS
-- ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.projets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  entreprise_id UUID NOT NULL REFERENCES public.entreprises(id),
  -- Denormalized for RLS: always filter by entreprise_id

  -- Project definition
  type TEXT NOT NULL,
  -- 'piscine'|'renovation'|'extension'|'construction_neuve'|'toiture'|
  -- 'electricite_seule'|'plomberie_seule'|'isolation'|'chauffage'|'fenetre'|'autre'
  description TEXT,
  tags TEXT[],

  -- Localisation (triggers regulatory context fetch)
  localisation JSONB,
  -- { adresse, code_postal, ville, lat, lng, parcelle_cadastrale }

  -- Regulatory context (lazy-loaded after type + location selection)
  contexte_reglementaire JSONB,
  -- { plu, abf_protection, permis_requis, aides_eligibles, contraintes }
  -- Each field: LazyLoadedData<T> = { status, data, error, fetched_at, source_api }

  -- Phase 2 deduction
  implied_domains TEXT[],
  -- ['structure', 'hydraulique', 'électrique'] etc.
  context_deduction_confidence TEXT CHECK (context_deduction_confidence IN ('high', 'medium', 'low')),

  -- Manual fields
  budget_estime NUMERIC,
  delai_prevu TEXT,
  date_debut_prevue DATE,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'completed', 'archived')),

  -- Pipeline tracking
  pipeline_status JSONB
  -- { context_fetched: bool, last_update: timestamp, triggered_lookups: string[] }
);

CREATE INDEX IF NOT EXISTS idx_projets_client_id ON public.projets(client_id);
CREATE INDEX IF NOT EXISTS idx_projets_entreprise_id ON public.projets(entreprise_id);
CREATE INDEX IF NOT EXISTS idx_projets_type ON public.projets(type);
CREATE INDEX IF NOT EXISTS idx_projets_status ON public.projets(status);

-- ─────────────────────────────────────────────────────────────────────
-- DEVIS
-- ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.devis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  projet_id UUID NOT NULL REFERENCES public.projets(id) ON DELETE CASCADE,
  entreprise_id UUID NOT NULL REFERENCES public.entreprises(id),
  -- Denormalized for RLS

  -- Upload
  version INTEGER DEFAULT 1,
  upload_format TEXT CHECK (upload_format IN ('pdf', 'image', 'csv', 'excel', 'web_form', 'docx')),
  upload_file_path TEXT,
  -- Supabase Storage path (bucket: devis_uploads)
  upload_timestamp TIMESTAMPTZ DEFAULT NOW(),

  -- Parsing result (written by DevisParsingPipeline)
  parsing_result JSONB,
  -- { status: 'pending'|'parsing'|'parsed'|'failed',
  --   items: DevisItem[], montant_ht, montant_ttc, tva_taux,
  --   parsing_confidence, parsing_method, parsing_errors, parsed_at }

  created_at TIMESTAMPTZ DEFAULT NOW(),
  is_final BOOLEAN DEFAULT FALSE,
  notes TEXT,

  -- Pipeline tracking
  pipeline_status JSONB
  -- { parsing_status, scoring_status, qr_generated: bool }
);

CREATE INDEX IF NOT EXISTS idx_devis_projet_id ON public.devis(projet_id);
CREATE INDEX IF NOT EXISTS idx_devis_entreprise_id ON public.devis(entreprise_id);
CREATE INDEX IF NOT EXISTS idx_devis_version ON public.devis(projet_id, version);

-- ─────────────────────────────────────────────────────────────────────
-- AUDITS
-- ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.audits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  devis_id UUID NOT NULL REFERENCES public.devis(id) ON DELETE CASCADE,
  projet_id UUID NOT NULL REFERENCES public.projets(id),
  -- Denormalized for query performance
  entreprise_id UUID NOT NULL REFERENCES public.entreprises(id),

  -- Execution metadata
  audit_timestamp TIMESTAMPTZ DEFAULT NOW(),
  audit_engine_version TEXT DEFAULT '3.0',
  processing_time_ms INTEGER,

  -- Phase 2: Coverage Analysis (from audit.engine.ts v1.1)
  coverage_analysis JSONB,
  -- { coverage_pct, explicit_pct, total_rules, gap_count,
  --   top_gaps, strengths, risk_domains }

  -- Phase 3: Multi-Dimensional Scoring
  scoring JSONB,
  -- { dimensions: ScoringDimension[], final_score, grade,
  --   potential_score, potential_grade, scoring_version }

  -- Recommendations
  recommendations JSONB,
  -- [{ id, priority, domain, action, rationale, regulatory_reference,
  --    effort, gap_count, estimated_score_gain }]

  -- Public summary (exposed via QR code — no auth)
  public_summary JSONB,
  -- { title, score, grade, risk_label, compliance_verdict,
  --   highlights, key_findings, top_recommendation }

  -- Version delta (if devis.version > 1)
  version_delta JSONB
  -- { previous_audit_id, previous_score, score_delta,
  --   improvements_made, remaining_gaps }
);

CREATE INDEX IF NOT EXISTS idx_audits_devis_id ON public.audits(devis_id);
CREATE INDEX IF NOT EXISTS idx_audits_projet_id ON public.audits(projet_id);
CREATE INDEX IF NOT EXISTS idx_audits_entreprise_id ON public.audits(entreprise_id);
CREATE INDEX IF NOT EXISTS idx_audits_timestamp ON public.audits(audit_timestamp DESC);

-- ─────────────────────────────────────────────────────────────────────
-- QRCODES
-- ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.qrcodes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_id UUID NOT NULL REFERENCES public.audits(id) ON DELETE CASCADE,

  qr_image_url TEXT,
  -- Supabase Storage URL (PNG)
  short_code TEXT UNIQUE NOT NULL,
  -- 8-char alphanumeric (collision-safe): 'AB3XK7M2'
  access_url TEXT,
  -- 'https://torp.fr/audit/AB3XK7M2'

  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  -- NULL = no expiry (default for MVP)

  access_stats JSONB DEFAULT '{"scans": 0, "unique_views": 0}'::jsonb,
  -- { scans, unique_views, last_accessed_at }

  is_active BOOLEAN DEFAULT TRUE,
  created_by UUID
  -- User ID (from auth.users)
);

CREATE INDEX IF NOT EXISTS idx_qrcodes_audit_id ON public.qrcodes(audit_id);
CREATE INDEX IF NOT EXISTS idx_qrcodes_short_code ON public.qrcodes(short_code);
CREATE INDEX IF NOT EXISTS idx_qrcodes_active ON public.qrcodes(is_active) WHERE is_active = TRUE;

-- ─────────────────────────────────────────────────────────────────────
-- PIPELINE_EXECUTIONS (monitoring + retry)
-- ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.pipeline_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pipeline_name TEXT NOT NULL,
  -- 'EnrichissementEntreprise'|'ClientLocalization'|'ContextRegulation'|
  -- 'DevisParsing'|'AuditScoring'

  entity_id UUID,
  entity_type TEXT CHECK (entity_type IN ('entreprise', 'client', 'projet', 'devis')),

  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'running', 'completed', 'failed')),

  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,

  input_data JSONB,
  output_data JSONB,
  error_message TEXT,

  retry_count INTEGER DEFAULT 0,
  retry_until TIMESTAMPTZ,
  -- Set on failure for exponential backoff scheduling
  execution_time_ms INTEGER
);

CREATE INDEX IF NOT EXISTS idx_pipeline_executions_pipeline ON public.pipeline_executions(pipeline_name);
CREATE INDEX IF NOT EXISTS idx_pipeline_executions_entity ON public.pipeline_executions(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_pipeline_executions_status ON public.pipeline_executions(status);
CREATE INDEX IF NOT EXISTS idx_pipeline_executions_started ON public.pipeline_executions(started_at DESC);

-- ─────────────────────────────────────────────────────────────────────
-- UPDATED_AT triggers
-- ─────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_entreprises_updated_at
  BEFORE UPDATE ON public.entreprises
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_clients_updated_at
  BEFORE UPDATE ON public.clients
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_projets_updated_at
  BEFORE UPDATE ON public.projets
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ─────────────────────────────────────────────────────────────────────
-- RLS POLICIES
-- Enable RLS on all tables — always filter by entreprise_id
-- ─────────────────────────────────────────────────────────────────────
ALTER TABLE public.entreprises ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.devis ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qrcodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pipeline_executions ENABLE ROW LEVEL SECURITY;

-- Service role bypasses RLS (for pipeline workers)
-- Frontend uses authenticated user → RLS enforces org isolation

-- qrcodes public read (no auth required for QR scan)
CREATE POLICY "qrcodes_public_read" ON public.qrcodes
  FOR SELECT USING (is_active = TRUE);

-- audits public_summary accessible when qrcode exists
-- (frontend queries via short_code → audit_id → public_summary only)
CREATE POLICY "audits_public_summary_read" ON public.audits
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.qrcodes
      WHERE qrcodes.audit_id = audits.id
        AND qrcodes.is_active = TRUE
    )
  );
