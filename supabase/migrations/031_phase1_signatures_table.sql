-- Migration: Create phase1_signatures table for contract signature management
-- Date: 2025-12-15
-- Purpose: Track signature requests and status for Phase 1 contracts

-- ============================================================
-- TABLE: phase1_signatures
-- Gestion des signatures de contrats
-- ============================================================

CREATE TABLE IF NOT EXISTS public.phase1_signatures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Référence au contrat
  contrat_id UUID NOT NULL REFERENCES phase1_contrats(id) ON DELETE CASCADE,

  -- Type de signataire
  signataire_type VARCHAR(20) NOT NULL CHECK (signataire_type IN ('maitre_ouvrage', 'entreprise')),

  -- Informations du signataire
  signataire JSONB NOT NULL,
  /* Format:
  {
    "nom": "string",
    "prenom": "string (optional)",
    "email": "string",
    "telephone": "string (optional)",
    "fonction": "string (optional)"
  }
  */

  -- Statut de la signature
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'signed', 'refused', 'expired', 'cancelled')),

  -- Méthode de signature
  method VARCHAR(30) DEFAULT 'manuscrite' CHECK (method IN ('manuscrite', 'electronique_simple', 'electronique_avancee', 'electronique_qualifiee')),

  -- Date de signature (si signée)
  signed_at TIMESTAMPTZ,

  -- Chemin vers le document signé (pour signature manuelle)
  signed_document_path VARCHAR(500),

  -- ID externe du fournisseur de signature (Yousign, DocuSign, etc.)
  external_signature_id VARCHAR(255),

  -- Date d'expiration de la demande
  expires_at TIMESTAMPTZ,

  -- Métadonnées additionnelles
  metadata JSONB DEFAULT '{}',
  /* Format:
  {
    "provider": "manual | yousign | docusign",
    "requestedAt": "ISO date",
    "sentVia": "email | sms | in_app",
    "reminders": [{"sentAt": "ISO date", "method": "email"}],
    "ip_address": "string (optional)",
    "user_agent": "string (optional)"
  }
  */

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- INDEX
-- ============================================================

-- Index sur contrat_id pour récupération rapide des signatures d'un contrat
CREATE INDEX IF NOT EXISTS idx_phase1_signatures_contrat_id
  ON phase1_signatures(contrat_id);

-- Index sur statut pour filtrer les signatures en attente
CREATE INDEX IF NOT EXISTS idx_phase1_signatures_status
  ON phase1_signatures(status);

-- Index sur expires_at pour identifier les demandes expirées
CREATE INDEX IF NOT EXISTS idx_phase1_signatures_expires_at
  ON phase1_signatures(expires_at)
  WHERE status = 'pending';

-- Index composé pour recherche par contrat et type
CREATE INDEX IF NOT EXISTS idx_phase1_signatures_contrat_type
  ON phase1_signatures(contrat_id, signataire_type);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE phase1_signatures ENABLE ROW LEVEL SECURITY;

-- Policy: Les utilisateurs peuvent gérer les signatures de leurs contrats
CREATE POLICY "Users can manage signatures for their contracts"
  ON phase1_signatures
  FOR ALL
  USING (
    contrat_id IN (
      SELECT c.id
      FROM phase1_contrats c
      JOIN projects p ON c.project_id = p.id
      WHERE p.user_id = auth.uid()
    )
  )
  WITH CHECK (
    contrat_id IN (
      SELECT c.id
      FROM phase1_contrats c
      JOIN projects p ON c.project_id = p.id
      WHERE p.user_id = auth.uid()
    )
  );

-- ============================================================
-- TRIGGERS
-- ============================================================

-- Trigger pour mettre à jour updated_at automatiquement
CREATE OR REPLACE FUNCTION update_phase1_signatures_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_phase1_signatures_updated_at ON phase1_signatures;
CREATE TRIGGER trigger_update_phase1_signatures_updated_at
  BEFORE UPDATE ON phase1_signatures
  FOR EACH ROW
  EXECUTE FUNCTION update_phase1_signatures_updated_at();

-- ============================================================
-- FONCTION: Vérifier les signatures expirées
-- ============================================================

CREATE OR REPLACE FUNCTION expire_pending_signatures()
RETURNS INTEGER AS $$
DECLARE
  updated_count INTEGER;
BEGIN
  UPDATE phase1_signatures
  SET
    status = 'expired',
    updated_at = NOW()
  WHERE
    status = 'pending'
    AND expires_at IS NOT NULL
    AND expires_at < NOW();

  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- COMMENTS
-- ============================================================

COMMENT ON TABLE phase1_signatures IS 'Gestion des signatures de contrats Phase 1';
COMMENT ON COLUMN phase1_signatures.signataire_type IS 'Type de signataire: maitre_ouvrage ou entreprise';
COMMENT ON COLUMN phase1_signatures.signataire IS 'Informations du signataire (nom, email, etc.)';
COMMENT ON COLUMN phase1_signatures.method IS 'Méthode de signature utilisée';
COMMENT ON COLUMN phase1_signatures.external_signature_id IS 'ID du fournisseur externe (Yousign, DocuSign)';
COMMENT ON COLUMN phase1_signatures.metadata IS 'Métadonnées additionnelles (provider, reminders, etc.)';

-- ============================================================
-- GRANT PERMISSIONS
-- ============================================================

GRANT ALL ON phase1_signatures TO authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;
