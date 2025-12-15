/**
 * TORP Phase 0 - Types CCTP (Cahier des Clauses Techniques Particulières)
 * Module 0.5 : Programme Détaillé des Travaux
 *
 * Structure complète pour la génération automatique de CCTP
 * conforme aux standards des marchés publics français
 */

import type {
  TORPMetadata,
  Address,
  EstimationRange,
  DocumentReference,
  ConfidenceLevel,
} from './common.types';

// =============================================================================
// DOCUMENT CCTP PRINCIPAL
// =============================================================================

export interface CCTPDocument {
  id: string;
  projectId: string;

  // Métadonnées document
  metadata: CCTPMetadata;

  // Article 1 : Objet du marché
  marketObject: MarketObject;

  // Article 2 : Description générale
  generalDescription: GeneralDescription;

  // Article 3 : Spécifications par lot
  lots: CCTPLot[];

  // Article 4 : Documents entreprise
  contractorDocuments: ContractorDocumentRequirements;

  // Article 5 : Délais
  scheduling: SchedulingRequirements;

  // Article 6 : Conditions financières
  financialConditions: FinancialConditions;

  // Article 7 : Clauses particulières
  specialClauses: SpecialClauses;

  // Annexes
  appendices: CCTPAppendix[];

  // Génération
  generationInfo: CCTPGenerationInfo;

  torpMetadata: TORPMetadata;
}

export interface CCTPMetadata {
  version: string;
  createdAt: string;
  updatedAt: string;
  status: CCTPStatus;
  language: 'fr';
  format: CCTPFormat;
  author?: string;
  reviewer?: string;
  approvedBy?: string;
  approvalDate?: string;
}

export type CCTPStatus =
  | 'draft'
  | 'review'
  | 'approved'
  | 'issued'
  | 'superseded';

export type CCTPFormat =
  | 'mono_lot'               // Lot unique
  | 'multi_lots'             // Allotissement
  | 'macro_lots'             // Macro-lots
  | 'generaliste';           // Entreprise générale

// =============================================================================
// ARTICLE 1 : OBJET DU MARCHÉ
// =============================================================================

export interface MarketObject {
  // Désignation
  projectTitle: string;
  projectDescription: string;

  // Localisation
  address: Address;
  cadastralRef?: string;

  // Maître d'ouvrage
  clientInfo: ClientInfo;

  // Surfaces
  totalSurface: number;      // m²
  impactedSurface: number;   // m² concernés par travaux

  // Budget
  estimatedBudgetHT: EstimationRange;

  // Type de marché
  marketType: MarketType;

  // Références
  projectReference: string;
  dceReference?: string;
}

export interface ClientInfo {
  type: 'individual' | 'company' | 'public_entity';
  name: string;
  address: Address;
  contactPerson?: string;
  phone?: string;
  email?: string;
  siret?: string;
}

export type MarketType =
  | 'private'                // Marché privé
  | 'mapa'                   // Marché à Procédure Adaptée
  | 'appel_offres_ouvert'    // Appel d'offres ouvert
  | 'appel_offres_restreint' // Appel d'offres restreint
  | 'dialogue_competitif'    // Dialogue compétitif
  | 'marche_negocie';        // Marché négocié

// =============================================================================
// ARTICLE 2 : DESCRIPTION GÉNÉRALE
// =============================================================================

export interface GeneralDescription {
  // Contexte
  context: ProjectContext;

  // Nature des travaux
  worksNature: WorksNature;

  // Contraintes générales
  generalConstraints: GeneralConstraints;
}

export interface ProjectContext {
  buildingDescription: string;
  constructionYear?: number;
  buildingType: string;
  currentCondition: string;
  occupancyDuringWorks: OccupancyDuringWorks;
  previousWorks?: string;
}

export type OccupancyDuringWorks =
  | 'vacant'                 // Logement vacant
  | 'occupied_full'          // Occupé pendant tous les travaux
  | 'occupied_partial'       // Partiellement occupé
  | 'commercial_operating';  // Commerce en activité

export interface WorksNature {
  projectType: ProjectType;
  mainWorkCategories: WorkCategory[];
  allotmentType: AllotmentType;
  lotsCount: number;
  lotsList: LotSummary[];
}

export type ProjectType =
  | 'new_construction'       // Construction neuve
  | 'extension'              // Extension
  | 'elevation'              // Surélévation
  | 'full_renovation'        // Rénovation complète
  | 'partial_renovation'     // Rénovation partielle
  | 'energy_renovation'      // Rénovation énergétique
  | 'compliance_update'      // Mise aux normes
  | 'maintenance';           // Maintenance/entretien

export type WorkCategory =
  | 'gros_oeuvre'
  | 'charpente_couverture'
  | 'facades_ravalement'
  | 'menuiseries_exterieures'
  | 'menuiseries_interieures'
  | 'electricite'
  | 'plomberie_sanitaires'
  | 'chauffage_climatisation'
  | 'ventilation'
  | 'isolation'
  | 'platrerie_cloisons'
  | 'revetements_sols'
  | 'revetements_muraux'
  | 'peinture'
  | 'cuisine'
  | 'salle_de_bains'
  | 'vrd_exterieurs'
  | 'demolitions'
  | 'desamiantage'
  | 'deplombage';

export type AllotmentType =
  | 'single_lot'             // Lot unique (entreprise générale)
  | 'trade_lots'             // Lots par corps d'état
  | 'macro_lots'             // Macro-lots
  | 'mixed';                 // Mixte

export interface LotSummary {
  number: number;
  code: string;              // Ex: GO, CC, ELEC
  name: string;
  estimatedAmount?: EstimationRange;
}

export interface GeneralConstraints {
  // Horaires
  workingHours: WorkingHours;

  // Accès et stockage
  siteAccess: SiteAccessConstraints;

  // Protection
  protectionRequirements: ProtectionRequirements;

  // Gestion déchets
  wasteManagement: WasteManagementRequirements;

  // Sécurité
  securityRequirements: SecurityRequirements;

  // Environnement
  environmentalRequirements: EnvironmentalRequirements;
}

export interface WorkingHours {
  weekdayStart: string;      // HH:mm
  weekdayEnd: string;
  saturdayAllowed: boolean;
  saturdayStart?: string;
  saturdayEnd?: string;
  sundayAllowed: boolean;
  holidaysAllowed: boolean;
  noisyWorksHours?: WorkingHours;
  neighborNotification: boolean;
}

export interface SiteAccessConstraints {
  vehicleAccessWidth: number;
  heightRestriction?: number;
  weightRestriction?: number;
  restrictedAccessTimes?: string[];
  keyHandover: boolean;
  securityCode?: boolean;
  parkingAvailable: boolean;
  deliveryRestrictions?: string[];
  storageAreaAvailable: boolean;
  storageAreaSize?: number;
  publicSpaceOccupation: boolean;
}

export interface ProtectionRequirements {
  existingStructures: ProtectionDetail[];
  furniture: boolean;
  floors: boolean;
  commonAreas: boolean;
  garden: boolean;
  neighborProperty: boolean;
  dustProtection: boolean;
  noiseProtection: boolean;
}

export interface ProtectionDetail {
  element: string;
  method: string;
  responsible: string;
}

export interface WasteManagementRequirements {
  sortingRequired: boolean;
  categories: WasteCategory[];
  binProvision: 'client' | 'contractor';
  binLocation?: string;
  recyclingRate?: number;    // % minimum
  traceabilityRequired: boolean;
  bsdRequired: boolean;      // Bordereau Suivi Déchets
}

export interface WasteCategory {
  type: WasteType;
  estimatedVolume?: number;  // m³
  destination: string;
  documentation: boolean;
}

export type WasteType =
  | 'dib'                    // Déchets Industriels Banals
  | 'did'                    // Déchets Industriels Dangereux
  | 'gravats_inertes'        // Gravats inertes
  | 'bois'                   // Bois
  | 'metaux'                 // Métaux
  | 'plastiques'             // Plastiques
  | 'platre'                 // Plâtre
  | 'amiante'                // Amiante
  | 'deee';                  // Déchets électroniques

export interface SecurityRequirements {
  ppspsRequired: boolean;    // > 500 homme-jours
  spsCoordinator?: string;
  securityPlan: boolean;
  ppe: string[];             // Équipements protection
  firstAidKit: boolean;
  fireExtinguisher: boolean;
  evacuationPlan: boolean;
}

export interface EnvironmentalRequirements {
  noiseLimit?: number;       // dB
  vibrationLimit?: number;
  dustControl: boolean;
  chemicalControl: boolean;
  waterProtection: boolean;
  treesProtection: boolean;
  wildlifeProtection?: boolean;
}

// =============================================================================
// ARTICLE 3 : SPÉCIFICATIONS PAR LOT
// =============================================================================

export interface CCTPLot {
  // Identification
  lotNumber: number;
  lotCode: string;
  lotName: string;
  category: WorkCategory;

  // Section 3.X.1 : Étendue des travaux
  scope: LotScope;

  // Section 3.X.2 : Spécifications matériaux
  materialSpecifications: MaterialSpecification[];

  // Section 3.X.3 : Mode opératoire
  operatingProcedures: OperatingProcedure[];

  // Section 3.X.4 : Normes et DTU
  applicableStandards: ApplicableStandard[];

  // Section 3.X.5 : Contrôles et réception
  qualityControl: QualityControlRequirements;

  // Section 3.X.6 : Garanties
  warranties: WarrantyRequirement[];

  // Estimation
  estimatedAmount?: EstimationRange;

  // Interfaces avec autres lots
  interfaces: LotInterface[];
}

// -----------------------------------------------------------------------------
// Section 3.X.1 : Étendue des travaux
// -----------------------------------------------------------------------------

export interface LotScope {
  description: string;
  includedWorks: WorkItem[];
  excludedWorks?: ExcludedWork[];
  locations: WorkLocation[];
  quantities: QuantityItem[];
}

export interface WorkItem {
  id: string;
  code: string;              // Code ouvrage
  description: string;
  detailedDescription?: string;
  unit: string;
  quantity: number;
  location: string;
  specifications?: string;
  priority: 'mandatory' | 'optional' | 'alternative';
}

export interface ExcludedWork {
  description: string;
  reason: string;
  responsibleLot?: string;
}

export interface WorkLocation {
  name: string;
  level?: number;
  rooms?: string[];
  surface?: number;
  notes?: string;
}

export interface QuantityItem {
  description: string;
  unit: QuantityUnit;
  quantity: number;
  tolerance?: number;        // %
  measurementMethod: string;
}

export type QuantityUnit =
  | 'm'                      // Mètre linéaire
  | 'm2'                     // Mètre carré
  | 'm3'                     // Mètre cube
  | 'u'                      // Unité
  | 'ens'                    // Ensemble
  | 'fft'                    // Forfait
  | 'kg'
  | 'l'
  | 'kwh'
  | 'kw';

// -----------------------------------------------------------------------------
// Section 3.X.2 : Spécifications Matériaux
// -----------------------------------------------------------------------------

export interface MaterialSpecification {
  id: string;
  category: MaterialCategory;
  name: string;
  description: string;

  // Normes de référence
  standards: MaterialStandard[];

  // Caractéristiques techniques
  technicalCharacteristics: TechnicalCharacteristic[];

  // Dimensions
  dimensions?: MaterialDimensions;

  // Finition
  finish?: MaterialFinish;

  // Certifications
  certifications: MaterialCertification[];

  // Équivalence
  equivalencePolicy: EquivalencePolicy;

  // Marque de référence
  referenceBrand?: ReferenceBrand;

  // Prix indicatif
  indicativePrice?: MaterialPrice;
}

export type MaterialCategory =
  | 'structural'             // Structure
  | 'insulation'             // Isolation
  | 'roofing'                // Couverture
  | 'facade'                 // Façade
  | 'windows_doors'          // Menuiseries
  | 'electrical'             // Électricité
  | 'plumbing'               // Plomberie
  | 'heating'                // Chauffage
  | 'ventilation'            // Ventilation
  | 'flooring'               // Sols
  | 'wall_covering'          // Revêtements muraux
  | 'ceiling'                // Plafonds
  | 'paint'                  // Peinture
  | 'hardware'               // Quincaillerie
  | 'sealant'                // Étanchéité
  | 'other';

export interface MaterialStandard {
  type: 'nf' | 'en' | 'iso' | 'dtu' | 'cstb' | 'other';
  reference: string;
  title: string;
}

export interface TechnicalCharacteristic {
  name: string;
  value: string | number;
  unit?: string;
  operator?: '=' | '>=' | '<=' | '>' | '<';
  tolerance?: number;
  mandatory: boolean;
}

export interface MaterialDimensions {
  length?: DimensionSpec;
  width?: DimensionSpec;
  height?: DimensionSpec;
  thickness?: DimensionSpec;
  diameter?: DimensionSpec;
  format?: string;           // Ex: 60x60, 30x60
}

export interface DimensionSpec {
  value: number;
  unit: 'mm' | 'cm' | 'm';
  tolerance?: number;
}

export interface MaterialFinish {
  type: string;
  color?: ColorSpec;
  texture?: string;
  sheen?: 'matte' | 'satin' | 'semi_gloss' | 'gloss';
}

export interface ColorSpec {
  name?: string;
  ral?: string;
  ncs?: string;
  hex?: string;
  pantone?: string;
}

export interface MaterialCertification {
  type: CertificationType;
  reference?: string;
  required: boolean;
}

export type CertificationType =
  | 'nf'                     // NF
  | 'ce'                     // CE
  | 'acermi'                 // Acermi (isolation)
  | 'cstb'                   // CSTB
  | 'atec'                   // Avis Technique
  | 'dta'                    // Document Technique d'Application
  | 'cekal'                  // Cekal (vitrages)
  | 'qualibat'
  | 'rge'                    // RGE
  | 'upec'                   // UPEC (sols)
  | 'a2p'                    // A2P (sécurité)
  | 'pefc'                   // PEFC (bois)
  | 'fsc'                    // FSC (bois)
  | 'other';

export interface EquivalencePolicy {
  accepted: boolean;
  conditions?: string[];
  approvalProcess?: string;
  documentationRequired: string[];
}

export interface ReferenceBrand {
  brand: string;
  productRange: string;
  productReference?: string;
  technicalSheet?: string;
  note: string;              // "ou équivalent"
}

export interface MaterialPrice {
  supply: EstimationRange;
  installation?: EstimationRange;
  unit: string;
  source: 'batiprix' | 'ffb' | 'manufacturer' | 'estimate';
  date: string;
}

// -----------------------------------------------------------------------------
// Section 3.X.3 : Mode Opératoire
// -----------------------------------------------------------------------------

export interface OperatingProcedure {
  phase: OperatingPhase;
  description: string;
  steps: OperatingStep[];
  duration?: string;
  resources?: ResourceRequirement[];
  qualityChecks?: QualityCheckpoint[];
}

export type OperatingPhase =
  | 'preparation'
  | 'protection'
  | 'demolition'
  | 'execution'
  | 'drying_curing'
  | 'finishing'
  | 'cleanup'
  | 'inspection';

export interface OperatingStep {
  order: number;
  description: string;
  details?: string;
  duration?: string;
  waitTime?: string;         // Temps d'attente avant étape suivante
  weatherConditions?: WeatherConditions;
  safety?: string[];
}

export interface WeatherConditions {
  minTemperature?: number;
  maxTemperature?: number;
  maxHumidity?: number;
  rainAllowed: boolean;
  windLimit?: number;        // km/h
  frostProtection?: boolean;
}

export interface ResourceRequirement {
  type: 'labor' | 'equipment' | 'material';
  description: string;
  quantity?: number;
  duration?: string;
}

export interface QualityCheckpoint {
  point: string;
  description: string;
  method: string;
  acceptanceCriteria: string;
  documentation: boolean;
}

// -----------------------------------------------------------------------------
// Section 3.X.4 : Normes et DTU
// -----------------------------------------------------------------------------

export interface ApplicableStandard {
  type: StandardType;
  reference: string;
  title: string;
  version?: string;
  applicability: string;
  mainRequirements?: string[];
  documentUrl?: string;
}

export type StandardType =
  | 'dtu'                    // Document Technique Unifié
  | 'nf'                     // Norme Française
  | 'en'                     // Norme Européenne
  | 'iso'                    // Norme Internationale
  | 'atec'                   // Avis Technique
  | 'cpt'                    // Cahier des Prescriptions Techniques
  | 'reglement'              // Règlement
  | 'other';

// -----------------------------------------------------------------------------
// Section 3.X.5 : Contrôles et Réception
// -----------------------------------------------------------------------------

export interface QualityControlRequirements {
  // Points d'arrêt
  holdPoints: HoldPoint[];

  // Essais à réaliser
  tests: RequiredTest[];

  // Critères d'acceptation
  acceptanceCriteria: AcceptanceCriterion[];

  // Tolérances
  tolerances: ToleranceSpec[];

  // Procédure de réception
  receptionProcedure: ReceptionProcedure;
}

export interface HoldPoint {
  id: string;
  description: string;
  trigger: string;           // Quand déclencher
  validation: string;        // Qui valide
  documentation: string[];   // Documents requis
  consequence: string;       // Si non validé
}

export interface RequiredTest {
  id: string;
  name: string;
  description: string;
  standard: string;
  frequency: TestFrequency;
  performer: 'contractor' | 'client' | 'third_party';
  documentation: boolean;
  acceptanceCriteria: string;
}

export type TestFrequency =
  | 'once'                   // Une fois
  | 'per_batch'              // Par lot
  | 'per_zone'               // Par zone
  | 'sampling'               // Échantillonnage
  | 'systematic';            // Systématique

export interface AcceptanceCriterion {
  criterion: string;
  standard?: string;
  value: string;
  measurementMethod: string;
  tolerance?: string;
}

export interface ToleranceSpec {
  element: string;
  dimension: string;
  nominalValue: string;
  plusTolerance: string;
  minusTolerance: string;
  standard?: string;
}

export interface ReceptionProcedure {
  stages: ReceptionStage[];
  reservationHandling: ReservationHandling;
  documentation: string[];
}

export interface ReceptionStage {
  name: string;
  timing: string;
  participants: string[];
  checks: string[];
  document: string;
}

export interface ReservationHandling {
  majorReservationDeadline: string;
  minorReservationDeadline: string;
  retentionPercentage: number;
  releaseConditions: string[];
}

// -----------------------------------------------------------------------------
// Section 3.X.6 : Garanties
// -----------------------------------------------------------------------------

export interface WarrantyRequirement {
  type: WarrantyType;
  duration: number;          // années
  coverage: string;
  exclusions?: string[];
  conditions: string[];
  documents: string[];
}

export type WarrantyType =
  | 'parfait_achevement'     // 1 an
  | 'biennale'               // 2 ans (équipements)
  | 'decennale'              // 10 ans (structure)
  | 'fabricant'              // Garantie fabricant
  | 'extended';              // Garantie étendue

// -----------------------------------------------------------------------------
// Interfaces entre lots
// -----------------------------------------------------------------------------

export interface LotInterface {
  withLot: string;           // Numéro lot
  description: string;
  coordination: string[];
  responsibleFor: string[];
}

// =============================================================================
// ARTICLE 4 : DOCUMENTS ENTREPRISE
// =============================================================================

export interface ContractorDocumentRequirements {
  beforeStart: BeforeStartDocuments;
  duringWorks: DuringWorksDocuments;
  atCompletion: CompletionDocuments;
}

export interface BeforeStartDocuments {
  required: ContractorDocument[];
  deadline: string;          // Relatif au démarrage
}

export interface DuringWorksDocuments {
  required: ContractorDocument[];
  frequency: string;
}

export interface CompletionDocuments {
  required: ContractorDocument[];
  deadline: string;          // Relatif à la réception
}

export interface ContractorDocument {
  name: string;
  description: string;
  format?: string;
  template?: boolean;
  mandatory: boolean;
}

// =============================================================================
// ARTICLE 5 : DÉLAIS
// =============================================================================

export interface SchedulingRequirements {
  // Dates prévisionnelles
  provisionalDates: ProvisionalDates;

  // Durées d'exécution
  executionDurations: ExecutionDuration[];

  // Phasage
  phasing: ProjectPhase[];

  // Pénalités
  penalties: PenaltyClause[];

  // Conditions de prolongation
  extensionConditions: ExtensionCondition[];
}

export interface ProvisionalDates {
  expectedStartDate?: string;
  latestStartDate?: string;
  expectedEndDate?: string;
  keyMilestones: Milestone[];
}

export interface Milestone {
  name: string;
  date?: string;
  weekFromStart?: number;
  description: string;
  critical: boolean;
}

export interface ExecutionDuration {
  lot: string;
  durationWeeks: number;
  durationDays?: number;
  type: 'working_days' | 'calendar_days';
  conditions?: string[];
}

export interface ProjectPhase {
  number: number;
  name: string;
  description: string;
  lots: string[];
  startWeek: number;
  durationWeeks: number;
  predecessors?: number[];
  successors?: number[];
  milestones?: string[];
}

export interface PenaltyClause {
  type: PenaltyType;
  amountPerDay: number;
  currency: string;
  maxAmount?: number;
  maxPercentage?: number;
  conditions: string[];
  exemptions?: string[];
}

export type PenaltyType =
  | 'delay'                  // Retard d'exécution
  | 'partial_delay'          // Retard partiel
  | 'non_compliance'         // Non-conformité
  | 'safety_violation'       // Violation sécurité
  | 'environmental';         // Non-respect environnement

export interface ExtensionCondition {
  cause: ExtensionCause;
  procedure: string;
  documentation: string[];
  approval: string;
}

export type ExtensionCause =
  | 'weather'                // Intempéries
  | 'unforeseen'             // Imprévus techniques
  | 'client_request'         // Demande client
  | 'regulatory'             // Contrainte réglementaire
  | 'force_majeure';

// =============================================================================
// ARTICLE 6 : CONDITIONS FINANCIÈRES
// =============================================================================

export interface FinancialConditions {
  // Montant
  contractAmount: ContractAmount;

  // Modalités de règlement
  paymentTerms: PaymentTerms;

  // Révision des prix
  priceRevision?: PriceRevision;

  // Retenue de garantie
  retentionGuarantee: RetentionGuarantee;
}

export interface ContractAmount {
  type: 'lump_sum' | 'unit_prices' | 'mixed';
  estimatedAmountHT: EstimationRange;
  vatRate: number;
  estimatedAmountTTC: EstimationRange;
  contingency?: number;      // %
}

export interface PaymentTerms {
  // Échéancier
  paymentSchedule: PaymentMilestone[];

  // Délai de paiement
  paymentDelay: number;      // jours
  paymentDelayType: 'invoice_date' | 'invoice_receipt' | 'month_end';

  // Acomptes
  advancePayment?: AdvancePayment;

  // Pénalités de retard paiement
  latePaymentPenalty: number; // % annuel
}

export interface PaymentMilestone {
  description: string;
  percentage: number;
  trigger: string;
  conditions?: string[];
}

export interface AdvancePayment {
  percentage: number;
  maxAmount?: number;
  guarantee: 'bank_guarantee' | 'retention' | 'none';
  refundMethod: string;
}

export interface PriceRevision {
  applicable: boolean;
  formula: string;
  indices: PriceIndex[];
  revisionFrequency: string;
  baseDate: string;
}

export interface PriceIndex {
  code: string;              // Ex: BT01, TP01
  name: string;
  weight: number;            // %
  source: string;
}

export interface RetentionGuarantee {
  percentage: number;        // Généralement 5%
  releaseConditions: string[];
  substitution: 'bank_guarantee' | 'retention_only';
}

// =============================================================================
// ARTICLE 7 : CLAUSES PARTICULIÈRES
// =============================================================================

export interface SpecialClauses {
  // Assurances
  insuranceRequirements: InsuranceRequirements;

  // Sous-traitance
  subcontractingRules: SubcontractingRules;

  // Propriété intellectuelle
  intellectualProperty: IntellectualPropertyClause;

  // Confidentialité
  confidentiality: ConfidentialityClause;

  // Litiges
  disputeResolution: DisputeResolutionClause;

  // Clauses environnementales
  environmentalClauses?: EnvironmentalClause[];

  // Clauses sociales
  socialClauses?: SocialClause[];
}

export interface InsuranceRequirements {
  decennalInsurance: InsuranceRequirement;
  civilLiability: InsuranceRequirement;
  professionalRisk?: InsuranceRequirement;
  allRiskConstruction?: InsuranceRequirement;
  damageInsurance?: InsuranceRequirement;
}

export interface InsuranceRequirement {
  required: boolean;
  minCoverage?: number;
  specificConditions?: string[];
  certificateRequired: boolean;
}

export interface SubcontractingRules {
  allowed: boolean;
  declarationRequired: boolean;
  approvalRequired: boolean;
  directPayment: boolean;
  directPaymentThreshold?: number;
  restrictions?: string[];
}

export interface IntellectualPropertyClause {
  plansOwnership: 'client' | 'contractor' | 'shared';
  usageRights: string[];
  restrictions: string[];
}

export interface ConfidentialityClause {
  applicable: boolean;
  scope: string[];
  duration: string;
  exceptions?: string[];
}

export interface DisputeResolutionClause {
  amicableAttempt: boolean;
  amicableDuration: string;
  mediation?: boolean;
  mediator?: string;
  competentCourt: string;
  applicableLaw: string;
}

export interface EnvironmentalClause {
  type: string;
  requirement: string;
  verification: string;
}

export interface SocialClause {
  type: string;
  requirement: string;
  verification: string;
}

// =============================================================================
// ANNEXES
// =============================================================================

export interface CCTPAppendix {
  id: string;
  code: string;              // Ex: A1, A2
  title: string;
  type: AppendixType;
  description: string;
  documentUrl?: string;
  pages?: number;
}

export type AppendixType =
  | 'plans'                  // Plans
  | 'dpgf'                   // Détail Prix Global Forfaitaire
  | 'bpu'                    // Bordereau Prix Unitaires
  | 'technical_sheets'       // Fiches techniques
  | 'standards_extract'      // Extraits normes
  | 'photos'                 // Photos
  | 'diagnostics'            // Rapports diagnostics
  | 'permits'                // Autorisations
  | 'other';

// =============================================================================
// GÉNÉRATION ET BIBLIOTHÈQUE
// =============================================================================

export interface CCTPGenerationInfo {
  generatedAt: string;
  generatedBy: 'ai' | 'manual' | 'hybrid';
  templateUsed?: string;
  completeness: number;      // %
  reviewStatus: 'pending' | 'reviewed' | 'approved';
  highlightedSections: HighlightedSection[];
  warnings: CCTPWarning[];
}

export interface HighlightedSection {
  section: string;
  reason: 'incomplete' | 'needs_review' | 'custom_input_required';
  description: string;
}

export interface CCTPWarning {
  section: string;
  message: string;
  severity: 'info' | 'warning' | 'error';
}

// =============================================================================
// BIBLIOTHÈQUE DE MATÉRIAUX
// =============================================================================

export interface MaterialLibrary {
  categories: MaterialLibraryCategory[];
  totalItems: number;
  lastUpdated: string;
  sources: string[];
}

export interface MaterialLibraryCategory {
  id: string;
  name: string;
  subcategories: MaterialLibrarySubcategory[];
}

export interface MaterialLibrarySubcategory {
  id: string;
  name: string;
  items: MaterialLibraryItem[];
}

export interface MaterialLibraryItem {
  id: string;
  name: string;
  description: string;
  specifications: MaterialSpecification;
  averagePrice: MaterialPrice;
  popularity: number;        // Usage count
  rating?: number;           // Note moyenne
  alternatives?: string[];   // IDs matériaux équivalents
}

// =============================================================================
// DPGF (Détail Quantitatif Estimatif)
// =============================================================================

export interface DPGF {
  id: string;
  projectId: string;
  cctpId: string;

  // En-tête
  header: DPGFHeader;

  // Lots
  lots: DPGFLot[];

  // Totaux
  totals: DPGFTotals;

  // Métadonnées
  metadata: DPGFMetadata;
}

export interface DPGFHeader {
  projectTitle: string;
  projectReference: string;
  date: string;
  version: string;
  currency: string;
}

export interface DPGFLot {
  number: number;
  code: string;
  name: string;
  items: DPGFItem[];
  subtotalHT: number;
}

export interface DPGFItem {
  id: string;
  reference: string;
  description: string;
  unit: QuantityUnit;
  quantity: number;
  unitPriceHT?: number;
  totalHT?: number;
  notes?: string;
}

export interface DPGFTotals {
  subtotalHT: number;
  contingency: number;
  contingencyAmount: number;
  totalHT: number;
  vatRate: number;
  vatAmount: number;
  totalTTC: number;
}

export interface DPGFMetadata {
  generatedAt: string;
  priceSource: string;
  priceDate: string;
  confidence: ConfidenceLevel;
  exportFormats: ('xlsx' | 'pdf' | 'csv')[];
}

// =============================================================================
// PLANNING TRAVAUX
// =============================================================================

export interface WorksPlanning {
  id: string;
  projectId: string;

  // Paramètres
  parameters: PlanningParameters;

  // Phases
  phases: PlanningPhase[];

  // Chemin critique
  criticalPath: CriticalPathItem[];

  // Jalons
  milestones: PlanningMilestone[];

  // Ressources
  resources?: ResourcePlanning;
}

export interface PlanningParameters {
  startDate: string;
  workingDaysPerWeek: number;
  hoursPerDay: number;
  holidays: string[];
  weatherBuffer: number;     // % pour intempéries
}

export interface PlanningPhase {
  id: string;
  name: string;
  lot: string;
  startDay: number;
  duration: number;
  endDay: number;
  predecessors: string[];
  isCritical: boolean;
  slack: number;             // Marge en jours
  resources?: string[];
}

export interface CriticalPathItem {
  phaseId: string;
  phaseName: string;
  startDay: number;
  endDay: number;
}

export interface PlanningMilestone {
  id: string;
  name: string;
  day: number;
  date?: string;
  type: 'start' | 'phase_end' | 'inspection' | 'delivery' | 'final';
  dependencies?: string[];
}

export interface ResourcePlanning {
  labor: LaborResource[];
  equipment: EquipmentResource[];
  materials: MaterialDelivery[];
}

export interface LaborResource {
  trade: string;
  days: number;
  phases: string[];
}

export interface EquipmentResource {
  equipment: string;
  days: number;
  phases: string[];
  rental: boolean;
}

export interface MaterialDelivery {
  material: string;
  deliveryDay: number;
  phase: string;
}
