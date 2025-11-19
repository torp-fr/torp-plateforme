-- ========================================
-- TORP - INSTALLATION COMPLETE AUTOMATIQUE
-- ========================================
-- Ce script fait TOUT en une seule exécution :
-- 1. Nettoie l'ancien schéma
-- 2. Crée le schéma TORP complet
-- 3. Configure les données de démo
-- 4. Prêt à l'emploi !
--
-- INSTRUCTIONS :
-- 1. Ouvrir Supabase SQL Editor
-- 2. Copier-coller TOUT ce fichier
-- 3. Cliquer RUN
-- 4. Attendre le message de succès
-- ========================================

-- =====================================================
-- ÉTAPE 1 : NETTOYAGE (supprime l'ancien schéma)
-- =====================================================

-- Drop tables existantes (ordre inverse des dépendances)
DROP TABLE IF EXISTS public.projects CASCADE;
DROP TABLE IF EXISTS public.user_profiles CASCADE;
DROP TABLE IF EXISTS public.tenants CASCADE;
DROP TABLE IF EXISTS public.activity_logs CASCADE;
DROP TABLE IF EXISTS public.market_data CASCADE;
DROP TABLE IF EXISTS public.notifications CASCADE;
DROP TABLE IF EXISTS public.payments CASCADE;
DROP TABLE IF EXISTS public.devis CASCADE;
DROP TABLE IF EXISTS public.companies CASCADE;
DROP TABLE IF EXISTS public.users CASCADE;

-- Drop functions
DROP FUNCTION IF EXISTS public.get_user_tenant() CASCADE;
DROP FUNCTION IF EXISTS public.update_updated_at_column() CASCADE;
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;
DROP FUNCTION IF EXISTS public.calculate_torp_score(UUID) CASCADE;
DROP FUNCTION IF EXISTS public.assign_grade(INTEGER) CASCADE;

-- Drop types
DROP TYPE IF EXISTS user_type CASCADE;
DROP TYPE IF EXISTS project_status CASCADE;
DROP TYPE IF EXISTS devis_status CASCADE;
DROP TYPE IF EXISTS payment_status CASCADE;
DROP TYPE IF EXISTS notification_type CASCADE;

-- Révocation des permissions
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM authenticated;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM authenticated;

-- =====================================================
-- ÉTAPE 2 : CRÉATION DU SCHÉMA TORP
-- =====================================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ENUMs
CREATE TYPE user_type AS ENUM ('B2C', 'B2B', 'B2G', 'B2B2C', 'admin');
CREATE TYPE project_status AS ENUM ('draft', 'analyzing', 'completed', 'accepted', 'rejected', 'in_progress', 'finished');
CREATE TYPE devis_status AS ENUM ('uploaded', 'analyzing', 'analyzed', 'accepted', 'rejected');
CREATE TYPE payment_status AS ENUM ('pending', 'paid', 'validated', 'dispute', 'refunded');
CREATE TYPE notification_type AS ENUM ('info', 'warning', 'success', 'error');

-- Table USERS
CREATE TABLE public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  user_type user_type NOT NULL DEFAULT 'B2C',
  company TEXT,
  phone TEXT,
  address JSONB,
  subscription_plan TEXT DEFAULT 'free',
  subscription_status TEXT DEFAULT 'active',
  subscription_started_at TIMESTAMP WITH TIME ZONE,
  subscription_ends_at TIMESTAMP WITH TIME ZONE,
  avatar_url TEXT,
  onboarding_completed BOOLEAN DEFAULT FALSE,
  email_verified BOOLEAN DEFAULT FALSE,
  preferences JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_login_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_users_email ON public.users(email);
CREATE INDEX idx_users_user_type ON public.users(user_type);
CREATE INDEX idx_users_created_at ON public.users(created_at DESC);

-- Table COMPANIES
CREATE TABLE public.companies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  siret TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  legal_name TEXT,
  address JSONB,
  activity_code TEXT,
  creation_date DATE,
  employees_count INTEGER,
  annual_revenue DECIMAL(15,2),
  certifications TEXT[] DEFAULT ARRAY[]::TEXT[],
  rge_certified BOOLEAN DEFAULT FALSE,
  qualibat_number TEXT,
  insurance_decennale BOOLEAN DEFAULT FALSE,
  insurance_rc_pro BOOLEAN DEFAULT FALSE,
  insurance_validity_date DATE,
  insurance_documents JSONB DEFAULT '[]'::jsonb,
  torp_score INTEGER DEFAULT 0,
  torp_grade TEXT,
  review_count INTEGER DEFAULT 0,
  average_rating DECIMAL(3,2) DEFAULT 0,
  litigation_count INTEGER DEFAULT 0,
  verified BOOLEAN DEFAULT FALSE,
  verified_at TIMESTAMP WITH TIME ZONE,
  verified_by UUID REFERENCES public.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_companies_siret ON public.companies(siret);
CREATE INDEX idx_companies_name ON public.companies(name);
CREATE INDEX idx_companies_verified ON public.companies(verified);
CREATE INDEX idx_companies_torp_score ON public.companies(torp_score DESC);

-- Table PROJECTS
CREATE TABLE public.projects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  description TEXT,
  project_type TEXT NOT NULL,
  status project_status DEFAULT 'draft',
  estimated_amount DECIMAL(15,2),
  final_amount DECIMAL(15,2),
  currency TEXT DEFAULT 'EUR',
  score INTEGER,
  grade TEXT,
  address JSONB,
  parcel_data JSONB,
  start_date DATE,
  end_date DATE,
  actual_start_date DATE,
  actual_end_date DATE,
  analysis_result JSONB,
  recommendations JSONB DEFAULT '[]'::jsonb,
  tags TEXT[] DEFAULT ARRAY[]::TEXT[],
  archived BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_projects_user_id ON public.projects(user_id);
CREATE INDEX idx_projects_company_id ON public.projects(company_id);
CREATE INDEX idx_projects_status ON public.projects(status);
CREATE INDEX idx_projects_created_at ON public.projects(created_at DESC);

-- Table DEVIS
CREATE TABLE public.devis (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
  devis_number TEXT,
  status devis_status DEFAULT 'uploaded',
  amount DECIMAL(15,2) NOT NULL,
  currency TEXT DEFAULT 'EUR',
  file_url TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size INTEGER,
  file_type TEXT,
  extracted_data JSONB DEFAULT '{}'::jsonb,
  line_items JSONB DEFAULT '[]'::jsonb,
  analyzed_at TIMESTAMP WITH TIME ZONE,
  analysis_duration DECIMAL(10,2),
  analysis_result JSONB,
  score_total INTEGER DEFAULT 0,
  score_entreprise JSONB,
  score_prix JSONB,
  score_completude JSONB,
  score_conformite JSONB,
  score_delais JSONB,
  grade TEXT,
  recommendations JSONB DEFAULT '[]'::jsonb,
  detected_overcosts DECIMAL(15,2) DEFAULT 0,
  potential_savings DECIMAL(15,2) DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_devis_project_id ON public.devis(project_id);
CREATE INDEX idx_devis_company_id ON public.devis(company_id);
CREATE INDEX idx_devis_status ON public.devis(status);
CREATE INDEX idx_devis_created_at ON public.devis(created_at DESC);
CREATE INDEX idx_devis_score_total ON public.devis(score_total DESC);

-- Table PAYMENTS
CREATE TABLE public.payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  amount DECIMAL(15,2) NOT NULL,
  currency TEXT DEFAULT 'EUR',
  status payment_status DEFAULT 'pending',
  payment_method TEXT,
  stripe_payment_intent_id TEXT UNIQUE,
  stripe_session_id TEXT,
  escrow_enabled BOOLEAN DEFAULT FALSE,
  escrow_released_at TIMESTAMP WITH TIME ZONE,
  escrow_conditions JSONB,
  stage_name TEXT,
  stage_percentage DECIMAL(5,2),
  validation_proof JSONB DEFAULT '[]'::jsonb,
  validated_at TIMESTAMP WITH TIME ZONE,
  validated_by UUID REFERENCES public.users(id),
  due_date DATE,
  paid_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_payments_project_id ON public.payments(project_id);
CREATE INDEX idx_payments_user_id ON public.payments(user_id);
CREATE INDEX idx_payments_status ON public.payments(status);
CREATE INDEX idx_payments_stripe_payment_intent_id ON public.payments(stripe_payment_intent_id);

-- Table NOTIFICATIONS
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  type notification_type DEFAULT 'info',
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  link_url TEXT,
  link_type TEXT,
  link_id UUID,
  read BOOLEAN DEFAULT FALSE,
  read_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX idx_notifications_read ON public.notifications(read);
CREATE INDEX idx_notifications_created_at ON public.notifications(created_at DESC);

-- Table MARKET_DATA
CREATE TABLE public.market_data (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  category TEXT NOT NULL,
  subcategory TEXT,
  work_type TEXT NOT NULL,
  unit TEXT,
  price_low DECIMAL(10,2),
  price_avg DECIMAL(10,2),
  price_high DECIMAL(10,2),
  region TEXT,
  department TEXT,
  valid_from DATE NOT NULL,
  valid_until DATE,
  data_source TEXT,
  confidence_score DECIMAL(3,2),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_market_data_category ON public.market_data(category);
CREATE INDEX idx_market_data_work_type ON public.market_data(work_type);
CREATE INDEX idx_market_data_region ON public.market_data(region);
CREATE INDEX idx_market_data_valid_from ON public.market_data(valid_from DESC);

-- Table ACTIVITY_LOGS
CREATE TABLE public.activity_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id UUID,
  ip_address INET,
  user_agent TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_activity_logs_user_id ON public.activity_logs(user_id);
CREATE INDEX idx_activity_logs_action ON public.activity_logs(action);
CREATE INDEX idx_activity_logs_entity_type ON public.activity_logs(entity_type);
CREATE INDEX idx_activity_logs_created_at ON public.activity_logs(created_at DESC);

-- =====================================================
-- ÉTAPE 3 : TRIGGERS
-- =====================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_companies_updated_at BEFORE UPDATE ON public.companies
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_devis_updated_at BEFORE UPDATE ON public.devis
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_payments_updated_at BEFORE UPDATE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_market_data_updated_at BEFORE UPDATE ON public.market_data
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- ÉTAPE 4 : ROW LEVEL SECURITY
-- =====================================================

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.devis ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.market_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

-- Policies USERS
CREATE POLICY "Users can view their own data"
  ON public.users FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update their own data"
  ON public.users FOR UPDATE
  USING (auth.uid() = id);

-- Policies PROJECTS
CREATE POLICY "Users can view their own projects"
  ON public.projects FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own projects"
  ON public.projects FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own projects"
  ON public.projects FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own projects"
  ON public.projects FOR DELETE
  USING (auth.uid() = user_id);

-- Policies DEVIS
CREATE POLICY "Users can view devis for their projects"
  ON public.devis FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = devis.project_id
      AND projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create devis for their projects"
  ON public.devis FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = devis.project_id
      AND projects.user_id = auth.uid()
    )
  );

-- Policies PAYMENTS
CREATE POLICY "Users can view their own payments"
  ON public.payments FOR SELECT
  USING (auth.uid() = user_id);

-- Policies NOTIFICATIONS
CREATE POLICY "Users can view their own notifications"
  ON public.notifications FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own notifications"
  ON public.notifications FOR UPDATE
  USING (auth.uid() = user_id);

-- Policies MARKET_DATA (public read-only)
CREATE POLICY "Authenticated users can view market data"
  ON public.market_data FOR SELECT
  TO authenticated
  USING (true);

-- Policies COMPANIES (public read-only)
CREATE POLICY "Authenticated users can view companies"
  ON public.companies FOR SELECT
  TO authenticated
  USING (true);

-- =====================================================
-- ÉTAPE 5 : FUNCTIONS
-- =====================================================

-- Function: Auto-create user profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, name, user_type)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'name',
    COALESCE((NEW.raw_user_meta_data->>'user_type')::user_type, 'B2C')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Function: Calculate TORP score
CREATE OR REPLACE FUNCTION public.calculate_torp_score(devis_id UUID)
RETURNS INTEGER AS $$
DECLARE
  total_score INTEGER := 0;
  entreprise_score INTEGER;
  prix_score INTEGER;
  completude_score INTEGER;
  conformite_score INTEGER;
  delais_score INTEGER;
BEGIN
  SELECT
    COALESCE((score_entreprise->>'total')::INTEGER, 0),
    COALESCE((score_prix->>'total')::INTEGER, 0),
    COALESCE((score_completude->>'total')::INTEGER, 0),
    COALESCE((score_conformite->>'total')::INTEGER, 0),
    COALESCE((score_delais->>'total')::INTEGER, 0)
  INTO entreprise_score, prix_score, completude_score, conformite_score, delais_score
  FROM public.devis
  WHERE id = devis_id;

  total_score := entreprise_score + prix_score + completude_score + conformite_score + delais_score;
  RETURN total_score;
END;
$$ LANGUAGE plpgsql;

-- Function: Assign grade based on score
CREATE OR REPLACE FUNCTION public.assign_grade(score INTEGER)
RETURNS TEXT AS $$
BEGIN
  RETURN CASE
    WHEN score >= 950 THEN 'A+'
    WHEN score >= 850 THEN 'A'
    WHEN score >= 750 THEN 'B'
    WHEN score >= 650 THEN 'C'
    WHEN score >= 500 THEN 'D'
    ELSE 'F'
  END;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- ÉTAPE 6 : DONNÉES DE DÉMO
-- =====================================================

INSERT INTO public.market_data (category, subcategory, work_type, unit, price_low, price_avg, price_high, region, valid_from)
VALUES
  ('plomberie', 'salle_de_bain', 'Installation lavabo', 'unit', 150, 250, 400, 'Île-de-France', '2024-01-01'),
  ('electricite', 'installation', 'Point lumineux', 'unit', 80, 120, 180, 'Île-de-France', '2024-01-01'),
  ('peinture', 'interieur', 'Peinture murs', 'm2', 15, 25, 40, 'Île-de-France', '2024-01-01'),
  ('carrelage', 'sol', 'Pose carrelage', 'm2', 30, 50, 80, 'Île-de-France', '2024-01-01'),
  ('maconnerie', 'gros_oeuvre', 'Mur parpaing', 'm2', 40, 60, 90, 'Île-de-France', '2024-01-01');

-- =====================================================
-- ÉTAPE 7 : STORAGE POLICIES (devis-uploads bucket)
-- =====================================================
-- NOTE: Le bucket 'devis-uploads' doit être créé via le Dashboard
-- Storage → Create bucket → Name: "devis-uploads", Public: NO

-- Drop existing storage policies
DROP POLICY IF EXISTS "Users can upload devis to their folder" ON storage.objects;
DROP POLICY IF EXISTS "Users can view their own devis files" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own devis files" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own devis files" ON storage.objects;

-- Storage Policy 1: Upload
CREATE POLICY "Users can upload devis to their folder"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'devis-uploads' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Storage Policy 2: View
CREATE POLICY "Users can view their own devis files"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'devis-uploads' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Storage Policy 3: Delete
CREATE POLICY "Users can delete their own devis files"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'devis-uploads' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Storage Policy 4: Update
CREATE POLICY "Users can update their own devis files"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'devis-uploads' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- =====================================================
-- SUCCÈS !
-- =====================================================

SELECT
  '🎉 INSTALLATION TERMINÉE !' as status,
  '8 tables créées' as tables,
  '4 storage policies configurées' as storage,
  'Backend TORP opérationnel' as message;

-- Vérification des tables créées
SELECT
  table_name,
  (SELECT count(*) FROM information_schema.columns WHERE table_name = t.table_name) as nb_columns
FROM information_schema.tables t
WHERE table_schema = 'public'
  AND table_type = 'BASE TABLE'
  AND table_name IN ('users', 'companies', 'projects', 'devis', 'payments', 'notifications', 'market_data', 'activity_logs')
ORDER BY table_name;
