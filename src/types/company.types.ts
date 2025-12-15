/**
 * Types pour la gestion des ressources entreprise B2B
 * Moyens humains et matériels structurés
 */

// ============================================
// MOYENS HUMAINS
// ============================================

export type EmployeeCategory =
  | 'direction'
  | 'encadrement'
  | 'administratif'
  | 'technique'
  | 'production'
  | 'interimaire';

export const EMPLOYEE_CATEGORIES: Record<EmployeeCategory, { label: string; color: string; icon: string }> = {
  direction: { label: 'Direction', color: 'purple', icon: 'Crown' },
  encadrement: { label: 'Encadrement', color: 'blue', icon: 'Users' },
  administratif: { label: 'Administratif', color: 'gray', icon: 'Briefcase' },
  technique: { label: 'Bureau d\'études', color: 'indigo', icon: 'Calculator' },
  production: { label: 'Production', color: 'green', icon: 'HardHat' },
  interimaire: { label: 'Intérimaire', color: 'orange', icon: 'Clock' },
};

export interface EmployeeRole {
  id: string;
  category: EmployeeCategory;
  title: string;
  count: number;
  description?: string;
}

export const COMMON_EMPLOYEE_ROLES: Array<{ category: EmployeeCategory; title: string }> = [
  // Direction
  { category: 'direction', title: 'Dirigeant / Gérant' },
  { category: 'direction', title: 'Directeur général' },
  { category: 'direction', title: 'Directeur technique' },
  // Encadrement
  { category: 'encadrement', title: 'Conducteur de travaux' },
  { category: 'encadrement', title: 'Chef de chantier' },
  { category: 'encadrement', title: 'Chef d\'équipe' },
  { category: 'encadrement', title: 'Responsable QSE' },
  // Administratif
  { category: 'administratif', title: 'Secrétaire / Assistante' },
  { category: 'administratif', title: 'Comptable' },
  { category: 'administratif', title: 'Chargé d\'affaires' },
  { category: 'administratif', title: 'Commercial' },
  // Technique
  { category: 'technique', title: 'Ingénieur études' },
  { category: 'technique', title: 'Dessinateur / Projeteur' },
  { category: 'technique', title: 'Métreur' },
  // Production
  { category: 'production', title: 'Ouvrier qualifié' },
  { category: 'production', title: 'Compagnon' },
  { category: 'production', title: 'Apprenti' },
  { category: 'production', title: 'Manœuvre' },
  // Intérimaire
  { category: 'interimaire', title: 'Intérimaire' },
];

// ============================================
// MOYENS MATÉRIELS
// ============================================

export type MaterialCategory =
  | 'vehicules'
  | 'engins'
  | 'outillage'
  | 'equipements'
  | 'informatique'
  | 'locaux';

export const MATERIAL_CATEGORIES: Record<MaterialCategory, { label: string; color: string; icon: string }> = {
  vehicules: { label: 'Véhicules', color: 'blue', icon: 'Truck' },
  engins: { label: 'Engins de chantier', color: 'yellow', icon: 'Tractor' },
  outillage: { label: 'Outillage', color: 'gray', icon: 'Wrench' },
  equipements: { label: 'Équipements', color: 'green', icon: 'Package' },
  informatique: { label: 'Informatique', color: 'purple', icon: 'Laptop' },
  locaux: { label: 'Locaux', color: 'indigo', icon: 'Building' },
};

export interface MaterialResource {
  id: string;
  category: MaterialCategory;
  type: string;
  name?: string;
  brand?: string;
  model?: string;
  quantity: number;
  yearAcquisition?: number;
  value?: number;
  isOwned: boolean; // true = propriété, false = location
  notes?: string;
}

export const COMMON_MATERIAL_TYPES: Record<MaterialCategory, string[]> = {
  vehicules: [
    'Fourgon utilitaire',
    'Camion plateau',
    'Camion benne',
    'Véhicule de fonction',
    'Remorque',
    'Camionnette',
  ],
  engins: [
    'Mini-pelle',
    'Pelleteuse',
    'Chargeuse',
    'Compacteur',
    'Nacelle élévatrice',
    'Chariot élévateur',
    'Grue mobile',
  ],
  outillage: [
    'Outillage électroportatif',
    'Outillage manuel',
    'Échafaudage',
    'Étais',
    'Coffrage',
    'Bétonnière',
    'Groupe électrogène',
    'Compresseur',
  ],
  equipements: [
    'EPI (lot complet)',
    'Signalisation chantier',
    'Base vie / Bungalow',
    'Sanitaires mobiles',
    'Conteneurs stockage',
    'Échelles / Escabeaux',
  ],
  informatique: [
    'Ordinateurs',
    'Tablettes chantier',
    'Logiciel CAO/DAO',
    'Logiciel gestion chantier',
    'Drone',
    'Théodolite / Station totale',
  ],
  locaux: [
    'Siège social',
    'Atelier',
    'Entrepôt / Dépôt',
    'Parking véhicules',
    'Salle de réunion',
  ],
};

// ============================================
// RÉSUMÉ MOYENS ENTREPRISE
// ============================================

export interface CompanyResourcesSummary {
  effectifTotal: number;
  effectifParCategorie: Record<EmployeeCategory, number>;
  rolesDetailles: EmployeeRole[];
  materielParCategorie: Record<MaterialCategory, number>;
  materielDetaille: MaterialResource[];
  valeurPatrimoine?: number;
  lastUpdated?: string;
}

// ============================================
// FORMULAIRE RESSOURCES
// ============================================

export interface ResourceFormData {
  humanResources: EmployeeRole[];
  materialResources: MaterialResource[];
}

export function calculateResourcesSummary(data: ResourceFormData): CompanyResourcesSummary {
  const effectifParCategorie: Record<EmployeeCategory, number> = {
    direction: 0,
    encadrement: 0,
    administratif: 0,
    technique: 0,
    production: 0,
    interimaire: 0,
  };

  let effectifTotal = 0;
  for (const role of data.humanResources) {
    effectifParCategorie[role.category] += role.count;
    effectifTotal += role.count;
  }

  const materielParCategorie: Record<MaterialCategory, number> = {
    vehicules: 0,
    engins: 0,
    outillage: 0,
    equipements: 0,
    informatique: 0,
    locaux: 0,
  };

  let valeurPatrimoine = 0;
  for (const material of data.materialResources) {
    materielParCategorie[material.category] += material.quantity;
    if (material.isOwned && material.value) {
      valeurPatrimoine += material.value * material.quantity;
    }
  }

  return {
    effectifTotal,
    effectifParCategorie,
    rolesDetailles: data.humanResources,
    materielParCategorie,
    materielDetaille: data.materialResources,
    valeurPatrimoine: valeurPatrimoine > 0 ? valeurPatrimoine : undefined,
    lastUpdated: new Date().toISOString(),
  };
}
