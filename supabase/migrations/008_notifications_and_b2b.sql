-- Migration: Notifications et Tables B2B
-- Mise à jour de la table notifications et création des tables B2B

-- =====================================================
-- TABLE NOTIFICATIONS (mise à jour)
-- =====================================================

-- Ajouter les colonnes manquantes si elles n'existent pas
ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS data JSONB,
  ADD COLUMN IF NOT EXISTS email_sent BOOLEAN DEFAULT FALSE;

-- Index pour les notifications non lues
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
  ON public.notifications(user_id, read) WHERE read = FALSE;

-- =====================================================
-- TABLE COMPANIES (entreprises B2B)
-- =====================================================

CREATE TABLE IF NOT EXISTS public.companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  siret VARCHAR(14) UNIQUE NOT NULL,
  siren VARCHAR(9) NOT NULL,
  raison_sociale VARCHAR(255) NOT NULL,
  forme_juridique VARCHAR(100),
  code_naf VARCHAR(10),
  libelle_naf VARCHAR(255),
  adresse TEXT,
  code_postal VARCHAR(5),
  ville VARCHAR(100),
  telephone VARCHAR(20),
  email VARCHAR(255),
  site_web VARCHAR(255),
  date_creation DATE,
  capital_social DECIMAL(15,2),
  effectif VARCHAR(50),
  dirigeant_nom VARCHAR(255),
  dirigeant_prenom VARCHAR(255),
  dirigeant_fonction VARCHAR(100),
  siret_verifie BOOLEAN DEFAULT FALSE,
  siret_verifie_le TIMESTAMPTZ,
  completude_profil INTEGER DEFAULT 0,
  score_moyen INTEGER,
  torp_badge VARCHAR(20),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_companies_user_id ON public.companies(user_id);
CREATE INDEX IF NOT EXISTS idx_companies_siret ON public.companies(siret);

-- Trigger updated_at
DROP TRIGGER IF EXISTS update_companies_updated_at ON public.companies;
CREATE TRIGGER update_companies_updated_at
  BEFORE UPDATE ON public.companies
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- TABLE COMPANY_DOCUMENTS (documents entreprise)
-- =====================================================

CREATE TABLE IF NOT EXISTS public.company_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL, -- 'kbis', 'assurance_decennale', 'assurance_rc', 'rge', 'qualibat', etc.
  nom VARCHAR(255) NOT NULL,
  file_url TEXT NOT NULL,
  file_name VARCHAR(255) NOT NULL,
  file_size INTEGER,
  mime_type VARCHAR(100),
  date_emission DATE,
  date_expiration DATE,
  numero_document VARCHAR(100),
  emetteur VARCHAR(255),
  statut VARCHAR(20) DEFAULT 'pending', -- 'pending', 'verified', 'expired', 'rejected'
  date_verification TIMESTAMPTZ,
  verifie_par UUID REFERENCES auth.users(id),
  notes TEXT,
  uploaded_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_company_documents_company_id ON public.company_documents(company_id);
CREATE INDEX IF NOT EXISTS idx_company_documents_type ON public.company_documents(type);
CREATE INDEX IF NOT EXISTS idx_company_documents_expiration ON public.company_documents(date_expiration)
  WHERE date_expiration IS NOT NULL;

-- =====================================================
-- TABLE PRO_DEVIS_ANALYSES (analyses pro)
-- =====================================================

CREATE TABLE IF NOT EXISTS public.pro_devis_analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  reference_devis VARCHAR(100) NOT NULL,
  nom_projet VARCHAR(255),
  description_projet TEXT,
  type_travaux VARCHAR(100),
  montant_ht DECIMAL(15,2),
  montant_ttc DECIMAL(15,2),
  file_url TEXT NOT NULL,
  file_name VARCHAR(255),
  file_size INTEGER,
  status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'analyzing', 'completed', 'failed'
  score_total INTEGER,
  grade VARCHAR(2),
  score_entreprise JSONB,
  score_prix JSONB,
  score_completude JSONB,
  score_conformite JSONB,
  score_delais JSONB,
  recommandations JSONB,
  points_amelioration JSONB,
  points_bloquants JSONB,
  version INTEGER DEFAULT 1,
  parent_analysis_id UUID REFERENCES public.pro_devis_analyses(id),
  ticket_genere BOOLEAN DEFAULT FALSE,
  ticket_url TEXT,
  ticket_code VARCHAR(10) UNIQUE,
  ticket_genere_le TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  analyzed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pro_analyses_company_id ON public.pro_devis_analyses(company_id);
CREATE INDEX IF NOT EXISTS idx_pro_analyses_status ON public.pro_devis_analyses(status);
CREATE INDEX IF NOT EXISTS idx_pro_analyses_ticket_code ON public.pro_devis_analyses(ticket_code)
  WHERE ticket_code IS NOT NULL;

-- Trigger updated_at
DROP TRIGGER IF EXISTS update_pro_analyses_updated_at ON public.pro_devis_analyses;
CREATE TRIGGER update_pro_analyses_updated_at
  BEFORE UPDATE ON public.pro_devis_analyses
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- TABLE TICKETS (tickets TORP publics)
-- =====================================================

CREATE TABLE IF NOT EXISTS public.tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(10) UNIQUE NOT NULL,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  analysis_id UUID NOT NULL REFERENCES public.pro_devis_analyses(id) ON DELETE CASCADE,
  grade VARCHAR(2) NOT NULL,
  score INTEGER NOT NULL,
  entreprise_nom VARCHAR(255) NOT NULL,
  entreprise_siret VARCHAR(14),
  reference_devis VARCHAR(100),
  montant_ht DECIMAL(15,2),
  date_devis DATE,
  resume_analyse JSONB,
  qr_code_url TEXT,
  pdf_url TEXT,
  vues INTEGER DEFAULT 0,
  derniere_vue TIMESTAMPTZ,
  actif BOOLEAN DEFAULT TRUE,
  expire_le TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tickets_code ON public.tickets(code);
CREATE INDEX IF NOT EXISTS idx_tickets_company_id ON public.tickets(company_id);

-- =====================================================
-- AJOUTER company_id à users
-- =====================================================

ALTER TABLE public.users ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id);

-- =====================================================
-- ROW LEVEL SECURITY
-- =====================================================

-- Companies
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own company" ON public.companies;
CREATE POLICY "Users can manage own company" ON public.companies
  FOR ALL USING (auth.uid() = user_id);

-- Company Documents
ALTER TABLE public.company_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own company documents" ON public.company_documents;
CREATE POLICY "Users can manage own company documents" ON public.company_documents
  FOR ALL USING (
    company_id IN (SELECT id FROM public.companies WHERE user_id = auth.uid())
  );

-- Pro Analyses
ALTER TABLE public.pro_devis_analyses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own pro analyses" ON public.pro_devis_analyses;
CREATE POLICY "Users can manage own pro analyses" ON public.pro_devis_analyses
  FOR ALL USING (
    company_id IN (SELECT id FROM public.companies WHERE user_id = auth.uid())
  );

-- Tickets (lecture publique, écriture restreinte)
ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view active tickets" ON public.tickets;
CREATE POLICY "Anyone can view active tickets" ON public.tickets
  FOR SELECT USING (actif = TRUE);

DROP POLICY IF EXISTS "Users can manage own tickets" ON public.tickets;
CREATE POLICY "Users can manage own tickets" ON public.tickets
  FOR ALL USING (
    company_id IN (SELECT id FROM public.companies WHERE user_id = auth.uid())
  );

-- =====================================================
-- FONCTION : Génération code ticket
-- =====================================================

CREATE OR REPLACE FUNCTION generate_ticket_code()
RETURNS TEXT AS $$
DECLARE
  chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  result TEXT := '';
  i INTEGER;
BEGIN
  FOR i IN 1..8 LOOP
    result := result || substr(chars, floor(random() * length(chars) + 1)::integer, 1);
  END LOOP;
  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- COMMENTS
-- =====================================================

COMMENT ON TABLE public.companies IS 'Entreprises BTP inscrites en B2B';
COMMENT ON TABLE public.company_documents IS 'Documents légaux et certifications des entreprises';
COMMENT ON TABLE public.pro_devis_analyses IS 'Analyses de devis par les professionnels B2B';
COMMENT ON TABLE public.tickets IS 'Tickets TORP publics générés par les entreprises';
COMMENT ON COLUMN public.tickets.code IS 'Code court unique pour accès public (8 caractères)';
