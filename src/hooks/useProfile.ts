/**
 * useProfile Hook - Accès facilité à la configuration multi-profil
 * Fournit la configuration, les labels et les permissions selon le profil utilisateur
 */

import { useMemo, useCallback, useState, useEffect } from 'react';
import { useApp } from '@/context/AppContext';
import { ProfileConfigService } from '@/services/profile/profile-config.service';
import { PermissionService, PermissionCheck } from '@/services/auth/permission.service';
import { InteroperabilityService } from '@/services/interop/interoperability.service';
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

export interface UseInteropReturn {
  // Acteurs
  getProjectActors: (projectId: string) => Promise<ProjectActor[]>;
  inviteActor: (projectId: string, email: string, role: string) => Promise<{ success: boolean; error?: string }>;

  // Notifications
  notifications: ActorNotification[];
  unreadCount: number;
  loadNotifications: () => Promise<void>;
  markAsRead: (notificationIds: string[]) => Promise<void>;

  // Documents
  shareDocument: (projectId: string, document: {
    documentType: string;
    name: string;
    fileUrl: string;
    fileSize: number;
    mimeType: string;
  }) => Promise<{ success: boolean; error?: string }>;
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
// HOOK: useInterop
// =============================================================================

export function useInterop(): UseInteropReturn {
  const { user } = useApp();
  const [notifications, setNotifications] = useState<ActorNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  // Charger les notifications au montage
  const loadNotifications = useCallback(async () => {
    if (!user?.id) return;
    try {
      const notifs = await InteroperabilityService.getUserNotifications(user.id, { limit: 50 });
      setNotifications(notifs);
      setUnreadCount(notifs.filter((n) => !n.read).length);
    } catch (error) {
      console.error('Erreur chargement notifications:', error);
    }
  }, [user?.id]);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  const getProjectActors = useCallback(
    async (projectId: string) => {
      return InteroperabilityService.getProjectActors(projectId);
    },
    []
  );

  const inviteActor = useCallback(
    async (projectId: string, email: string, role: string) => {
      if (!user?.id || !user?.name) {
        return { success: false, error: 'Non connecté' };
      }
      return InteroperabilityService.inviteActor(
        projectId,
        email,
        role as any,
        user.id,
        user.name
      );
    },
    [user?.id, user?.name]
  );

  const markAsRead = useCallback(
    async (notificationIds: string[]) => {
      if (!user?.id) return;
      await InteroperabilityService.markNotificationsRead(notificationIds, user.id);
      setNotifications((prev) =>
        prev.map((n) =>
          notificationIds.includes(n.id) ? { ...n, read: true } : n
        )
      );
      setUnreadCount((prev) => Math.max(0, prev - notificationIds.length));
    },
    [user?.id]
  );

  const shareDocument = useCallback(
    async (projectId: string, document: {
      documentType: string;
      name: string;
      fileUrl: string;
      fileSize: number;
      mimeType: string;
    }) => {
      if (!user?.id || !user?.name) {
        return { success: false, error: 'Non connecté' };
      }
      const result = await InteroperabilityService.shareDocument(
        projectId,
        document as any,
        user.id,
        user.name
      );
      return { success: !!result.document, error: result.error };
    },
    [user?.id, user?.name]
  );

  return {
    getProjectActors,
    inviteActor,
    notifications,
    unreadCount,
    loadNotifications,
    markAsRead,
    shareDocument,
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
  const interop = useInterop();

  return {
    ...profile,
    permissions,
    interop,
  };
}

export default useProfile;
