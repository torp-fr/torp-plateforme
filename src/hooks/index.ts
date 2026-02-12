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

// Analyse de parcelles et risques
export { useParcelAnalysis } from './useParcelAnalysis';
export type {
  ParcelAnalysisData,
  RiskAnalysisData,
  ParcelData,
  RiskAnalysis,
  RiskItem,
  GeocodingResult,
} from './useParcelAnalysis';

// Détails projet
export { useProjectDetails } from './useProjectDetails';
export type {
  ProjectDetails,
  ProjectPhase,
  ProjectBudget,
  BudgetItem,
  TeamMember,
  ProjectAlert,
  ProjectDocument,
} from './useProjectDetails';

// Gestion des chantiers
export { useChantiers } from './useChantiers';
export type {
  ChantierCard,
  ChantierStats,
  ChantierStatus,
} from './useChantiers';

// Phase 1 - Consultation entreprises
export { useTenders } from './phase1';
export type {
  Tender,
  TenderResponse,
  TenderStats,
  CreateTenderData,
} from './phase1';

// Phase 3 - Exécution des travaux
export {
  useQualityControls,
  useSituations,
  useCoordination,
  useProgressReport,
} from './phase3';
