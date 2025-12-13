/**
 * Types pour la messagerie projet
 * Communication entre acteurs d'un projet (1-to-1, équipe, personnalisé)
 */

// === ÉNUMÉRATIONS ===

export type ConversationType = 'direct' | 'project' | 'team' | 'support';
export type MessageType = 'text' | 'file' | 'image' | 'system' | 'milestone' | 'payment' | 'alert';
export type ParticipantRole = 'owner' | 'member' | 'observer' | 'support';
export type MessageStatus = 'sending' | 'sent' | 'delivered' | 'read' | 'failed';

// === CONVERSATIONS ===

export interface Conversation {
  id: string;

  // Type et contexte
  type: ConversationType;
  projectId?: string;
  contractId?: string;

  // Métadonnées
  titre?: string;
  description?: string;
  avatar?: string;

  // Participants
  participants: ConversationParticipant[];

  // Dernier message (pour liste)
  lastMessage?: MessagePreview;
  unreadCount: number;

  // Configuration
  settings: ConversationSettings;

  // Statut
  isArchived: boolean;
  isPinned: boolean;
  isMuted: boolean;

  // Dates
  createdAt: Date;
  updatedAt: Date;
}

export interface ConversationParticipant {
  userId: string;
  role: ParticipantRole;
  joinedAt: Date;
  lastReadAt?: Date;
  lastReadMessageId?: string;

  // Profil (pour affichage)
  displayName?: string;
  avatar?: string;
  userType?: 'B2C' | 'B2B' | 'B2G' | 'admin';

  // Notifications
  notificationsEnabled: boolean;
  mutedUntil?: Date;
}

export interface ConversationSettings {
  // Permissions
  allowFiles: boolean;
  allowImages: boolean;
  maxFileSize: number; // Mo

  // Notifications
  notifyOnNewMessage: boolean;
  notifyOnMention: boolean;

  // Modération
  requireApproval: boolean;
  autoDeleteAfterDays?: number;
}

export interface MessagePreview {
  id: string;
  senderId: string;
  senderName: string;
  content: string;
  type: MessageType;
  createdAt: Date;
}

// === MESSAGES ===

export interface Message {
  id: string;
  conversationId: string;

  // Expéditeur
  senderId: string;
  senderName?: string;
  senderAvatar?: string;
  senderType?: 'user' | 'system' | 'bot';

  // Contenu
  type: MessageType;
  content: string;
  contentHtml?: string; // Pour markdown rendu

  // Pièces jointes
  attachments?: MessageAttachment[];

  // Références
  replyToId?: string;
  replyTo?: MessagePreview;

  // Mentions
  mentions?: MessageMention[];

  // Métadonnées spécifiques au type
  metadata?: MessageMetadata;

  // Réactions
  reactions?: MessageReaction[];

  // Statut
  status: MessageStatus;
  editedAt?: Date;
  deletedAt?: Date;

  // Lecture
  readBy?: { userId: string; readAt: Date }[];

  // Dates
  createdAt: Date;
  updatedAt: Date;
}

export interface MessageAttachment {
  id: string;
  type: 'file' | 'image' | 'document' | 'audio' | 'video';
  name: string;
  url: string;
  size: number;
  mimeType: string;

  // Pour images
  thumbnail?: string;
  dimensions?: { width: number; height: number };

  // Pour documents
  pageCount?: number;
}

export interface MessageMention {
  userId: string;
  displayName: string;
  startIndex: number;
  endIndex: number;
}

export interface MessageReaction {
  emoji: string;
  users: { userId: string; reactedAt: Date }[];
  count: number;
}

// Métadonnées spécifiques selon le type de message
export interface MessageMetadata {
  // Pour messages système
  systemAction?: 'user_joined' | 'user_left' | 'conversation_created' | 'settings_changed';

  // Pour messages liés aux jalons
  milestoneId?: string;
  milestoneAction?: 'submitted' | 'validated' | 'rejected' | 'payment_created';

  // Pour messages liés aux paiements
  paymentId?: string;
  paymentAction?: 'created' | 'confirmed' | 'released' | 'refunded' | 'disputed';
  paymentAmount?: number;

  // Pour alertes
  alertLevel?: 'info' | 'warning' | 'error' | 'success';
  actionUrl?: string;
  actionLabel?: string;
}

// === ENTRÉES/SORTIES ===

export interface SendMessageInput {
  conversationId: string;
  type?: MessageType;
  content: string;
  attachments?: File[];
  replyToId?: string;
  mentions?: string[]; // userIds
  metadata?: MessageMetadata;
}

export interface CreateConversationInput {
  type: ConversationType;
  projectId?: string;
  contractId?: string;
  titre?: string;
  participantIds: string[];
  initialMessage?: string;
}

export interface ConversationListFilters {
  type?: ConversationType;
  projectId?: string;
  isArchived?: boolean;
  search?: string;
}

// === TEMPS RÉEL ===

export interface TypingIndicator {
  conversationId: string;
  userId: string;
  userName: string;
  isTyping: boolean;
  timestamp: Date;
}

export interface PresenceStatus {
  userId: string;
  status: 'online' | 'away' | 'busy' | 'offline';
  lastSeen?: Date;
  statusMessage?: string;
}

// === NOTIFICATIONS ===

export interface MessageNotification {
  id: string;
  type: 'new_message' | 'mention' | 'reaction' | 'reply';
  conversationId: string;
  messageId: string;
  senderId: string;
  senderName: string;
  preview: string;
  createdAt: Date;
  read: boolean;
}

// === STATISTIQUES ===

export interface ConversationStats {
  totalMessages: number;
  totalParticipants: number;
  activeParticipants: number; // Dernières 24h
  messagesLast7Days: number;
  averageResponseTime: number; // Minutes
}

export interface UserMessagingStats {
  totalConversations: number;
  unreadMessages: number;
  sentMessages: number;
  receivedMessages: number;
}
