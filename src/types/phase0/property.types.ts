/**
 * TORP Phase 0 - Types du Bien Immobilier
 * Module 0.2 : Définition du Besoin (Bien)
 * Module 0.3 : Diagnostic de l'Existant
 */

import type {
  TORPMetadata,
  Address,
  DocumentReference,
  ConfidenceLevel,
  EstimationRange,
  Phase0Alert,
} from './common.types';

// =============================================================================
// BIEN IMMOBILIER PRINCIPAL
// =============================================================================

export interface Property {
  id: string;
  identification: PropertyIdentification;
  characteristics: PropertyCharacteristics;
  construction: ConstructionDetails;
  currentCondition: CurrentCondition;
  heritageStatus: HeritageStatus;
  diagnostics: DiagnosticsBundle;
  sinisterHistory: SinisterHistory;
  existingEquipments: EquipmentsBundle;
  environment: EnvironmentContext;
  condo?: CondoInfo;
  documents: DocumentReference[];
  photos: PropertyPhoto[];
  alerts: Phase0Alert[];
  torpMetadata: TORPMetadata;
}

// =============================================================================
// IDENTIFICATION DU BIEN
// =============================================================================

export interface PropertyIdentification {
  type: PropertyType;
  subType?: PropertySubType;
  name?: string;
  address: Address;
  taxId?: string; // Numéro fiscal
  cadastralReferences: CadastralParcel[];
  landTitle?: string;
  buildingPermitNumber?: string;
  buildingPermitDate?: string;
}

export type PropertyType =
  | 'house'           // Maison
  | 'apartment'       // Appartement
  | 'building'        // Immeuble entier
  | 'commercial'      // Local commercial
  | 'mixed_use'       // Mixte (habitation + commerce)
  | 'industrial'      // Local industriel
  | 'land'            // Terrain
  | 'other';

export type PropertySubType =
  // Maisons
  | 'detached_house'      // Maison individuelle
  | 'semi_detached'       // Maison mitoyenne
  | 'townhouse'           // Maison de ville
  | 'villa'               // Villa
  | 'farmhouse'           // Corps de ferme
  | 'manor'               // Manoir/Château
  | 'mobile_home'         // Mobil-home
  | 'tiny_house'
  // Appartements
  | 'studio'
  | 'duplex'
  | 'triplex'
  | 'loft'
  | 'penthouse'
  // Commerciaux
  | 'shop'                // Boutique
  | 'office'              // Bureau
  | 'restaurant'
  | 'warehouse'           // Entrepôt
  | 'workshop';           // Atelier

export interface CadastralParcel {
  section: string;
  parcel: string;
  prefix?: string;
  surface: number; // m²
  natureOfCulture?: string;
  buildable: boolean;
}

// =============================================================================
// CARACTÉRISTIQUES DU BIEN
// =============================================================================

export interface PropertyCharacteristics {
  surfaces: PropertySurfaces;
  levels: LevelConfiguration;
  rooms: RoomConfiguration;
  outdoor: OutdoorSpaces;
  parking: ParkingInfo;
  orientation: Orientation;
}

export interface PropertySurfaces {
  livingArea: number;           // Surface habitable (loi Carrez si applicable)
  totalFloorArea: number;       // Surface plancher totale
  usableArea?: number;          // Surface utile
  plotSize?: number;            // Surface terrain
  builtFootprint?: number;      // Emprise au sol
  annexSurface?: number;        // Surfaces annexes (cave, grenier, garage...)
  terraceArea?: number;
  balconyArea?: number;
  gardenArea?: number;
  carrezCertified: boolean;
  carrezDate?: string;
}

export interface LevelConfiguration {
  totalLevels: number;
  levelDetails: LevelDetail[];
  hasBasement: boolean;
  basementType?: BasementType;
  hasAttic: boolean;
  atticConvertible: boolean;
  atticHeight?: number;
  ceilingHeight: number; // Hauteur sous plafond moyenne
  maxCeilingHeight?: number;
  minCeilingHeight?: number;
}

export interface LevelDetail {
  level: number; // -1 = sous-sol, 0 = RDC, 1 = étage, etc.
  name: string;
  surface: number;
  ceilingHeight: number;
  accessible: boolean;
  heated: boolean;
  mainUse: RoomType;
}

export type BasementType =
  | 'full'           // Sous-sol total
  | 'partial'        // Sous-sol partiel
  | 'cellar'         // Cave
  | 'crawl_space'    // Vide sanitaire
  | 'slab_on_grade'; // Dallage sur terre-plein

export interface RoomConfiguration {
  totalRooms: number;         // Nombre de pièces principales
  bedrooms: number;
  bathrooms: number;
  showerRooms: number;
  toilets: number;
  kitchenType: KitchenType;
  livingRooms: number;
  diningRooms: number;
  offices: number;
  storageRooms: number;
  roomDetails?: RoomDetail[];
}

export type KitchenType =
  | 'separate'        // Cuisine fermée
  | 'open'            // Cuisine ouverte
  | 'american'        // Cuisine américaine
  | 'kitchenette'
  | 'none';

export interface RoomDetail {
  name: string;
  type: RoomType;
  level: number;
  surface: number;
  ceilingHeight?: number;
  hasWindow: boolean;
  windowCount?: number;
  orientation?: CardinalDirection;
  currentCondition: ConditionGrade;
  specificNotes?: string;
}

export type RoomType =
  | 'living_room' | 'dining_room' | 'bedroom' | 'bathroom' | 'shower_room'
  | 'toilet' | 'kitchen' | 'office' | 'laundry' | 'dressing' | 'storage'
  | 'cellar' | 'attic' | 'garage' | 'workshop' | 'veranda' | 'entrance'
  | 'hallway' | 'staircase' | 'utility' | 'other';

export interface OutdoorSpaces {
  hasGarden: boolean;
  gardenType?: GardenType;
  gardenSurface?: number;
  hasPool: boolean;
  poolType?: PoolType;
  poolSurface?: number;
  hasTerrace: boolean;
  terraceType?: TerraceType;
  hasBalcony: boolean;
  hasPatio: boolean;
  hasCourtyard: boolean;
  fencing?: FencingType;
  landscaping?: LandscapingLevel;
}

export type GardenType =
  | 'front' | 'back' | 'side' | 'surrounding' | 'shared';

export type PoolType =
  | 'in_ground' | 'above_ground' | 'semi_in_ground' | 'natural';

export type TerraceType =
  | 'ground_level' | 'roof' | 'elevated' | 'covered';

export type FencingType =
  | 'none' | 'partial' | 'full' | 'wall' | 'hedge' | 'mixed';

export type LandscapingLevel =
  | 'none' | 'basic' | 'maintained' | 'designed' | 'elaborate';

export interface ParkingInfo {
  hasParking: boolean;
  parkingSpaces: number;
  parkingTypes: ParkingType[];
  garageCount: number;
  garageType?: GarageType;
  carportCount: number;
  electricChargingPoint: boolean;
}

export type ParkingType =
  | 'street' | 'private_outdoor' | 'garage' | 'carport' | 'underground' | 'covered';

export type GarageType =
  | 'attached' | 'detached' | 'underground' | 'shared';

export interface Orientation {
  mainExposure: CardinalDirection;
  gardenExposure?: CardinalDirection;
  livingRoomExposure?: CardinalDirection;
  bedroomExposures?: CardinalDirection[];
  sunlightQuality: SunlightQuality;
  viewQuality?: ViewQuality;
}

export type CardinalDirection =
  | 'N' | 'NE' | 'E' | 'SE' | 'S' | 'SW' | 'W' | 'NW';

export type SunlightQuality =
  | 'excellent' | 'good' | 'average' | 'poor' | 'very_poor';

export type ViewQuality =
  | 'exceptional' | 'open' | 'pleasant' | 'urban' | 'vis_a_vis' | 'obstructed';

// =============================================================================
// DÉTAILS DE CONSTRUCTION
// =============================================================================

export interface ConstructionDetails {
  constructionYear: number;
  constructionDecade?: string; // Pour estimation si année inconnue
  constructionPeriod: ConstructionPeriod;
  architecturalStyle?: ArchitecturalStyle;
  structure: StructureDetails;
  roofing: RoofingDetails;
  facade: FacadeDetails;
  openings: OpeningsDetails;
  majorRenovations?: MajorRenovation[];
}

export type ConstructionPeriod =
  | 'before_1850'    // Avant 1850
  | '1850_1913'      // Haussmannien
  | '1914_1947'      // Entre-deux-guerres
  | '1948_1974'      // Reconstruction / 30 glorieuses
  | '1975_1981'      // Post première réglementation thermique
  | '1982_1988'      // RT 1982
  | '1989_1999'      // RT 1988
  | '2000_2005'      // RT 2000
  | '2006_2012'      // RT 2005
  | '2013_2021'      // RT 2012
  | '2022_present';  // RE 2020

export type ArchitecturalStyle =
  | 'traditional' | 'contemporary' | 'modern' | 'art_deco' | 'haussmannian'
  | 'regional' | 'industrial' | 'neo_classical' | 'provencal' | 'breton'
  | 'alsatian' | 'basque' | 'norman' | 'other';

export interface StructureDetails {
  structureType: StructureType;
  foundationType?: FoundationType;
  wallConstruction: WallConstruction[];
  floorConstruction: FloorConstruction;
  loadBearingWalls?: LoadBearingWallInfo;
  structuralCondition: ConditionGrade;
  structuralIssues?: StructuralIssue[];
}

export type StructureType =
  | 'traditional_masonry'   // Maçonnerie traditionnelle
  | 'concrete'              // Béton armé
  | 'timber_frame'          // Ossature bois
  | 'steel_frame'           // Ossature métallique
  | 'mixed'                 // Mixte
  | 'prefab'                // Préfabriqué
  | 'stone';                // Pierre

export type FoundationType =
  | 'strip'                 // Fondations filantes
  | 'slab'                  // Radier
  | 'piles'                 // Pieux
  | 'crawl_space'           // Vide sanitaire
  | 'deep'                  // Fondations profondes
  | 'unknown';

export interface WallConstruction {
  location: 'exterior' | 'interior' | 'load_bearing';
  material: WallMaterial;
  thickness?: number;
  insulation?: InsulationInfo;
}

export type WallMaterial =
  | 'solid_brick' | 'hollow_brick' | 'stone' | 'cinder_block' | 'aerated_concrete'
  | 'reinforced_concrete' | 'timber_frame' | 'steel' | 'rammed_earth' | 'other';

export type FloorConstruction =
  | 'concrete_slab' | 'hollow_core' | 'timber_joist' | 'steel_joist' | 'mixed';

export interface LoadBearingWallInfo {
  identified: boolean;
  locations?: string[];
  modifiable: boolean;
  engineerStudyRequired: boolean;
}

export type StructuralIssue =
  | 'cracks' | 'settlement' | 'moisture' | 'reinforcement_corrosion'
  | 'timber_rot' | 'insect_damage' | 'frost_damage' | 'earthquake_damage';

export interface RoofingDetails {
  roofType: RoofType;
  roofShape: RoofShape;
  roofCovering: RoofCovering;
  roofAge?: number;
  roofCondition: ConditionGrade;
  roofFramework: RoofFramework;
  insulation?: InsulationInfo;
  hasRoofWindow: boolean;
  roofWindowCount?: number;
  hasGutter: boolean;
  gutterMaterial?: GutterMaterial;
  lastMaintenanceDate?: string;
}

export type RoofType =
  | 'pitched' | 'flat' | 'mansard' | 'hip' | 'gable' | 'mixed';

export type RoofShape =
  | 'two_slopes' | 'four_slopes' | 'single_slope' | 'complex' | 'dome';

export type RoofCovering =
  | 'clay_tile' | 'concrete_tile' | 'slate' | 'zinc' | 'metal'
  | 'shingle' | 'thatch' | 'epdm' | 'bitumen' | 'green_roof' | 'other';

export type RoofFramework =
  | 'traditional_timber' | 'industrial_timber' | 'steel' | 'concrete' | 'mixed';

export type GutterMaterial =
  | 'zinc' | 'aluminum' | 'pvc' | 'copper' | 'galvanized_steel';

export interface FacadeDetails {
  facadeType: FacadeType;
  facadeCoating: FacadeCoating;
  facadeCondition: ConditionGrade;
  facadeColor?: string;
  hasExternalInsulation: boolean;
  externalInsulation?: InsulationInfo;
  facadeIssues?: FacadeIssue[];
  lastRenovationDate?: string;
}

export type FacadeType =
  | 'rendered' | 'brick_exposed' | 'stone_exposed' | 'cladding'
  | 'timber_cladding' | 'metal_cladding' | 'mixed';

export type FacadeCoating =
  | 'render' | 'paint' | 'lime_wash' | 'none' | 'other';

export type FacadeIssue =
  | 'cracks' | 'stains' | 'efflorescence' | 'moss' | 'render_detachment'
  | 'moisture_ingress' | 'paint_peeling' | 'graffiti';

export interface OpeningsDetails {
  windowMaterial: WindowMaterial;
  windowType: WindowType;
  glazingType: GlazingType;
  windowCondition: ConditionGrade;
  windowAge?: number;
  frontDoorMaterial: DoorMaterial;
  frontDoorSecurityLevel?: SecurityLevel;
  shutterType?: ShutterType;
  shutterMaterial?: ShutterMaterial;
  hasBlindedWindows: boolean;
}

export type WindowMaterial =
  | 'pvc' | 'aluminum' | 'timber' | 'mixed_timber_aluminum' | 'steel';

export type WindowType =
  | 'casement' | 'sliding' | 'tilt_and_turn' | 'fixed' | 'french_window';

export type GlazingType =
  | 'single' | 'double' | 'double_low_e' | 'triple' | 'double_argon';

export type DoorMaterial =
  | 'timber' | 'pvc' | 'aluminum' | 'steel' | 'composite';

export type SecurityLevel =
  | 'basic' | 'reinforced' | 'armored' | 'multi_point';

export type ShutterType =
  | 'hinged' | 'roller' | 'folding' | 'sliding' | 'bahamas' | 'none';

export type ShutterMaterial =
  | 'timber' | 'pvc' | 'aluminum' | 'steel';

export interface InsulationInfo {
  type: InsulationType;
  material?: InsulationMaterial;
  thickness?: number;
  rValue?: number; // Résistance thermique
  condition?: ConditionGrade;
  installationYear?: number;
}

export type InsulationType =
  | 'none' | 'interior' | 'exterior' | 'distributed' | 'cavity';

export type InsulationMaterial =
  | 'mineral_wool' | 'glass_wool' | 'rock_wool' | 'polystyrene_eps'
  | 'polystyrene_xps' | 'polyurethane' | 'cellulose' | 'wood_fiber'
  | 'hemp' | 'cork' | 'other';

export interface MajorRenovation {
  year: number;
  type: RenovationType;
  description: string;
  cost?: number;
  contractor?: string;
  hasWarranty: boolean;
  warrantyEndDate?: string;
  documentReferences?: string[];
}

export type RenovationType =
  | 'roof' | 'facade' | 'windows' | 'heating' | 'electrical' | 'plumbing'
  | 'insulation' | 'extension' | 'interior' | 'structural' | 'pool' | 'other';

// =============================================================================
// ÉTAT ACTUEL
// =============================================================================

export type ConditionGrade = 1 | 2 | 3 | 4 | 5;
// 1 = Très mauvais / À reconstruire
// 2 = Mauvais / Rénovation lourde nécessaire
// 3 = Moyen / Travaux de rafraîchissement
// 4 = Bon / Entretien courant
// 5 = Excellent / État neuf ou rénové récemment

export interface CurrentCondition {
  overallCondition: ConditionGrade;
  structuralCondition: ConditionGrade;
  roofCondition: ConditionGrade;
  facadeCondition: ConditionGrade;
  windowsCondition: ConditionGrade;
  electricalCondition: ConditionGrade;
  plumbingCondition: ConditionGrade;
  heatingCondition: ConditionGrade;
  interiorCondition: ConditionGrade;
  outdoorCondition?: ConditionGrade;
  lastInspectionDate?: string;
  inspectionBy?: string;
  conditionNotes?: string;
  urgentRepairs?: UrgentRepair[];
}

export interface UrgentRepair {
  area: string;
  description: string;
  urgency: 'immediate' | 'short_term' | 'medium_term';
  estimatedCost?: EstimationRange;
}

// =============================================================================
// PATRIMOINE ET PROTECTION
// =============================================================================

export interface HeritageStatus {
  isProtected: boolean;
  protectionType?: ProtectionType;
  protectionLevel?: ProtectionLevel;
  monumentRef?: string;
  inscriptionDate?: string;
  isInProtectedZone: boolean;
  protectedZoneType?: ProtectedZoneType;
  abfRequired: boolean; // Architecte des Bâtiments de France
  abfContact?: string;
  constraints?: HeritageConstraint[];
  allowedMaterials?: string[];
  forbiddenMaterials?: string[];
}

export type ProtectionType =
  | 'historic_monument'     // Monument historique classé
  | 'historic_inscription'  // Monument historique inscrit
  | 'remarkable_heritage'   // Patrimoine remarquable
  | 'local_interest'        // Intérêt local
  | 'none';

export type ProtectionLevel =
  | 'total'    // Protection totale
  | 'partial'  // Protection partielle
  | 'facade'   // Façade uniquement
  | 'interior' // Intérieur uniquement
  | 'site';    // Site (environnement)

export type ProtectedZoneType =
  | 'abf_500m'              // Périmètre 500m monument historique
  | 'sppr'                  // Site Patrimonial Remarquable
  | 'avap'                  // AVAP
  | 'zppaup'                // ZPPAUP
  | 'psmv'                  // Plan de Sauvegarde et Mise en Valeur
  | 'unesco'                // Patrimoine mondial UNESCO
  | 'natural_site';         // Site naturel classé

export interface HeritageConstraint {
  type: HeritageConstraintType;
  description: string;
  affectedElements: string[];
  flexibility: 'strict' | 'negotiable' | 'advisory';
}

export type HeritageConstraintType =
  | 'material' | 'color' | 'height' | 'volume' | 'opening' | 'roof' | 'facade';

// =============================================================================
// DIAGNOSTICS TECHNIQUES
// =============================================================================

export interface DiagnosticsBundle {
  dpe?: DPEDiagnostic;
  asbestos?: AsbestosDiagnostic;
  lead?: LeadDiagnostic;
  electricity?: ElectricityDiagnostic;
  gas?: GasDiagnostic;
  termites?: TermiteDiagnostic;
  erp?: ERPDiagnostic;
  merule?: MeruleDiagnostic;
  noise?: NoiseDiagnostic;
  sanitation?: SanitationDiagnostic;
  structuralStudy?: StructuralStudy;
  soilStudy?: SoilStudy;
  otherDiagnostics?: OtherDiagnostic[];
}

export interface BaseDiagnostic {
  id: string;
  date: string;
  expirationDate?: string;
  isValid: boolean;
  diagnostician: string;
  diagnosticianCertification?: string;
  documentUrl?: string;
  confidence: ConfidenceLevel;
}

export interface DPEDiagnostic extends BaseDiagnostic {
  type: 'dpe';
  energyClass: EnergyClass;
  ghgClass: EnergyClass;
  energyConsumption: number;   // kWh/m²/an
  ghgEmissions: number;        // kgCO2/m²/an
  heatingEnergy: PrimaryEnergy;
  hotWaterEnergy?: PrimaryEnergy;
  renewableEnergyPercentage?: number;
  recommendedWorks?: DPERecommendation[];
  estimatedBillLow?: number;
  estimatedBillHigh?: number;
  ademeNumber?: string;
}

export type EnergyClass = 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G';

export type PrimaryEnergy =
  | 'electricity' | 'natural_gas' | 'heating_oil' | 'propane' | 'butane'
  | 'wood_logs' | 'wood_pellets' | 'wood_chips' | 'district_heating'
  | 'heat_pump' | 'solar_thermal' | 'other';

export interface DPERecommendation {
  type: string;
  description: string;
  estimatedCost?: EstimationRange;
  estimatedSavings?: number;
  newEnergyClass?: EnergyClass;
  priority: 'high' | 'medium' | 'low';
}

export interface AsbestosDiagnostic extends BaseDiagnostic {
  type: 'asbestos';
  hasAsbestos: boolean;
  riskLevel?: AsbestosRiskLevel;
  locations?: AsbestosLocation[];
  periodicControlRequired: boolean;
  nextControlDate?: string;
  removalRequired: boolean;
  removalDeadline?: string;
}

export type AsbestosRiskLevel = 1 | 2 | 3;

export interface AsbestosLocation {
  location: string;
  material: string;
  condition: 'good' | 'degraded' | 'critical';
  action: 'monitoring' | 'encapsulation' | 'removal';
}

export interface LeadDiagnostic extends BaseDiagnostic {
  type: 'lead';
  hasLead: boolean;
  concentration?: number; // mg/cm²
  riskLevel?: LeadRiskLevel;
  locations?: LeadLocation[];
  workRequired: boolean;
}

export type LeadRiskLevel = 0 | 1 | 2 | 3;

export interface LeadLocation {
  location: string;
  element: string;
  concentration: number;
  condition: 'good' | 'degraded' | 'critical';
}

export interface ElectricityDiagnostic extends BaseDiagnostic {
  type: 'electricity';
  installationYear?: number;
  isCompliant: boolean;
  anomaliesCount: number;
  anomalies?: ElectricalAnomaly[];
  hasGrounding: boolean;
  hasRCD: boolean; // Disjoncteur différentiel
  panelCondition: ConditionGrade;
  upgradeRequired: boolean;
}

export interface ElectricalAnomaly {
  code: string;
  description: string;
  severity: 'minor' | 'major' | 'critical';
  location: string;
}

export interface GasDiagnostic extends BaseDiagnostic {
  type: 'gas';
  hasGasInstallation: boolean;
  installationYear?: number;
  isCompliant: boolean;
  anomaliesCount: number;
  anomalies?: GasAnomaly[];
  immediateRisk: boolean;
  ventilationCompliant: boolean;
}

export interface GasAnomaly {
  code: string;
  description: string;
  severity: 'a1' | 'a2' | 'dgi'; // DGI = Danger Grave Immédiat
  location: string;
}

export interface TermiteDiagnostic extends BaseDiagnostic {
  type: 'termites';
  hasTermites: boolean;
  hasOtherXylophages: boolean;
  infestationLevel?: InfestationLevel;
  affectedAreas?: string[];
  treatmentRequired: boolean;
  treatmentRecommendation?: string;
}

export type InfestationLevel = 'none' | 'traces' | 'active' | 'severe';

export interface ERPDiagnostic extends BaseDiagnostic {
  type: 'erp';
  naturalRisks: NaturalRisk[];
  technologicalRisks: TechnologicalRisk[];
  miningRisks: boolean;
  radonLevel?: RadonLevel;
  pollutedSoils: boolean;
  previousSinisterHistory: boolean;
  sinisterDetails?: string;
}

export interface NaturalRisk {
  type: NaturalRiskType;
  level: 'low' | 'medium' | 'high' | 'very_high';
  zone?: string;
  prescriptions?: string[];
}

export type NaturalRiskType =
  | 'flood' | 'earthquake' | 'landslide' | 'clay_shrinkage' | 'coastal_erosion'
  | 'avalanche' | 'forest_fire' | 'storm' | 'volcanic';

export interface TechnologicalRisk {
  type: TechnologicalRiskType;
  level: 'low' | 'medium' | 'high';
  source?: string;
  distance?: number;
}

export type TechnologicalRiskType =
  | 'industrial' | 'nuclear' | 'transport' | 'mining' | 'dam';

export type RadonLevel = 1 | 2 | 3;

export interface MeruleDiagnostic extends BaseDiagnostic {
  type: 'merule';
  hasMerule: boolean;
  hasOtherFungi: boolean;
  affectedAreas?: string[];
  treatmentRequired: boolean;
}

export interface NoiseDiagnostic extends BaseDiagnostic {
  type: 'noise';
  noiseZone?: NoiseZone;
  airportProximity: boolean;
  railwayProximity: boolean;
  roadwayProximity: boolean;
  measuredLevel?: number; // dB
}

export type NoiseZone = 'A' | 'B' | 'C' | 'D';

export interface SanitationDiagnostic extends BaseDiagnostic {
  type: 'sanitation';
  sanitationType: SanitationType;
  isCompliant: boolean;
  systemAge?: number;
  systemCapacity?: number;
  anomalies?: string[];
  upgradeRequired: boolean;
  upgradeDeadline?: string;
}

export type SanitationType =
  | 'collective' | 'individual_tank' | 'individual_filter' | 'other';

export interface StructuralStudy extends BaseDiagnostic {
  type: 'structural';
  engineer: string;
  engineerInsurance?: string;
  structuralCondition: ConditionGrade;
  loadCapacity?: LoadCapacityInfo;
  recommendations?: string[];
  worksRequired?: StructuralWork[];
}

export interface LoadCapacityInfo {
  floorLoad: number; // kg/m²
  roofLoad: number;
  modificationPossible: boolean;
}

export interface StructuralWork {
  description: string;
  priority: 'immediate' | 'short_term' | 'medium_term';
  estimatedCost?: EstimationRange;
}

export interface SoilStudy extends BaseDiagnostic {
  type: 'soil';
  studyLevel: 'G1' | 'G2' | 'G3' | 'G4' | 'G5';
  soilType: SoilType;
  bearingCapacity?: number;
  waterTable?: WaterTableInfo;
  foundationRecommendation?: string;
  specialFoundationRequired: boolean;
}

export type SoilType =
  | 'rock' | 'gravel' | 'sand' | 'silt' | 'clay' | 'peat' | 'mixed' | 'fill';

export interface WaterTableInfo {
  depth: number;
  seasonal: boolean;
  drainageRequired: boolean;
}

export interface OtherDiagnostic extends BaseDiagnostic {
  type: 'other';
  name: string;
  result: string;
  recommendations?: string[];
}

// =============================================================================
// HISTORIQUE DES SINISTRES
// =============================================================================

export interface SinisterHistory {
  hasSinisters: boolean;
  sinisters: Sinister[];
  hasOpenClaims: boolean;
  openClaims?: OpenClaim[];
  catNatHistory?: CatNatEvent[];
}

export interface Sinister {
  date: string;
  type: SinisterType;
  description: string;
  cause?: string;
  severity: 'minor' | 'moderate' | 'major' | 'total';
  repaired: boolean;
  repairDate?: string;
  repairCost?: number;
  insuranceClaim: boolean;
  claimNumber?: string;
  residualDamage?: string;
}

export type SinisterType =
  | 'water_damage' | 'fire' | 'storm' | 'flood' | 'earthquake'
  | 'subsidence' | 'burglary' | 'vandalism' | 'structural' | 'other';

export interface OpenClaim {
  claimNumber: string;
  type: SinisterType;
  date: string;
  status: 'filed' | 'investigation' | 'negotiation' | 'litigation';
  estimatedAmount?: number;
}

export interface CatNatEvent {
  date: string;
  type: string;
  arreteNumber: string;
  affectedProperty: boolean;
  claimFiled?: boolean;
}

// =============================================================================
// ÉQUIPEMENTS EXISTANTS
// =============================================================================

export interface EquipmentsBundle {
  heating: HeatingSystem;
  hotWater: HotWaterSystem;
  ventilation: VentilationSystem;
  electrical: ElectricalSystem;
  plumbing: PlumbingSystem;
  airConditioning?: AirConditioningSystem;
  renewable?: RenewableEnergy[];
  security?: SecuritySystem;
  comfort?: ComfortEquipment[];
}

export interface HeatingSystem {
  type: HeatingType;
  energy: PrimaryEnergy;
  brand?: string;
  model?: string;
  power?: number; // kW
  installationYear?: number;
  condition: ConditionGrade;
  efficiency?: number; // %
  distributionType: HeatingDistribution;
  emitters: HeatingEmitter[];
  hasZoning: boolean;
  hasThermostat: boolean;
  thermostatType?: ThermostatType;
  annualConsumption?: number;
  lastServiceDate?: string;
  nextServiceDate?: string;
  remainingLifespan?: number; // années
}

export type HeatingType =
  | 'central_boiler' | 'heat_pump' | 'electric_direct' | 'wood_stove'
  | 'pellet_stove' | 'wood_boiler' | 'pellet_boiler' | 'district_heating'
  | 'underfloor' | 'mixed' | 'none';

export type HeatingDistribution =
  | 'radiators' | 'underfloor' | 'fan_coils' | 'air' | 'mixed' | 'direct';

export interface HeatingEmitter {
  type: EmitterType;
  count: number;
  material?: string;
  condition: ConditionGrade;
}

export type EmitterType =
  | 'cast_iron_radiator' | 'steel_radiator' | 'aluminum_radiator'
  | 'towel_radiator' | 'convector' | 'radiant_panel' | 'fan_coil'
  | 'underfloor_water' | 'underfloor_electric' | 'ceiling_radiant';

export type ThermostatType =
  | 'manual' | 'programmable' | 'connected' | 'room_by_room' | 'none';

export interface HotWaterSystem {
  type: HotWaterType;
  energy: PrimaryEnergy;
  brand?: string;
  capacity?: number; // litres
  installationYear?: number;
  condition: ConditionGrade;
  solarAssist: boolean;
  thermodynamic: boolean;
  instantaneous: boolean;
}

export type HotWaterType =
  | 'electric_tank' | 'gas_tank' | 'gas_instant' | 'thermodynamic'
  | 'solar' | 'boiler_connected' | 'heat_pump' | 'mixed';

export interface VentilationSystem {
  type: VentilationType;
  brand?: string;
  installationYear?: number;
  condition: ConditionGrade;
  extractPoints: number;
  supplyPoints?: number;
  hasHeatRecovery: boolean;
  heatRecoveryEfficiency?: number;
  lastMaintenanceDate?: string;
  filtersClean: boolean;
}

export type VentilationType =
  | 'none' | 'natural' | 'vmc_simple_auto' | 'vmc_simple_hygro_a'
  | 'vmc_simple_hygro_b' | 'vmc_double' | 'vmr' | 'vmi' | 'positive_pressure';

export interface ElectricalSystem {
  panelType: ElectricalPanelType;
  panelCapacity: number; // Ampères
  threePhase: boolean;
  installationYear?: number;
  condition: ConditionGrade;
  circuitsCount: number;
  hasRCD: boolean;
  rcdType?: RCDType;
  socketCount: number;
  outdoorSocketCount: number;
  hasSurgeProtection: boolean;
  networkType?: ElectricalNetworkType;
  smartMeter: boolean;
  preparedForEV: boolean;
  evChargerInstalled: boolean;
}

export type ElectricalPanelType =
  | 'fuses' | 'breakers' | 'modern_breakers' | 'smart_panel';

export type RCDType = 'ac' | 'a' | 'f' | 'b' | 'si';

export type ElectricalNetworkType = 'overhead' | 'underground' | 'mixed';

export interface PlumbingSystem {
  waterSource: WaterSource;
  waterHardness?: WaterHardness;
  hasWaterSoftener: boolean;
  hasWaterFilter: boolean;
  pipeMaterial: PipeMaterial;
  pipeCondition: ConditionGrade;
  waterPressure?: number; // bars
  hasPressureReducer: boolean;
  hotWaterCirculation: boolean;
  drainMaterial?: DrainMaterial;
  drainCondition?: ConditionGrade;
  septicTank?: SepticTankInfo;
}

export type WaterSource = 'municipal' | 'well' | 'spring' | 'rainwater' | 'mixed';

export type WaterHardness = 'soft' | 'medium' | 'hard' | 'very_hard';

export type PipeMaterial =
  | 'copper' | 'pex' | 'polybutylene' | 'galvanized' | 'lead' | 'cpvc' | 'mixed';

export type DrainMaterial = 'pvc' | 'cast_iron' | 'concrete' | 'clay' | 'mixed';

export interface SepticTankInfo {
  type: SanitationType;
  capacity: number;
  installationYear?: number;
  lastEmptyDate?: string;
  condition: ConditionGrade;
  compliant: boolean;
}

export interface AirConditioningSystem {
  type: ACType;
  brand?: string;
  power?: number; // kW
  installationYear?: number;
  condition: ConditionGrade;
  unitsCount: number;
  roomsCovered: string[];
  energyClass?: EnergyClass;
  reversible: boolean;
}

export type ACType =
  | 'split' | 'multi_split' | 'ducted' | 'vrv' | 'portable' | 'casette';

export interface RenewableEnergy {
  type: RenewableType;
  capacity?: number;
  installationYear?: number;
  condition: ConditionGrade;
  annualProduction?: number;
  feedInTariff?: boolean;
  selfConsumption?: boolean;
  storageCapacity?: number;
}

export type RenewableType =
  | 'solar_pv' | 'solar_thermal' | 'wind' | 'heat_pump_air'
  | 'heat_pump_ground' | 'heat_pump_water' | 'biomass';

export interface SecuritySystem {
  hasAlarm: boolean;
  alarmType?: AlarmType;
  hasVideoSurveillance: boolean;
  camerasCount?: number;
  hasRemoteMonitoring: boolean;
  hasAccessControl: boolean;
  hasSmokeDet: boolean;
  smokeDetectorsCount?: number;
  hasCODetector: boolean;
  hasFireExtinguisher: boolean;
  hasSafe: boolean;
}

export type AlarmType = 'wired' | 'wireless' | 'connected' | 'monitored';

export interface ComfortEquipment {
  type: ComfortEquipmentType;
  brand?: string;
  installationYear?: number;
  condition: ConditionGrade;
}

export type ComfortEquipmentType =
  | 'jacuzzi' | 'sauna' | 'steam_room' | 'home_theater' | 'home_automation'
  | 'intercom' | 'central_vacuum' | 'elevator' | 'stairlift';

// =============================================================================
// ENVIRONNEMENT
// =============================================================================

export interface EnvironmentContext {
  urbanContext: UrbanContext;
  localInfrastructure: LocalInfrastructure;
  nuisances: NuisanceAssessment;
  climate: ClimateContext;
  neighborhoodRelations?: NeighborhoodRelations;
}

export interface UrbanContext {
  zoneType: UrbanZoneType;
  pluZone?: string;
  density: DensityLevel;
  buildingRights?: BuildingRights;
  siteAccessibility: AccessibilityLevel;
  proximityToServices: ProximityLevel;
  publicTransport: PublicTransportAccess;
}

export type UrbanZoneType =
  | 'urban_center' | 'urban' | 'suburban' | 'peri_urban' | 'rural' | 'isolated';

export type DensityLevel = 'high' | 'medium' | 'low' | 'very_low';

export interface BuildingRights {
  cos?: number;       // Coefficient d'Occupation des Sols
  ces?: number;       // Coefficient d'Emprise au Sol
  maxHeight?: number; // Hauteur maximale
  setbacks?: Setback[];
  allowedUses?: string[];
  restrictions?: string[];
}

export interface Setback {
  type: 'road' | 'boundary' | 'building';
  distance: number;
}

export type AccessibilityLevel = 'excellent' | 'good' | 'moderate' | 'difficult' | 'very_difficult';

export type ProximityLevel = 'immediate' | 'walking' | 'cycling' | 'driving' | 'remote';

export interface PublicTransportAccess {
  hasMetro: boolean;
  metroDistance?: number;
  hasTram: boolean;
  tramDistance?: number;
  hasBus: boolean;
  busDistance?: number;
  hasTrain: boolean;
  trainDistance?: number;
  overallAccessibility: AccessibilityLevel;
}

export interface LocalInfrastructure {
  electricityAvailable: boolean;
  gasAvailable: boolean;
  waterAvailable: boolean;
  sewerAvailable: boolean;
  fiberAvailable: boolean;
  districtHeatingAvailable: boolean;
  connectionDistances?: ConnectionDistances;
}

export interface ConnectionDistances {
  electricity?: number;
  gas?: number;
  water?: number;
  sewer?: number;
  fiber?: number;
}

export interface NuisanceAssessment {
  noiseLevel: NuisanceLevel;
  noiseSources?: string[];
  pollutionLevel: NuisanceLevel;
  pollutionSources?: string[];
  visualNuisance: NuisanceLevel;
  visualNuisanceSources?: string[];
  odorNuisance: NuisanceLevel;
  odorSources?: string[];
  lightPollution: NuisanceLevel;
}

export type NuisanceLevel = 'none' | 'low' | 'moderate' | 'high' | 'severe';

export interface ClimateContext {
  climateZone: ClimateZone;
  altitude: number;
  averageTemperature?: number;
  heatingDegreeDays?: number;
  sunshineHours?: number;
  dominantWindDirection?: CardinalDirection;
  windExposure: ExposureLevel;
  precipitationLevel: PrecipitationLevel;
  frostRisk: RiskLevel;
  heatWaveRisk: RiskLevel;
}

export type ClimateZone = 'H1a' | 'H1b' | 'H1c' | 'H2a' | 'H2b' | 'H2c' | 'H2d' | 'H3';

export type ExposureLevel = 'sheltered' | 'moderate' | 'exposed' | 'very_exposed';

export type PrecipitationLevel = 'low' | 'moderate' | 'high' | 'very_high';

export type RiskLevel = 'low' | 'moderate' | 'high';

export interface NeighborhoodRelations {
  relationshipQuality: 'excellent' | 'good' | 'neutral' | 'tense' | 'conflictual';
  notifiedOfProject: boolean;
  potentialOpposition: boolean;
  oppositionReasons?: string[];
  sharedStructures?: SharedStructure[];
}

export interface SharedStructure {
  type: 'wall' | 'fence' | 'driveway' | 'septic' | 'well' | 'other';
  description: string;
  agreementExists: boolean;
  agreementDocumentUrl?: string;
}

// =============================================================================
// COPROPRIÉTÉ
// =============================================================================

export interface CondoInfo {
  isInCondo: boolean;
  condoName?: string;
  trusteeName?: string;
  trusteeContact?: ContactInfo;
  totalLots: number;
  lotNumber?: string;
  sharePercentage?: number;
  annualCharges?: number;
  reserveFund?: number;
  majorWorksFund?: number;
  hasElevator?: boolean;
  hasCaretaker?: boolean;
  condoCondition?: ConditionGrade;
  recentDecisions?: CondoDecision[];
  plannedWorks?: CondoWork[];
  financialHealth?: CondoFinancialHealth;
}

export interface CondoDecision {
  date: string;
  type: CondoDecisionType;
  description: string;
  cost?: number;
  approved: boolean;
}

export type CondoDecisionType =
  | 'major_works' | 'maintenance' | 'rules_change' | 'budget' | 'trustee' | 'other';

export interface CondoWork {
  description: string;
  estimatedCost: number;
  votedDate?: string;
  plannedStartDate?: string;
  yourShare?: number;
  status: 'planned' | 'voted' | 'in_progress' | 'completed';
}

export type CondoFinancialHealth = 'excellent' | 'good' | 'concerning' | 'critical';

// =============================================================================
// PHOTOS DU BIEN
// =============================================================================

export interface PropertyPhoto {
  id: string;
  url: string;
  thumbnailUrl?: string;
  type: PhotoType;
  room?: string;
  level?: number;
  orientation?: CardinalDirection;
  description?: string;
  takenAt?: string;
  uploadedAt: string;
  aiAnalysis?: PhotoAIAnalysis;
}

export type PhotoType =
  | 'exterior_front' | 'exterior_back' | 'exterior_side' | 'garden'
  | 'roof' | 'facade_detail' | 'entrance' | 'interior_overview'
  | 'room' | 'equipment' | 'defect' | 'document' | 'before_works' | 'other';

export interface PhotoAIAnalysis {
  detectedElements: string[];
  condition?: ConditionGrade;
  issues?: string[];
  suggestions?: string[];
  confidence: ConfidenceLevel;
  analyzedAt: string;
}
