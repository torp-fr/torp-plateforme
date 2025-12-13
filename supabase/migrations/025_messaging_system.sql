-- =====================================================
-- Migration 025: Système de Messagerie Projet
-- Communication en temps réel entre participants
-- =====================================================

-- Types ENUM pour la messagerie
DO $$ BEGIN
  CREATE TYPE conversation_type AS ENUM (
    'project',           -- Conversation liée à un projet
    'direct',            -- Message direct entre 2 utilisateurs
    'group',             -- Groupe de discussion
    'support',           -- Support TORP
    'milestone',         -- Discussion autour d'un jalon
    'dispute'            -- Discussion de litige
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE message_type AS ENUM (
    'text',              -- Message texte
    'file',              -- Fichier joint
    'image',             -- Image
    'system',            -- Message système
    'milestone_update',  -- Mise à jour de jalon
    'payment_request',   -- Demande de paiement
    'document_share',    -- Partage de document
    'quote_share',       -- Partage de devis
    'voice_note'         -- Note vocale
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE participant_role AS ENUM (
    'owner',             -- Créateur/propriétaire
    'admin',             -- Administrateur
    'member',            -- Membre standard
    'observer',          -- Observateur (lecture seule)
    'guest'              -- Invité temporaire
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- =====================================================
-- Table: conversations
-- Conversations du système de messagerie
-- =====================================================
CREATE TABLE IF NOT EXISTS conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Type et contexte
  type conversation_type NOT NULL DEFAULT 'project',
  title VARCHAR(255),
  description TEXT,
  avatar_url TEXT,

  -- Liens avec les entités
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  milestone_id UUID REFERENCES payment_milestones(id) ON DELETE SET NULL,
  dispute_id UUID REFERENCES disputes(id) ON DELETE SET NULL,

  -- Paramètres
  is_archived BOOLEAN DEFAULT FALSE,
  is_muted BOOLEAN DEFAULT FALSE,
  allow_reactions BOOLEAN DEFAULT TRUE,
  allow_threads BOOLEAN DEFAULT TRUE,
  auto_translate BOOLEAN DEFAULT FALSE,

  -- Métadonnées
  settings JSONB DEFAULT '{}',
  metadata JSONB DEFAULT '{}',

  -- Statistiques
  message_count INTEGER DEFAULT 0,
  last_message_at TIMESTAMPTZ,
  last_message_preview TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

-- =====================================================
-- Table: conversation_participants
-- Participants aux conversations
-- =====================================================
CREATE TABLE IF NOT EXISTS conversation_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Rôle et permissions
  role participant_role NOT NULL DEFAULT 'member',
  can_send_messages BOOLEAN DEFAULT TRUE,
  can_add_participants BOOLEAN DEFAULT FALSE,
  can_remove_participants BOOLEAN DEFAULT FALSE,
  can_edit_conversation BOOLEAN DEFAULT FALSE,

  -- État de lecture
  last_read_at TIMESTAMPTZ,
  last_read_message_id UUID,
  unread_count INTEGER DEFAULT 0,

  -- Notifications
  notifications_enabled BOOLEAN DEFAULT TRUE,
  notification_sound BOOLEAN DEFAULT TRUE,
  mention_only BOOLEAN DEFAULT FALSE,

  -- État
  is_muted BOOLEAN DEFAULT FALSE,
  muted_until TIMESTAMPTZ,
  is_pinned BOOLEAN DEFAULT FALSE,
  is_hidden BOOLEAN DEFAULT FALSE,

  -- Métadonnées
  nickname VARCHAR(100),
  custom_color VARCHAR(7),

  -- Timestamps
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  left_at TIMESTAMPTZ,
  invited_by UUID REFERENCES auth.users(id),

  -- Contrainte d'unicité
  UNIQUE(conversation_id, user_id)
);

-- =====================================================
-- Table: messages
-- Messages du système de messagerie
-- =====================================================
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  -- Contenu
  type message_type NOT NULL DEFAULT 'text',
  content TEXT NOT NULL,
  content_html TEXT,

  -- Thread (réponses)
  parent_message_id UUID REFERENCES messages(id) ON DELETE SET NULL,
  thread_count INTEGER DEFAULT 0,

  -- Fichiers et médias
  attachments JSONB DEFAULT '[]',
  -- Structure: [{ id, name, url, type, size, thumbnail_url }]

  -- Mentions
  mentions JSONB DEFAULT '[]',
  -- Structure: [{ user_id, display_name, start_index, end_index }]

  -- Réactions
  reactions JSONB DEFAULT '{}',
  -- Structure: { "👍": ["user_id1", "user_id2"], "❤️": ["user_id3"] }

  -- Métadonnées
  metadata JSONB DEFAULT '{}',
  -- Peut contenir: quote_id, milestone_id, payment_id, document_id, etc.

  -- État
  is_edited BOOLEAN DEFAULT FALSE,
  edited_at TIMESTAMPTZ,
  is_deleted BOOLEAN DEFAULT FALSE,
  deleted_at TIMESTAMPTZ,
  deleted_by UUID REFERENCES auth.users(id),

  -- Livraison
  is_system_message BOOLEAN DEFAULT FALSE,
  priority VARCHAR(20) DEFAULT 'normal',
  expires_at TIMESTAMPTZ,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- Table: message_reads
-- Suivi de lecture des messages
-- =====================================================
CREATE TABLE IF NOT EXISTS message_reads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  read_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(message_id, user_id)
);

-- =====================================================
-- Table: typing_indicators
-- Indicateurs de frappe en temps réel
-- =====================================================
CREATE TABLE IF NOT EXISTS typing_indicators (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  started_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '5 seconds',

  UNIQUE(conversation_id, user_id)
);

-- =====================================================
-- Table: user_presence
-- Présence des utilisateurs
-- =====================================================
CREATE TABLE IF NOT EXISTS user_presence (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,

  status VARCHAR(20) DEFAULT 'offline',
  -- online, offline, away, busy, invisible

  status_message TEXT,
  last_seen_at TIMESTAMPTZ DEFAULT NOW(),
  current_conversation_id UUID REFERENCES conversations(id) ON DELETE SET NULL,

  -- Appareil
  device_type VARCHAR(50),
  app_version VARCHAR(20),

  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- Table: message_drafts
-- Brouillons de messages
-- =====================================================
CREATE TABLE IF NOT EXISTS message_drafts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  content TEXT,
  attachments JSONB DEFAULT '[]',
  reply_to_message_id UUID REFERENCES messages(id) ON DELETE SET NULL,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(conversation_id, user_id)
);

-- =====================================================
-- Table: notification_preferences
-- Préférences de notification par conversation
-- =====================================================
CREATE TABLE IF NOT EXISTS notification_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,

  -- Canaux
  push_enabled BOOLEAN DEFAULT TRUE,
  email_enabled BOOLEAN DEFAULT FALSE,
  sms_enabled BOOLEAN DEFAULT FALSE,

  -- Filtres
  all_messages BOOLEAN DEFAULT TRUE,
  mentions_only BOOLEAN DEFAULT FALSE,
  keywords JSONB DEFAULT '[]',

  -- Horaires silencieux
  quiet_hours_enabled BOOLEAN DEFAULT FALSE,
  quiet_hours_start TIME,
  quiet_hours_end TIME,
  quiet_hours_timezone VARCHAR(50) DEFAULT 'Europe/Paris',

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id, conversation_id)
);

-- =====================================================
-- Index pour les performances
-- =====================================================

-- Conversations
CREATE INDEX IF NOT EXISTS idx_conversations_project ON conversations(project_id);
CREATE INDEX IF NOT EXISTS idx_conversations_type ON conversations(type);
CREATE INDEX IF NOT EXISTS idx_conversations_created_by ON conversations(created_by);
CREATE INDEX IF NOT EXISTS idx_conversations_last_message ON conversations(last_message_at DESC);

-- Participants
CREATE INDEX IF NOT EXISTS idx_participants_user ON conversation_participants(user_id);
CREATE INDEX IF NOT EXISTS idx_participants_conversation ON conversation_participants(conversation_id);
CREATE INDEX IF NOT EXISTS idx_participants_unread ON conversation_participants(user_id, unread_count)
  WHERE unread_count > 0;

-- Messages
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_created ON messages(conversation_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_parent ON messages(parent_message_id) WHERE parent_message_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_messages_type ON messages(type);

-- Lecture des messages
CREATE INDEX IF NOT EXISTS idx_message_reads_user ON message_reads(user_id);
CREATE INDEX IF NOT EXISTS idx_message_reads_message ON message_reads(message_id);

-- Présence
CREATE INDEX IF NOT EXISTS idx_presence_status ON user_presence(status) WHERE status = 'online';

-- Recherche full-text sur les messages
CREATE INDEX IF NOT EXISTS idx_messages_content_search ON messages
  USING GIN(to_tsvector('french', content));

-- =====================================================
-- Fonctions et Triggers
-- =====================================================

-- Fonction pour mettre à jour le compteur de messages
CREATE OR REPLACE FUNCTION update_conversation_message_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE conversations
    SET
      message_count = message_count + 1,
      last_message_at = NEW.created_at,
      last_message_preview = LEFT(NEW.content, 100),
      updated_at = NOW()
    WHERE id = NEW.conversation_id;

    -- Mettre à jour le compteur de non-lus pour les autres participants
    UPDATE conversation_participants
    SET unread_count = unread_count + 1
    WHERE conversation_id = NEW.conversation_id
      AND user_id != NEW.sender_id
      AND notifications_enabled = TRUE;

  ELSIF TG_OP = 'DELETE' THEN
    UPDATE conversations
    SET
      message_count = GREATEST(message_count - 1, 0),
      updated_at = NOW()
    WHERE id = OLD.conversation_id;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Trigger pour les compteurs de messages
DROP TRIGGER IF EXISTS trg_message_count ON messages;
CREATE TRIGGER trg_message_count
  AFTER INSERT OR DELETE ON messages
  FOR EACH ROW
  EXECUTE FUNCTION update_conversation_message_count();

-- Fonction pour mettre à jour le compteur de threads
CREATE OR REPLACE FUNCTION update_thread_count()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.parent_message_id IS NOT NULL THEN
    UPDATE messages
    SET thread_count = thread_count + 1
    WHERE id = NEW.parent_message_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger pour les compteurs de threads
DROP TRIGGER IF EXISTS trg_thread_count ON messages;
CREATE TRIGGER trg_thread_count
  AFTER INSERT ON messages
  FOR EACH ROW
  WHEN (NEW.parent_message_id IS NOT NULL)
  EXECUTE FUNCTION update_thread_count();

-- Fonction pour nettoyer les indicateurs de frappe expirés
CREATE OR REPLACE FUNCTION cleanup_expired_typing_indicators()
RETURNS void AS $$
BEGIN
  DELETE FROM typing_indicators WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- Fonction pour créer une conversation projet automatiquement
CREATE OR REPLACE FUNCTION create_project_conversation()
RETURNS TRIGGER AS $$
DECLARE
  conv_id UUID;
BEGIN
  -- Créer une conversation pour le nouveau projet
  INSERT INTO conversations (
    type,
    title,
    description,
    project_id,
    created_by
  ) VALUES (
    'project',
    NEW.title,
    'Conversation du projet ' || NEW.title,
    NEW.id,
    NEW.user_id
  ) RETURNING id INTO conv_id;

  -- Ajouter le créateur comme propriétaire
  INSERT INTO conversation_participants (
    conversation_id,
    user_id,
    role,
    can_add_participants,
    can_remove_participants,
    can_edit_conversation
  ) VALUES (
    conv_id,
    NEW.user_id,
    'owner',
    TRUE,
    TRUE,
    TRUE
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger pour créer automatiquement une conversation à la création d'un projet
DROP TRIGGER IF EXISTS trg_create_project_conversation ON projects;
CREATE TRIGGER trg_create_project_conversation
  AFTER INSERT ON projects
  FOR EACH ROW
  EXECUTE FUNCTION create_project_conversation();

-- =====================================================
-- Row Level Security (RLS)
-- =====================================================

-- Activer RLS sur toutes les tables
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_reads ENABLE ROW LEVEL SECURITY;
ALTER TABLE typing_indicators ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_presence ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_drafts ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;

-- Policies pour conversations
DROP POLICY IF EXISTS conversations_select_policy ON conversations;
CREATE POLICY conversations_select_policy ON conversations
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM conversation_participants
      WHERE conversation_id = id
        AND user_id = auth.uid()
        AND left_at IS NULL
    )
  );

DROP POLICY IF EXISTS conversations_insert_policy ON conversations;
CREATE POLICY conversations_insert_policy ON conversations
  FOR INSERT WITH CHECK (created_by = auth.uid());

DROP POLICY IF EXISTS conversations_update_policy ON conversations;
CREATE POLICY conversations_update_policy ON conversations
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM conversation_participants
      WHERE conversation_id = id
        AND user_id = auth.uid()
        AND role IN ('owner', 'admin')
    )
  );

-- Policies pour participants
DROP POLICY IF EXISTS participants_select_policy ON conversation_participants;
CREATE POLICY participants_select_policy ON conversation_participants
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM conversation_participants cp
      WHERE cp.conversation_id = conversation_id
        AND cp.user_id = auth.uid()
        AND cp.left_at IS NULL
    )
  );

DROP POLICY IF EXISTS participants_insert_policy ON conversation_participants;
CREATE POLICY participants_insert_policy ON conversation_participants
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM conversation_participants
      WHERE conversation_id = conversation_participants.conversation_id
        AND user_id = auth.uid()
        AND can_add_participants = TRUE
    )
    OR user_id = auth.uid()
  );

DROP POLICY IF EXISTS participants_update_policy ON conversation_participants;
CREATE POLICY participants_update_policy ON conversation_participants
  FOR UPDATE USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM conversation_participants
      WHERE conversation_id = conversation_participants.conversation_id
        AND user_id = auth.uid()
        AND role IN ('owner', 'admin')
    )
  );

-- Policies pour messages
DROP POLICY IF EXISTS messages_select_policy ON messages;
CREATE POLICY messages_select_policy ON messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM conversation_participants
      WHERE conversation_id = messages.conversation_id
        AND user_id = auth.uid()
        AND left_at IS NULL
    )
  );

DROP POLICY IF EXISTS messages_insert_policy ON messages;
CREATE POLICY messages_insert_policy ON messages
  FOR INSERT WITH CHECK (
    sender_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM conversation_participants
      WHERE conversation_id = messages.conversation_id
        AND user_id = auth.uid()
        AND can_send_messages = TRUE
        AND left_at IS NULL
    )
  );

DROP POLICY IF EXISTS messages_update_policy ON messages;
CREATE POLICY messages_update_policy ON messages
  FOR UPDATE USING (
    sender_id = auth.uid()
    AND is_deleted = FALSE
  );

DROP POLICY IF EXISTS messages_delete_policy ON messages;
CREATE POLICY messages_delete_policy ON messages
  FOR DELETE USING (
    sender_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM conversation_participants
      WHERE conversation_id = messages.conversation_id
        AND user_id = auth.uid()
        AND role IN ('owner', 'admin')
    )
  );

-- Policies pour message_reads
DROP POLICY IF EXISTS message_reads_select_policy ON message_reads;
CREATE POLICY message_reads_select_policy ON message_reads
  FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS message_reads_insert_policy ON message_reads;
CREATE POLICY message_reads_insert_policy ON message_reads
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- Policies pour typing_indicators
DROP POLICY IF EXISTS typing_select_policy ON typing_indicators;
CREATE POLICY typing_select_policy ON typing_indicators
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM conversation_participants
      WHERE conversation_id = typing_indicators.conversation_id
        AND user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS typing_insert_policy ON typing_indicators;
CREATE POLICY typing_insert_policy ON typing_indicators
  FOR INSERT WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS typing_delete_policy ON typing_indicators;
CREATE POLICY typing_delete_policy ON typing_indicators
  FOR DELETE USING (user_id = auth.uid());

-- Policies pour user_presence
DROP POLICY IF EXISTS presence_select_policy ON user_presence;
CREATE POLICY presence_select_policy ON user_presence
  FOR SELECT USING (TRUE);

DROP POLICY IF EXISTS presence_insert_policy ON user_presence;
CREATE POLICY presence_insert_policy ON user_presence
  FOR INSERT WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS presence_update_policy ON user_presence;
CREATE POLICY presence_update_policy ON user_presence
  FOR UPDATE USING (user_id = auth.uid());

-- Policies pour message_drafts
DROP POLICY IF EXISTS drafts_all_policy ON message_drafts;
CREATE POLICY drafts_all_policy ON message_drafts
  FOR ALL USING (user_id = auth.uid());

-- Policies pour notification_preferences
DROP POLICY IF EXISTS notif_prefs_all_policy ON notification_preferences;
CREATE POLICY notif_prefs_all_policy ON notification_preferences
  FOR ALL USING (user_id = auth.uid());

-- =====================================================
-- Activation Realtime pour les tables critiques
-- =====================================================

-- Activer la publication pour Supabase Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE messages;
ALTER PUBLICATION supabase_realtime ADD TABLE typing_indicators;
ALTER PUBLICATION supabase_realtime ADD TABLE user_presence;
ALTER PUBLICATION supabase_realtime ADD TABLE conversation_participants;

-- =====================================================
-- Données initiales
-- =====================================================

-- Créer des préférences de notification par défaut pour les utilisateurs existants
INSERT INTO notification_preferences (user_id)
SELECT id FROM auth.users
WHERE NOT EXISTS (
  SELECT 1 FROM notification_preferences WHERE user_id = auth.users.id AND conversation_id IS NULL
)
ON CONFLICT DO NOTHING;

-- =====================================================
-- Commentaires de documentation
-- =====================================================

COMMENT ON TABLE conversations IS 'Conversations du système de messagerie projet';
COMMENT ON TABLE conversation_participants IS 'Participants aux conversations avec leurs rôles et permissions';
COMMENT ON TABLE messages IS 'Messages avec support des threads, réactions et pièces jointes';
COMMENT ON TABLE message_reads IS 'Suivi de lecture des messages pour les confirmations de lecture';
COMMENT ON TABLE typing_indicators IS 'Indicateurs de frappe en temps réel (TTL: 5 secondes)';
COMMENT ON TABLE user_presence IS 'État de présence des utilisateurs (online/offline/away)';
COMMENT ON TABLE message_drafts IS 'Brouillons de messages sauvegardés automatiquement';
COMMENT ON TABLE notification_preferences IS 'Préférences de notification par utilisateur et conversation';
