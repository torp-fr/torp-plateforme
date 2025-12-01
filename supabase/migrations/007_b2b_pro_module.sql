-- =====================================================
-- TORP B2B PRO MODULE - Database Schema
-- Migration 007: Auto-Analyse Devis Professionnel
-- =====================================================

-- Enable necessary extensions (if not already enabled)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =====================================================
-- ENUMS
-- =====================================================

-- Type de document entreprise
CREATE TYPE company_doc_type AS ENUM (
  'KBIS',
  'ATTESTATION_URSSAF',
  'ATTESTATION_VIGILANCE',
  'ASSURANCE_DECENNALE',
  'ASSURANCE_RC_PRO',
  'CERTIFICATION_QUALIBAT',
  'CERTIFICATION_RGE',
  'CERTIFICATION_QUALIFELEC',
  'CERTIFICATION_QUALIPAC',
  'LABEL_AUTRE',
  'AUTRE'
);

-- Statut du document
CREATE TYPE doc_status AS ENUM (
  'PENDING',      -- En attente de vérification
  'VALID',        -- Valide et à jour
  'EXPIRING',     -- Expire dans moins de 30 jours
  'EXPIRED',      -- Expiré
  'INVALID'       -- Document invalide/illisible
);

-- Statut de l'analyse
CREATE TYPE analysis_status AS ENUM (
  'PENDING',
  'PROCESSING',
  'COMPLETED',
  'FAILED'
);

-- =====================================================
-- TABLE: PRO_COMPANY_PROFILES
-- Profils entreprises pour les utilisateurs B2B
-- =====================================================

CREATE TABLE public.pro_company_profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL UNIQUE REFERENCES public.users(id) ON DELETE CASCADE,

  -- Identité entreprise
  siret TEXT UNIQUE NOT NULL,
  siren TEXT NOT NULL,
  raison_sociale TEXT NOT NULL,
  forme_juridique TEXT, -- SARL, SAS, EI, Auto-entrepreneur...
  code_naf TEXT,
  adresse TEXT,
  code_postal TEXT,
  ville TEXT,
  telephone TEXT,
  email TEXT NOT NULL,
  site_web TEXT,

  -- Données vérifiées (via API ou documents)
  date_creation DATE,
  capital_social DECIMAL(15,2),
  effectif TEXT, -- Tranche effectif (ex: "1-10", "11-50")
  dirigeant_nom TEXT,

  -- Statut vérification SIRET
  siret_verifie BOOLEAN DEFAULT FALSE,
  siret_verifie_le TIMESTAMP WITH TIME ZONE,

  -- Métadonnées
  metadata JSONB DEFAULT '{}'::jsonb,

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index pour optimiser les requêtes
CREATE INDEX idx_pro_company_profiles_user_id ON public.pro_company_profiles(user_id);
CREATE INDEX idx_pro_company_profiles_siret ON public.pro_company_profiles(siret);
CREATE INDEX idx_pro_company_profiles_siren ON public.pro_company_profiles(siren);
CREATE INDEX idx_pro_company_profiles_created_at ON public.pro_company_profiles(created_at DESC);

-- =====================================================
-- TABLE: COMPANY_DOCUMENTS
-- Documents de l'entreprise (Kbis, assurances, certifications)
-- =====================================================

CREATE TABLE public.company_documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES public.pro_company_profiles(id) ON DELETE CASCADE,

  -- Type de document
  type company_doc_type NOT NULL,
  nom TEXT NOT NULL,

  -- Fichier
  file_url TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size INTEGER,
  mime_type TEXT,

  -- Métadonnées extraites
  date_emission DATE,
  date_expiration DATE,
  numero_document TEXT,
  emetteur TEXT, -- Ex: "AXA", "URSSAF", "Qualibat"

  -- Statut
  statut doc_status DEFAULT 'PENDING',
  date_verification TIMESTAMP WITH TIME ZONE,
  verification_notes TEXT,

  -- Métadonnées
  metadata JSONB DEFAULT '{}'::jsonb,

  -- Timestamps
  uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index
CREATE INDEX idx_company_documents_company_id ON public.company_documents(company_id);
CREATE INDEX idx_company_documents_type ON public.company_documents(type);
CREATE INDEX idx_company_documents_statut ON public.company_documents(statut);
CREATE INDEX idx_company_documents_date_expiration ON public.company_documents(date_expiration);
CREATE INDEX idx_company_documents_uploaded_at ON public.company_documents(uploaded_at DESC);

-- =====================================================
-- TABLE: PRO_DEVIS_ANALYSES
-- Analyses de devis pour les professionnels B2B
-- =====================================================

CREATE TABLE public.pro_devis_analyses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES public.pro_company_profiles(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,

  -- Identification devis
  reference_devis TEXT NOT NULL, -- Numéro/référence du devis de l'entreprise
  nom_projet TEXT,
  montant_ht DECIMAL(15,2),
  montant_ttc DECIMAL(15,2),

  -- Fichier devis
  file_url TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size INTEGER,
  mime_type TEXT,

  -- Résultats analyse
  status analysis_status DEFAULT 'PENDING',
  score_total INTEGER, -- 0-1000
  grade TEXT, -- A+, A, B, C, D, E, F

  -- Détail scores par axe (JSONB)
  -- Format: {"transparence": 250, "offre": 230, "robustesse": 240, "prix": 200}
  score_details JSONB,

  -- Recommandations générées (JSONB array)
  -- Format: [{"type": "transparence", "message": "...", "impact": "+30pts", "priority": "high"}]
  recommandations JSONB DEFAULT '[]'::jsonb,

  -- Points bloquants identifiés (JSONB array)
  -- Format: [{"type": "conformite", "message": "Assurance décennale non mentionnée", "severity": "critical"}]
  points_bloquants JSONB DEFAULT '[]'::jsonb,

  -- Données extraites du devis (OCR/parsing)
  extracted_data JSONB DEFAULT '{}'::jsonb,

  -- Versioning (pour amélioration itérative)
  version INTEGER DEFAULT 1,
  parent_analysis_id UUID REFERENCES public.pro_devis_analyses(id) ON DELETE SET NULL,

  -- Ticket TORP (Badge de certification)
  ticket_genere BOOLEAN DEFAULT FALSE,
  ticket_url TEXT,
  ticket_code TEXT UNIQUE, -- Code unique pour QR/lien (ex: TORP-ABC123)
  ticket_generated_at TIMESTAMP WITH TIME ZONE,

  -- Tracking du ticket (nombre de consultations)
  ticket_view_count INTEGER DEFAULT 0,
  ticket_last_viewed_at TIMESTAMP WITH TIME ZONE,

  -- Métadonnées
  metadata JSONB DEFAULT '{}'::jsonb,

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  analyzed_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index
CREATE INDEX idx_pro_devis_analyses_company_id ON public.pro_devis_analyses(company_id);
CREATE INDEX idx_pro_devis_analyses_user_id ON public.pro_devis_analyses(user_id);
CREATE INDEX idx_pro_devis_analyses_status ON public.pro_devis_analyses(status);
CREATE INDEX idx_pro_devis_analyses_score_total ON public.pro_devis_analyses(score_total DESC);
CREATE INDEX idx_pro_devis_analyses_grade ON public.pro_devis_analyses(grade);
CREATE INDEX idx_pro_devis_analyses_ticket_code ON public.pro_devis_analyses(ticket_code);
CREATE INDEX idx_pro_devis_analyses_parent_analysis_id ON public.pro_devis_analyses(parent_analysis_id);
CREATE INDEX idx_pro_devis_analyses_created_at ON public.pro_devis_analyses(created_at DESC);

-- =====================================================
-- TABLE: TICKET_TRACKING_EVENTS
-- Tracking des consultations de tickets TORP
-- =====================================================

CREATE TABLE public.ticket_tracking_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  analysis_id UUID NOT NULL REFERENCES public.pro_devis_analyses(id) ON DELETE CASCADE,

  -- Type d'événement
  event_type TEXT NOT NULL, -- 'qr_scanned', 'link_viewed', 'pdf_downloaded'

  -- Données de tracking
  ip_address INET,
  user_agent TEXT,
  referer TEXT,

  -- Géolocalisation (optionnel)
  country TEXT,
  city TEXT,

  -- Métadonnées
  metadata JSONB DEFAULT '{}'::jsonb,

  -- Timestamp
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index
CREATE INDEX idx_ticket_tracking_events_analysis_id ON public.ticket_tracking_events(analysis_id);
CREATE INDEX idx_ticket_tracking_events_event_type ON public.ticket_tracking_events(event_type);
CREATE INDEX idx_ticket_tracking_events_created_at ON public.ticket_tracking_events(created_at DESC);

-- =====================================================
-- TRIGGERS FOR UPDATED_AT
-- =====================================================

CREATE TRIGGER update_pro_company_profiles_updated_at
  BEFORE UPDATE ON public.pro_company_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_pro_devis_analyses_updated_at
  BEFORE UPDATE ON public.pro_devis_analyses
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- =====================================================

-- Enable RLS on all tables
ALTER TABLE public.pro_company_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pro_devis_analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_tracking_events ENABLE ROW LEVEL SECURITY;

-- ==========================================
-- RLS POLICIES: pro_company_profiles
-- ==========================================

-- Users can view their own company profile
CREATE POLICY "Users can view their own company profile"
  ON public.pro_company_profiles FOR SELECT
  USING (auth.uid() = user_id);

-- Users can create their own company profile
CREATE POLICY "Users can create their own company profile"
  ON public.pro_company_profiles FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own company profile
CREATE POLICY "Users can update their own company profile"
  ON public.pro_company_profiles FOR UPDATE
  USING (auth.uid() = user_id);

-- Users can delete their own company profile
CREATE POLICY "Users can delete their own company profile"
  ON public.pro_company_profiles FOR DELETE
  USING (auth.uid() = user_id);

-- ==========================================
-- RLS POLICIES: company_documents
-- ==========================================

-- Users can view documents of their own company
CREATE POLICY "Users can view their company documents"
  ON public.company_documents FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.pro_company_profiles
      WHERE pro_company_profiles.id = company_documents.company_id
      AND pro_company_profiles.user_id = auth.uid()
    )
  );

-- Users can upload documents to their own company
CREATE POLICY "Users can upload their company documents"
  ON public.company_documents FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.pro_company_profiles
      WHERE pro_company_profiles.id = company_documents.company_id
      AND pro_company_profiles.user_id = auth.uid()
    )
  );

-- Users can update documents of their own company
CREATE POLICY "Users can update their company documents"
  ON public.company_documents FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.pro_company_profiles
      WHERE pro_company_profiles.id = company_documents.company_id
      AND pro_company_profiles.user_id = auth.uid()
    )
  );

-- Users can delete documents of their own company
CREATE POLICY "Users can delete their company documents"
  ON public.company_documents FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.pro_company_profiles
      WHERE pro_company_profiles.id = company_documents.company_id
      AND pro_company_profiles.user_id = auth.uid()
    )
  );

-- ==========================================
-- RLS POLICIES: pro_devis_analyses
-- ==========================================

-- Users can view their own analyses
CREATE POLICY "Users can view their own analyses"
  ON public.pro_devis_analyses FOR SELECT
  USING (auth.uid() = user_id);

-- Users can create analyses for their own company
CREATE POLICY "Users can create analyses for their company"
  ON public.pro_devis_analyses FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.pro_company_profiles
      WHERE pro_company_profiles.id = pro_devis_analyses.company_id
      AND pro_company_profiles.user_id = auth.uid()
    )
  );

-- Users can update their own analyses
CREATE POLICY "Users can update their own analyses"
  ON public.pro_devis_analyses FOR UPDATE
  USING (auth.uid() = user_id);

-- Users can delete their own analyses
CREATE POLICY "Users can delete their own analyses"
  ON public.pro_devis_analyses FOR DELETE
  USING (auth.uid() = user_id);

-- Public can view ticket data (for QR code scans)
CREATE POLICY "Public can view ticket data via ticket_code"
  ON public.pro_devis_analyses FOR SELECT
  USING (
    ticket_genere = TRUE
    AND ticket_code IS NOT NULL
  );

-- ==========================================
-- RLS POLICIES: ticket_tracking_events
-- ==========================================

-- Users can view tracking events for their analyses
CREATE POLICY "Users can view tracking events for their analyses"
  ON public.ticket_tracking_events FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.pro_devis_analyses
      WHERE pro_devis_analyses.id = ticket_tracking_events.analysis_id
      AND pro_devis_analyses.user_id = auth.uid()
    )
  );

-- Anyone can create tracking events (for public ticket views)
CREATE POLICY "Anyone can create tracking events"
  ON public.ticket_tracking_events FOR INSERT
  WITH CHECK (true);

-- =====================================================
-- FUNCTIONS
-- =====================================================

-- Function to generate unique ticket code
CREATE OR REPLACE FUNCTION public.generate_ticket_code()
RETURNS TEXT AS $$
DECLARE
  chars TEXT := 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  result TEXT := 'TORP-';
  i INTEGER;
BEGIN
  FOR i IN 1..8 LOOP
    result := result || substr(chars, floor(random() * length(chars) + 1)::integer, 1);
  END LOOP;
  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Function to increment ticket view count
CREATE OR REPLACE FUNCTION public.increment_ticket_view_count(p_analysis_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE public.pro_devis_analyses
  SET
    ticket_view_count = ticket_view_count + 1,
    ticket_last_viewed_at = NOW()
  WHERE id = p_analysis_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to calculate grade from score
CREATE OR REPLACE FUNCTION public.calculate_grade_from_score(score INTEGER)
RETURNS TEXT AS $$
BEGIN
  RETURN CASE
    WHEN score >= 950 THEN 'A+'
    WHEN score >= 900 THEN 'A'
    WHEN score >= 850 THEN 'A-'
    WHEN score >= 800 THEN 'B+'
    WHEN score >= 750 THEN 'B'
    WHEN score >= 700 THEN 'B-'
    WHEN score >= 650 THEN 'C+'
    WHEN score >= 600 THEN 'C'
    WHEN score >= 550 THEN 'C-'
    WHEN score >= 500 THEN 'D'
    ELSE 'F'
  END;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- COMMENTS
-- =====================================================

COMMENT ON TABLE public.pro_company_profiles IS 'Profils entreprises pour les utilisateurs B2B professionnels';
COMMENT ON TABLE public.company_documents IS 'Documents officiels des entreprises (Kbis, assurances, certifications)';
COMMENT ON TABLE public.pro_devis_analyses IS 'Analyses de devis soumis par les professionnels B2B';
COMMENT ON TABLE public.ticket_tracking_events IS 'Tracking des consultations de tickets TORP (QR codes)';

COMMENT ON COLUMN public.pro_devis_analyses.score_total IS 'Score TORP total sur 1000 points';
COMMENT ON COLUMN public.pro_devis_analyses.grade IS 'Note TORP (A+, A, A-, B+, B, B-, C+, C, C-, D, F)';
COMMENT ON COLUMN public.pro_devis_analyses.ticket_code IS 'Code unique pour QR code et lien public (ex: TORP-ABC123XY)';
COMMENT ON COLUMN public.pro_devis_analyses.version IS 'Version de l''analyse (pour amélioration itérative)';
COMMENT ON COLUMN public.pro_devis_analyses.parent_analysis_id IS 'Lien vers l''analyse précédente (si ré-analyse)';
