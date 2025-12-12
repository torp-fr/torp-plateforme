/**
 * TORP Phase 0 - Types du Projet de Travaux
 * Module 0.4 : Faisabilité Technique & Réglementaire
 * Module 0.5 : Programme Détaillé des Travaux
 * Module 0.6 : Budget et Financement
 */

import type {
  TORPMetadata,
  Address,
  DocumentReference,
  ConfidenceLevel,
  EstimationRange,
  Phase0Alert,
  ScoringCriterion,
  Priority,
} from './common.types';
import type { ConditionGrade, PrimaryEnergy, EnergyClass } from './property.types';

// =============================================================================
// PROJET DE TRAVAUX PRINCIPAL
// =============================================================================

export interface WorkProject {
  id: string;
  general: ProjectGeneral;
  scope: ProjectScope;
  constraints: ProjectConstraints;
  regulatory: RegulatoryContext;
  budget: BudgetInfo;
  planning: ProjectPlanning;
  qualityExpectations: QualityExpectations;
  stakeholders: Stakeholders;
  documents: DocumentReference[];
  alerts: Phase0Alert[];
  torpMetadata: TORPMetadata;
}

// =============================================================================
// INFORMATIONS GÉNÉRALES DU PROJET
// =============================================================================

export interface ProjectGeneral {
  name: string;
  description: string;
  projectType: ProjectType;
  projectSubType?: ProjectSubType;
  objectives: ProjectObjective[];
  primaryMotivation: ProjectMotivation;
  secondaryMotivations: ProjectMotivation[];
  urgencyReason?: string;
  contextNotes?: string;
}

export type ProjectType =
  | 'new_construction'    // Construction neuve
  | 'extension'           // Extension
  | 'elevation'           // Surélévation
  | 'heavy_renovation'    // Rénovation lourde
  | 'renovation'          // Rénovation
  | 'refurbishment'       // Rafraîchissement
  | 'energy_renovation'   // Rénovation énergétique
  | 'maintenance'         // Entretien / Réparation
  | 'conversion'          // Changement d'usage
  | 'division'            // Division
  | 'demolition'          // Démolition
  | 'landscaping';        // Aménagement extérieur

export type ProjectSubType =
  // Extensions
  | 'ground_extension'
  | 'side_extension'
  | 'rear_extension'
  | 'conservatory'
  | 'veranda'
  // Surélévations
  | 'full_elevation'
  | 'partial_elevation'
  | 'attic_conversion'
  | 'roof_modification'
  // Rénovations
  | 'full_renovation'
  | 'partial_renovation'
  | 'bathroom_renovation'
  | 'kitchen_renovation'
  | 'facade_renovation'
  | 'roof_renovation'
  // Énergétiques
  | 'insulation_only'
  | 'heating_change'
  | 'global_energy'
  // Conversions
  | 'residential_to_commercial'
  | 'commercial_to_residential'
  | 'garage_conversion'
  | 'barn_conversion'
  // Extérieurs
  | 'pool_construction'
  | 'garden_design'
  | 'terrace_creation'
  | 'driveway_construction';

export interface ProjectObjective {
  type: ObjectiveType;
  description: string;
  priority: Priority;
  measurable?: boolean;
  targetValue?: string;
  currentValue?: string;
}

export type ObjectiveType =
  | 'comfort'             // Amélioration du confort
  | 'energy_saving'       // Économies d'énergie
  | 'dpe_improvement'     // Amélioration DPE
  | 'space_creation'      // Création d'espace
  | 'accessibility'       // Accessibilité PMR
  | 'modernization'       // Modernisation
  | 'compliance'          // Mise aux normes
  | 'value_increase'      // Plus-value immobilière
  | 'rental_yield'        // Rendement locatif
  | 'family_adaptation'   // Adaptation familiale
  | 'aesthetic'           // Esthétique
  | 'security'            // Sécurité
  | 'sustainability'      // Développement durable
  | 'maintenance';        // Entretien préventif

export type ProjectMotivation =
  | 'comfort_improvement'
  | 'energy_cost_reduction'
  | 'value_increase'
  | 'space_need'
  | 'family_change'
  | 'aging_in_place'
  | 'rental_preparation'
  | 'sale_preparation'
  | 'regulatory_compliance'
  | 'repair_necessity'
  | 'lifestyle_change'
  | 'work_from_home'
  | 'environmental_concern';

// =============================================================================
// PÉRIMÈTRE DU PROJET
// =============================================================================

export interface ProjectScope {
  descriptionDetailed: string;
  worksCategories: WorkCategory[];
  affectedAreas: AffectedArea[];
  surfaceImpact: SurfaceImpact;
  selectedLotIds: string[];
  exclusions?: ProjectExclusion[];
  options?: ProjectOption[];
  phases?: ProjectPhase[];
}

export type WorkCategory =
  | 'structural'          // Structure / Gros œuvre
  | 'envelope'            // Enveloppe (toiture, façade, menuiseries)
  | 'partitioning'        // Cloisonnement / Aménagement intérieur
  | 'finishing'           // Second œuvre / Finitions
  | 'electrical'          // Électricité
  | 'plumbing'            // Plomberie
  | 'hvac'                // CVC (Chauffage, Ventilation, Climatisation)
  | 'insulation'          // Isolation
  | 'exterior'            // Extérieurs / VRD
  | 'special';            // Lots spéciaux

export interface AffectedArea {
  name: string;
  level: number;
  surface: number;
  currentUse?: string;
  futureUse?: string;
  worksType: WorksIntensity;
  specificWorks?: string[];
}

export type WorksIntensity =
  | 'none'                // Pas de travaux
  | 'light'               // Travaux légers (peinture, sol)
  | 'medium'              // Travaux moyens (modification cloisons)
  | 'heavy'               // Travaux lourds (structure, réseaux)
  | 'total';              // Rénovation complète

export interface SurfaceImpact {
  currentLivingArea: number;
  projectedLivingArea: number;
  surfaceGain: number;
  surfaceLoss: number;
  netGain: number;
  extensionSurface?: number;
  elevationSurface?: number;
  conversionSurface?: number;
  demolitionSurface?: number;
}

export interface ProjectExclusion {
  description: string;
  reason: string;
  potentialFuturePhase?: boolean;
}

export interface ProjectOption {
  id: string;
  name: string;
  description: string;
  estimatedCost: EstimationRange;
  priority: Priority;
  dependencies?: string[];
  impact?: string;
  recommendation?: 'include' | 'exclude' | 'consider';
}

export interface ProjectPhase {
  id: string;
  name: string;
  order: number;
  description: string;
  duration: DurationEstimate;
  lots: string[];
  dependencies?: string[];
  canBeDeferred: boolean;
  deferralImpact?: string;
}

export interface DurationEstimate {
  minDays: number;
  maxDays: number;
  expectedDays: number;
  confidence: ConfidenceLevel;
}

// =============================================================================
// CONTRAINTES DU PROJET
// =============================================================================

export interface ProjectConstraints {
  temporal: TemporalConstraints;
  occupancy: OccupancyConstraints;
  physical: PhysicalConstraints;
  technical: TechnicalConstraints;
  neighborhood: NeighborhoodConstraints;
  other: OtherConstraints;
}

export interface TemporalConstraints {
  absoluteDeadline?: string;
  deadlineReason?: string;
  preferredStartDate?: string;
  preferredEndDate?: string;
  blackoutPeriods: BlackoutPeriod[];
  seasonalConstraints?: SeasonalConstraint[];
  eventDeadlines?: EventDeadline[];
  flexibility: FlexibilityLevel;
}

export interface BlackoutPeriod {
  startDate: string;
  endDate: string;
  reason: string;
  hardConstraint: boolean;
}

export interface SeasonalConstraint {
  type: 'avoid_winter' | 'avoid_summer' | 'avoid_rain_season' | 'school_holidays';
  reason?: string;
  priority: Priority;
}

export interface EventDeadline {
  eventName: string;
  date: string;
  mustBeCompleted: boolean;
  mustBeStarted: boolean;
  worksToComplete?: string[];
}

export type FlexibilityLevel =
  | 'rigid'         // Dates non négociables
  | 'limited'       // Peu de marge
  | 'moderate'      // Flexible de quelques semaines
  | 'flexible'      // Très flexible
  | 'undefined';    // À définir

export interface OccupancyConstraints {
  duringWorksOccupancy: OccupancyDuringWorks;
  canVacatePremises: boolean;
  vacationDuration?: number; // jours
  temporaryHousingNeeded: boolean;
  temporaryHousingBudget?: number;
  vulnerablePersons: VulnerablePerson[];
  pets: PetInfo[];
  valuablesStorage: boolean;
  storageSolutionNeeded: boolean;
  accessRestrictions?: AccessRestriction[];
}

export type OccupancyDuringWorks =
  | 'fully_vacant'      // Logement vide
  | 'partially_occupied' // Partiellement occupé
  | 'fully_occupied'    // Entièrement occupé
  | 'professional_use'; // Usage professionnel maintenu

export interface VulnerablePerson {
  type: 'infant' | 'child' | 'elderly' | 'disabled' | 'health_condition';
  specificNeeds?: string;
  noiseRestriction: boolean;
  dustRestriction: boolean;
  accessibilityNeeds?: string;
}

export interface PetInfo {
  type: string;
  count: number;
  restrictions?: string;
}

export interface AccessRestriction {
  type: 'entry_time' | 'exit_time' | 'noise_hours' | 'area_access' | 'parking';
  description: string;
  mandatory: boolean;
}

export interface PhysicalConstraints {
  siteAccess: SiteAccess;
  storageCapacity: StorageCapacity;
  parkingAvailability: ParkingAvailability;
  neighboringStructures: NeighboringStructure[];
  groundConditions?: GroundConditions;
  utilityConstraints?: UtilityConstraint[];
}

export interface SiteAccess {
  vehicleAccess: AccessQuality;
  vehicleMaxSize?: VehicleSize;
  pedestrianAccess: AccessQuality;
  deliveryConstraints?: string;
  accessSchedule?: string;
  keyHandover: KeyHandoverMethod;
  securityAccess?: string;
}

export type AccessQuality = 'excellent' | 'good' | 'limited' | 'difficult' | 'impossible';

export interface VehicleSize {
  maxLength: number;
  maxWidth: number;
  maxHeight: number;
  maxWeight: number;
}

export type KeyHandoverMethod =
  | 'on_site' | 'key_safe' | 'concierge' | 'digital_lock' | 'owner_present';

export interface StorageCapacity {
  onSiteStorage: boolean;
  storageArea?: number;
  coveredStorage: boolean;
  secureStorage: boolean;
  materialDeliverySpace: boolean;
  wasteStorageSpace: boolean;
}

export interface ParkingAvailability {
  contractorParking: boolean;
  parkingSpaces: number;
  parkingType: 'on_site' | 'street' | 'nearby_lot' | 'none';
  parkingCost?: number;
  restrictions?: string;
}

export interface NeighboringStructure {
  type: 'building' | 'wall' | 'fence' | 'tree' | 'infrastructure';
  distance: number;
  protectionRequired: boolean;
  protectionType?: string;
  agreementRequired: boolean;
  agreementObtained?: boolean;
}

export interface GroundConditions {
  slopePercentage?: number;
  drainageQuality: 'good' | 'moderate' | 'poor';
  waterTableIssues: boolean;
  contaminationRisk: boolean;
  archaeologicalRisk: boolean;
}

export interface UtilityConstraint {
  utility: 'electricity' | 'gas' | 'water' | 'sewer' | 'telecom';
  constraint: string;
  impactOnWorks: string;
}

export interface TechnicalConstraints {
  existingStructureLimitations?: string[];
  heightRestrictions?: HeightRestriction;
  loadRestrictions?: LoadRestriction[];
  acousticRequirements?: AcousticRequirement;
  thermalRequirements?: ThermalRequirement;
  accessibilityRequirements?: AccessibilityRequirement;
  specialRequirements?: SpecialRequirement[];
}

export interface HeightRestriction {
  maxExteriorHeight?: number;
  maxInteriorHeight?: number;
  minInteriorHeight?: number;
  reason?: string;
}

export interface LoadRestriction {
  location: string;
  maxLoad: number;
  unit: 'kg_m2' | 'kn_m2';
  reinforcementPossible: boolean;
}

export interface AcousticRequirement {
  level: 'standard' | 'enhanced' | 'premium' | 'professional';
  specificRooms?: string[];
  targetDecibels?: number;
  reason?: string;
}

export interface ThermalRequirement {
  targetEnergyClass?: EnergyClass;
  targetConsumption?: number;
  passiveStandard?: boolean;
  bepos?: boolean;
  reason?: string;
}

export interface AccessibilityRequirement {
  pmrCompliance: boolean;
  wheelchairAccess: boolean;
  visualAccessibility: boolean;
  hearingAccessibility: boolean;
  specificNeeds?: string[];
}

export interface SpecialRequirement {
  type: string;
  description: string;
  mandatory: boolean;
  standard?: string;
}

export interface NeighborhoodConstraints {
  notificationRequired: boolean;
  notificationDone: boolean;
  potentialOpposition: boolean;
  oppositionDetails?: string;
  partyWallAgreement?: boolean;
  rightOfWay?: boolean;
  boundaryDisputes?: boolean;
  noiseSensitivity: 'low' | 'medium' | 'high';
  workingHoursRestrictions?: WorkingHoursRestriction;
}

export interface WorkingHoursRestriction {
  weekdayStart: string;
  weekdayEnd: string;
  saturdayAllowed: boolean;
  saturdayStart?: string;
  saturdayEnd?: string;
  sundayAllowed: boolean;
  holidaysAllowed: boolean;
  source: 'municipal' | 'condo' | 'agreement' | 'custom';
}

export interface OtherConstraints {
  insuranceRequirements?: InsuranceRequirement[];
  certificationRequirements?: string[];
  warrantyRequirements?: string[];
  qualityLabels?: string[];
  specificStandards?: string[];
  contractorPreferences?: ContractorPreference[];
  materialPreferences?: MaterialPreference[];
  excludedMaterials?: string[];
}

export interface InsuranceRequirement {
  type: 'decennial' | 'rc_pro' | 'all_risk' | 'dommage_ouvrage';
  minAmount?: number;
  mandatory: boolean;
}

export interface ContractorPreference {
  criterion: 'local' | 'certified' | 'recommended' | 'known' | 'size';
  preference: string;
  priority: Priority;
}

export interface MaterialPreference {
  category: string;
  preference: 'eco' | 'french' | 'premium' | 'budget' | 'specific';
  details?: string;
  excludedBrands?: string[];
  preferredBrands?: string[];
}

// =============================================================================
// CONTEXTE RÉGLEMENTAIRE
// =============================================================================

export interface RegulatoryContext {
  urbanPlanning: UrbanPlanningContext;
  buildingPermits: BuildingPermitRequirements;
  technicalRegulations: TechnicalRegulations;
  environmentalRegulations: EnvironmentalRegulations;
  administrativeProcedures: AdministrativeProcedure[];
  requiredConsultations: RequiredConsultation[];
}

export interface UrbanPlanningContext {
  pluZone: string;
  pluRules?: PLURules;
  specialZone?: SpecialZone;
  servitudes?: Servitude[];
  certificateObtained: boolean;
  certificateDate?: string;
  certificateType?: 'cu_a' | 'cu_b';
  certificateValidity?: string;
}

export interface PLURules {
  maxHeight?: number;
  maxCos?: number;
  maxCes?: number;
  minSetbacks?: SetbackRule[];
  allowedUses?: string[];
  architecturalConstraints?: string[];
  materialConstraints?: string[];
  colorConstraints?: string[];
  roofConstraints?: string[];
}

export interface SetbackRule {
  type: 'road' | 'boundary' | 'building';
  minDistance: number;
  exceptions?: string;
}

export interface SpecialZone {
  type: SpecialZoneType;
  name?: string;
  constraints: string[];
  approvalRequired: boolean;
  approvalAuthority?: string;
}

export type SpecialZoneType =
  | 'monument_historique'
  | 'site_classe'
  | 'site_inscrit'
  | 'zppaup_avap'
  | 'secteur_sauvegarde'
  | 'natura_2000'
  | 'coastal_law'
  | 'mountain_law'
  | 'flood_zone'
  | 'noise_zone';

export interface Servitude {
  type: ServitudeType;
  description: string;
  impactOnProject: string;
  documents?: string[];
}

export type ServitudeType =
  | 'passage'        // Droit de passage
  | 'view'           // Vue
  | 'drainage'       // Écoulement des eaux
  | 'utility'        // Servitude de réseaux
  | 'alignment'      // Alignement
  | 'non_aedificandi' // Non aedificandi
  | 'other';

export interface BuildingPermitRequirements {
  permitType: PermitType;
  permitRequired: boolean;
  dpRequired: boolean; // Déclaration préalable
  pcRequired: boolean; // Permis de construire
  pdRequired: boolean; // Permis de démolir
  paRequired: boolean; // Permis d'aménager
  architectRequired: boolean;
  architectThreshold?: string;
  estimatedProcessingTime: DurationEstimate;
  documents: RequiredDocument[];
  currentStatus?: PermitStatus;
  applicationDate?: string;
  expectedDecisionDate?: string;
}

export type PermitType =
  | 'none'
  | 'declaration_prealable'
  | 'permis_construire'
  | 'permis_demolir'
  | 'permis_amenager'
  | 'multiple';

export interface RequiredDocument {
  code: string; // PC1, PC2, DP1, etc.
  name: string;
  mandatory: boolean;
  status: DocumentStatus;
  notes?: string;
}

export type DocumentStatus =
  | 'not_started' | 'in_progress' | 'ready' | 'submitted' | 'approved' | 'rejected';

export type PermitStatus =
  | 'not_required'
  | 'to_submit'
  | 'submitted'
  | 'under_review'
  | 'additional_info_requested'
  | 'approved'
  | 'approved_with_conditions'
  | 'rejected'
  | 'appeal';

export interface TechnicalRegulations {
  applicableDTUs: ApplicableDTU[];
  applicableNorms: ApplicableNorm[];
  rtApplicable: RTVersion;
  reApplicable: boolean;
  accessibilityNorms: AccessibilityNorm[];
  fireRegulations: FireRegulation[];
  asbestosRegulation?: AsbestosRegulation;
}

export interface ApplicableDTU {
  number: string;
  name: string;
  applicableLots: string[];
  mandatory: boolean;
  notes?: string;
}

export interface ApplicableNorm {
  reference: string;
  name: string;
  scope: string;
  mandatory: boolean;
}

export type RTVersion = 'RT2005' | 'RT2012' | 'RE2020' | 'existing' | 'none';

export interface AccessibilityNorm {
  type: 'erp' | 'housing' | 'workplace';
  level?: string;
  requirements: string[];
}

export interface FireRegulation {
  type: 'erp' | 'igh' | 'habitation' | 'other';
  classification?: string;
  requirements: string[];
}

export interface AsbestosRegulation {
  subSection3Required: boolean;
  subSection4Required: boolean;
  removalRequired: boolean;
  certifiedContractorRequired: boolean;
}

export interface EnvironmentalRegulations {
  impactStudyRequired: boolean;
  impactStudyLevel?: 'full' | 'simplified' | 'case_by_case';
  protectedSpecies: boolean;
  protectedSpeciesStudy?: string;
  waterRegulation: boolean;
  waterDeclaration?: 'declaration' | 'authorization';
  wasteManagementPlan: boolean;
  icpeClassification?: string;
  soredRequired: boolean; // Schéma d'Organisation et de gestion des Déchets
}

export interface AdministrativeProcedure {
  name: string;
  authority: string;
  status: ProcedureStatus;
  deadline?: string;
  documents: string[];
  estimatedDuration: number;
  cost?: number;
  notes?: string;
}

export type ProcedureStatus =
  | 'not_started' | 'in_progress' | 'submitted' | 'approved' | 'rejected' | 'not_required';

export interface RequiredConsultation {
  authority: ConsultationAuthority;
  mandatory: boolean;
  reason: string;
  expectedDuration: number;
  status: ConsultationStatus;
  submissionDate?: string;
  responseDate?: string;
  response?: ConsultationResponse;
}

export type ConsultationAuthority =
  | 'abf'           // Architecte Bâtiments de France
  | 'sdis'          // Service Départemental Incendie
  | 'ddtm'          // Direction Départementale Territoires et Mer
  | 'dreal'         // Direction Régionale Environnement
  | 'ars'           // Agence Régionale de Santé
  | 'enedis'        // Électricité
  | 'grdf'          // Gaz
  | 'spanc'         // Assainissement non collectif
  | 'syndic'        // Syndic de copropriété
  | 'mairie'        // Mairie
  | 'other';

export type ConsultationStatus =
  | 'not_started' | 'scheduled' | 'submitted' | 'awaiting' | 'received' | 'not_required';

export interface ConsultationResponse {
  decision: 'favorable' | 'favorable_with_conditions' | 'unfavorable' | 'no_objection';
  conditions?: string[];
  prescriptions?: string[];
  responseDate: string;
  validityDate?: string;
}

// =============================================================================
// BUDGET ET FINANCEMENT
// =============================================================================

export interface BudgetInfo {
  envelope: BudgetEnvelope;
  breakdown: BudgetBreakdown;
  funding: FundingPlan;
  contingency: ContingencyPlan;
  paymentSchedule?: PaymentSchedule;
  costControl: CostControlStrategy;
}

export interface BudgetEnvelope {
  minBudget: number;
  maxBudget: number;
  targetBudget: number;
  currency: string;
  vatIncluded: boolean;
  vatRate: number;
  flexibility: BudgetFlexibility;
  priorities: BudgetPriority[];
}

export type BudgetFlexibility =
  | 'strict'    // Budget ferme, non dépassable
  | 'limited'   // Dépassement possible < 10%
  | 'moderate'  // Dépassement possible < 20%
  | 'flexible'  // Budget indicatif
  | 'undefined'; // À définir

export interface BudgetPriority {
  category: string;
  priority: Priority;
  minAllocation?: number;
  maxAllocation?: number;
  notes?: string;
}

export interface BudgetBreakdown {
  estimatedTotal: EstimationRange;
  byCategory: CategoryBudget[];
  byLot: LotBudget[];
  additionalCosts: AdditionalCost[];
  totalWithContingency: EstimationRange;
}

export interface CategoryBudget {
  category: WorkCategory;
  estimated: EstimationRange;
  percentage: number;
  priority: Priority;
  negotiable: boolean;
}

export interface LotBudget {
  lotId: string;
  lotName: string;
  estimated: EstimationRange;
  percentage: number;
  optional: boolean;
  alternatives?: AlternativeBudget[];
}

export interface AlternativeBudget {
  description: string;
  estimated: EstimationRange;
  qualityImpact: 'lower' | 'equivalent' | 'higher';
}

export interface AdditionalCost {
  type: AdditionalCostType;
  description: string;
  estimated: EstimationRange;
  mandatory: boolean;
  included: boolean;
}

export type AdditionalCostType =
  | 'architect_fees'
  | 'engineering_fees'
  | 'permit_fees'
  | 'insurance_dommage_ouvrage'
  | 'coordination_sps'
  | 'control_bureau'
  | 'diagnostics'
  | 'moving_costs'
  | 'temporary_housing'
  | 'storage'
  | 'landscaping'
  | 'decoration'
  | 'furniture'
  | 'appliances'
  | 'connection_fees'
  | 'notary_fees'
  | 'other';

export interface FundingPlan {
  sources: FundingSource[];
  aids: AidApplication[];
  totalFunding: number;
  fundingGap: number;
  fundingStatus: FundingStatus;
}

export interface FundingSource {
  type: FundingSourceType;
  amount: number;
  percentage: number;
  status: SourceStatus;
  provider?: string;
  rate?: number;
  duration?: number;
  monthlyPayment?: number;
  conditions?: string;
  applicationDate?: string;
  expectedDate?: string;
}

export type FundingSourceType =
  | 'personal_savings'
  | 'property_sale'
  | 'mortgage'
  | 'renovation_loan'
  | 'eco_ptz'
  | 'ptz'
  | 'action_logement'
  | 'family_loan'
  | 'professional_credit'
  | 'leasing'
  | 'crowdfunding'
  | 'other';

export type SourceStatus =
  | 'available' | 'committed' | 'applied' | 'approved' | 'rejected' | 'pending';

export interface AidApplication {
  aidType: AidType;
  aidName: string;
  estimatedAmount: number;
  confirmedAmount?: number;
  eligibilityStatus: EligibilityStatus;
  applicationStatus: ApplicationStatus;
  applicationDate?: string;
  decisionDate?: string;
  paymentDate?: string;
  conditions?: string[];
  documents: string[];
}

export type AidType =
  | 'maprimerénov'
  | 'maprimerénov_serenite'
  | 'maprimerénov_copro'
  | 'cee'
  | 'eco_ptz'
  | 'ptz'
  | 'loc_avantages'
  | 'denormandie'
  | 'local_grant'
  | 'regional_grant'
  | 'departmental_grant'
  | 'caisse_retraite'
  | 'anah'
  | 'action_logement'
  | 'reduced_vat'
  | 'tax_credit'
  | 'other';

export type EligibilityStatus =
  | 'eligible' | 'potentially_eligible' | 'not_eligible' | 'to_verify';

export type ApplicationStatus =
  | 'not_started' | 'preparing' | 'submitted' | 'under_review'
  | 'additional_info' | 'approved' | 'rejected' | 'paid';

export type FundingStatus =
  | 'fully_funded' | 'partially_funded' | 'funding_gap' | 'not_funded';

export interface ContingencyPlan {
  contingencyPercentage: number;
  contingencyAmount: number;
  riskAssessment: RiskAssessment[];
  mitigationStrategies: MitigationStrategy[];
}

export interface RiskAssessment {
  risk: string;
  probability: 'low' | 'medium' | 'high';
  impact: EstimationRange;
  mitigation?: string;
}

export interface MitigationStrategy {
  trigger: string;
  action: string;
  budgetImpact: number;
  qualityImpact?: string;
  scheduleImpact?: number;
}

export interface PaymentSchedule {
  type: PaymentScheduleType;
  milestones: PaymentMilestone[];
  depositPercentage: number;
  retentionPercentage: number;
}

export type PaymentScheduleType =
  | 'fixed_schedule' | 'progress_based' | 'milestone_based' | 'custom';

export interface PaymentMilestone {
  name: string;
  percentage: number;
  amount: number;
  trigger: string;
  expectedDate?: string;
  paid: boolean;
  paidDate?: string;
}

export interface CostControlStrategy {
  method: CostControlMethod;
  reviewFrequency: 'weekly' | 'biweekly' | 'monthly';
  warningThreshold: number;
  alertThreshold: number;
  approvalRequired: number;
  changeOrderProcess: string;
}

export type CostControlMethod =
  | 'fixed_price'      // Prix forfaitaire
  | 'cost_plus'        // Régie
  | 'unit_price'       // Bordereau de prix
  | 'mixed';           // Mixte

// =============================================================================
// PLANIFICATION
// =============================================================================

export interface ProjectPlanning {
  timeline: ProjectTimeline;
  milestones: ProjectMilestone[];
  dependencies: PlanningDependency[];
  criticalPath?: string[];
  buffers: PlanningBuffer[];
}

export interface ProjectTimeline {
  studyPhaseStart?: string;
  studyPhaseEnd?: string;
  permitSubmission?: string;
  expectedPermitDate?: string;
  tenderPhaseStart?: string;
  tenderPhaseEnd?: string;
  contractSignature?: string;
  worksStart: string;
  worksEnd: string;
  handoverDate?: string;
  warrantyEndDate?: string;
  totalDuration: DurationEstimate;
}

export interface ProjectMilestone {
  id: string;
  name: string;
  type: MilestoneType;
  plannedDate: string;
  actualDate?: string;
  status: MilestoneStatus;
  dependencies?: string[];
  deliverables?: string[];
  payment?: number;
}

export type MilestoneType =
  | 'study' | 'permit' | 'tender' | 'contract' | 'works_start'
  | 'foundation' | 'structural' | 'watertight' | 'networks'
  | 'finishing' | 'handover' | 'final_payment' | 'warranty_end';

export type MilestoneStatus =
  | 'pending' | 'in_progress' | 'completed' | 'delayed' | 'cancelled';

export interface PlanningDependency {
  predecessor: string;
  successor: string;
  type: DependencyType;
  lag?: number;
}

export type DependencyType =
  | 'finish_to_start'
  | 'start_to_start'
  | 'finish_to_finish'
  | 'start_to_finish';

export interface PlanningBuffer {
  type: 'project' | 'phase' | 'milestone';
  reference: string;
  bufferDays: number;
  used: number;
}

// =============================================================================
// ATTENTES QUALITÉ
// =============================================================================

export interface QualityExpectations {
  overallLevel: QualityLevel;
  finishingLevel: FinishingLevel;
  materialQuality: MaterialQualityLevel;
  workmanshipLevel: WorkmanshipLevel;
  specificExpectations: SpecificExpectation[];
  references?: QualityReference[];
  qualityControlPlan?: QualityControlPlan;
}

export type QualityLevel =
  | 'basic'       // Standard économique
  | 'standard'    // Standard
  | 'superior'    // Supérieur
  | 'premium'     // Premium
  | 'luxury';     // Luxe

export type FinishingLevel =
  | 'rough'       // Hors d'eau hors d'air
  | 'unfinished'  // Prêt à décorer
  | 'standard'    // Finitions standard
  | 'refined'     // Finitions soignées
  | 'bespoke';    // Sur-mesure

export type MaterialQualityLevel =
  | 'economy' | 'standard' | 'quality' | 'premium' | 'bespoke';

export type WorkmanshipLevel =
  | 'standard' | 'careful' | 'meticulous' | 'artisanal';

export interface SpecificExpectation {
  area: string;
  expectation: string;
  priority: Priority;
  reference?: string;
}

export interface QualityReference {
  type: 'photo' | 'project' | 'showroom' | 'website';
  url?: string;
  description: string;
  whatILike: string;
}

export interface QualityControlPlan {
  inspectionFrequency: 'daily' | 'weekly' | 'milestone' | 'final';
  thirdPartyControl: boolean;
  controlBureau?: string;
  checkpoints: QualityCheckpoint[];
}

export interface QualityCheckpoint {
  phase: string;
  criteria: string[];
  inspector: 'owner' | 'architect' | 'control_bureau' | 'contractor';
  mandatory: boolean;
}

// =============================================================================
// INTERVENANTS
// =============================================================================

export interface Stakeholders {
  owner: OwnerStakeholder;
  architect?: ArchitectStakeholder;
  engineers?: EngineerStakeholder[];
  contractors?: ContractorRequirement[];
  coordinator?: CoordinatorStakeholder;
  controlBureau?: ControlBureauStakeholder;
  other?: OtherStakeholder[];
}

export interface OwnerStakeholder {
  role: 'decision_maker' | 'representative' | 'delegator';
  involvement: 'high' | 'medium' | 'low';
  technicalContact?: ContactPerson;
  financialContact?: ContactPerson;
  onSiteContact?: ContactPerson;
}

export interface ContactPerson {
  name: string;
  role: string;
  email: string;
  phone: string;
  availability: string;
}

export interface ArchitectStakeholder {
  required: boolean;
  reason?: string;
  selected: boolean;
  name?: string;
  company?: string;
  registrationNumber?: string;
  insurance?: string;
  missionType?: ArchitectMission;
  feeStructure?: FeeStructure;
  contact?: ContactPerson;
}

export type ArchitectMission =
  | 'permis_only'    // Mission permis uniquement
  | 'conception'     // Conception
  | 'dce'            // + DCE
  | 'act'            // + ACT
  | 'visa'           // + VISA
  | 'det'            // + DET
  | 'aor'            // + AOR
  | 'full';          // Mission complète

export interface FeeStructure {
  type: 'percentage' | 'fixed' | 'mixed';
  percentage?: number;
  fixedAmount?: number;
  paymentSchedule?: string;
}

export interface EngineerStakeholder {
  type: EngineerType;
  required: boolean;
  selected: boolean;
  name?: string;
  company?: string;
  mission?: string;
  feeStructure?: FeeStructure;
  contact?: ContactPerson;
}

export type EngineerType =
  | 'structural' | 'thermal' | 'fluids' | 'electrical' | 'acoustic' | 'geotechnical';

export interface ContractorRequirement {
  lotCategory: WorkCategory;
  contractType: ContractType;
  selectionCriteria: SelectionCriterion[];
  qualificationRequired: string[];
  insuranceRequired: string[];
  preferredSize?: 'micro' | 'small' | 'medium' | 'large';
  localPreference: boolean;
}

export type ContractType =
  | 'general_contractor'  // Entreprise générale
  | 'grouped_lots'        // Lots groupés
  | 'separate_lots'       // Lots séparés
  | 'design_build';       // Conception-réalisation

export interface SelectionCriterion {
  criterion: string;
  weight: number;
  mandatory: boolean;
}

export interface CoordinatorStakeholder {
  spsRequired: boolean;
  spsLevel?: 'level_1' | 'level_2' | 'level_3';
  opcRequired: boolean;
  selected: boolean;
  name?: string;
  company?: string;
  contact?: ContactPerson;
}

export interface ControlBureauStakeholder {
  required: boolean;
  missions: ControlMission[];
  selected: boolean;
  name?: string;
  company?: string;
  contact?: ContactPerson;
}

export type ControlMission =
  | 'L'    // Solidité des ouvrages
  | 'S'    // Sécurité des personnes
  | 'PS'   // Parasismique
  | 'F'    // Fonctionnement des installations
  | 'HAND' // Accessibilité handicapés
  | 'TH'   // Thermique
  | 'ENV'; // Environnement

export interface OtherStakeholder {
  role: string;
  name?: string;
  company?: string;
  mission?: string;
  contact?: ContactPerson;
}
