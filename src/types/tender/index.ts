/**
 * TORP Tender (Appels d'Offres) Types
 * Types pour la gestion des appels d'offres et réponses B2B
 */

// =============================================================================
// ENUMS & STATUS
// =============================================================================

export type TenderStatus =
  | 'draft'           // Brouillon
  | 'ready'           // Prêt à publier
  | 'published'       // Publié
  | 'closed'          // Fermé aux réponses
  | 'evaluation'      // En évaluation
  | 'attributed'      // Attribué
  | 'cancelled'       // Annulé
  | 'archived';       // Archivé

export type TenderVisibility =
  | 'private'         // Une seule entreprise
  | 'restricted'      // Liste d'entreprises
  | 'public';         // Ouvert à tous

export type TenderType =
  | 'simple'          // Consultation simple (particulier)
  | 'mapa'            // Marché à Procédure Adaptée
  | 'appel_offres'    // Appel d'offres ouvert
  | 'restreint';      // Appel d'offres restreint

export type ResponseStatus =
  | 'draft'           // Brouillon
  | 'submitted'       // Soumise
  | 'received'        // Reçue
  | 'under_review'    // En examen
  | 'shortlisted'     // Présélectionnée
  | 'selected'        // Retenue
  | 'rejected'        // Rejetée
  | 'withdrawn';      // Retirée

export type DCEDocumentType =
  | 'rc'              // Règlement de Consultation
  | 'cctp'            // CCTP
  | 'ccap'            // CCAP
  | 'dpgf'            // DPGF
  | 'bpu'             // BPU
  | 'planning'        // Planning
  | 'plans'           // Plans
  | 'annexe'          // Annexes
  | 'ae'              // Acte d'Engagement
  | 'other';

export type InvitationStatus =
  | 'pending'
  | 'sent'
  | 'viewed'
  | 'downloaded'
  | 'responded'
  | 'declined';

// =============================================================================
// TENDER (Appel d'Offres)
// =============================================================================

export interface Tender {
  id: string;
  phase0ProjectId?: string;
  userId: string;

  // Identification
  reference: string;
  title: string;
  description?: string;

  // Type et visibilité
  tenderType: TenderType;
  visibility: TenderVisibility;
  status: TenderStatus;

  // Dates clés
  publicationDate?: Date;
  questionsDeadline?: Date;
  responseDeadline?: Date;
  openingDate?: Date;
  attributionDate?: Date;

  // Localisation
  workAddress?: TenderAddress;
  workCity?: string;
  workPostalCode?: string;
  workDepartment?: string;
  workRegion?: string;

  // Informations projet
  projectType?: string;
  workCategories?: string[];
  selectedLots?: TenderLot[];
  lotsCount: number;

  // Budget
  estimatedBudgetMin?: number;
  estimatedBudgetMax?: number;
  budgetVisibility: 'hidden' | 'range' | 'exact';

  // Durée
  estimatedDurationDays?: number;
  desiredStartDate?: Date;
  desiredEndDate?: Date;

  // Documents DCE
  dceDocuments: TenderDocument[];
  dceGeneratedAt?: Date;
  dceVersion: number;

  // Critères d'évaluation
  evaluationCriteria: EvaluationCriterion[];

  // Exigences
  requirements: TenderRequirements;

  // Entreprises ciblées
  targetCompanies?: string[];
  invitedCount: number;

  // Statistiques
  viewsCount: number;
  downloadsCount: number;
  responsesCount: number;

  // Contact MOA
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;

  // Métadonnées
  metadata?: Record<string, unknown>;
  tags?: string[];

  // Timestamps
  createdAt: Date;
  updatedAt: Date;
  publishedAt?: Date;
  closedAt?: Date;
}

export interface TenderAddress {
  street?: string;
  complement?: string;
  city: string;
  postalCode: string;
  department?: string;
  region?: string;
  country?: string;
  coordinates?: {
    lat: number;
    lng: number;
  };
}

export interface TenderLot {
  lotType: string;
  lotNumber: string;
  lotName: string;
  category: string;
  description?: string;

  // Estimation
  estimatedPriceMin?: number;
  estimatedPriceMax?: number;
  estimatedDurationDays?: number;

  // Exigences spécifiques
  rgeRequired?: boolean;
  requiredQualifications?: string[];
  requiredCertifications?: string[];

  // DTU applicables
  applicableDTUs?: string[];

  // Prestations incluses
  prestations?: string[];
}

export interface EvaluationCriterion {
  name: string;
  weight: number;  // Pourcentage (total = 100)
  description?: string;
  subCriteria?: {
    name: string;
    weight: number;
    description?: string;
  }[];
}

export interface TenderRequirements {
  rgeRequired?: boolean;
  requiredQualifications?: string[];
  requiredCertifications?: string[];
  minYearsExperience?: number;
  minAnnualRevenue?: number;
  insuranceDecennaleRequired?: boolean;
  insuranceRcProRequired?: boolean;
  insuranceMinAmount?: number;
  localPreference?: boolean;
  maxDistanceKm?: number;
}

// =============================================================================
// TENDER DOCUMENT (Document DCE)
// =============================================================================

export interface TenderDocument {
  id: string;
  tenderId: string;
  documentType: DCEDocumentType;
  name: string;
  description?: string;
  version: number;

  // Fichier
  fileUrl?: string;
  fileName?: string;
  fileSize?: number;
  fileHash?: string;
  mimeType?: string;

  // Contenu généré
  generatedContent?: DocumentContent;
  isAutoGenerated: boolean;

  // Statut
  isRequired: boolean;
  isPublic: boolean;

  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}

export interface DocumentContent {
  sections: DocumentSection[];
  metadata?: Record<string, unknown>;
}

export interface DocumentSection {
  id: string;
  title: string;
  level: number;
  content: string;
  subsections?: DocumentSection[];
}

// =============================================================================
// TENDER INVITATION
// =============================================================================

export interface TenderInvitation {
  id: string;
  tenderId: string;

  // Entreprise
  companyId?: string;
  companySiret: string;
  companyName: string;
  companyEmail: string;

  // Statut
  status: InvitationStatus;
  sentAt?: Date;
  viewedAt?: Date;
  downloadedAt?: Date;
  respondedAt?: Date;
  declinedAt?: Date;
  declineReason?: string;

  // Token d'accès
  accessToken?: string;
  tokenExpiresAt?: Date;

  // Métadonnées
  metadata?: Record<string, unknown>;

  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}

// =============================================================================
// TENDER RESPONSE (Réponse entreprise)
// =============================================================================

export interface TenderResponse {
  id: string;
  tenderId: string;
  companyId?: string;
  userId?: string;
  companySiret: string;
  companyName: string;

  // Identification
  reference: string;
  status: ResponseStatus;

  // Offre financière
  totalAmountHT?: number;
  totalAmountTTC?: number;
  vatAmount?: number;
  vatRate: number;

  // Détail par lot
  lotsBreakdown: ResponseLotBreakdown[];

  // DPGF
  dpgfData?: DPGFData;
  dpgfFileUrl?: string;

  // Délais proposés
  proposedDurationDays?: number;
  proposedStartDate?: Date;
  proposedEndDate?: Date;

  // Mémoire technique
  technicalMemo?: TechnicalMemo;
  technicalMemoFileUrl?: string;

  // Documents joints
  responseDocuments: ResponseDocument[];

  // Qualifications
  qualifications?: CompanyQualifications;
  insuranceDocuments?: InsuranceDocument[];

  // Références
  projectReferences: ProjectReference[];

  // Équipe
  proposedTeam?: ProposedTeam;

  // Sous-traitance
  subcontracting?: SubcontractingInfo;

  // Variantes
  variants: ResponseVariant[];

  // Scoring TORP
  torpScore?: number;
  torpGrade?: string;
  scoringDetails?: ScoringDetails;

  // Évaluation MOA
  moaEvaluation?: MOAEvaluation;
  moaComments?: string;
  moaRanking?: number;

  // Analyse IA
  aiAnalysis?: AIResponseAnalysis;
  aiPositioningScore?: number;
  aiRecommendations?: AIRecommendation[];

  // Timestamps
  createdAt: Date;
  updatedAt: Date;
  submittedAt?: Date;
  receivedAt?: Date;
  evaluatedAt?: Date;
}

export interface ResponseLotBreakdown {
  lotType: string;
  lotNumber: string;
  lotName: string;

  // Montants
  amountHT: number;
  amountTTC?: number;
  vatRate?: number;

  // Durée
  durationDays?: number;

  // Détail
  details?: string;
  items?: DPGFItem[];
}

export interface DPGFData {
  lots: DPGFLot[];
  totalHT: number;
  totalTTC: number;
  vatBreakdown: {
    rate: number;
    baseAmount: number;
    vatAmount: number;
  }[];
}

export interface DPGFLot {
  lotNumber: string;
  lotName: string;
  items: DPGFItem[];
  totalHT: number;
}

export interface DPGFItem {
  reference?: string;
  designation: string;
  unit: string;
  quantity: number;
  unitPriceHT: number;
  totalHT: number;
  vatRate?: number;
  notes?: string;
}

export interface TechnicalMemo {
  // Présentation entreprise
  companyPresentation?: string;
  organizationChart?: string;

  // Moyens
  humanResources?: string;
  materialResources?: string;
  technicalCapabilities?: string;

  // Méthodologie
  methodology?: string;
  qualityApproach?: string;
  safetyPlan?: string;
  environmentalApproach?: string;

  // Planning détaillé
  detailedPlanning?: string;
  milestones?: TechnicalMilestone[];

  // Réponse technique par lot
  technicalResponseByLot?: Record<string, string>;

  // Points forts
  strengths?: string[];
  innovations?: string[];

  // Annexes techniques
  technicalAnnexes?: string[];
}

export interface TechnicalMilestone {
  name: string;
  description?: string;
  plannedDate?: Date;
  duration?: number;
  dependencies?: string[];
}

export interface ResponseDocument {
  id: string;
  type: string;  // attestation, reference, certification, insurance, other
  name: string;
  fileUrl: string;
  fileName: string;
  fileSize?: number;
  mimeType?: string;
  uploadedAt: Date;
}

export interface CompanyQualifications {
  rge?: {
    isRGE: boolean;
    domains?: string[];
    certificateNumber?: string;
    validUntil?: Date;
  };
  qualibat?: {
    hasQualibat: boolean;
    qualifications?: string[];
    certificateNumber?: string;
    validUntil?: Date;
  };
  otherCertifications?: {
    name: string;
    number?: string;
    validUntil?: Date;
  }[];
}

export interface InsuranceDocument {
  type: 'decennale' | 'rc_pro' | 'other';
  insurer: string;
  policyNumber?: string;
  coverageAmount?: number;
  validFrom?: Date;
  validUntil?: Date;
  fileUrl?: string;
}

export interface ProjectReference {
  projectName: string;
  clientName?: string;
  clientType?: 'particulier' | 'entreprise' | 'collectivite';
  location?: string;
  completionYear?: number;
  amount?: number;
  description?: string;
  lots?: string[];
  contactName?: string;
  contactPhone?: string;
  contactEmail?: string;
  photos?: string[];
}

export interface ProposedTeam {
  projectManager?: TeamMember;
  siteManager?: TeamMember;
  technicians?: TeamMember[];
  totalHeadcount?: number;
  subcontractors?: string[];
}

export interface TeamMember {
  name: string;
  role: string;
  experience?: string;
  qualifications?: string[];
  availability?: string;
}

export interface SubcontractingInfo {
  planned: boolean;
  percentage?: number;
  companies?: {
    name: string;
    siret?: string;
    lots?: string[];
    percentage?: number;
  }[];
  justification?: string;
}

export interface ResponseVariant {
  id: string;
  name: string;
  description: string;
  priceDifferenceHT?: number;
  durationDifference?: number;
  advantages?: string[];
  technicalDetails?: string;
}

// =============================================================================
// SCORING & EVALUATION
// =============================================================================

export interface ScoringDetails {
  totalScore: number;
  maxScore: number;
  grade: string;
  criteriaScores: {
    criterion: string;
    score: number;
    maxScore: number;
    weight: number;
    weightedScore: number;
    details?: string;
  }[];
  strengths: string[];
  weaknesses: string[];
  recommendations: string[];
}

export interface MOAEvaluation {
  criteriaScores: {
    criterion: string;
    score: number;  // 0-100
    comments?: string;
  }[];
  totalScore: number;
  ranking: number;
  recommendation: 'select' | 'shortlist' | 'reject' | 'pending';
  evaluatedBy?: string;
  evaluatedAt?: Date;
}

// =============================================================================
// AI ANALYSIS
// =============================================================================

export interface AIResponseAnalysis {
  // Analyse globale
  overallAssessment: string;
  confidenceScore: number;

  // Points forts / faibles
  strengths: string[];
  weaknesses: string[];
  risks: string[];
  opportunities: string[];

  // Analyse prix
  priceAnalysis: {
    marketComparison: 'below' | 'average' | 'above';
    coherence: 'coherent' | 'suspicious' | 'needs_review';
    details: string;
  };

  // Analyse technique
  technicalAnalysis: {
    adequacy: 'excellent' | 'good' | 'acceptable' | 'insufficient';
    details: string;
  };

  // Conformité
  complianceAnalysis: {
    isCompliant: boolean;
    missingElements: string[];
    warnings: string[];
  };

  // Score de positionnement
  positioningScore: number;  // 0-100 (chances de remporter)
  positioningDetails: string;
}

export interface AIRecommendation {
  type: 'improvement' | 'warning' | 'opportunity' | 'compliance';
  priority: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  action?: string;
  impact?: string;
}

// =============================================================================
// TENDER QUESTION
// =============================================================================

export interface TenderQuestion {
  id: string;
  tenderId: string;
  companyId?: string;
  companyName?: string;
  isAnonymous: boolean;

  question: string;
  questionCategory?: string;

  answer?: string;
  answeredBy?: string;
  answeredAt?: Date;

  isPublic: boolean;

  createdAt: Date;
  updatedAt: Date;
}

// =============================================================================
// KNOWLEDGE UPLOAD
// =============================================================================

export interface KnowledgeUpload {
  id: string;
  userId?: string;

  // Fichier
  originalFilename: string;
  fileUrl: string;
  fileSize: number;
  mimeType: string;
  fileHash?: string;

  // Classification
  docType: 'dtu' | 'norme' | 'guide' | 'fiche_technique' | 'reglementation' | 'autre';
  category?: string;
  subcategory?: string;

  // Métadonnées extraites
  extractedTitle?: string;
  extractedAuthor?: string;
  extractedDate?: Date;
  codeReference?: string;

  // Traitement
  status: 'pending' | 'processing' | 'indexed' | 'error';
  processingStartedAt?: Date;
  processingCompletedAt?: Date;
  processingError?: string;

  // Résultats
  pagesCount?: number;
  chunksCount?: number;
  documentId?: string;

  // OCR
  ocrConfidence?: number;
  requiresOcr: boolean;

  // Validation
  isValidated: boolean;
  validatedBy?: string;
  validatedAt?: Date;

  // Métadonnées
  metadata?: Record<string, unknown>;

  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}

// =============================================================================
// COMPANY SPECIALIZATION
// =============================================================================

export interface CompanySpecialization {
  id: string;
  companyId: string;

  // Spécialisation
  lotType: string;
  lotCategory?: string;

  // Expertise
  expertiseLevel: 'junior' | 'standard' | 'expert' | 'specialist';
  yearsExperience?: number;

  // Certifications
  certifications?: string[];
  rgeDomains?: string[];

  // Zone d'intervention
  interventionRadiusKm: number;
  interventionDepartments?: string[];

  // Capacité
  canLeadLot: boolean;
  canSubcontract: boolean;
  maxProjectSize?: number;

  // Références
  completedProjectsCount: number;
  averageRating?: number;

  isActive: boolean;

  createdAt: Date;
  updatedAt: Date;
}

// =============================================================================
// ACTIONS & PAYLOADS
// =============================================================================

export interface CreateTenderPayload {
  phase0ProjectId?: string;
  title: string;
  description?: string;
  tenderType?: TenderType;
  visibility?: TenderVisibility;
  workAddress?: TenderAddress;
  selectedLots?: TenderLot[];
  evaluationCriteria?: EvaluationCriterion[];
  requirements?: TenderRequirements;
  responseDeadline?: Date;
  desiredStartDate?: Date;
}

export interface PublishTenderPayload {
  tenderId: string;
  targetCompanies?: string[];  // Pour private/restricted
  responseDeadline: Date;
  questionsDeadline?: Date;
}

export interface CreateResponsePayload {
  tenderId: string;
  companySiret: string;
  companyName: string;
}

export interface SubmitResponsePayload {
  responseId: string;
  totalAmountHT: number;
  lotsBreakdown: ResponseLotBreakdown[];
  proposedDurationDays?: number;
  proposedStartDate?: Date;
  technicalMemo?: TechnicalMemo;
  projectReferences?: ProjectReference[];
}

// =============================================================================
// FILTERS & LISTS
// =============================================================================

export interface TenderFilter {
  status?: TenderStatus[];
  visibility?: TenderVisibility[];
  tenderType?: TenderType[];
  department?: string[];
  region?: string[];
  workCategories?: string[];
  budgetMin?: number;
  budgetMax?: number;
  deadlineAfter?: Date;
  deadlineBefore?: Date;
  searchQuery?: string;
}

export interface TenderListItem {
  id: string;
  reference: string;
  title: string;
  status: TenderStatus;
  visibility: TenderVisibility;
  workCity?: string;
  workPostalCode?: string;
  lotsCount: number;
  estimatedBudgetMin?: number;
  estimatedBudgetMax?: number;
  responseDeadline?: Date;
  responsesCount: number;
  createdAt: Date;
}

export interface ResponseFilter {
  status?: ResponseStatus[];
  tenderId?: string;
  companyId?: string;
  scoreMin?: number;
  scoreMax?: number;
  submittedAfter?: Date;
  submittedBefore?: Date;
}

export interface ResponseListItem {
  id: string;
  reference: string;
  tenderId: string;
  tenderTitle: string;
  companyName: string;
  status: ResponseStatus;
  totalAmountHT?: number;
  torpScore?: number;
  torpGrade?: string;
  moaRanking?: number;
  submittedAt?: Date;
}
