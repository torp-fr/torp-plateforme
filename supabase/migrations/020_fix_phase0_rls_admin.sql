-- Fix Phase 0 RLS policies for admin/super_admin access
-- Migration pour corriger les problèmes d'accès admin et wizard

-- =====================================================
-- Ajouter super_admin au type user_type si pas déjà fait
-- =====================================================

DO $$
BEGIN
  -- Vérifier si super_admin existe déjà dans l'enum
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'super_admin'
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'user_type')
  ) THEN
    ALTER TYPE user_type ADD VALUE IF NOT EXISTS 'super_admin';
  END IF;
END $$;

-- =====================================================
-- Fonction helper pour vérifier si l'utilisateur est admin
-- =====================================================

CREATE OR REPLACE FUNCTION is_admin_user()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND user_type IN ('admin', 'super_admin')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- Corriger les politiques RLS de phase0_wizard_progress
-- =====================================================

-- Supprimer les anciennes politiques
DROP POLICY IF EXISTS "Users can view wizard progress for their projects" ON public.phase0_wizard_progress;
DROP POLICY IF EXISTS "Users can manage wizard progress for their projects" ON public.phase0_wizard_progress;

-- Nouvelle politique de lecture - utilisateurs normaux + admins
CREATE POLICY "Users and admins can view wizard progress"
  ON public.phase0_wizard_progress FOR SELECT
  USING (
    is_admin_user() OR
    EXISTS (
      SELECT 1 FROM public.phase0_projects
      WHERE phase0_projects.id = phase0_wizard_progress.project_id
      AND phase0_projects.user_id = auth.uid()
    )
  );

-- Nouvelle politique de gestion - utilisateurs normaux + admins
CREATE POLICY "Users and admins can manage wizard progress"
  ON public.phase0_wizard_progress FOR ALL
  USING (
    is_admin_user() OR
    EXISTS (
      SELECT 1 FROM public.phase0_projects
      WHERE phase0_projects.id = phase0_wizard_progress.project_id
      AND phase0_projects.user_id = auth.uid()
    )
  );

-- =====================================================
-- Corriger les politiques RLS de phase0_projects pour admins
-- =====================================================

-- Supprimer les anciennes politiques
DROP POLICY IF EXISTS "Users can view their own phase0 projects" ON public.phase0_projects;
DROP POLICY IF EXISTS "Users can create their own phase0 projects" ON public.phase0_projects;
DROP POLICY IF EXISTS "Users can update their own phase0 projects" ON public.phase0_projects;
DROP POLICY IF EXISTS "Users can delete their own phase0 projects" ON public.phase0_projects;

-- Nouvelles politiques avec support admin
CREATE POLICY "Users can view their projects or admins can view all"
  ON public.phase0_projects FOR SELECT
  USING (auth.uid() = user_id OR is_admin_user());

CREATE POLICY "Users can create their own projects"
  ON public.phase0_projects FOR INSERT
  WITH CHECK (auth.uid() = user_id OR is_admin_user());

CREATE POLICY "Users can update their projects or admins can update all"
  ON public.phase0_projects FOR UPDATE
  USING (auth.uid() = user_id OR is_admin_user());

CREATE POLICY "Users can delete their projects or admins can delete all"
  ON public.phase0_projects FOR DELETE
  USING (auth.uid() = user_id OR is_admin_user());

-- =====================================================
-- Corriger les politiques RLS de phase0_selected_lots
-- =====================================================

DROP POLICY IF EXISTS "Users can view lots for their projects" ON public.phase0_selected_lots;
DROP POLICY IF EXISTS "Users can manage lots for their projects" ON public.phase0_selected_lots;

CREATE POLICY "Users and admins can view lots"
  ON public.phase0_selected_lots FOR SELECT
  USING (
    is_admin_user() OR
    EXISTS (
      SELECT 1 FROM public.phase0_projects
      WHERE phase0_projects.id = phase0_selected_lots.project_id
      AND phase0_projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Users and admins can manage lots"
  ON public.phase0_selected_lots FOR ALL
  USING (
    is_admin_user() OR
    EXISTS (
      SELECT 1 FROM public.phase0_projects
      WHERE phase0_projects.id = phase0_selected_lots.project_id
      AND phase0_projects.user_id = auth.uid()
    )
  );

-- =====================================================
-- Corriger les politiques RLS de phase0_documents
-- =====================================================

DROP POLICY IF EXISTS "Users can view documents for their projects" ON public.phase0_documents;
DROP POLICY IF EXISTS "Users can manage documents for their projects" ON public.phase0_documents;

CREATE POLICY "Users and admins can view documents"
  ON public.phase0_documents FOR SELECT
  USING (
    is_admin_user() OR
    EXISTS (
      SELECT 1 FROM public.phase0_projects
      WHERE phase0_projects.id = phase0_documents.project_id
      AND phase0_projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Users and admins can manage documents"
  ON public.phase0_documents FOR ALL
  USING (
    is_admin_user() OR
    EXISTS (
      SELECT 1 FROM public.phase0_projects
      WHERE phase0_projects.id = phase0_documents.project_id
      AND phase0_projects.user_id = auth.uid()
    )
  );

-- =====================================================
-- Corriger les politiques RLS de phase0_deductions
-- =====================================================

DROP POLICY IF EXISTS "Users can view deductions for their projects" ON public.phase0_deductions;
DROP POLICY IF EXISTS "Users can manage deductions for their projects" ON public.phase0_deductions;

CREATE POLICY "Users and admins can view deductions"
  ON public.phase0_deductions FOR SELECT
  USING (
    is_admin_user() OR
    EXISTS (
      SELECT 1 FROM public.phase0_projects
      WHERE phase0_projects.id = phase0_deductions.project_id
      AND phase0_projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Users and admins can manage deductions"
  ON public.phase0_deductions FOR ALL
  USING (
    is_admin_user() OR
    EXISTS (
      SELECT 1 FROM public.phase0_projects
      WHERE phase0_projects.id = phase0_deductions.project_id
      AND phase0_projects.user_id = auth.uid()
    )
  );

-- =====================================================
-- Ajouter politique pour phase0_lot_reference (lecture publique)
-- =====================================================

DROP POLICY IF EXISTS "Anyone can read lot reference" ON public.phase0_lot_reference;

CREATE POLICY "Authenticated users can read lot reference"
  ON public.phase0_lot_reference FOR SELECT
  TO authenticated
  USING (true);

-- =====================================================
-- Grant necessaires
-- =====================================================

GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- =====================================================
-- Commentaires
-- =====================================================

COMMENT ON FUNCTION is_admin_user() IS 'Vérifie si l''utilisateur courant est admin ou super_admin';
