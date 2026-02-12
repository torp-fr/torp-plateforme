-- TORP MVP - Clean Schema (Phase supprimées exclues)
-- Nouvelle migration pour Supabase clean (ancien projet supprimé)
-- Inclut UNIQUEMENT les tables MVP: users, devis, companies, projects

-- =====================================================
-- EXTENSIONS
-- =====================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pgjwt";

-- =====================================================
-- ENUMS
-- =====================================================
CREATE TYPE public.user_type AS ENUM ('B2C', 'B2B', 'admin');
CREATE TYPE public.project_status AS ENUM ('draft', 'analyzing', 'completed', 'accepted', 'rejected');
CREATE TYPE public.devis_status AS ENUM ('uploaded', 'analyzing', 'analyzed', 'accepted', 'rejected');

-- =====================================================
-- USERS TABLE
-- =====================================================
CREATE TABLE public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  user_type public.user_type NOT NULL DEFAULT 'B2C',
  company TEXT,
  phone TEXT,
  
  subscription_plan TEXT DEFAULT 'free',
  subscription_status TEXT DEFAULT 'active',
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

-- =====================================================
-- COMPANIES TABLE
-- =====================================================
CREATE TABLE public.companies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  siret TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  legal_name TEXT,
  address JSONB,
  
  activity_code TEXT,
  employees_count INTEGER,
  annual_revenue DECIMAL(15,2),
  
  certifications TEXT[] DEFAULT ARRAY[]::TEXT[],
  rge_certified BOOLEAN DEFAULT FALSE,
  
  insurance_decennale BOOLEAN DEFAULT FALSE,
  insurance_rc_pro BOOLEAN DEFAULT FALSE,
  insurance_validity_date DATE,
  
  torp_score INTEGER DEFAULT 0,
  torp_grade TEXT,
  average_rating DECIMAL(3,2) DEFAULT 0,
  
  verified BOOLEAN DEFAULT FALSE,
  verified_at TIMESTAMP WITH TIME ZONE,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_companies_siret ON public.companies(siret);
CREATE INDEX idx_companies_user_id ON public.companies(user_id);

-- =====================================================
-- PROJECTS TABLE
-- =====================================================
CREATE TABLE public.projects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  nom_projet TEXT NOT NULL,
  description TEXT,
  type_travaux TEXT,
  
  status public.project_status DEFAULT 'draft',
  budget DECIMAL(15,2),
  surface DECIMAL(10,2),
  
  adresse JSONB,
  date_debut DATE,
  date_fin DATE,
  urgence TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_projects_user_id ON public.projects(user_id);
CREATE INDEX idx_projects_status ON public.projects(status);

-- =====================================================
-- DEVIS TABLE (Main scoring table)
-- =====================================================
CREATE TABLE public.devis (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
  
  nom_projet TEXT,
  type_travaux TEXT,
  
  status public.devis_status DEFAULT 'uploaded',
  
  -- File storage
  file_url TEXT,
  file_name TEXT,
  file_size INTEGER,
  file_type TEXT,
  
  -- Extraction data (raw OCR)
  extracted_data JSONB,
  
  -- Scoring (1000 points)
  score_total INTEGER DEFAULT 0,
  grade TEXT DEFAULT 'C',
  
  -- Breakdown scores
  score_entreprise JSONB,
  score_prix JSONB,
  score_completude JSONB,
  score_conformite JSONB,
  score_delais JSONB,
  score_innovation_durable JSONB,
  score_transparence JSONB,
  
  -- Analysis results
  analysis_result JSONB,
  recommendations JSONB,
  
  -- Metadata
  montant_total DECIMAL(15,2),
  comparaison_prix JSONB,
  detected_overcosts DECIMAL(15,2),
  potential_savings DECIMAL(15,2),
  
  -- Timestamps
  analyzed_at TIMESTAMP WITH TIME ZONE,
  analysis_duration INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_devis_user_id ON public.devis(user_id);
CREATE INDEX idx_devis_project_id ON public.devis(project_id);
CREATE INDEX idx_devis_status ON public.devis(status);
CREATE INDEX idx_devis_score ON public.devis(score_total DESC);

-- =====================================================
-- TORP TICKETS TABLE (B2B certificates)
-- =====================================================
CREATE TABLE public.torp_tickets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  
  reference TEXT UNIQUE NOT NULL,
  code_acces TEXT UNIQUE NOT NULL,
  
  entreprise_nom TEXT,
  nom_projet TEXT,
  
  score_torp INTEGER,
  grade TEXT,
  
  status TEXT DEFAULT 'active',
  
  date_emission TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  date_expiration TIMESTAMP WITH TIME ZONE,
  duree_validite INTEGER,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_torp_tickets_company_id ON public.torp_tickets(company_id);
CREATE INDEX idx_torp_tickets_reference ON public.torp_tickets(reference);

-- =====================================================
-- RLS POLICIES (Row Level Security)
-- =====================================================

-- Enable RLS on all tables
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.devis ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.torp_tickets ENABLE ROW LEVEL SECURITY;

-- Users: Can only see own profile
CREATE POLICY "Users can view own profile" ON public.users
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON public.users
  FOR UPDATE USING (auth.uid() = id);

-- Companies: Users can see their own companies
CREATE POLICY "Users can view own companies" ON public.companies
  FOR SELECT USING (auth.uid() = user_id OR auth.jwt() ->> 'role' = 'admin');

CREATE POLICY "Users can insert own companies" ON public.companies
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Projects: Users can see their own projects
CREATE POLICY "Users can view own projects" ON public.projects
  FOR SELECT USING (auth.uid() = user_id OR auth.jwt() ->> 'role' = 'admin');

CREATE POLICY "Users can insert own projects" ON public.projects
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own projects" ON public.projects
  FOR UPDATE USING (auth.uid() = user_id);

-- Devis: Users can see their own devis
CREATE POLICY "Users can view own devis" ON public.devis
  FOR SELECT USING (auth.uid() = user_id OR auth.jwt() ->> 'role' = 'admin');

CREATE POLICY "Users can insert own devis" ON public.devis
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own devis" ON public.devis
  FOR UPDATE USING (auth.uid() = user_id);

-- Torp Tickets: Companies can view their tickets
CREATE POLICY "Companies can view own tickets" ON public.torp_tickets
  FOR SELECT USING (
    company_id IN (SELECT id FROM public.companies WHERE user_id = auth.uid()) 
    OR auth.jwt() ->> 'role' = 'admin'
  );

-- =====================================================
-- STORAGE BUCKETS
-- =====================================================
CREATE BUCKET devis_uploads;
CREATE BUCKET documents;

-- Storage policies
INSERT INTO storage.buckets (id, name, public) VALUES ('devis_uploads', 'devis_uploads', false);
INSERT INTO storage.buckets (id, name, public) VALUES ('documents', 'documents', false);

-- =====================================================
-- FUNCTIONS
-- =====================================================

-- Auto-create user profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, user_type)
  VALUES (new.id, new.email, 'B2C');
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for new user creation
CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Update timestamp on modification
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_companies_updated_at BEFORE UPDATE ON public.companies
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_devis_updated_at BEFORE UPDATE ON public.devis
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

