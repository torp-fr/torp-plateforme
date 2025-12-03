-- Migration: Comparisons Table
-- Permet aux utilisateurs B2C de comparer plusieurs devis

-- =====================================================
-- TABLE COMPARISONS
-- =====================================================

CREATE TABLE IF NOT EXISTS public.comparisons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name VARCHAR(255),
  devis_ids UUID[] NOT NULL,
  result JSONB,
  winner_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Contraintes: minimum 2 devis, maximum 3
  CONSTRAINT min_devis CHECK (array_length(devis_ids, 1) >= 2),
  CONSTRAINT max_devis CHECK (array_length(devis_ids, 1) <= 3)
);

-- Index pour les requêtes fréquentes
CREATE INDEX idx_comparisons_user_id ON public.comparisons(user_id);
CREATE INDEX idx_comparisons_created_at ON public.comparisons(created_at DESC);

-- Trigger pour updated_at
CREATE TRIGGER update_comparisons_updated_at
  BEFORE UPDATE ON public.comparisons
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- ROW LEVEL SECURITY
-- =====================================================

ALTER TABLE public.comparisons ENABLE ROW LEVEL SECURITY;

-- Les utilisateurs ne peuvent voir que leurs propres comparaisons
CREATE POLICY "Users can view their own comparisons"
  ON public.comparisons FOR SELECT
  USING (auth.uid() = user_id);

-- Les utilisateurs peuvent créer leurs propres comparaisons
CREATE POLICY "Users can create their own comparisons"
  ON public.comparisons FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Les utilisateurs peuvent supprimer leurs propres comparaisons
CREATE POLICY "Users can delete their own comparisons"
  ON public.comparisons FOR DELETE
  USING (auth.uid() = user_id);

-- =====================================================
-- COMMENTS
-- =====================================================

COMMENT ON TABLE public.comparisons IS 'Comparaisons multi-devis pour les utilisateurs B2C';
COMMENT ON COLUMN public.comparisons.devis_ids IS 'Array des IDs de devis à comparer (2-3 max)';
COMMENT ON COLUMN public.comparisons.result IS 'Résultat de la comparaison en JSON';
COMMENT ON COLUMN public.comparisons.winner_id IS 'ID du devis recommandé';
