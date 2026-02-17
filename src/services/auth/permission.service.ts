/**
 * PermissionService - Contrôle d'accès RBAC
 * Gestion des permissions par utilisateur, rôle et ressource
 */

import { supabase } from '@/lib/supabase';
import {
  UserType,
  UserRole,
  ProjectPermission,
  PermissionResource,
  PermissionAction,
  ProfileFeatures,
} from '@/types/profile.types';
import { ProfileConfigService } from '@/services/profile/profile-config.service';

// =============================================================================
// TYPES
// =============================================================================

export interface PermissionCheck {
  allowed: boolean;
  reason?: string;
  requiredRole?: UserRole;
  requiredAction?: PermissionAction;
}

export interface UserPermissionContext {
  userId: string;
  userType: UserType;
  globalRole: UserRole;
  projectRoles: Map<string, UserRole>;
  features: ProfileFeatures;
}

// Hiérarchie des rôles (du plus élevé au plus bas)
const ROLE_HIERARCHY: UserRole[] = [
  'admin',
  'owner',
  'mediator',
  'entreprise',
  'client',
  'collaborator',
  'viewer',
];

// Actions ordonnées par niveau de permission
const ACTION_HIERARCHY: PermissionAction[] = [
  'delete',
  'approve',
  'edit',
  'create',
  'export',
  'view',
];

// =============================================================================
// SERVICE
// =============================================================================

export class PermissionService {
  // Cache des contextes utilisateur pour performance
  private static contextCache: Map<string, { context: UserPermissionContext; expiresAt: number }> = new Map();
  private static CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  // ============================
  // VÉRIFICATION DES PERMISSIONS
  // ============================

  /**
   * Vérifie si un utilisateur peut effectuer une action sur une ressource
   */
  static async canAccess(
    userId: string,
    resource: PermissionResource,
    action: PermissionAction,
    projectId?: string
  ): Promise<PermissionCheck> {
    try {
      // Récupérer le contexte utilisateur
      const context = await this.getUserContext(userId);
      if (!context) {
        return { allowed: false, reason: 'Utilisateur non trouvé' };
      }

      // 1. Vérifier les features globales du profil
      const featureCheck = this.checkFeaturePermission(context.features, resource, action);
      if (!featureCheck.allowed) {
        return featureCheck;
      }

      // 2. Vérifier les permissions admin (accès global)
      if (context.userType === 'admin' || context.userType === 'super_admin') {
        return { allowed: true };
      }

      // 3. Si pas de projet spécifié, utiliser les permissions globales
      if (!projectId) {
        return this.checkGlobalPermission(context, resource, action);
      }

      // 4. Vérifier les permissions sur le projet spécifique
      return this.checkProjectPermission(context, projectId, resource, action);
    } catch (error) {
      console.error('Erreur vérification permission:', error);
      return { allowed: false, reason: 'Erreur de vérification' };
    }
  }

  /**
   * Vérifie rapidement une permission (version synchrone avec cache)
   */
  static canAccessSync(
    context: UserPermissionContext,
    resource: PermissionResource,
    action: PermissionAction,
    projectId?: string
  ): boolean {
    // Admin a tous les accès
    if (context.userType === 'admin' || context.userType === 'super_admin') {
      return true;
    }

    // Vérifier les features
    const featureCheck = this.checkFeaturePermission(context.features, resource, action);
    if (!featureCheck.allowed) {
      return false;
    }

    // Vérifier le rôle sur le projet si spécifié
    if (projectId) {
      const role = context.projectRoles.get(projectId);
      if (!role) return false;
      return this.roleHasAction(role, resource, action);
    }

    // Permission globale basée sur le rôle
    return this.roleHasAction(context.globalRole, resource, action);
  }

  /**
   * Récupère toutes les permissions d'un utilisateur sur un projet
   */
  static async getProjectPermissions(
    userId: string,
    projectId: string
  ): Promise<ProjectPermission[]> {
    const { data: actor } = await supabase
      .from('project_actors')
      .select('role, permissions')
      .eq('project_id', projectId)
      .eq('user_id', userId)
      .eq('status', 'active')
      .single();

    if (!actor) return [];

    // Retourner les permissions personnalisées ou celles par défaut du rôle
    return actor.permissions as ProjectPermission[] || this.getDefaultPermissionsForRole(actor.role as UserRole);
  }

  /**
   * Récupère le rôle d'un utilisateur sur un projet
   */
  static async getRoleOnProject(userId: string, projectId: string): Promise<UserRole | null> {
    const { data } = await supabase
      .from('project_actors')
      .select('role')
      .eq('project_id', projectId)
      .eq('user_id', userId)
      .eq('status', 'active')
      .single();

    return (data?.role as UserRole) || null;
  }

  /**
   * Récupère tous les projets accessibles par un utilisateur
   */
  static async getAccessibleProjects(
    userId: string,
    requiredAction?: PermissionAction
  ): Promise<string[]> {
    const { data } = await supabase
      .from('project_actors')
      .select('project_id, role, permissions')
      .eq('user_id', userId)
      .eq('status', 'active');

    if (!data) return [];

    return data
      .filter((actor) => {
        if (!requiredAction) return true;
        const permissions = actor.permissions as ProjectPermission[] ||
          this.getDefaultPermissionsForRole(actor.role as UserRole);
        return permissions.some((p) => p.actions.includes(requiredAction));
      })
      .map((actor) => actor.project_id);
  }

  // ============================
  // MODIFICATION DES PERMISSIONS
  // ============================

  /**
   * Attribue des permissions personnalisées à un utilisateur sur un projet
   */
  static async grantPermissions(
    projectId: string,
    userId: string,
    permissions: ProjectPermission[],
    grantedBy: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // Vérifier que le granteur a le droit de modifier les permissions
      const canGrant = await this.canAccess(grantedBy, 'team', 'edit', projectId);
      if (!canGrant.allowed) {
        return { success: false, error: 'Vous n\'avez pas le droit de modifier les permissions' };
      }

      const { error } = await supabase
        .from('project_actors')
        .update({ permissions })
        .eq('project_id', projectId)
        .eq('user_id', userId);

      if (error) throw error;

      // Invalider le cache
      this.invalidateCache(userId);

      return { success: true };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }

  /**
   * Révoque des permissions spécifiques
   */
  static async revokePermissions(
    projectId: string,
    userId: string,
    resourcesToRevoke: PermissionResource[],
    revokedBy: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // Récupérer les permissions actuelles
      const currentPermissions = await this.getProjectPermissions(userId, projectId);

      // Filtrer les permissions à conserver
      const newPermissions = currentPermissions.filter(
        (p) => !resourcesToRevoke.includes(p.resource)
      );

      return this.grantPermissions(projectId, userId, newPermissions, revokedBy);
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }

  /**
   * Ajoute une action à une ressource existante
   */
  static async addAction(
    projectId: string,
    userId: string,
    resource: PermissionResource,
    action: PermissionAction,
    grantedBy: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const currentPermissions = await this.getProjectPermissions(userId, projectId);

      // Trouver ou créer la permission pour cette ressource
      const existingPermission = currentPermissions.find((p) => p.resource === resource);
      if (existingPermission) {
        if (!existingPermission.actions.includes(action)) {
          existingPermission.actions.push(action);
        }
      } else {
        currentPermissions.push({ resource, actions: [action] });
      }

      return this.grantPermissions(projectId, userId, currentPermissions, grantedBy);
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }

  // ============================
  // UTILITAIRES
  // ============================

  /**
   * Récupère le contexte de permission d'un utilisateur
   */
  static async getUserContext(userId: string): Promise<UserPermissionContext | null> {
    // Vérifier le cache
    const cached = this.contextCache.get(userId);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.context;
    }

    // Récupérer les données utilisateur depuis profiles
    const { data: user } = await supabase
      .from('profiles')
      .select('id, full_name, role, company_name')
      .eq('id', userId)
      .single();

    if (!user) return null;

    // Determine user type based on company info
    const userType: UserType = user.company_name ? 'B2B' : 'B2C';

    // Récupérer les rôles sur les projets
    const { data: projectRoles } = await supabase
      .from('project_actors')
      .select('project_id, role')
      .eq('user_id', userId)
      .eq('status', 'active');

    const roleMap = new Map<string, UserRole>();
    (projectRoles || []).forEach((pr) => {
      roleMap.set(pr.project_id, pr.role as UserRole);
    });

    // Determine global role from profile.role
    const globalRole = user.role === 'admin' || user.role === 'super_admin' ? 'admin' :
                       user.role === 'user' ? 'client' : 'viewer';

    const context: UserPermissionContext = {
      userId,
      userType,
      globalRole,
      projectRoles: roleMap,
      features: ProfileConfigService.getFeatures(userType),
    };

    // Mettre en cache
    this.contextCache.set(userId, {
      context,
      expiresAt: Date.now() + this.CACHE_TTL,
    });

    return context;
  }

  /**
   * Invalide le cache pour un utilisateur
   */
  static invalidateCache(userId: string): void {
    this.contextCache.delete(userId);
  }

  /**
   * Vérifie si les features du profil permettent l'action
   */
  private static checkFeaturePermission(
    features: ProfileFeatures,
    resource: PermissionResource,
    action: PermissionAction
  ): PermissionCheck {
    // Mapper les ressources aux features
    const resourceFeatureMap: Partial<Record<PermissionResource, keyof ProfileFeatures>> = {
      milestones: action === 'approve' ? 'canValidateMilestones' : 'canManageMilestones',
      payments: action === 'create' ? 'canMakePayments' : 'canReceivePayments',
      disputes: 'canOpenDispute',
      messages: 'canSendMessages',
      analytics: 'canAccessAnalytics',
      team: 'canManageTeam',
    };

    const featureKey = resourceFeatureMap[resource];
    if (featureKey && !features[featureKey]) {
      return {
        allowed: false,
        reason: `Fonctionnalité non disponible pour votre profil`,
      };
    }

    return { allowed: true };
  }

  /**
   * Vérifie les permissions globales (sans projet)
   */
  private static checkGlobalPermission(
    context: UserPermissionContext,
    resource: PermissionResource,
    action: PermissionAction
  ): PermissionCheck {
    // Utiliser le rôle global
    const allowed = this.roleHasAction(context.globalRole, resource, action);
    return {
      allowed,
      reason: allowed ? undefined : `Permission "${action}" sur "${resource}" non accordée`,
    };
  }

  /**
   * Vérifie les permissions sur un projet spécifique
   */
  private static async checkProjectPermission(
    context: UserPermissionContext,
    projectId: string,
    resource: PermissionResource,
    action: PermissionAction
  ): Promise<PermissionCheck> {
    // Récupérer le rôle sur ce projet
    let role = context.projectRoles.get(projectId);

    if (!role) {
      // Vérifier en base si pas dans le cache
      const { data } = await supabase
        .from('project_actors')
        .select('role')
        .eq('project_id', projectId)
        .eq('user_id', context.userId)
        .eq('status', 'active')
        .single();

      role = data?.role as UserRole;
      if (role) {
        context.projectRoles.set(projectId, role);
      }
    }

    if (!role) {
      return {
        allowed: false,
        reason: 'Vous n\'êtes pas membre de ce projet',
      };
    }

    const allowed = this.roleHasAction(role, resource, action);
    return {
      allowed,
      reason: allowed ? undefined : `Le rôle "${role}" ne permet pas "${action}" sur "${resource}"`,
      requiredRole: allowed ? undefined : this.getMinimumRoleForAction(resource, action),
      requiredAction: action,
    };
  }

  /**
   * Vérifie si un rôle a une action sur une ressource
   */
  private static roleHasAction(
    role: UserRole,
    resource: PermissionResource,
    action: PermissionAction
  ): boolean {
    const permissions = this.getDefaultPermissionsForRole(role);
    const resourcePermission = permissions.find((p) => p.resource === resource);
    return resourcePermission?.actions.includes(action) || false;
  }

  /**
   * Récupère les permissions par défaut d'un rôle
   */
  static getDefaultPermissionsForRole(role: UserRole): ProjectPermission[] {
    const permissionsByRole: Record<UserRole, ProjectPermission[]> = {
      admin: [
        { resource: 'project', actions: ['view', 'edit', 'delete', 'approve'] },
        { resource: 'project.details', actions: ['view', 'edit'] },
        { resource: 'project.documents', actions: ['view', 'export'] },
        { resource: 'project.budget', actions: ['view'] },
        { resource: 'milestones', actions: ['view', 'approve'] },
        { resource: 'payments', actions: ['view', 'approve'] },
        { resource: 'messages', actions: ['view'] },
        { resource: 'disputes', actions: ['view', 'create', 'edit', 'approve'] },
        { resource: 'team', actions: ['view'] },
        { resource: 'analytics', actions: ['view', 'export'] },
      ],
      owner: [
        { resource: 'project', actions: ['view', 'create', 'edit', 'delete', 'approve', 'export'] },
        { resource: 'project.details', actions: ['view', 'edit'] },
        { resource: 'project.documents', actions: ['view', 'create', 'edit', 'delete', 'export'] },
        { resource: 'project.budget', actions: ['view', 'edit'] },
        { resource: 'milestones', actions: ['view', 'create', 'edit', 'delete', 'approve'] },
        { resource: 'payments', actions: ['view', 'create', 'approve'] },
        { resource: 'messages', actions: ['view', 'create'] },
        { resource: 'disputes', actions: ['view', 'create'] },
        { resource: 'team', actions: ['view', 'create', 'edit', 'delete'] },
        { resource: 'analytics', actions: ['view', 'export'] },
      ],
      client: [
        { resource: 'project', actions: ['view'] },
        { resource: 'project.details', actions: ['view'] },
        { resource: 'project.documents', actions: ['view', 'export'] },
        { resource: 'project.budget', actions: ['view'] },
        { resource: 'milestones', actions: ['view', 'approve'] },
        { resource: 'payments', actions: ['view', 'create'] },
        { resource: 'messages', actions: ['view', 'create'] },
        { resource: 'disputes', actions: ['view', 'create'] },
        { resource: 'team', actions: ['view'] },
        { resource: 'analytics', actions: ['view'] },
      ],
      entreprise: [
        { resource: 'project', actions: ['view'] },
        { resource: 'project.details', actions: ['view'] },
        { resource: 'project.documents', actions: ['view', 'create', 'export'] },
        { resource: 'project.budget', actions: ['view'] },
        { resource: 'milestones', actions: ['view', 'create', 'edit'] },
        { resource: 'payments', actions: ['view'] },
        { resource: 'messages', actions: ['view', 'create'] },
        { resource: 'disputes', actions: ['view', 'create'] },
        { resource: 'team', actions: ['view'] },
        { resource: 'analytics', actions: ['view'] },
      ],
      collaborator: [
        { resource: 'project', actions: ['view'] },
        { resource: 'project.details', actions: ['view'] },
        { resource: 'project.documents', actions: ['view'] },
        { resource: 'project.budget', actions: ['view'] },
        { resource: 'milestones', actions: ['view'] },
        { resource: 'payments', actions: ['view'] },
        { resource: 'messages', actions: ['view', 'create'] },
        { resource: 'disputes', actions: ['view'] },
        { resource: 'team', actions: ['view'] },
        { resource: 'analytics', actions: ['view'] },
      ],
      viewer: [
        { resource: 'project', actions: ['view'] },
        { resource: 'project.details', actions: ['view'] },
        { resource: 'project.documents', actions: ['view'] },
        { resource: 'project.budget', actions: ['view'] },
        { resource: 'milestones', actions: ['view'] },
        { resource: 'payments', actions: ['view'] },
        { resource: 'messages', actions: ['view'] },
        { resource: 'disputes', actions: ['view'] },
        { resource: 'team', actions: ['view'] },
        { resource: 'analytics', actions: ['view'] },
      ],
      mediator: [
        { resource: 'project', actions: ['view'] },
        { resource: 'project.details', actions: ['view'] },
        { resource: 'project.documents', actions: ['view'] },
        { resource: 'project.budget', actions: ['view'] },
        { resource: 'milestones', actions: ['view'] },
        { resource: 'payments', actions: ['view'] },
        { resource: 'messages', actions: ['view', 'create'] },
        { resource: 'disputes', actions: ['view', 'create', 'edit', 'approve'] },
        { resource: 'team', actions: ['view'] },
        { resource: 'analytics', actions: ['view'] },
      ],
    };

    return permissionsByRole[role] || [];
  }

  /**
   * Trouve le rôle minimum requis pour une action sur une ressource
   */
  private static getMinimumRoleForAction(
    resource: PermissionResource,
    action: PermissionAction
  ): UserRole | undefined {
    for (const role of [...ROLE_HIERARCHY].reverse()) {
      if (this.roleHasAction(role, resource, action)) {
        return role;
      }
    }
    return undefined;
  }

  /**
   * Compare deux rôles dans la hiérarchie
   */
  static compareRoles(role1: UserRole, role2: UserRole): number {
    const index1 = ROLE_HIERARCHY.indexOf(role1);
    const index2 = ROLE_HIERARCHY.indexOf(role2);
    return index1 - index2; // Négatif si role1 > role2
  }

  /**
   * Vérifie si un rôle est supérieur ou égal à un autre
   */
  static roleIsAtLeast(role: UserRole, minimumRole: UserRole): boolean {
    return this.compareRoles(role, minimumRole) <= 0;
  }

  /**
   * Récupère les actions possibles pour un utilisateur sur une ressource
   */
  static async getAvailableActions(
    userId: string,
    resource: PermissionResource,
    projectId?: string
  ): Promise<PermissionAction[]> {
    const context = await this.getUserContext(userId);
    if (!context) return [];

    // Admin a toutes les actions
    if (context.userType === 'admin' || context.userType === 'super_admin') {
      return ACTION_HIERARCHY;
    }

    // Récupérer le rôle
    const role = projectId
      ? context.projectRoles.get(projectId) || context.globalRole
      : context.globalRole;

    const permissions = this.getDefaultPermissionsForRole(role);
    const resourcePermission = permissions.find((p) => p.resource === resource);

    return resourcePermission?.actions || [];
  }

  /**
   * Vérifie si un utilisateur est propriétaire d'un projet
   */
  static async isProjectOwner(userId: string, projectId: string): Promise<boolean> {
    const role = await this.getRoleOnProject(userId, projectId);
    return role === 'owner';
  }

  /**
   * Vérifie si un utilisateur est membre d'un projet
   */
  static async isProjectMember(userId: string, projectId: string): Promise<boolean> {
    const role = await this.getRoleOnProject(userId, projectId);
    return role !== null;
  }
}

export default PermissionService;
