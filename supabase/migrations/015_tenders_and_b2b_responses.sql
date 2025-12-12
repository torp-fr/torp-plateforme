-- ============================================
-- Migration: Tenders (Appels d'Offres) & B2B Responses
-- Pour le parcours MOA → DCE/AO → Entreprise B2B → Réponse
-- ============================================

-- =====================================================
-- ENUMS
-- =====================================================

CREATE TYPE tender_status AS ENUM (
  'draft',              -- Brouillon, en cours de création
  'ready',              -- Prêt à être publié
  'published',          -- Publié, ouvert aux réponses
  'closed',             -- Fermé aux nouvelles réponses
  'evaluation',         -- En cours d'évaluation des réponses
  'attributed',         -- Attribué à une entreprise
  'cancelled',          -- Annulé
  'archived'            -- Archivé
);

CREATE TYPE tender_visibility AS ENUM (
  'private',            -- Une seule entreprise ciblée
  'restricted',         -- Liste d'entreprises sélectionnées
  'public'              -- Ouvert à toutes les entreprises
);

CREATE TYPE tender_type AS ENUM (
  'simple',             -- Consultation simple (particulier)
  'mapa',               -- Marché à Procédure Adaptée
  'appel_offres',       -- Appel d'offres ouvert
  'restreint'           -- Appel d'offres restreint
);

CREATE TYPE response_status AS ENUM (
  'draft',              -- Brouillon
  'submitted',          -- Soumise
  'received',           -- Reçue et accusée
  'under_review',       -- En cours d'examen
  'shortlisted',        -- Présélectionnée
  'selected',           -- Retenue
  'rejected',           -- Rejetée
  'withdrawn'           -- Retirée par l'entreprise
);

CREATE TYPE document_dce_type AS ENUM (
  'rc',                 -- Règlement de Consultation
  'cctp',               -- Cahier des Clauses Techniques Particulières
  'ccap',               -- Cahier des Clauses Administratives Particulières
  'dpgf',               -- Décomposition du Prix Global Forfaitaire
  'bpu',                -- Bordereau des Prix Unitaires
  'planning',           -- Planning prévisionnel
  'plans',              -- Plans et documents graphiques
  'annexe',             -- Annexes diverses
  'ae',                 -- Acte d'Engagement
  'other'               -- Autre document
);

-- =====================================================
-- TABLE: TENDERS (Appels d'Offres)
-- =====================================================

CREATE TABLE public.tenders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Lien avec le projet Phase 0
  phase0_project_id UUID REFERENCES public.phase0_projects(id) ON DELETE SET NULL,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,

  -- Identification
  reference TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  description TEXT,

  -- Type et visibilité
  tender_type tender_type NOT NULL DEFAULT 'simple',
  visibility tender_visibility NOT NULL DEFAULT 'private',
  status tender_status NOT NULL DEFAULT 'draft',

  -- Dates clés
  publication_date TIMESTAMPTZ,
  questions_deadline TIMESTAMPTZ,      -- Date limite questions
  response_deadline TIMESTAMPTZ,       -- Date limite réponses
  opening_date TIMESTAMPTZ,            -- Date ouverture des plis
  attribution_date TIMESTAMPTZ,        -- Date attribution

  -- Localisation du chantier
  work_address JSONB,                  -- {street, city, postalCode, etc.}
  work_city TEXT,
  work_postal_code TEXT,
  work_department TEXT,
  work_region TEXT,

  -- Informations projet
  project_type TEXT,                   -- renovation, construction, extension...
  work_categories TEXT[],              -- Catégories de lots concernés
  selected_lots JSONB,                 -- Liste des lots avec détails
  lots_count INTEGER DEFAULT 0,

  -- Budget
  estimated_budget_min DECIMAL(15,2),
  estimated_budget_max DECIMAL(15,2),
  budget_visibility TEXT DEFAULT 'hidden', -- hidden, range, exact

  -- Durée estimée
  estimated_duration_days INTEGER,
  desired_start_date DATE,
  desired_end_date DATE,

  -- Documents DCE générés
  dce_documents JSONB DEFAULT '[]'::jsonb,  -- Liste des documents avec URLs
  dce_generated_at TIMESTAMPTZ,
  dce_version INTEGER DEFAULT 1,

  -- Critères d'évaluation
  evaluation_criteria JSONB DEFAULT '[
    {"name": "prix", "weight": 40, "description": "Prix global de l''offre"},
    {"name": "technique", "weight": 35, "description": "Valeur technique de l''offre"},
    {"name": "delai", "weight": 15, "description": "Délai d''exécution"},
    {"name": "references", "weight": 10, "description": "Références et expérience"}
  ]'::jsonb,

  -- Exigences
  requirements JSONB DEFAULT '{}'::jsonb,  -- {rge_required, qualifications, insurances, etc.}

  -- Entreprises ciblées (si private/restricted)
  target_companies UUID[],             -- IDs des entreprises invitées
  invited_count INTEGER DEFAULT 0,

  -- Statistiques
  views_count INTEGER DEFAULT 0,
  downloads_count INTEGER DEFAULT 0,
  responses_count INTEGER DEFAULT 0,

  -- Contact MOA
  contact_name TEXT,
  contact_email TEXT,
  contact_phone TEXT,

  -- Métadonnées
  metadata JSONB DEFAULT '{}'::jsonb,
  tags TEXT[],

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  published_at TIMESTAMPTZ,
  closed_at TIMESTAMPTZ
);

-- Indexes
CREATE INDEX idx_tenders_user_id ON public.tenders(user_id);
CREATE INDEX idx_tenders_phase0_project ON public.tenders(phase0_project_id);
CREATE INDEX idx_tenders_status ON public.tenders(status);
CREATE INDEX idx_tenders_visibility ON public.tenders(visibility);
CREATE INDEX idx_tenders_type ON public.tenders(tender_type);
CREATE INDEX idx_tenders_postal_code ON public.tenders(work_postal_code);
CREATE INDEX idx_tenders_department ON public.tenders(work_department);
CREATE INDEX idx_tenders_deadline ON public.tenders(response_deadline);
CREATE INDEX idx_tenders_created_at ON public.tenders(created_at DESC);
CREATE INDEX idx_tenders_work_categories ON public.tenders USING GIN (work_categories);

-- =====================================================
-- TABLE: TENDER_DOCUMENTS (Documents DCE)
-- =====================================================

CREATE TABLE public.tender_documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tender_id UUID NOT NULL REFERENCES public.tenders(id) ON DELETE CASCADE,

  -- Identification document
  document_type document_dce_type NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  version INTEGER DEFAULT 1,

  -- Fichier
  file_url TEXT,
  file_name TEXT,
  file_size INTEGER,
  file_hash TEXT,
  mime_type TEXT,

  -- Contenu généré (pour documents auto-générés)
  generated_content JSONB,
  is_auto_generated BOOLEAN DEFAULT FALSE,

  -- Statut
  is_required BOOLEAN DEFAULT TRUE,
  is_public BOOLEAN DEFAULT TRUE,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_tender_docs_tender_id ON public.tender_documents(tender_id);
CREATE INDEX idx_tender_docs_type ON public.tender_documents(document_type);

-- =====================================================
-- TABLE: TENDER_INVITATIONS (Invitations entreprises)
-- =====================================================

CREATE TABLE public.tender_invitations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tender_id UUID NOT NULL REFERENCES public.tenders(id) ON DELETE CASCADE,

  -- Entreprise invitée
  company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
  company_siret TEXT,
  company_name TEXT NOT NULL,
  company_email TEXT NOT NULL,

  -- Statut invitation
  status TEXT DEFAULT 'pending', -- pending, sent, viewed, downloaded, responded, declined
  sent_at TIMESTAMPTZ,
  viewed_at TIMESTAMPTZ,
  downloaded_at TIMESTAMPTZ,
  responded_at TIMESTAMPTZ,
  declined_at TIMESTAMPTZ,
  decline_reason TEXT,

  -- Token d'accès unique
  access_token TEXT UNIQUE,
  token_expires_at TIMESTAMPTZ,

  -- Métadonnées
  metadata JSONB DEFAULT '{}'::jsonb,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT unique_tender_company UNIQUE (tender_id, company_siret)
);

CREATE INDEX idx_tender_invitations_tender_id ON public.tender_invitations(tender_id);
CREATE INDEX idx_tender_invitations_company_id ON public.tender_invitations(company_id);
CREATE INDEX idx_tender_invitations_token ON public.tender_invitations(access_token);
CREATE INDEX idx_tender_invitations_status ON public.tender_invitations(status);

-- =====================================================
-- TABLE: TENDER_RESPONSES (Réponses entreprises)
-- =====================================================

CREATE TABLE public.tender_responses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tender_id UUID NOT NULL REFERENCES public.tenders(id) ON DELETE CASCADE,

  -- Entreprise répondante
  company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
  user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  company_siret TEXT NOT NULL,
  company_name TEXT NOT NULL,

  -- Identification réponse
  reference TEXT UNIQUE,
  status response_status NOT NULL DEFAULT 'draft',

  -- Offre financière
  total_amount_ht DECIMAL(15,2),
  total_amount_ttc DECIMAL(15,2),
  vat_amount DECIMAL(15,2),
  vat_rate DECIMAL(5,2) DEFAULT 20.0,

  -- Détail par lot
  lots_breakdown JSONB DEFAULT '[]'::jsonb,  -- [{lotType, amount, duration, details}]

  -- DPGF rempli
  dpgf_data JSONB,
  dpgf_file_url TEXT,

  -- Délais proposés
  proposed_duration_days INTEGER,
  proposed_start_date DATE,
  proposed_end_date DATE,

  -- Mémoire technique
  technical_memo JSONB,                -- Contenu du mémoire technique structuré
  technical_memo_file_url TEXT,        -- Fichier PDF du mémoire

  -- Documents joints
  response_documents JSONB DEFAULT '[]'::jsonb,  -- Attestations, références, etc.

  -- Qualifications et certifications
  qualifications JSONB,                -- RGE, Qualibat, etc.
  insurance_documents JSONB,           -- Décennale, RC Pro

  -- Références chantiers
  project_references JSONB DEFAULT '[]'::jsonb,

  -- Équipe proposée
  proposed_team JSONB,                 -- Composition équipe, qualifications

  -- Sous-traitance éventuelle
  subcontracting JSONB,                -- {planned: boolean, companies: [], percentage}

  -- Variantes (si autorisées)
  variants JSONB DEFAULT '[]'::jsonb,

  -- Scoring TORP (calculé automatiquement)
  torp_score INTEGER,
  torp_grade TEXT,
  scoring_details JSONB,

  -- Évaluation MOA
  moa_evaluation JSONB,                -- Notes par critère
  moa_comments TEXT,
  moa_ranking INTEGER,

  -- IA - Analyse et recommandations
  ai_analysis JSONB,                   -- Analyse IA de la réponse
  ai_positioning_score INTEGER,        -- Score de positionnement (chances)
  ai_recommendations JSONB,            -- Recommandations pour améliorer

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  submitted_at TIMESTAMPTZ,
  received_at TIMESTAMPTZ,
  evaluated_at TIMESTAMPTZ
);

-- Indexes
CREATE INDEX idx_tender_responses_tender_id ON public.tender_responses(tender_id);
CREATE INDEX idx_tender_responses_company_id ON public.tender_responses(company_id);
CREATE INDEX idx_tender_responses_user_id ON public.tender_responses(user_id);
CREATE INDEX idx_tender_responses_status ON public.tender_responses(status);
CREATE INDEX idx_tender_responses_siret ON public.tender_responses(company_siret);
CREATE INDEX idx_tender_responses_score ON public.tender_responses(torp_score DESC);
CREATE INDEX idx_tender_responses_submitted ON public.tender_responses(submitted_at DESC);

-- =====================================================
-- TABLE: TENDER_QUESTIONS (Questions/Réponses)
-- =====================================================

CREATE TABLE public.tender_questions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tender_id UUID NOT NULL REFERENCES public.tenders(id) ON DELETE CASCADE,

  -- Auteur de la question
  company_id UUID REFERENCES public.companies(id),
  company_name TEXT,
  is_anonymous BOOLEAN DEFAULT FALSE,

  -- Question
  question TEXT NOT NULL,
  question_category TEXT,              -- technique, administratif, planning, etc.

  -- Réponse du MOA
  answer TEXT,
  answered_by UUID REFERENCES public.users(id),
  answered_at TIMESTAMPTZ,

  -- Visibilité
  is_public BOOLEAN DEFAULT TRUE,      -- Visible par tous les candidats

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_tender_questions_tender_id ON public.tender_questions(tender_id);
CREATE INDEX idx_tender_questions_company_id ON public.tender_questions(company_id);

-- =====================================================
-- TABLE: KNOWLEDGE_UPLOADS (Upload documents base connaissance)
-- =====================================================

CREATE TABLE public.knowledge_uploads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,

  -- Fichier source
  original_filename TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  mime_type TEXT NOT NULL,
  file_hash TEXT,

  -- Classification
  doc_type TEXT NOT NULL DEFAULT 'autre',  -- dtu, norme, guide, fiche_technique, etc.
  category TEXT,                            -- isolation, chauffage, electricite...
  subcategory TEXT,

  -- Métadonnées extraites
  extracted_title TEXT,
  extracted_author TEXT,
  extracted_date DATE,
  code_reference TEXT,                      -- DTU 45.1, NF C 15-100...

  -- Traitement
  status TEXT DEFAULT 'pending',            -- pending, processing, indexed, error
  processing_started_at TIMESTAMPTZ,
  processing_completed_at TIMESTAMPTZ,
  processing_error TEXT,

  -- Résultats
  pages_count INTEGER,
  chunks_count INTEGER,
  document_id UUID REFERENCES public.knowledge_documents(id),

  -- OCR
  ocr_confidence DECIMAL(5,2),
  requires_ocr BOOLEAN DEFAULT FALSE,

  -- Validation
  is_validated BOOLEAN DEFAULT FALSE,
  validated_by UUID REFERENCES public.users(id),
  validated_at TIMESTAMPTZ,

  -- Métadonnées
  metadata JSONB DEFAULT '{}'::jsonb,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_knowledge_uploads_user_id ON public.knowledge_uploads(user_id);
CREATE INDEX idx_knowledge_uploads_status ON public.knowledge_uploads(status);
CREATE INDEX idx_knowledge_uploads_doc_type ON public.knowledge_uploads(doc_type);
CREATE INDEX idx_knowledge_uploads_category ON public.knowledge_uploads(category);

-- =====================================================
-- TABLE: COMPANY_SPECIALIZATIONS (Spécialisations entreprises)
-- =====================================================

CREATE TABLE public.company_specializations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,

  -- Spécialisation
  lot_type TEXT NOT NULL,              -- Type de lot (couverture, plomberie, etc.)
  lot_category TEXT,

  -- Niveau d'expertise
  expertise_level TEXT DEFAULT 'standard',  -- junior, standard, expert, specialist
  years_experience INTEGER,

  -- Certifications pour ce lot
  certifications TEXT[],
  rge_domains TEXT[],

  -- Zone d'intervention
  intervention_radius_km INTEGER DEFAULT 50,
  intervention_departments TEXT[],

  -- Capacité
  can_lead_lot BOOLEAN DEFAULT TRUE,   -- Peut être entreprise principale
  can_subcontract BOOLEAN DEFAULT TRUE, -- Peut sous-traiter
  max_project_size DECIMAL(15,2),      -- Montant max projet

  -- Références
  completed_projects_count INTEGER DEFAULT 0,
  average_rating DECIMAL(3,2),

  -- Actif
  is_active BOOLEAN DEFAULT TRUE,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT unique_company_lot UNIQUE (company_id, lot_type)
);

CREATE INDEX idx_company_specs_company_id ON public.company_specializations(company_id);
CREATE INDEX idx_company_specs_lot_type ON public.company_specializations(lot_type);
CREATE INDEX idx_company_specs_category ON public.company_specializations(lot_category);
CREATE INDEX idx_company_specs_departments ON public.company_specializations USING GIN (intervention_departments);

-- =====================================================
-- FUNCTIONS
-- =====================================================

-- Génère une référence unique pour un appel d'offres
CREATE OR REPLACE FUNCTION generate_tender_reference()
RETURNS TEXT AS $$
DECLARE
  year_prefix TEXT;
  sequence_num INTEGER;
  ref TEXT;
BEGIN
  year_prefix := TO_CHAR(NOW(), 'YYYY');

  SELECT COALESCE(MAX(
    CAST(SUBSTRING(reference FROM 8) AS INTEGER)
  ), 0) + 1
  INTO sequence_num
  FROM public.tenders
  WHERE reference LIKE 'AO-' || year_prefix || '-%';

  ref := 'AO-' || year_prefix || '-' || LPAD(sequence_num::TEXT, 5, '0');

  RETURN ref;
END;
$$ LANGUAGE plpgsql;

-- Génère une référence unique pour une réponse
CREATE OR REPLACE FUNCTION generate_response_reference()
RETURNS TEXT AS $$
DECLARE
  year_prefix TEXT;
  sequence_num INTEGER;
  ref TEXT;
BEGIN
  year_prefix := TO_CHAR(NOW(), 'YYYY');

  SELECT COALESCE(MAX(
    CAST(SUBSTRING(reference FROM 9) AS INTEGER)
  ), 0) + 1
  INTO sequence_num
  FROM public.tender_responses
  WHERE reference LIKE 'REP-' || year_prefix || '-%';

  ref := 'REP-' || year_prefix || '-' || LPAD(sequence_num::TEXT, 5, '0');

  RETURN ref;
END;
$$ LANGUAGE plpgsql;

-- Trigger pour auto-générer les références
CREATE OR REPLACE FUNCTION set_tender_reference()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.reference IS NULL THEN
    NEW.reference := generate_tender_reference();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_tender_reference_trigger
  BEFORE INSERT ON public.tenders
  FOR EACH ROW EXECUTE FUNCTION set_tender_reference();

CREATE OR REPLACE FUNCTION set_response_reference()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.reference IS NULL THEN
    NEW.reference := generate_response_reference();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_response_reference_trigger
  BEFORE INSERT ON public.tender_responses
  FOR EACH ROW EXECUTE FUNCTION set_response_reference();

-- Mise à jour du compteur de réponses
CREATE OR REPLACE FUNCTION update_tender_responses_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.tenders
    SET responses_count = responses_count + 1,
        updated_at = NOW()
    WHERE id = NEW.tender_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.tenders
    SET responses_count = GREATEST(0, responses_count - 1),
        updated_at = NOW()
    WHERE id = OLD.tender_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_responses_count_trigger
  AFTER INSERT OR DELETE ON public.tender_responses
  FOR EACH ROW EXECUTE FUNCTION update_tender_responses_count();

-- Trigger updated_at
CREATE TRIGGER update_tenders_updated_at
  BEFORE UPDATE ON public.tenders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tender_docs_updated_at
  BEFORE UPDATE ON public.tender_documents
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tender_invitations_updated_at
  BEFORE UPDATE ON public.tender_invitations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tender_responses_updated_at
  BEFORE UPDATE ON public.tender_responses
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tender_questions_updated_at
  BEFORE UPDATE ON public.tender_questions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_knowledge_uploads_updated_at
  BEFORE UPDATE ON public.knowledge_uploads
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_company_specs_updated_at
  BEFORE UPDATE ON public.company_specializations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- ROW LEVEL SECURITY
-- =====================================================

ALTER TABLE public.tenders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tender_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tender_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tender_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tender_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.knowledge_uploads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_specializations ENABLE ROW LEVEL SECURITY;

-- Tenders policies
CREATE POLICY "Users can view their own tenders"
  ON public.tenders FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can view public tenders"
  ON public.tenders FOR SELECT
  USING (visibility = 'public' AND status IN ('published', 'closed', 'evaluation'));

CREATE POLICY "Invited companies can view restricted tenders"
  ON public.tenders FOR SELECT
  USING (
    visibility IN ('private', 'restricted')
    AND status IN ('published', 'closed', 'evaluation')
    AND EXISTS (
      SELECT 1 FROM public.tender_invitations ti
      WHERE ti.tender_id = tenders.id
      AND ti.company_id IN (
        SELECT c.id FROM public.companies c
        WHERE c.user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can manage their own tenders"
  ON public.tenders FOR ALL
  USING (auth.uid() = user_id);

-- Tender documents policies
CREATE POLICY "View tender documents"
  ON public.tender_documents FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.tenders t
      WHERE t.id = tender_documents.tender_id
      AND (
        t.user_id = auth.uid()
        OR (t.visibility = 'public' AND t.status IN ('published', 'closed'))
        OR EXISTS (
          SELECT 1 FROM public.tender_invitations ti
          WHERE ti.tender_id = t.id
          AND ti.company_id IN (SELECT c.id FROM public.companies c WHERE c.user_id = auth.uid())
        )
      )
    )
  );

CREATE POLICY "Manage tender documents"
  ON public.tender_documents FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.tenders t
      WHERE t.id = tender_documents.tender_id
      AND t.user_id = auth.uid()
    )
  );

-- Tender responses policies
CREATE POLICY "Companies can view their own responses"
  ON public.tender_responses FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Tender owners can view responses to their tenders"
  ON public.tender_responses FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.tenders t
      WHERE t.id = tender_responses.tender_id
      AND t.user_id = auth.uid()
    )
  );

CREATE POLICY "Companies can manage their own responses"
  ON public.tender_responses FOR ALL
  USING (user_id = auth.uid());

-- Knowledge uploads policies
CREATE POLICY "Users can view their uploads"
  ON public.knowledge_uploads FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can manage their uploads"
  ON public.knowledge_uploads FOR ALL
  USING (user_id = auth.uid());

-- Company specializations policies
CREATE POLICY "Anyone can view company specializations"
  ON public.company_specializations FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Company owners can manage specializations"
  ON public.company_specializations FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.companies c
      WHERE c.id = company_specializations.company_id
      AND c.user_id = auth.uid()
    )
  );

-- =====================================================
-- COMMENTS
-- =====================================================

COMMENT ON TABLE public.tenders IS 'Appels d''offres générés depuis Phase 0, peuvent être diffusés à une ou plusieurs entreprises';
COMMENT ON TABLE public.tender_documents IS 'Documents du DCE (RC, CCTP, DPGF, etc.)';
COMMENT ON TABLE public.tender_invitations IS 'Invitations envoyées aux entreprises pour un AO';
COMMENT ON TABLE public.tender_responses IS 'Réponses des entreprises aux appels d''offres';
COMMENT ON TABLE public.tender_questions IS 'Questions/réponses pendant la consultation';
COMMENT ON TABLE public.knowledge_uploads IS 'Documents uploadés pour enrichir la base de connaissances';
COMMENT ON TABLE public.company_specializations IS 'Spécialisations des entreprises par type de lot';
