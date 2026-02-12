/**
 * useProfile Hook - Accès facilité à la configuration multi-profil
 * Fournit la configuration, les labels et les permissions selon le profil utilisateur
 */

import { useMemo, useCallback, useState, useEffect } from 'react';
import { useApp } from '@/context/AppContext';
import { ProfileConfigService } from '@/services/profile/profile-config.service';
import { PermissionService, PermissionCheck } from '@/services/auth/permission.service';
import {
  UserType,
  ProfileConfig,
  ProfileFeatures,
  ProfileLabels,
  DashboardConfig,
  QuickAction,
  NavRoute,
  ProfileLimits,
  PermissionResource,
  PermissionAction,
  ProjectActor,
  ActorNotification,
} from '@/types/profile.types';

// =============================================================================
// TYPES
// =============================================================================

export interface UseProfileReturn {
  // Configuration
  config: ProfileConfig;
  features: ProfileFeatures;
  labels: ProfileLabels;
  dashboard: DashboardConfig;
  limits: ProfileLimits;

  // Navigation
  mainRoutes: NavRoute[];
  secondaryRoutes: NavRoute[];
  quickActions: QuickAction[];
  defaultRoute: string;

  // Helpers
  hasFeature: (feature: keyof ProfileFeatures) => boolean;
  getLabel: (key: keyof ProfileLabels) => string;
  canAccessRoute: (route: string) => boolean;
  checkLimit: (limitKey: keyof ProfileLimits, currentValue: number) => {
    allowed: boolean;
    limit: number;
    remaining: number;
  };

  // Visuels
  profileColor: string;
  profileIcon: string;
  profileName: string;

  // État
  isB2C: boolean;
  isB2B: boolean;
  isB2G: boolean;
  isAdmin: boolean;
}

export interface UsePermissionsReturn {
  // Vérification
  canAccess: (resource: PermissionResource, action: PermissionAction, projectId?: string) => Promise<PermissionCheck>;
  canAccessSync: (resource: PermissionResource, action: PermissionAction, projectId?: string) => boolean;

  // Rôle
  getRoleOnProject: (projectId: string) => Promise<string | null>;
  isProjectOwner: (projectId: string) => Promise<boolean>;
  isProjectMember: (projectId: string) => Promise<boolean>;

  // Actions disponibles
  getAvailableActions: (resource: PermissionResource, projectId?: string) => Promise<PermissionAction[]>;
}


// =============================================================================
// HOOK: useProfile
// =============================================================================

export function useProfile(): UseProfileReturn {
  const { userType } = useApp();

  // Mémoiser la configuration pour éviter les recalculs
  const config = useMemo(
    () => ProfileConfigService.getConfig(userType),
    [userType]
  );

  const features = useMemo(
    () => ProfileConfigService.getFeatures(userType),
    [userType]
  );

  const labels = useMemo(
    () => ProfileConfigService.getLabels(userType),
    [userType]
  );

  const dashboard = useMemo(
    () => ProfileConfigService.getDashboardConfig(userType),
    [userType]
  );

  const limits = useMemo(
    () => ProfileConfigService.getLimits(userType),
    [userType]
  );

  const navigation = useMemo(
    () => ProfileConfigService.getNavigationConfig(userType),
    [userType]
  );

  // Helpers
  const hasFeature = useCallback(
    (feature: keyof ProfileFeatures) => ProfileConfigService.hasFeature(userType, feature),
    [userType]
  );

  const getLabel = useCallback(
    (key: keyof ProfileLabels) => ProfileConfigService.getLabel(userType, key),
    [userType]
  );

  const canAccessRoute = useCallback(
    (route: string) => ProfileConfigService.canAccessRoute(userType, route),
    [userType]
  );

  const checkLimit = useCallback(
    (limitKey: keyof ProfileLimits, currentValue: number) =>
      ProfileConfigService.checkLimit(userType, limitKey, currentValue),
    [userType]
  );

  return {
    // Configuration
    config,
    features,
    labels,
    dashboard,
    limits,

    // Navigation
    mainRoutes: navigation.mainRoutes,
    secondaryRoutes: navigation.secondaryRoutes,
    quickActions: dashboard.quickActions,
    defaultRoute: navigation.defaultRoute,

    // Helpers
    hasFeature,
    getLabel,
    canAccessRoute,
    checkLimit,

    // Visuels
    profileColor: config.color,
    profileIcon: config.icon,
    profileName: config.displayName,

    // État
    isB2C: userType === 'B2C',
    isB2B: userType === 'B2B',
    isB2G: userType === 'B2G',
    isAdmin: userType === 'admin' || userType === 'super_admin',
  };
}

// =============================================================================
// HOOK: usePermissions
// =============================================================================

export function usePermissions(): UsePermissionsReturn {
  const { user } = useApp();
  const [context, setContext] = useState<Awaited<ReturnType<typeof PermissionService.getUserContext>> | null>(null);

  // Charger le contexte au montage
  useEffect(() => {
    if (user?.id) {
      PermissionService.getUserContext(user.id).then(setContext);
    }
  }, [user?.id]);

  const canAccess = useCallback(
    async (resource: PermissionResource, action: PermissionAction, projectId?: string) => {
      if (!user?.id) {
        return { allowed: false, reason: 'Non connecté' };
      }
      return PermissionService.canAccess(user.id, resource, action, projectId);
    },
    [user?.id]
  );

  const canAccessSync = useCallback(
    (resource: PermissionResource, action: PermissionAction, projectId?: string) => {
      if (!context) return false;
      return PermissionService.canAccessSync(context, resource, action, projectId);
    },
    [context]
  );

  const getRoleOnProject = useCallback(
    async (projectId: string) => {
      if (!user?.id) return null;
      return PermissionService.getRoleOnProject(user.id, projectId);
    },
    [user?.id]
  );

  const isProjectOwner = useCallback(
    async (projectId: string) => {
      if (!user?.id) return false;
      return PermissionService.isProjectOwner(user.id, projectId);
    },
    [user?.id]
  );

  const isProjectMember = useCallback(
    async (projectId: string) => {
      if (!user?.id) return false;
      return PermissionService.isProjectMember(user.id, projectId);
    },
    [user?.id]
  );

  const getAvailableActions = useCallback(
    async (resource: PermissionResource, projectId?: string) => {
      if (!user?.id) return [];
      return PermissionService.getAvailableActions(user.id, resource, projectId);
    },
    [user?.id]
  );

  return {
    canAccess,
    canAccessSync,
    getRoleOnProject,
    isProjectOwner,
    isProjectMember,
    getAvailableActions,
  };
}


// =============================================================================
// COMBINED HOOK
// =============================================================================

/**
 * Hook combiné pour accéder à toutes les fonctionnalités multi-profil
 */
export function useMultiProfile() {
  const profile = useProfile();
  const permissions = usePermissions();

  return {
    ...profile,
    permissions,
  };
}

export default useProfile;
