-- Migration: Ajout des colonnes de profil étendues pour B2C, B2B, B2G
-- À exécuter dans Supabase SQL Editor

-- ============================================
-- COLONNES B2C (Particulier)
-- ============================================
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS property_rooms INTEGER,
  ADD COLUMN IF NOT EXISTS property_address TEXT,
  ADD COLUMN IF NOT EXISTS property_energy_class VARCHAR(1) CHECK (property_energy_class IN ('A', 'B', 'C', 'D', 'E', 'F', 'G'));

COMMENT ON COLUMN public.users.property_rooms IS 'Nombre de pièces du bien (B2C)';
COMMENT ON COLUMN public.users.property_address IS 'Adresse complète du bien (B2C)';
COMMENT ON COLUMN public.users.property_energy_class IS 'Classe DPE du bien A-G (B2C)';

-- ============================================
-- COLONNES B2B (Professionnel)
-- ============================================
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS company_address TEXT,
  ADD COLUMN IF NOT EXISTS company_code_ape VARCHAR(10),
  ADD COLUMN IF NOT EXISTS company_rcs VARCHAR(50);

COMMENT ON COLUMN public.users.company_address IS 'Adresse du siège social (B2B)';
COMMENT ON COLUMN public.users.company_code_ape IS 'Code APE/NAF de l''entreprise (B2B)';
COMMENT ON COLUMN public.users.company_rcs IS 'Numéro RCS de l''entreprise (B2B)';

-- ============================================
-- COLONNES B2G (Collectivité)
-- ============================================
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS entity_address TEXT,
  ADD COLUMN IF NOT EXISTS entity_code_insee VARCHAR(10),
  ADD COLUMN IF NOT EXISTS entity_code_ape VARCHAR(10),
  ADD COLUMN IF NOT EXISTS entity_strate VARCHAR(20) CHECK (entity_strate IN (
    'moins_1000', '1000_3500', '3500_10000', '10000_20000',
    '20000_50000', '50000_100000', 'plus_100000'
  )),
  ADD COLUMN IF NOT EXISTS entity_service_name VARCHAR(255),
  ADD COLUMN IF NOT EXISTS entity_service_email VARCHAR(255);

COMMENT ON COLUMN public.users.entity_address IS 'Adresse du siège de la collectivité (B2G)';
COMMENT ON COLUMN public.users.entity_code_insee IS 'Code INSEE de la commune (B2G)';
COMMENT ON COLUMN public.users.entity_code_ape IS 'Code APE de l''entité publique (B2G)';
COMMENT ON COLUMN public.users.entity_strate IS 'Strate démographique de la collectivité (B2G)';
COMMENT ON COLUMN public.users.entity_service_name IS 'Nom du service (B2G)';
COMMENT ON COLUMN public.users.entity_service_email IS 'Email du service (B2G)';

-- ============================================
-- VÉRIFICATION
-- ============================================
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'users'
  AND table_schema = 'public'
  AND column_name IN (
    'property_rooms', 'property_address', 'property_energy_class',
    'company_address', 'company_code_ape', 'company_rcs',
    'entity_address', 'entity_code_insee', 'entity_code_ape',
    'entity_strate', 'entity_service_name', 'entity_service_email'
  )
ORDER BY column_name;
