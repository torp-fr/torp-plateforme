/**
 * TORP Phase 0 - Types Faisabilité Technique et Réglementaire
 * Module 0.4 : Faisabilité du Projet
 *
 * Couvre toutes les contraintes réglementaires et techniques applicables
 * en France pour les projets de construction et rénovation
 */

import type {
  ConfidenceLevel,
  Priority,
  EstimationRange,
  DocumentReference,
  TORPMetadata,
  Address,
} from './common.types';

// =============================================================================
// RAPPORT DE FAISABILITÉ GLOBAL
// =============================================================================

export interface FeasibilityReport {
  id: string;
  projectId: string;
  propertyId: string;

  // Synthèse globale
  overallFeasibility: FeasibilityStatus;
  feasibilityScore: number; // 0-100
  riskLevel: 'low' | 'medium' | 'high' | 'critical';

  // Analyse réglementaire
  regulatoryAnalysis: RegulatoryAnalysis;

  // Analyse technique
  technicalAnalysis: TechnicalAnalysis;

  // Contraintes copropriété
  condoConstraints?: CondoConstraintsAnalysis;

  // Contraintes de voisinage
  neighborhoodConstraints: NeighborhoodConstraints;

  // Accessibilité PMR/ERP
  accessibilityRequirements?: AccessibilityRequirements;

  // Normes techniques obligatoires
  technicalStandards: TechnicalStandardsAnalysis;

  // Check-list réglementaire
  regulatoryChecklist: RegulatoryChecklistItem[];

  // Autorisations nécessaires
  requiredAuthorizations: RequiredAuthorization[];

  // Risques et points d'attention
  risks: FeasibilityRisk[];

  // Recommandations
  recommendations: FeasibilityRecommendation[];

  // Dossier administratif pré-rempli
  administrativeDocuments?: AdministrativeDocumentPreparation;

  torpMetadata: TORPMetadata;
}

export type FeasibilityStatus =
  | 'feasible'           // Réalisable sans contrainte majeure
  | 'feasible_with_conditions' // Réalisable sous conditions
  | 'complex'            // Complexe mais réalisable
  | 'requires_study'     // Nécessite études complémentaires
  | 'not_feasible';      // Non réalisable

// =============================================================================
// ANALYSE RÉGLEMENTAIRE
// =============================================================================

export interface RegulatoryAnalysis {
  // PLU et urbanisme
  urbanPlanning: UrbanPlanningAnalysis;

  // Autorisations d'urbanisme
  urbanPermits: UrbanPermitsAnalysis;

  // Patrimoine et protection
  heritageConstraints: HeritageConstraintsAnalysis;

  // Servitudes
  easements: EasementsAnalysis;

  // Contraintes environnementales
  environmentalConstraints: EnvironmentalConstraintsAnalysis;
}

// -----------------------------------------------------------------------------
// PLU - Plan Local d'Urbanisme
// -----------------------------------------------------------------------------

export interface UrbanPlanningAnalysis {
  // Document d'urbanisme applicable
  applicableDocument: UrbanPlanningDocument;

  // Zone PLU
  pluZone: PLUZone;

  // Règles applicables
  applicableRules: PLURules;

  // Conformité du projet
  projectCompliance: PLUComplianceAnalysis;

  // Dérogations possibles
  possibleDerogations: PLUDerogation[];
}

export interface UrbanPlanningDocument {
  type: UrbanPlanningDocumentType;
  name: string;
  approvalDate: string;
  lastRevisionDate?: string;
  municipality: string;
  epci?: string;
  documentUrl?: string;
}

export type UrbanPlanningDocumentType =
  | 'plu'     // Plan Local d'Urbanisme
  | 'plui'    // PLU Intercommunal
  | 'pos'     // Plan d'Occupation des Sols (ancien)
  | 'rnu'     // Règlement National d'Urbanisme
  | 'carte_communale'
  | 'scot';   // Schéma de Cohérence Territoriale

export interface PLUZone {
  code: string;          // Ex: UA, UB, AU, A, N
  name: string;          // Ex: "Zone urbaine centre"
  type: PLUZoneType;
  subZone?: string;      // Ex: UA1, UA2
  description: string;
  constructionAllowed: boolean;
  extensionAllowed: boolean;
  renovationAllowed: boolean;
}

export type PLUZoneType =
  | 'U'   // Urbaine
  | 'AU'  // À Urbaniser
  | 'A'   // Agricole
  | 'N';  // Naturelle

export interface PLURules {
  // Article 1 & 2 : Occupations et utilisations du sol
  allowedOccupations: OccupationRule[];
  forbiddenOccupations: OccupationRule[];
  conditionalOccupations: OccupationRule[];

  // Article 3 : Accès et voirie
  accessRules: AccessRule;

  // Article 4 : Réseaux
  networkRules: NetworkRule;

  // Article 5 : Superficie minimale
  minimumPlotSize?: number;

  // Article 6 : Implantation par rapport aux voies
  roadSetback: SetbackRule;

  // Article 7 : Implantation par rapport aux limites
  boundarySetback: SetbackRule;

  // Article 8 : Implantation des constructions entre elles
  buildingSpacing?: SetbackRule;

  // Article 9 : Emprise au sol
  groundCoverage: GroundCoverageRule;

  // Article 10 : Hauteur maximale
  maxHeight: HeightRule;

  // Article 11 : Aspect extérieur
  aestheticRules: AestheticRules;

  // Article 12 : Stationnement
  parkingRules: ParkingRules;

  // Article 13 : Espaces verts
  greenSpaceRules: GreenSpaceRules;

  // Article 14 : COS (si applicable)
  cos?: number;

  // Bonus de constructibilité
  densityBonuses?: DensityBonus[];
}

export interface OccupationRule {
  type: string;
  description: string;
  conditions?: string[];
  derogationPossible: boolean;
}

export interface AccessRule {
  minWidth: number;          // m
  minWidthTwoWay?: number;   // m pour double sens
  maxGradient?: number;      // %
  surfaceType?: string;
  visibilityRequirement?: string;
  emergencyAccessRequired: boolean;
}

export interface NetworkRule {
  waterSupply: 'mandatory' | 'collective' | 'individual_allowed';
  sewerage: 'collective_mandatory' | 'individual_allowed' | 'individual_only';
  electricity: 'mandatory' | 'optional';
  telecommunications: 'mandatory' | 'optional';
  gasAvailable: boolean;
  rainwaterManagement: RainwaterManagementRule;
}

export interface RainwaterManagementRule {
  onSiteRetention: boolean;
  maxFlowRate?: number;       // l/s/ha
  retentionVolume?: number;   // l/m² imperméabilisé
  permeableSurfaces?: number; // % minimum
}

export interface SetbackRule {
  minimum: number;            // m
  formula?: string;           // Ex: H/2 avec minimum 3m
  exceptions?: SetbackException[];
  applicableTo: 'all' | 'main_building' | 'annexes';
}

export interface SetbackException {
  condition: string;
  value: number;
}

export interface GroundCoverageRule {
  maxPercentage: number;     // %
  calculationMethod: string;
  exclusions?: string[];     // Éléments exclus du calcul
}

export interface HeightRule {
  maxAbsolute?: number;      // m
  maxLevels?: number;        // Nombre d'étages
  maxEaves?: number;         // m à l'égout
  maxRidge?: number;         // m au faîtage
  calculationMethod: HeightCalculationMethod;
  exceptions?: HeightException[];
}

export type HeightCalculationMethod =
  | 'natural_ground'         // Terrain naturel
  | 'finished_ground'        // Terrain fini
  | 'public_road'            // Voie publique
  | 'average_ground';        // Moyenne du terrain

export interface HeightException {
  element: string;
  allowedOverhang: number;
}

export interface AestheticRules {
  // Toiture
  roofType?: RoofTypeRule;
  roofSlope?: RoofSlopeRule;
  roofMaterials?: MaterialRule[];
  roofColors?: ColorRule;

  // Façade
  facadeMaterials?: MaterialRule[];
  facadeColors?: ColorRule;
  facadeFinishes?: string[];

  // Menuiseries
  windowMaterials?: MaterialRule[];
  windowColors?: ColorRule;
  shutterType?: ShutterTypeRule;
  shutterColors?: ColorRule;

  // Clôtures
  fenceHeight?: FenceHeightRule;
  fenceMaterials?: MaterialRule[];

  // Autres
  solarPanels?: SolarPanelRule;
  airConditioning?: ACUnitRule;
  antennas?: AntennaRule;
}

export interface RoofTypeRule {
  allowed: string[];
  forbidden?: string[];
  localRestrictions?: string;
}

export interface RoofSlopeRule {
  min?: number;              // degrés
  max?: number;
  preferred?: number;
}

export interface MaterialRule {
  allowed: string[];
  forbidden?: string[];
  preferred?: string[];
  localSpecificity?: string;
}

export interface ColorRule {
  allowed?: string[];        // Codes RAL ou descriptions
  forbidden?: string[];
  palette?: string;          // Référence palette locale
}

export interface ShutterTypeRule {
  allowed: string[];
  mandatory?: boolean;
}

export interface FenceHeightRule {
  maxStreet: number;         // m côté rue
  maxBoundary: number;       // m côté limite
  solidPartMax?: number;     // m partie pleine
}

export interface SolarPanelRule {
  allowed: boolean;
  integration: 'flush' | 'any' | 'forbidden';
  colorRestriction?: string;
}

export interface ACUnitRule {
  facadeAllowed: boolean;
  roofAllowed: boolean;
  groundAllowed: boolean;
  concealmentRequired: boolean;
}

export interface AntennaRule {
  parabolicAllowed: boolean;
  heightLimit?: number;
  concealmentRequired: boolean;
}

export interface ParkingRules {
  housing: ParkingRequirement;
  commercial?: ParkingRequirement;
  office?: ParkingRequirement;
  bicycleParking: BicycleParkingRequirement;
  handicappedParking: boolean;
}

export interface ParkingRequirement {
  ratioPerUnit?: number;     // Places par logement
  ratioPerSurface?: number;  // Places par m² SHON
  minSpaces?: number;
  maxSpaces?: number;
  mutualisation?: boolean;
}

export interface BicycleParkingRequirement {
  ratioPerUnit?: number;
  ratioPerSurface?: number;
  covered: boolean;
  secure: boolean;
}

export interface GreenSpaceRules {
  minPercentage: number;     // %
  treesRequired?: TreeRequirement;
  vegetationTypes?: string[];
  permeableSurfaces?: number;
}

export interface TreeRequirement {
  ratioPerSurface?: number;  // arbres / m²
  species?: string[];
  preservation: boolean;
}

export interface DensityBonus {
  type: DensityBonusType;
  bonusPercentage: number;
  conditions: string[];
}

export type DensityBonusType =
  | 'social_housing'         // Logement social
  | 'energy_performance'     // Performance énergétique
  | 'mixed_use'              // Mixité fonctionnelle
  | 'accessibility';         // Accessibilité

export interface PLUComplianceAnalysis {
  overall: ComplianceStatus;
  items: PLUComplianceItem[];
  requiredModifications?: ProjectModification[];
}

export type ComplianceStatus =
  | 'compliant'
  | 'partially_compliant'
  | 'non_compliant'
  | 'requires_verification';

export interface PLUComplianceItem {
  rule: string;
  article: string;
  requirement: string;
  projectValue: string;
  compliance: ComplianceStatus;
  deviation?: string;
  derogationPossible: boolean;
}

export interface ProjectModification {
  description: string;
  reason: string;
  impact: 'minor' | 'moderate' | 'major';
  costImpact?: EstimationRange;
}

export interface PLUDerogation {
  article: string;
  rule: string;
  derogationType: DerogationType;
  justification: string;
  likelihood: 'likely' | 'possible' | 'unlikely';
  procedure: string;
}

export type DerogationType =
  | 'minor_adaptation'       // Adaptation mineure
  | 'alternative_compliance' // Solution alternative
  | 'public_interest'        // Intérêt public
  | 'impossibility';         // Impossibilité technique

// -----------------------------------------------------------------------------
// Autorisations d'urbanisme
// -----------------------------------------------------------------------------

export interface UrbanPermitsAnalysis {
  // Autorisation nécessaire
  requiredPermit: UrbanPermitType;
  permitDetermination: PermitDetermination;

  // Cas de dispense
  exemptions?: PermitExemption[];

  // Procédure
  procedure: PermitProcedure;

  // Pièces à fournir
  requiredDocuments: PermitDocument[];

  // Délais
  timeline: PermitTimeline;

  // Taxes
  taxes: UrbanTaxes;
}

export type UrbanPermitType =
  | 'none'                   // Pas d'autorisation requise
  | 'dp'                     // Déclaration Préalable
  | 'pc'                     // Permis de Construire
  | 'pa'                     // Permis d'Aménager
  | 'pd'                     // Permis de Démolir
  | 'pc_pd';                 // PC + Permis de Démolir

export interface PermitDetermination {
  reason: string;
  criteria: PermitCriterion[];
  surfaceCreated?: number;
  surfaceModified?: number;
  heightModified?: number;
  facadeModified: boolean;
  structureModified: boolean;
  useChanged: boolean;
  inProtectedZone: boolean;
}

export interface PermitCriterion {
  criterion: string;
  projectValue: string;
  threshold: string;
  triggers: UrbanPermitType;
}

export interface PermitExemption {
  type: string;
  conditions: string[];
  applicable: boolean;
}

export interface PermitProcedure {
  instructionService: string;
  submissionMethod: 'online' | 'paper' | 'both';
  onlinePortalUrl?: string;
  consultationsRequired: ConsultationRequired[];
  publicInquiry?: PublicInquiryInfo;
}

export interface ConsultationRequired {
  authority: ConsultingAuthority;
  reason: string;
  timeline: number;          // jours
  bindingOpinion: boolean;
}

export type ConsultingAuthority =
  | 'abf'                    // Architecte des Bâtiments de France
  | 'sdis'                   // Service Incendie
  | 'ddtm'                   // Direction Départementale des Territoires
  | 'drac'                   // Direction Régionale des Affaires Culturelles
  | 'commission_securite'    // Commission de sécurité
  | 'commission_accessibilite'
  | 'spanc'                  // Assainissement non collectif
  | 'gestionnaire_reseaux';

export interface PublicInquiryInfo {
  required: boolean;
  reason?: string;
  duration?: number;         // jours
}

export interface PermitDocument {
  code: string;              // Ex: PCMI1, DP1
  name: string;
  description: string;
  mandatory: boolean;
  copies: number;
  format: DocumentFormat;
  contentRequirements?: string[];
  canBeAutogenerated: boolean;
}

export type DocumentFormat =
  | 'plan'
  | 'notice'
  | 'photo'
  | 'certificate'
  | 'form';

export interface PermitTimeline {
  instructionDelay: number;  // mois
  additionalDelay?: number;  // si ABF, commission, etc.
  totalDelay: number;
  validityPeriod: number;    // années
  extensionPossible: boolean;
  extensionDelay?: number;
  workStartDeadline: number; // années après obtention
}

export interface UrbanTaxes {
  taxeAmenagement: TaxeAmenagement;
  redevanceArcheologie?: RedevanceArcheologie;
  participationVRD?: ParticipationVRD;
}

export interface TaxeAmenagement {
  applicable: boolean;
  taxableSurface: number;    // m²
  forfaitValue: number;      // €/m² (valeur 2024)
  communalRate: number;      // %
  departmentalRate: number;  // %
  regionalRate?: number;     // % (Île-de-France)
  estimatedAmount: number;
  exemptions?: TaxExemption[];
  reductions?: TaxReduction[];
  paymentSchedule: PaymentSchedule[];
}

export interface TaxExemption {
  type: string;
  surface: number;
  reason: string;
}

export interface TaxReduction {
  type: string;
  percentage: number;
  reason: string;
}

export interface PaymentSchedule {
  dueDate: string;           // Relative à l'achèvement
  percentage: number;
  amount: number;
}

export interface RedevanceArcheologie {
  applicable: boolean;
  taxableSurface: number;
  rate: number;              // €/m²
  estimatedAmount: number;
}

export interface ParticipationVRD {
  applicable: boolean;
  type: 'pup' | 'ppe' | 'projet_urbain';
  estimatedAmount?: number;
}

// -----------------------------------------------------------------------------
// Patrimoine et Protection
// -----------------------------------------------------------------------------

export interface HeritageConstraintsAnalysis {
  isProtected: boolean;
  protectionType?: HeritageProtectionType;
  constraints: HeritageConstraint[];
  abfConsultation: ABFConsultation;
  allowedInterventions: AllowedIntervention[];
  forbiddenInterventions: ForbiddenIntervention[];
}

export type HeritageProtectionType =
  | 'monument_historique_classe'
  | 'monument_historique_inscrit'
  | 'site_patrimoine_remarquable'
  | 'abords_monument_historique'
  | 'site_classe'
  | 'site_inscrit'
  | 'zppaup'
  | 'avap'
  | 'psmv';

export interface HeritageConstraint {
  type: HeritageConstraintType;
  description: string;
  elements: string[];
  flexibility: 'strict' | 'negotiable' | 'advisory';
  impactOnProject: string;
}

export type HeritageConstraintType =
  | 'material'
  | 'color'
  | 'height'
  | 'volume'
  | 'opening'
  | 'roof'
  | 'facade'
  | 'alignment'
  | 'visibility';

export interface ABFConsultation {
  required: boolean;
  reason?: string;
  type: ABFConsultationType;
  expectedDelay: number;     // jours
  localPractice?: string;
  contactInfo?: ABFContactInfo;
  tips?: string[];
}

export type ABFConsultationType =
  | 'avis_simple'            // Avis simple
  | 'avis_conforme'          // Avis conforme (obligatoire)
  | 'autorisation_speciale'; // Autorisation spéciale travaux

export interface ABFContactInfo {
  udap: string;              // Unité Départementale de l'Architecture et du Patrimoine
  address: Address;
  phone?: string;
  email?: string;
  consultationDays?: string;
}

export interface AllowedIntervention {
  type: string;
  conditions: string[];
  abfValidation: boolean;
}

export interface ForbiddenIntervention {
  type: string;
  reason: string;
  alternative?: string;
}

// -----------------------------------------------------------------------------
// Servitudes
// -----------------------------------------------------------------------------

export interface EasementsAnalysis {
  hasEasements: boolean;
  easements: Easement[];
  impactOnProject: EasementImpact[];
}

export interface Easement {
  type: EasementType;
  reference: string;
  description: string;
  beneficiary?: string;
  grantingDocument?: string;
  registrationDate?: string;
  zone?: string;
  constraints: string[];
}

export type EasementType =
  // Servitudes d'utilité publique
  | 'sup_monument_historique'
  | 'sup_site_inscrit'
  | 'sup_canalisations'
  | 'sup_lignes_electriques'
  | 'sup_telecommunications'
  | 'sup_alignement'
  | 'sup_inondation'
  // Servitudes privées
  | 'passage'
  | 'vue'
  | 'eaux_pluviales'
  | 'egout'
  | 'cour_commune'
  | 'mitoyennete';

export interface EasementImpact {
  easement: string;
  impact: string;
  restriction: string;
  workaround?: string;
}

// -----------------------------------------------------------------------------
// Contraintes Environnementales
// -----------------------------------------------------------------------------

export interface EnvironmentalConstraintsAnalysis {
  // Zones naturelles
  naturalZones: NaturalZoneConstraint[];

  // Eau
  waterConstraints: WaterConstraint[];

  // Biodiversité
  biodiversityConstraints: BiodiversityConstraint[];

  // Études d'impact
  impactStudyRequired: boolean;
  impactStudyType?: string;

  // Autorisations environnementales
  environmentalAuthorizations: EnvironmentalAuthorization[];
}

export interface NaturalZoneConstraint {
  type: NaturalZoneType;
  name: string;
  distance?: number;
  constraints: string[];
  impactOnProject: string;
}

export type NaturalZoneType =
  | 'natura2000'
  | 'znieff'
  | 'reserve_naturelle'
  | 'parc_national'
  | 'parc_regional'
  | 'zone_humide'
  | 'espace_boise_classe';

export interface WaterConstraint {
  type: WaterConstraintType;
  description: string;
  constraints: string[];
}

export type WaterConstraintType =
  | 'captage_eau'
  | 'cours_eau'
  | 'zone_humide'
  | 'nappe_phreatique';

export interface BiodiversityConstraint {
  type: string;
  species?: string[];
  constraints: string[];
  studyRequired: boolean;
}

export interface EnvironmentalAuthorization {
  type: string;
  required: boolean;
  reason?: string;
  procedure?: string;
  delay?: number;
}

// =============================================================================
// ANALYSE TECHNIQUE
// =============================================================================

export interface TechnicalAnalysis {
  // Faisabilité structurelle
  structuralFeasibility: StructuralFeasibility;

  // Raccordements réseaux
  networkConnections: NetworkConnectionsAnalysis;

  // Accès chantier
  siteAccess: SiteAccessAnalysis;

  // Contraintes techniques spécifiques
  specificConstraints: TechnicalConstraint[];
}

export interface StructuralFeasibility {
  overall: FeasibilityStatus;
  structuralCapacity: StructuralCapacityAssessment;
  foundationRequirements: FoundationRequirements;
  modifications: StructuralModificationFeasibility[];
}

export interface StructuralCapacityAssessment {
  currentCapacity: 'adequate' | 'marginal' | 'insufficient' | 'unknown';
  loadIncreaseAcceptable: boolean;
  reinforcementNeeded: boolean;
  engineerStudyRequired: boolean;
}

export interface FoundationRequirements {
  currentFoundations: string;
  adequate: boolean;
  modificationsNeeded?: string[];
  soilStudyRequired: boolean;
  specialFoundationsNeeded: boolean;
  specialFoundationType?: string;
  estimatedCost?: EstimationRange;
}

export interface StructuralModificationFeasibility {
  modification: string;
  feasible: boolean;
  complexity: 'simple' | 'moderate' | 'complex';
  requirements: string[];
  estimatedCost?: EstimationRange;
  duration?: string;
}

export interface NetworkConnectionsAnalysis {
  electricity: NetworkConnectionStatus;
  water: NetworkConnectionStatus;
  sewer: NetworkConnectionStatus;
  gas?: NetworkConnectionStatus;
  telecommunications: NetworkConnectionStatus;
  district_heating?: NetworkConnectionStatus;
}

export interface NetworkConnectionStatus {
  available: boolean;
  connectionType: 'existing' | 'extension_needed' | 'not_available';
  distance?: number;         // m
  capacity: 'adequate' | 'upgrade_needed' | 'unknown';
  upgradeRequired?: string;
  estimatedCost?: EstimationRange;
  delay?: string;
  provider?: string;
  procedures?: string[];
}

export interface SiteAccessAnalysis {
  vehicleAccess: VehicleAccessAssessment;
  materialDelivery: MaterialDeliveryAssessment;
  equipmentAccess: EquipmentAccessAssessment;
  storageArea: StorageAreaAssessment;
}

export interface VehicleAccessAssessment {
  accessible: boolean;
  accessWidth: number;       // m
  accessHeight?: number;     // m (portail, passage)
  gradient?: number;         // %
  turningSpace: boolean;
  restrictions: string[];
}

export interface MaterialDeliveryAssessment {
  directAccess: boolean;
  handlingDistance?: number; // m
  craneRequired: boolean;
  restrictedHours?: string;
  permitRequired: boolean;
}

export interface EquipmentAccessAssessment {
  scaffoldingPossible: boolean;
  scaffoldingRestrictions?: string[];
  craneAccessible: boolean;
  craneType?: string;
  excavatorAccessible: boolean;
  publicSpaceOccupation: boolean;
  neighborAuthorization: boolean;
}

export interface StorageAreaAssessment {
  onSiteStorage: boolean;
  storageSurface?: number;   // m²
  offSiteStorageNeeded: boolean;
  securityRequired: boolean;
}

export interface TechnicalConstraint {
  type: TechnicalConstraintType;
  description: string;
  impact: 'blocking' | 'major' | 'minor';
  mitigation?: string;
  estimatedCost?: EstimationRange;
}

export type TechnicalConstraintType =
  | 'access_limited'
  | 'structural_limitation'
  | 'network_capacity'
  | 'soil_conditions'
  | 'neighbor_proximity'
  | 'height_restriction'
  | 'noise_restriction'
  | 'vibration_restriction'
  | 'hazardous_materials';

// =============================================================================
// CONTRAINTES COPROPRIÉTÉ
// =============================================================================

export interface CondoConstraintsAnalysis {
  isInCondo: boolean;
  condoType: CondoType;
  rulesAnalysis: CondoRulesAnalysis;
  requiredApprovals: CondoApproval[];
  timeline: CondoTimeline;
  risks: CondoRisk[];
}

export type CondoType =
  | 'vertical'               // Immeuble classique
  | 'horizontal'             // Lotissement
  | 'mixed';

export interface CondoRulesAnalysis {
  regulationRestrictions: CondoRestriction[];
  commonPartsAffected: CommonPartAffected[];
  privatePartsOnly: boolean;
}

export interface CondoRestriction {
  type: CondoRestrictionType;
  description: string;
  source: string;            // Article du règlement
  workaround?: string;
}

export type CondoRestrictionType =
  | 'facade_modification'
  | 'window_replacement'
  | 'balcony_enclosure'
  | 'air_conditioning'
  | 'chimney_flue'
  | 'structural_work'
  | 'use_change'
  | 'noise_work_hours';

export interface CommonPartAffected {
  part: string;
  type: CommonPartType;
  modification: string;
  approvalRequired: boolean;
  majority: VoteMajority;
}

export type CommonPartType =
  | 'structure'
  | 'facade'
  | 'roof'
  | 'hallway'
  | 'staircase'
  | 'elevator'
  | 'basement'
  | 'garden'
  | 'parking'
  | 'networks';

export type VoteMajority =
  | 'simple'                 // Article 24 - Majorité simple
  | 'absolute'               // Article 25 - Majorité absolue
  | 'double'                 // Article 26 - Double majorité
  | 'unanimity';             // Unanimité

export interface CondoApproval {
  type: string;
  decision: string;
  majority: VoteMajority;
  article: string;
  agRequired: boolean;
  agDate?: string;
}

export interface CondoTimeline {
  nextAG?: string;
  convocationDeadline?: string;
  resolutionSubmissionDeadline?: string;
  totalDelay: string;
}

export interface CondoRisk {
  risk: string;
  probability: 'high' | 'medium' | 'low';
  mitigation: string;
}

// =============================================================================
// CONTRAINTES DE VOISINAGE
// =============================================================================

export interface NeighborhoodConstraints {
  // Mitoyenneté
  partyWalls: PartyWallConstraint[];

  // Servitudes de vue
  viewRights: ViewRightConstraint[];

  // Servitudes diverses
  otherEasements: NeighborEasement[];

  // Distance plantations
  plantationDistances: PlantationDistance[];

  // Autorisation voisins
  neighborAuthorizations: NeighborAuthorization[];
}

export interface PartyWallConstraint {
  location: string;
  status: PartyWallStatus;
  coOwner?: string;
  modificationsAllowed: boolean;
  agreementRequired: boolean;
  costSharing: boolean;
}

export type PartyWallStatus =
  | 'mitoyen'                // Mitoyen (copropriété)
  | 'privatif'               // Privatif (un seul propriétaire)
  | 'en_limite';             // En limite de propriété

export interface ViewRightConstraint {
  type: ViewRightType;
  location: string;
  distance: number;          // m
  compliant: boolean;
  modification?: string;
}

export type ViewRightType =
  | 'vue_droite'             // Vue directe (min 1.90m)
  | 'vue_oblique'            // Vue oblique (min 0.60m)
  | 'jours_souffrance';      // Jours de souffrance

export interface NeighborEasement {
  type: string;
  description: string;
  beneficiary?: string;
  constraints: string[];
}

export interface PlantationDistance {
  type: 'tree' | 'hedge' | 'shrub';
  requiredDistance: number;  // m
  currentDistance?: number;
  compliant: boolean;
}

export interface NeighborAuthorization {
  reason: string;
  neighbor: string;
  type: 'written_agreement' | 'verbal_agreement' | 'none_needed';
  obtained?: boolean;
  document?: string;
}

// =============================================================================
// ACCESSIBILITÉ PMR / ERP
// =============================================================================

export interface AccessibilityRequirements {
  // Classification
  buildingClassification: AccessibilityClassification;

  // Obligations applicables
  applicableRegulations: AccessibilityRegulation[];

  // Exigences
  requirements: AccessibilityRequirement[];

  // Conformité actuelle
  currentCompliance: AccessibilityComplianceStatus;

  // Travaux nécessaires
  requiredWorks: AccessibilityWork[];

  // Dérogations possibles
  possibleDerogations: AccessibilityDerogation[];

  // Commission accessibilité
  commissionConsultation?: CommissionConsultation;
}

export interface AccessibilityClassification {
  buildingType: 'housing' | 'erp' | 'workplace';
  category?: number;         // ERP 1-5
  type?: string;             // ERP type (L, M, N, etc.)
  capacity?: number;
  newConstruction: boolean;
  existingBuilding: boolean;
}

export interface AccessibilityRegulation {
  name: string;
  reference: string;
  applicability: string;
}

export interface AccessibilityRequirement {
  category: AccessibilityCategory;
  requirement: string;
  currentStatus: ComplianceStatus;
  workNeeded?: string;
  cost?: EstimationRange;
}

export type AccessibilityCategory =
  | 'entrance'
  | 'circulation'
  | 'stairs'
  | 'elevator'
  | 'doors'
  | 'sanitary'
  | 'parking'
  | 'signage'
  | 'lighting'
  | 'communication';

export interface AccessibilityComplianceStatus {
  overall: ComplianceStatus;
  hasAdap?: boolean;         // Agenda d'Accessibilité Programmée
  adapDeadline?: string;
}

export interface AccessibilityWork {
  category: AccessibilityCategory;
  description: string;
  mandatory: boolean;
  cost: EstimationRange;
  priority: Priority;
}

export interface AccessibilityDerogation {
  category: AccessibilityCategory;
  reason: DerogationReason;
  justification: string;
  compensatoryMeasures?: string[];
  approvalRequired: boolean;
  approvalAuthority?: string;
}

export interface CommissionConsultation {
  required: boolean;
  authority: string;
  documents: string[];
  delay: number;             // jours
}

// =============================================================================
// NORMES TECHNIQUES
// =============================================================================

export interface TechnicalStandardsAnalysis {
  // Thermique
  thermalRegulation: ThermalRegulationAnalysis;

  // Électricité
  electricalStandards: ElectricalStandardsAnalysis;

  // Gaz
  gasStandards?: GasStandardsAnalysis;

  // Assainissement
  sanitationStandards: SanitationStandardsAnalysis;

  // Sécurité incendie
  fireSecurityStandards: FireSecurityAnalysis;

  // DTU applicables
  applicableDTUs: ApplicableDTU[];
}

// -----------------------------------------------------------------------------
// Réglementation Thermique
// -----------------------------------------------------------------------------

export interface ThermalRegulationAnalysis {
  applicableRegulation: ThermalRegulationType;
  requirements: ThermalRequirement[];
  attestations: ThermalAttestation[];
  studyRequired: boolean;
  estimatedCost?: EstimationRange;
}

export type ThermalRegulationType =
  | 're2020'                 // Construction neuve depuis 2022
  | 'rt2012'                 // Construction neuve 2013-2021
  | 'rt_existant_global'     // Rénovation globale >1000m² ou >25%
  | 'rt_existant_element'    // Rénovation par élément
  | 'none';                  // Pas applicable

export interface ThermalRequirement {
  indicator: ThermalIndicator;
  maxValue?: number;
  unit: string;
  applicability: string;
}

export type ThermalIndicator =
  | 'bbio'                   // Besoin Bioclimatique
  | 'cep'                    // Consommation énergie primaire
  | 'cep_nr'                 // Cep non renouvelable
  | 'dh'                     // Degrés-Heures inconfort été
  | 'ic_energie'             // Impact carbone énergie
  | 'ic_construction'        // Impact carbone construction
  | 'u_paroi'                // Coefficient U paroi
  | 'uw'                     // Coefficient Uw fenêtre
  | 'r_isolation';           // Résistance thermique

export interface ThermalAttestation {
  type: ThermalAttestationType;
  stage: 'permit' | 'completion';
  document: string;
  provider: string;
}

export type ThermalAttestationType =
  | 'bbio'                   // Attestation Bbio (dépôt PC)
  | 'rt'                     // Attestation RT/RE (achèvement)
  | 'dpe_neuf';              // DPE neuf

// -----------------------------------------------------------------------------
// Électricité - NF C 15-100
// -----------------------------------------------------------------------------

export interface ElectricalStandardsAnalysis {
  standardVersion: string;   // Version NF C 15-100
  applicableAmendments: string[];
  requirements: ElectricalNormRequirement[];
  consuelRequired: boolean;
}

export interface ElectricalNormRequirement {
  category: ElectricalNormCategory;
  requirement: string;
  minimumValue?: number;
  unit?: string;
}

export type ElectricalNormCategory =
  | 'gtl'                    // Gaine technique logement
  | 'protection'             // Protections (différentiels)
  | 'circuits'               // Nombre de circuits
  | 'prises'                 // Nombre de prises par pièce
  | 'eclairage'              // Points lumineux
  | 'salle_bain'             // Volumes salle de bain
  | 'exterieur'              // Installations extérieures
  | 'communication';         // Réseau communication

// -----------------------------------------------------------------------------
// Gaz - DTU 61.1
// -----------------------------------------------------------------------------

export interface GasStandardsAnalysis {
  applicable: boolean;
  requirements: GasNormRequirement[];
  qualigasRequired: boolean;
}

export interface GasNormRequirement {
  category: string;
  requirement: string;
}

// -----------------------------------------------------------------------------
// Assainissement
// -----------------------------------------------------------------------------

export interface SanitationStandardsAnalysis {
  type: 'collective' | 'individual';
  applicableStandard: string;
  requirements: SanitationRequirement[];
  spancInspection?: boolean;
}

export interface SanitationRequirement {
  element: string;
  requirement: string;
  compliant?: boolean;
}

// -----------------------------------------------------------------------------
// Sécurité Incendie
// -----------------------------------------------------------------------------

export interface FireSecurityAnalysis {
  buildingType: FireSecurityBuildingType;
  applicableRegulation: string;
  requirements: FireSecurityRequirement[];
  commissionRequired: boolean;
}

export type FireSecurityBuildingType =
  | 'habitation'
  | 'erp'
  | 'igh';                   // Immeuble Grande Hauteur

export interface FireSecurityRequirement {
  category: FireSecurityCategory;
  requirement: string;
  applicable: boolean;
  compliant?: boolean;
}

export type FireSecurityCategory =
  | 'daaf'                   // Détecteur fumée
  | 'desenfumage'
  | 'issues_secours'
  | 'eclairage_securite'
  | 'extincteurs'
  | 'compartimentage'
  | 'materiaux';

// -----------------------------------------------------------------------------
// DTU Applicables
// -----------------------------------------------------------------------------

export interface ApplicableDTU {
  reference: string;         // Ex: DTU 31.2
  title: string;
  applicability: string;     // Pourquoi applicable
  mainRequirements: string[];
}

// =============================================================================
// CHECK-LIST ET AUTORISATIONS
// =============================================================================

export interface RegulatoryChecklistItem {
  id: string;
  category: ChecklistCategory;
  item: string;
  status: ChecklistItemStatus;
  details?: string;
  action?: string;
  deadline?: string;
  responsible?: string;
}

export type ChecklistCategory =
  | 'urbanisme'
  | 'patrimoine'
  | 'environnement'
  | 'copropriete'
  | 'voisinage'
  | 'technique'
  | 'securite'
  | 'accessibilite';

export type ChecklistItemStatus =
  | 'ok'
  | 'pending'
  | 'required'
  | 'not_applicable'
  | 'blocking';

export interface RequiredAuthorization {
  id: string;
  type: AuthorizationType;
  name: string;
  authority: string;
  mandatory: boolean;
  status: AuthorizationStatus;
  procedure: string;
  documents: string[];
  delay: string;
  cost?: EstimationRange;
  deadline?: string;
  dependencies?: string[];
}

export type AuthorizationType =
  | 'permit'                 // Autorisation d'urbanisme
  | 'declaration'            // Déclaration
  | 'consultation'           // Consultation obligatoire
  | 'agreement'              // Accord
  | 'inspection'             // Contrôle
  | 'certification';         // Certification

export type AuthorizationStatus =
  | 'not_started'
  | 'in_progress'
  | 'submitted'
  | 'under_review'
  | 'approved'
  | 'refused'
  | 'conditional';

// =============================================================================
// RISQUES ET RECOMMANDATIONS
// =============================================================================

export interface FeasibilityRisk {
  id: string;
  category: RiskCategory;
  description: string;
  probability: 'high' | 'medium' | 'low';
  impact: 'critical' | 'high' | 'medium' | 'low';
  overallRisk: 'critical' | 'high' | 'medium' | 'low';
  mitigation: string;
  contingency?: string;
  owner?: string;
}

export type RiskCategory =
  | 'regulatory'
  | 'technical'
  | 'financial'
  | 'schedule'
  | 'neighbor'
  | 'environmental';

export interface FeasibilityRecommendation {
  id: string;
  priority: Priority;
  category: string;
  title: string;
  description: string;
  rationale: string;
  action: string;
  timeline: string;
  responsible?: string;
  cost?: EstimationRange;
}

// =============================================================================
// DOSSIER ADMINISTRATIF PRÉ-REMPLI
// =============================================================================

export interface AdministrativeDocumentPreparation {
  // Formulaires CERFA
  cerfaForms: CERFAFormPreparation[];

  // Plans réglementaires
  regulatoryPlans: RegulatoryPlanPreparation[];

  // Notice descriptive
  descriptiveNotice?: DescriptiveNoticePreparation;

  // Autres documents
  otherDocuments: OtherDocumentPreparation[];
}

export interface CERFAFormPreparation {
  formNumber: string;        // Ex: 13703*07
  formName: string;
  status: DocumentPreparationStatus;
  prefilledFields: PrefilledField[];
  missingFields: MissingField[];
  documentUrl?: string;
}

export type DocumentPreparationStatus =
  | 'complete'
  | 'partial'
  | 'pending';

export interface PrefilledField {
  field: string;
  value: string;
  source: string;
}

export interface MissingField {
  field: string;
  required: boolean;
  hint?: string;
}

export interface RegulatoryPlanPreparation {
  type: RegulatoryPlanType;
  status: DocumentPreparationStatus;
  canBeAutogenerated: boolean;
  requirements: string[];
  documentUrl?: string;
}

export type RegulatoryPlanType =
  | 'situation'              // Plan de situation
  | 'masse'                  // Plan de masse
  | 'coupe'                  // Plan de coupe
  | 'facades'                // Plan des façades
  | 'toiture'                // Plan de toiture
  | 'insertion_paysagere'    // Insertion paysagère
  | 'environnement_proche'   // Photo environnement proche
  | 'environnement_lointain'; // Photo environnement lointain

export interface DescriptiveNoticePreparation {
  status: DocumentPreparationStatus;
  sections: NoticeSection[];
  documentUrl?: string;
}

export interface NoticeSection {
  title: string;
  content: string;
  complete: boolean;
}

export interface OtherDocumentPreparation {
  name: string;
  type: string;
  required: boolean;
  status: DocumentPreparationStatus;
  notes?: string;
}
