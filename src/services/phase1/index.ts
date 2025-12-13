/**
 * TORP Phase 1 - Services Index
 * Export centralisé de tous les services Phase 1 : Consultation & Sélection Entreprises
 */

// DCE (Dossier de Consultation des Entreprises)
export { DCEService } from './dce.service';
export type { DCEGenerationInput, DCEGenerationResult } from './dce.service';

// Entreprises et Qualifications
export { EntrepriseService } from './entreprise.service';
export type { EntrepriseMatchingInput, EntrepriseMatchingResult } from './entreprise.service';

// Offres et Analyse
export { OffreService } from './offre.service';
export type { OffreAnalysisInput, OffreAnalysisResult, TableauComparatifInput } from './offre.service';

// Contrats et Contractualisation
export { ContratService } from './contrat.service';
export type { ContratGenerationInput, ContratGenerationResult, SimulationTresorerieInput, SimulationTresorerieResult } from './contrat.service';

// Formalités Administratives
export { FormalitesService } from './formalites.service';
export type { FormalitesGenerationInput, FormalitesGenerationResult, FormulaireDICTInput } from './formalites.service';
