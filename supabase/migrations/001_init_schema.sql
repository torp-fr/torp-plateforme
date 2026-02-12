-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- ============================================================================
-- TABLE: ccf (Cahier des Charges Fonctionnel)
-- ============================================================================
CREATE TABLE IF NOT EXISTS ccf (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Client Info
  client_name TEXT NOT NULL,
  client_phone TEXT,
  client_email TEXT,
  client_address_number TEXT,
  client_address_street TEXT NOT NULL,
  client_address_city TEXT NOT NULL,
  client_address_postal_code TEXT NOT NULL,

  -- Project Info
  project_name TEXT NOT NULL,
  project_type TEXT NOT NULL CHECK (project_type IN ('renovation', 'neuf', 'extension', 'maintenance')),
  scope TEXT NOT NULL,
  budget DECIMAL(12, 2) NOT NULL,
  timeline TEXT NOT NULL,

  -- Selections
  objectives TEXT[] DEFAULT ARRAY[]::TEXT[],
  constraints TEXT[] DEFAULT ARRAY[]::TEXT[],
  success_criteria TEXT[] DEFAULT ARRAY[]::TEXT[],

  -- Company Info (from profile later)
  company_name TEXT,
  company_siret TEXT,
  company_contacts TEXT,

  -- Metadata
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now(),
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'analyzed', 'completed'))
);

CREATE INDEX idx_ccf_created_at ON ccf(created_at DESC);
CREATE INDEX idx_ccf_client_email ON ccf(client_email);
CREATE INDEX idx_ccf_status ON ccf(status);

-- ============================================================================
-- TABLE: client_enriched_data (Données enrichies + vectorisation)
-- ============================================================================
CREATE TABLE IF NOT EXISTS client_enriched_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ccf_id UUID REFERENCES ccf(id) ON DELETE CASCADE,

  -- Address Info
  address_text TEXT NOT NULL,
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),

  -- DPE (Performance Énergétique)
  dpe_available BOOLEAN DEFAULT FALSE,
  dpe_class CHAR(1),
  dpe_consumption DECIMAL(8, 2),
  dpe_emissions DECIMAL(8, 2),
  dpe_last_audit DATE,
  dpe_diagnostic_id TEXT,

  -- Cadastre
  cadastre_parcel_number TEXT,
  cadastre_commune_code TEXT,
  cadastre_departement TEXT,
  cadastre_region TEXT,
  cadastre_year_construction INTEGER,
  cadastre_building_type TEXT, -- 'maison', 'apartement', 'autre'
  cadastre_total_surface DECIMAL(10, 2),
  cadastre_habitable_surface DECIMAL(10, 2),
  cadastre_floors INTEGER,
  cadastre_land_surface DECIMAL(10, 2),
  cadastre_valuation_land DECIMAL(12, 2),
  cadastre_owner TEXT,

  -- Réglementaire
  regulatory_permit_required BOOLEAN DEFAULT TRUE,
  regulatory_prior_declaration BOOLEAN DEFAULT TRUE,
  regulatory_abf_zone BOOLEAN DEFAULT FALSE,
  regulatory_seismic_zone TEXT, -- 'zone1', 'zone2a', 'zone2b', 'zone3', 'zone4', 'zone5'
  regulatory_seismic_level INTEGER,
  regulatory_floodable_zone BOOLEAN DEFAULT FALSE,
  regulatory_flood_risk TEXT, -- 'faible', 'moyen', 'fort'
  regulatory_co_owned BOOLEAN DEFAULT FALSE,
  regulatory_coownership_rules_constraining BOOLEAN DEFAULT FALSE,
  regulatory_protection_perimeters TEXT[],
  regulatory_local_rules TEXT[],

  -- Urbanisme
  urban_plu_zone TEXT,
  urban_construction_coefficient_max DECIMAL(5, 2),
  urban_floor_area_ratio DECIMAL(5, 2),
  urban_setback_front DECIMAL(8, 2),
  urban_setback_sides DECIMAL(8, 2),
  urban_setback_rear DECIMAL(8, 2),
  urban_height_max DECIMAL(8, 2),
  urban_parking_required BOOLEAN,
  urban_servitudes TEXT[],

  -- Entreprise (Pappers)
  company_siret TEXT,
  company_siren TEXT,
  company_name TEXT,
  company_legal_form TEXT,
  company_creation_date DATE,
  company_address TEXT,
  company_phone TEXT,
  company_email TEXT,
  company_website TEXT,
  company_employees INTEGER,
  company_revenue DECIMAL(15, 2),
  company_status TEXT, -- 'active', 'inactive', 'dissolved'
  company_naf TEXT,

  -- Vectorisation
  embedding vector(1536), -- OpenAI embedding
  embedding_model TEXT DEFAULT 'text-embedding-3-small',

  -- Status & Metadata
  enrichment_status TEXT DEFAULT 'pending' CHECK (enrichment_status IN ('pending', 'in_progress', 'completed', 'partial', 'failed')),
  enrichment_errors TEXT[],
  enriched_at TIMESTAMP,
  expires_at TIMESTAMP,
  raw_response JSONB,

  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

CREATE INDEX idx_enriched_ccf_id ON client_enriched_data(ccf_id);
CREATE INDEX idx_enriched_status ON client_enriched_data(enrichment_status);
CREATE INDEX idx_enriched_expires_at ON client_enriched_data(expires_at);
CREATE INDEX idx_enriched_embedding ON client_enriched_data USING ivfflat (embedding vector_cosine_ops);
CREATE INDEX idx_enriched_dpe_class ON client_enriched_data(dpe_class);
CREATE INDEX idx_enriched_abf_zone ON client_enriched_data(regulatory_abf_zone);
CREATE INDEX idx_enriched_flood ON client_enriched_data(regulatory_floodable_zone);

-- ============================================================================
-- TABLE: quote_uploads (Uploads de devis PDF)
-- ============================================================================
CREATE TABLE IF NOT EXISTS quote_uploads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ccf_id UUID REFERENCES ccf(id) ON DELETE CASCADE,

  filename TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  file_path TEXT, -- Chemin stockage Supabase Storage
  file_url TEXT, -- URL publique du fichier

  -- Metadata
  uploaded_by TEXT, -- email ou user_id
  uploaded_at TIMESTAMP DEFAULT now(),

  -- Processing
  processing_status TEXT DEFAULT 'pending' CHECK (processing_status IN ('pending', 'processing', 'completed', 'failed')),
  processing_errors TEXT[],
  processed_at TIMESTAMP,

  -- Extraction (AI parsing)
  extracted_data JSONB, -- Données extraites du PDF
  extraction_confidence DECIMAL(3, 2), -- 0.00 à 1.00

  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

CREATE INDEX idx_uploads_ccf_id ON quote_uploads(ccf_id);
CREATE INDEX idx_uploads_status ON quote_uploads(processing_status);
CREATE INDEX idx_uploads_uploaded_at ON quote_uploads(uploaded_at DESC);

-- ============================================================================
-- TABLE: quote_analysis (Résultats d'analyse devis)
-- ============================================================================
CREATE TABLE IF NOT EXISTS quote_analysis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ccf_id UUID REFERENCES ccf(id) ON DELETE CASCADE,
  quote_upload_id UUID REFERENCES quote_uploads(id) ON DELETE CASCADE,

  -- Scores
  conformity_score DECIMAL(5, 2), -- 0-100
  overall_score DECIMAL(5, 2), -- 0-100
  status TEXT DEFAULT 'pending' CHECK (status IN ('excellent', 'good', 'warning', 'critical', 'pending')),

  -- Analysis Details
  alerts JSONB DEFAULT '[]'::JSONB, -- [{ type, message, severity }]
  recommendations JSONB DEFAULT '[]'::JSONB, -- [{ title, description, priority }]

  -- Regulatory Alerts
  abf_alert BOOLEAN DEFAULT FALSE,
  flood_alert BOOLEAN DEFAULT FALSE,
  seismic_alert BOOLEAN DEFAULT FALSE,
  permit_required_alert BOOLEAN DEFAULT FALSE,

  -- DPE Comparison
  dpe_gap DECIMAL(5, 2), -- Différence DPE souhaitée vs réelle
  dpe_recommendation TEXT,

  -- Budget Analysis
  budget_vs_market_ratio DECIMAL(5, 2), -- Budget input / Prix marché moyen
  budget_alert BOOLEAN DEFAULT FALSE,

  -- RAG Context
  rag_context JSONB, -- Données enrichies utilisées pour génération

  -- Metadata
  analyzed_at TIMESTAMP DEFAULT now(),
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

CREATE INDEX idx_analysis_ccf_id ON quote_analysis(ccf_id);
CREATE INDEX idx_analysis_quote_id ON quote_analysis(quote_upload_id);
CREATE INDEX idx_analysis_status ON quote_analysis(status);

-- ============================================================================
-- TABLE: rag_context_cache (Cache pour RAG pipeline)
-- ============================================================================
CREATE TABLE IF NOT EXISTS rag_context_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enriched_data_id UUID REFERENCES client_enriched_data(id) ON DELETE CASCADE,

  -- Context Data
  context_text TEXT NOT NULL,
  context_type TEXT NOT NULL, -- 'dpe', 'cadastre', 'regulatory', 'urban', 'company'

  -- Embedding
  embedding vector(1536),

  -- Metadata
  created_at TIMESTAMP DEFAULT now(),
  expires_at TIMESTAMP DEFAULT (now() + INTERVAL '30 days'),

  UNIQUE(enriched_data_id, context_type)
);

CREATE INDEX idx_rag_enriched_id ON rag_context_cache(enriched_data_id);
CREATE INDEX idx_rag_type ON rag_context_cache(context_type);
CREATE INDEX idx_rag_embedding ON rag_context_cache USING ivfflat (embedding vector_cosine_ops);

-- ============================================================================
-- TABLE: audit_log (Logging des enrichissements et analyses)
-- ============================================================================
CREATE TABLE IF NOT EXISTS audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ccf_id UUID REFERENCES ccf(id) ON DELETE SET NULL,

  action TEXT NOT NULL, -- 'enrichment_started', 'enrichment_completed', 'analysis_completed', etc.
  details JSONB,

  status TEXT DEFAULT 'success' CHECK (status IN ('success', 'failed', 'partial')),
  error_message TEXT,

  created_at TIMESTAMP DEFAULT now()
);

CREATE INDEX idx_audit_ccf_id ON audit_log(ccf_id);
CREATE INDEX idx_audit_action ON audit_log(action);
CREATE INDEX idx_audit_created_at ON audit_log(created_at DESC);

-- ============================================================================
-- RLS Policies (Row Level Security) - À configurer selon auth
-- ============================================================================

-- Les RLS policies seront configurées une fois que l'authentification est mise en place
-- Pour le moment, laisser public_access enabled pour le développement

ALTER TABLE ccf ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_enriched_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE quote_uploads ENABLE ROW LEVEL SECURITY;
ALTER TABLE quote_analysis ENABLE ROW LEVEL SECURITY;
ALTER TABLE rag_context_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- Policy temporaire (dev) - À remplacer en production
CREATE POLICY "Allow all for now" ON ccf FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for now" ON client_enriched_data FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for now" ON quote_uploads FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for now" ON quote_analysis FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for now" ON rag_context_cache FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for now" ON audit_log FOR ALL USING (true) WITH CHECK (true);
