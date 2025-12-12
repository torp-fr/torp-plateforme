/**
 * TORP Phase 0 - Types communs et utilitaires
 * Ces types sont partagés entre les différents modules Phase 0
 */

// =============================================================================
// MÉTADONNÉES TORP
// =============================================================================

export interface TORPMetadata {
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  version: number;
  source: DataSource;
  completeness: number; // 0-100%
  validatedAt?: string;
  validatedBy?: string;
  aiEnriched: boolean;
  lastAiEnrichmentAt?: string;
}

export type DataSource =
  | 'user_input'
  | 'ai_deduction'
  | 'api_external'
  | 'document_extraction'
  | 'historical_data';

// =============================================================================
// INFORMATIONS DE CONTACT
// =============================================================================

export interface ContactInfo {
  email: string;
  phone?: string;
  mobilePhone?: string;
  preferredContact: 'email' | 'phone' | 'sms' | 'whatsapp';
  availableHours?: AvailableHours;
}

export interface AvailableHours {
  monday?: TimeSlot[];
  tuesday?: TimeSlot[];
  wednesday?: TimeSlot[];
  thursday?: TimeSlot[];
  friday?: TimeSlot[];
  saturday?: TimeSlot[];
  sunday?: TimeSlot[];
}

export interface TimeSlot {
  start: string; // HH:mm
  end: string;   // HH:mm
}

// =============================================================================
// ADRESSE ET GÉOLOCALISATION
// =============================================================================

export interface Address {
  streetNumber?: string;
  streetName: string;
  streetType?: StreetType;
  complement?: string;
  postalCode: string;
  city: string;
  department?: string;
  departmentCode?: string;
  region?: string;
  country: string;
  formattedAddress?: string;
  coordinates?: Coordinates;
  banId?: string; // ID Base Adresse Nationale
  cadastralReference?: CadastralReference;
}

export type StreetType =
  | 'rue' | 'avenue' | 'boulevard' | 'place' | 'impasse' | 'chemin'
  | 'route' | 'allée' | 'passage' | 'square' | 'cours' | 'quai' | 'other';

export interface Coordinates {
  latitude: number;
  longitude: number;
  accuracy?: number; // en mètres
  source?: 'ban' | 'google' | 'user' | 'cadastre';
}

export interface CadastralReference {
  section: string;
  parcel: string;
  prefix?: string;
  commune?: string;
  surface?: number; // m²
}

// =============================================================================
// DOCUMENTS ET FICHIERS
// =============================================================================

export interface DocumentReference {
  id: string;
  type: DocumentType;
  name: string;
  fileName: string;
  fileUrl: string;
  fileSize: number;
  mimeType: string;
  uploadedAt: string;
  uploadedBy: string;
  expirationDate?: string;
  verified: boolean;
  verifiedAt?: string;
  aiAnalyzed?: boolean;
  aiAnalysisResult?: Record<string, unknown>;
}

export type DocumentType =
  // Documents légaux
  | 'title_deed'           // Titre de propriété
  | 'tax_notice'           // Avis d'imposition
  | 'identity_document'    // Pièce d'identité
  // Documents techniques
  | 'dpe'                  // Diagnostic de Performance Énergétique
  | 'asbestos_diagnosis'   // Diagnostic amiante
  | 'lead_diagnosis'       // Diagnostic plomb
  | 'electrical_diagnosis' // Diagnostic électricité
  | 'gas_diagnosis'        // Diagnostic gaz
  | 'termite_diagnosis'    // Diagnostic termites
  | 'erp'                  // État des Risques et Pollutions
  | 'carrez_certificate'   // Attestation loi Carrez
  // Plans et photos
  | 'floor_plan'           // Plans
  | 'photo'                // Photos
  | 'facade_photo'         // Photo façade
  | 'technical_drawing'    // Dessin technique
  // Documents administratifs
  | 'building_permit'      // Permis de construire
  | 'planning_certificate' // Certificat d'urbanisme
  | 'plu_extract'          // Extrait PLU
  | 'cadastral_plan'       // Plan cadastral
  // Documents projet
  | 'quote'                // Devis
  | 'contract'             // Contrat
  | 'specification'        // Cahier des charges
  | 'cctp'                 // CCTP
  | 'other';

// =============================================================================
// ÉNUMÉRATIONS COMMUNES
// =============================================================================

export type ConfidenceLevel = 'high' | 'medium' | 'low' | 'unknown';

export type Priority = 'critical' | 'high' | 'medium' | 'low';

export type ValidationStatus =
  | 'pending'
  | 'validated'
  | 'rejected'
  | 'requires_info';

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  suggestions: ValidationSuggestion[];
}

export interface ValidationError {
  field: string;
  code: string;
  message: string;
  severity: 'error' | 'blocking';
}

export interface ValidationWarning {
  field: string;
  code: string;
  message: string;
  recommendation?: string;
}

export interface ValidationSuggestion {
  field: string;
  message: string;
  suggestedValue?: unknown;
  confidence: ConfidenceLevel;
}

// =============================================================================
// ALERTES ET NOTIFICATIONS
// =============================================================================

export interface Phase0Alert {
  id: string;
  type: AlertType;
  severity: AlertSeverity;
  title: string;
  message: string;
  field?: string;
  source: DataSource;
  actionRequired: boolean;
  suggestedAction?: string;
  createdAt: string;
  dismissedAt?: string;
  resolvedAt?: string;
}

export type AlertType =
  | 'regulatory'      // Réglementaire
  | 'technical'       // Technique
  | 'financial'       // Financier
  | 'administrative'  // Administratif
  | 'risk'            // Risque
  | 'deadline'        // Délai
  | 'incompatibility' // Incompatibilité
  | 'missing_info';   // Information manquante

export type AlertSeverity = 'info' | 'warning' | 'error' | 'critical';

// =============================================================================
// ESTIMATIONS ET SCORES
// =============================================================================

export interface EstimationRange {
  min: number;
  max: number;
  average: number;
  unit: string;
  confidence: ConfidenceLevel;
  source?: DataSource;
  lastUpdated?: string;
}

export interface ScoringCriterion {
  id: string;
  name: string;
  description: string;
  weight: number;      // Pondération 0-100
  maxPoints: number;
  currentPoints: number;
  status: 'pending' | 'evaluated' | 'na';
  details?: string;
}
