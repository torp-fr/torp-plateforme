-- TORP Phase 0 - Conception & Definition Modules Extension
-- Migration for new Phase 0 modules (0.3 Diagnostic, 0.4 Feasibility, 0.5 CCTP, 0.6 Budget)

-- =====================================================
-- ADD NEW COLUMNS TO phase0_projects
-- =====================================================

-- Diagnostic data (Module 0.3)
ALTER TABLE public.phase0_projects
ADD COLUMN IF NOT EXISTS diagnostic_report JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS diagnostic_documents JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS diagnostic_score INTEGER CHECK (diagnostic_score >= 0 AND diagnostic_score <= 100),
ADD COLUMN IF NOT EXISTS has_blocking_pathologies BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS pathologies_count INTEGER DEFAULT 0;

-- Feasibility data (Module 0.4)
ALTER TABLE public.phase0_projects
ADD COLUMN IF NOT EXISTS feasibility_report JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS feasibility_status TEXT DEFAULT 'not_assessed',
ADD COLUMN IF NOT EXISTS required_permits TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN IF NOT EXISTS abf_consultation_required BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS condo_approval_required BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS regulatory_checklist JSONB DEFAULT '[]'::jsonb;

-- CCTP data (Module 0.5)
ALTER TABLE public.phase0_projects
ADD COLUMN IF NOT EXISTS cctp_document JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS cctp_version INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS cctp_status TEXT DEFAULT 'not_generated',
ADD COLUMN IF NOT EXISTS cctp_completeness DECIMAL(5,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS dpgf_data JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS works_planning JSONB DEFAULT '{}'::jsonb;

-- Budget data (Module 0.6)
ALTER TABLE public.phase0_projects
ADD COLUMN IF NOT EXISTS budget_plan JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS financing_plan JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS aides_analysis JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS cash_flow_plan JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS total_aides_amount DECIMAL(15,2),
ADD COLUMN IF NOT EXISTS financing_coverage DECIMAL(5,2);

-- B2B MOA (Client) data
ALTER TABLE public.phase0_projects
ADD COLUMN IF NOT EXISTS client JSONB DEFAULT '{}'::jsonb;

-- =====================================================
-- NEW ENUMS
-- =====================================================

-- Feasibility status enum
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'feasibility_status') THEN
        CREATE TYPE feasibility_status AS ENUM (
            'not_assessed',
            'feasible',
            'feasible_with_conditions',
            'complex',
            'requires_study',
            'not_feasible'
        );
    END IF;
END $$;

-- CCTP status enum
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'cctp_status') THEN
        CREATE TYPE cctp_status AS ENUM (
            'not_generated',
            'draft',
            'review',
            'approved',
            'issued',
            'superseded'
        );
    END IF;
END $$;

-- Budget status enum
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'budget_status') THEN
        CREATE TYPE budget_status AS ENUM (
            'preliminary',
            'detailed',
            'validated',
            'committed'
        );
    END IF;
END $$;

-- =====================================================
-- NEW TABLE: DIAGNOSTIC REPORTS
-- =====================================================

CREATE TABLE IF NOT EXISTS public.phase0_diagnostic_reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES public.phase0_projects(id) ON DELETE CASCADE,

    -- Report info
    report_type TEXT NOT NULL, -- 'consolidated', 'dpe', 'asbestos', 'lead', etc.
    diagnostic_date DATE,
    expiration_date DATE,
    is_valid BOOLEAN DEFAULT TRUE,

    -- Diagnostician info
    diagnostician_name TEXT,
    diagnostician_company TEXT,
    diagnostician_certification TEXT,

    -- Results
    has_issues BOOLEAN DEFAULT FALSE,
    risk_level TEXT, -- 'low', 'medium', 'high', 'critical'
    score INTEGER CHECK (score >= 0 AND score <= 100),

    -- Detailed data
    diagnostic_data JSONB NOT NULL DEFAULT '{}'::jsonb,
    recommendations JSONB DEFAULT '[]'::jsonb,
    pathologies JSONB DEFAULT '[]'::jsonb,

    -- Documents
    document_url TEXT,
    document_file_name TEXT,
    document_file_size INTEGER,

    -- Photos
    photos JSONB DEFAULT '[]'::jsonb,

    -- AI analysis
    ai_analyzed BOOLEAN DEFAULT FALSE,
    ai_analysis_result JSONB,

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_phase0_diag_reports_project ON public.phase0_diagnostic_reports(project_id);
CREATE INDEX IF NOT EXISTS idx_phase0_diag_reports_type ON public.phase0_diagnostic_reports(report_type);
CREATE INDEX IF NOT EXISTS idx_phase0_diag_reports_valid ON public.phase0_diagnostic_reports(is_valid);

-- =====================================================
-- NEW TABLE: FEASIBILITY CHECKS
-- =====================================================

CREATE TABLE IF NOT EXISTS public.phase0_feasibility_checks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES public.phase0_projects(id) ON DELETE CASCADE,

    -- Check info
    check_type TEXT NOT NULL, -- 'plu', 'permit', 'condo', 'heritage', 'technical', etc.
    check_category TEXT NOT NULL, -- 'regulatory', 'technical', 'administrative'

    -- Status
    status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'passed', 'failed', 'conditional', 'not_applicable'
    compliance TEXT, -- 'compliant', 'non_compliant', 'partial'

    -- Details
    requirement TEXT,
    current_value TEXT,
    threshold_value TEXT,
    deviation TEXT,

    -- Impact
    is_blocking BOOLEAN DEFAULT FALSE,
    impact_level TEXT, -- 'none', 'minor', 'moderate', 'major', 'critical'

    -- Resolution
    resolution TEXT,
    resolution_cost DECIMAL(15,2),
    resolution_delay TEXT,

    -- Source
    source_document TEXT,
    source_authority TEXT,
    verification_date DATE,

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_phase0_feasibility_project ON public.phase0_feasibility_checks(project_id);
CREATE INDEX IF NOT EXISTS idx_phase0_feasibility_type ON public.phase0_feasibility_checks(check_type);
CREATE INDEX IF NOT EXISTS idx_phase0_feasibility_status ON public.phase0_feasibility_checks(status);
CREATE INDEX IF NOT EXISTS idx_phase0_feasibility_blocking ON public.phase0_feasibility_checks(is_blocking);

-- =====================================================
-- NEW TABLE: CCTP LOTS (Detailed lot specifications)
-- =====================================================

CREATE TABLE IF NOT EXISTS public.phase0_cctp_lots (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES public.phase0_projects(id) ON DELETE CASCADE,

    -- Lot identification
    lot_number INTEGER NOT NULL,
    lot_code TEXT NOT NULL,
    lot_name TEXT NOT NULL,
    category TEXT NOT NULL,

    -- Scope
    scope_description TEXT,
    included_works JSONB DEFAULT '[]'::jsonb,
    excluded_works JSONB DEFAULT '[]'::jsonb,
    locations JSONB DEFAULT '[]'::jsonb,
    quantities JSONB DEFAULT '[]'::jsonb,

    -- Material specifications
    material_specs JSONB DEFAULT '[]'::jsonb,

    -- Operating procedures
    operating_procedures JSONB DEFAULT '[]'::jsonb,

    -- Standards
    applicable_standards JSONB DEFAULT '[]'::jsonb,

    -- Quality control
    quality_control JSONB DEFAULT '{}'::jsonb,
    hold_points JSONB DEFAULT '[]'::jsonb,
    tests JSONB DEFAULT '[]'::jsonb,

    -- Warranties
    warranties JSONB DEFAULT '[]'::jsonb,

    -- Interfaces
    interfaces JSONB DEFAULT '[]'::jsonb,

    -- Estimation
    estimated_amount_ht DECIMAL(15,2),
    completeness DECIMAL(5,2) DEFAULT 0,

    -- Ordering
    display_order INTEGER DEFAULT 0,

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    CONSTRAINT unique_cctp_lot UNIQUE (project_id, lot_number)
);

CREATE INDEX IF NOT EXISTS idx_phase0_cctp_lots_project ON public.phase0_cctp_lots(project_id);
CREATE INDEX IF NOT EXISTS idx_phase0_cctp_lots_category ON public.phase0_cctp_lots(category);

-- =====================================================
-- NEW TABLE: BUDGET ITEMS
-- =====================================================

CREATE TABLE IF NOT EXISTS public.phase0_budget_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES public.phase0_projects(id) ON DELETE CASCADE,

    -- Item identification
    category TEXT NOT NULL, -- 'direct_works', 'indirect', 'contingency', 'tax'
    subcategory TEXT,
    item_type TEXT NOT NULL,
    description TEXT NOT NULL,

    -- Amounts
    amount_ht DECIMAL(15,2) NOT NULL,
    vat_rate DECIMAL(4,2) DEFAULT 20,
    vat_amount DECIMAL(15,2),
    amount_ttc DECIMAL(15,2),

    -- Breakdown
    material_cost DECIMAL(15,2),
    labor_cost DECIMAL(15,2),
    equipment_cost DECIMAL(15,2),

    -- Source
    price_source TEXT, -- 'batiprix', 'ffb', 'quote', 'estimate'
    price_date DATE,
    confidence TEXT DEFAULT 'medium',

    -- Lot reference
    lot_id UUID REFERENCES public.phase0_selected_lots(id),
    lot_code TEXT,

    -- Ordering
    display_order INTEGER DEFAULT 0,

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_phase0_budget_items_project ON public.phase0_budget_items(project_id);
CREATE INDEX IF NOT EXISTS idx_phase0_budget_items_category ON public.phase0_budget_items(category);
CREATE INDEX IF NOT EXISTS idx_phase0_budget_items_lot ON public.phase0_budget_items(lot_id);

-- =====================================================
-- NEW TABLE: FINANCING SOURCES
-- =====================================================

CREATE TABLE IF NOT EXISTS public.phase0_financing_sources (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES public.phase0_projects(id) ON DELETE CASCADE,

    -- Source identification
    source_type TEXT NOT NULL, -- 'personal_savings', 'mortgage', 'eco_ptz', 'maprimerénov', etc.
    source_name TEXT NOT NULL,
    provider TEXT,

    -- Amounts
    amount DECIMAL(15,2) NOT NULL,
    percentage DECIMAL(5,2),

    -- Status
    status TEXT DEFAULT 'estimated', -- 'confirmed', 'in_progress', 'to_apply', 'estimated', 'rejected'

    -- Loan details (if applicable)
    interest_rate DECIMAL(6,4),
    duration_months INTEGER,
    monthly_payment DECIMAL(15,2),
    total_interest DECIMAL(15,2),
    total_cost DECIMAL(15,2),

    -- Aid details (if applicable)
    eligibility_confirmed BOOLEAN DEFAULT FALSE,
    application_deadline DATE,
    disbursement_timing TEXT,

    -- Conditions
    conditions JSONB DEFAULT '[]'::jsonb,
    required_documents JSONB DEFAULT '[]'::jsonb,

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_phase0_financing_project ON public.phase0_financing_sources(project_id);
CREATE INDEX IF NOT EXISTS idx_phase0_financing_type ON public.phase0_financing_sources(source_type);
CREATE INDEX IF NOT EXISTS idx_phase0_financing_status ON public.phase0_financing_sources(status);

-- =====================================================
-- NEW TABLE: AIDES ELIGIBILITY
-- =====================================================

CREATE TABLE IF NOT EXISTS public.phase0_aides_eligibility (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES public.phase0_projects(id) ON DELETE CASCADE,

    -- Aide identification
    aide_id TEXT NOT NULL,
    aide_name TEXT NOT NULL,
    aide_type TEXT NOT NULL, -- 'grant', 'subsidized_loan', 'tax_credit', 'cee_prime', etc.
    provider TEXT NOT NULL,

    -- Eligibility
    is_eligible BOOLEAN DEFAULT FALSE,
    eligibility_score INTEGER CHECK (eligibility_score >= 0 AND eligibility_score <= 100),
    eligibility_conditions JSONB DEFAULT '[]'::jsonb,

    -- Amounts
    estimated_amount DECIMAL(15,2),
    max_amount DECIMAL(15,2),
    calculation_basis TEXT,

    -- Cumul rules
    stackable BOOLEAN DEFAULT TRUE,
    stackable_with TEXT[] DEFAULT ARRAY[]::TEXT[],
    exclusive_of TEXT[] DEFAULT ARRAY[]::TEXT[],

    -- Application
    application_url TEXT,
    application_deadline DATE,
    processing_time TEXT,
    disbursement_timing TEXT,

    -- Work eligibility
    eligible_work_types TEXT[] DEFAULT ARRAY[]::TEXT[],
    requires_rge BOOLEAN DEFAULT FALSE,

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    CONSTRAINT unique_aide_per_project UNIQUE (project_id, aide_id)
);

CREATE INDEX IF NOT EXISTS idx_phase0_aides_project ON public.phase0_aides_eligibility(project_id);
CREATE INDEX IF NOT EXISTS idx_phase0_aides_type ON public.phase0_aides_eligibility(aide_type);
CREATE INDEX IF NOT EXISTS idx_phase0_aides_eligible ON public.phase0_aides_eligibility(is_eligible);

-- =====================================================
-- TRIGGERS FOR NEW TABLES
-- =====================================================

CREATE TRIGGER update_phase0_diag_reports_updated_at
    BEFORE UPDATE ON public.phase0_diagnostic_reports
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_phase0_feasibility_updated_at
    BEFORE UPDATE ON public.phase0_feasibility_checks
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_phase0_cctp_lots_updated_at
    BEFORE UPDATE ON public.phase0_cctp_lots
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_phase0_budget_items_updated_at
    BEFORE UPDATE ON public.phase0_budget_items
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_phase0_financing_updated_at
    BEFORE UPDATE ON public.phase0_financing_sources
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_phase0_aides_updated_at
    BEFORE UPDATE ON public.phase0_aides_eligibility
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- ROW LEVEL SECURITY FOR NEW TABLES
-- =====================================================

ALTER TABLE public.phase0_diagnostic_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.phase0_feasibility_checks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.phase0_cctp_lots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.phase0_budget_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.phase0_financing_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.phase0_aides_eligibility ENABLE ROW LEVEL SECURITY;

-- Diagnostic reports policies
CREATE POLICY "Users can view diagnostic reports for their projects"
    ON public.phase0_diagnostic_reports FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.phase0_projects
            WHERE phase0_projects.id = phase0_diagnostic_reports.project_id
            AND phase0_projects.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can manage diagnostic reports for their projects"
    ON public.phase0_diagnostic_reports FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.phase0_projects
            WHERE phase0_projects.id = phase0_diagnostic_reports.project_id
            AND phase0_projects.user_id = auth.uid()
        )
    );

-- Feasibility checks policies
CREATE POLICY "Users can view feasibility checks for their projects"
    ON public.phase0_feasibility_checks FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.phase0_projects
            WHERE phase0_projects.id = phase0_feasibility_checks.project_id
            AND phase0_projects.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can manage feasibility checks for their projects"
    ON public.phase0_feasibility_checks FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.phase0_projects
            WHERE phase0_projects.id = phase0_feasibility_checks.project_id
            AND phase0_projects.user_id = auth.uid()
        )
    );

-- CCTP lots policies
CREATE POLICY "Users can view CCTP lots for their projects"
    ON public.phase0_cctp_lots FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.phase0_projects
            WHERE phase0_projects.id = phase0_cctp_lots.project_id
            AND phase0_projects.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can manage CCTP lots for their projects"
    ON public.phase0_cctp_lots FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.phase0_projects
            WHERE phase0_projects.id = phase0_cctp_lots.project_id
            AND phase0_projects.user_id = auth.uid()
        )
    );

-- Budget items policies
CREATE POLICY "Users can view budget items for their projects"
    ON public.phase0_budget_items FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.phase0_projects
            WHERE phase0_projects.id = phase0_budget_items.project_id
            AND phase0_projects.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can manage budget items for their projects"
    ON public.phase0_budget_items FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.phase0_projects
            WHERE phase0_projects.id = phase0_budget_items.project_id
            AND phase0_projects.user_id = auth.uid()
        )
    );

-- Financing sources policies
CREATE POLICY "Users can view financing sources for their projects"
    ON public.phase0_financing_sources FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.phase0_projects
            WHERE phase0_projects.id = phase0_financing_sources.project_id
            AND phase0_projects.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can manage financing sources for their projects"
    ON public.phase0_financing_sources FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.phase0_projects
            WHERE phase0_projects.id = phase0_financing_sources.project_id
            AND phase0_projects.user_id = auth.uid()
        )
    );

-- Aides eligibility policies
CREATE POLICY "Users can view aides eligibility for their projects"
    ON public.phase0_aides_eligibility FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.phase0_projects
            WHERE phase0_projects.id = phase0_aides_eligibility.project_id
            AND phase0_projects.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can manage aides eligibility for their projects"
    ON public.phase0_aides_eligibility FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.phase0_projects
            WHERE phase0_projects.id = phase0_aides_eligibility.project_id
            AND phase0_projects.user_id = auth.uid()
        )
    );

-- =====================================================
-- FUNCTIONS FOR NEW MODULES
-- =====================================================

-- Calculate diagnostic score
CREATE OR REPLACE FUNCTION calculate_diagnostic_score(project_id UUID)
RETURNS INTEGER AS $$
DECLARE
    total_score INTEGER := 100;
    pathology_count INTEGER;
    critical_count INTEGER;
    high_count INTEGER;
    medium_count INTEGER;
BEGIN
    -- Count pathologies by severity from diagnostic_report JSONB
    SELECT
        COALESCE((diagnostic_report->'pathologies_count')::INTEGER, 0),
        COALESCE((SELECT COUNT(*) FROM jsonb_array_elements(diagnostic_report->'pathologies') p WHERE p->>'severity' = 'critical'), 0),
        COALESCE((SELECT COUNT(*) FROM jsonb_array_elements(diagnostic_report->'pathologies') p WHERE p->>'severity' = 'major'), 0),
        COALESCE((SELECT COUNT(*) FROM jsonb_array_elements(diagnostic_report->'pathologies') p WHERE p->>'severity' = 'moderate'), 0)
    INTO pathology_count, critical_count, high_count, medium_count
    FROM public.phase0_projects p
    WHERE p.id = project_id;

    -- Deduct points based on severity
    total_score := total_score - (critical_count * 20);
    total_score := total_score - (high_count * 10);
    total_score := total_score - (medium_count * 5);

    -- Ensure score is between 0 and 100
    IF total_score < 0 THEN
        total_score := 0;
    END IF;

    RETURN total_score;
END;
$$ LANGUAGE plpgsql;

-- Calculate financing coverage
CREATE OR REPLACE FUNCTION calculate_financing_coverage(project_id UUID)
RETURNS DECIMAL AS $$
DECLARE
    total_budget DECIMAL;
    total_financing DECIMAL;
BEGIN
    SELECT estimated_budget_target INTO total_budget
    FROM public.phase0_projects WHERE id = project_id;

    SELECT COALESCE(SUM(amount), 0) INTO total_financing
    FROM public.phase0_financing_sources
    WHERE project_id = project_id AND status IN ('confirmed', 'in_progress', 'estimated');

    IF total_budget IS NULL OR total_budget = 0 THEN
        RETURN 0;
    END IF;

    RETURN ROUND((total_financing / total_budget) * 100, 2);
END;
$$ LANGUAGE plpgsql;

-- Calculate total aides
CREATE OR REPLACE FUNCTION calculate_total_aides(project_id UUID)
RETURNS DECIMAL AS $$
BEGIN
    RETURN COALESCE(
        (SELECT SUM(estimated_amount)
         FROM public.phase0_aides_eligibility
         WHERE project_id = project_id AND is_eligible = TRUE),
        0
    );
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- GIN INDEXES FOR JSONB COLUMNS
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_phase0_projects_diagnostic_report
    ON public.phase0_projects USING GIN (diagnostic_report);
CREATE INDEX IF NOT EXISTS idx_phase0_projects_feasibility_report
    ON public.phase0_projects USING GIN (feasibility_report);
CREATE INDEX IF NOT EXISTS idx_phase0_projects_cctp_document
    ON public.phase0_projects USING GIN (cctp_document);
CREATE INDEX IF NOT EXISTS idx_phase0_projects_budget_plan
    ON public.phase0_projects USING GIN (budget_plan);
CREATE INDEX IF NOT EXISTS idx_phase0_projects_financing_plan
    ON public.phase0_projects USING GIN (financing_plan);
CREATE INDEX IF NOT EXISTS idx_phase0_projects_aides_analysis
    ON public.phase0_projects USING GIN (aides_analysis);
CREATE INDEX IF NOT EXISTS idx_phase0_projects_client
    ON public.phase0_projects USING GIN (client);

-- =====================================================
-- COMMENTS
-- =====================================================

COMMENT ON COLUMN public.phase0_projects.diagnostic_report IS 'Consolidated diagnostic report (Module 0.3)';
COMMENT ON COLUMN public.phase0_projects.feasibility_report IS 'Technical and regulatory feasibility report (Module 0.4)';
COMMENT ON COLUMN public.phase0_projects.cctp_document IS 'CCTP document structure (Module 0.5)';
COMMENT ON COLUMN public.phase0_projects.budget_plan IS 'Detailed budget plan (Module 0.6)';
COMMENT ON COLUMN public.phase0_projects.financing_plan IS 'Financing sources and plan (Module 0.6)';
COMMENT ON COLUMN public.phase0_projects.aides_analysis IS 'Aides eligibility analysis (Module 0.6)';
COMMENT ON COLUMN public.phase0_projects.client IS 'B2B client/MOA profile data';

COMMENT ON TABLE public.phase0_diagnostic_reports IS 'Individual diagnostic reports for each project';
COMMENT ON TABLE public.phase0_feasibility_checks IS 'Individual feasibility check items for regulatory/technical compliance';
COMMENT ON TABLE public.phase0_cctp_lots IS 'Detailed CCTP specifications per lot';
COMMENT ON TABLE public.phase0_budget_items IS 'Individual budget line items';
COMMENT ON TABLE public.phase0_financing_sources IS 'Financing sources for each project';
COMMENT ON TABLE public.phase0_aides_eligibility IS 'Aides eligibility analysis per project';
