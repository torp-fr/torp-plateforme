/**
 * TORP Phase 0 - Types du Projet Phase 0
 * Structure globale d'un projet Phase 0
 */

import type { TORPMetadata, Phase0Alert, DocumentReference } from './common.types';
import type { MasterOwnerProfile } from './owner.types';
import type { Property } from './property.types';
import type { WorkProject } from './work-project.types';
import type { WorkLot } from './lots.types';
import type { WizardState, WizardMode } from './wizard.types';
import type { DeductionResult } from './deduction.types';

// =============================================================================
// PROJET PHASE 0 PRINCIPAL
// =============================================================================

export interface Phase0Project {
  id: string;
  userId: string;

  // Données métier
  ownerProfile: MasterOwnerProfile;
  /** @deprecated Use ownerProfile instead - kept for backwards compatibility */
  owner?: MasterOwnerProfile;
  property: Property;
  workProject: WorkProject;
  selectedLots: WorkLot[];

  // Room details (pièces et travaux)
  roomDetails?: import('./room-details.types').RoomDetailsData;

  // B2B: Données client/MOA (pour les professionnels)
  client?: Record<string, unknown>;

  // État du projet
  status: Phase0Status;
  completeness: Phase0Completeness;
  validation: Phase0Validation;

  // Wizard
  wizardState: WizardState;
  wizardMode: WizardMode;

  // Déductions IA
  deductions: DeductionResult[];

  // Documents générés
  generatedDocuments: GeneratedDocument[];

  // Alertes
  alerts: Phase0Alert[];

  // Métadonnées
  torpMetadata: TORPMetadata;
}

// =============================================================================
// STATUTS
// =============================================================================

export type Phase0Status =
  | 'draft'                 // Brouillon
  | 'in_progress'           // En cours de saisie
  | 'awaiting_validation'   // En attente de validation
  | 'validated'             // Validé
  | 'consultation_ready'    // Prêt pour consultation
  | 'in_consultation'       // En consultation
  | 'quotes_received'       // Devis reçus
  | 'archived';             // Archivé

export const PHASE0_STATUS_CONFIG: Record<Phase0Status, StatusConfig> = {
  draft: {
    label: 'Brouillon',
    description: 'Projet en cours de création',
    color: 'gray',
    icon: 'file',
    allowedTransitions: ['in_progress'],
  },
  in_progress: {
    label: 'En cours',
    description: 'Saisie des informations en cours',
    color: 'blue',
    icon: 'edit',
    allowedTransitions: ['draft', 'awaiting_validation'],
  },
  awaiting_validation: {
    label: 'À valider',
    description: 'En attente de validation par le propriétaire',
    color: 'yellow',
    icon: 'clock',
    allowedTransitions: ['in_progress', 'validated'],
  },
  validated: {
    label: 'Validé',
    description: 'Projet validé, prêt pour génération documents',
    color: 'green',
    icon: 'check',
    allowedTransitions: ['consultation_ready', 'in_progress'],
  },
  consultation_ready: {
    label: 'Prêt consultation',
    description: 'Documents générés, prêt pour envoi aux entreprises',
    color: 'purple',
    icon: 'send',
    allowedTransitions: ['in_consultation', 'validated'],
  },
  in_consultation: {
    label: 'En consultation',
    description: 'Envoyé aux entreprises, en attente de devis',
    color: 'orange',
    icon: 'mail',
    allowedTransitions: ['quotes_received', 'consultation_ready'],
  },
  quotes_received: {
    label: 'Devis reçus',
    description: 'Des devis ont été reçus',
    color: 'teal',
    icon: 'inbox',
    allowedTransitions: ['archived', 'in_consultation'],
  },
  archived: {
    label: 'Archivé',
    description: 'Projet archivé',
    color: 'gray',
    icon: 'archive',
    allowedTransitions: [],
  },
};

export interface StatusConfig {
  label: string;
  description: string;
  color: string;
  icon: string;
  allowedTransitions: Phase0Status[];
}

// =============================================================================
// COMPLÉTUDE
// =============================================================================

export interface Phase0Completeness {
  overall: number;                    // 0-100
  bySection: SectionCompleteness[];
  missingRequired: MissingField[];
  suggestedImprovements: Improvement[];
  lastCalculated: string;
}

export interface SectionCompleteness {
  sectionId: string;
  sectionName: string;
  completeness: number;
  answeredQuestions: number;
  totalQuestions: number;
  requiredMissing: number;
  optionalMissing: number;
}

export interface MissingField {
  fieldPath: string;
  fieldName: string;
  section: string;
  required: boolean;
  impact: 'blocking' | 'warning' | 'info';
  suggestion?: string;
}

export interface Improvement {
  type: ImprovementType;
  fieldPath: string;
  description: string;
  benefit: string;
  effort: 'low' | 'medium' | 'high';
}

export type ImprovementType =
  | 'add_photo'
  | 'add_document'
  | 'complete_details'
  | 'verify_data'
  | 'add_specification';

// =============================================================================
// VALIDATION
// =============================================================================

export interface Phase0Validation {
  isValid: boolean;
  validatedAt?: string;
  validatedBy?: string;
  validationMethod: ValidationMethod;
  checks: ValidationCheck[];
  score: ValidationScore;
}

export type ValidationMethod =
  | 'auto'            // Validation automatique
  | 'user'            // Validation utilisateur
  | 'professional'    // Validation par professionnel
  | 'mixed';          // Mixte

export interface ValidationCheck {
  id: string;
  name: string;
  category: ValidationCategory;
  status: CheckStatus;
  message?: string;
  details?: Record<string, unknown>;
  fixable: boolean;
  fixAction?: string;
}

export type ValidationCategory =
  | 'completeness'
  | 'consistency'
  | 'regulatory'
  | 'technical'
  | 'financial';

export type CheckStatus =
  | 'passed'
  | 'warning'
  | 'failed'
  | 'skipped'
  | 'pending';

export interface ValidationScore {
  total: number;           // 0-100
  byCategory: Record<ValidationCategory, number>;
  grade: ValidationGrade;
}

export type ValidationGrade = 'A' | 'B' | 'C' | 'D' | 'F';

// =============================================================================
// DOCUMENTS GÉNÉRÉS
// =============================================================================

export interface GeneratedDocument {
  id: string;
  type: GeneratedDocumentType;
  name: string;
  description: string;
  status: DocumentGenerationStatus;
  version: number;
  format: DocumentFormat;
  fileUrl?: string;
  fileSize?: number;
  generatedAt?: string;
  expiresAt?: string;
  metadata: DocumentMetadata;
}

export type GeneratedDocumentType =
  | 'ccf'               // Cahier des Charges Fonctionnel
  | 'aps'               // Avant-Projet Sommaire
  | 'cctp'              // Cahier des Clauses Techniques Particulières
  | 'dpgf'              // Décomposition du Prix Global Forfaitaire
  | 'planning'          // Planning prévisionnel
  | 'budget_summary'    // Synthèse budgétaire
  | 'aid_simulation'    // Simulation aides
  | 'risk_report'       // Rapport risques
  | 'project_summary';  // Résumé projet

export type DocumentGenerationStatus =
  | 'pending'
  | 'generating'
  | 'ready'
  | 'failed'
  | 'expired';

export type DocumentFormat =
  | 'pdf'
  | 'docx'
  | 'xlsx'
  | 'html'
  | 'json';

export interface DocumentMetadata {
  template: string;
  templateVersion: string;
  dataVersion: number;
  customizations?: Record<string, unknown>;
  sections?: string[];
  pageCount?: number;
}

// =============================================================================
// RÉSUMÉ PROJET
// =============================================================================

export interface Phase0Summary {
  projectId: string;
  projectName: string;
  status: Phase0Status;
  completeness: number;

  // Informations clés
  ownerType: 'B2C' | 'B2B' | 'B2G';
  ownerName: string;
  propertyType: string;
  propertyAddress: string;
  projectType: string;

  // Chiffres clés
  estimatedBudget: {
    min: number;
    max: number;
    currency: string;
  };
  selectedLotsCount: number;
  eligibleAids: {
    count: number;
    totalEstimated: number;
  };
  estimatedDuration: {
    minDays: number;
    maxDays: number;
  };

  // Documents
  documentsGenerated: number;
  ccfReady: boolean;

  // Dates
  createdAt: string;
  updatedAt: string;
  targetStartDate?: string;
}

// =============================================================================
// ACTIONS PROJET
// =============================================================================

export type Phase0Action =
  | { type: 'CREATE_PROJECT'; payload: CreateProjectPayload }
  | { type: 'UPDATE_PROJECT'; payload: UpdateProjectPayload }
  | { type: 'CHANGE_STATUS'; payload: ChangeStatusPayload }
  | { type: 'VALIDATE_PROJECT'; payload: ValidateProjectPayload }
  | { type: 'GENERATE_DOCUMENT'; payload: GenerateDocumentPayload }
  | { type: 'ARCHIVE_PROJECT'; payload: ArchiveProjectPayload }
  | { type: 'DUPLICATE_PROJECT'; payload: DuplicateProjectPayload };

export interface CreateProjectPayload {
  userId: string;
  wizardMode: WizardMode;
  initialData?: Partial<Phase0Project>;
}

export interface UpdateProjectPayload {
  projectId: string;
  updates: Partial<Phase0Project>;
  source: 'wizard' | 'api' | 'deduction';
}

export interface ChangeStatusPayload {
  projectId: string;
  newStatus: Phase0Status;
  reason?: string;
}

export interface ValidateProjectPayload {
  projectId: string;
  validationMethod: ValidationMethod;
  validatedBy?: string;
}

export interface GenerateDocumentPayload {
  projectId: string;
  documentType: GeneratedDocumentType;
  format: DocumentFormat;
  options?: Record<string, unknown>;
}

export interface ArchiveProjectPayload {
  projectId: string;
  reason?: string;
}

export interface DuplicateProjectPayload {
  sourceProjectId: string;
  newName: string;
  includeLots: boolean;
  includeDocuments: boolean;
}

// =============================================================================
// FILTRES ET RECHERCHE
// =============================================================================

export interface Phase0ProjectFilter {
  status?: Phase0Status[];
  ownerType?: ('B2C' | 'B2B' | 'B2G')[];
  projectType?: string[];
  completenessMin?: number;
  completenessMax?: number;
  budgetMin?: number;
  budgetMax?: number;
  createdAfter?: string;
  createdBefore?: string;
  searchQuery?: string;
  sortBy?: Phase0SortField;
  sortOrder?: 'asc' | 'desc';
  page?: number;
  pageSize?: number;
}

export type Phase0SortField =
  | 'createdAt'
  | 'updatedAt'
  | 'completeness'
  | 'status'
  | 'budget'
  | 'ownerName';

export interface Phase0ProjectList {
  items: Phase0Summary[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}
