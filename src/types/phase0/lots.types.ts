/**
 * TORP Phase 0 - Types des Lots BTP
 * Définition des 48 lots de travaux BTP
 */

import type {
  TORPMetadata,
  ConfidenceLevel,
  EstimationRange,
  ScoringCriterion,
  Phase0Alert,
} from './common.types';

// =============================================================================
// STRUCTURE PRINCIPALE D'UN LOT
// =============================================================================

export interface WorkLot {
  id: string;
  lotNumber: string;
  lotName: string;
  category: LotCategory;
  description: string;
  selected: boolean;
  mandatory: boolean;
  dependencies: string[];         // IDs des lots prérequis
  incompatibilities?: string[];   // IDs des lots incompatibles
  qualificationQuestions: QualificationQuestion[];
  responses: Record<string, LotResponse>;
  dataSchema: LotDataSchema;
  options: LotOption[];
  regulations: LotRegulation[];
  alerts: Phase0Alert[];
  scoringCriteria: ScoringCriterion[];
  estimation: LotEstimation;
  torpMetadata: TORPMetadata;
}

// =============================================================================
// CATÉGORIES DE LOTS
// =============================================================================

export type LotCategory =
  | 'gros_oeuvre'       // Gros œuvre
  | 'enveloppe'         // Enveloppe
  | 'cloisonnement'     // Cloisonnement & Isolation
  | 'finitions'         // Finitions
  | 'electricite'       // Électricité
  | 'plomberie'         // Plomberie
  | 'cvc'               // Chauffage, Ventilation, Climatisation
  | 'ventilation'       // Ventilation
  | 'exterieurs'        // Extérieurs
  | 'speciaux';         // Lots spéciaux

export const LOT_CATEGORIES: Record<LotCategory, LotCategoryInfo> = {
  gros_oeuvre: {
    name: 'Gros Œuvre',
    description: 'Structure et fondations du bâtiment',
    order: 1,
    icon: 'building',
    color: '#8B4513',
  },
  enveloppe: {
    name: 'Enveloppe',
    description: 'Protection extérieure du bâtiment',
    order: 2,
    icon: 'home',
    color: '#CD853F',
  },
  cloisonnement: {
    name: 'Cloisonnement & Isolation',
    description: 'Aménagement intérieur et isolation',
    order: 3,
    icon: 'layout',
    color: '#D2691E',
  },
  finitions: {
    name: 'Finitions',
    description: 'Second œuvre et finitions',
    order: 4,
    icon: 'brush',
    color: '#F4A460',
  },
  electricite: {
    name: 'Électricité',
    description: 'Installations électriques',
    order: 5,
    icon: 'zap',
    color: '#FFD700',
  },
  plomberie: {
    name: 'Plomberie',
    description: 'Installations sanitaires et eau',
    order: 6,
    icon: 'droplet',
    color: '#4169E1',
  },
  cvc: {
    name: 'CVC',
    description: 'Chauffage, Ventilation, Climatisation',
    order: 7,
    icon: 'thermometer',
    color: '#FF4500',
  },
  ventilation: {
    name: 'Ventilation',
    description: 'Systèmes de ventilation',
    order: 8,
    icon: 'wind',
    color: '#87CEEB',
  },
  exterieurs: {
    name: 'Extérieurs',
    description: 'Aménagements extérieurs',
    order: 9,
    icon: 'tree',
    color: '#228B22',
  },
  speciaux: {
    name: 'Lots Spéciaux',
    description: 'Équipements et installations spécifiques',
    order: 10,
    icon: 'star',
    color: '#9370DB',
  },
};

export interface LotCategoryInfo {
  name: string;
  description: string;
  order: number;
  icon: string;
  color: string;
}

// =============================================================================
// DÉFINITION DES 48 LOTS BTP
// =============================================================================

export type LotType =
  // GROS ŒUVRE (7 lots)
  | 'demolition'              // 01 - Démolition
  | 'terrassement_vrd'        // 02 - Terrassement & VRD
  | 'maconnerie'              // 03 - Maçonnerie
  | 'beton_arme'              // 04 - Béton armé
  | 'charpente_bois'          // 05 - Charpente bois
  | 'charpente_metallique'    // 06 - Charpente métallique
  | 'ossature_bois'           // 07 - Ossature bois
  // ENVELOPPE (7 lots)
  | 'couverture'              // 08 - Couverture
  | 'etancheite'              // 09 - Étanchéité
  | 'ravalement'              // 10 - Ravalement
  | 'ite'                     // 11 - Isolation Thermique par l'Extérieur
  | 'menuiseries_exterieures' // 12 - Menuiseries extérieures
  | 'fermetures'              // 13 - Fermetures (volets, stores)
  | 'serrurerie_exterieure'   // 14 - Serrurerie extérieure
  // CLOISONNEMENT (4 lots)
  | 'isolation_interieure'    // 15 - Isolation intérieure
  | 'platrerie'               // 16 - Plâtrerie / Cloisons sèches
  | 'cloisons_humides'        // 17 - Cloisons humides (carreaux plâtre, briques)
  | 'faux_plafonds'           // 18 - Faux plafonds
  // FINITIONS (8 lots)
  | 'menuiseries_interieures' // 19 - Menuiseries intérieures
  | 'escaliers'               // 20 - Escaliers
  | 'sols_souples'            // 21 - Sols souples (moquette, vinyle, lino)
  | 'carrelage'               // 22 - Carrelage / Faïence
  | 'parquet'                 // 23 - Parquet / Plancher bois
  | 'peinture'                // 24 - Peinture / Revêtements muraux
  | 'agencement'              // 25 - Agencement / Rangements
  | 'metallerie_interieure'   // 26 - Métallerie intérieure
  // ÉLECTRICITÉ (4 lots)
  | 'courants_forts'          // 27 - Courants forts
  | 'courants_faibles'        // 28 - Courants faibles
  | 'domotique'               // 29 - Domotique
  | 'photovoltaique'          // 30 - Photovoltaïque
  // PLOMBERIE (3 lots)
  | 'sanitaires'              // 31 - Sanitaires
  | 'eau_chaude'              // 32 - Production eau chaude
  | 'assainissement'          // 33 - Assainissement
  // CVC (5 lots)
  | 'chauffage_central'       // 34 - Chauffage central
  | 'chauffage_bois'          // 35 - Chauffage bois
  | 'climatisation'           // 36 - Climatisation
  | 'plancher_chauffant'      // 37 - Plancher chauffant/rafraîchissant
  | 'radiateurs'              // 38 - Radiateurs / Émetteurs
  // VENTILATION (3 lots)
  | 'vmc_simple_flux'         // 39 - VMC Simple flux
  | 'vmc_double_flux'         // 40 - VMC Double flux
  | 'ventilation_naturelle'   // 41 - Ventilation naturelle
  // EXTÉRIEURS (4 lots)
  | 'piscine'                 // 42 - Piscine
  | 'amenagements_exterieurs' // 43 - Aménagements extérieurs
  | 'clotures'                // 44 - Clôtures / Portails
  | 'eclairage_exterieur'     // 45 - Éclairage extérieur
  // SPÉCIAUX (3 lots)
  | 'ascenseur'               // 46 - Ascenseur / Monte-charge
  | 'cuisine_equipee'         // 47 - Cuisine équipée
  | 'salle_bain_cle_main';    // 48 - Salle de bain clé en main

// =============================================================================
// CONFIGURATION DE CHAQUE LOT
// =============================================================================

export interface LotDefinition {
  type: LotType;
  number: string;
  name: string;
  category: LotCategory;
  description: string;
  commonWorks: string[];
  requiredDTUs: string[];
  requiredCertifications: string[];
  dependencies: LotType[];
  typicalPriceRange: PriceRange;
  typicalDuration: DurationRange;
  complexityLevel: ComplexityLevel;
  rgeEligible: boolean;
  aidesEligibles: string[];
}

export interface PriceRange {
  min: number;
  max: number;
  unit: PriceUnit;
  region?: string;
  year: number;
}

export type PriceUnit =
  | 'euro_m2'
  | 'euro_ml'
  | 'euro_unit'
  | 'euro_forfait'
  | 'euro_m3'
  | 'euro_point';

export interface DurationRange {
  minDays: number;
  maxDays: number;
  factors: string[];
}

export type ComplexityLevel = 'simple' | 'moderate' | 'complex' | 'expert';

// =============================================================================
// QUESTIONS DE QUALIFICATION PAR LOT
// =============================================================================

export interface QualificationQuestion {
  id: string;
  lotType: LotType;
  order: number;
  questionText: string;
  helpText?: string;
  type: QuestionType;
  options?: QuestionOption[];
  validation?: QuestionValidation;
  conditionalDisplay?: ConditionalDisplay;
  aiAssist?: AIAssistConfig;
  impactOnEstimate: boolean;
  impactOnPlanning: boolean;
  impactOnRegulatory: boolean;
  required: boolean;
}

export type QuestionType =
  | 'single_choice'
  | 'multiple_choice'
  | 'text'
  | 'number'
  | 'range'
  | 'boolean'
  | 'date'
  | 'file_upload'
  | 'photo_upload'
  | 'address'
  | 'dimension'
  | 'material_selector'
  | 'visual_selector'
  | 'slider'
  | 'color_picker';

export interface QuestionOption {
  value: string;
  label: string;
  description?: string;
  icon?: string;
  image?: string;
  priceImpact?: PriceImpact;
  durationImpact?: number; // en jours
  regulatoryImpact?: string[];
  dependencies?: string[];
  incompatibilities?: string[];
}

export interface PriceImpact {
  type: 'fixed' | 'percentage' | 'multiplier';
  value: number;
  unit?: string;
}

export interface QuestionValidation {
  required: boolean;
  min?: number;
  max?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  customValidation?: string;
  errorMessage?: string;
}

export interface ConditionalDisplay {
  questionId: string;
  operator: 'equals' | 'not_equals' | 'contains' | 'greater_than' | 'less_than';
  value: string | number | boolean;
}

export interface AIAssistConfig {
  enabled: boolean;
  type: AIAssistType;
  source?: string;
  confidence?: ConfidenceLevel;
  userOverridable: boolean;
}

export type AIAssistType =
  | 'auto_fill'           // Remplissage automatique
  | 'suggestion'          // Suggestion
  | 'validation'          // Validation
  | 'photo_analysis'      // Analyse de photos
  | 'document_extraction' // Extraction de documents
  | 'external_api';       // API externe

// =============================================================================
// RÉPONSES AUX QUESTIONS
// =============================================================================

export interface LotResponse {
  questionId: string;
  value: ResponseValue;
  source: ResponseSource;
  confidence: ConfidenceLevel;
  timestamp: string;
  modifiedBy?: string;
  previousValue?: ResponseValue;
  aiSuggested?: boolean;
  userValidated?: boolean;
}

export type ResponseValue =
  | string
  | number
  | boolean
  | string[]
  | DimensionValue
  | FileValue
  | MaterialSelection;

export interface DimensionValue {
  length?: number;
  width?: number;
  height?: number;
  area?: number;
  volume?: number;
  unit: 'm' | 'cm' | 'mm' | 'm2' | 'm3';
}

export interface FileValue {
  fileId: string;
  fileName: string;
  fileUrl: string;
  fileType: string;
  fileSize: number;
  uploadedAt: string;
}

export interface MaterialSelection {
  materialId: string;
  materialName: string;
  brand?: string;
  reference?: string;
  color?: string;
  finish?: string;
  unitPrice?: number;
}

export type ResponseSource =
  | 'user_input'
  | 'ai_deduction'
  | 'document_extraction'
  | 'api_external'
  | 'default_value';

// =============================================================================
// SCHÉMA DE DONNÉES PAR LOT
// =============================================================================

export interface LotDataSchema {
  lotType: LotType;
  surfaces?: SurfaceSchema;
  quantities?: QuantitySchema;
  materials?: MaterialSchema;
  equipment?: EquipmentSchema;
  labor?: LaborSchema;
  specifications?: SpecificationSchema;
}

export interface SurfaceSchema {
  totalSurface?: number;
  detailedSurfaces?: DetailedSurface[];
  unit: 'm2' | 'ml' | 'm3';
}

export interface DetailedSurface {
  name: string;
  surface: number;
  level?: number;
  room?: string;
  workType?: string;
}

export interface QuantitySchema {
  items: QuantityItem[];
}

export interface QuantityItem {
  name: string;
  quantity: number;
  unit: string;
  specification?: string;
}

export interface MaterialSchema {
  categories: MaterialCategory[];
}

export interface MaterialCategory {
  name: string;
  materials: SelectedMaterial[];
}

export interface SelectedMaterial {
  name: string;
  brand?: string;
  reference?: string;
  quantity: number;
  unit: string;
  unitPrice?: EstimationRange;
  specifications?: Record<string, string>;
}

export interface EquipmentSchema {
  items: EquipmentItem[];
}

export interface EquipmentItem {
  name: string;
  brand?: string;
  model?: string;
  quantity: number;
  power?: number;
  capacity?: number;
  specifications?: Record<string, string>;
  installation?: string;
  warranty?: number;
  price?: EstimationRange;
}

export interface LaborSchema {
  trades: TradeLabor[];
  totalHours?: EstimationRange;
}

export interface TradeLabor {
  trade: string;
  hours: EstimationRange;
  hourlyRate?: EstimationRange;
  qualification?: string;
}

export interface SpecificationSchema {
  technical: TechnicalSpec[];
  performance: PerformanceSpec[];
  aesthetic: AestheticSpec[];
}

export interface TechnicalSpec {
  name: string;
  value: string;
  unit?: string;
  norm?: string;
  mandatory: boolean;
}

export interface PerformanceSpec {
  name: string;
  targetValue: number;
  unit: string;
  norm?: string;
  verification?: string;
}

export interface AestheticSpec {
  name: string;
  value: string;
  reference?: string;
  sample?: string;
}

// =============================================================================
// OPTIONS PAR LOT
// =============================================================================

export interface LotOption {
  id: string;
  name: string;
  description: string;
  type: OptionType;
  selected: boolean;
  priceImpact: EstimationRange;
  durationImpact?: number;
  qualityImpact?: QualityImpact;
  dependencies?: string[];
  incompatibilities?: string[];
  recommendation?: OptionRecommendation;
}

export type OptionType =
  | 'upgrade'       // Montée en gamme
  | 'alternative'   // Alternative
  | 'additional'    // Supplément
  | 'reduction'     // Économie
  | 'green';        // Option écologique

export type QualityImpact = 'lower' | 'equivalent' | 'higher' | 'premium';

export interface OptionRecommendation {
  recommended: boolean;
  reason: string;
  confidence: ConfidenceLevel;
  source?: string;
}

// =============================================================================
// RÉGLEMENTATIONS PAR LOT
// =============================================================================

export interface LotRegulation {
  id: string;
  name: string;
  type: RegulationType;
  reference: string;
  description: string;
  requirements: RegulationRequirement[];
  applicableConditions?: string;
  verificationMethod?: string;
  certificationRequired?: string;
  penaltyForNonCompliance?: string;
}

export type RegulationType =
  | 'dtu'           // Document Technique Unifié
  | 'nf'            // Norme Française
  | 'en'            // Norme Européenne
  | 'cstb'          // CSTB / Avis Technique
  | 'rt'            // Réglementation Thermique
  | 're'            // Réglementation Environnementale
  | 'erp'           // Établissement Recevant du Public
  | 'pmr'           // Accessibilité PMR
  | 'incendie'      // Sécurité incendie
  | 'electricite'   // NF C 15-100
  | 'gaz'           // Réglementation gaz
  | 'assainissement' // Assainissement
  | 'urbanisme'     // Code de l'urbanisme
  | 'local';        // Réglementation locale

export interface RegulationRequirement {
  description: string;
  value?: string;
  verifiable: boolean;
  documentRequired?: string;
}

// =============================================================================
// ESTIMATION PAR LOT
// =============================================================================

export interface LotEstimation {
  lotId: string;
  baseEstimate: EstimationRange;
  optionsEstimate: EstimationRange;
  totalEstimate: EstimationRange;
  breakdown: EstimationBreakdown;
  confidence: ConfidenceLevel;
  calculationMethod: CalculationMethod;
  marketComparison?: MarketComparison;
  lastUpdated: string;
}

export interface EstimationBreakdown {
  materials: EstimationRange;
  labor: EstimationRange;
  equipment?: EstimationRange;
  disposal?: EstimationRange;
  overhead?: EstimationRange;
  margin?: EstimationRange;
  vat?: VATBreakdown;
}

export interface VATBreakdown {
  rate: number;
  amount: number;
  reducedRateEligible: boolean;
  reducedRate?: number;
  reducedAmount?: number;
}

export type CalculationMethod =
  | 'unit_price'     // Prix unitaires
  | 'ratio'          // Ratio au m²
  | 'detailed'       // Métré détaillé
  | 'reference'      // Référentiel TORP
  | 'ai_estimate';   // Estimation IA

export interface MarketComparison {
  regionAverage: number;
  percentile: number;
  position: 'below' | 'average' | 'above';
  sampleSize: number;
  comparisonDate: string;
}

// =============================================================================
// CATALOGUE DES 48 LOTS
// =============================================================================

export const LOT_CATALOG: LotDefinition[] = [
  // GROS ŒUVRE
  {
    type: 'demolition',
    number: '01',
    name: 'Démolition',
    category: 'gros_oeuvre',
    description: 'Travaux de démolition totale ou partielle',
    commonWorks: ['Démolition cloisons', 'Démolition murs', 'Évacuation gravats', 'Désamiantage', 'Dépose équipements'],
    requiredDTUs: [],
    requiredCertifications: ['Qualification amiante SS3/SS4 si présence amiante'],
    dependencies: [],
    typicalPriceRange: { min: 30, max: 80, unit: 'euro_m2', year: 2024 },
    typicalDuration: { minDays: 1, maxDays: 10, factors: ['Surface', 'Nature structure', 'Amiante'] },
    complexityLevel: 'moderate',
    rgeEligible: false,
    aidesEligibles: [],
  },
  {
    type: 'terrassement_vrd',
    number: '02',
    name: 'Terrassement & VRD',
    category: 'gros_oeuvre',
    description: 'Terrassement et réseaux divers',
    commonWorks: ['Décapage terre végétale', 'Fouilles', 'Remblaiement', 'Tranchées réseaux', 'Évacuation terres'],
    requiredDTUs: ['DTU 12 - Terrassement', 'DTU 64.1 - Assainissement'],
    requiredCertifications: [],
    dependencies: ['demolition'],
    typicalPriceRange: { min: 20, max: 60, unit: 'euro_m3', year: 2024 },
    typicalDuration: { minDays: 2, maxDays: 15, factors: ['Volume', 'Nature sol', 'Accès'] },
    complexityLevel: 'moderate',
    rgeEligible: false,
    aidesEligibles: [],
  },
  {
    type: 'maconnerie',
    number: '03',
    name: 'Maçonnerie',
    category: 'gros_oeuvre',
    description: 'Travaux de maçonnerie générale',
    commonWorks: ['Murs parpaings', 'Murs briques', 'Murs pierre', 'Linteaux', 'Appuis de fenêtre'],
    requiredDTUs: ['DTU 20.1 - Parois et murs en maçonnerie'],
    requiredCertifications: [],
    dependencies: ['terrassement_vrd'],
    typicalPriceRange: { min: 60, max: 150, unit: 'euro_m2', year: 2024 },
    typicalDuration: { minDays: 5, maxDays: 30, factors: ['Surface', 'Type mur', 'Ouvertures'] },
    complexityLevel: 'moderate',
    rgeEligible: false,
    aidesEligibles: [],
  },
  {
    type: 'beton_arme',
    number: '04',
    name: 'Béton armé',
    category: 'gros_oeuvre',
    description: 'Ouvrages en béton armé',
    commonWorks: ['Fondations', 'Dalles', 'Poutres', 'Poteaux', 'Escaliers béton'],
    requiredDTUs: ['DTU 21 - Exécution des ouvrages en béton'],
    requiredCertifications: [],
    dependencies: ['terrassement_vrd'],
    typicalPriceRange: { min: 150, max: 300, unit: 'euro_m3', year: 2024 },
    typicalDuration: { minDays: 5, maxDays: 20, factors: ['Volume', 'Ferraillage', 'Temps séchage'] },
    complexityLevel: 'complex',
    rgeEligible: false,
    aidesEligibles: [],
  },
  {
    type: 'charpente_bois',
    number: '05',
    name: 'Charpente bois',
    category: 'gros_oeuvre',
    description: 'Charpente traditionnelle ou industrielle en bois',
    commonWorks: ['Charpente traditionnelle', 'Fermettes', 'Solivage', 'Traitement bois'],
    requiredDTUs: ['DTU 31.1 - Charpente en bois', 'DTU 31.2 - Construction de maisons à ossature bois'],
    requiredCertifications: ['Qualibat 2311'],
    dependencies: ['maconnerie', 'beton_arme'],
    typicalPriceRange: { min: 80, max: 180, unit: 'euro_m2', year: 2024 },
    typicalDuration: { minDays: 3, maxDays: 15, factors: ['Surface', 'Type charpente', 'Complexité'] },
    complexityLevel: 'complex',
    rgeEligible: false,
    aidesEligibles: [],
  },
  {
    type: 'charpente_metallique',
    number: '06',
    name: 'Charpente métallique',
    category: 'gros_oeuvre',
    description: 'Charpente et structures métalliques',
    commonWorks: ['Charpente acier', 'Poutres IPN/IPE', 'Structures métalliques', 'Traitement anticorrosion'],
    requiredDTUs: ['DTU 32.1 - Charpente en acier'],
    requiredCertifications: ['Qualibat 2411'],
    dependencies: ['maconnerie', 'beton_arme'],
    typicalPriceRange: { min: 100, max: 250, unit: 'euro_m2', year: 2024 },
    typicalDuration: { minDays: 3, maxDays: 20, factors: ['Portée', 'Complexité', 'Accès'] },
    complexityLevel: 'expert',
    rgeEligible: false,
    aidesEligibles: [],
  },
  {
    type: 'ossature_bois',
    number: '07',
    name: 'Ossature bois',
    category: 'gros_oeuvre',
    description: 'Construction à ossature bois',
    commonWorks: ['Ossature murale', 'Planchers bois', 'Contreventement', 'Pare-vapeur'],
    requiredDTUs: ['DTU 31.2 - Construction de maisons à ossature bois'],
    requiredCertifications: ['Qualibat 2312'],
    dependencies: ['terrassement_vrd'],
    typicalPriceRange: { min: 250, max: 450, unit: 'euro_m2', year: 2024 },
    typicalDuration: { minDays: 10, maxDays: 30, factors: ['Surface', 'Préfabrication', 'Finition'] },
    complexityLevel: 'complex',
    rgeEligible: false,
    aidesEligibles: [],
  },
  // ENVELOPPE
  {
    type: 'couverture',
    number: '08',
    name: 'Couverture',
    category: 'enveloppe',
    description: 'Couverture et étanchéité toiture',
    commonWorks: ['Tuiles', 'Ardoises', 'Zinc', 'Gouttières', 'Zinguerie'],
    requiredDTUs: ['DTU 40.11 - Couverture en ardoises', 'DTU 40.21 - Couverture en tuiles'],
    requiredCertifications: ['Qualibat 3111'],
    dependencies: ['charpente_bois', 'charpente_metallique'],
    typicalPriceRange: { min: 60, max: 180, unit: 'euro_m2', year: 2024 },
    typicalDuration: { minDays: 3, maxDays: 15, factors: ['Surface', 'Matériau', 'Pente'] },
    complexityLevel: 'moderate',
    rgeEligible: true,
    aidesEligibles: ['maprimerénov', 'cee'],
  },
  {
    type: 'etancheite',
    number: '09',
    name: 'Étanchéité',
    category: 'enveloppe',
    description: 'Étanchéité toiture terrasse et sous-sols',
    commonWorks: ['Membrane EPDM', 'Bitume', 'PVC', 'Drainage'],
    requiredDTUs: ['DTU 43.1 - Étanchéité des toitures-terrasses'],
    requiredCertifications: ['Qualibat 3511'],
    dependencies: ['beton_arme'],
    typicalPriceRange: { min: 40, max: 120, unit: 'euro_m2', year: 2024 },
    typicalDuration: { minDays: 2, maxDays: 10, factors: ['Surface', 'Complexité', 'Accessoires'] },
    complexityLevel: 'complex',
    rgeEligible: true,
    aidesEligibles: ['maprimerénov', 'cee'],
  },
  {
    type: 'ravalement',
    number: '10',
    name: 'Ravalement',
    category: 'enveloppe',
    description: 'Ravalement et traitement des façades',
    commonWorks: ['Nettoyage', 'Réparation fissures', 'Enduit', 'Peinture', 'Hydrofuge'],
    requiredDTUs: ['DTU 42.1 - Réfection de façades'],
    requiredCertifications: ['Qualibat 6111'],
    dependencies: [],
    typicalPriceRange: { min: 40, max: 120, unit: 'euro_m2', year: 2024 },
    typicalDuration: { minDays: 5, maxDays: 20, factors: ['Surface', 'État', 'Hauteur'] },
    complexityLevel: 'moderate',
    rgeEligible: false,
    aidesEligibles: [],
  },
  {
    type: 'ite',
    number: '11',
    name: 'Isolation Thermique par l\'Extérieur',
    category: 'enveloppe',
    description: 'ITE - Isolation des murs par l\'extérieur',
    commonWorks: ['Pose isolant', 'Fixation mécanique', 'Armature', 'Enduit de finition'],
    requiredDTUs: ['DTU 45.4 - Isolation thermique par l\'extérieur'],
    requiredCertifications: ['Qualibat 7131', 'RGE'],
    dependencies: [],
    typicalPriceRange: { min: 100, max: 200, unit: 'euro_m2', year: 2024 },
    typicalDuration: { minDays: 10, maxDays: 30, factors: ['Surface', 'Isolant', 'Finition'] },
    complexityLevel: 'complex',
    rgeEligible: true,
    aidesEligibles: ['maprimerénov', 'cee', 'eco_ptz'],
  },
  {
    type: 'menuiseries_exterieures',
    number: '12',
    name: 'Menuiseries extérieures',
    category: 'enveloppe',
    description: 'Fenêtres, portes-fenêtres, baies vitrées',
    commonWorks: ['Dépose anciennes', 'Pose fenêtres', 'Portes-fenêtres', 'Baies coulissantes', 'Porte d\'entrée'],
    requiredDTUs: ['DTU 36.5 - Mise en œuvre des fenêtres'],
    requiredCertifications: ['Qualibat 3511', 'RGE'],
    dependencies: ['maconnerie'],
    typicalPriceRange: { min: 300, max: 800, unit: 'euro_unit', year: 2024 },
    typicalDuration: { minDays: 1, maxDays: 5, factors: ['Nombre', 'Type', 'Dimensions'] },
    complexityLevel: 'simple',
    rgeEligible: true,
    aidesEligibles: ['maprimerénov', 'cee', 'eco_ptz'],
  },
  {
    type: 'fermetures',
    number: '13',
    name: 'Fermetures',
    category: 'enveloppe',
    description: 'Volets, stores, brise-soleil',
    commonWorks: ['Volets battants', 'Volets roulants', 'Stores', 'BSO', 'Motorisation'],
    requiredDTUs: ['DTU 34.1 - Fermetures'],
    requiredCertifications: [],
    dependencies: ['menuiseries_exterieures'],
    typicalPriceRange: { min: 200, max: 600, unit: 'euro_unit', year: 2024 },
    typicalDuration: { minDays: 1, maxDays: 3, factors: ['Nombre', 'Type', 'Motorisation'] },
    complexityLevel: 'simple',
    rgeEligible: false,
    aidesEligibles: [],
  },
  {
    type: 'serrurerie_exterieure',
    number: '14',
    name: 'Serrurerie extérieure',
    category: 'enveloppe',
    description: 'Garde-corps, grilles, escaliers extérieurs',
    commonWorks: ['Garde-corps', 'Grilles de défense', 'Escaliers métalliques', 'Marquises'],
    requiredDTUs: ['DTU 37.1 - Serrurerie'],
    requiredCertifications: [],
    dependencies: ['maconnerie'],
    typicalPriceRange: { min: 150, max: 400, unit: 'euro_ml', year: 2024 },
    typicalDuration: { minDays: 2, maxDays: 10, factors: ['Linéaire', 'Complexité', 'Finition'] },
    complexityLevel: 'moderate',
    rgeEligible: false,
    aidesEligibles: [],
  },
  // CLOISONNEMENT
  {
    type: 'isolation_interieure',
    number: '15',
    name: 'Isolation intérieure',
    category: 'cloisonnement',
    description: 'Isolation thermique des murs et combles par l\'intérieur',
    commonWorks: ['Isolation murs', 'Isolation combles', 'Isolation planchers', 'Pare-vapeur'],
    requiredDTUs: ['DTU 45.10 - Isolation thermique par l\'intérieur'],
    requiredCertifications: ['Qualibat 7141', 'RGE'],
    dependencies: [],
    typicalPriceRange: { min: 25, max: 80, unit: 'euro_m2', year: 2024 },
    typicalDuration: { minDays: 2, maxDays: 10, factors: ['Surface', 'Isolant', 'Accès'] },
    complexityLevel: 'simple',
    rgeEligible: true,
    aidesEligibles: ['maprimerénov', 'cee', 'eco_ptz'],
  },
  {
    type: 'platrerie',
    number: '16',
    name: 'Plâtrerie / Cloisons sèches',
    category: 'cloisonnement',
    description: 'Cloisons et doublages en plaques de plâtre',
    commonWorks: ['Cloisons BA13', 'Doublages', 'Gaines techniques', 'Enduits joints'],
    requiredDTUs: ['DTU 25.41 - Ouvrages en plaques de plâtre'],
    requiredCertifications: ['Qualibat 4131'],
    dependencies: ['isolation_interieure'],
    typicalPriceRange: { min: 30, max: 70, unit: 'euro_m2', year: 2024 },
    typicalDuration: { minDays: 3, maxDays: 15, factors: ['Surface', 'Doublages', 'Complexité'] },
    complexityLevel: 'simple',
    rgeEligible: false,
    aidesEligibles: [],
  },
  {
    type: 'cloisons_humides',
    number: '17',
    name: 'Cloisons humides',
    category: 'cloisonnement',
    description: 'Cloisons en carreaux de plâtre ou briques',
    commonWorks: ['Carreaux de plâtre', 'Briques plâtrières', 'Enduits plâtre'],
    requiredDTUs: ['DTU 25.31 - Ouvrages verticaux de plâtrerie'],
    requiredCertifications: [],
    dependencies: [],
    typicalPriceRange: { min: 40, max: 90, unit: 'euro_m2', year: 2024 },
    typicalDuration: { minDays: 2, maxDays: 10, factors: ['Surface', 'Type', 'Hauteur'] },
    complexityLevel: 'simple',
    rgeEligible: false,
    aidesEligibles: [],
  },
  {
    type: 'faux_plafonds',
    number: '18',
    name: 'Faux plafonds',
    category: 'cloisonnement',
    description: 'Plafonds suspendus et tendus',
    commonWorks: ['Plafonds suspendus BA13', 'Dalles acoustiques', 'Plafonds tendus'],
    requiredDTUs: ['DTU 25.232 - Plafonds en staff'],
    requiredCertifications: [],
    dependencies: ['platrerie'],
    typicalPriceRange: { min: 25, max: 80, unit: 'euro_m2', year: 2024 },
    typicalDuration: { minDays: 2, maxDays: 10, factors: ['Surface', 'Type', 'Intégrations'] },
    complexityLevel: 'simple',
    rgeEligible: false,
    aidesEligibles: [],
  },
  // FINITIONS
  {
    type: 'menuiseries_interieures',
    number: '19',
    name: 'Menuiseries intérieures',
    category: 'finitions',
    description: 'Portes intérieures, placards, habillages',
    commonWorks: ['Portes intérieures', 'Portes coulissantes', 'Blocs-portes', 'Plinthes', 'Moulures'],
    requiredDTUs: ['DTU 36.1 - Menuiseries en bois'],
    requiredCertifications: [],
    dependencies: ['platrerie'],
    typicalPriceRange: { min: 150, max: 500, unit: 'euro_unit', year: 2024 },
    typicalDuration: { minDays: 2, maxDays: 10, factors: ['Nombre portes', 'Type', 'Finition'] },
    complexityLevel: 'simple',
    rgeEligible: false,
    aidesEligibles: [],
  },
  {
    type: 'escaliers',
    number: '20',
    name: 'Escaliers',
    category: 'finitions',
    description: 'Escaliers intérieurs bois, métal ou mixtes',
    commonWorks: ['Escalier bois', 'Escalier métal', 'Garde-corps', 'Main courante'],
    requiredDTUs: ['DTU 36.3 - Escaliers en bois'],
    requiredCertifications: [],
    dependencies: ['platrerie'],
    typicalPriceRange: { min: 2000, max: 15000, unit: 'euro_forfait', year: 2024 },
    typicalDuration: { minDays: 2, maxDays: 10, factors: ['Type', 'Forme', 'Matériaux'] },
    complexityLevel: 'complex',
    rgeEligible: false,
    aidesEligibles: [],
  },
  {
    type: 'sols_souples',
    number: '21',
    name: 'Sols souples',
    category: 'finitions',
    description: 'Moquette, vinyle, linoleum, sol PVC',
    commonWorks: ['Préparation support', 'Ragréage', 'Pose revêtement', 'Plinthes'],
    requiredDTUs: ['DTU 53.2 - Revêtements de sol PVC'],
    requiredCertifications: [],
    dependencies: ['platrerie'],
    typicalPriceRange: { min: 20, max: 80, unit: 'euro_m2', year: 2024 },
    typicalDuration: { minDays: 1, maxDays: 5, factors: ['Surface', 'Préparation', 'Motifs'] },
    complexityLevel: 'simple',
    rgeEligible: false,
    aidesEligibles: [],
  },
  {
    type: 'carrelage',
    number: '22',
    name: 'Carrelage / Faïence',
    category: 'finitions',
    description: 'Carrelage sols et murs, faïence',
    commonWorks: ['Préparation support', 'Pose carrelage', 'Pose faïence', 'Joints', 'Plinthes'],
    requiredDTUs: ['DTU 52.2 - Pose collée des revêtements céramiques'],
    requiredCertifications: [],
    dependencies: ['platrerie'],
    typicalPriceRange: { min: 40, max: 120, unit: 'euro_m2', year: 2024 },
    typicalDuration: { minDays: 3, maxDays: 15, factors: ['Surface', 'Format', 'Calepinage'] },
    complexityLevel: 'moderate',
    rgeEligible: false,
    aidesEligibles: [],
  },
  {
    type: 'parquet',
    number: '23',
    name: 'Parquet / Plancher bois',
    category: 'finitions',
    description: 'Parquet massif, contrecollé ou stratifié',
    commonWorks: ['Préparation support', 'Pose parquet', 'Ponçage', 'Vitrification', 'Plinthes'],
    requiredDTUs: ['DTU 51.1 - Parquets massifs', 'DTU 51.11 - Parquets contrecollés'],
    requiredCertifications: [],
    dependencies: ['platrerie'],
    typicalPriceRange: { min: 30, max: 150, unit: 'euro_m2', year: 2024 },
    typicalDuration: { minDays: 2, maxDays: 10, factors: ['Surface', 'Type', 'Finition'] },
    complexityLevel: 'moderate',
    rgeEligible: false,
    aidesEligibles: [],
  },
  {
    type: 'peinture',
    number: '24',
    name: 'Peinture / Revêtements muraux',
    category: 'finitions',
    description: 'Peinture murs et plafonds, papiers peints',
    commonWorks: ['Préparation surfaces', 'Sous-couche', 'Peinture', 'Papier peint', 'Enduits décoratifs'],
    requiredDTUs: ['DTU 59.1 - Peinturage'],
    requiredCertifications: [],
    dependencies: ['platrerie'],
    typicalPriceRange: { min: 15, max: 50, unit: 'euro_m2', year: 2024 },
    typicalDuration: { minDays: 3, maxDays: 15, factors: ['Surface', 'Couches', 'Finition'] },
    complexityLevel: 'simple',
    rgeEligible: false,
    aidesEligibles: [],
  },
  {
    type: 'agencement',
    number: '25',
    name: 'Agencement / Rangements',
    category: 'finitions',
    description: 'Placards, dressings, rangements sur mesure',
    commonWorks: ['Placards', 'Dressings', 'Bibliothèques', 'Étagères'],
    requiredDTUs: [],
    requiredCertifications: [],
    dependencies: ['platrerie', 'peinture'],
    typicalPriceRange: { min: 300, max: 800, unit: 'euro_ml', year: 2024 },
    typicalDuration: { minDays: 2, maxDays: 10, factors: ['Linéaire', 'Complexité', 'Finition'] },
    complexityLevel: 'moderate',
    rgeEligible: false,
    aidesEligibles: [],
  },
  {
    type: 'metallerie_interieure',
    number: '26',
    name: 'Métallerie intérieure',
    category: 'finitions',
    description: 'Garde-corps intérieurs, verrières, structures décoratives',
    commonWorks: ['Garde-corps', 'Verrières', 'Mains courantes', 'Structures acier'],
    requiredDTUs: [],
    requiredCertifications: [],
    dependencies: ['platrerie'],
    typicalPriceRange: { min: 200, max: 600, unit: 'euro_ml', year: 2024 },
    typicalDuration: { minDays: 2, maxDays: 10, factors: ['Linéaire', 'Design', 'Finition'] },
    complexityLevel: 'complex',
    rgeEligible: false,
    aidesEligibles: [],
  },
  // ÉLECTRICITÉ
  {
    type: 'courants_forts',
    number: '27',
    name: 'Courants forts',
    category: 'electricite',
    description: 'Installation électrique principale',
    commonWorks: ['Tableau électrique', 'Câblage', 'Prises', 'Éclairage', 'Terre'],
    requiredDTUs: ['NF C 15-100'],
    requiredCertifications: ['Qualibat 5111'],
    dependencies: ['platrerie'],
    typicalPriceRange: { min: 80, max: 150, unit: 'euro_m2', year: 2024 },
    typicalDuration: { minDays: 3, maxDays: 15, factors: ['Surface', 'Points', 'Rénovation'] },
    complexityLevel: 'moderate',
    rgeEligible: false,
    aidesEligibles: [],
  },
  {
    type: 'courants_faibles',
    number: '28',
    name: 'Courants faibles',
    category: 'electricite',
    description: 'Réseaux informatiques, TV, téléphone, interphone',
    commonWorks: ['Réseau informatique', 'TV/Satellite', 'Interphone', 'Câblage RJ45'],
    requiredDTUs: ['NF C 15-100'],
    requiredCertifications: [],
    dependencies: ['courants_forts'],
    typicalPriceRange: { min: 20, max: 50, unit: 'euro_m2', year: 2024 },
    typicalDuration: { minDays: 1, maxDays: 5, factors: ['Points', 'Réseau', 'Câblage'] },
    complexityLevel: 'simple',
    rgeEligible: false,
    aidesEligibles: [],
  },
  {
    type: 'domotique',
    number: '29',
    name: 'Domotique',
    category: 'electricite',
    description: 'Automatisation et contrôle intelligent',
    commonWorks: ['Centrale domotique', 'Automatismes', 'Scénarios', 'Contrôle à distance'],
    requiredDTUs: [],
    requiredCertifications: [],
    dependencies: ['courants_forts', 'courants_faibles'],
    typicalPriceRange: { min: 2000, max: 15000, unit: 'euro_forfait', year: 2024 },
    typicalDuration: { minDays: 2, maxDays: 10, factors: ['Fonctionnalités', 'Intégrations', 'Scénarios'] },
    complexityLevel: 'expert',
    rgeEligible: false,
    aidesEligibles: [],
  },
  {
    type: 'photovoltaique',
    number: '30',
    name: 'Photovoltaïque',
    category: 'electricite',
    description: 'Installation panneaux solaires photovoltaïques',
    commonWorks: ['Panneaux PV', 'Onduleur', 'Câblage', 'Raccordement', 'Monitoring'],
    requiredDTUs: ['NF C 15-100', 'Guide UTE C 15-712'],
    requiredCertifications: ['QualiPV', 'RGE'],
    dependencies: ['couverture', 'courants_forts'],
    typicalPriceRange: { min: 8000, max: 20000, unit: 'euro_forfait', year: 2024 },
    typicalDuration: { minDays: 2, maxDays: 5, factors: ['Puissance', 'Type pose', 'Raccordement'] },
    complexityLevel: 'complex',
    rgeEligible: true,
    aidesEligibles: ['maprimerénov', 'prime_autoconso'],
  },
  // PLOMBERIE
  {
    type: 'sanitaires',
    number: '31',
    name: 'Sanitaires',
    category: 'plomberie',
    description: 'Équipements sanitaires et raccordements',
    commonWorks: ['WC', 'Lavabos', 'Douches', 'Baignoires', 'Robinetterie'],
    requiredDTUs: ['DTU 60.1 - Plomberie sanitaire'],
    requiredCertifications: ['Qualibat 5211'],
    dependencies: ['platrerie'],
    typicalPriceRange: { min: 2000, max: 8000, unit: 'euro_forfait', year: 2024 },
    typicalDuration: { minDays: 2, maxDays: 10, factors: ['Nombre pièces', 'Équipements', 'Distances'] },
    complexityLevel: 'moderate',
    rgeEligible: false,
    aidesEligibles: [],
  },
  {
    type: 'eau_chaude',
    number: '32',
    name: 'Production eau chaude',
    category: 'plomberie',
    description: 'Chauffe-eau et systèmes de production ECS',
    commonWorks: ['Chauffe-eau électrique', 'Chauffe-eau thermodynamique', 'Chauffe-eau solaire', 'Ballon'],
    requiredDTUs: ['DTU 60.1 - Plomberie sanitaire'],
    requiredCertifications: ['Qualibat 5212', 'RGE'],
    dependencies: ['sanitaires', 'courants_forts'],
    typicalPriceRange: { min: 1500, max: 6000, unit: 'euro_forfait', year: 2024 },
    typicalDuration: { minDays: 1, maxDays: 3, factors: ['Type', 'Capacité', 'Raccordements'] },
    complexityLevel: 'moderate',
    rgeEligible: true,
    aidesEligibles: ['maprimerénov', 'cee'],
  },
  {
    type: 'assainissement',
    number: '33',
    name: 'Assainissement',
    category: 'plomberie',
    description: 'Évacuations et assainissement',
    commonWorks: ['Évacuations EU/EV', 'Fosse septique', 'Micro-station', 'Raccordement collectif'],
    requiredDTUs: ['DTU 64.1 - Mise en œuvre dispositifs ANC'],
    requiredCertifications: [],
    dependencies: ['terrassement_vrd'],
    typicalPriceRange: { min: 3000, max: 12000, unit: 'euro_forfait', year: 2024 },
    typicalDuration: { minDays: 3, maxDays: 10, factors: ['Type système', 'Distance', 'Terrain'] },
    complexityLevel: 'complex',
    rgeEligible: false,
    aidesEligibles: ['anah'],
  },
  // CVC
  {
    type: 'chauffage_central',
    number: '34',
    name: 'Chauffage central',
    category: 'cvc',
    description: 'Chaudière et système de chauffage central',
    commonWorks: ['Chaudière gaz', 'Chaudière fioul', 'Pompe à chaleur', 'Distribution', 'Régulation'],
    requiredDTUs: ['DTU 65.11 - Dispositifs de sécurité des installations de chauffage central'],
    requiredCertifications: ['Qualibat 5311', 'RGE', 'PG (Professionnel Gaz)'],
    dependencies: ['courants_forts'],
    typicalPriceRange: { min: 5000, max: 20000, unit: 'euro_forfait', year: 2024 },
    typicalDuration: { minDays: 3, maxDays: 10, factors: ['Type système', 'Surface', 'Émetteurs'] },
    complexityLevel: 'complex',
    rgeEligible: true,
    aidesEligibles: ['maprimerénov', 'cee', 'eco_ptz'],
  },
  {
    type: 'chauffage_bois',
    number: '35',
    name: 'Chauffage bois',
    category: 'cvc',
    description: 'Poêles et chaudières à bois ou granulés',
    commonWorks: ['Poêle à bois', 'Poêle à granulés', 'Insert', 'Chaudière bois', 'Conduit fumée'],
    requiredDTUs: ['DTU 24.1 - Travaux de fumisterie'],
    requiredCertifications: ['Qualibat 5413', 'RGE', 'Qualibois'],
    dependencies: ['courants_forts'],
    typicalPriceRange: { min: 3000, max: 15000, unit: 'euro_forfait', year: 2024 },
    typicalDuration: { minDays: 1, maxDays: 5, factors: ['Type appareil', 'Conduit', 'Habillage'] },
    complexityLevel: 'moderate',
    rgeEligible: true,
    aidesEligibles: ['maprimerénov', 'cee', 'eco_ptz'],
  },
  {
    type: 'climatisation',
    number: '36',
    name: 'Climatisation',
    category: 'cvc',
    description: 'Systèmes de climatisation et rafraîchissement',
    commonWorks: ['Split', 'Multi-split', 'Gainable', 'Cassette', 'VRV'],
    requiredDTUs: [],
    requiredCertifications: ['Qualibat 5412', 'Attestation fluides frigorigènes'],
    dependencies: ['courants_forts'],
    typicalPriceRange: { min: 2000, max: 12000, unit: 'euro_forfait', year: 2024 },
    typicalDuration: { minDays: 1, maxDays: 5, factors: ['Type', 'Unités', 'Gainable'] },
    complexityLevel: 'moderate',
    rgeEligible: false,
    aidesEligibles: [],
  },
  {
    type: 'plancher_chauffant',
    number: '37',
    name: 'Plancher chauffant/rafraîchissant',
    category: 'cvc',
    description: 'Chauffage au sol hydraulique ou électrique',
    commonWorks: ['Plancher chauffant eau', 'Plancher chauffant électrique', 'Régulation', 'Chape'],
    requiredDTUs: ['DTU 65.14 - Planchers chauffants'],
    requiredCertifications: ['Qualibat 5321', 'RGE'],
    dependencies: ['chauffage_central'],
    typicalPriceRange: { min: 50, max: 120, unit: 'euro_m2', year: 2024 },
    typicalDuration: { minDays: 3, maxDays: 10, factors: ['Surface', 'Type', 'Régulation'] },
    complexityLevel: 'complex',
    rgeEligible: true,
    aidesEligibles: ['maprimerénov', 'cee'],
  },
  {
    type: 'radiateurs',
    number: '38',
    name: 'Radiateurs / Émetteurs',
    category: 'cvc',
    description: 'Radiateurs et émetteurs de chaleur',
    commonWorks: ['Radiateurs eau chaude', 'Radiateurs électriques', 'Sèche-serviettes', 'Convecteurs'],
    requiredDTUs: ['DTU 65.10 - Canalisations cuivre'],
    requiredCertifications: [],
    dependencies: ['chauffage_central'],
    typicalPriceRange: { min: 200, max: 800, unit: 'euro_unit', year: 2024 },
    typicalDuration: { minDays: 1, maxDays: 5, factors: ['Nombre', 'Type', 'Raccordement'] },
    complexityLevel: 'simple',
    rgeEligible: false,
    aidesEligibles: [],
  },
  // VENTILATION
  {
    type: 'vmc_simple_flux',
    number: '39',
    name: 'VMC Simple flux',
    category: 'ventilation',
    description: 'Ventilation mécanique contrôlée simple flux',
    commonWorks: ['Caisson VMC', 'Réseau gaines', 'Bouches extraction', 'Entrées d\'air'],
    requiredDTUs: ['DTU 68.3 - Installations de VMC'],
    requiredCertifications: ['Qualibat 5411', 'RGE'],
    dependencies: ['platrerie'],
    typicalPriceRange: { min: 500, max: 2000, unit: 'euro_forfait', year: 2024 },
    typicalDuration: { minDays: 1, maxDays: 3, factors: ['Surface', 'Type', 'Points'] },
    complexityLevel: 'simple',
    rgeEligible: true,
    aidesEligibles: ['maprimerénov', 'cee'],
  },
  {
    type: 'vmc_double_flux',
    number: '40',
    name: 'VMC Double flux',
    category: 'ventilation',
    description: 'VMC double flux avec récupération de chaleur',
    commonWorks: ['Centrale DF', 'Réseau soufflage', 'Réseau extraction', 'Récupérateur', 'Filtres'],
    requiredDTUs: ['DTU 68.3 - Installations de VMC'],
    requiredCertifications: ['Qualibat 5411', 'RGE'],
    dependencies: ['platrerie', 'faux_plafonds'],
    typicalPriceRange: { min: 4000, max: 10000, unit: 'euro_forfait', year: 2024 },
    typicalDuration: { minDays: 2, maxDays: 5, factors: ['Surface', 'Réseau', 'Intégration'] },
    complexityLevel: 'complex',
    rgeEligible: true,
    aidesEligibles: ['maprimerénov', 'cee', 'eco_ptz'],
  },
  {
    type: 'ventilation_naturelle',
    number: '41',
    name: 'Ventilation naturelle',
    category: 'ventilation',
    description: 'Ventilation naturelle assistée ou non',
    commonWorks: ['Grilles haute/basse', 'Conduits shunt', 'Extracteurs statiques', 'VMR'],
    requiredDTUs: ['DTU 68.2 - Ventilation naturelle'],
    requiredCertifications: [],
    dependencies: ['platrerie'],
    typicalPriceRange: { min: 300, max: 1500, unit: 'euro_forfait', year: 2024 },
    typicalDuration: { minDays: 1, maxDays: 3, factors: ['Points', 'Conduits', 'Accès'] },
    complexityLevel: 'simple',
    rgeEligible: false,
    aidesEligibles: [],
  },
  // EXTÉRIEURS
  {
    type: 'piscine',
    number: '42',
    name: 'Piscine',
    category: 'exterieurs',
    description: 'Construction de piscine',
    commonWorks: ['Terrassement', 'Structure', 'Étanchéité', 'Filtration', 'Revêtement', 'Plages'],
    requiredDTUs: ['DTU 65.3 - Piscines'],
    requiredCertifications: [],
    dependencies: ['terrassement_vrd'],
    typicalPriceRange: { min: 15000, max: 80000, unit: 'euro_forfait', year: 2024 },
    typicalDuration: { minDays: 20, maxDays: 60, factors: ['Type', 'Taille', 'Équipements'] },
    complexityLevel: 'expert',
    rgeEligible: false,
    aidesEligibles: [],
  },
  {
    type: 'amenagements_exterieurs',
    number: '43',
    name: 'Aménagements extérieurs',
    category: 'exterieurs',
    description: 'Terrasses, allées, jardins',
    commonWorks: ['Terrasse bois', 'Terrasse carrelée', 'Dallage', 'Engazonnement', 'Plantations'],
    requiredDTUs: ['DTU 51.4 - Platelages extérieurs en bois'],
    requiredCertifications: [],
    dependencies: ['terrassement_vrd'],
    typicalPriceRange: { min: 50, max: 200, unit: 'euro_m2', year: 2024 },
    typicalDuration: { minDays: 5, maxDays: 20, factors: ['Surface', 'Matériaux', 'Plantations'] },
    complexityLevel: 'moderate',
    rgeEligible: false,
    aidesEligibles: [],
  },
  {
    type: 'clotures',
    number: '44',
    name: 'Clôtures / Portails',
    category: 'exterieurs',
    description: 'Clôtures, portails et portillons',
    commonWorks: ['Clôture grillage', 'Clôture aluminium', 'Portail coulissant', 'Portail battant', 'Motorisation'],
    requiredDTUs: [],
    requiredCertifications: [],
    dependencies: ['terrassement_vrd'],
    typicalPriceRange: { min: 80, max: 300, unit: 'euro_ml', year: 2024 },
    typicalDuration: { minDays: 2, maxDays: 10, factors: ['Linéaire', 'Type', 'Motorisation'] },
    complexityLevel: 'simple',
    rgeEligible: false,
    aidesEligibles: [],
  },
  {
    type: 'eclairage_exterieur',
    number: '45',
    name: 'Éclairage extérieur',
    category: 'exterieurs',
    description: 'Éclairage de jardin et façade',
    commonWorks: ['Bornes', 'Spots encastrés', 'Appliques', 'Projecteurs', 'Guirlandes', 'Solaire'],
    requiredDTUs: ['NF C 15-100'],
    requiredCertifications: [],
    dependencies: ['courants_forts', 'amenagements_exterieurs'],
    typicalPriceRange: { min: 1000, max: 5000, unit: 'euro_forfait', year: 2024 },
    typicalDuration: { minDays: 1, maxDays: 5, factors: ['Points lumineux', 'Câblage', 'Automatismes'] },
    complexityLevel: 'simple',
    rgeEligible: false,
    aidesEligibles: [],
  },
  // SPÉCIAUX
  {
    type: 'ascenseur',
    number: '46',
    name: 'Ascenseur / Monte-charge',
    category: 'speciaux',
    description: 'Ascenseur privatif ou monte-charge',
    commonWorks: ['Gaine', 'Cabine', 'Machinerie', 'Portes palières', 'Sécurités'],
    requiredDTUs: [],
    requiredCertifications: ['Organisme agréé'],
    dependencies: ['beton_arme', 'courants_forts'],
    typicalPriceRange: { min: 15000, max: 40000, unit: 'euro_forfait', year: 2024 },
    typicalDuration: { minDays: 10, maxDays: 30, factors: ['Type', 'Niveaux', 'Gaine'] },
    complexityLevel: 'expert',
    rgeEligible: false,
    aidesEligibles: ['anah'],
  },
  {
    type: 'cuisine_equipee',
    number: '47',
    name: 'Cuisine équipée',
    category: 'speciaux',
    description: 'Fourniture et pose cuisine équipée',
    commonWorks: ['Meubles', 'Plan de travail', 'Électroménager', 'Crédence', 'Évier', 'Robinetterie'],
    requiredDTUs: [],
    requiredCertifications: [],
    dependencies: ['platrerie', 'carrelage', 'courants_forts', 'sanitaires'],
    typicalPriceRange: { min: 5000, max: 30000, unit: 'euro_forfait', year: 2024 },
    typicalDuration: { minDays: 2, maxDays: 10, factors: ['Gamme', 'Équipements', 'Complexité'] },
    complexityLevel: 'moderate',
    rgeEligible: false,
    aidesEligibles: [],
  },
  {
    type: 'salle_bain_cle_main',
    number: '48',
    name: 'Salle de bain clé en main',
    category: 'speciaux',
    description: 'Rénovation complète salle de bain',
    commonWorks: ['Dépose', 'Plomberie', 'Électricité', 'Carrelage', 'Faïence', 'Sanitaires', 'Meubles'],
    requiredDTUs: ['DTU 60.1', 'DTU 52.2'],
    requiredCertifications: [],
    dependencies: ['platrerie'],
    typicalPriceRange: { min: 5000, max: 20000, unit: 'euro_forfait', year: 2024 },
    typicalDuration: { minDays: 5, maxDays: 15, factors: ['Surface', 'Gamme', 'Équipements'] },
    complexityLevel: 'moderate',
    rgeEligible: false,
    aidesEligibles: ['anah'],
  },
];

// =============================================================================
// UTILITAIRES LOTS
// =============================================================================

export function getLotsByCategory(category: LotCategory): LotDefinition[] {
  return LOT_CATALOG.filter(lot => lot.category === category);
}

export function getLotByType(type: LotType): LotDefinition | undefined {
  return LOT_CATALOG.find(lot => lot.type === type);
}

export function getLotsRGEEligible(): LotDefinition[] {
  return LOT_CATALOG.filter(lot => lot.rgeEligible);
}

export function getLotsWithAides(): LotDefinition[] {
  return LOT_CATALOG.filter(lot => lot.aidesEligibles.length > 0);
}
