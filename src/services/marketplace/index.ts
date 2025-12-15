/**
 * Services Marketplace TORP Phase 2
 * Mise en relation propriétaires / artisans
 */

export { MatchingService, matchingService } from './matching.service';
export { DemandeService, demandeService } from './demande.service';
export { ArtisanService, artisanService } from './artisan.service';
export type {
  ArtisanProfile,
  ArtisanQualification,
  MetierBTP,
  DemandeDevis,
  ReponseArtisan,
  EvaluationArtisan,
  MatchingResult,
  MatchingCriteria,
} from '@/types/marketplace.types';
