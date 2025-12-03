-- ============================================
-- Migration: Tables pour le module PRO (B2B)
-- ============================================

-- 1. Table pro_devis_analyses - Analyses de devis pour les pros
CREATE TABLE IF NOT EXISTS pro_devis_analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,

  -- Informations du devis
  reference_devis TEXT,
  nom_projet TEXT,
  notes TEXT,
  fichiers_urls TEXT[] DEFAULT '{}',

  -- Résultats d'analyse
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'analyzing', 'completed', 'failed')),
  score_total INTEGER,
  grade TEXT CHECK (grade IN ('A+', 'A', 'B', 'C', 'D', 'F')),
  montant_ht DECIMAL(12,2),

  -- Détails analyse
  analyse_entreprise JSONB,
  analyse_prix JSONB,
  analyse_completude JSONB,
  analyse_conformite JSONB,
  recommandations JSONB,

  -- Ticket généré
  ticket_genere BOOLEAN DEFAULT false,
  ticket_id UUID,

  -- Métadonnées
  created_at TIMESTAMPTZ DEFAULT NOW(),
  analyzed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Table torp_tickets - Tickets TORP générés
CREATE TABLE IF NOT EXISTS torp_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  analyse_id UUID REFERENCES pro_devis_analyses(id) ON DELETE SET NULL,

  -- Identifiants
  reference TEXT NOT NULL UNIQUE,

  -- Informations projet
  nom_projet TEXT,
  client_nom TEXT,

  -- Score TORP
  score_torp INTEGER NOT NULL,
  grade TEXT NOT NULL CHECK (grade IN ('A+', 'A', 'B', 'C', 'D', 'F')),

  -- Statut
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'expired', 'revoked')),

  -- Dates
  date_generation TIMESTAMPTZ DEFAULT NOW(),
  date_expiration TIMESTAMPTZ,

  -- Fichiers
  qr_code_url TEXT,
  pdf_url TEXT,

  -- Métadonnées
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Table company_documents - Documents entreprise (si pas existante)
CREATE TABLE IF NOT EXISTS company_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,

  -- Type et fichier
  type TEXT NOT NULL CHECK (type IN ('kbis', 'assurance_decennale', 'assurance_rc', 'rge', 'qualibat', 'autre')),
  nom TEXT NOT NULL,
  file_url TEXT NOT NULL,

  -- Validité
  date_expiration DATE,
  statut TEXT DEFAULT 'pending' CHECK (statut IN ('pending', 'verified', 'rejected', 'expired')),

  -- Métadonnées
  uploaded_at TIMESTAMPTZ DEFAULT NOW(),
  verified_at TIMESTAMPTZ,
  verified_by UUID
);

-- ============================================
-- Index pour performances
-- ============================================
CREATE INDEX IF NOT EXISTS idx_pro_devis_analyses_company ON pro_devis_analyses(company_id);
CREATE INDEX IF NOT EXISTS idx_pro_devis_analyses_status ON pro_devis_analyses(status);
CREATE INDEX IF NOT EXISTS idx_torp_tickets_company ON torp_tickets(company_id);
CREATE INDEX IF NOT EXISTS idx_torp_tickets_reference ON torp_tickets(reference);
CREATE INDEX IF NOT EXISTS idx_company_documents_company ON company_documents(company_id);
CREATE INDEX IF NOT EXISTS idx_company_documents_type ON company_documents(type);

-- ============================================
-- RLS (Row Level Security)
-- ============================================

-- Activer RLS
ALTER TABLE pro_devis_analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE torp_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_documents ENABLE ROW LEVEL SECURITY;

-- Politique pro_devis_analyses: les utilisateurs ne voient que les analyses de leur entreprise
CREATE POLICY "Users can view own company analyses" ON pro_devis_analyses
  FOR SELECT USING (
    company_id IN (
      SELECT id FROM companies WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own company analyses" ON pro_devis_analyses
  FOR INSERT WITH CHECK (
    company_id IN (
      SELECT id FROM companies WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own company analyses" ON pro_devis_analyses
  FOR UPDATE USING (
    company_id IN (
      SELECT id FROM companies WHERE user_id = auth.uid()
    )
  );

-- Politique torp_tickets: les utilisateurs ne voient que leurs tickets
CREATE POLICY "Users can view own company tickets" ON torp_tickets
  FOR SELECT USING (
    company_id IN (
      SELECT id FROM companies WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own company tickets" ON torp_tickets
  FOR INSERT WITH CHECK (
    company_id IN (
      SELECT id FROM companies WHERE user_id = auth.uid()
    )
  );

-- Politique company_documents: les utilisateurs gèrent leurs documents
CREATE POLICY "Users can view own company documents" ON company_documents
  FOR SELECT USING (
    company_id IN (
      SELECT id FROM companies WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own company documents" ON company_documents
  FOR INSERT WITH CHECK (
    company_id IN (
      SELECT id FROM companies WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own company documents" ON company_documents
  FOR UPDATE USING (
    company_id IN (
      SELECT id FROM companies WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete own company documents" ON company_documents
  FOR DELETE USING (
    company_id IN (
      SELECT id FROM companies WHERE user_id = auth.uid()
    )
  );

-- ============================================
-- Trigger pour updated_at
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
   NEW.updated_at = NOW();
   RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_pro_devis_analyses_updated_at
  BEFORE UPDATE ON pro_devis_analyses
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_torp_tickets_updated_at
  BEFORE UPDATE ON torp_tickets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
