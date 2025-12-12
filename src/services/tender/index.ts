/**
 * TORP Tender Services - Exports
 *
 * Services pour la gestion des appels d'offres et réponses B2B
 */

export { TenderService } from './tender.service';
export { DCEGeneratorService } from './dce-generator.service';
export { ResponseService } from './response.service';
export { MatchingService } from './matching.service';

// Re-export des types utiles
export type {
  MatchingResult,
  MatchDetail,
  MatchingCriteria,
  CompanyProfile,
} from './matching.service';
