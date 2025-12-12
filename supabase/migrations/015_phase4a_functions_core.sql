-- =====================================================
-- TORP Security Fixes - PHASE 4A: FONCTIONS CORE
-- Description: Fonctions utilitaires de base avec search_path
-- Exécuter après Phase 3
-- =====================================================

-- 4.1 set_updated_at - fonction trigger très utilisée
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- 4.2 update_updated_at_column (alias)
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- 4.3 update_updated_at (autre alias)
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- 4.4 is_admin - vérification admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND user_type = 'admin'
  );
END;
$$;

-- 4.5 assign_grade
CREATE OR REPLACE FUNCTION public.assign_grade(score DECIMAL)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
BEGIN
  RETURN CASE
    WHEN score >= 90 THEN 'A+'
    WHEN score >= 80 THEN 'A'
    WHEN score >= 70 THEN 'B+'
    WHEN score >= 60 THEN 'B'
    WHEN score >= 50 THEN 'C+'
    WHEN score >= 40 THEN 'C'
    WHEN score >= 30 THEN 'D'
    ELSE 'E'
  END;
END;
$$;

-- 4.6 calculate_grade_from_score
CREATE OR REPLACE FUNCTION public.calculate_grade_from_score(score DECIMAL)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
BEGIN
  RETURN public.assign_grade(score);
END;
$$;

-- 4.7 generate_ticket_code - génération de codes tickets
CREATE OR REPLACE FUNCTION public.generate_ticket_code()
RETURNS TEXT
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  new_code TEXT;
  counter INT;
BEGIN
  counter := 0;
  LOOP
    new_code := 'TORP-' || TO_CHAR(NOW(), 'YYMMDD') || '-' ||
                LPAD(FLOOR(RANDOM() * 10000)::TEXT, 4, '0');

    EXIT WHEN NOT EXISTS (
      SELECT 1 FROM public.torp_tickets WHERE ticket_code = new_code
    );

    counter := counter + 1;
    IF counter > 100 THEN
      RAISE EXCEPTION 'Unable to generate unique ticket code';
    END IF;
  END LOOP;

  RETURN new_code;
END;
$$;

-- 4.8 generate_phase0_reference
CREATE OR REPLACE FUNCTION public.generate_phase0_reference()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  year_prefix TEXT;
  seq_num INT;
  new_ref TEXT;
BEGIN
  year_prefix := TO_CHAR(NOW(), 'YY');

  SELECT COALESCE(MAX(
    NULLIF(SUBSTRING(reference_number FROM 'P0-' || year_prefix || '-(\d+)')::INT, 0)
  ), 0) + 1
  INTO seq_num
  FROM public.phase0_projects
  WHERE reference_number LIKE 'P0-' || year_prefix || '-%';

  new_ref := 'P0-' || year_prefix || '-' || LPAD(seq_num::TEXT, 5, '0');
  NEW.reference_number := new_ref;

  RETURN NEW;
END;
$$;

-- 4.9 update_phase0_projects_updated_at
CREATE OR REPLACE FUNCTION public.update_phase0_projects_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  NEW.last_activity_at = NOW();
  RETURN NEW;
END;
$$;

-- 4.10 update_company_siren - mise à jour automatique du SIREN
CREATE OR REPLACE FUNCTION public.update_company_siren()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.siret IS NOT NULL AND LENGTH(NEW.siret) >= 9 THEN
    NEW.siren := SUBSTRING(REPLACE(NEW.siret, ' ', '') FROM 1 FOR 9);
  END IF;
  RETURN NEW;
END;
$$;

-- =====================================================
-- FIN PHASE 4A
-- =====================================================
