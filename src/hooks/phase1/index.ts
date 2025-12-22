/**
 * Hooks Phase 1 - Consultation des entreprises
 * Export centralisé de tous les hooks Phase 1
 */

// Appels d'offres
export {
  useTenders,
} from './useTenders';

export type {
  Tender,
  TenderResponse,
  TenderStats,
  CreateTenderData,
  UseTendersOptions,
} from './useTenders';

// Entreprises
export {
  useEntreprises,
} from './useEntreprises';

export type {
  Entreprise,
  EntrepriseInvitation,
  SearchParams,
  UseEntreprisesOptions,
} from './useEntreprises';

// Offres
export {
  useOffres,
} from './useOffres';

export type {
  Offre,
  OffreStats,
  OffreComparaison,
  UseOffresOptions,
} from './useOffres';
