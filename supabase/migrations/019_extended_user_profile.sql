-- Extended User Profile Fields
-- Migration pour ajouter des champs de profil complets pour tous les types d'utilisateurs

-- =====================================================
-- Ajout des champs B2G et profil étendu
-- =====================================================

-- Champs B2G spécifiques
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS entity_name TEXT,
ADD COLUMN IF NOT EXISTS entity_type TEXT CHECK (entity_type IN ('commune', 'departement', 'region', 'epci', 'other')),
ADD COLUMN IF NOT EXISTS siret TEXT,
ADD COLUMN IF NOT EXISTS entity_function TEXT; -- Fonction dans la collectivité

-- Champs B2B étendus
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS company_siret TEXT,
ADD COLUMN IF NOT EXISTS company_activity TEXT,
ADD COLUMN IF NOT EXISTS company_size TEXT CHECK (company_size IN ('1-10', '11-50', '51-200', '200+')),
ADD COLUMN IF NOT EXISTS company_role TEXT; -- Fonction dans l'entreprise

-- Champs B2C étendus
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS property_type TEXT CHECK (property_type IN ('house', 'apartment', 'building', 'other')),
ADD COLUMN IF NOT EXISTS property_surface INTEGER,
ADD COLUMN IF NOT EXISTS property_year INTEGER,
ADD COLUMN IF NOT EXISTS is_owner BOOLEAN DEFAULT TRUE;

-- Champs communs à tous
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS bio TEXT,
ADD COLUMN IF NOT EXISTS city TEXT,
ADD COLUMN IF NOT EXISTS postal_code TEXT,
ADD COLUMN IF NOT EXISTS department TEXT,
ADD COLUMN IF NOT EXISTS notification_email BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS notification_sms BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS profile_completed_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS profile_completion_percentage INTEGER DEFAULT 0;

-- =====================================================
-- Index pour les recherches
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_users_entity_type ON public.users(entity_type) WHERE entity_type IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_siret ON public.users(siret) WHERE siret IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_city ON public.users(city) WHERE city IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_department ON public.users(department) WHERE department IS NOT NULL;

-- =====================================================
-- Fonction pour calculer le pourcentage de complétion du profil
-- =====================================================

CREATE OR REPLACE FUNCTION calculate_profile_completion(user_row public.users)
RETURNS INTEGER AS $$
DECLARE
  total_fields INTEGER := 0;
  filled_fields INTEGER := 0;
BEGIN
  -- Champs communs (obligatoires)
  total_fields := total_fields + 4;
  IF user_row.name IS NOT NULL AND user_row.name != '' THEN filled_fields := filled_fields + 1; END IF;
  IF user_row.email IS NOT NULL AND user_row.email != '' THEN filled_fields := filled_fields + 1; END IF;
  IF user_row.phone IS NOT NULL AND user_row.phone != '' THEN filled_fields := filled_fields + 1; END IF;
  IF user_row.city IS NOT NULL AND user_row.city != '' THEN filled_fields := filled_fields + 1; END IF;

  -- Champs selon le type d'utilisateur
  IF user_row.user_type = 'B2C' THEN
    total_fields := total_fields + 3;
    IF user_row.property_type IS NOT NULL THEN filled_fields := filled_fields + 1; END IF;
    IF user_row.property_surface IS NOT NULL THEN filled_fields := filled_fields + 1; END IF;
    IF user_row.postal_code IS NOT NULL THEN filled_fields := filled_fields + 1; END IF;
  ELSIF user_row.user_type = 'B2B' THEN
    total_fields := total_fields + 3;
    IF user_row.company IS NOT NULL AND user_row.company != '' THEN filled_fields := filled_fields + 1; END IF;
    IF user_row.company_siret IS NOT NULL THEN filled_fields := filled_fields + 1; END IF;
    IF user_row.company_role IS NOT NULL THEN filled_fields := filled_fields + 1; END IF;
  ELSIF user_row.user_type = 'B2G' THEN
    total_fields := total_fields + 3;
    IF user_row.entity_name IS NOT NULL AND user_row.entity_name != '' THEN filled_fields := filled_fields + 1; END IF;
    IF user_row.entity_type IS NOT NULL THEN filled_fields := filled_fields + 1; END IF;
    IF user_row.entity_function IS NOT NULL THEN filled_fields := filled_fields + 1; END IF;
  END IF;

  IF total_fields = 0 THEN RETURN 0; END IF;
  RETURN ROUND((filled_fields::DECIMAL / total_fields) * 100);
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- Trigger pour mettre à jour le pourcentage de complétion
-- =====================================================

CREATE OR REPLACE FUNCTION update_profile_completion()
RETURNS TRIGGER AS $$
BEGIN
  NEW.profile_completion_percentage := calculate_profile_completion(NEW);

  -- Si le profil est complété à 100%, marquer la date
  IF NEW.profile_completion_percentage = 100 AND OLD.profile_completion_percentage < 100 THEN
    NEW.profile_completed_at := NOW();
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_profile_completion ON public.users;
CREATE TRIGGER trigger_update_profile_completion
  BEFORE UPDATE ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION update_profile_completion();

-- =====================================================
-- Commentaires sur les colonnes
-- =====================================================

COMMENT ON COLUMN public.users.entity_name IS 'Nom de la collectivité (B2G)';
COMMENT ON COLUMN public.users.entity_type IS 'Type de collectivité: commune, departement, region, epci, other';
COMMENT ON COLUMN public.users.siret IS 'SIRET de la collectivité (B2G)';
COMMENT ON COLUMN public.users.entity_function IS 'Fonction dans la collectivité (B2G)';
COMMENT ON COLUMN public.users.company_siret IS 'SIRET de l''entreprise (B2B)';
COMMENT ON COLUMN public.users.company_activity IS 'Activité principale de l''entreprise (B2B)';
COMMENT ON COLUMN public.users.company_size IS 'Taille de l''entreprise (B2B)';
COMMENT ON COLUMN public.users.company_role IS 'Fonction dans l''entreprise (B2B)';
COMMENT ON COLUMN public.users.property_type IS 'Type de bien: house, apartment, building, other (B2C)';
COMMENT ON COLUMN public.users.property_surface IS 'Surface du bien en m² (B2C)';
COMMENT ON COLUMN public.users.property_year IS 'Année de construction (B2C)';
COMMENT ON COLUMN public.users.is_owner IS 'Propriétaire du bien (B2C)';
COMMENT ON COLUMN public.users.profile_completion_percentage IS 'Pourcentage de complétion du profil';
