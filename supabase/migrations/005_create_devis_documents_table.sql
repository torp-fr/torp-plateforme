-- Migration: Create devis_documents table for tracking uploaded documents
-- Purpose: Store references to documents uploaded to fill gaps in devis analysis

CREATE TABLE IF NOT EXISTS public.devis_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  devis_id UUID NOT NULL REFERENCES public.devis(id) ON DELETE CASCADE,
  warning_index INTEGER NOT NULL,
  document_type TEXT NOT NULL CHECK (document_type IN ('assurance', 'kbis', 'rge', 'garantie', 'autre')),
  file_path TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  mime_type TEXT NOT NULL,
  uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  analyzed BOOLEAN DEFAULT FALSE,
  score_impact INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_devis_documents_devis_id
  ON public.devis_documents(devis_id);

CREATE INDEX IF NOT EXISTS idx_devis_documents_document_type
  ON public.devis_documents(document_type);

CREATE INDEX IF NOT EXISTS idx_devis_documents_analyzed
  ON public.devis_documents(analyzed);

-- Add RLS policies
ALTER TABLE public.devis_documents ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own documents
CREATE POLICY "Users can view their own devis documents"
  ON public.devis_documents
  FOR SELECT
  USING (
    devis_id IN (
      SELECT id FROM public.devis WHERE user_id = auth.uid()
    )
  );

-- Policy: Users can upload documents to their own devis
CREATE POLICY "Users can upload documents to their own devis"
  ON public.devis_documents
  FOR INSERT
  WITH CHECK (
    devis_id IN (
      SELECT id FROM public.devis WHERE user_id = auth.uid()
    )
  );

-- Policy: Users can delete their own documents
CREATE POLICY "Users can delete their own devis documents"
  ON public.devis_documents
  FOR DELETE
  USING (
    devis_id IN (
      SELECT id FROM public.devis WHERE user_id = auth.uid()
    )
  );

-- Add comment
COMMENT ON TABLE public.devis_documents IS 'Stores uploaded documents to fill gaps in devis analysis (insurance certificates, KBIS, etc.)';
