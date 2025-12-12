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

// Service de pré-remplissage utilisateur/entreprise
export { userProfileService } from './user-profile.service';
export type { UserCompanyData, PrefilledOwnerProfile, B2BProviderContext } from './user-profile.service';

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
