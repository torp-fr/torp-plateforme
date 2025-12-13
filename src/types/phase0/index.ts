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

// =============================================================================
// TYPES DIAGNOSTICS DÉTAILLÉS (Module 0.3)
// =============================================================================
export type {
  // Rapport consolidé
  DiagnosticReport,
  DiagnosticUrgency,

  // Diagnostics obligatoires
  MandatoryDiagnosticsBundle,
  DPEDiagnosticDetailed,
  DiagnosticianInfo,
  EnergyConsumptionBreakdown,
  BuildingEnvelopeAssessment,
  InsulationAssessment,
  ThermalBridgeAssessment,
  ThermalBridgeType,
  AirTightnessAssessment,
  EquipmentEnergyAssessment,
  HeatingEquipmentAssessment,
  HeatingRegulationType,
  HotWaterEquipmentAssessment,
  VentilationEquipmentAssessment,
  CoolingEquipmentAssessment,
  RenewableEnergyDetail,
  DPEWorkRecommendation,
  DPEWorkCategory,
  DPEImprovementScenario,

  // Amiante
  AsbestosDiagnosticDetailed,
  AsbestosDiagnosticType,
  MPCAEntry,
  AsbestosMaterialType,
  AsbestosMaterialCondition,
  AsbestosAction,
  AsbestosZone,
  AsbestosWorksClassification,
  AsbestosRecommendation,

  // Plomb
  LeadDiagnosticDetailed,
  LeadDiagnosticUnit,
  LeadElement,
  LeadCondition,
  LeadDegradedSurface,
  LeadDegradationFactor,
  LeadRecommendation,
  LeadTreatmentTechnique,

  // Électricité
  ElectricityDiagnosticDetailed,
  ElectricalInstallationDetails,
  GroundingType,
  ElectricalAnomalyDetailed,
  ElectricalAnomalyCategory,
  ElectricalAnomalySeverity,
  ElectricalDangerType,
  ElectricalCheckpoint,
  ElectricalRecommendation,

  // Gaz
  GasDiagnosticDetailed,
  GasInstallationDetails,
  GasType,
  GasPipeMaterial,
  GasAnomalyDetailed,
  GasAnomalySeverity,
  GasDangerType,
  GasCheckpoint,
  GasRecommendation,

  // Termites
  TermiteDiagnosticDetailed,
  XylophageType,
  TermiteAffectedArea,
  WoodConditionEntry,
  TermiteTreatmentType,

  // ERP
  ERPDiagnosticDetailed,
  NaturalRiskDetailed,
  TechnologicalRiskDetailed,
  MiningRiskDetailed,
  MiningRiskType,
  RadonRiskDetailed,
  RadonZoneLevel,
  SoilPollutionDetailed,
  PreviousSinister,
  PreventionPlan,
  PreventionPlanType,
  ERPBuildingConstraint,

  // Carrez
  CarrezDiagnosticDetailed,
  CarrezRoomSurface,
  CarrezExclusion,
  CarrezExclusionReason,

  // Assainissement
  SepticTankDiagnosticDetailed,
  SepticInstallationType,
  SepticComplianceLevel,
  SepticCheckpoint,
  SepticIssue,

  // Diagnostics techniques
  TechnicalDiagnosticsBundle,
  SoilStudyDetailed,
  SoilStudyLevel,
  SeismicZone,
  ClayZone,
  SoilLayer,
  SoilCharacteristics,
  SettlementRisk,
  WaterTableDetails,
  FoundationRecommendation,
  FoundationAlternative,
  GeotechnicalRisk,
  GeotechnicalRiskType,

  // Structurel
  StructuralStudyDetailed,
  StructuralIntegrity,
  FoundationAnalysis,
  SettlementAssessment,
  WallAnalysis,
  CrackAssessment,
  CrackType,
  FloorAnalysis,
  RoofFrameworkAnalysis,
  DeformationAssessment,
  TimberCondition,
  StructuralPathology,
  StructuralPathologyType,
  LoadCapacityDetails,
  StructuralRecommendation,
  ReinforcementWork,
  ReinforcementMethod,

  // Humidité
  MoistureStudyDetailed,
  MoistureLevel,
  MoistureMeasurement,
  MoistureSource,
  MoistureSourceType,
  MoistureAffectedZone,
  MoistureDamage,
  MoistureDamageType,
  MoistureTreatment,
  MoistureTreatmentMethod,

  // Thermique
  ThermalStudyDetailed,
  ThermographyResults,
  ThermographyConditions,
  ThermographyImage,
  ThermographyFinding,
  ThermographyFindingType,
  AirTightnessTest,
  LeakageLocation,
  HeatLossAnalysis,
  HeatLossComponent,
  HeatLossZone,
  ThermalBridgeDetailed,
  ThermalImprovementScenario,
  ThermalWork,

  // Acoustique
  AcousticStudyDetailed,
  AcousticMeasurement,
  AcousticMeasurementType,
  AirborneInsulationAssessment,
  ImpactInsulationAssessment,
  EquipmentNoiseAssessment,
  AcousticRecommendation,

  // Accessibilité
  AccessibilityAuditDetailed,
  AccessibilityBuildingType,
  ERPCategory,
  AccessibilityComplianceLevel,
  AccessibilityZoneAnalysis,
  AccessibilityItem,
  AccessibilityNonCompliance,
  AccessibilityDerogation,
  DerogationReason,
  AccessibilityAction,

  // Photos
  PhotographicSurvey,
  ExteriorPhotoSurvey,
  FacadePhoto,
  InteriorPhotoSurvey,
  RoomPhotoSet,
  TechnicalPhotoSurvey,
  DefectPhotoSurvey,
  PhotoEntry,
  DefectPhoto,
  PhotoAIAnalysisResult,

  // Pathologies
  BuildingPathology,
  PathologyType,
  PathologyCategory,
  RiskMatrixEntry,

  // Recommandations
  DiagnosticRecommendation,
  ProjectImpactType,
  ProjectImpactAssessment,
  BlockingItem,
  MandatoryAddition,
  BudgetImpact,
  BudgetImpactItem,
  ScheduleImpact,
  ScheduleImpactItem,
  ScopeModification,
} from './diagnostic.types';

// =============================================================================
// TYPES FAISABILITÉ (Module 0.4)
// =============================================================================
export type {
  // Rapport global
  FeasibilityReport,
  FeasibilityStatus,

  // Analyse réglementaire
  RegulatoryAnalysis,
  UrbanPlanningAnalysis,
  UrbanPlanningDocument,
  UrbanPlanningDocumentType,
  PLUZone,
  PLUZoneType,
  PLURules as FeasibilityPLURules,
  OccupationRule,
  AccessRule,
  NetworkRule,
  RainwaterManagementRule,
  SetbackRule as FeasibilitySetbackRule,
  SetbackException,
  GroundCoverageRule,
  HeightRule,
  HeightCalculationMethod,
  HeightException,
  AestheticRules,
  RoofTypeRule,
  RoofSlopeRule,
  MaterialRule,
  ColorRule,
  ColorSpec,
  ShutterTypeRule,
  FenceHeightRule,
  SolarPanelRule,
  ACUnitRule,
  AntennaRule,
  ParkingRules,
  ParkingRequirement,
  BicycleParkingRequirement,
  GreenSpaceRules,
  TreeRequirement,
  DensityBonus,
  DensityBonusType,
  PLUComplianceAnalysis,
  ComplianceStatus,
  PLUComplianceItem,
  ProjectModification,
  PLUDerogation,
  DerogationType,

  // Autorisations
  UrbanPermitsAnalysis,
  UrbanPermitType,
  PermitDetermination,
  PermitCriterion,
  PermitExemption,
  PermitProcedure,
  ConsultationRequired,
  ConsultingAuthority as FeasibilityConsultingAuthority,
  PublicInquiryInfo,
  PermitDocument,
  DocumentFormat as FeasibilityDocumentFormat,
  PermitTimeline,
  UrbanTaxes,
  TaxeAmenagement,
  TaxExemption,
  TaxReduction,
  PaymentSchedule as TaxPaymentSchedule,
  RedevanceArcheologie,
  ParticipationVRD,

  // Patrimoine
  HeritageConstraintsAnalysis,
  HeritageProtectionType,
  HeritageConstraint as FeasibilityHeritageConstraint,
  HeritageConstraintType as FeasibilityHeritageConstraintType,
  ABFConsultation,
  ABFConsultationType,
  ABFContactInfo,
  AllowedIntervention,
  ForbiddenIntervention,

  // Servitudes
  EasementsAnalysis,
  Easement,
  EasementType,
  EasementImpact,

  // Environnement
  EnvironmentalConstraintsAnalysis,
  NaturalZoneConstraint,
  NaturalZoneType,
  WaterConstraint,
  WaterConstraintType,
  BiodiversityConstraint,
  EnvironmentalAuthorization,

  // Analyse technique
  TechnicalAnalysis,
  StructuralFeasibility,
  StructuralCapacityAssessment,
  FoundationRequirements,
  StructuralModificationFeasibility,
  NetworkConnectionsAnalysis,
  NetworkConnectionStatus,
  SiteAccessAnalysis,
  VehicleAccessAssessment,
  MaterialDeliveryAssessment,
  EquipmentAccessAssessment,
  StorageAreaAssessment,
  TechnicalConstraint,
  TechnicalConstraintType,

  // Copropriété
  CondoConstraintsAnalysis,
  CondoType,
  CondoRulesAnalysis,
  CondoRestriction,
  CondoRestrictionType,
  CommonPartAffected,
  CommonPartType,
  VoteMajority,
  CondoApproval,
  CondoTimeline,
  CondoRisk,

  // Voisinage
  NeighborhoodConstraints as FeasibilityNeighborhoodConstraints,
  PartyWallConstraint,
  PartyWallStatus,
  ViewRightConstraint,
  ViewRightType,
  NeighborEasement,
  PlantationDistance,
  NeighborAuthorization,

  // Accessibilité PMR/ERP
  AccessibilityRequirements as FeasibilityAccessibilityRequirements,
  AccessibilityClassification,
  AccessibilityRegulation,
  AccessibilityRequirement as FeasibilityAccessibilityRequirement,
  AccessibilityCategory,
  AccessibilityComplianceStatus,
  AccessibilityWork,
  AccessibilityDerogation as FeasibilityAccessibilityDerogation,
  CommissionConsultation,

  // Normes techniques
  TechnicalStandardsAnalysis,
  ThermalRegulationAnalysis,
  ThermalRegulationType,
  ThermalRequirement as FeasibilityThermalRequirement,
  ThermalIndicator,
  ThermalAttestation,
  ThermalAttestationType,
  ElectricalStandardsAnalysis,
  ElectricalNormRequirement,
  ElectricalNormCategory,
  GasStandardsAnalysis,
  GasNormRequirement,
  SanitationStandardsAnalysis,
  SanitationRequirement,
  FireSecurityAnalysis,
  FireSecurityBuildingType,
  FireSecurityRequirement,
  FireSecurityCategory,
  ApplicableDTU as FeasibilityApplicableDTU,

  // Check-list
  RegulatoryChecklistItem,
  ChecklistCategory,
  ChecklistItemStatus,
  RequiredAuthorization,
  AuthorizationType,
  AuthorizationStatus,

  // Risques
  FeasibilityRisk,
  RiskCategory,
  FeasibilityRecommendation,

  // Dossier administratif
  AdministrativeDocumentPreparation,
  CERFAFormPreparation,
  DocumentPreparationStatus,
  PrefilledField,
  MissingField as AdminMissingField,
  RegulatoryPlanPreparation,
  RegulatoryPlanType,
  DescriptiveNoticePreparation,
  NoticeSection,
  OtherDocumentPreparation,
} from './feasibility.types';

// =============================================================================
// TYPES CCTP (Module 0.5)
// =============================================================================
export type {
  // Document principal
  CCTPDocument,
  CCTPMetadata,
  CCTPStatus,
  CCTPFormat,

  // Article 1 - Objet
  MarketObject,
  ClientInfo,
  MarketType,

  // Article 2 - Description
  GeneralDescription,
  ProjectContext,
  OccupancyDuringWorks,
  WorksNature,
  ProjectType as CCTPProjectType,
  WorkCategory as CCTPWorkCategory,
  AllotmentType,
  LotSummary,
  GeneralConstraints,
  WorkingHours,
  SiteAccessConstraints,
  ProtectionRequirements,
  ProtectionDetail,
  WasteManagementRequirements,
  WasteCategory,
  WasteType,
  SecurityRequirements,
  EnvironmentalRequirements,

  // Article 3 - Lots
  CCTPLot,
  LotScope,
  WorkItem,
  ExcludedWork,
  WorkLocation,
  QuantityItem,
  QuantityUnit,

  // Spécifications matériaux
  MaterialSpecification,
  MaterialCategory as CCTPMaterialCategory,
  MaterialStandard,
  TechnicalCharacteristic,
  MaterialDimensions,
  DimensionSpec,
  MaterialFinish,
  CertificationType,
  MaterialCertification,
  EquivalencePolicy,
  ReferenceBrand,
  MaterialPrice,

  // Mode opératoire
  OperatingProcedure,
  OperatingPhase,
  OperatingStep,
  WeatherConditions,
  ResourceRequirement,
  QualityCheckpoint as CCTPQualityCheckpoint,

  // Normes
  ApplicableStandard,
  StandardType,

  // Contrôles
  QualityControlRequirements,
  HoldPoint,
  RequiredTest,
  TestFrequency,
  AcceptanceCriterion,
  ToleranceSpec,
  ReceptionProcedure,
  ReceptionStage,
  ReservationHandling,

  // Garanties
  WarrantyRequirement,
  WarrantyType,

  // Interfaces
  LotInterface,

  // Article 4 - Documents entreprise
  ContractorDocumentRequirements,
  BeforeStartDocuments,
  DuringWorksDocuments,
  CompletionDocuments,
  ContractorDocument,

  // Article 5 - Délais
  SchedulingRequirements,
  ProvisionalDates,
  Milestone,
  ExecutionDuration,
  ProjectPhase as CCTPProjectPhase,
  PenaltyClause,
  PenaltyType,
  ExtensionCondition,
  ExtensionCause,

  // Article 6 - Finances
  FinancialConditions,
  ContractAmount,
  PaymentTerms,
  PaymentMilestone as CCTPPaymentMilestone,
  AdvancePayment,
  PriceRevision,
  PriceIndex,
  RetentionGuarantee,

  // Article 7 - Clauses
  SpecialClauses,
  InsuranceRequirements,
  InsuranceRequirement as CCTPInsuranceRequirement,
  SubcontractingRules,
  IntellectualPropertyClause,
  ConfidentialityClause,
  DisputeResolutionClause,
  EnvironmentalClause,
  SocialClause,

  // Annexes
  CCTPAppendix,
  AppendixType,

  // Génération
  CCTPGenerationInfo,
  HighlightedSection,
  CCTPWarning,

  // Bibliothèque
  MaterialLibrary,
  MaterialLibraryCategory,
  MaterialLibrarySubcategory,
  MaterialLibraryItem,

  // DPGF
  DPGF,
  DPGFHeader,
  DPGFLot,
  DPGFItem,
  DPGFTotals,
  DPGFMetadata,

  // Planning
  WorksPlanning,
  PlanningParameters,
  PlanningPhase,
  CriticalPathItem,
  PlanningMilestone,
  ResourcePlanning,
  LaborResource,
  EquipmentResource,
  MaterialDelivery,
} from './cctp.types';

// =============================================================================
// TYPES BUDGET ET FINANCEMENT (Module 0.6)
// =============================================================================
export type {
  // Plan budgétaire
  BudgetPlan,
  BudgetSummary,
  BudgetStatus,

  // Estimation coûts
  DetailedCostEstimation,
  DirectCosts,
  LotCost,
  WorksCostCategory,
  CostBreakdown,
  CostItem,
  CostEstimationMethod,
  EstimationMethod,

  // Coûts indirects
  IndirectCosts,
  DesignCosts,
  DesignCostItem,
  DesignServiceType,
  DesignFeeBasis,
  AdministrativeCosts,
  AdministrativeCostItem,
  AdministrativeServiceType,
  InspectionCosts,
  InspectionCostItem,
  InspectionType,
  InsuranceCosts,
  InsuranceCostItem,
  InsuranceType,
  InsuranceBasis,
  ConnectionCosts,
  ConnectionCostItem,
  ConnectionType,
  TaxCosts,
  TaxCostItem,
  TaxType,
  TaxCalculationDetail,
  TaxExemptionDetail,
  TaxReductionDetail,
  MiscellaneousCosts,
  MiscellaneousCostItem,
  MiscellaneousCostType,

  // Aléas
  ContingencyProvision,
  ContingencyRationale,
  ContingencyRiskLevel,
  ContingencyFactor,
  ContingencyBreakdown,

  // TVA
  VATCalculation,
  VATDetail,
  VATRate,

  // Financement
  FinancingPlan,
  FinancingSource,
  FinancingType,
  FinancingStatus,
  FinancingDetails,
  PersonalFundsDetails,
  LoanDetails,
  AidDetails,
  DisbursementTiming,
  TaxBenefitDetails,
  TaxMechanism,
  FinancingSummary,
  FinancingFeasibility,
  FinancingWarning,
  FinancingRecommendation,

  // Aides
  AidesAnalysis,
  EligibilityProfile,
  IncomeCategory,
  EligibleAide,
  AideType as BudgetAideType,
  EligibilityCondition,
  ApplicationProcedure,
  ApplicationStep,
  AideTiming,
  IneligibleAide,
  AideOptimization,

  // MaPrimeRénov'
  MaPrimeRenovAnalysis,
  MaPrimeRenovParcours,
  MaPrimeRenovDetails,
  MaPrimeRenovGeste,
  MaPrimeRenovWorkType,
  MaPrimeRenovAccompagne,
  MaPrimeRenovBonus,
  MaPrimeRenovBonusType,

  // Éco-PTZ
  EcoPTZAnalysis,
  EcoPTZVersion,
  EcoPTZWorkCategory,

  // CEE
  CEEAnalysis,
  CEEOperation,
  CEEOperator,

  // Aides locales
  LocalAidesAnalysis,
  LocalAide,

  // Trésorerie
  CashFlowPlan,
  CashFlowParameters,
  ExpenditureItem,
  ExpenditureCategory,
  PaymentType,
  IncomeItem,
  MonthlyFlow,
  TreasuryNeeds,
  CashFlowOptimization,

  // Optimisations
  BudgetOptimization,
  OptimizationType,
  FinancialRisk,
  FinancialRiskType,

  // ROI
  ROIAnalysis,
  ROIProjectType,
  ROIGain,
  ROIGainType,
  PropertyValueIncrease,
  YearlyProjection,

  // Comparateur
  LoanComparator,
  LoanOffer,
  ComparisonCriterion,
} from './budget.types';

// =============================================================================
// TYPES PIÈCES ET TRAVAUX PAR ZONE (Module Travaux par Pièce)
// =============================================================================
export type {
  // Définition pièce avec travaux
  RoomWorkDefinition,
  RoomInfo,

  // Travaux par pièce
  RoomWork,
  RoomWorkCategory,
  RoomWorkType,
  WorkSpecifications,
  MaterialPreference,
  FinishLevel,
  WorkPriority,
  RoomWorkStatus,
  WorkEstimate,

  // Photos
  RoomPhoto,
  RoomPhotoType,
  PhotoViewAngle,
  PhotoPosition,
  PhotoAnnotation,
  PhotoQuality,

  // Notes
  RoomNote,
  RoomNoteType,
  NoteImportance,

  // État
  RoomState,
  RoomIssue,
  IssueType,
  IssueSeverity,

  // Estimation par pièce
  RoomEstimate,
  RoomCostBreakdown,

  // Configuration
  RoomTypeConfig,
} from './rooms.types';

export {
  ROOM_TYPE_CONFIGS,
  ROOM_WORK_CATEGORY_LABELS,
  ROOM_WORK_TYPE_LABELS,
  FINISH_LEVEL_LABELS,
  WORK_PRIORITY_LABELS,
} from './rooms.types';
