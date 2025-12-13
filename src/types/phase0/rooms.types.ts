/**
 * TORP Phase 0 - Types des Pièces et Travaux par Zone
 * Module permettant la définition détaillée des travaux pièce par pièce
 * Avec photos, notes et estimation par zone
 */

import type { EstimationRange, ConfidenceLevel } from './common.types';
import type { RoomType, ConditionGrade } from './property.types';
import type { LotType, LotCategory } from './lots.types';

// =============================================================================
// PIÈCE/ESPACE AVEC TRAVAUX
// =============================================================================

export interface RoomWorkDefinition {
  id: string;
  projectId: string;

  // Identification de la pièce
  room: RoomInfo;

  // Travaux définis pour cette pièce
  plannedWorks: RoomWork[];

  // Photos et documentation visuelle
  photos: RoomPhoto[];

  // Notes et observations
  notes: RoomNote[];

  // État actuel et souhaité
  currentState: RoomState;
  targetState: RoomState;

  // Estimation spécifique à cette pièce
  roomEstimate?: RoomEstimate;

  // Métadonnées
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
}

// =============================================================================
// INFORMATION SUR LA PIÈCE
// =============================================================================

export interface RoomInfo {
  name: string;                    // Ex: "Chambre 1", "Cuisine", "Salle de bain principale"
  customName?: string;             // Nom personnalisé par l'utilisateur
  type: RoomType;
  level: number;                   // -1 = sous-sol, 0 = RDC, 1 = étage, etc.
  surface: number;                 // m²
  ceilingHeight: number;           // mètres

  // Caractéristiques
  hasWindow: boolean;
  windowCount: number;
  orientation?: CardinalDirection;
  hasWetArea: boolean;             // Point d'eau existant
  hasElectricity: boolean;
  electricalOutlets?: number;

  // Position dans le logement
  adjacentRooms?: string[];        // IDs des pièces adjacentes
  accessFrom?: string[];           // IDs des pièces d'accès
}

export type CardinalDirection = 'north' | 'south' | 'east' | 'west' |
  'north_east' | 'north_west' | 'south_east' | 'south_west';

// =============================================================================
// TRAVAUX DÉFINIS PAR PIÈCE
// =============================================================================

export interface RoomWork {
  id: string;
  roomId: string;

  // Type de travaux
  workCategory: RoomWorkCategory;
  workType: RoomWorkType;

  // Description
  title: string;                   // Ex: "Refaire le sol"
  description?: string;            // Détails supplémentaires

  // Spécifications
  specifications: WorkSpecifications;

  // Lots concernés (pour le DCE)
  associatedLots: LotType[];

  // Estimation
  estimate?: WorkEstimate;

  // Priorité et contraintes
  priority: WorkPriority;
  isOptional: boolean;
  dependencies?: string[];         // IDs des travaux pré-requis

  // Photos avant/pendant/après prévues
  photosBefore: string[];          // IDs des photos

  // Statut
  status: RoomWorkStatus;
}

export type RoomWorkCategory =
  | 'demolition'          // Démolition
  | 'gros_oeuvre'         // Gros œuvre (murs, structure)
  | 'sol'                 // Sols (revêtement, chape, carrelage)
  | 'mur'                 // Murs (enduit, peinture, papier peint)
  | 'plafond'             // Plafonds (faux plafond, peinture)
  | 'menuiserie'          // Menuiseries (portes, fenêtres, placards)
  | 'electricite'         // Électricité (prises, éclairage, tableau)
  | 'plomberie'           // Plomberie (sanitaires, évacuation)
  | 'chauffage'           // Chauffage (radiateurs, plancher chauffant)
  | 'ventilation'         // Ventilation (VMC, extraction)
  | 'isolation'           // Isolation (thermique, acoustique)
  | 'agencement'          // Agencement (cuisine, sdb, rangements)
  | 'decoration'          // Décoration (peinture, papier peint)
  | 'equipement';         // Équipements (électroménager, sanitaires)

export type RoomWorkType =
  // Sol
  | 'floor_demolition'        // Dépose sol existant
  | 'floor_leveling'          // Ragréage
  | 'floor_screed'            // Chape
  | 'floor_tile'              // Carrelage
  | 'floor_parquet'           // Parquet
  | 'floor_laminate'          // Stratifié
  | 'floor_vinyl'             // Vinyle/PVC
  | 'floor_carpet'            // Moquette
  | 'floor_concrete'          // Béton ciré
  | 'floor_epoxy'             // Résine époxy
  | 'floor_heated'            // Plancher chauffant

  // Murs
  | 'wall_demolition'         // Démolition cloison
  | 'wall_creation'           // Création cloison
  | 'wall_opening'            // Ouverture mur
  | 'wall_plastering'         // Enduit
  | 'wall_painting'           // Peinture
  | 'wall_wallpaper'          // Papier peint
  | 'wall_tiling'             // Faïence
  | 'wall_paneling'           // Lambris
  | 'wall_insulation'         // Isolation

  // Plafond
  | 'ceiling_false'           // Faux plafond
  | 'ceiling_painting'        // Peinture plafond
  | 'ceiling_plaster'         // Enduit plafond
  | 'ceiling_acoustic'        // Traitement acoustique

  // Menuiseries
  | 'door_interior'           // Porte intérieure
  | 'door_exterior'           // Porte extérieure
  | 'window_replacement'      // Remplacement fenêtre
  | 'window_renovation'       // Rénovation fenêtre
  | 'shutter_install'         // Installation volets
  | 'closet_builtin'          // Placard intégré

  // Électricité
  | 'elec_renovation'         // Rénovation électrique
  | 'elec_outlets'            // Prises électriques
  | 'elec_lighting'           // Éclairage
  | 'elec_switches'           // Interrupteurs
  | 'elec_panel'              // Tableau électrique
  | 'elec_network'            // Réseau informatique

  // Plomberie
  | 'plumb_supply'            // Alimentation eau
  | 'plumb_drain'             // Évacuation
  | 'plumb_fixture'           // Équipement sanitaire
  | 'plumb_heating'           // Réseau chauffage

  // Chauffage
  | 'heat_radiator'           // Radiateur
  | 'heat_underfloor'         // Plancher chauffant
  | 'heat_towel'              // Sèche-serviettes

  // Ventilation
  | 'vent_vmc'                // VMC
  | 'vent_extraction'         // Extraction ponctuelle
  | 'vent_grille'             // Grilles de ventilation

  // Agencement
  | 'kitchen_layout'          // Agencement cuisine
  | 'bathroom_layout'         // Agencement salle de bain
  | 'storage_custom'          // Rangements sur mesure
  | 'dressing_custom'         // Dressing sur mesure

  // Équipements
  | 'equip_sink'              // Évier
  | 'equip_toilet'            // WC
  | 'equip_shower'            // Douche
  | 'equip_bathtub'           // Baignoire
  | 'equip_washbasin'         // Lavabo
  | 'equip_appliance';        // Électroménager

export interface WorkSpecifications {
  // Surfaces concernées
  surfaceArea?: number;           // m² concernés
  linearMeters?: number;          // ml concernés
  quantity?: number;              // Quantité (portes, fenêtres, etc.)

  // Matériaux souhaités
  materialPreferences?: MaterialPreference[];

  // Niveau de finition
  finishLevel: FinishLevel;

  // Contraintes techniques
  technicalConstraints?: string[];

  // Exigences spécifiques
  requirements?: string[];
}

export interface MaterialPreference {
  category: string;               // Ex: "revêtement sol", "peinture"
  preferredType?: string;         // Ex: "parquet chêne", "peinture mat"
  priceRange?: 'economic' | 'standard' | 'premium' | 'luxury';
  specificBrand?: string;
  specificProduct?: string;
  notes?: string;
}

export type FinishLevel = 'basic' | 'standard' | 'premium' | 'luxury';

export type WorkPriority = 'critical' | 'high' | 'medium' | 'low' | 'optional';

export type RoomWorkStatus =
  | 'draft'           // Brouillon
  | 'defined'         // Défini
  | 'estimated'       // Estimé
  | 'validated'       // Validé
  | 'in_tender';      // Inclus dans appel d'offres

export interface WorkEstimate {
  workId: string;

  // Coûts
  totalCost: EstimationRange;
  materialsCost?: EstimationRange;
  laborCost?: EstimationRange;

  // Durée
  duration: {
    min: number;                  // Heures
    max: number;
  };

  // Détails
  unitPrice?: number;
  unit?: string;                  // m², ml, u, etc.
  quantity?: number;
  priceSource?: string;           // Source du prix (base TORP, devis, etc.)

  // Confiance
  confidence: ConfidenceLevel;

  // Métadonnées
  calculatedAt: string;
}

// =============================================================================
// PHOTOS PAR PIÈCE
// =============================================================================

export interface RoomPhoto {
  id: string;
  roomId: string;

  // Fichier
  url: string;
  thumbnailUrl?: string;
  fileName: string;
  fileSize: number;
  mimeType: string;

  // Métadonnées
  capturedAt?: string;            // Date de prise de vue
  uploadedAt: string;
  uploadedBy?: string;

  // Classification
  photoType: RoomPhotoType;
  workIds?: string[];             // IDs des travaux concernés

  // Annotations
  title?: string;
  description?: string;
  tags?: string[];
  annotations?: PhotoAnnotation[];

  // Position dans la pièce
  viewAngle?: PhotoViewAngle;
  position?: PhotoPosition;

  // Qualité et utilisation
  quality: PhotoQuality;
  useInDocuments: boolean;        // Inclure dans DCE/DOE
  isMainPhoto: boolean;           // Photo principale de la pièce
}

export type RoomPhotoType =
  | 'overview'        // Vue d'ensemble
  | 'detail'          // Détail
  | 'damage'          // Dégât/problème
  | 'measurement'     // Avec mesure
  | 'before'          // Avant travaux
  | 'during'          // Pendant travaux
  | 'after'           // Après travaux
  | 'reference';      // Photo de référence (inspiration)

export type PhotoViewAngle =
  | 'front' | 'back' | 'left' | 'right'
  | 'top' | 'bottom' | 'corner' | 'panoramic';

export interface PhotoPosition {
  x: number;                      // Position relative dans la pièce (0-100)
  y: number;
  direction?: number;             // Angle de vue (0-360)
}

export interface PhotoAnnotation {
  id: string;
  type: 'arrow' | 'circle' | 'rectangle' | 'text' | 'measurement';
  x: number;                      // Position relative (0-100)
  y: number;
  width?: number;
  height?: number;
  text?: string;
  color?: string;
  measurement?: {
    value: number;
    unit: 'cm' | 'm' | 'mm';
  };
}

export type PhotoQuality = 'low' | 'medium' | 'high' | 'excellent';

// =============================================================================
// NOTES PAR PIÈCE
// =============================================================================

export interface RoomNote {
  id: string;
  roomId: string;

  // Contenu
  content: string;

  // Classification
  noteType: RoomNoteType;
  importance: NoteImportance;

  // Liens
  workIds?: string[];             // Travaux concernés
  photoIds?: string[];            // Photos liées

  // Métadonnées
  createdAt: string;
  updatedAt: string;
  createdBy?: string;

  // Visibilité dans les documents
  includeInCCTP: boolean;
  includeInDCE: boolean;
}

export type RoomNoteType =
  | 'observation'     // Observation générale
  | 'constraint'      // Contrainte technique
  | 'requirement'     // Exigence du client
  | 'recommendation'  // Recommandation
  | 'warning'         // Avertissement
  | 'todo'            // À faire
  | 'question';       // Question à éclaircir

export type NoteImportance = 'critical' | 'high' | 'medium' | 'low' | 'info';

// =============================================================================
// ÉTAT DE LA PIÈCE
// =============================================================================

export interface RoomState {
  overallCondition: ConditionGrade;

  // État par élément
  floorCondition: ConditionGrade;
  wallsCondition: ConditionGrade;
  ceilingCondition: ConditionGrade;
  doorsCondition: ConditionGrade;
  windowsCondition: ConditionGrade;
  electricalCondition?: ConditionGrade;
  plumbingCondition?: ConditionGrade;

  // Description
  description?: string;
  issues?: RoomIssue[];
}

export interface RoomIssue {
  id: string;
  type: IssueType;
  location: string;               // Ex: "Mur nord", "Angle fenêtre"
  description: string;
  severity: IssueSeverity;
  photoIds?: string[];
  requiresExpertise: boolean;
  estimatedRepairCost?: EstimationRange;
}

export type IssueType =
  | 'humidity'        // Humidité
  | 'crack'           // Fissure
  | 'mold'            // Moisissure
  | 'water_damage'    // Dégât des eaux
  | 'wear'            // Usure
  | 'damage'          // Dommage
  | 'obsolete'        // Vétusté
  | 'non_compliant'   // Non-conformité
  | 'infestation'     // Infestation
  | 'structural';     // Problème structurel

export type IssueSeverity = 'minor' | 'moderate' | 'major' | 'critical';

// =============================================================================
// ESTIMATION PAR PIÈCE
// =============================================================================

export interface RoomEstimate {
  roomId: string;

  // Coûts
  totalCost: EstimationRange;
  costBreakdown: RoomCostBreakdown[];

  // Durée
  estimatedDuration: {
    min: number;                  // Jours
    max: number;
  };

  // Confiance
  confidence: ConfidenceLevel;

  // Détails
  pricePerSqm?: EstimationRange;
  majorCostDrivers?: string[];

  // Comparaison marché
  marketComparison?: {
    average: number;
    position: 'below' | 'average' | 'above';
    percentile: number;
  };

  // Métadonnées
  calculatedAt: string;
  basedOn: string[];              // Sources des données
}

export interface RoomCostBreakdown {
  workId: string;
  workTitle: string;
  category: RoomWorkCategory;
  cost: EstimationRange;
  percentage: number;

  // Détail
  materialsCost?: EstimationRange;
  laborCost?: EstimationRange;

  // Justification
  unitPrice?: number;
  unit?: string;
  quantity?: number;
  priceSource?: string;
}

// =============================================================================
// CONFIGURATION DES TYPES DE PIÈCES
// =============================================================================

export interface RoomTypeConfig {
  type: RoomType;
  label: string;
  labelPlural: string;
  icon: string;                   // Nom de l'icône Lucide
  defaultSurface: number;         // Surface moyenne par défaut
  typicalWorks: RoomWorkType[];   // Travaux typiques
  hasWetArea: boolean;
  defaultFinishLevel: FinishLevel;
}

export const ROOM_TYPE_CONFIGS: Record<RoomType, RoomTypeConfig> = {
  living_room: {
    type: 'living_room',
    label: 'Salon',
    labelPlural: 'Salons',
    icon: 'Sofa',
    defaultSurface: 25,
    typicalWorks: ['floor_parquet', 'wall_painting', 'ceiling_painting', 'elec_lighting'],
    hasWetArea: false,
    defaultFinishLevel: 'standard',
  },
  dining_room: {
    type: 'dining_room',
    label: 'Salle à manger',
    labelPlural: 'Salles à manger',
    icon: 'UtensilsCrossed',
    defaultSurface: 15,
    typicalWorks: ['floor_parquet', 'wall_painting', 'ceiling_painting'],
    hasWetArea: false,
    defaultFinishLevel: 'standard',
  },
  bedroom: {
    type: 'bedroom',
    label: 'Chambre',
    labelPlural: 'Chambres',
    icon: 'Bed',
    defaultSurface: 12,
    typicalWorks: ['floor_parquet', 'floor_carpet', 'wall_painting', 'wall_wallpaper'],
    hasWetArea: false,
    defaultFinishLevel: 'standard',
  },
  bathroom: {
    type: 'bathroom',
    label: 'Salle de bain',
    labelPlural: 'Salles de bain',
    icon: 'Bath',
    defaultSurface: 6,
    typicalWorks: ['floor_tile', 'wall_tiling', 'plumb_fixture', 'bathroom_layout', 'vent_extraction'],
    hasWetArea: true,
    defaultFinishLevel: 'standard',
  },
  shower_room: {
    type: 'shower_room',
    label: 'Salle d\'eau',
    labelPlural: 'Salles d\'eau',
    icon: 'Droplets',
    defaultSurface: 4,
    typicalWorks: ['floor_tile', 'wall_tiling', 'plumb_fixture', 'equip_shower'],
    hasWetArea: true,
    defaultFinishLevel: 'standard',
  },
  toilet: {
    type: 'toilet',
    label: 'WC',
    labelPlural: 'WC',
    icon: 'Bath',
    defaultSurface: 2,
    typicalWorks: ['floor_tile', 'wall_painting', 'equip_toilet', 'vent_extraction'],
    hasWetArea: true,
    defaultFinishLevel: 'standard',
  },
  kitchen: {
    type: 'kitchen',
    label: 'Cuisine',
    labelPlural: 'Cuisines',
    icon: 'ChefHat',
    defaultSurface: 10,
    typicalWorks: ['floor_tile', 'wall_tiling', 'kitchen_layout', 'plumb_supply', 'elec_outlets'],
    hasWetArea: true,
    defaultFinishLevel: 'standard',
  },
  office: {
    type: 'office',
    label: 'Bureau',
    labelPlural: 'Bureaux',
    icon: 'Monitor',
    defaultSurface: 10,
    typicalWorks: ['floor_parquet', 'wall_painting', 'elec_outlets', 'elec_network'],
    hasWetArea: false,
    defaultFinishLevel: 'standard',
  },
  laundry: {
    type: 'laundry',
    label: 'Buanderie',
    labelPlural: 'Buanderies',
    icon: 'WashingMachine',
    defaultSurface: 4,
    typicalWorks: ['floor_tile', 'wall_painting', 'plumb_supply', 'elec_outlets'],
    hasWetArea: true,
    defaultFinishLevel: 'basic',
  },
  dressing: {
    type: 'dressing',
    label: 'Dressing',
    labelPlural: 'Dressings',
    icon: 'Shirt',
    defaultSurface: 6,
    typicalWorks: ['floor_carpet', 'wall_painting', 'dressing_custom', 'elec_lighting'],
    hasWetArea: false,
    defaultFinishLevel: 'standard',
  },
  storage: {
    type: 'storage',
    label: 'Rangement',
    labelPlural: 'Rangements',
    icon: 'Archive',
    defaultSurface: 3,
    typicalWorks: ['wall_painting', 'storage_custom'],
    hasWetArea: false,
    defaultFinishLevel: 'basic',
  },
  cellar: {
    type: 'cellar',
    label: 'Cave',
    labelPlural: 'Caves',
    icon: 'Wine',
    defaultSurface: 10,
    typicalWorks: ['wall_plastering', 'elec_lighting'],
    hasWetArea: false,
    defaultFinishLevel: 'basic',
  },
  attic: {
    type: 'attic',
    label: 'Combles',
    labelPlural: 'Combles',
    icon: 'Home',
    defaultSurface: 20,
    typicalWorks: ['wall_insulation', 'ceiling_false', 'floor_laminate'],
    hasWetArea: false,
    defaultFinishLevel: 'basic',
  },
  garage: {
    type: 'garage',
    label: 'Garage',
    labelPlural: 'Garages',
    icon: 'Car',
    defaultSurface: 15,
    typicalWorks: ['floor_epoxy', 'wall_painting', 'elec_outlets'],
    hasWetArea: false,
    defaultFinishLevel: 'basic',
  },
  workshop: {
    type: 'workshop',
    label: 'Atelier',
    labelPlural: 'Ateliers',
    icon: 'Wrench',
    defaultSurface: 15,
    typicalWorks: ['floor_concrete', 'elec_outlets', 'elec_lighting'],
    hasWetArea: false,
    defaultFinishLevel: 'basic',
  },
  veranda: {
    type: 'veranda',
    label: 'Véranda',
    labelPlural: 'Vérandas',
    icon: 'Sun',
    defaultSurface: 15,
    typicalWorks: ['floor_tile', 'window_replacement'],
    hasWetArea: false,
    defaultFinishLevel: 'standard',
  },
  entrance: {
    type: 'entrance',
    label: 'Entrée',
    labelPlural: 'Entrées',
    icon: 'DoorOpen',
    defaultSurface: 5,
    typicalWorks: ['floor_tile', 'wall_painting', 'door_interior'],
    hasWetArea: false,
    defaultFinishLevel: 'standard',
  },
  hallway: {
    type: 'hallway',
    label: 'Couloir',
    labelPlural: 'Couloirs',
    icon: 'ArrowRightLeft',
    defaultSurface: 8,
    typicalWorks: ['floor_parquet', 'wall_painting', 'elec_lighting'],
    hasWetArea: false,
    defaultFinishLevel: 'standard',
  },
  staircase: {
    type: 'staircase',
    label: 'Escalier',
    labelPlural: 'Escaliers',
    icon: 'Stairs',
    defaultSurface: 5,
    typicalWorks: ['wall_painting'],
    hasWetArea: false,
    defaultFinishLevel: 'standard',
  },
  utility: {
    type: 'utility',
    label: 'Local technique',
    labelPlural: 'Locaux techniques',
    icon: 'Settings',
    defaultSurface: 4,
    typicalWorks: ['wall_painting', 'elec_panel'],
    hasWetArea: false,
    defaultFinishLevel: 'basic',
  },
  other: {
    type: 'other',
    label: 'Autre',
    labelPlural: 'Autres',
    icon: 'MoreHorizontal',
    defaultSurface: 10,
    typicalWorks: ['wall_painting'],
    hasWetArea: false,
    defaultFinishLevel: 'standard',
  },
};

// =============================================================================
// LABELS ET TRADUCTIONS
// =============================================================================

export const ROOM_WORK_CATEGORY_LABELS: Record<RoomWorkCategory, string> = {
  demolition: 'Démolition',
  gros_oeuvre: 'Gros œuvre',
  sol: 'Sols',
  mur: 'Murs',
  plafond: 'Plafonds',
  menuiserie: 'Menuiseries',
  electricite: 'Électricité',
  plomberie: 'Plomberie',
  chauffage: 'Chauffage',
  ventilation: 'Ventilation',
  isolation: 'Isolation',
  agencement: 'Agencement',
  decoration: 'Décoration',
  equipement: 'Équipements',
};

export const ROOM_WORK_TYPE_LABELS: Record<RoomWorkType, string> = {
  // Sol
  floor_demolition: 'Dépose du sol existant',
  floor_leveling: 'Ragréage',
  floor_screed: 'Chape',
  floor_tile: 'Carrelage',
  floor_parquet: 'Parquet',
  floor_laminate: 'Stratifié',
  floor_vinyl: 'Sol vinyle/PVC',
  floor_carpet: 'Moquette',
  floor_concrete: 'Béton ciré',
  floor_epoxy: 'Résine époxy',
  floor_heated: 'Plancher chauffant',

  // Murs
  wall_demolition: 'Démolition cloison',
  wall_creation: 'Création cloison',
  wall_opening: 'Ouverture dans mur',
  wall_plastering: 'Enduit murs',
  wall_painting: 'Peinture murs',
  wall_wallpaper: 'Papier peint',
  wall_tiling: 'Faïence',
  wall_paneling: 'Lambris',
  wall_insulation: 'Isolation murs',

  // Plafond
  ceiling_false: 'Faux plafond',
  ceiling_painting: 'Peinture plafond',
  ceiling_plaster: 'Enduit plafond',
  ceiling_acoustic: 'Traitement acoustique',

  // Menuiseries
  door_interior: 'Porte intérieure',
  door_exterior: 'Porte extérieure',
  window_replacement: 'Remplacement fenêtre',
  window_renovation: 'Rénovation fenêtre',
  shutter_install: 'Installation volets',
  closet_builtin: 'Placard intégré',

  // Électricité
  elec_renovation: 'Rénovation électrique complète',
  elec_outlets: 'Prises électriques',
  elec_lighting: 'Éclairage',
  elec_switches: 'Interrupteurs',
  elec_panel: 'Tableau électrique',
  elec_network: 'Réseau informatique',

  // Plomberie
  plumb_supply: 'Alimentation en eau',
  plumb_drain: 'Évacuations',
  plumb_fixture: 'Équipement sanitaire',
  plumb_heating: 'Réseau chauffage',

  // Chauffage
  heat_radiator: 'Radiateur',
  heat_underfloor: 'Plancher chauffant',
  heat_towel: 'Sèche-serviettes',

  // Ventilation
  vent_vmc: 'VMC',
  vent_extraction: 'Extraction ponctuelle',
  vent_grille: 'Grilles de ventilation',

  // Agencement
  kitchen_layout: 'Agencement cuisine',
  bathroom_layout: 'Agencement salle de bain',
  storage_custom: 'Rangements sur mesure',
  dressing_custom: 'Dressing sur mesure',

  // Équipements
  equip_sink: 'Évier',
  equip_toilet: 'WC',
  equip_shower: 'Douche',
  equip_bathtub: 'Baignoire',
  equip_washbasin: 'Lavabo',
  equip_appliance: 'Électroménager',
};

export const FINISH_LEVEL_LABELS: Record<FinishLevel, string> = {
  basic: 'Économique',
  standard: 'Standard',
  premium: 'Premium',
  luxury: 'Luxe',
};

export const WORK_PRIORITY_LABELS: Record<WorkPriority, string> = {
  critical: 'Critique',
  high: 'Haute',
  medium: 'Moyenne',
  low: 'Basse',
  optional: 'Optionnel',
};
