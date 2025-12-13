/**
 * TORP Phase 0 - Types Diagnostics Techniques Détaillés
 * Module 0.3 : Diagnostic de l'Existant
 *
 * Couvre tous les diagnostics obligatoires et recommandés selon la réglementation française
 */

import type {
  ConfidenceLevel,
  Priority,
  EstimationRange,
  DocumentReference,
  TORPMetadata,
} from './common.types';
import type { ConditionGrade, EnergyClass, PrimaryEnergy } from './property.types';

// =============================================================================
// RAPPORT DE DIAGNOSTIC CONSOLIDÉ
// =============================================================================

export interface DiagnosticReport {
  id: string;
  projectId: string;
  propertyId: string;

  // Synthèse globale
  overallScore: number; // 0-100
  overallCondition: ConditionGrade;
  urgencyLevel: DiagnosticUrgency;

  // Diagnostics obligatoires
  mandatoryDiagnostics: MandatoryDiagnosticsBundle;

  // Diagnostics techniques recommandés
  technicalDiagnostics: TechnicalDiagnosticsBundle;

  // État des lieux photographique
  photographicSurvey: PhotographicSurvey;

  // Pathologies identifiées
  pathologies: BuildingPathology[];

  // Matrice des risques
  riskMatrix: RiskMatrixEntry[];

  // Recommandations consolidées
  recommendations: DiagnosticRecommendation[];

  // Impact sur le projet
  projectImpact: ProjectImpactAssessment;

  // Documents sources
  documents: DocumentReference[];

  torpMetadata: TORPMetadata;
}

export type DiagnosticUrgency = 'critical' | 'high' | 'medium' | 'low' | 'informational';

// =============================================================================
// DIAGNOSTICS OBLIGATOIRES
// =============================================================================

export interface MandatoryDiagnosticsBundle {
  dpe?: DPEDiagnosticDetailed;
  asbestos?: AsbestosDiagnosticDetailed;
  lead?: LeadDiagnosticDetailed;
  electricity?: ElectricityDiagnosticDetailed;
  gas?: GasDiagnosticDetailed;
  termites?: TermiteDiagnosticDetailed;
  erp?: ERPDiagnosticDetailed;
  carrez?: CarrezDiagnosticDetailed;
  septicTank?: SepticTankDiagnosticDetailed;
}

// -----------------------------------------------------------------------------
// DPE - Diagnostic de Performance Énergétique
// -----------------------------------------------------------------------------

export interface DPEDiagnosticDetailed {
  id: string;
  type: 'dpe';

  // Informations générales
  date: string;
  expirationDate: string; // Validité 10 ans
  isValid: boolean;
  ademeNumber: string;

  // Diagnostiqueur
  diagnostician: DiagnosticianInfo;

  // Classification
  energyClass: EnergyClass;
  ghgClass: EnergyClass;

  // Consommations
  energyConsumption: number; // kWh/m²/an énergie primaire
  finalEnergyConsumption: number; // kWh/m²/an énergie finale
  ghgEmissions: number; // kgCO2/m²/an

  // Détail par poste
  consumptionBreakdown: EnergyConsumptionBreakdown;

  // Énergies utilisées
  heatingEnergy: PrimaryEnergy;
  hotWaterEnergy?: PrimaryEnergy;
  coolingEnergy?: PrimaryEnergy;

  // Estimation facture
  estimatedAnnualBillLow: number;
  estimatedAnnualBillHigh: number;

  // Caractéristiques du bâti
  buildingEnvelope: BuildingEnvelopeAssessment;

  // Équipements
  equipmentAssessment: EquipmentEnergyAssessment;

  // Énergies renouvelables
  renewableEnergyPercentage: number;
  renewableDetails?: RenewableEnergyDetail[];

  // Recommandations travaux
  recommendedWorks: DPEWorkRecommendation[];

  // Scénarios d'amélioration
  improvementScenarios: DPEImprovementScenario[];

  // Passoire énergétique ?
  isEnergyPoor: boolean; // F ou G
  rentalProhibitionDate?: string; // Date interdiction location

  confidence: ConfidenceLevel;
  documentUrl?: string;
}

export interface DiagnosticianInfo {
  name: string;
  company?: string;
  certificationNumber: string;
  certificationOrganism: string;
  certificationExpirationDate: string;
  insuranceNumber?: string;
  insuranceCompany?: string;
}

export interface EnergyConsumptionBreakdown {
  heating: number; // kWh/m²/an
  hotWater: number;
  cooling: number;
  lighting: number;
  auxiliaries: number; // Ventilation, pompes, etc.
}

export interface BuildingEnvelopeAssessment {
  wallsUValue: number; // W/m².K
  roofUValue: number;
  floorUValue: number;
  windowsUValue: number;

  wallsInsulation: InsulationAssessment;
  roofInsulation: InsulationAssessment;
  floorInsulation: InsulationAssessment;

  thermalBridges: ThermalBridgeAssessment[];
  airTightness?: AirTightnessAssessment;
}

export interface InsulationAssessment {
  present: boolean;
  type?: string;
  thickness?: number; // cm
  rValue?: number; // m².K/W
  condition: ConditionGrade;
  yearInstalled?: number;
}

export interface ThermalBridgeAssessment {
  location: string;
  type: ThermalBridgeType;
  severity: 'low' | 'medium' | 'high';
  heatLoss?: number; // W/K
}

export type ThermalBridgeType =
  | 'wall_floor_junction'
  | 'wall_roof_junction'
  | 'window_reveal'
  | 'balcony'
  | 'structural_element'
  | 'other';

export interface AirTightnessAssessment {
  q4PaSurf?: number; // m³/h/m² sous 4 Pa
  n50?: number; // vol/h sous 50 Pa
  testPerformed: boolean;
  testDate?: string;
  result?: 'compliant' | 'non_compliant';
}

export interface EquipmentEnergyAssessment {
  heating: HeatingEquipmentAssessment;
  hotWater: HotWaterEquipmentAssessment;
  ventilation: VentilationEquipmentAssessment;
  cooling?: CoolingEquipmentAssessment;
}

export interface HeatingEquipmentAssessment {
  type: string;
  energy: PrimaryEnergy;
  age: number;
  efficiency: number; // %
  powerOutput: number; // kW
  condition: ConditionGrade;
  regulation: HeatingRegulationType;
}

export type HeatingRegulationType =
  | 'none'
  | 'manual'
  | 'thermostat_simple'
  | 'thermostat_programmable'
  | 'thermostat_connected'
  | 'zone_regulation';

export interface HotWaterEquipmentAssessment {
  type: string;
  energy: PrimaryEnergy;
  capacity?: number; // litres
  efficiency?: number;
  solarAssist: boolean;
  condition: ConditionGrade;
}

export interface VentilationEquipmentAssessment {
  type: string;
  hygro: boolean;
  heatRecovery: boolean;
  heatRecoveryEfficiency?: number;
  condition: ConditionGrade;
}

export interface CoolingEquipmentAssessment {
  type: string;
  power: number; // kW
  seer?: number;
  condition: ConditionGrade;
}

export interface RenewableEnergyDetail {
  type: RenewableType;
  capacity: number;
  annualProduction: number;
  selfConsumption: boolean;
}

export type RenewableType =
  | 'solar_pv'
  | 'solar_thermal'
  | 'heat_pump_air'
  | 'heat_pump_ground'
  | 'wood_biomass'
  | 'other';

export interface DPEWorkRecommendation {
  id: string;
  priority: Priority;
  category: DPEWorkCategory;
  description: string;
  estimatedCost: EstimationRange;
  estimatedSavings: number; // kWh/an
  estimatedBillSavings: number; // €/an
  newEnergyClass?: EnergyClass;
  paybackPeriod?: number; // années
  eligibleAids: string[];
}

export type DPEWorkCategory =
  | 'wall_insulation'
  | 'roof_insulation'
  | 'floor_insulation'
  | 'window_replacement'
  | 'heating_replacement'
  | 'hot_water_replacement'
  | 'ventilation_installation'
  | 'renewable_energy'
  | 'other';

export interface DPEImprovementScenario {
  name: string;
  description: string;
  works: DPEWorkRecommendation[];
  totalCost: EstimationRange;
  totalSavings: number;
  targetEnergyClass: EnergyClass;
  targetGHGClass: EnergyClass;
  paybackPeriod: number;
  eligibleForMaPrimeRenov: boolean;
  maPrimeRenovAmount?: number;
}

// -----------------------------------------------------------------------------
// AMIANTE - DAAT (Dossier Amiante Avant Travaux)
// -----------------------------------------------------------------------------

export interface AsbestosDiagnosticDetailed {
  id: string;
  type: 'asbestos';

  // Type de diagnostic
  diagnosticType: AsbestosDiagnosticType;

  // Informations générales
  date: string;
  isValid: boolean; // Illimité si absence, sinon nouveau avant travaux

  // Diagnostiqueur
  diagnostician: DiagnosticianInfo;

  // Résultat global
  hasAsbestos: boolean;
  overallRiskLevel?: AsbestosRiskLevel;

  // Liste des matériaux et produits contenant de l'amiante (MPCA)
  mpcaList: MPCAEntry[];

  // Zones concernées
  affectedZones: AsbestosZone[];

  // Obligations
  periodicControlRequired: boolean;
  nextControlDate?: string;
  removalRequired: boolean;
  removalDeadline?: string;

  // Classification travaux
  worksClassification?: AsbestosWorksClassification;

  // Entreprises certifiées requises
  certifiedContractorRequired: boolean;
  requiredCertification?: 'SS3' | 'SS4';

  // Estimation coût désamiantage
  removalCostEstimate?: EstimationRange;

  // Recommandations
  recommendations: AsbestosRecommendation[];

  confidence: ConfidenceLevel;
  documentUrl?: string;
}

export type AsbestosDiagnosticType =
  | 'dta'   // Dossier Technique Amiante (parties communes)
  | 'daat'  // Diagnostic Amiante Avant Travaux
  | 'daad'  // Diagnostic Amiante Avant Démolition
  | 'sale'  // Diagnostic vente
  | 'rental'; // Diagnostic location

export type AsbestosRiskLevel = 1 | 2 | 3;
// 1 = Bon état, surveillance périodique
// 2 = État intermédiaire, action corrective à prévoir
// 3 = Matériaux dégradés, travaux de retrait/confinement obligatoires

export interface MPCAEntry {
  id: string;
  materialType: AsbestosMaterialType;
  location: string;
  zone: string;
  surface?: number; // m²
  length?: number; // ml
  accessibility: 'accessible' | 'non_accessible';
  condition: AsbestosMaterialCondition;
  riskLevel: AsbestosRiskLevel;
  action: AsbestosAction;
  priority: Priority;
}

export type AsbestosMaterialType =
  | 'flocage'              // Flocage
  | 'calorifugeage'        // Calorifugeage
  | 'faux_plafond'         // Faux plafond
  | 'dalle_vinyle'         // Dalles vinyle amiante
  | 'colle_carrelage'      // Colle carrelage
  | 'enduit'               // Enduit
  | 'joint'                // Joint
  | 'conduit'              // Conduit
  | 'toiture_fibrociment'  // Toiture fibrociment
  | 'bardage_fibrociment'  // Bardage fibrociment
  | 'tuyau_fibrociment'    // Canalisation fibrociment
  | 'autre';

export type AsbestosMaterialCondition =
  | 'bon'       // Bon état de conservation
  | 'intermediaire' // État intermédiaire
  | 'degrade';  // Dégradé

export type AsbestosAction =
  | 'surveillance'     // Surveillance périodique
  | 'encapsulage'      // Encapsulage/confinement
  | 'retrait'          // Retrait obligatoire
  | 'evaluation';      // Évaluation périodique

export interface AsbestosZone {
  name: string;
  level?: number;
  room?: string;
  mpacCount: number;
  highestRiskLevel: AsbestosRiskLevel;
  workRestriction: boolean;
}

export interface AsbestosWorksClassification {
  subsection: 'SS3' | 'SS4';
  riskLevel: 'niveau_1' | 'niveau_2' | 'niveau_3';
  description: string;
  requirements: string[];
}

export interface AsbestosRecommendation {
  priority: Priority;
  description: string;
  deadline?: string;
  estimatedCost?: EstimationRange;
  professionalRequired: boolean;
}

// -----------------------------------------------------------------------------
// PLOMB - CREP (Constat de Risque d'Exposition au Plomb)
// -----------------------------------------------------------------------------

export interface LeadDiagnosticDetailed {
  id: string;
  type: 'lead';

  // Informations générales
  date: string;
  expirationDate?: string; // 1 an avant travaux, 6 ans avant vente
  isValid: boolean;

  // Diagnostiqueur
  diagnostician: DiagnosticianInfo;

  // Résultat global
  hasLead: boolean;
  overallRiskLevel?: LeadRiskLevel;

  // Unités de diagnostic
  diagnosticUnits: LeadDiagnosticUnit[];

  // Surfaces dégradées
  degradedSurfaces: LeadDegradedSurface[];

  // Obligations
  workRequired: boolean;
  urgentWorkRequired: boolean;

  // Facteurs de dégradation du bâti
  buildingDegradationFactors: LeadDegradationFactor[];

  // Recommandations
  recommendations: LeadRecommendation[];

  // Estimation coût traitement
  treatmentCostEstimate?: EstimationRange;

  confidence: ConfidenceLevel;
  documentUrl?: string;
}

export type LeadRiskLevel = 0 | 1 | 2 | 3;
// 0 = Absence de plomb ou concentration < 1 mg/cm²
// 1 = Présence plomb, non dégradé, pas d'action immédiate
// 2 = Présence plomb, état moyen, surveillance
// 3 = Présence plomb, dégradé, travaux urgents

export interface LeadDiagnosticUnit {
  id: string;
  room: string;
  element: LeadElement;
  substrate: string;
  concentration: number; // mg/cm²
  hasLead: boolean; // > 1 mg/cm²
  condition: LeadCondition;
  riskLevel: LeadRiskLevel;
}

export type LeadElement =
  | 'porte'
  | 'fenetre'
  | 'volet'
  | 'plinthe'
  | 'mur'
  | 'plafond'
  | 'escalier'
  | 'radiateur'
  | 'garde_corps'
  | 'autre';

export type LeadCondition =
  | 'non_visible'
  | 'non_degrade'
  | 'etat_usage'
  | 'degrade';

export interface LeadDegradedSurface {
  room: string;
  element: string;
  surface: number; // cm²
  concentration: number;
  condition: LeadCondition;
}

export interface LeadDegradationFactor {
  factor: string;
  severity: 'low' | 'medium' | 'high';
  location?: string;
}

export interface LeadRecommendation {
  priority: Priority;
  description: string;
  technique: LeadTreatmentTechnique;
  estimatedCost?: EstimationRange;
  deadline?: string;
}

export type LeadTreatmentTechnique =
  | 'encapsulage'           // Recouvrement
  | 'decapage_chimique'     // Décapage chimique
  | 'decapage_thermique'    // Décapage thermique
  | 'ponçage_hepa'          // Ponçage avec aspiration HEPA
  | 'remplacement'          // Remplacement de l'élément
  | 'surveillance';

// -----------------------------------------------------------------------------
// ÉLECTRICITÉ
// -----------------------------------------------------------------------------

export interface ElectricityDiagnosticDetailed {
  id: string;
  type: 'electricity';

  // Informations générales
  date: string;
  expirationDate: string; // 3 ans
  isValid: boolean;

  // Diagnostiqueur
  diagnostician: DiagnosticianInfo;

  // Résultat global
  isCompliant: boolean;
  anomaliesCount: number;

  // Installation
  installation: ElectricalInstallationDetails;

  // Anomalies détaillées
  anomalies: ElectricalAnomalyDetailed[];

  // Points de contrôle
  checkpoints: ElectricalCheckpoint[];

  // Recommandations
  recommendations: ElectricalRecommendation[];

  // Estimation mise aux normes
  upgradeEstimate?: EstimationRange;

  confidence: ConfidenceLevel;
  documentUrl?: string;
}

export interface ElectricalInstallationDetails {
  installationYear?: number;
  lastMajorWork?: number;
  panelType: string;
  panelLocation: string;
  mainBreakerRating: number; // A
  subscribedPower: number; // kVA
  threePhase: boolean;
  hasGrounding: boolean;
  groundingType?: GroundingType;
  groundResistance?: number; // Ohms
  hasRCD: boolean;
  rcdCount: number;
  circuitsCount: number;
}

export type GroundingType =
  | 'TT'
  | 'TN_S'
  | 'TN_C'
  | 'TN_CS'
  | 'IT';

export interface ElectricalAnomalyDetailed {
  id: string;
  code: string;
  description: string;
  category: ElectricalAnomalyCategory;
  severity: ElectricalAnomalySeverity;
  location: string;
  room?: string;
  dangerType: ElectricalDangerType;
  correctiveAction: string;
  priority: Priority;
}

export type ElectricalAnomalyCategory =
  | 'B1'  // AGCP et disjoncteur de branchement
  | 'B2'  // Prise de terre et conducteurs de protection
  | 'B3'  // Liaison équipotentielle
  | 'B4'  // Dispositifs différentiels
  | 'B5'  // Protection contre surintensités
  | 'B6'  // Matériels électriques vétustes ou inadaptés
  | 'B7'  // Conducteurs non protégés mécaniquement
  | 'B8'  // Appareillages présentant des risques de contacts directs
  | 'B9'  // Locaux contenant baignoire ou douche
  | 'B10' // Matériels présentant des risques de contacts indirects
  | 'B11'; // Autres

export type ElectricalAnomalySeverity =
  | 'minor'    // Anomalie mineure
  | 'major'    // Anomalie majeure
  | 'critical'; // Danger grave et immédiat

export type ElectricalDangerType =
  | 'electrocution'
  | 'fire'
  | 'indirect_contact'
  | 'overcurrent'
  | 'none';

export interface ElectricalCheckpoint {
  category: ElectricalAnomalyCategory;
  description: string;
  checked: boolean;
  result: 'ok' | 'anomaly' | 'not_applicable';
  observations?: string;
}

export interface ElectricalRecommendation {
  priority: Priority;
  description: string;
  category: ElectricalAnomalyCategory;
  estimatedCost?: EstimationRange;
  urgency: 'immediate' | 'short_term' | 'medium_term';
}

// -----------------------------------------------------------------------------
// GAZ
// -----------------------------------------------------------------------------

export interface GasDiagnosticDetailed {
  id: string;
  type: 'gas';

  // Informations générales
  date: string;
  expirationDate: string; // 3 ans
  isValid: boolean;

  // Diagnostiqueur
  diagnostician: DiagnosticianInfo;

  // Résultat global
  hasGasInstallation: boolean;
  isCompliant: boolean;
  immediateRisk: boolean;

  // Installation
  installation: GasInstallationDetails;

  // Anomalies
  anomaliesCount: number;
  anomalies: GasAnomalyDetailed[];

  // Points de contrôle
  checkpoints: GasCheckpoint[];

  // Recommandations
  recommendations: GasRecommendation[];

  // Estimation mise aux normes
  upgradeEstimate?: EstimationRange;

  confidence: ConfidenceLevel;
  documentUrl?: string;
}

export interface GasInstallationDetails {
  installationYear?: number;
  gasType: GasType;
  meterLocation: string;
  shutoffValveLocation: string;
  pipeMaterial: GasPipeMaterial;
  hasFlexibleConnection: boolean;
  ventilationCompliant: boolean;
  combustionAirCompliant: boolean;
}

export type GasType =
  | 'natural_gas'
  | 'propane'
  | 'butane';

export type GasPipeMaterial =
  | 'copper'
  | 'steel'
  | 'stainless_steel'
  | 'flexible';

export interface GasAnomalyDetailed {
  id: string;
  code: string;
  description: string;
  severity: GasAnomalySeverity;
  location: string;
  appliance?: string;
  dangerType: GasDangerType;
  correctiveAction: string;
  priority: Priority;
}

export type GasAnomalySeverity =
  | 'a1'   // Anomalie mineure
  | 'a2'   // Anomalie à risque
  | 'dgi'; // Danger Grave et Immédiat

export type GasDangerType =
  | 'explosion'
  | 'co_poisoning'
  | 'asphyxiation'
  | 'fire'
  | 'none';

export interface GasCheckpoint {
  category: string;
  description: string;
  checked: boolean;
  result: 'ok' | 'anomaly' | 'not_applicable';
  observations?: string;
}

export interface GasRecommendation {
  priority: Priority;
  description: string;
  estimatedCost?: EstimationRange;
  urgency: 'immediate' | 'short_term' | 'medium_term';
}

// -----------------------------------------------------------------------------
// TERMITES
// -----------------------------------------------------------------------------

export interface TermiteDiagnosticDetailed {
  id: string;
  type: 'termites';

  // Informations générales
  date: string;
  expirationDate: string; // 6 mois
  isValid: boolean;

  // Diagnostiqueur
  diagnostician: DiagnosticianInfo;

  // Zone réglementaire
  isInTermiteZone: boolean;
  prefecturalDecree?: string;

  // Résultat
  hasTermites: boolean;
  hasOtherXylophages: boolean;
  xylophageTypes?: XylophageType[];

  // Infestation
  infestationLevel?: InfestationLevel;
  affectedAreas: TermiteAffectedArea[];

  // État des bois
  woodConditionAssessment: WoodConditionEntry[];

  // Recommandations
  treatmentRequired: boolean;
  treatmentType?: TermiteTreatmentType;
  treatmentRecommendation: string;

  // Estimation traitement
  treatmentCostEstimate?: EstimationRange;

  confidence: ConfidenceLevel;
  documentUrl?: string;
}

export type XylophageType =
  | 'termites_souterrains'
  | 'termites_bois_sec'
  | 'capricornes'
  | 'vrillettes'
  | 'lyctus'
  | 'fourmis_charpentieres'
  | 'autres';

export type InfestationLevel =
  | 'none'
  | 'traces'   // Traces anciennes
  | 'active'   // Infestation active
  | 'severe';  // Infestation sévère

export interface TermiteAffectedArea {
  location: string;
  level?: number;
  woodType: string;
  infestationType: XylophageType;
  severity: 'low' | 'medium' | 'high';
  structuralImpact: boolean;
}

export interface WoodConditionEntry {
  element: string;
  location: string;
  species?: string;
  condition: ConditionGrade;
  infestationSigns: boolean;
  treatmentTraces: boolean;
}

export type TermiteTreatmentType =
  | 'preventive'      // Traitement préventif
  | 'curative_local'  // Traitement curatif localisé
  | 'curative_global' // Traitement curatif global
  | 'bait_system'     // Système de pièges
  | 'structural_repair'; // Réparation structurelle

// -----------------------------------------------------------------------------
// ERP - État des Risques et Pollutions
// -----------------------------------------------------------------------------

export interface ERPDiagnosticDetailed {
  id: string;
  type: 'erp';

  // Informations générales
  date: string;
  expirationDate: string; // 6 mois
  isValid: boolean;

  // Risques naturels
  naturalRisks: NaturalRiskDetailed[];

  // Risques technologiques
  technologicalRisks: TechnologicalRiskDetailed[];

  // Risques miniers
  miningRisks: MiningRiskDetailed;

  // Radon
  radon: RadonRiskDetailed;

  // Pollution des sols
  soilPollution: SoilPollutionDetailed;

  // Historique sinistres
  previousSinisters: PreviousSinister[];

  // Plans de prévention
  preventionPlans: PreventionPlan[];

  // Obligations et contraintes
  buildingConstraints: ERPBuildingConstraint[];

  confidence: ConfidenceLevel;
  documentUrl?: string;
}

export interface NaturalRiskDetailed {
  type: NaturalRiskType;
  present: boolean;
  level: RiskLevel;
  zone?: string;
  zoneName?: string;
  prescriptions: string[];
  buildingConstraints: string[];
  insuranceImpact?: string;
}

export type NaturalRiskType =
  | 'flood'              // Inondation
  | 'flash_flood'        // Crue torrentielle
  | 'submersion'         // Submersion marine
  | 'earthquake'         // Séisme
  | 'landslide'          // Glissement de terrain
  | 'mudslide'           // Coulée de boue
  | 'rockfall'           // Chute de blocs
  | 'clay_shrinkage'     // Retrait-gonflement argiles
  | 'coastal_erosion'    // Érosion littorale
  | 'avalanche'          // Avalanche
  | 'forest_fire'        // Feu de forêt
  | 'storm'              // Tempête/cyclone
  | 'volcanic';          // Volcanique

export type RiskLevel = 'none' | 'low' | 'medium' | 'high' | 'very_high';

export interface TechnologicalRiskDetailed {
  type: TechnologicalRiskType;
  present: boolean;
  level: RiskLevel;
  source?: string;
  distance?: number;
  operator?: string;
  prescriptions: string[];
}

export type TechnologicalRiskType =
  | 'seveso_high'        // Site Seveso seuil haut
  | 'seveso_low'         // Site Seveso seuil bas
  | 'nuclear'            // Nucléaire
  | 'pipeline'           // Transport matières dangereuses
  | 'dam'                // Rupture de barrage
  | 'industrial';        // Industriel autre

export interface MiningRiskDetailed {
  present: boolean;
  type?: MiningRiskType;
  zone?: string;
  constraints: string[];
}

export type MiningRiskType =
  | 'underground_mining'
  | 'quarry'
  | 'subsidence'
  | 'pollution';

export interface RadonRiskDetailed {
  zoneLevel: RadonZoneLevel;
  measurementRequired: boolean;
  measuredLevel?: number; // Bq/m³
  actionRequired: boolean;
  recommendations: string[];
}

export type RadonZoneLevel = 1 | 2 | 3;
// 1 = Potentiel faible
// 2 = Potentiel moyen
// 3 = Potentiel significatif

export interface SoilPollutionDetailed {
  inSIS: boolean; // Secteur d'Information sur les Sols
  inBasol: boolean;
  inBasias: boolean;
  pollutionType?: string[];
  restrictions: string[];
  studyRequired: boolean;
}

export interface PreviousSinister {
  date: string;
  type: string;
  arreteNumber?: string;
  description: string;
  indemnified: boolean;
}

export interface PreventionPlan {
  type: PreventionPlanType;
  name: string;
  approvalDate: string;
  revisionDate?: string;
  zone?: string;
  constraints: string[];
}

export type PreventionPlanType =
  | 'ppri'   // Plan Prévention Risques Inondations
  | 'pprn'   // Plan Prévention Risques Naturels
  | 'pprt'   // Plan Prévention Risques Technologiques
  | 'pprm';  // Plan Prévention Risques Miniers

export interface ERPBuildingConstraint {
  risk: string;
  constraint: string;
  impact: 'blocking' | 'restrictive' | 'informative';
  workaround?: string;
}

// -----------------------------------------------------------------------------
// LOI CARREZ
// -----------------------------------------------------------------------------

export interface CarrezDiagnosticDetailed {
  id: string;
  type: 'carrez';

  date: string;
  isValid: boolean; // Illimité si pas de modification

  // Surfaces
  privateSurface: number; // m² loi Carrez
  surfaceByRoom: CarrezRoomSurface[];

  // Méthode de calcul
  calculationMethod: string;

  // Exclusions
  exclusions: CarrezExclusion[];

  // Précision
  measurementPrecision: number; // %

  confidence: ConfidenceLevel;
  documentUrl?: string;
}

export interface CarrezRoomSurface {
  room: string;
  level?: number;
  surface: number;
  ceilingHeight: number;
  included: boolean;
  exclusionReason?: string;
}

export interface CarrezExclusion {
  element: string;
  surface: number;
  reason: CarrezExclusionReason;
}

export type CarrezExclusionReason =
  | 'height_under_180'  // Hauteur < 1,80m
  | 'cellar'            // Cave
  | 'parking'           // Parking
  | 'common_area'       // Parties communes
  | 'exterior'          // Extérieur
  | 'annex';            // Annexe

// -----------------------------------------------------------------------------
// ASSAINISSEMENT NON COLLECTIF
// -----------------------------------------------------------------------------

export interface SepticTankDiagnosticDetailed {
  id: string;
  type: 'septic_tank';

  date: string;
  expirationDate?: string;
  isValid: boolean;

  // Type d'installation
  installationType: SepticInstallationType;

  // Caractéristiques
  capacity: number; // m³
  equivalentHabitants: number;
  installationYear?: number;

  // Conformité
  isCompliant: boolean;
  complianceLevel: SepticComplianceLevel;

  // Points de contrôle
  checkpoints: SepticCheckpoint[];

  // Problèmes identifiés
  issues: SepticIssue[];

  // Obligations
  upgradeRequired: boolean;
  upgradeDeadline?: string;

  // Estimation travaux
  upgradeCostEstimate?: EstimationRange;

  // SPANC
  spancName?: string;
  spancContact?: string;

  confidence: ConfidenceLevel;
  documentUrl?: string;
}

export type SepticInstallationType =
  | 'septic_tank_infiltration'  // Fosse + épandage
  | 'septic_tank_filter'        // Fosse + filtre
  | 'septic_tank_mound'         // Fosse + tertre
  | 'microstation'              // Micro-station
  | 'compact_filter'            // Filtre compact
  | 'constructed_wetland'       // Filtre planté
  | 'other';

export type SepticComplianceLevel =
  | 'compliant'                 // Conforme
  | 'acceptable'                // Points à améliorer
  | 'non_compliant_no_risk'     // Non conforme sans risque environnemental
  | 'non_compliant_risk'        // Non conforme avec risque
  | 'absent';                   // Installation absente

export interface SepticCheckpoint {
  category: string;
  item: string;
  result: 'ok' | 'warning' | 'non_compliant';
  observation?: string;
}

export interface SepticIssue {
  category: string;
  description: string;
  severity: 'minor' | 'major' | 'critical';
  environmentalRisk: boolean;
  healthRisk: boolean;
}

// =============================================================================
// DIAGNOSTICS TECHNIQUES RECOMMANDÉS
// =============================================================================

export interface TechnicalDiagnosticsBundle {
  soilStudy?: SoilStudyDetailed;
  structuralStudy?: StructuralStudyDetailed;
  moistureStudy?: MoistureStudyDetailed;
  thermalStudy?: ThermalStudyDetailed;
  acousticStudy?: AcousticStudyDetailed;
  accessibilityAudit?: AccessibilityAuditDetailed;
}

// -----------------------------------------------------------------------------
// ÉTUDE DE SOL (G1 / G2)
// -----------------------------------------------------------------------------

export interface SoilStudyDetailed {
  id: string;
  type: 'soil';

  // Type d'étude
  studyLevel: SoilStudyLevel;

  // Informations générales
  date: string;
  engineer: string;
  engineerCompany?: string;
  insuranceNumber?: string;

  // Zone géotechnique
  seismicZone: SeismicZone;
  clayZone: ClayZone;

  // Type de sol
  soilProfile: SoilLayer[];
  dominantSoilType: SoilType;

  // Caractéristiques mécaniques
  bearingCapacity: number; // kPa
  settlementRisk: SettlementRisk;

  // Nappe phréatique
  waterTable: WaterTableDetails;

  // Recommandations fondations
  foundationRecommendation: FoundationRecommendation;

  // Risques identifiés
  geotechnicalRisks: GeotechnicalRisk[];

  // Documents
  boreholeLocations?: string;
  crossSections?: string;

  confidence: ConfidenceLevel;
  documentUrl?: string;
}

export type SoilStudyLevel =
  | 'G1_ES'  // Étude de Site
  | 'G1_PGC' // Principes Généraux de Construction
  | 'G2_AVP' // Avant-Projet
  | 'G2_PRO' // Projet
  | 'G2_DCE' // Dossier Consultation Entreprises
  | 'G3'     // Exécution
  | 'G4'     // Supervision
  | 'G5';    // Diagnostic

export type SeismicZone = 1 | 2 | 3 | 4 | 5;
// 1 = Très faible
// 5 = Forte

export type ClayZone = 'faible' | 'moyen' | 'fort';

export interface SoilLayer {
  depth: number; // m
  thickness: number;
  soilType: SoilType;
  description: string;
  characteristics?: SoilCharacteristics;
}

export type SoilType =
  | 'rock'        // Rocher
  | 'gravel'      // Gravier
  | 'sand'        // Sable
  | 'silt'        // Limon
  | 'clay'        // Argile
  | 'peat'        // Tourbe
  | 'fill'        // Remblai
  | 'marl'        // Marne
  | 'limestone'   // Calcaire
  | 'mixed';

export interface SoilCharacteristics {
  cohesion?: number; // kPa
  frictionAngle?: number; // degrés
  pressuremeterModulus?: number; // MPa
  limitPressure?: number; // MPa
}

export type SettlementRisk = 'low' | 'medium' | 'high';

export interface WaterTableDetails {
  present: boolean;
  depth?: number; // m
  seasonal: boolean;
  highWaterDepth?: number;
  lowWaterDepth?: number;
  drainageRequired: boolean;
  pumpingRequired: boolean;
}

export interface FoundationRecommendation {
  type: FoundationType;
  depth: number; // m
  width?: number; // m
  specialMeasures?: string[];
  costImpact: 'standard' | 'moderate' | 'significant' | 'major';
  alternatives?: FoundationAlternative[];
}

export type FoundationType =
  | 'strip_shallow'      // Semelles filantes superficielles
  | 'strip_deep'         // Semelles filantes profondes
  | 'isolated_footing'   // Semelles isolées
  | 'raft'               // Radier
  | 'piles'              // Pieux
  | 'micropiles'         // Micropieux
  | 'injected_piles'     // Pieux injectés
  | 'wells';             // Puits

export interface FoundationAlternative {
  type: FoundationType;
  depth: number;
  costComparison: 'cheaper' | 'similar' | 'more_expensive';
  pros: string[];
  cons: string[];
}

export interface GeotechnicalRisk {
  type: GeotechnicalRiskType;
  level: RiskLevel;
  description: string;
  mitigation: string[];
}

export type GeotechnicalRiskType =
  | 'settlement'
  | 'differential_settlement'
  | 'clay_shrinkage'
  | 'liquefaction'
  | 'slope_stability'
  | 'water_infiltration'
  | 'karst'
  | 'mining_void';

// -----------------------------------------------------------------------------
// ÉTUDE STRUCTURELLE
// -----------------------------------------------------------------------------

export interface StructuralStudyDetailed {
  id: string;
  type: 'structural';

  date: string;
  engineer: string;
  engineerCompany?: string;
  insuranceNumber: string;

  // État global
  overallCondition: ConditionGrade;
  structuralIntegrity: StructuralIntegrity;

  // Analyse par élément
  foundationAnalysis: FoundationAnalysis;
  wallAnalysis: WallAnalysis[];
  floorAnalysis: FloorAnalysis[];
  roofFrameworkAnalysis: RoofFrameworkAnalysis;

  // Pathologies structurelles
  structuralPathologies: StructuralPathology[];

  // Capacité de charge
  loadCapacity: LoadCapacityDetails;

  // Recommandations
  recommendations: StructuralRecommendation[];

  // Travaux de renforcement
  reinforcementWorks?: ReinforcementWork[];

  confidence: ConfidenceLevel;
  documentUrl?: string;
}

export type StructuralIntegrity =
  | 'sound'           // Sain
  | 'minor_issues'    // Problèmes mineurs
  | 'moderate_issues' // Problèmes modérés
  | 'major_issues'    // Problèmes majeurs
  | 'critical';       // Critique

export interface FoundationAnalysis {
  type: string;
  depth?: number;
  condition: ConditionGrade;
  visibleSigns: string[];
  settlement: SettlementAssessment;
  reinforcementNeeded: boolean;
}

export interface SettlementAssessment {
  hasSettlement: boolean;
  magnitude?: number; // mm
  distribution: 'uniform' | 'differential';
  active: boolean;
  cause?: string;
}

export interface WallAnalysis {
  location: string;
  type: string;
  loadBearing: boolean;
  thickness: number; // cm
  condition: ConditionGrade;
  cracks: CrackAssessment[];
  moistureIssues: boolean;
  modificationPossible: boolean;
}

export interface CrackAssessment {
  location: string;
  type: CrackType;
  width: number; // mm
  length: number; // cm
  orientation: 'horizontal' | 'vertical' | 'diagonal' | '45_degrees';
  active: boolean;
  structuralRisk: boolean;
  cause?: string;
}

export type CrackType =
  | 'hairline'    // Faïençage
  | 'superficial' // Superficielle
  | 'structural'  // Structurelle
  | 'movement';   // Mouvement

export interface FloorAnalysis {
  level: number;
  type: string;
  span: number; // m
  condition: ConditionGrade;
  deflection?: number; // mm
  loadCapacity: number; // kg/m²
  soundInsulation?: number; // dB
  reinforcementNeeded: boolean;
}

export interface RoofFrameworkAnalysis {
  type: string;
  material: string;
  age?: number;
  condition: ConditionGrade;
  deformations: DeformationAssessment[];
  timberCondition?: TimberCondition;
  connectionCondition: ConditionGrade;
  modifications: string[];
}

export interface DeformationAssessment {
  element: string;
  type: 'sagging' | 'lateral' | 'rotation';
  magnitude: number; // mm
  acceptable: boolean;
}

export interface TimberCondition {
  insectDamage: boolean;
  fungalDamage: boolean;
  moistureContent?: number; // %
  treatmentPresent: boolean;
  treatmentNeeded: boolean;
}

export interface StructuralPathology {
  id: string;
  location: string;
  type: StructuralPathologyType;
  severity: 'minor' | 'moderate' | 'major' | 'critical';
  cause: string;
  progression: 'stable' | 'slow' | 'active';
  structuralImpact: string;
  urgency: Priority;
  remediation: string;
  cost: EstimationRange;
}

export type StructuralPathologyType =
  | 'cracking'
  | 'settlement'
  | 'corrosion'
  | 'timber_decay'
  | 'timber_insects'
  | 'moisture_damage'
  | 'frost_damage'
  | 'overload'
  | 'design_defect';

export interface LoadCapacityDetails {
  floorLiveLoad: number; // kg/m²
  roofLiveLoad: number;
  maxPointLoad: number; // kg
  additionalLoadPossible: boolean;
  modificationRestrictions: string[];
}

export interface StructuralRecommendation {
  priority: Priority;
  description: string;
  type: 'monitoring' | 'repair' | 'reinforcement' | 'replacement';
  urgency: 'immediate' | 'short_term' | 'medium_term' | 'long_term';
  cost: EstimationRange;
  engineerSupervision: boolean;
}

export interface ReinforcementWork {
  element: string;
  method: ReinforcementMethod;
  description: string;
  cost: EstimationRange;
  duration: string;
  permits: string[];
}

export type ReinforcementMethod =
  | 'underpinning'        // Reprise en sous-œuvre
  | 'micropiles'          // Micropieux
  | 'steel_beam'          // Poutre acier (IPN/HEB)
  | 'carbon_fiber'        // Fibre de carbone
  | 'concrete_jacketing'  // Chemisage béton
  | 'wall_tie'            // Tirants
  | 'resin_injection'     // Injection résine
  | 'timber_treatment'    // Traitement bois
  | 'timber_replacement'; // Remplacement bois

// -----------------------------------------------------------------------------
// ÉTUDE HUMIDITÉ
// -----------------------------------------------------------------------------

export interface MoistureStudyDetailed {
  id: string;
  type: 'moisture';

  date: string;
  expert: string;

  // Niveau global
  overallMoistureLevel: MoistureLevel;

  // Mesures hygrométriques
  measurements: MoistureMeasurement[];

  // Sources d'humidité identifiées
  moistureSources: MoistureSource[];

  // Zones affectées
  affectedZones: MoistureAffectedZone[];

  // Dégâts constatés
  damages: MoistureDamage[];

  // Recommandations traitement
  treatments: MoistureTreatment[];

  confidence: ConfidenceLevel;
  documentUrl?: string;
}

export type MoistureLevel = 'dry' | 'normal' | 'humid' | 'wet' | 'saturated';

export interface MoistureMeasurement {
  location: string;
  level: number;
  material: string;
  surfaceMoisture: number; // %
  depthMoisture?: number; // %
  relativeHumidity?: number; // %
  temperature?: number; // °C
  dewPoint?: number; // °C
}

export interface MoistureSource {
  type: MoistureSourceType;
  location: string;
  severity: 'low' | 'medium' | 'high';
  description: string;
}

export type MoistureSourceType =
  | 'rising_damp'         // Remontées capillaires
  | 'infiltration_roof'   // Infiltration toiture
  | 'infiltration_facade' // Infiltration façade
  | 'infiltration_soil'   // Infiltration sol
  | 'condensation'        // Condensation
  | 'leak_plumbing'       // Fuite plomberie
  | 'lack_ventilation'    // Défaut ventilation
  | 'thermal_bridge';     // Pont thermique

export interface MoistureAffectedZone {
  location: string;
  level: number;
  surface: number; // m²
  moistureLevel: MoistureLevel;
  source: MoistureSourceType;
  structuralImpact: boolean;
}

export interface MoistureDamage {
  type: MoistureDamageType;
  location: string;
  severity: 'minor' | 'moderate' | 'major';
  description: string;
  repairNeeded: boolean;
}

export type MoistureDamageType =
  | 'mold'              // Moisissures
  | 'efflorescence'     // Efflorescences
  | 'paint_peeling'     // Cloquage peinture
  | 'plaster_damage'    // Dégradation enduit
  | 'wallpaper_damage'  // Décollage papier peint
  | 'wood_rot'          // Pourriture bois
  | 'corrosion'         // Corrosion
  | 'odor';             // Odeur

export interface MoistureTreatment {
  source: MoistureSourceType;
  method: MoistureTreatmentMethod;
  description: string;
  priority: Priority;
  cost: EstimationRange;
  duration: string;
}

export type MoistureTreatmentMethod =
  | 'drainage'                  // Drainage périphérique
  | 'waterproofing'             // Étanchéité
  | 'injection_barrier'         // Injection barrière
  | 'ventilation'               // Amélioration ventilation
  | 'dehumidification'          // Déshumidification
  | 'thermal_insulation'        // Isolation thermique
  | 'repair_roof'               // Réparation toiture
  | 'repair_facade'             // Réparation façade
  | 'plumbing_repair'           // Réparation plomberie
  | 'cuvelage';                 // Cuvelage

// -----------------------------------------------------------------------------
// ÉTUDE THERMIQUE
// -----------------------------------------------------------------------------

export interface ThermalStudyDetailed {
  id: string;
  type: 'thermal';

  date: string;
  engineer: string;

  // Analyse thermographique
  thermographyResults?: ThermographyResults;

  // Test étanchéité air
  airTightnessTest?: AirTightnessTest;

  // Déperditions thermiques
  heatLossAnalysis: HeatLossAnalysis;

  // Ponts thermiques
  thermalBridges: ThermalBridgeDetailed[];

  // Scénarios amélioration
  improvementScenarios: ThermalImprovementScenario[];

  confidence: ConfidenceLevel;
  documentUrl?: string;
}

export interface ThermographyResults {
  date: string;
  conditions: ThermographyConditions;
  images: ThermographyImage[];
  findings: ThermographyFinding[];
}

export interface ThermographyConditions {
  outdoorTemperature: number;
  indoorTemperature: number;
  deltaT: number;
  windSpeed?: number;
  cloudCover?: string;
  heatingStatus: string;
}

export interface ThermographyImage {
  id: string;
  location: string;
  imageUrl: string;
  thermalImageUrl: string;
  minTemp: number;
  maxTemp: number;
  findings: string[];
}

export interface ThermographyFinding {
  location: string;
  type: ThermographyFindingType;
  severity: 'low' | 'medium' | 'high';
  description: string;
  recommendation: string;
}

export type ThermographyFindingType =
  | 'thermal_bridge'
  | 'air_leak'
  | 'insulation_defect'
  | 'moisture'
  | 'heating_issue'
  | 'window_seal';

export interface AirTightnessTest {
  date: string;
  method: 'blower_door';
  n50: number; // vol/h à 50 Pa
  q4PaSurf: number; // m³/h/m² à 4 Pa
  compliant: boolean;
  targetValue: number;
  leakageLocations: LeakageLocation[];
}

export interface LeakageLocation {
  location: string;
  element: string;
  severity: 'minor' | 'moderate' | 'major';
  flowRate?: number; // m³/h
}

export interface HeatLossAnalysis {
  totalHeatLoss: number; // W/K
  byComponent: HeatLossComponent[];
  byZone?: HeatLossZone[];
}

export interface HeatLossComponent {
  component: string;
  surface: number; // m²
  uValue: number; // W/m².K
  heatLoss: number; // W/K
  percentage: number; // %
}

export interface HeatLossZone {
  zone: string;
  heatLoss: number;
  percentage: number;
}

export interface ThermalBridgeDetailed {
  id: string;
  location: string;
  type: ThermalBridgeType;
  linearLength?: number; // m
  psiValue?: number; // W/m.K
  heatLoss: number; // W/K
  surfaceTemperature?: number; // °C
  condensationRisk: boolean;
  treatment: string;
  treatmentCost: EstimationRange;
}

export interface ThermalImprovementScenario {
  name: string;
  description: string;
  works: ThermalWork[];
  totalCost: EstimationRange;
  annualSavings: number; // kWh
  billSavings: number; // €
  paybackPeriod: number; // années
  newEnergyClass?: EnergyClass;
  co2Reduction: number; // kg/an
}

export interface ThermalWork {
  type: string;
  description: string;
  rValueTarget?: number;
  cost: EstimationRange;
  savings: number;
}

// -----------------------------------------------------------------------------
// ÉTUDE ACOUSTIQUE
// -----------------------------------------------------------------------------

export interface AcousticStudyDetailed {
  id: string;
  type: 'acoustic';

  date: string;
  expert: string;

  // Mesures
  measurements: AcousticMeasurement[];

  // Isolation aérienne
  airborneInsulation: AirborneInsulationAssessment[];

  // Isolation aux bruits d'impact
  impactInsulation: ImpactInsulationAssessment[];

  // Bruits d'équipements
  equipmentNoise: EquipmentNoiseAssessment[];

  // Recommandations
  recommendations: AcousticRecommendation[];

  confidence: ConfidenceLevel;
  documentUrl?: string;
}

export interface AcousticMeasurement {
  location: string;
  type: AcousticMeasurementType;
  value: number; // dB or dB(A)
  standard?: string;
  compliant?: boolean;
}

export type AcousticMeasurementType =
  | 'ambient_noise'
  | 'airborne_insulation'
  | 'impact_insulation'
  | 'equipment_noise'
  | 'reverberation_time';

export interface AirborneInsulationAssessment {
  partition: string;
  location: string;
  dnT: number; // dB - Isolement normalisé
  rW?: number; // dB - Indice d'affaiblissement
  required?: number;
  compliant: boolean;
}

export interface ImpactInsulationAssessment {
  floor: string;
  location: string;
  lnT: number; // dB - Niveau de bruit normalisé
  required?: number;
  compliant: boolean;
}

export interface EquipmentNoiseAssessment {
  equipment: string;
  location: string;
  noiseLevel: number; // dB(A)
  emergenceDay?: number;
  emergenceNight?: number;
  compliant: boolean;
}

export interface AcousticRecommendation {
  element: string;
  issue: string;
  solution: string;
  targetImprovement: number; // dB
  cost: EstimationRange;
  priority: Priority;
}

// -----------------------------------------------------------------------------
// AUDIT ACCESSIBILITÉ PMR
// -----------------------------------------------------------------------------

export interface AccessibilityAuditDetailed {
  id: string;
  type: 'accessibility';

  date: string;
  auditor: string;

  // Type de bâtiment
  buildingType: AccessibilityBuildingType;
  erpCategory?: ERPCategory;
  erpType?: string;

  // Conformité globale
  overallCompliance: AccessibilityComplianceLevel;

  // Analyse par zone
  zoneAnalysis: AccessibilityZoneAnalysis[];

  // Non-conformités
  nonCompliances: AccessibilityNonCompliance[];

  // Dérogations possibles
  possibleDerogations: AccessibilityDerogation[];

  // Plan de mise en accessibilité
  accessibilityPlan: AccessibilityAction[];

  confidence: ConfidenceLevel;
  documentUrl?: string;
}

export type AccessibilityBuildingType =
  | 'housing_individual'
  | 'housing_collective'
  | 'erp'
  | 'workplace';

export type ERPCategory = 1 | 2 | 3 | 4 | 5;

export type AccessibilityComplianceLevel =
  | 'compliant'
  | 'partially_compliant'
  | 'non_compliant';

export interface AccessibilityZoneAnalysis {
  zone: string;
  compliance: AccessibilityComplianceLevel;
  items: AccessibilityItem[];
}

export interface AccessibilityItem {
  element: string;
  requirement: string;
  actual: string;
  compliant: boolean;
  regulation: string;
}

export interface AccessibilityNonCompliance {
  id: string;
  zone: string;
  element: string;
  requirement: string;
  actual: string;
  regulation: string;
  severity: 'minor' | 'major' | 'critical';
  correctionRequired: boolean;
  correctionCost: EstimationRange;
}

export interface AccessibilityDerogation {
  element: string;
  reason: DerogationReason;
  justification: string;
  compensatoryMeasures?: string[];
  approvalRequired: boolean;
}

export type DerogationReason =
  | 'technical_impossibility'
  | 'heritage_preservation'
  | 'disproportionate_cost'
  | 'safety_constraints';

export interface AccessibilityAction {
  id: string;
  zone: string;
  action: string;
  priority: Priority;
  cost: EstimationRange;
  deadline?: string;
  regulatory: boolean;
}

// =============================================================================
// ÉTAT DES LIEUX PHOTOGRAPHIQUE
// =============================================================================

export interface PhotographicSurvey {
  date: string;
  photographer?: string;

  exterior: ExteriorPhotoSurvey;
  interior: InteriorPhotoSurvey;
  technical: TechnicalPhotoSurvey;
  defects: DefectPhotoSurvey;
}

export interface ExteriorPhotoSurvey {
  facades: FacadePhoto[];
  roof: PhotoEntry[];
  rainwaterManagement: PhotoEntry[];
  vrd: PhotoEntry[];
  garden: PhotoEntry[];
}

export interface FacadePhoto extends PhotoEntry {
  orientation: 'north' | 'south' | 'east' | 'west';
  elements: string[];
}

export interface InteriorPhotoSurvey {
  rooms: RoomPhotoSet[];
  circulation: PhotoEntry[];
}

export interface RoomPhotoSet {
  room: string;
  level: number;
  overview: PhotoEntry[];
  details: PhotoEntry[];
  ceiling: PhotoEntry[];
}

export interface TechnicalPhotoSurvey {
  electricalPanel: PhotoEntry[];
  heating: PhotoEntry[];
  hotWater: PhotoEntry[];
  ventilation: PhotoEntry[];
  plumbing: PhotoEntry[];
  attic: PhotoEntry[];
  basement: PhotoEntry[];
  crawlSpace: PhotoEntry[];
}

export interface DefectPhotoSurvey {
  cracks: DefectPhoto[];
  moisture: DefectPhoto[];
  degradation: DefectPhoto[];
  other: DefectPhoto[];
}

export interface PhotoEntry {
  id: string;
  url: string;
  thumbnailUrl?: string;
  description: string;
  takenAt: string;
  location: string;
  aiAnalysis?: PhotoAIAnalysisResult;
}

export interface DefectPhoto extends PhotoEntry {
  defectType: string;
  severity: 'minor' | 'moderate' | 'major';
  measurements?: string;
}

export interface PhotoAIAnalysisResult {
  detectedElements: string[];
  condition?: ConditionGrade;
  issues: string[];
  suggestions: string[];
  confidence: ConfidenceLevel;
}

// =============================================================================
// PATHOLOGIES ET RISQUES
// =============================================================================

export interface BuildingPathology {
  id: string;
  type: PathologyType;
  category: PathologyCategory;
  location: string;
  description: string;
  cause: string;
  severity: 'minor' | 'moderate' | 'major' | 'critical';
  progression: 'stable' | 'slow' | 'active' | 'rapid';
  structuralImpact: boolean;
  safetyRisk: boolean;
  healthRisk: boolean;
  urgency: Priority;
  treatment: string;
  estimatedCost: EstimationRange;
  photos?: string[];
}

export type PathologyType =
  | 'structural_crack'
  | 'settlement'
  | 'moisture_rising_damp'
  | 'moisture_infiltration'
  | 'moisture_condensation'
  | 'timber_rot'
  | 'timber_insects'
  | 'asbestos'
  | 'lead_paint'
  | 'electrical_hazard'
  | 'gas_hazard'
  | 'thermal_defect'
  | 'acoustic_defect'
  | 'facade_degradation'
  | 'roof_degradation'
  | 'other';

export type PathologyCategory =
  | 'structural'
  | 'moisture'
  | 'biological'
  | 'hazardous_materials'
  | 'safety'
  | 'thermal'
  | 'acoustic'
  | 'aesthetic';

export interface RiskMatrixEntry {
  id: string;
  risk: string;
  category: PathologyCategory;
  probability: 'confirmed' | 'probable' | 'possible' | 'unlikely';
  impact: 'critical' | 'high' | 'medium' | 'low';
  overallRisk: 'critical' | 'high' | 'medium' | 'low';
  mitigation: string;
  estimatedCost: EstimationRange;
  timeline: string;
}

// =============================================================================
// RECOMMANDATIONS ET IMPACT
// =============================================================================

export interface DiagnosticRecommendation {
  id: string;
  priority: Priority;
  category: PathologyCategory;
  title: string;
  description: string;
  rationale: string;
  workType: string;
  estimatedCost: EstimationRange;
  urgency: 'immediate' | 'short_term' | 'medium_term' | 'long_term';
  regulatory: boolean;
  impactOnProject: ProjectImpactType;
  prerequisites?: string[];
  alternatives?: string[];
}

export type ProjectImpactType =
  | 'blocking'           // Bloquant - doit être fait avant
  | 'mandatory_addition' // Ajout obligatoire au projet
  | 'recommended_addition' // Ajout recommandé
  | 'scope_modification' // Modification du périmètre
  | 'cost_increase'      // Surcoût
  | 'schedule_impact'    // Impact planning
  | 'neutral';           // Neutre

export interface ProjectImpactAssessment {
  overallImpact: 'blocking' | 'significant' | 'moderate' | 'minor' | 'none';

  blockingItems: BlockingItem[];

  mandatoryAdditions: MandatoryAddition[];

  budgetImpact: BudgetImpact;

  scheduleImpact: ScheduleImpact;

  scopeModifications: ScopeModification[];

  riskSummary: string;

  recommendations: string[];
}

export interface BlockingItem {
  description: string;
  reason: string;
  resolution: string;
  cost: EstimationRange;
  timeline: string;
}

export interface MandatoryAddition {
  description: string;
  reason: string;
  category: string;
  cost: EstimationRange;
  integratedInProject: boolean;
}

export interface BudgetImpact {
  additionalCost: EstimationRange;
  contingencyRecommendation: number; // %
  breakdown: BudgetImpactItem[];
}

export interface BudgetImpactItem {
  category: string;
  description: string;
  cost: EstimationRange;
}

export interface ScheduleImpact {
  additionalDuration: string;
  criticalPath: boolean;
  items: ScheduleImpactItem[];
}

export interface ScheduleImpactItem {
  description: string;
  duration: string;
  sequencing: 'before_project' | 'during_project' | 'flexible';
}

export interface ScopeModification {
  original: string;
  modified: string;
  reason: string;
  costImpact: 'increase' | 'decrease' | 'neutral';
}
