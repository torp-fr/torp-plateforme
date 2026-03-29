/**
 * Project Context Types
 * Définit la structure du contexte projet avec pièces et travaux
 *
 * NOTE — Persistence layer types only.
 *
 * These enums represent the data model for persisted ProjectContext entities
 * (room-by-room project structure stored in Supabase).
 *
 * For NEW code that deals with intent parsing, CCF analysis, or rule
 * enforcement, use the string literal types from:
 *   import { ... } from '@/services/ccfEngine.service'
 *
 * The enums below are kept for backward compatibility with:
 *   src/api/analysis.ts
 *   src/services/analysis/AnalysisCommands.ts
 *   src/services/project/ProjectContextService.ts
 */

/**
 * @deprecated Use work_type string literals from ccfEngine.service.ts for
 * new analysis code. This enum is for the persisted room-work data model only.
 */
export enum WorkType {
  PAINTING = 'peinture',
  FLOORING = 'revetement',
  ELECTRICAL = 'electrique',
  PLUMBING = 'plomberie',
  INSULATION = 'isolation',
  WINDOWS = 'fenetres',
  ROOFING = 'toiture',
  STRUCTURAL = 'structure',
  HVAC = 'chauffage_clim',
  DOORS = 'portes',
  OTHER = 'autre',
}

/**
 * @deprecated Use `'neuf' | 'renovation'` from ccfEngine.service.ts for
 * new analysis code. This enum is for the persisted project data model only.
 */
export enum ProjectType {
  RENOVATION = 'renovation',
  NEW = 'neuf',
  MAINTENANCE = 'maintenance',
}

export enum Urgency {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
}

export interface RoomWork {
  id: string;
  type: WorkType;
  scope: 'total' | 'partial' | 'other';
  scopeDescription?: string; // Si scope === 'other'
  details: string; // "enduit + peinture", "changement revêtement", etc.
  materials?: string[]; // Matériaux spécifiés
  specificConstraints?: string; // Amiante, heritage, etc.
  createdAt: string;
}

export interface Room {
  id: string;
  projectId: string;
  name: string; // "Salon", "Cuisine", "Salle de bain"
  surface: number; // m²
  works: RoomWork[];
  createdAt: string;
}

export interface ProjectContext {
  id: string;
  userId: string;

  // Adresse (OBLIGATOIRE)
  address: string;
  coordinates?: {
    lat: number;
    lng: number;
  };
  region?: string;

  // Pièces et travaux
  rooms: Room[];

  // Infos générales
  projectType: ProjectType;
  budget?: number;
  squareMetersTotal: number;

  // Optionnel (alerte si skip)
  climateZone?: string; // RE2020 zone
  constructionYear?: number;
  timeline?: string;
  urgency?: Urgency;
  constraints?: string[]; // ["amiante", "heritage", etc]

  // Metadata
  createdAt: string;
  updatedAt: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export interface ProjectContextInput extends Omit<ProjectContext, 'id' | 'createdAt' | 'updatedAt' | 'rooms'> {
  rooms?: Room[];
}
