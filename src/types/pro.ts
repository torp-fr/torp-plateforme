/**
 * TORP B2B - Types TypeScript pour le module Pro
 *
 * Ce fichier contient tous les types et interfaces pour le module B2B professionnel
 */

// =====================================================
// ENUMS
// =====================================================

export enum CompanyDocType {
  KBIS = 'KBIS',
  ATTESTATION_URSSAF = 'ATTESTATION_URSSAF',
  ATTESTATION_VIGILANCE = 'ATTESTATION_VIGILANCE',
  ASSURANCE_DECENNALE = 'ASSURANCE_DECENNALE',
  ASSURANCE_RC_PRO = 'ASSURANCE_RC_PRO',
  CERTIFICATION_QUALIBAT = 'CERTIFICATION_QUALIBAT',
  CERTIFICATION_RGE = 'CERTIFICATION_RGE',
  CERTIFICATION_QUALIFELEC = 'CERTIFICATION_QUALIFELEC',
  CERTIFICATION_QUALIPAC = 'CERTIFICATION_QUALIPAC',
  LABEL_AUTRE = 'LABEL_AUTRE',
  AUTRE = 'AUTRE',
}

export enum DocStatus {
  PENDING = 'PENDING',
  VALID = 'VALID',
  EXPIRING = 'EXPIRING',
  EXPIRED = 'EXPIRED',
  INVALID = 'INVALID',
}

export enum AnalysisStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
}

export enum TicketEventType {
  QR_SCANNED = 'qr_scanned',
  LINK_VIEWED = 'link_viewed',
  PDF_DOWNLOADED = 'pdf_downloaded',
}

export enum RecommendationPriority {
  HIGH = 'high',
  MEDIUM = 'medium',
  LOW = 'low',
}

export enum RecommendationDifficulty {
  EASY = 'easy',
  MEDIUM = 'medium',
  HARD = 'hard',
}

export enum PointBloquantSeverity {
  CRITICAL = 'critical',
  WARNING = 'warning',
  INFO = 'info',
}

// =====================================================
// COMPANY PROFILE
// =====================================================

/**
 * Profil entreprise lié à un utilisateur B2B
 */
export interface CompanyProfile {
  id: string;
  user_id: string;

  // Identité entreprise
  siret: string;
  siren: string;
  raison_sociale: string;
  forme_juridique?: string; // SARL, SAS, EI, Auto-entrepreneur
  code_naf?: string;
  adresse?: string;
  code_postal?: string;
  ville?: string;
  telephone?: string;
  email?: string;
  site_web?: string;

  // Données vérifiées
  date_creation?: string;
  capital_social?: number;
  effectif?: string; // Tranche effectif
  dirigeant_nom?: string;

  // Statut vérification
  siret_verifie: boolean;
  siret_verifie_le?: string;

  // Métadonnées
  metadata?: Record<string, any>;

  // Timestamps
  created_at: string;
  updated_at: string;
}

/**
 * Données pour créer un profil entreprise
 */
export interface CreateCompanyProfileData {
  siret: string;
  siren: string;
  raison_sociale: string;
  forme_juridique?: string;
  code_naf?: string;
  adresse?: string;
  code_postal?: string;
  ville?: string;
  telephone?: string;
  email?: string;
  site_web?: string;
  date_creation?: string;
  capital_social?: number;
  effectif?: string;
  dirigeant_nom?: string;
}

/**
 * Réponse de vérification SIRET
 */
export interface VerifySiretResponse {
  valid: boolean;
  data?: {
    siren: string;
    siret: string;
    raison_sociale: string;
    forme_juridique?: string;
    code_naf?: string;
    adresse?: string;
    code_postal?: string;
    ville?: string;
    date_creation?: string;
    capital_social?: number;
    effectif?: string;
    dirigeant_nom?: string;
  };
  error?: string;
}

// =====================================================
// COMPANY DOCUMENTS
// =====================================================

/**
 * Document de l'entreprise (Kbis, assurances, certifications)
 */
export interface CompanyDocument {
  id: string;
  company_id: string;
  type: CompanyDocType;
  nom: string;
  file_url: string;
  file_name: string;
  file_size?: number;
  mime_type?: string;
  date_emission?: string;
  date_expiration?: string;
  numero_document?: string;
  emetteur?: string; // Ex: "AXA", "URSSAF", "Qualibat"
  statut: DocStatus;
  date_verification?: string;
  verification_notes?: string;
  metadata?: Record<string, any>;
  uploaded_at: string;
}

/**
 * Données pour upload d'un document
 */
export interface UploadDocumentData {
  company_id: string;
  type: CompanyDocType;
  nom: string;
  file: File;
  date_emission?: string;
  date_expiration?: string;
  numero_document?: string;
  emetteur?: string;
}

// =====================================================
// PRO DEVIS ANALYSIS
// =====================================================

/**
 * Détail des scores par axe TORP
 */
export interface ScoreDetails {
  transparence: number; // 0-250
  offre: number; // 0-250
  robustesse: number; // 0-250
  prix: number; // 0-250
}

/**
 * Recommandation d'amélioration du devis
 */
export interface Recommendation {
  type: 'transparence' | 'offre' | 'robustesse' | 'prix';
  message: string;
  impact: string; // Ex: "+30pts", "+0.3"
  priority: RecommendationPriority;
  difficulty: RecommendationDifficulty;
  example?: string; // Exemple de formulation
}

/**
 * Point bloquant identifié dans le devis
 */
export interface PointBloquant {
  type: 'conformite' | 'legal' | 'financial' | 'technical';
  message: string;
  severity: PointBloquantSeverity;
  details?: string;
}

/**
 * Analyse complète d'un devis professionnel
 */
export interface ProDevisAnalysis {
  id: string;
  company_id: string;
  user_id: string;

  // Identification devis
  reference_devis: string;
  nom_projet?: string;
  montant_ht?: number;
  montant_ttc?: number;

  // Fichier devis
  file_url: string;
  file_name: string;
  file_size?: number;
  mime_type?: string;

  // Résultats analyse
  status: AnalysisStatus;
  score_total?: number; // 0-1000
  grade?: string; // A+, A, A-, B+, B, B-, C+, C, C-, D, F

  // Détail scores
  score_details?: ScoreDetails;

  // Recommandations et points bloquants
  recommandations?: Recommendation[];
  points_bloquants?: PointBloquant[];

  // Données extraites (OCR)
  extracted_data?: Record<string, any>;

  // Versioning
  version: number;
  parent_analysis_id?: string;

  // Ticket TORP
  ticket_genere: boolean;
  ticket_url?: string;
  ticket_code?: string; // Ex: TORP-ABC123XY
  ticket_generated_at?: string;
  ticket_view_count: number;
  ticket_last_viewed_at?: string;

  // Métadonnées
  metadata?: Record<string, any>;

  // Timestamps
  created_at: string;
  analyzed_at?: string;
  updated_at: string;
}

/**
 * Données pour créer une nouvelle analyse
 */
export interface CreateAnalysisData {
  company_id: string;
  reference_devis: string;
  nom_projet?: string;
  montant_ht?: number;
  montant_ttc?: number;
  file: File;
}

/**
 * Filtres pour la liste des analyses
 */
export interface AnalysisFilters {
  status?: AnalysisStatus;
  grade?: string;
  dateFrom?: string;
  dateTo?: string;
  search?: string; // Recherche dans référence ou nom projet
}

// =====================================================
// TICKET TRACKING
// =====================================================

/**
 * Événement de tracking d'un ticket TORP
 */
export interface TicketTrackingEvent {
  id: string;
  analysis_id: string;
  event_type: TicketEventType;
  ip_address?: string;
  user_agent?: string;
  referer?: string;
  country?: string;
  city?: string;
  metadata?: Record<string, any>;
  created_at: string;
}

/**
 * Données pour créer un événement de tracking
 */
export interface CreateTrackingEventData {
  ticket_code: string;
  event_type: TicketEventType;
  metadata?: Record<string, any>;
}

// =====================================================
// TICKET GENERATION
// =====================================================

/**
 * Résultat de la génération d'un ticket TORP
 */
export interface TicketGenerationResult {
  ticket_url: string; // URL du PDF du ticket
  ticket_code: string; // Code unique (ex: TORP-ABC123XY)
  qr_code_url: string; // URL de l'image du QR code
  public_url: string; // URL publique pour consultation (/t/:code)
}

/**
 * Options de personnalisation du ticket
 */
export interface TicketCustomizationOptions {
  format?: 'pdf' | 'png' | 'svg';
  size?: 'small' | 'medium' | 'large';
  color_scheme?: 'default' | 'blue' | 'green';
  include_qr_code?: boolean;
  include_score?: boolean;
}

// =====================================================
// DASHBOARD STATS
// =====================================================

/**
 * Statistiques du dashboard professionnel
 */
export interface ProDashboardStats {
  total_analyses: number;
  analyses_completed: number;
  analyses_pending: number;
  average_score: number;
  average_grade: string;
  tickets_generated: number;
  tickets_total_views: number;
  documents_count: number;
  documents_expiring_count: number;
  score_evolution: {
    date: string;
    score: number;
  }[];
  grade_distribution: {
    grade: string;
    count: number;
  }[];
}

// =====================================================
// UTILITY TYPES
// =====================================================

/**
 * Grade TORP avec couleur et description
 */
export interface GradeInfo {
  grade: string;
  label: string;
  color: string;
  bgColor: string;
  textColor: string;
  description: string;
  score_min: number;
  score_max: number;
}

/**
 * Mapping des grades TORP
 */
export const GRADE_INFO: Record<string, GradeInfo> = {
  'A+': {
    grade: 'A+',
    label: 'Excellent',
    color: 'green',
    bgColor: 'bg-green-100',
    textColor: 'text-green-800',
    description: 'Devis exemplaire',
    score_min: 950,
    score_max: 1000,
  },
  A: {
    grade: 'A',
    label: 'Très bon',
    color: 'green',
    bgColor: 'bg-green-100',
    textColor: 'text-green-700',
    description: 'Devis de grande qualité',
    score_min: 900,
    score_max: 949,
  },
  'A-': {
    grade: 'A-',
    label: 'Bon',
    color: 'green',
    bgColor: 'bg-green-50',
    textColor: 'text-green-600',
    description: 'Bon devis',
    score_min: 850,
    score_max: 899,
  },
  'B+': {
    grade: 'B+',
    label: 'Satisfaisant',
    color: 'blue',
    bgColor: 'bg-blue-100',
    textColor: 'text-blue-700',
    description: 'Devis correct',
    score_min: 800,
    score_max: 849,
  },
  B: {
    grade: 'B',
    label: 'Moyen',
    color: 'blue',
    bgColor: 'bg-blue-50',
    textColor: 'text-blue-600',
    description: 'Devis acceptable',
    score_min: 750,
    score_max: 799,
  },
  'B-': {
    grade: 'B-',
    label: 'Passable',
    color: 'yellow',
    bgColor: 'bg-yellow-100',
    textColor: 'text-yellow-700',
    description: 'Devis à améliorer',
    score_min: 700,
    score_max: 749,
  },
  'C+': {
    grade: 'C+',
    label: 'Insuffisant',
    color: 'yellow',
    bgColor: 'bg-yellow-50',
    textColor: 'text-yellow-600',
    description: 'Améliorations nécessaires',
    score_min: 650,
    score_max: 699,
  },
  C: {
    grade: 'C',
    label: 'Faible',
    color: 'orange',
    bgColor: 'bg-orange-100',
    textColor: 'text-orange-700',
    description: 'Devis incomplet',
    score_min: 600,
    score_max: 649,
  },
  'C-': {
    grade: 'C-',
    label: 'Très faible',
    color: 'orange',
    bgColor: 'bg-orange-50',
    textColor: 'text-orange-600',
    description: 'Devis peu fiable',
    score_min: 550,
    score_max: 599,
  },
  D: {
    grade: 'D',
    label: 'Médiocre',
    color: 'red',
    bgColor: 'bg-red-100',
    textColor: 'text-red-700',
    description: 'Devis problématique',
    score_min: 500,
    score_max: 549,
  },
  F: {
    grade: 'F',
    label: 'Inacceptable',
    color: 'red',
    bgColor: 'bg-red-200',
    textColor: 'text-red-800',
    description: 'Devis non conforme',
    score_min: 0,
    score_max: 499,
  },
};

/**
 * Labels des types de documents
 */
export const DOCUMENT_TYPE_LABELS: Record<CompanyDocType, string> = {
  [CompanyDocType.KBIS]: 'Extrait Kbis',
  [CompanyDocType.ATTESTATION_URSSAF]: 'Attestation URSSAF',
  [CompanyDocType.ATTESTATION_VIGILANCE]: 'Attestation de vigilance',
  [CompanyDocType.ASSURANCE_DECENNALE]: 'Assurance décennale',
  [CompanyDocType.ASSURANCE_RC_PRO]: 'Assurance RC Pro',
  [CompanyDocType.CERTIFICATION_QUALIBAT]: 'Certification Qualibat',
  [CompanyDocType.CERTIFICATION_RGE]: 'Certification RGE',
  [CompanyDocType.CERTIFICATION_QUALIFELEC]: 'Certification Qualifelec',
  [CompanyDocType.CERTIFICATION_QUALIPAC]: 'Certification Qualipac',
  [CompanyDocType.LABEL_AUTRE]: 'Autre label/certification',
  [CompanyDocType.AUTRE]: 'Autre document',
};

/**
 * Labels des statuts de documents
 */
export const DOCUMENT_STATUS_LABELS: Record<DocStatus, string> = {
  [DocStatus.PENDING]: 'En attente de vérification',
  [DocStatus.VALID]: 'Valide',
  [DocStatus.EXPIRING]: 'Expire bientôt',
  [DocStatus.EXPIRED]: 'Expiré',
  [DocStatus.INVALID]: 'Non valide',
};

/**
 * Labels des statuts d'analyse
 */
export const ANALYSIS_STATUS_LABELS: Record<AnalysisStatus, string> = {
  [AnalysisStatus.PENDING]: 'En attente',
  [AnalysisStatus.PROCESSING]: 'En cours d\'analyse',
  [AnalysisStatus.COMPLETED]: 'Terminée',
  [AnalysisStatus.FAILED]: 'Échec',
};
