-- Migration: create_documents_table.sql
-- Table pour tracker les documents uploadés (devis, photos, plans, etc.)

-- Table documents
CREATE TABLE IF NOT EXISTS public.documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Références
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
  user_id UUID NOT NULL,

  -- Informations fichier
  file_name VARCHAR(255) NOT NULL,
  original_name VARCHAR(255) NOT NULL,
  file_path TEXT NOT NULL,
  file_size BIGINT NOT NULL,
  mime_type VARCHAR(100) NOT NULL,

  -- Classification
  document_type VARCHAR(50) NOT NULL,
  -- Types: quote, invoice, plan, photo, contract, amendment, insurance,
  --        certification, pv_reception, situation, correspondence, other

  category VARCHAR(50),
  -- Categories: administrative, technical, financial, legal, other

  -- Métadonnées
  title VARCHAR(255),
  description TEXT,
  tags TEXT[] DEFAULT '{}',

  -- Version et état
  version INT DEFAULT 1,
  parent_document_id UUID REFERENCES public.documents(id) ON DELETE SET NULL,
  status VARCHAR(20) DEFAULT 'active',
  -- Status: active, archived, deleted, processing

  -- Extraction et analyse
  extracted_text TEXT,
  text_extracted_at TIMESTAMPTZ,
  analysis_result JSONB,
  analyzed_at TIMESTAMPTZ,

  -- Signatures et validations
  is_signed BOOLEAN DEFAULT false,
  signed_by VARCHAR(255),
  signed_at TIMESTAMPTZ,
  validation_status VARCHAR(20),
  -- Validation: pending, validated, rejected
  validated_by VARCHAR(255),
  validated_at TIMESTAMPTZ,

  -- Dates d'expiration (pour assurances, certifications)
  expires_at DATE,
  reminder_sent BOOLEAN DEFAULT false,

  -- Storage
  bucket VARCHAR(50) NOT NULL DEFAULT 'documents',
  is_public BOOLEAN DEFAULT false,

  -- Métadonnées système
  checksum VARCHAR(64),
  thumbnail_path TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index pour recherche performante
CREATE INDEX IF NOT EXISTS idx_documents_project ON public.documents(project_id);
CREATE INDEX IF NOT EXISTS idx_documents_company ON public.documents(company_id);
CREATE INDEX IF NOT EXISTS idx_documents_user ON public.documents(user_id);
CREATE INDEX IF NOT EXISTS idx_documents_type ON public.documents(document_type);
CREATE INDEX IF NOT EXISTS idx_documents_status ON public.documents(status);
CREATE INDEX IF NOT EXISTS idx_documents_expires ON public.documents(expires_at) WHERE expires_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_documents_tags ON public.documents USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_documents_created ON public.documents(created_at DESC);

-- Index fulltext sur le texte extrait
CREATE INDEX IF NOT EXISTS idx_documents_text_search ON public.documents
  USING GIN(to_tsvector('french', COALESCE(title, '') || ' ' || COALESCE(description, '') || ' ' || COALESCE(extracted_text, '')));

-- Trigger updated_at
CREATE OR REPLACE FUNCTION update_documents_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_documents_updated_at ON public.documents;
CREATE TRIGGER trigger_documents_updated_at
  BEFORE UPDATE ON public.documents
  FOR EACH ROW
  EXECUTE FUNCTION update_documents_updated_at();

-- RLS (Row Level Security)
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

-- Politique: les utilisateurs peuvent voir leurs propres documents
CREATE POLICY "Users can view own documents"
  ON public.documents FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Politique: les utilisateurs peuvent voir les documents de leurs projets
CREATE POLICY "Users can view project documents"
  ON public.documents FOR SELECT
  TO authenticated
  USING (
    project_id IN (
      SELECT id FROM public.projects WHERE user_id = auth.uid()
    )
  );

-- Politique: les utilisateurs peuvent uploader des documents
CREATE POLICY "Users can insert own documents"
  ON public.documents FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Politique: les utilisateurs peuvent modifier leurs documents
CREATE POLICY "Users can update own documents"
  ON public.documents FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

-- Politique: les utilisateurs peuvent supprimer (soft delete) leurs documents
CREATE POLICY "Users can delete own documents"
  ON public.documents FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Fonction de recherche fulltext dans les documents
CREATE OR REPLACE FUNCTION search_documents(
  p_user_id UUID,
  p_search_query TEXT,
  p_document_type VARCHAR DEFAULT NULL,
  p_project_id UUID DEFAULT NULL,
  p_status VARCHAR DEFAULT 'active',
  p_limit INT DEFAULT 20
)
RETURNS SETOF public.documents AS $$
BEGIN
  RETURN QUERY
  SELECT d.*
  FROM public.documents d
  WHERE
    d.user_id = p_user_id
    AND d.status = p_status
    AND (p_document_type IS NULL OR d.document_type = p_document_type)
    AND (p_project_id IS NULL OR d.project_id = p_project_id)
    AND (
      p_search_query IS NULL OR p_search_query = '' OR
      to_tsvector('french', COALESCE(d.title, '') || ' ' || COALESCE(d.description, '') || ' ' || COALESCE(d.extracted_text, ''))
      @@ plainto_tsquery('french', p_search_query)
    )
  ORDER BY d.created_at DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Fonction pour obtenir les documents expirant bientôt
CREATE OR REPLACE FUNCTION get_expiring_documents(
  p_user_id UUID,
  p_days_ahead INT DEFAULT 30
)
RETURNS SETOF public.documents AS $$
BEGIN
  RETURN QUERY
  SELECT d.*
  FROM public.documents d
  WHERE
    d.user_id = p_user_id
    AND d.status = 'active'
    AND d.expires_at IS NOT NULL
    AND d.expires_at <= CURRENT_DATE + (p_days_ahead || ' days')::INTERVAL
    AND d.expires_at >= CURRENT_DATE
  ORDER BY d.expires_at ASC;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Commentaires
COMMENT ON TABLE public.documents IS 'Documents uploadés (devis, plans, photos, etc.)';
COMMENT ON COLUMN public.documents.document_type IS 'Type: quote, invoice, plan, photo, contract, amendment, insurance, certification, pv_reception, situation, correspondence, other';
COMMENT ON COLUMN public.documents.extracted_text IS 'Texte extrait du document (OCR ou PDF)';
COMMENT ON COLUMN public.documents.analysis_result IS 'Résultat de l''analyse IA du document';
