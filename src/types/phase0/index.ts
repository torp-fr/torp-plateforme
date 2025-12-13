/**
 * TORP Phase 0 - Export Central des Types
 * Tous les types nécessaires pour la Phase 0 (Conception & Définition)
 */

// =============================================================================
// TYPES COMMUNS
// =============================================================================
export type {
  // Métadonnées
  TORPMetadata,
  DataSource,

  // Contact
  ContactInfo,
  AvailableHours,
  TimeSlot,

  // Adresse et géolocalisation
  Address,
  StreetType,
  Coordinates,
  CadastralReference,

  // Documents
  DocumentReference,
  DocumentType,

  // Énumérations communes
  ConfidenceLevel,
  Priority,
  ValidationStatus,
  ValidationResult,
  ValidationError,
  ValidationWarning,
  ValidationSuggestion,

  // Alertes
  Phase0Alert,
  AlertType,
  AlertSeverity,

  // Estimations
  EstimationRange,
  ScoringCriterion,
} from './common.types';

// =============================================================================
// TYPES MAÎTRE D'OUVRAGE
// =============================================================================
export type {
  // Profil principal
  MasterOwnerProfile,

  // Identité
  OwnerType,
  OwnerIdentity,
  IndividualIdentity,
  CompanyIdentity,
  PublicEntityIdentity,
  Civility,
  MaritalStatus,
  LegalForm,
  CompanySize,
  CollectivityType,

  // Statut de propriétaire
  OwnerStatus,
  PropertyOwnershipStatus,
  OwnershipType,
  CoOwner,
  OccupancyStatus,
  TenantInfo,
  LeaseType,
  ManagementMode,

  // Expérience et expertise
  ProjectExperience,
  PreviousProjectType,
  ProjectIssue,
  CommunicationMethod,
  ExpertiseLevel,
  ExpertiseTier,
  AssistanceNeed,
  ProfessionalBackground,

  // Profil psychologique
  PsychologicalProfile,
  DecisionStyle,
  RiskTolerance,
  PriorityFactor,
  CommunicationPreference,
  StressFactor,
  ProjectMotivation,
  DealBreaker,

  // Capacité financière
  FinancialCapacity,
  BudgetEnvelope,
  BudgetFlexibility,
  FinancialSituation,
  FundingSource,
  FundingType,
  FundingStatus,
  EligibleAid,
  AidType,
  AidStatus,
  CreditCapacity,
  InvestmentHorizon,

  // Disponibilité
  Availability,
  ProjectTimeframe,
  Season,
  UrgencyLevel,
  PresenceConstraints,
  PresenceFrequency,
  ProximityLevel,
  MeetingMode,
  DecisionSpeed,
  MeetingAvailability,
  Day,
  TimeSlotPreference,
  BlackoutPeriod,
} from './owner.types';

// =============================================================================
// TYPES BIEN IMMOBILIER
// =============================================================================
export type {
  // Bien principal
  Property,

  // Identification
  PropertyIdentification,
  PropertyType,
  PropertySubType,
  CadastralParcel,

  // Caractéristiques
  PropertyCharacteristics,
  PropertySurfaces,
  LevelConfiguration,
  LevelDetail,
  BasementType,
  RoomConfiguration,
  KitchenType,
  RoomDetail,
  RoomType,
  OutdoorSpaces,
  GardenType,
  PoolType,
  TerraceType,
  FencingType,
  LandscapingLevel,
  ParkingInfo,
  ParkingType,
  GarageType,
  Orientation,
  CardinalDirection,
  SunlightQuality,
  ViewQuality,

  // Construction
  ConstructionDetails,
  ConstructionPeriod,
  ArchitecturalStyle,
  StructureDetails,
  StructureType,
  FoundationType,
  WallConstruction,
  WallMaterial,
  FloorConstruction,
  LoadBearingWallInfo,
  StructuralIssue,
  RoofingDetails,
  RoofType,
  RoofShape,
  RoofCovering,
  RoofFramework,
  GutterMaterial,
  FacadeDetails,
  FacadeType,
  FacadeCoating,
  FacadeIssue,
  OpeningsDetails,
  WindowMaterial,
  WindowType,
  GlazingType,
  DoorMaterial,
  SecurityLevel,
  ShutterType,
  ShutterMaterial,
  InsulationInfo,
  InsulationType,
  InsulationMaterial,
  MajorRenovation,
  RenovationType,

  // État actuel
  ConditionGrade,
  CurrentCondition,
  UrgentRepair,

  // Patrimoine
  HeritageStatus,
  ProtectionType,
  ProtectionLevel,
  ProtectedZoneType,
  HeritageConstraint,
  HeritageConstraintType,

  // Diagnostics
  DiagnosticsBundle,
  BaseDiagnostic,
  DPEDiagnostic,
  EnergyClass,
  PrimaryEnergy,
  DPERecommendation,
  AsbestosDiagnostic,
  AsbestosRiskLevel,
  AsbestosLocation,
  LeadDiagnostic,
  LeadRiskLevel,
  LeadLocation,
  ElectricityDiagnostic,
  ElectricalAnomaly,
  GasDiagnostic,
  GasAnomaly,
  TermiteDiagnostic,
  InfestationLevel,
  ERPDiagnostic,
  NaturalRisk,
  NaturalRiskType,
  TechnologicalRisk,
  TechnologicalRiskType,
  RadonLevel,
  MeruleDiagnostic,
  NoiseDiagnostic,
  NoiseZone,
  SanitationDiagnostic,
  SanitationType,
  StructuralStudy,
  LoadCapacityInfo,
  StructuralWork,
  SoilStudy,
  SoilType,
  WaterTableInfo,
  OtherDiagnostic,

  // Sinistres
  SinisterHistory,
  Sinister,
  SinisterType,
  OpenClaim,
  CatNatEvent,

  // Équipements
  EquipmentsBundle,
  HeatingSystem,
  HeatingType,
  HeatingDistribution,
  HeatingEmitter,
  EmitterType,
  ThermostatType,
  HotWaterSystem,
  HotWaterType,
  VentilationSystem,
  VentilationType,
  ElectricalSystem,
  ElectricalPanelType,
  RCDType,
  ElectricalNetworkType,
  PlumbingSystem,
  WaterSource,
  WaterHardness,
  PipeMaterial,
  DrainMaterial,
  SepticTankInfo,
  AirConditioningSystem,
  ACType,
  RenewableEnergy,
  RenewableType,
  SecuritySystem,
  AlarmType,
  ComfortEquipment,
  ComfortEquipmentType,

  // Environnement
  EnvironmentContext,
  UrbanContext,
  UrbanZoneType,
  DensityLevel,
  BuildingRights,
  Setback,
  AccessibilityLevel,
  PublicTransportAccess,
  LocalInfrastructure,
  ConnectionDistances,
  NuisanceAssessment,
  NuisanceLevel,
  ClimateContext,
  ClimateZone,
  ExposureLevel,
  PrecipitationLevel,
  RiskLevel,
  NeighborhoodRelations,
  SharedStructure,

  // Copropriété
  CondoInfo,
  CondoDecision,
  CondoDecisionType,
  CondoWork,
  CondoFinancialHealth,

  // Photos
  PropertyPhoto,
  PhotoType,
  PhotoAIAnalysis,
} from './property.types';

// =============================================================================
// TYPES PROJET DE TRAVAUX
// =============================================================================
export type {
  // Projet principal
  WorkProject,

  // Informations générales
  ProjectGeneral,
  ProjectType,
  ProjectSubType,
  ProjectObjective,
  ObjectiveType,
  // Note: ProjectMotivation est déjà exporté depuis owner.types

  // Périmètre
  ProjectScope,
  WorkCategory,
  AffectedArea,
  WorksIntensity,
  SurfaceImpact,
  ProjectExclusion,
  ProjectOption,
  ProjectPhase,
  DurationEstimate,

  // Contraintes
  ProjectConstraints,
  TemporalConstraints,
  // Note: BlackoutPeriod est déjà exporté depuis owner.types
  SeasonalConstraint,
  EventDeadline,
  FlexibilityLevel,
  OccupancyConstraints,
  OccupancyDuringWorks,
  VulnerablePerson,
  PetInfo,
  AccessRestriction,
  PhysicalConstraints,
  SiteAccess,
  AccessQuality,
  VehicleSize,
  KeyHandoverMethod,
  StorageCapacity,
  ParkingAvailability,
  NeighboringStructure,
  GroundConditions,
  UtilityConstraint,
  TechnicalConstraints,
  HeightRestriction,
  LoadRestriction,
  AcousticRequirement,
  ThermalRequirement,
  AccessibilityRequirement,
  SpecialRequirement,
  NeighborhoodConstraints,
  WorkingHoursRestriction,
  OtherConstraints,
  InsuranceRequirement,
  ContractorPreference,
  MaterialPreference,

  // Réglementaire
  RegulatoryContext,
  UrbanPlanningContext,
  PLURules,
  SetbackRule,
  SpecialZone,
  SpecialZoneType,
  Servitude,
  ServitudeType,
  BuildingPermitRequirements,
  PermitType,
  RequiredDocument,
  DocumentStatus,
  PermitStatus,
  TechnicalRegulations,
  ApplicableDTU,
  ApplicableNorm,
  RTVersion,
  AccessibilityNorm,
  FireRegulation,
  AsbestosRegulation,
  EnvironmentalRegulations,
  AdministrativeProcedure,
  ProcedureStatus,
  RequiredConsultation,
  ConsultationAuthority,
  ConsultationStatus,
  ConsultationResponse,

  // Budget
  BudgetInfo,
  // Note: BudgetEnvelope est déjà exporté depuis owner.types
  BudgetBreakdown,
  CategoryBudget,
  LotBudget,
  AlternativeBudget,
  AdditionalCost,
  AdditionalCostType,
  FundingPlan,
  // Note: FundingSource, AidType, etc. déjà exportés
  ContingencyPlan,
  RiskAssessment,
  MitigationStrategy,
  PaymentSchedule,
  PaymentScheduleType,
  PaymentMilestone,
  CostControlStrategy,
  CostControlMethod,

  // Planification
  ProjectPlanning,
  ProjectTimeline,
  ProjectMilestone,
  MilestoneType,
  MilestoneStatus,
  PlanningDependency,
  DependencyType,
  PlanningBuffer,

  // Qualité
  QualityExpectations,
  QualityLevel,
  FinishingLevel,
  MaterialQualityLevel,
  WorkmanshipLevel,
  SpecificExpectation,
  QualityReference,
  QualityControlPlan,
  QualityCheckpoint,

  // Intervenants
  Stakeholders,
  OwnerStakeholder,
  ContactPerson,
  ArchitectStakeholder,
  ArchitectMission,
  FeeStructure,
  EngineerStakeholder,
  EngineerType,
  ContractorRequirement,
  ContractType,
  SelectionCriterion,
  CoordinatorStakeholder,
  ControlBureauStakeholder,
  ControlMission,
  OtherStakeholder,
} from './work-project.types';

// =============================================================================
// TYPES LOTS BTP
// =============================================================================
export type {
  // Lot principal
  WorkLot,

  // Catégories
  LotCategory,
  LotCategoryInfo,
  LotType,
  LotDefinition,
  PriceRange,
  PriceUnit,
  DurationRange,
  ComplexityLevel,

  // Questions
  QualificationQuestion,
  QuestionType,
  QuestionOption,
  PriceImpact,
  QuestionValidation,
  ConditionalDisplay,
  AIAssistConfig,
  AIAssistType,

  // Réponses
  LotResponse,
  ResponseValue,
  DimensionValue,
  FileValue,
  MaterialSelection,
  ResponseSource,

  // Schéma de données
  LotDataSchema,
  SurfaceSchema,
  DetailedSurface,
  QuantitySchema,
  QuantityItem,
  MaterialSchema,
  MaterialCategory,
  SelectedMaterial,
  EquipmentSchema,
  EquipmentItem,
  LaborSchema,
  TradeLabor,
  SpecificationSchema,
  TechnicalSpec,
  PerformanceSpec,
  AestheticSpec,

  // Options
  LotOption,
  OptionType,
  QualityImpact,
  OptionRecommendation,

  // Réglementations
  LotRegulation,
  RegulationType,
  RegulationRequirement,

  // Estimation
  LotEstimation,
  EstimationBreakdown,
  VATBreakdown,
  CalculationMethod,
  MarketComparison,
} from './lots.types';

export { LOT_CATEGORIES, LOT_CATALOG, getLotsByCategory, getLotByType, getLotsRGEEligible, getLotsWithAides } from './lots.types';

// =============================================================================
// TYPES WIZARD
// =============================================================================
export type {
  // Configuration
  WizardConfig,
  WizardMode,
  SaveMode,
  ValidationMode,

  // Étapes
  WizardStep,
  WizardSection,
  StepCondition,
  SectionCondition,
  ConditionOperator,
  ConditionValue,
  StepValidation,
  ValidationConfig,
  CrossFieldRule,
  CompletionCriteria,
  HelpContent,
  FAQ,

  // Questions
  WizardQuestion,
  QuestionValue,
  QuestionCondition,
  AIAssistance,
  AITrigger,
  DataBinding,
  UIConfig,

  // Valeurs spéciales
  FileUploadValue,
  AddressValue,
  DateRangeValue,
  BudgetValue,

  // Logique conditionnelle
  ConditionalRule,
  Condition,
  ConditionalAction,
  ActionType,

  // État
  WizardState,
  WizardAnswers,
  WizardAnswer,
  AnswerSource,
  AIDeduction,
  // Note: ValidationError déjà exporté depuis common.types
  WizardProgress,
  StepProgress,
  StepStatus,
  WizardMetadata,

  // Configuration B2C
  WizardStepConfig,

  // Sélecteur de lots
  LotSelectorState,
  LotSelectorItem,
  SuggestedLot,
  LotDependency,
  LotIncompatibility,
  LotEstimateTotal,

  // Événements
  WizardEvent,
  WizardEventLog,
} from './wizard.types';

export { B2C_WIZARD_STEPS } from './wizard.types';

// =============================================================================
// TYPES DÉDUCTION
// =============================================================================
export type {
  // Règles
  DeductionRule,
  DeductionCategory,
  DeductionTrigger,
  TriggerType,
  TriggerEvent,
  DeductionCondition,
  ConditionType,
  // Note: ConditionOperator et ConditionValue déjà exportés
  DeductionAction,
  // Note: ActionType déjà exporté
  DeductionValue,
  DeductionTransform,
  TransformType,
  DeductionSource,

  // API externe
  ExternalApiConfig,
  ExternalApiId,

  // Prompt IA
  AIPromptConfig,
  AIModel,

  // Résultats
  DeductionResult,
  DeductionStatus,
  DeducedData,
  UserDeductionAction,
  DeductionError,
  DeductionErrorCode,

  // Règles prédéfinies
  DeductionRuleDefinition,

  // Moteur
  DeductionEngineConfig,
  RetryPolicy,
  DeductionEngineState,
  DeductionStatistics,
  CategoryStats,
  SourceStats,

  // Suggestions lots
  LotSuggestion,
  SuggestionReason,
} from './deduction.types';

export { PREDEFINED_RULES } from './deduction.types';

// =============================================================================
// TYPES PROJET PHASE 0
// =============================================================================
export type {
  // Projet principal
  Phase0Project,

  // Statuts
  Phase0Status,
  StatusConfig,

  // Complétude
  Phase0Completeness,
  SectionCompleteness,
  MissingField,
  Improvement,
  ImprovementType,

  // Validation
  Phase0Validation,
  ValidationMethod,
  ValidationCheck,
  ValidationCategory,
  CheckStatus,
  ValidationScore,
  ValidationGrade,

  // Documents générés
  GeneratedDocument,
  GeneratedDocumentType,
  DocumentGenerationStatus,
  DocumentFormat,
  DocumentMetadata,

  // Résumé
  Phase0Summary,

  // Actions
  Phase0Action,
  CreateProjectPayload,
  UpdateProjectPayload,
  ChangeStatusPayload,
  ValidateProjectPayload,
  GenerateDocumentPayload,
  ArchiveProjectPayload,
  DuplicateProjectPayload,

  // Filtres
  Phase0ProjectFilter,
  Phase0SortField,
  Phase0ProjectList,
} from './project.types';

export { PHASE0_STATUS_CONFIG } from './project.types';

// =============================================================================
// TYPES CLIENT B2B (Maître d'Ouvrage / Donneur d'ordres)
// =============================================================================
export type {
  // Profil client
  ClientProfile,
  ClientType,
  ClientIdentity,
  ClientContact,

  // Site d'intervention
  InterventionSite,
  SiteType,
  SiteCharacteristics,
  AccessConstraints,
  SiteOccupancy,

  // Contexte intervention
  InterventionContext,
  B2BProjectType,
  RequestNature,
  LeadSource,
  ClientBudget,
  ProjectTimeline,
  ClientDocument,
  ClientDocumentType,

  // Métadonnées
  ClientMetadata,

  // Analyse contextuelle
  ClientAnalysis,
  InferredClientProfile,
  IdentifiedRisk,
  SuggestedDocument,
} from './client.types';
