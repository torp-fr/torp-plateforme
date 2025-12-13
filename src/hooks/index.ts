/**
 * Hooks personnalisés TORP
 */

// Multi-profil
export {
  useProfile,
  usePermissions,
  useInterop,
  useMultiProfile,
} from './useProfile';

export type {
  UseProfileReturn,
  UsePermissionsReturn,
  UseInteropReturn,
} from './useProfile';

// Utilitaires
export { useGeoEnrichment } from './useGeoEnrichment';
export { useDebounce } from './useDebounce';
export { useToast } from './use-toast';
