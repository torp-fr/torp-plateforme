/**
 * Authentication and Authorization Type Definitions
 */

/**
 * User roles in the TORP platform
 */
export enum UserRole {
  ADMIN = 'admin',
  B2B = 'B2B',
  B2C = 'B2C',
}

/**
 * Supabase user metadata
 */
export interface UserMetadata {
  name?: string;
  company?: string;
  phone?: string;
  address?: {
    street?: string;
    postal_code?: string;
    city?: string;
  };
}

/**
 * TORP authenticated user
 */
export interface TORPUser {
  id: string;
  email: string;
  name: string | null;
  role: UserRole;
  company: string | null;
  phone: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
  email_verified: boolean;
  last_login_at: string | null;
}

/**
 * Supabase auth session
 */
export interface AuthSession {
  user: TORPUser;
  access_token: string;
  refresh_token: string | null;
  expires_at: number;
  expires_in: number;
  token_type: 'Bearer';
}

/**
 * Authorization context
 */
export interface AuthContext {
  isAuthenticated: boolean;
  user: TORPUser | null;
  session: AuthSession | null;
  role: UserRole | null;
  hasRole: (role: UserRole) => boolean;
  hasAnyRole: (roles: UserRole[]) => boolean;
  isAdmin: boolean;
}

/**
 * Role permissions
 */
export interface RolePermissions {
  [UserRole.ADMIN]: PermissionSet;
  [UserRole.B2B]: PermissionSet;
  [UserRole.B2C]: PermissionSet;
}

/**
 * Permission set for a role
 */
export interface PermissionSet {
  canManageUsers: boolean;
  canManageProjects: boolean;
  canAnalyzeQuotes: boolean;
  canViewAnalytics: boolean;
  canManagePayments: boolean;
  canAccessAdmin: boolean;
  canUploadDocuments: boolean;
  canInvokeEdgeFunctions: boolean;
}

/**
 * Default role permissions
 */
export const DEFAULT_ROLE_PERMISSIONS: RolePermissions = {
  [UserRole.ADMIN]: {
    canManageUsers: true,
    canManageProjects: true,
    canAnalyzeQuotes: true,
    canViewAnalytics: true,
    canManagePayments: true,
    canAccessAdmin: true,
    canUploadDocuments: true,
    canInvokeEdgeFunctions: true,
  },
  [UserRole.B2B]: {
    canManageUsers: false,
    canManageProjects: true,
    canAnalyzeQuotes: true,
    canViewAnalytics: true,
    canManagePayments: true,
    canAccessAdmin: false,
    canUploadDocuments: true,
    canInvokeEdgeFunctions: true,
  },
  [UserRole.B2C]: {
    canManageUsers: false,
    canManageProjects: true,
    canAnalyzeQuotes: true,
    canViewAnalytics: false,
    canManagePayments: true,
    canAccessAdmin: false,
    canUploadDocuments: true,
    canInvokeEdgeFunctions: false,
  },
};

/**
 * Type guard for user role
 */
export function isValidUserRole(value: unknown): value is UserRole {
  return Object.values(UserRole).includes(value as UserRole);
}

/**
 * Type guard for TORP user
 */
export function isTORPUser(value: unknown): value is TORPUser {
  const user = value as Record<string, unknown>;
  return (
    user &&
    typeof user === 'object' &&
    typeof user.id === 'string' &&
    typeof user.email === 'string' &&
    isValidUserRole(user.role)
  );
}

/**
 * Type guard for auth session
 */
export function isAuthSession(value: unknown): value is AuthSession {
  const session = value as Record<string, unknown>;
  return (
    session &&
    typeof session === 'object' &&
    isTORPUser(session.user) &&
    typeof session.access_token === 'string' &&
    session.token_type === 'Bearer'
  );
}
