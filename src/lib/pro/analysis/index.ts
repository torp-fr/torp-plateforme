/**
 * Module d'analyse des devis B2B TORP
 * Export centralisé de tous les services d'analyse
 */

// Service principal
export { analyzeProDevis, reanalyzeDevis } from './analyze-devis';

// Services intermédiaires
export { enrichWithCompanyData, checkDataCoherence } from './enrich-company-data';
export { calculateScore } from './calculate-score';
export { generateRecommendations } from './recommendations-generator';

// Types
export type {
  ScoringResult,
  AxisResult,
  CritereResult,
  BlockingPoint,
  Recommendation,
  AxisCode,
  Grade,
} from './scoring-engine';

export type { EnrichedCompanyData } from './enrich-company-data';

// Configuration
export { SCORING_CONFIG, calculateGrade } from './scoring-engine';
export { ALL_AXES } from './scoring-criteria';
