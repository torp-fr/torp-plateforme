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

// Gestion des paiements
export { usePayments } from './usePayments';
export type {
  PaymentMilestone,
  Payment,
  PaymentStats,
  PaymentStatus,
  MilestoneStatus,
} from './usePayments';

// Journal de chantier
export { useJournalEntries } from './useJournalEntries';
export type {
  JournalEntry,
  JournalStats,
  MeteoData,
  EffectifEntry,
  ActiviteEntry,
} from './useJournalEntries';

// Utilisateurs projet
export { useProjectUsers } from './useProjectUsers';
export type {
  ProjectUser,
  ProjectInvitation,
  ProjectUserStats,
  UserRole,
} from './useProjectUsers';

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
