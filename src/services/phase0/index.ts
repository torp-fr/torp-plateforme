/**
 * Services Phase 0 - TORP
 * Export centralisé de tous les services de la phase de conception et définition
 */

// Service de gestion des projets Phase 0
export { Phase0ProjectService } from './project.service';
export type { Phase0ProjectRow, Phase0ProjectInsert, Phase0ProjectUpdate } from './project.service';

// Service de gestion du wizard
export { WizardService } from './wizard.service';
export type { WizardStepConfig, WizardQuestionConfig, WizardFieldConfig } from './wizard.service';

// Service de déduction automatique (IA)
export { DeductionService } from './deduction.service';
export type { GeoData, CadastreData, NaturalRisksData, AidsEligibility } from './deduction.service';

// Service de gestion des lots
export { LotService } from './lot.service';

// Service de validation
export { ValidationService } from './validation.service';
export type { ValidationLevel, ValidationSeverity } from './validation.service';

// Service d'estimation
export { EstimationService } from './estimation.service';
export type {
  ProjectEstimation,
  BudgetEstimation,
  LotBudgetEstimation,
  CategoryBudgetEstimation,
  FeesEstimation,
  DurationEstimation,
  PhaseEstimation,
  CriticalPathItem,
  EstimationFactor,
} from './estimation.service';

// Service de génération de documents
export { DocumentGeneratorService } from './documentGenerator.service';
export type {
  DocumentType,
  GeneratedDocument,
  DocumentContent,
  DocumentSection,
  DocumentAppendix,
  DocumentMetadata,
} from './documentGenerator.service';

// Service d'export PDF
export { PDFExportService } from './pdfExport.service';

// Services d'APIs externes
export {
  BANApiService,
  GeorisquesApiService,
  ADEMEApiService,
  CadastreApiService,
  PatrimoineApiService,
  ProjectEnrichmentService,
} from './external-api.service';
export type {
  BANSearchResult,
  BANReverseResult,
  GeorisquesResult,
  GeorisqueRisk,
  GeorisquePPRN,
  GeorisqueICPE,
  GeorisqueSIS,
  GeorisqueRadon,
  DPEResult,
  CadastreParcel,
  PatrimoineResult,
  PatrimoineProtection,
  PatrimoineMonument,
  EnrichmentResult,
} from './external-api.service';

// Ré-export des types principaux depuis les types Phase 0
export type {
  Phase0Project,
  Phase0Status,
  Phase0Summary,
  Phase0ValidationResult,
  Phase0FieldValidation,
  Phase0SectionCompleteness,
} from '@/types/phase0/project.types';

export type {
  MasterOwnerProfile,
  OwnerType,
  OwnerIdentity,
  OwnerContact,
  OwnerOwnership,
  OwnerExperience,
  OwnerFinancial,
} from '@/types/phase0/owner.types';

export type {
  Property,
  PropertyType,
  PropertyAddress,
  PropertyCharacteristics,
  PropertyConstruction,
  PropertyCondition,
  PropertyHeritage,
  PropertyDiagnostics,
} from '@/types/phase0/property.types';

export type {
  WorkProject,
  WorkType,
  WorkScope,
  WorkConstraints,
  WorkBudget,
  WorkQuality,
  WorkRegulatory,
} from '@/types/phase0/work-project.types';

export type {
  LotType,
  LotCategory,
  LotDefinition,
  LotPriority,
  SelectedLot,
  LotConfiguration,
} from '@/types/phase0/lots.types';

export { LOT_CATALOG } from '@/types/phase0/lots.types';
export { B2C_WIZARD_STEPS } from '@/types/phase0/wizard.types';
export { PHASE0_STATUS_CONFIG } from '@/types/phase0/project.types';

// =============================================================================
// NOUVEAUX SERVICES PHASE 0 - MODULES 0.3 à 0.6
// =============================================================================

// Service de diagnostic (Module 0.3)
export { DiagnosticService } from './diagnostic.service';
export type {
  DiagnosticAnalysisResult,
  DiagnosticRequirement,
  DiagnosticImpact,
} from './diagnostic.service';

// Service de faisabilité (Module 0.4)
export { FeasibilityService } from './feasibility.service';
export type {
  FeasibilityAnalysisInput,
  PermitDetermination,
  DTUAnalysis,
  FeasibilityScore,
} from './feasibility.service';

// Service CCTP (Module 0.5)
export { CCTPService } from './cctp.service';
export type {
  CCTPGenerationInput,
  CCTPLotGeneration,
  DPGFGenerationResult,
} from './cctp.service';

// Service Budget et Financement (Module 0.6)
export { BudgetService } from './budget.service';
export type {
  BudgetAnalysisInput,
  AidesCalculationInput,
  FinancingScenario,
} from './budget.service';

// Service de validation des lots (dépendances et incompatibilités)
export { LotValidationService } from './lot-validation.service';
export type {
  LotDependency,
  LotIncompatibility,
  ValidationResult,
  ValidationIssue,
  LotSuggestion,
} from './lot-validation.service';

// Export des configurations wizard B2G
export { WIZARD_STEPS_B2G } from './wizard.service';

// Re-export des types Phase 0 nouveaux modules
export type {
  // Types Diagnostic
  DiagnosticReport,
  DiagnosticUrgency,
  MandatoryDiagnosticsBundle,
  TechnicalDiagnosticsBundle,
  BuildingPathology,
  RiskMatrixEntry,
  DiagnosticRecommendation,
  ProjectImpactAssessment,
} from '@/types/phase0/diagnostic.types';

export type {
  // Types Faisabilité
  FeasibilityReport,
  FeasibilityStatus,
  PLUAnalysis,
  UrbanPermitsAnalysis,
  HeritageAnalysis,
  CondoConstraintsAnalysis,
  TechnicalStandardsAnalysis,
  FeasibilityIssue,
  FeasibilityRecommendation,
} from '@/types/phase0/feasibility.types';

export type {
  // Types CCTP
  CCTPDocument,
  CCTPStatus,
  CCTPLot,
  DPGF,
  WorksPlanning,
  MaterialSpecification,
  TechnicalPrescription,
  QualityRequirement,
} from '@/types/phase0/cctp.types';

export type {
  // Types Budget
  BudgetPlan,
  BudgetStatus,
  CostEstimation,
  FinancingPlan,
  FinancingSource,
  AidesAnalysis,
  AideEligibility,
  MaPrimeRenovAnalysis,
  EcoPTZAnalysis,
  CEEAnalysis,
  ROIAnalysis,
  CashFlowProjection,
} from '@/types/phase0/budget.types';
