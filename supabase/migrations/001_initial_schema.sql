-- TORP Database Schema
-- Initial migration for Supabase PostgreSQL

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =====================================================
-- ENUMS
-- =====================================================

CREATE TYPE user_type AS ENUM ('B2C', 'B2B', 'B2G', 'B2B2C', 'admin');
CREATE TYPE project_status AS ENUM ('draft', 'analyzing', 'completed', 'accepted', 'rejected', 'in_progress', 'finished');
CREATE TYPE devis_status AS ENUM ('uploaded', 'analyzing', 'analyzed', 'accepted', 'rejected');
CREATE TYPE payment_status AS ENUM ('pending', 'paid', 'validated', 'dispute', 'refunded');
CREATE TYPE notification_type AS ENUM ('info', 'warning', 'success', 'error');

-- =====================================================
-- USERS TABLE (extends Supabase auth.users)
-- =====================================================

CREATE TABLE public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  user_type user_type NOT NULL DEFAULT 'B2C',
  company TEXT,
  phone TEXT,
  address JSONB,

  -- Subscription
  subscription_plan TEXT DEFAULT 'free',
  subscription_status TEXT DEFAULT 'active',
  subscription_started_at TIMESTAMP WITH TIME ZONE,
  subscription_ends_at TIMESTAMP WITH TIME ZONE,

  -- Metadata
  avatar_url TEXT,
  onboarding_completed BOOLEAN DEFAULT FALSE,
  email_verified BOOLEAN DEFAULT FALSE,
  preferences JSONB DEFAULT '{}'::jsonb,

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_login_at TIMESTAMP WITH TIME ZONE
);

-- Index for faster queries
CREATE INDEX idx_users_email ON public.users(email);
CREATE INDEX idx_users_user_type ON public.users(user_type);
CREATE INDEX idx_users_created_at ON public.users(created_at DESC);

-- =====================================================
-- COMPANIES TABLE (for B2B users & enterprises)
-- =====================================================

CREATE TABLE public.companies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  siret TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  legal_name TEXT,
  address JSONB,

  -- Company details
  activity_code TEXT,
  creation_date DATE,
  employees_count INTEGER,
  annual_revenue DECIMAL(15,2),

  -- Certifications
  certifications TEXT[] DEFAULT ARRAY[]::TEXT[],
  rge_certified BOOLEAN DEFAULT FALSE,
  qualibat_number TEXT,

  -- Insurance
  insurance_decennale BOOLEAN DEFAULT FALSE,
  insurance_rc_pro BOOLEAN DEFAULT FALSE,
  insurance_validity_date DATE,
  insurance_documents JSONB DEFAULT '[]'::jsonb,

  -- Reputation & ratings
  torp_score INTEGER DEFAULT 0,
  torp_grade TEXT,
  review_count INTEGER DEFAULT 0,
  average_rating DECIMAL(3,2) DEFAULT 0,
  litigation_count INTEGER DEFAULT 0,

  -- Verification
  verified BOOLEAN DEFAULT FALSE,
  verified_at TIMESTAMP WITH TIME ZONE,
  verified_by UUID REFERENCES public.users(id),

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_companies_siret ON public.companies(siret);
CREATE INDEX idx_companies_name ON public.companies(name);
CREATE INDEX idx_companies_verified ON public.companies(verified);
CREATE INDEX idx_companies_torp_score ON public.companies(torp_score DESC);

-- =====================================================
-- PROJECTS TABLE
-- =====================================================

CREATE TABLE public.projects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,

  -- Project details
  name TEXT NOT NULL,
  description TEXT,
  project_type TEXT NOT NULL, -- 'renovation', 'construction', 'extension', etc.
  status project_status DEFAULT 'draft',

  -- Financials
  estimated_amount DECIMAL(15,2),
  final_amount DECIMAL(15,2),
  currency TEXT DEFAULT 'EUR',

  -- Scoring
  score INTEGER,
  grade TEXT,

  -- Location
  address JSONB,
  parcel_data JSONB,

  -- Timeline
  start_date DATE,
  end_date DATE,
  actual_start_date DATE,
  actual_end_date DATE,

  -- Analysis results
  analysis_result JSONB,
  recommendations JSONB DEFAULT '[]'::jsonb,

  -- Metadata
  tags TEXT[] DEFAULT ARRAY[]::TEXT[],
  archived BOOLEAN DEFAULT FALSE,

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_projects_user_id ON public.projects(user_id);
CREATE INDEX idx_projects_company_id ON public.projects(company_id);
CREATE INDEX idx_projects_status ON public.projects(status);
CREATE INDEX idx_projects_created_at ON public.projects(created_at DESC);

-- =====================================================
-- DEVIS TABLE
-- =====================================================

CREATE TABLE public.devis (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,

  -- Devis details
  devis_number TEXT,
  status devis_status DEFAULT 'uploaded',
  amount DECIMAL(15,2) NOT NULL,
  currency TEXT DEFAULT 'EUR',

  -- File storage
  file_url TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size INTEGER,
  file_type TEXT,

  -- Extracted data
  extracted_data JSONB DEFAULT '{}'::jsonb,
  line_items JSONB DEFAULT '[]'::jsonb,

  -- AI Analysis
  analyzed_at TIMESTAMP WITH TIME ZONE,
  analysis_duration DECIMAL(10,2), -- in seconds
  analysis_result JSONB,

  -- TORP Scoring (total 1000 points)
  score_total INTEGER DEFAULT 0,
  score_entreprise JSONB,
  score_prix JSONB,
  score_completude JSONB,
  score_conformite JSONB,
  score_delais JSONB,
  grade TEXT,

  -- Recommendations
  recommendations JSONB DEFAULT '[]'::jsonb,
  detected_overcosts DECIMAL(15,2) DEFAULT 0,
  potential_savings DECIMAL(15,2) DEFAULT 0,

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_devis_project_id ON public.devis(project_id);
CREATE INDEX idx_devis_company_id ON public.devis(company_id);
CREATE INDEX idx_devis_status ON public.devis(status);
CREATE INDEX idx_devis_created_at ON public.devis(created_at DESC);
CREATE INDEX idx_devis_score_total ON public.devis(score_total DESC);

-- =====================================================
-- PAYMENTS TABLE
-- =====================================================

CREATE TABLE public.payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,

  -- Payment details
  amount DECIMAL(15,2) NOT  NULL,
  currency TEXT DEFAULT 'EUR',
  status payment_status DEFAULT 'pending',
  payment_method TEXT, -- 'stripe', 'bank_transfer', 'check', etc.

  -- Stripe integration
  stripe_payment_intent_id TEXT UNIQUE,
  stripe_session_id TEXT,

  -- Escrow (séquestre)
  escrow_enabled BOOLEAN DEFAULT FALSE,
  escrow_released_at TIMESTAMP WITH TIME ZONE,
  escrow_conditions JSONB,

  -- Stage payment
  stage_name TEXT,
  stage_percentage DECIMAL(5,2),

  -- Validation
  validation_proof JSONB DEFAULT '[]'::jsonb,
  validated_at TIMESTAMP WITH TIME ZONE,
  validated_by UUID REFERENCES public.users(id),

  -- Timestamps
  due_date DATE,
  paid_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_payments_project_id ON public.payments(project_id);
CREATE INDEX idx_payments_user_id ON public.payments(user_id);
CREATE INDEX idx_payments_status ON public.payments(status);
CREATE INDEX idx_payments_stripe_payment_intent_id ON public.payments(stripe_payment_intent_id);

-- =====================================================
-- NOTIFICATIONS TABLE
-- =====================================================

CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,

  -- Notification content
  type notification_type DEFAULT 'info',
  title TEXT NOT NULL,
  message TEXT NOT NULL,

  -- Linking
  link_url TEXT,
  link_type TEXT, -- 'project', 'devis', 'payment', etc.
  link_id UUID,

  -- Status
  read BOOLEAN DEFAULT FALSE,
  read_at TIMESTAMP WITH TIME ZONE,

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX idx_notifications_read ON public.notifications(read);
CREATE INDEX idx_notifications_created_at ON public.notifications(created_at DESC);

-- =====================================================
-- MARKET_DATA TABLE (for AI price comparisons)
-- =====================================================

CREATE TABLE public.market_data (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Classification
  category TEXT NOT NULL, -- 'plomberie', 'electricite', 'maconnerie', etc.
  subcategory TEXT,
  work_type TEXT NOT NULL,

  -- Pricing
  unit TEXT, -- 'm2', 'ml', 'unit', 'hour', etc.
  price_low DECIMAL(10,2),
  price_avg DECIMAL(10,2),
  price_high DECIMAL(10,2),

  -- Location
  region TEXT,
  department TEXT,

  -- Validity
  valid_from DATE NOT NULL,
  valid_until DATE,

  -- Source
  data_source TEXT,
  confidence_score DECIMAL(3,2),

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_market_data_category ON public.market_data(category);
CREATE INDEX idx_market_data_work_type ON public.market_data(work_type);
CREATE INDEX idx_market_data_region ON public.market_data(region);
CREATE INDEX idx_market_data_valid_from ON public.market_data(valid_from DESC);

-- =====================================================
-- ACTIVITY_LOGS TABLE (audit trail)
-- =====================================================

CREATE TABLE public.activity_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,

  -- Activity details
  action TEXT NOT NULL,
  entity_type TEXT, -- 'project', 'devis', 'user', etc.
  entity_id UUID,

  -- Context
  ip_address INET,
  user_agent TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_activity_logs_user_id ON public.activity_logs(user_id);
CREATE INDEX idx_activity_logs_action ON public.activity_logs(action);
CREATE INDEX idx_activity_logs_entity_type ON public.activity_logs(entity_type);
CREATE INDEX idx_activity_logs_created_at ON public.activity_logs(created_at DESC);

-- =====================================================
-- TRIGGERS FOR UPDATED_AT
-- =====================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to tables with updated_at
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
-- ROW LEVEL SECURITY (RLS) POLICIES
-- =====================================================

-- Enable RLS on all tables
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.devis ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.market_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

-- Users policies
CREATE POLICY "Users can view their own data"
  ON public.users FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update their own data"
  ON public.users FOR UPDATE
  USING (auth.uid() = id);

-- Projects policies
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

-- Devis policies
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

-- Payments policies
CREATE POLICY "Users can view their own payments"
  ON public.payments FOR SELECT
  USING (auth.uid() = user_id);

-- Notifications policies
CREATE POLICY "Users can view their own notifications"
  ON public.notifications FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own notifications"
  ON public.notifications FOR UPDATE
  USING (auth.uid() = user_id);

-- Market data is public (read-only for all authenticated users)
CREATE POLICY "Authenticated users can view market data"
  ON public.market_data FOR SELECT
  TO authenticated
  USING (true);

-- Companies are public (read-only for all authenticated users)
CREATE POLICY "Authenticated users can view companies"
  ON public.companies FOR SELECT
  TO authenticated
  USING (true);

-- =====================================================
-- FUNCTIONS
-- =====================================================

-- Function to create user profile on signup
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

-- Trigger to create profile on signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Function to calculate TORP score
CREATE OR REPLACE FUNCTION public.calculate_torp_score(
  devis_id UUID
)
RETURNS INTEGER AS $$
DECLARE
  total_score INTEGER := 0;
  entreprise_score INTEGER;
  prix_score INTEGER;
  completude_score INTEGER;
  conformite_score INTEGER;
  delais_score INTEGER;
BEGIN
  -- Get scores from JSONB fields
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

-- Function to assign grade based on score
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
-- SEED DATA (for development)
-- =====================================================

-- Insert some market data examples
INSERT INTO public.market_data (category, subcategory, work_type, unit, price_low, price_avg, price_high, region, valid_from)
VALUES
  ('plomberie', 'salle_de_bain', 'Installation lavabo', 'unit', 150, 250, 400, 'Île-de-France', '2024-01-01'),
  ('electricite', 'installation', 'Point lumineux', 'unit', 80, 120, 180, 'Île-de-France', '2024-01-01'),
  ('peinture', 'interieur', 'Peinture murs', 'm2', 15, 25, 40, 'Île-de-France', '2024-01-01'),
  ('carrelage', 'sol', 'Pose carrelage', 'm2', 30, 50, 80, 'Île-de-France', '2024-01-01'),
  ('maconnerie', 'gros_oeuvre', 'Mur parpaing', 'm2', 40, 60, 90, 'Île-de-France', '2024-01-01');

-- =====================================================
-- COMMENTS
-- =====================================================

COMMENT ON TABLE public.users IS 'Extended user profiles linked to Supabase auth';
COMMENT ON TABLE public.companies IS 'BTP companies database with certifications and ratings';
COMMENT ON TABLE public.projects IS 'User projects (renovations, constructions, etc.)';
COMMENT ON TABLE public.devis IS 'Uploaded quotes with AI analysis results';
COMMENT ON TABLE public.payments IS 'Payment tracking with escrow support';
COMMENT ON TABLE public.notifications IS 'User notifications system';
COMMENT ON TABLE public.market_data IS 'Reference market prices for AI comparison';
COMMENT ON TABLE public.activity_logs IS 'Audit trail of all user actions';
