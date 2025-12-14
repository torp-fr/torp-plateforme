/**
 * Types pour l'architecture multi-profil
 * Configuration, features, labels et permissions par type d'utilisateur
 */

// === TYPES UTILISATEUR ===

export type UserType = 'B2C' | 'B2B' | 'B2G' | 'admin' | 'super_admin';

export type UserRole =
  | 'owner'           // Propriétaire du projet/ressource
  | 'client'          // Client (B2C ou B2G)
  | 'entreprise'      // Entreprise prestataire
  | 'collaborator'    // Collaborateur dans l'équipe
  | 'viewer'          // Lecteur seul
  | 'admin'           // Administrateur TORP
  | 'mediator';       // Médiateur litiges

// === CONFIGURATION PROFIL ===

export interface ProfileConfig {
  userType: UserType;

  // Identité
  displayName: string;
  description: string;
  icon: string;
  color: string;

  // Features activées
  features: ProfileFeatures;

  // Labels contextuels
  labels: ProfileLabels;

  // Dashboard
  dashboard: DashboardConfig;

  // Wizard
  wizardMode: WizardMode;

  // Navigation
  navigation: NavigationConfig;

  // Limites
  limits: ProfileLimits;
}

export interface ProfileFeatures {
  // Phase 0
  canCreateProject: boolean;
  canUseWizard: boolean;
  canGenerateCCTP: boolean;
  canExportDocuments: boolean;

  // Phase 1
  canPublishTender: boolean;
  canRespondToTender: boolean;
  canCompareOffers: boolean;
  canGenerateContract: boolean;

  // Phase 2
  canManageMilestones: boolean;
  canValidateMilestones: boolean;
  canMakePayments: boolean;
  canReceivePayments: boolean;
  canOpenDispute: boolean;
  canMediateDispute: boolean;

  // Messaging
  canCreateConversation: boolean;
  canSendMessages: boolean;
  canSendFiles: boolean;

  // B2B Specific
  canUseTORPScore: boolean;
  canTransmitProposal: boolean;
  canManageTeam: boolean;
  canAccessAnalytics: boolean;

  // B2G Specific
  canCreatePublicTender: boolean;
  canManagePublicMarket: boolean;

  // Admin
  canAccessAdminPanel: boolean;
  canManageUsers: boolean;
  canManageFraudRules: boolean;
  canViewAllProjects: boolean;
}

export interface ProfileLabels {
  // Entité
  entityName: string;           // "Votre bien" / "Votre entreprise" / "Votre collectivité"
  entityNamePlural: string;     // "Vos biens" / "Vos projets" / "Vos opérations"

  // Projet
  projectName: string;          // "Projet" / "Affaire" / "Opération"
  projectNamePlural: string;    // "Projets" / "Affaires" / "Opérations"

  // Autre partie
  counterpartName: string;      // "Entreprise" / "Client" / "Prestataire"
  counterpartNamePlural: string;

  // Actions
  createProjectLabel: string;   // "Créer mon projet" / "Nouvelle affaire" / "Nouvelle opération"
  analyzeLabel: string;         // "Analyser un devis" / "Analyser une offre" / "Évaluer une proposition"

  // Budget
  budgetLabel: string;          // "Budget" / "Montant" / "Enveloppe"
  paymentLabel: string;         // "Paiement" / "Règlement" / "Mandat"

  // Documents
  proposalLabel: string;        // "Devis" / "Proposition commerciale" / "Offre"
  contractLabel: string;        // "Contrat" / "Marché" / "Marché public"

  // Navigation Phase
  consultationLabel: string;    // "Consultation entreprises" / "Diffuser aux clients" / "Lancer la consultation"
  newProjectLabel: string;      // "Nouveau projet" / "Nouvelle affaire" / "Nouvelle opération"

  // Spécifiques
  welcomeMessage: string;
  dashboardTitle: string;
  emptyStateMessage: string;
}

export interface DashboardConfig {
  layout: 'simple' | 'professional' | 'institutional';

  // Widgets affichés
  widgets: DashboardWidget[];

  // Stats affichées
  statsToShow: string[];

  // Actions rapides
  quickActions: QuickAction[];
}

export interface DashboardWidget {
  id: string;
  type: 'projects' | 'analytics' | 'calendar' | 'messages' | 'payments' | 'disputes' | 'team' | 'tenders';
  title: string;
  size: 'small' | 'medium' | 'large' | 'full';
  position: number;
}

export interface QuickAction {
  id: string;
  label: string;
  icon: string;
  route: string;
  primary?: boolean;
}

export type WizardMode = 'b2c_simple' | 'b2c_detailed' | 'b2b_professional' | 'b2g_public';

export interface NavigationConfig {
  // Routes principales
  mainRoutes: NavRoute[];

  // Routes secondaires
  secondaryRoutes: NavRoute[];

  // Route par défaut après login
  defaultRoute: string;

  // Routes cachées
  hiddenRoutes: string[];
}

export interface NavRoute {
  path: string;
  label: string;
  icon: string;
  badge?: string;
  children?: NavRoute[];
}

export interface ProfileLimits {
  // Projets
  maxProjects: number;          // -1 = illimité
  maxProjectsPerMonth: number;

  // Documents
  maxDocumentsPerProject: number;
  maxFileSizeMB: number;

  // Équipe
  maxTeamMembers: number;

  // Stockage
  maxStorageGB: number;
}

// === INTEROPÉRABILITÉ ===

export interface ProjectActor {
  id: string;
  projectId: string;
  userId: string;
  userType: UserType;
  role: UserRole;

  // Profil
  displayName: string;
  email: string;
  phone?: string;
  avatar?: string;

  // Entreprise (si B2B)
  companyName?: string;
  companySiret?: string;

  // Entité (si B2G)
  entityName?: string;
  entityType?: string;

  // Permissions spécifiques au projet
  permissions: ProjectPermission[];

  // Statut
  status: 'invited' | 'active' | 'suspended' | 'removed';
  invitedAt?: Date;
  joinedAt?: Date;
  lastActiveAt?: Date;

  // Métadonnées
  metadata?: Record<string, unknown>;
}

export interface ProjectPermission {
  resource: PermissionResource;
  actions: PermissionAction[];
}

export type PermissionResource =
  | 'project'
  | 'project.details'
  | 'project.documents'
  | 'project.budget'
  | 'milestones'
  | 'payments'
  | 'messages'
  | 'disputes'
  | 'team'
  | 'analytics';

export type PermissionAction = 'view' | 'create' | 'edit' | 'delete' | 'approve' | 'export';

// === ÉVÉNEMENTS CROSS-PROFILE ===

export interface ActorNotification {
  id: string;
  type: NotificationType;

  // Destinataire
  recipientId: string;
  recipientType: UserType;

  // Expéditeur
  senderId?: string;
  senderName?: string;
  senderType?: UserType;

  // Contexte
  projectId?: string;
  projectName?: string;
  resourceId?: string;
  resourceType?: string;

  // Contenu
  title: string;
  message: string;
  data?: Record<string, unknown>;

  // Actions
  actions?: NotificationAction[];

  // Statut
  priority: 'low' | 'normal' | 'high' | 'urgent';
  read: boolean;
  readAt?: Date;

  // Dates
  createdAt: Date;
  expiresAt?: Date;
}

export type NotificationType =
  // Projet
  | 'project_created'
  | 'project_updated'
  | 'project_shared'
  | 'actor_invited'
  | 'actor_joined'

  // Phase 1
  | 'tender_published'
  | 'tender_response_received'
  | 'offer_accepted'
  | 'contract_generated'

  // Phase 2
  | 'milestone_submitted'
  | 'milestone_validated'
  | 'milestone_rejected'
  | 'payment_requested'
  | 'payment_received'
  | 'payment_released'

  // Litiges
  | 'dispute_opened'
  | 'dispute_response_required'
  | 'dispute_resolved'

  // Messages
  | 'new_message'
  | 'mention'

  // Système
  | 'system_alert'
  | 'fraud_alert';

export interface NotificationAction {
  id: string;
  label: string;
  type: 'primary' | 'secondary' | 'danger';
  route?: string;
  action?: string;
}

// === DOCUMENTS PARTAGÉS ===

export interface SharedDocument {
  id: string;
  projectId: string;

  // Document
  documentType: SharedDocumentType;
  name: string;
  description?: string;
  fileUrl: string;
  fileSize: number;
  mimeType: string;

  // Partage
  sharedBy: string;
  sharedByName: string;
  sharedWith: string[];  // userIds
  visibleToRoles: UserRole[];

  // Permissions
  allowDownload: boolean;
  allowComment: boolean;
  requiresSignature: boolean;

  // Signatures
  signatures?: DocumentSignature[];

  // Statut
  status: 'draft' | 'shared' | 'signed' | 'archived';

  // Dates
  createdAt: Date;
  updatedAt: Date;
  expiresAt?: Date;
}

export type SharedDocumentType =
  | 'cctp'
  | 'dpgf'
  | 'devis'
  | 'proposal'
  | 'contract'
  | 'avenant'
  | 'pv_reception'
  | 'facture'
  | 'attestation'
  | 'photo_chantier'
  | 'other';

export interface DocumentSignature {
  userId: string;
  userName: string;
  userType: UserType;
  signedAt: Date;
  signatureData: string;
  ipAddress?: string;
}

// === AUDIT TRAIL ===

export interface AuditEvent {
  id: string;

  // Acteur
  actorId: string;
  actorType: UserType;
  actorName: string;

  // Action
  action: string;
  resource: string;
  resourceId: string;

  // Contexte
  projectId?: string;

  // Détails
  details: Record<string, unknown>;
  previousValue?: unknown;
  newValue?: unknown;

  // Métadonnées
  ipAddress?: string;
  userAgent?: string;

  // Date
  createdAt: Date;
}

// === CONFIGURATION CROSS-PROFILE ===

export interface CrossProfileConfig {
  // Flux autorisés
  allowedFlows: ProfileFlow[];

  // Règles de notification
  notificationRules: NotificationRule[];

  // Documents partagés par défaut
  defaultSharedDocuments: SharedDocumentType[];
}

export interface ProfileFlow {
  from: UserType;
  to: UserType;
  flowType: string;
  description: string;
  autoCreateConversation: boolean;
}

export interface NotificationRule {
  event: NotificationType;
  notifyRoles: UserRole[];
  priority: 'low' | 'normal' | 'high' | 'urgent';
  channels: ('app' | 'email' | 'sms' | 'push')[];
}
