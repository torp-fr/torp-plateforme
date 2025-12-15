/**
 * TORP Phase 0 - Types pour les détails par pièce
 * Structure des travaux détaillés pièce par pièce
 */

// =============================================================================
// TYPES DE PIÈCES
// =============================================================================

export type RoomType =
  | 'living_room'      // Salon/Séjour
  | 'bedroom'          // Chambre
  | 'kitchen'          // Cuisine
  | 'bathroom'         // Salle de bain
  | 'toilet'           // WC/Toilettes
  | 'hallway'          // Couloir/Entrée
  | 'office'           // Bureau
  | 'laundry'          // Buanderie
  | 'garage'           // Garage
  | 'cellar'           // Cave
  | 'attic'            // Grenier/Combles
  | 'terrace'          // Terrasse/Balcon
  | 'garden'           // Jardin/Extérieur
  | 'other';           // Autre

export const ROOM_TYPE_CONFIG: Record<RoomType, {
  label: string;
  labelPlural: string;
  icon: string;
  commonWorks: WorkItemType[];
}> = {
  living_room: {
    label: 'Salon/Séjour',
    labelPlural: 'Salons/Séjours',
    icon: 'sofa',
    commonWorks: ['painting', 'flooring', 'electrical', 'lighting', 'heating'],
  },
  bedroom: {
    label: 'Chambre',
    labelPlural: 'Chambres',
    icon: 'bed',
    commonWorks: ['painting', 'flooring', 'electrical', 'lighting', 'closet'],
  },
  kitchen: {
    label: 'Cuisine',
    labelPlural: 'Cuisines',
    icon: 'utensils',
    commonWorks: ['cabinets', 'countertop', 'plumbing', 'electrical', 'flooring', 'tiling', 'appliances'],
  },
  bathroom: {
    label: 'Salle de bain',
    labelPlural: 'Salles de bain',
    icon: 'bath',
    commonWorks: ['plumbing', 'tiling', 'sanitary', 'electrical', 'ventilation', 'heating'],
  },
  toilet: {
    label: 'WC/Toilettes',
    labelPlural: 'WC/Toilettes',
    icon: 'toilet',
    commonWorks: ['plumbing', 'sanitary', 'tiling', 'painting', 'ventilation'],
  },
  hallway: {
    label: 'Couloir/Entrée',
    labelPlural: 'Couloirs/Entrées',
    icon: 'door-open',
    commonWorks: ['painting', 'flooring', 'lighting', 'storage'],
  },
  office: {
    label: 'Bureau',
    labelPlural: 'Bureaux',
    icon: 'laptop',
    commonWorks: ['painting', 'flooring', 'electrical', 'lighting', 'network'],
  },
  laundry: {
    label: 'Buanderie',
    labelPlural: 'Buanderies',
    icon: 'washing-machine',
    commonWorks: ['plumbing', 'electrical', 'flooring', 'ventilation'],
  },
  garage: {
    label: 'Garage',
    labelPlural: 'Garages',
    icon: 'car',
    commonWorks: ['flooring', 'electrical', 'door', 'insulation'],
  },
  cellar: {
    label: 'Cave',
    labelPlural: 'Caves',
    icon: 'archive',
    commonWorks: ['waterproofing', 'electrical', 'ventilation', 'insulation'],
  },
  attic: {
    label: 'Grenier/Combles',
    labelPlural: 'Greniers/Combles',
    icon: 'home',
    commonWorks: ['insulation', 'flooring', 'electrical', 'velux', 'conversion'],
  },
  terrace: {
    label: 'Terrasse/Balcon',
    labelPlural: 'Terrasses/Balcons',
    icon: 'sun',
    commonWorks: ['flooring', 'railing', 'waterproofing', 'lighting'],
  },
  garden: {
    label: 'Jardin/Extérieur',
    labelPlural: 'Jardins/Extérieurs',
    icon: 'trees',
    commonWorks: ['landscaping', 'fencing', 'lighting', 'irrigation'],
  },
  other: {
    label: 'Autre pièce',
    labelPlural: 'Autres pièces',
    icon: 'square',
    commonWorks: ['painting', 'flooring', 'electrical'],
  },
};

// =============================================================================
// TYPES DE TRAVAUX
// =============================================================================

export type WorkItemType =
  // Revêtements
  | 'painting'         // Peinture/Enduits
  | 'flooring'         // Revêtement de sol (parquet, carrelage, etc.)
  | 'tiling'           // Carrelage mural
  | 'wallpaper'        // Papier peint
  // Menuiserie
  | 'cabinets'         // Meubles/Placards
  | 'closet'           // Dressing/Rangements
  | 'door'             // Porte
  | 'window'           // Fenêtre
  | 'velux'            // Velux/Fenêtre de toit
  // Plomberie
  | 'plumbing'         // Plomberie générale
  | 'sanitary'         // Sanitaires (WC, lavabo, douche, baignoire)
  | 'countertop'       // Plan de travail
  // Électricité
  | 'electrical'       // Électricité générale
  | 'lighting'         // Éclairage
  | 'network'          // Réseau/Domotique
  // Chauffage/Ventilation
  | 'heating'          // Chauffage
  | 'ventilation'      // Ventilation/VMC
  | 'insulation'       // Isolation
  // Équipements
  | 'appliances'       // Électroménager
  | 'storage'          // Rangements
  // Extérieur
  | 'railing'          // Garde-corps/Balustrade
  | 'waterproofing'    // Étanchéité
  | 'landscaping'      // Aménagement paysager
  | 'fencing'          // Clôture
  | 'irrigation'       // Arrosage
  // Aménagement
  | 'conversion'       // Aménagement/Transformation
  | 'demolition'       // Démolition
  | 'other';           // Autre

export const WORK_ITEM_CONFIG: Record<WorkItemType, {
  label: string;
  description: string;
  category: 'coating' | 'woodwork' | 'plumbing' | 'electrical' | 'hvac' | 'equipment' | 'exterior' | 'structure';
}> = {
  painting: { label: 'Peinture/Enduits', description: 'Préparation des murs, enduits, peinture', category: 'coating' },
  flooring: { label: 'Sol', description: 'Parquet, carrelage, moquette, vinyle...', category: 'coating' },
  tiling: { label: 'Carrelage mural', description: 'Faïence, mosaïque', category: 'coating' },
  wallpaper: { label: 'Papier peint', description: 'Pose de papier peint ou revêtement mural', category: 'coating' },
  cabinets: { label: 'Meubles', description: 'Meubles de cuisine, salle de bain', category: 'woodwork' },
  closet: { label: 'Rangements', description: 'Dressing, placards sur mesure', category: 'woodwork' },
  door: { label: 'Porte', description: 'Porte intérieure ou extérieure', category: 'woodwork' },
  window: { label: 'Fenêtre', description: 'Remplacement ou pose de fenêtres', category: 'woodwork' },
  velux: { label: 'Velux', description: 'Fenêtre de toit', category: 'woodwork' },
  plumbing: { label: 'Plomberie', description: 'Tuyauterie, raccordements', category: 'plumbing' },
  sanitary: { label: 'Sanitaires', description: 'WC, lavabo, douche, baignoire', category: 'plumbing' },
  countertop: { label: 'Plan de travail', description: 'Plan de travail cuisine ou salle de bain', category: 'plumbing' },
  electrical: { label: 'Électricité', description: 'Installation électrique, prises, interrupteurs', category: 'electrical' },
  lighting: { label: 'Éclairage', description: 'Points lumineux, spots, appliques', category: 'electrical' },
  network: { label: 'Réseau', description: 'Prises RJ45, domotique, wifi', category: 'electrical' },
  heating: { label: 'Chauffage', description: 'Radiateurs, plancher chauffant', category: 'hvac' },
  ventilation: { label: 'Ventilation', description: 'VMC, aération', category: 'hvac' },
  insulation: { label: 'Isolation', description: 'Isolation thermique ou phonique', category: 'hvac' },
  appliances: { label: 'Électroménager', description: 'Four, plaque, hotte, lave-vaisselle...', category: 'equipment' },
  storage: { label: 'Rangements', description: 'Étagères, meubles de rangement', category: 'equipment' },
  railing: { label: 'Garde-corps', description: 'Balustrade, rambarde', category: 'exterior' },
  waterproofing: { label: 'Étanchéité', description: 'Traitement d\'étanchéité', category: 'exterior' },
  landscaping: { label: 'Paysager', description: 'Aménagement extérieur, plantations', category: 'exterior' },
  fencing: { label: 'Clôture', description: 'Pose ou remplacement de clôture', category: 'exterior' },
  irrigation: { label: 'Arrosage', description: 'Système d\'arrosage automatique', category: 'exterior' },
  conversion: { label: 'Aménagement', description: 'Transformation, réagencement', category: 'structure' },
  demolition: { label: 'Démolition', description: 'Démolition, dépose', category: 'structure' },
  other: { label: 'Autre', description: 'Autre type de travaux', category: 'structure' },
};

// =============================================================================
// STRUCTURE DES DONNÉES
// =============================================================================

export interface RoomWorkItem {
  id: string;
  type: WorkItemType;
  description: string;
  notes?: string;
  priority: 'high' | 'medium' | 'low';
  estimatedCost?: {
    min: number;
    max: number;
  };
}

export interface RoomPhoto {
  id: string;
  url: string;
  thumbnailUrl?: string;
  caption?: string;
  uploadedAt: string;
}

export interface RoomDetail {
  id: string;
  type: RoomType;
  customName?: string;  // Ex: "Chambre 1", "Chambre parentale"
  surface?: number;     // m²
  works: RoomWorkItem[];
  photos: RoomPhoto[];
  notes?: string;
  priority: 'high' | 'medium' | 'low';
  createdAt: string;
  updatedAt: string;
}

export interface RoomDetailsData {
  rooms: RoomDetail[];
  globalNotes?: string;
  totalEstimatedCost?: {
    min: number;
    max: number;
  };
}

// =============================================================================
// HELPERS
// =============================================================================

export function createEmptyRoom(type: RoomType, index?: number): RoomDetail {
  const config = ROOM_TYPE_CONFIG[type];
  const now = new Date().toISOString();

  return {
    id: `room_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    type,
    customName: index !== undefined ? `${config.label} ${index + 1}` : config.label,
    works: [],
    photos: [],
    priority: 'medium',
    createdAt: now,
    updatedAt: now,
  };
}

export function createWorkItem(type: WorkItemType): RoomWorkItem {
  const config = WORK_ITEM_CONFIG[type];

  return {
    id: `work_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    type,
    description: config.description,
    priority: 'medium',
  };
}
