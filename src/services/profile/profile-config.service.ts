/**
 * ProfileConfigService - Configuration par profil utilisateur
 * Gestion des features, labels, dashboard et navigation selon B2C/B2B/B2G
 */

import { supabase } from '@/lib/supabase';
import {
  UserType,
  ProfileConfig,
  ProfileFeatures,
  ProfileLabels,
  DashboardConfig,
  DashboardWidget,
  QuickAction,
  WizardMode,
  NavigationConfig,
  NavRoute,
  ProfileLimits,
} from '@/types/profile.types';

// =============================================================================
// CONFIGURATIONS PAR PROFIL
// =============================================================================

const B2C_CONFIG: ProfileConfig = {
  userType: 'B2C',
  displayName: 'Particulier',
  description: 'Propriétaire ou locataire souhaitant réaliser des travaux',
  icon: 'user',
  color: '#3B82F6', // Blue

  features: {
    // Phase 0
    canCreateProject: true,
    canUseWizard: true,
    canGenerateCCTP: true,
    canExportDocuments: true,

    // Phase 1
    canPublishTender: true,
    canRespondToTender: false,
    canCompareOffers: true,
    canGenerateContract: true,

    // Phase 2
    canManageMilestones: false,
    canValidateMilestones: true,
    canMakePayments: true,
    canReceivePayments: false,
    canOpenDispute: true,
    canMediateDispute: false,

    // Messaging
    canCreateConversation: true,
    canSendMessages: true,
    canSendFiles: true,

    // B2B Specific
    canUseTORPScore: false,
    canTransmitProposal: false,
    canManageTeam: false,
    canAccessAnalytics: false,

    // B2G Specific
    canCreatePublicTender: false,
    canManagePublicMarket: false,

    // Admin
    canAccessAdminPanel: false,
    canManageUsers: false,
    canManageFraudRules: false,
    canViewAllProjects: false,
  },

  labels: {
    entityName: 'Votre bien',
    entityNamePlural: 'Vos biens',
    projectName: 'Projet',
    projectNamePlural: 'Projets',
    counterpartName: 'Entreprise',
    counterpartNamePlural: 'Entreprises',
    createProjectLabel: 'Créer mon projet',
    analyzeLabel: 'Analyser un devis',
    budgetLabel: 'Budget',
    paymentLabel: 'Paiement',
    proposalLabel: 'Devis',
    contractLabel: 'Contrat',
    consultationLabel: 'Consultation entreprises',
    newProjectLabel: 'Nouveau projet',
    welcomeMessage: 'Bienvenue sur TORP, votre assistant travaux',
    dashboardTitle: 'Mon tableau de bord',
    emptyStateMessage: 'Vous n\'avez pas encore de projet. Commencez par définir votre projet de travaux.',
  },

  dashboard: {
    layout: 'simple',
    widgets: [
      { id: 'projects', type: 'projects', title: 'Mes projets', size: 'large', position: 1 },
      { id: 'messages', type: 'messages', title: 'Messages', size: 'medium', position: 2 },
      { id: 'payments', type: 'payments', title: 'Paiements', size: 'medium', position: 3 },
    ],
    statsToShow: ['projects_count', 'pending_validations', 'total_spent'],
    quickActions: [
      { id: 'new_project', label: 'Nouveau projet', icon: 'plus', route: '/phase0/new', primary: true },
      { id: 'analyze', label: 'Analyser un devis', icon: 'search', route: '/analyze' },
      { id: 'messages', label: 'Messagerie', icon: 'message-circle', route: '/messages' },
    ],
  },

  wizardMode: 'b2c_simple',

  navigation: {
    mainRoutes: [
      { path: '/dashboard', label: 'Tableau de bord', icon: 'home' },
      { path: '/phase0/dashboard', label: 'Mes projets', icon: 'folder' },
      { path: '/analyze', label: 'Analyser', icon: 'search' },
      { path: '/messages', label: 'Messages', icon: 'message-circle' },
    ],
    secondaryRoutes: [
      { path: '/profile', label: 'Mon profil', icon: 'user' },
      { path: '/help', label: 'Aide', icon: 'help-circle' },
    ],
    defaultRoute: '/dashboard',
    hiddenRoutes: ['/pro', '/admin', '/b2b/ao'],
  },

  limits: {
    maxProjects: 10,
    maxProjectsPerMonth: 3,
    maxDocumentsPerProject: 50,
    maxFileSizeMB: 25,
    maxTeamMembers: 1,
    maxStorageGB: 5,
  },
};

const B2B_CONFIG: ProfileConfig = {
  userType: 'B2B',
  displayName: 'Professionnel',
  description: 'Entreprise du bâtiment ou bureau d\'études',
  icon: 'briefcase',
  color: '#10B981', // Green

  features: {
    // Phase 0
    canCreateProject: true,
    canUseWizard: true,
    canGenerateCCTP: true,
    canExportDocuments: true,

    // Phase 1
    canPublishTender: false,
    canRespondToTender: true,
    canCompareOffers: true,
    canGenerateContract: true,

    // Phase 2
    canManageMilestones: true,
    canValidateMilestones: false,
    canMakePayments: false,
    canReceivePayments: true,
    canOpenDispute: true,
    canMediateDispute: false,

    // Messaging
    canCreateConversation: true,
    canSendMessages: true,
    canSendFiles: true,

    // B2B Specific
    canUseTORPScore: true,
    canTransmitProposal: true,
    canManageTeam: true,
    canAccessAnalytics: true,

    // B2G Specific
    canCreatePublicTender: false,
    canManagePublicMarket: false,

    // Admin
    canAccessAdminPanel: false,
    canManageUsers: false,
    canManageFraudRules: false,
    canViewAllProjects: false,
  },

  labels: {
    entityName: 'Votre entreprise',
    entityNamePlural: 'Vos entreprises',
    projectName: 'Affaire',
    projectNamePlural: 'Affaires',
    counterpartName: 'Client',
    counterpartNamePlural: 'Clients',
    createProjectLabel: 'Nouvelle affaire',
    analyzeLabel: 'Analyser une offre',
    budgetLabel: 'Montant',
    paymentLabel: 'Règlement',
    proposalLabel: 'Proposition commerciale',
    contractLabel: 'Contrat',
    consultationLabel: 'Diffuser aux clients',
    newProjectLabel: 'Nouvelle affaire',
    welcomeMessage: 'Bienvenue sur TORP Pro, votre outil de gestion commerciale',
    dashboardTitle: 'Tableau de bord professionnel',
    emptyStateMessage: 'Aucune affaire en cours. Répondez à des appels d\'offres ou créez une proposition.',
  },

  dashboard: {
    layout: 'professional',
    widgets: [
      { id: 'projects', type: 'projects', title: 'Affaires en cours', size: 'large', position: 1 },
      { id: 'tenders', type: 'tenders', title: 'Appels d\'offres', size: 'medium', position: 2 },
      { id: 'analytics', type: 'analytics', title: 'Performance', size: 'medium', position: 3 },
      { id: 'messages', type: 'messages', title: 'Messages clients', size: 'medium', position: 4 },
      { id: 'payments', type: 'payments', title: 'Encaissements', size: 'medium', position: 5 },
      { id: 'team', type: 'team', title: 'Équipe', size: 'small', position: 6 },
    ],
    statsToShow: ['active_projects', 'pending_responses', 'monthly_revenue', 'conversion_rate'],
    quickActions: [
      { id: 'new_proposal', label: 'Nouvelle proposition', icon: 'file-plus', route: '/pro/projects/new', primary: true },
      { id: 'tenders', label: 'Appels d\'offres', icon: 'inbox', route: '/b2b/ao' },
      { id: 'torp_score', label: 'TORP Score', icon: 'bar-chart', route: '/pro/torp-score' },
      { id: 'analytics', label: 'Statistiques', icon: 'trending-up', route: '/pro/analytics' },
    ],
  },

  wizardMode: 'b2b_professional',

  navigation: {
    mainRoutes: [
      { path: '/pro', label: 'Tableau de bord', icon: 'home' },
      { path: '/pro/projects', label: 'Affaires', icon: 'briefcase' },
      { path: '/b2b/ao', label: 'Appels d\'offres', icon: 'inbox' },
      { path: '/pro/analyses', label: 'Analyses', icon: 'bar-chart-2' },
      { path: '/messages', label: 'Messages', icon: 'message-circle' },
    ],
    secondaryRoutes: [
      { path: '/pro/documents', label: 'Documents', icon: 'folder' },
      { path: '/pro/team', label: 'Équipe', icon: 'users' },
      { path: '/pro/settings', label: 'Paramètres', icon: 'settings' },
    ],
    defaultRoute: '/pro',
    hiddenRoutes: ['/b2c-dashboard', '/admin'],
  },

  limits: {
    maxProjects: -1, // Illimité
    maxProjectsPerMonth: -1,
    maxDocumentsPerProject: 200,
    maxFileSizeMB: 100,
    maxTeamMembers: 10,
    maxStorageGB: 50,
  },
};

const B2G_CONFIG: ProfileConfig = {
  userType: 'B2G',
  displayName: 'Secteur Public',
  description: 'Collectivité territoriale ou établissement public',
  icon: 'building-2',
  color: '#8B5CF6', // Purple

  features: {
    // Phase 0
    canCreateProject: true,
    canUseWizard: true,
    canGenerateCCTP: true,
    canExportDocuments: true,

    // Phase 1
    canPublishTender: true,
    canRespondToTender: false,
    canCompareOffers: true,
    canGenerateContract: true,

    // Phase 2
    canManageMilestones: false,
    canValidateMilestones: true,
    canMakePayments: true,
    canReceivePayments: false,
    canOpenDispute: true,
    canMediateDispute: false,

    // Messaging
    canCreateConversation: true,
    canSendMessages: true,
    canSendFiles: true,

    // B2B Specific
    canUseTORPScore: true, // Pour évaluer les réponses
    canTransmitProposal: false,
    canManageTeam: true,
    canAccessAnalytics: true,

    // B2G Specific
    canCreatePublicTender: true,
    canManagePublicMarket: true,

    // Admin
    canAccessAdminPanel: false,
    canManageUsers: false,
    canManageFraudRules: false,
    canViewAllProjects: false,
  },

  labels: {
    entityName: 'Votre collectivité',
    entityNamePlural: 'Vos établissements',
    projectName: 'Opération',
    projectNamePlural: 'Opérations',
    counterpartName: 'Titulaire',
    counterpartNamePlural: 'Titulaires',
    createProjectLabel: 'Nouvelle opération',
    analyzeLabel: 'Évaluer une offre',
    budgetLabel: 'Enveloppe',
    paymentLabel: 'Mandat',
    proposalLabel: 'Offre',
    contractLabel: 'Marché public',
    consultationLabel: 'Lancer la consultation',
    newProjectLabel: 'Nouvelle opération',
    welcomeMessage: 'Bienvenue sur TORP Collectivités, votre plateforme de gestion des marchés',
    dashboardTitle: 'Tableau de bord collectivité',
    emptyStateMessage: 'Aucune opération en cours. Créez un nouveau marché ou consultez les offres reçues.',
  },

  dashboard: {
    layout: 'institutional',
    widgets: [
      { id: 'projects', type: 'projects', title: 'Opérations en cours', size: 'large', position: 1 },
      { id: 'tenders', type: 'tenders', title: 'Marchés publiés', size: 'large', position: 2 },
      { id: 'calendar', type: 'calendar', title: 'Échéances', size: 'medium', position: 3 },
      { id: 'analytics', type: 'analytics', title: 'Indicateurs', size: 'medium', position: 4 },
      { id: 'payments', type: 'payments', title: 'Mandatements', size: 'medium', position: 5 },
    ],
    statsToShow: ['active_operations', 'open_tenders', 'pending_mandates', 'budget_consumed'],
    quickActions: [
      { id: 'new_operation', label: 'Nouvelle opération', icon: 'plus', route: '/phase0/new', primary: true },
      { id: 'new_tender', label: 'Nouveau marché', icon: 'file-plus', route: '/tenders/new' },
      { id: 'responses', label: 'Offres reçues', icon: 'inbox', route: '/tenders' },
      { id: 'budget', label: 'Suivi budgétaire', icon: 'euro', route: '/budget' },
    ],
  },

  wizardMode: 'b2g_public',

  navigation: {
    mainRoutes: [
      { path: '/dashboard', label: 'Tableau de bord', icon: 'home' },
      { path: '/phase0/dashboard', label: 'Opérations', icon: 'building' },
      { path: '/tenders', label: 'Marchés', icon: 'scale' },
      { path: '/messages', label: 'Échanges', icon: 'message-circle' },
    ],
    secondaryRoutes: [
      { path: '/budget', label: 'Budget', icon: 'euro' },
      { path: '/team', label: 'Service', icon: 'users' },
      { path: '/settings', label: 'Paramètres', icon: 'settings' },
    ],
    defaultRoute: '/dashboard',
    hiddenRoutes: ['/pro', '/admin', '/b2b/ao'],
  },

  limits: {
    maxProjects: -1, // Illimité
    maxProjectsPerMonth: -1,
    maxDocumentsPerProject: 500,
    maxFileSizeMB: 200,
    maxTeamMembers: 50,
    maxStorageGB: 200,
  },
};

const ADMIN_CONFIG: ProfileConfig = {
  userType: 'admin',
  displayName: 'Administrateur',
  description: 'Administrateur plateforme TORP',
  icon: 'shield',
  color: '#EF4444', // Red

  features: {
    // Toutes les features activées
    canCreateProject: true,
    canUseWizard: true,
    canGenerateCCTP: true,
    canExportDocuments: true,
    canPublishTender: true,
    canRespondToTender: true,
    canCompareOffers: true,
    canGenerateContract: true,
    canManageMilestones: true,
    canValidateMilestones: true,
    canMakePayments: true,
    canReceivePayments: true,
    canOpenDispute: true,
    canMediateDispute: true,
    canCreateConversation: true,
    canSendMessages: true,
    canSendFiles: true,
    canUseTORPScore: true,
    canTransmitProposal: true,
    canManageTeam: true,
    canAccessAnalytics: true,
    canCreatePublicTender: true,
    canManagePublicMarket: true,
    canAccessAdminPanel: true,
    canManageUsers: true,
    canManageFraudRules: true,
    canViewAllProjects: true,
  },

  labels: {
    entityName: 'Plateforme',
    entityNamePlural: 'Plateformes',
    projectName: 'Projet',
    projectNamePlural: 'Projets',
    counterpartName: 'Utilisateur',
    counterpartNamePlural: 'Utilisateurs',
    createProjectLabel: 'Créer',
    analyzeLabel: 'Analyser',
    budgetLabel: 'Montant',
    paymentLabel: 'Transaction',
    proposalLabel: 'Document',
    contractLabel: 'Contrat',
    consultationLabel: 'Consulter',
    newProjectLabel: 'Créer',
    welcomeMessage: 'Administration TORP',
    dashboardTitle: 'Administration',
    emptyStateMessage: 'Panel d\'administration',
  },

  dashboard: {
    layout: 'professional',
    widgets: [
      { id: 'analytics', type: 'analytics', title: 'Vue d\'ensemble', size: 'full', position: 1 },
      { id: 'disputes', type: 'disputes', title: 'Litiges en cours', size: 'large', position: 2 },
      { id: 'payments', type: 'payments', title: 'Transactions', size: 'medium', position: 3 },
    ],
    statsToShow: ['total_users', 'active_projects', 'total_transactions', 'open_disputes'],
    quickActions: [
      { id: 'users', label: 'Utilisateurs', icon: 'users', route: '/admin/users', primary: true },
      { id: 'disputes', label: 'Litiges', icon: 'alert-triangle', route: '/admin/disputes' },
      { id: 'fraud', label: 'Anti-fraude', icon: 'shield', route: '/admin/fraud' },
    ],
  },

  wizardMode: 'b2c_simple',

  navigation: {
    mainRoutes: [
      { path: '/admin-dashboard', label: 'Administration', icon: 'shield' },
      { path: '/admin/users', label: 'Utilisateurs', icon: 'users' },
      { path: '/admin/projects', label: 'Projets', icon: 'folder' },
      { path: '/admin/disputes', label: 'Litiges', icon: 'alert-triangle' },
      { path: '/admin/analytics', label: 'Analytics', icon: 'bar-chart' },
    ],
    secondaryRoutes: [
      { path: '/admin/fraud', label: 'Anti-fraude', icon: 'shield-alert' },
      { path: '/admin/settings', label: 'Configuration', icon: 'settings' },
    ],
    defaultRoute: '/admin-dashboard',
    hiddenRoutes: [],
  },

  limits: {
    maxProjects: -1,
    maxProjectsPerMonth: -1,
    maxDocumentsPerProject: -1,
    maxFileSizeMB: 500,
    maxTeamMembers: -1,
    maxStorageGB: -1,
  },
};

// Map des configurations
const PROFILE_CONFIGS: Record<UserType, ProfileConfig> = {
  B2C: B2C_CONFIG,
  B2B: B2B_CONFIG,
  B2G: B2G_CONFIG,
  admin: ADMIN_CONFIG,
  super_admin: ADMIN_CONFIG, // Super admin utilise la même config qu'admin
};

// =============================================================================
// SERVICE
// =============================================================================

export class ProfileConfigService {
  /**
   * Récupère la configuration complète d'un profil
   */
  static getConfig(userType: UserType): ProfileConfig {
    return PROFILE_CONFIGS[userType] || B2C_CONFIG;
  }

  /**
   * Récupère les features activées pour un profil
   */
  static getFeatures(userType: UserType): ProfileFeatures {
    return this.getConfig(userType).features;
  }

  /**
   * Vérifie si une feature est activée pour un profil
   */
  static hasFeature(userType: UserType, feature: keyof ProfileFeatures): boolean {
    return this.getFeatures(userType)[feature];
  }

  /**
   * Récupère les labels contextuels d'un profil
   */
  static getLabels(userType: UserType): ProfileLabels {
    return this.getConfig(userType).labels;
  }

  /**
   * Récupère un label spécifique
   */
  static getLabel(userType: UserType, labelKey: keyof ProfileLabels): string {
    return this.getLabels(userType)[labelKey];
  }

  /**
   * Récupère la configuration du dashboard
   */
  static getDashboardConfig(userType: UserType): DashboardConfig {
    return this.getConfig(userType).dashboard;
  }

  /**
   * Récupère les widgets du dashboard
   */
  static getDashboardWidgets(userType: UserType): DashboardWidget[] {
    return this.getDashboardConfig(userType).widgets;
  }

  /**
   * Récupère les actions rapides
   */
  static getQuickActions(userType: UserType): QuickAction[] {
    return this.getDashboardConfig(userType).quickActions;
  }

  /**
   * Récupère le mode wizard approprié
   */
  static getWizardMode(userType: UserType): WizardMode {
    return this.getConfig(userType).wizardMode;
  }

  /**
   * Récupère la configuration de navigation
   */
  static getNavigationConfig(userType: UserType): NavigationConfig {
    return this.getConfig(userType).navigation;
  }

  /**
   * Récupère les routes principales
   */
  static getMainRoutes(userType: UserType): NavRoute[] {
    return this.getNavigationConfig(userType).mainRoutes;
  }

  /**
   * Récupère la route par défaut après login
   */
  static getDefaultRoute(userType: UserType): string {
    return this.getNavigationConfig(userType).defaultRoute;
  }

  /**
   * Vérifie si une route est accessible pour un profil
   */
  static canAccessRoute(userType: UserType, route: string): boolean {
    const config = this.getNavigationConfig(userType);

    // Routes explicitement cachées
    if (config.hiddenRoutes.some(hidden => route.startsWith(hidden))) {
      return false;
    }

    // Routes admin réservées aux admins
    if (route.startsWith('/admin') && !['admin', 'super_admin'].includes(userType)) {
      return false;
    }

    // Routes pro réservées B2B
    if (route.startsWith('/pro') && userType !== 'B2B') {
      return false;
    }

    return true;
  }

  /**
   * Récupère les limites d'un profil
   */
  static getLimits(userType: UserType): ProfileLimits {
    return this.getConfig(userType).limits;
  }

  /**
   * Vérifie une limite spécifique
   */
  static checkLimit(
    userType: UserType,
    limitKey: keyof ProfileLimits,
    currentValue: number
  ): { allowed: boolean; limit: number; remaining: number } {
    const limit = this.getLimits(userType)[limitKey];

    // -1 = illimité
    if (limit === -1) {
      return { allowed: true, limit: -1, remaining: -1 };
    }

    const remaining = limit - currentValue;
    return {
      allowed: currentValue < limit,
      limit,
      remaining: Math.max(0, remaining),
    };
  }

  /**
   * Récupère la couleur du profil
   */
  static getProfileColor(userType: UserType): string {
    return this.getConfig(userType).color;
  }

  /**
   * Récupère l'icône du profil
   */
  static getProfileIcon(userType: UserType): string {
    return this.getConfig(userType).icon;
  }

  /**
   * Récupère le nom d'affichage du profil
   */
  static getDisplayName(userType: UserType): string {
    return this.getConfig(userType).displayName;
  }

  /**
   * Récupère la configuration adaptée selon le contexte projet
   * Permet de personnaliser selon le rôle dans un projet spécifique
   */
  static async getContextualConfig(
    userId: string,
    userType: UserType,
    projectId?: string
  ): Promise<ProfileConfig> {
    const baseConfig = this.getConfig(userType);

    if (!projectId) {
      return baseConfig;
    }

    // Récupérer le rôle sur le projet
    const { data: actor } = await supabase
      .from('project_actors')
      .select('role, permissions')
      .eq('project_id', projectId)
      .eq('user_id', userId)
      .single();

    if (!actor) {
      return baseConfig;
    }

    // Adapter les features selon le rôle sur le projet
    const contextualFeatures = { ...baseConfig.features };

    if (actor.role === 'viewer') {
      contextualFeatures.canManageMilestones = false;
      contextualFeatures.canValidateMilestones = false;
      contextualFeatures.canMakePayments = false;
      contextualFeatures.canOpenDispute = false;
    }

    return {
      ...baseConfig,
      features: contextualFeatures,
    };
  }

  /**
   * Détermine le meilleur profil pour un nouvel utilisateur
   * basé sur les informations d'inscription
   */
  static suggestProfileType(registrationData: {
    email: string;
    siret?: string;
    entityType?: string;
  }): UserType {
    // Email institutionnel (.gouv.fr, etc.)
    const publicDomains = ['.gouv.fr', '.mairie-', '.departement-', '.region-'];
    if (publicDomains.some(domain => registrationData.email.includes(domain))) {
      return 'B2G';
    }

    // SIRET fourni = professionnel
    if (registrationData.siret) {
      return 'B2B';
    }

    // Type d'entité publique
    if (registrationData.entityType && ['commune', 'departement', 'region', 'eple', 'hopital'].includes(registrationData.entityType)) {
      return 'B2G';
    }

    // Par défaut = particulier
    return 'B2C';
  }
}

export default ProfileConfigService;
