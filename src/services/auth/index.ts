/**
 * Services d'Authentification et Permissions
 * Contrôle d'accès RBAC
 */

export { PermissionService } from './permission.service';

export type {
  PermissionCheck,
  UserPermissionContext,
} from './permission.service';

export * from '@/types/profile.types';
