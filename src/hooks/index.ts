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

// Phase 4 - Réception & Garanties
export {
  useOPR,
  useOPRSession,
  useReserves,
  useReserve,
  useReception,
  useReceptionById,
  useWarrantyClaims,
  useDesordre,
  useDOE,
} from './phase4';
