-- =====================================================
-- Fix: Rendre le champ email optionnel dans pro_company_profiles
-- Migration 011
-- =====================================================

-- L'email professionnel peut être différent de l'email du compte utilisateur
-- Il est donc logique de le rendre optionnel
ALTER TABLE public.pro_company_profiles
ALTER COLUMN email DROP NOT NULL;

-- Commentaire pour documenter le changement
COMMENT ON COLUMN public.pro_company_profiles.email IS 'Email professionnel de l''entreprise (optionnel car peut être différent de l''email du compte utilisateur)';
