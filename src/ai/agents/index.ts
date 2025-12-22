/**
 * TORP AI Agents - Index
 * Export centralisé des agents IA par phase
 */

// =============================================================================
// PHASE 0 - Conception & Définition
// =============================================================================
export { DeductionAgent, deductionAgent } from './phase0/DeductionAgent';
export type {
  DeductionInput,
  DeductionResult,
  LotSuggere,
  PhotoAnalysisResult,
} from './phase0/DeductionAgent';

// =============================================================================
// PHASE 1 - Consultation & Sélection Entreprises
// =============================================================================
export { OffreAnalysisAgent, offreAnalysisAgent } from './phase1/OffreAnalysisAgent';
export type {
  OffreInput,
  OffreAnalysis,
  ComparaisonResult,
  AnalyseDevisResult,
} from './phase1/OffreAnalysisAgent';

// =============================================================================
// PHASE 2 - Préparation Chantier
// =============================================================================
export { planningAgent, PlanningAgent } from './PlanningAgent';
export type {
  PlanningGenerationInput,
  GeneratedPlanning,
  GeneratedTask,
  OptimizationResult,
  DelaySimulation,
} from './PlanningAgent';

// =============================================================================
// PHASE 3 - Exécution des Travaux
// =============================================================================
export { SiteMonitoringAgent, siteMonitoringAgent } from './phase3/SiteMonitoringAgent';
export { PhotoAnalysisAgent, photoAnalysisAgent } from './phase3/PhotoAnalysisAgent';
export { QualityAgent, qualityAgent } from './phase3/QualityAgent';

// =============================================================================
// PHASE 4 - Réception & Garanties
// =============================================================================
export { ReceptionAgent, receptionAgent } from './phase4/ReceptionAgent';
export { WarrantyAgent, warrantyAgent } from './phase4/WarrantyAgent';
