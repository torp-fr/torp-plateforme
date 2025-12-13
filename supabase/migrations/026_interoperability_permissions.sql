-- =====================================================
-- Migration 026: Interopérabilité et Permissions Multi-Profil
-- Gestion des acteurs projet, notifications cross-profile, documents partagés
-- VERSION CLEAN: Drop et recréation complète
-- =====================================================

-- ===================
-- NETTOYAGE PRÉALABLE
-- ===================

-- Supprimer les tables existantes
DROP TABLE IF EXISTS audit_events CASCADE;
DROP TABLE IF EXISTS shared_documents CASCADE;
DROP TABLE IF EXISTS actor_notifications CASCADE;
DROP TABLE IF EXISTS project_invitations CASCADE;
DROP TABLE IF EXISTS project_actors CASCADE;

-- Supprimer les types existants
DROP TYPE IF EXISTS user_role CASCADE;
DROP TYPE IF EXISTS actor_status CASCADE;
DROP TYPE IF EXISTS notification_priority CASCADE;
DROP TYPE IF EXISTS document_status CASCADE;

-- Supprimer les fonctions existantes
DROP FUNCTION IF EXISTS update_interop_timestamp CASCADE;
DROP FUNCTION IF EXISTS update_actor_activity CASCADE;
DROP FUNCTION IF EXISTS get_user_project_permissions CASCADE;
DROP FUNCTION IF EXISTS user_has_role_on_project CASCADE;
DROP FUNCTION IF EXISTS get_unread_notification_count CASCADE;

-- ===================
-- TYPES ÉNUMÉRÉS
-- ===================

CREATE TYPE user_role AS ENUM (
  'owner', 'client', 'entreprise', 'collaborator', 'viewer', 'admin', 'mediator'
);

CREATE TYPE actor_status AS ENUM (
  'invited', 'active', 'suspended', 'removed'
);

CREATE TYPE notification_priority AS ENUM (
  'low', 'normal', 'high', 'urgent'
);

CREATE TYPE document_status AS ENUM (
  'draft', 'shared', 'signed', 'archived'
);

-- ===================
-- TABLE: Acteurs Projet
-- ===================

CREATE TABLE project_actors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Références
  project_id UUID NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id),

  -- Profil
  user_type VARCHAR(20) NOT NULL,
  role user_role NOT NULL DEFAULT 'viewer',

  -- Informations affichées
  display_name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  phone VARCHAR(50),
  avatar VARCHAR(500),

  -- Entreprise (si B2B)
  company_name VARCHAR(255),
  company_siret VARCHAR(14),

  -- Entité (si B2G)
  entity_name VARCHAR(255),
  entity_type VARCHAR(100),

  -- Permissions personnalisées (JSONB pour flexibilité)
  permissions JSONB DEFAULT '[]',

  -- Statut
  status actor_status DEFAULT 'active',

  -- Dates
  invited_at TIMESTAMPTZ,
  invited_by UUID REFERENCES auth.users(id),
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  last_active_at TIMESTAMPTZ DEFAULT NOW(),

  -- Métadonnées
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Contrainte unique
  CONSTRAINT unique_project_actor UNIQUE (project_id, user_id)
);

-- Index
CREATE INDEX idx_project_actors_project ON project_actors(project_id);
CREATE INDEX idx_project_actors_user ON project_actors(user_id);
CREATE INDEX idx_project_actors_role ON project_actors(role);
CREATE INDEX idx_project_actors_status ON project_actors(status);

-- ===================
-- TABLE: Invitations Projet
-- ===================

CREATE TABLE project_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Références
  project_id UUID NOT NULL,
  email VARCHAR(255) NOT NULL,

  -- Rôle prévu
  role user_role NOT NULL DEFAULT 'viewer',

  -- Inviteur
  invited_by UUID NOT NULL REFERENCES auth.users(id),

  -- Token sécurisé
  token VARCHAR(100) NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),

  -- Statut
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'expired')),

  -- Dates
  expires_at TIMESTAMPTZ NOT NULL,
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index
CREATE INDEX idx_invitations_email ON project_invitations(email);
CREATE INDEX idx_invitations_token ON project_invitations(token);
CREATE INDEX idx_invitations_project ON project_invitations(project_id);
CREATE INDEX idx_invitations_status ON project_invitations(status);

-- ===================
-- TABLE: Notifications Cross-Profile
-- ===================

CREATE TABLE actor_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Type
  type VARCHAR(100) NOT NULL,

  -- Destinataire
  recipient_id UUID NOT NULL REFERENCES auth.users(id),
  recipient_type VARCHAR(20),

  -- Expéditeur (optionnel)
  sender_id UUID REFERENCES auth.users(id),
  sender_name VARCHAR(255),
  sender_type VARCHAR(20),

  -- Contexte
  project_id UUID,
  project_name VARCHAR(255),
  resource_id UUID,
  resource_type VARCHAR(100),

  -- Contenu
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  data JSONB DEFAULT '{}',

  -- Actions (boutons)
  actions JSONB DEFAULT '[]',

  -- Priorité et statut
  priority notification_priority DEFAULT 'normal',
  read BOOLEAN DEFAULT FALSE,
  read_at TIMESTAMPTZ,

  -- Dates
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ
);

-- Index
CREATE INDEX idx_notifications_recipient ON actor_notifications(recipient_id);
CREATE INDEX idx_notifications_project ON actor_notifications(project_id);
CREATE INDEX idx_notifications_read ON actor_notifications(read);
CREATE INDEX idx_notifications_type ON actor_notifications(type);
CREATE INDEX idx_notifications_created ON actor_notifications(created_at DESC);

-- ===================
-- TABLE: Documents Partagés
-- ===================

CREATE TABLE shared_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Projet
  project_id UUID NOT NULL,

  -- Document
  document_type VARCHAR(50) NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  file_url VARCHAR(1000) NOT NULL,
  file_size INTEGER NOT NULL,
  mime_type VARCHAR(100) NOT NULL,

  -- Partage
  shared_by UUID NOT NULL REFERENCES auth.users(id),
  shared_by_name VARCHAR(255) NOT NULL,
  shared_with UUID[] DEFAULT '{}',
  visible_to_roles user_role[] DEFAULT '{owner, client, entreprise}',

  -- Permissions
  allow_download BOOLEAN DEFAULT TRUE,
  allow_comment BOOLEAN DEFAULT TRUE,
  requires_signature BOOLEAN DEFAULT FALSE,

  -- Signatures
  signatures JSONB DEFAULT '[]',

  -- Statut
  status document_status DEFAULT 'draft',

  -- Dates
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ
);

-- Index
CREATE INDEX idx_shared_docs_project ON shared_documents(project_id);
CREATE INDEX idx_shared_docs_type ON shared_documents(document_type);
CREATE INDEX idx_shared_docs_status ON shared_documents(status);
CREATE INDEX idx_shared_docs_shared_by ON shared_documents(shared_by);

-- ===================
-- TABLE: Audit Trail
-- ===================

CREATE TABLE audit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Acteur
  actor_id UUID NOT NULL,
  actor_type VARCHAR(20) NOT NULL,
  actor_name VARCHAR(255) NOT NULL,

  -- Action
  action VARCHAR(100) NOT NULL,
  resource VARCHAR(100) NOT NULL,
  resource_id UUID NOT NULL,

  -- Contexte
  project_id UUID,

  -- Détails
  details JSONB DEFAULT '{}',
  previous_value JSONB,
  new_value JSONB,

  -- Métadonnées techniques
  ip_address VARCHAR(45),
  user_agent TEXT,

  -- Date
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index
CREATE INDEX idx_audit_project ON audit_events(project_id);
CREATE INDEX idx_audit_actor ON audit_events(actor_id);
CREATE INDEX idx_audit_resource ON audit_events(resource, resource_id);
CREATE INDEX idx_audit_action ON audit_events(action);
CREATE INDEX idx_audit_created ON audit_events(created_at DESC);

-- Partitionnement par date pour performance (optionnel, commenté pour simplicité)
-- CREATE TABLE audit_events_partitioned (LIKE audit_events INCLUDING ALL) PARTITION BY RANGE (created_at);

-- ===================
-- TRIGGERS
-- ===================

-- Trigger pour mettre à jour updated_at
CREATE OR REPLACE FUNCTION update_interop_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_project_actors_timestamp
  BEFORE UPDATE ON project_actors
  FOR EACH ROW EXECUTE FUNCTION update_interop_timestamp();

CREATE TRIGGER update_shared_documents_timestamp
  BEFORE UPDATE ON shared_documents
  FOR EACH ROW EXECUTE FUNCTION update_interop_timestamp();

-- Trigger pour mettre à jour last_active_at sur project_actors
CREATE OR REPLACE FUNCTION update_actor_activity()
RETURNS TRIGGER AS $$
BEGIN
  -- Mettre à jour last_active_at pour les acteurs liés au projet
  UPDATE project_actors
  SET last_active_at = NOW()
  WHERE user_id = auth.uid()
    AND project_id = NEW.project_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ===================
-- ROW LEVEL SECURITY
-- ===================

ALTER TABLE project_actors ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE actor_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE shared_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_events ENABLE ROW LEVEL SECURITY;

-- Policies pour project_actors
CREATE POLICY "actors_select_own_projects" ON project_actors
  FOR SELECT USING (
    user_id = auth.uid() OR
    project_id IN (SELECT project_id FROM project_actors WHERE user_id = auth.uid()) OR
    EXISTS (SELECT 1 FROM auth.users WHERE id = auth.uid() AND raw_user_meta_data->>'user_type' IN ('admin', 'super_admin'))
  );

CREATE POLICY "actors_insert_owners" ON project_actors
  FOR INSERT WITH CHECK (
    -- Owner du projet peut ajouter des acteurs
    EXISTS (
      SELECT 1 FROM project_actors
      WHERE project_id = project_actors.project_id
        AND user_id = auth.uid()
        AND role = 'owner'
    ) OR
    -- Ou admin
    EXISTS (SELECT 1 FROM auth.users WHERE id = auth.uid() AND raw_user_meta_data->>'user_type' IN ('admin', 'super_admin'))
  );

CREATE POLICY "actors_update_owners" ON project_actors
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM project_actors pa
      WHERE pa.project_id = project_actors.project_id
        AND pa.user_id = auth.uid()
        AND pa.role IN ('owner', 'admin')
    )
  );

-- Policies pour project_invitations
CREATE POLICY "invitations_select_own" ON project_invitations
  FOR SELECT USING (
    invited_by = auth.uid() OR
    email = (SELECT email FROM auth.users WHERE id = auth.uid())
  );

CREATE POLICY "invitations_insert_auth" ON project_invitations
  FOR INSERT WITH CHECK (invited_by = auth.uid());

-- Policies pour actor_notifications
CREATE POLICY "notifications_select_own" ON actor_notifications
  FOR SELECT USING (recipient_id = auth.uid());

CREATE POLICY "notifications_update_own" ON actor_notifications
  FOR UPDATE USING (recipient_id = auth.uid());

CREATE POLICY "notifications_insert_system" ON actor_notifications
  FOR INSERT WITH CHECK (TRUE); -- Les notifications peuvent être créées par le système

-- Policies pour shared_documents
CREATE POLICY "documents_select_shared" ON shared_documents
  FOR SELECT USING (
    shared_by = auth.uid() OR
    auth.uid() = ANY(shared_with) OR
    EXISTS (
      SELECT 1 FROM project_actors
      WHERE project_id = shared_documents.project_id
        AND user_id = auth.uid()
        AND role = ANY(shared_documents.visible_to_roles)
    ) OR
    EXISTS (SELECT 1 FROM auth.users WHERE id = auth.uid() AND raw_user_meta_data->>'user_type' IN ('admin', 'super_admin'))
  );

CREATE POLICY "documents_insert_members" ON shared_documents
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM project_actors
      WHERE project_id = shared_documents.project_id
        AND user_id = auth.uid()
        AND role IN ('owner', 'entreprise', 'client')
    )
  );

CREATE POLICY "documents_update_owner" ON shared_documents
  FOR UPDATE USING (shared_by = auth.uid());

-- Policies pour audit_events (lecture seule pour membres projet, admins ont tout)
CREATE POLICY "audit_select_project_members" ON audit_events
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM project_actors
      WHERE project_id = audit_events.project_id
        AND user_id = auth.uid()
    ) OR
    EXISTS (SELECT 1 FROM auth.users WHERE id = auth.uid() AND raw_user_meta_data->>'user_type' IN ('admin', 'super_admin'))
  );

CREATE POLICY "audit_insert_system" ON audit_events
  FOR INSERT WITH CHECK (TRUE); -- Les audits peuvent être créés par le système

-- ===================
-- FONCTIONS UTILITAIRES
-- ===================

-- Fonction pour obtenir les permissions d'un utilisateur sur un projet
CREATE OR REPLACE FUNCTION get_user_project_permissions(p_user_id UUID, p_project_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_permissions JSONB;
BEGIN
  SELECT permissions INTO v_permissions
  FROM project_actors
  WHERE user_id = p_user_id
    AND project_id = p_project_id
    AND status = 'active';

  RETURN COALESCE(v_permissions, '[]'::JSONB);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fonction pour vérifier si un utilisateur a un rôle minimum sur un projet
CREATE OR REPLACE FUNCTION user_has_role_on_project(
  p_user_id UUID,
  p_project_id UUID,
  p_min_roles user_role[]
)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM project_actors
    WHERE user_id = p_user_id
      AND project_id = p_project_id
      AND status = 'active'
      AND role = ANY(p_min_roles)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fonction pour compter les notifications non lues
CREATE OR REPLACE FUNCTION get_unread_notification_count(p_user_id UUID)
RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM actor_notifications
  WHERE recipient_id = p_user_id
    AND read = FALSE
    AND (expires_at IS NULL OR expires_at > NOW());

  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ===================
-- COMMENTAIRES
-- ===================

COMMENT ON TABLE project_actors IS 'Acteurs liés à un projet avec leurs rôles et permissions';
COMMENT ON TABLE project_invitations IS 'Invitations en attente pour rejoindre un projet';
COMMENT ON TABLE actor_notifications IS 'Notifications cross-profile pour les acteurs';
COMMENT ON TABLE shared_documents IS 'Documents partagés entre acteurs d''un projet';
COMMENT ON TABLE audit_events IS 'Journal d''audit des actions sur les projets';

COMMENT ON FUNCTION get_user_project_permissions IS 'Retourne les permissions JSONB d''un utilisateur sur un projet';
COMMENT ON FUNCTION user_has_role_on_project IS 'Vérifie si un utilisateur a un des rôles spécifiés sur un projet';
COMMENT ON FUNCTION get_unread_notification_count IS 'Compte les notifications non lues d''un utilisateur';
