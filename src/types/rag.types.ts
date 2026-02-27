/**
 * RAG (Retrieval Augmented Generation) Type Definitions
 * Comprehensive types for RAG operations, embeddings, and responses
 */

/**
 * OpenAI Embedding Vector Type
 * 1536-dimensional vector from text-embedding-3-small model
 */
export type EmbeddingVector = number[];

/**
 * Embedding response from OpenAI or Edge Function
 */
export interface EmbeddingResponse {
  embedding: EmbeddingVector;
  model: string;
  usage: {
    prompt_tokens: number;
    total_tokens: number;
  };
}

/**
 * Knowledge base chunk stored in database
 */
export interface KnowledgeChunk {
  id: string;
  document_id: string;
  content: string;
  chunk_index: number;
  embedding: EmbeddingVector;
  metadata: Record<string, string | number | boolean | null>;
  created_at: string;
  updated_at: string;
}

/**
 * RAG Query Request
 */
export interface RAGQueryRequest {
  action: 'analyze' | 'extract' | 'enterprise' | 'entreprise' | 'prices' | 'prix' | 'aids' | 'aides';
  devisText?: string;
  siret?: string;
  siren?: string;
  nom?: string;
  categories?: string[];
}

/**
 * Extracted devis data
 */
export interface ExtractedDevis {
  company_name: string | null;
  company_siret: string | null;
  total_amount: number | null;
  currency: string | null;
  line_items: Array<{
    description: string;
    quantity: number;
    unit_price: number;
    total: number;
  }>;
  delivery_date: string | null;
  payment_terms: string | null;
}

/**
 * Company information response
 */
export interface EnterpriseInfo {
  siret: string;
  name: string;
  legal_name: string | null;
  address: {
    street: string | null;
    postal_code: string | null;
    city: string | null;
  } | null;
  activity_code: string | null;
  creation_date: string | null;
  employees_count: number | null;
}

/**
 * Certification information
 */
export interface Certification {
  type: string;
  number: string | null;
  valid_until: string | null;
  verified: boolean;
}

/**
 * Market price reference
 */
export interface PriceReference {
  category: string;
  work_type: string;
  unit: string;
  price_low: number;
  price_avg: number;
  price_high: number;
  region: string | null;
}

/**
 * Financial aid information
 */
export interface AidInfo {
  name: string;
  type: string;
  max_amount: number | null;
  conditions: string[];
  eligibility_requirements: string[];
}

/**
 * RAG analysis response
 */
export interface RAGAnalysisResponse {
  context: {
    company: EnterpriseInfo | null;
    prices: PriceReference[];
    eligibility: AidInfo[];
    compliance: Record<string, unknown>;
  };
  prompt: string;
  analysisType?: 'diagnostic' | 'construction';
  analyzedAt?: string;
  model?: string;
  userId?: string;
}

/**
 * Diagnostic analysis pathology
 */
export interface Pathology {
  type: string;
  description: string;
  severity: 1 | 2 | 3 | 4 | 5;
  location: string;
  possibleCauses: string[];
  recommendedActions: string[];
  estimatedRepairCost?: {
    min: number;
    max: number;
  };
}

/**
 * Building diagnostic response
 */
export interface DiagnosticResponse {
  pathologies: Pathology[];
  overallCondition: 'bon' | 'moyen' | 'dégradé' | 'critique';
  urgentAttention: boolean;
  estimatedRepairCost: {
    min: number;
    max: number;
  };
  recommendations: string[];
  confidence: number;
  analysisType: 'diagnostic';
  analyzedAt: string;
  model: string;
  userId: string;
}

/**
 * Construction site issue
 */
export interface ConstructionIssue {
  type: 'malfaçon' | 'sécurité' | 'non-conformité' | 'retard' | string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  location: string | null;
  suggestedAction: string;
}

/**
 * Construction site analysis response
 */
export interface ConstructionResponse {
  lotDetected: string | null;
  lotName: string | null;
  progressEstimate: number;
  qualityScore: number;
  issues: ConstructionIssue[];
  recommendations: string[];
  confidence: number;
  analysisType: 'construction';
  analyzedAt: string;
  model: string;
  userId: string;
}

/**
 * Document ingestion request
 */
export interface IngestDocumentRequest {
  documentId: string;
  overlapPercent?: number;
  chunkSize?: number;
}

/**
 * Document ingestion response
 */
export interface IngestDocumentResponse {
  success: boolean;
  documentsProcessed: number;
  chunksCreated: number;
  embeddingsGenerated: number;
  processingTime: number;
  errors: Array<{
    documentId: string;
    error: string;
  }>;
}

/**
 * Supabase function invoke response type
 */
export interface SupabaseFunctionResponse<T = unknown> {
  data: T;
  error: Error | null;
}

/**
 * Generic error response from Edge Functions
 */
export interface EdgeFunctionError {
  error: string;
  message: string;
  code: string;
  details?: string;
  retryAfter?: number;
}

/**
 * RAG context for analysis
 */
export interface RAGContext {
  company: EnterpriseInfo | null;
  prices: Record<string, PriceReference[]>;
  eligibility: Record<string, AidInfo>;
  compliance: Record<string, unknown>;
}

/**
 * Type guard for embedding vector
 */
export function isEmbeddingVector(value: unknown): value is EmbeddingVector {
  return (
    Array.isArray(value) &&
    value.length === 1536 &&
    value.every((v) => typeof v === 'number')
  );
}

/**
 * Type guard for diagnostic response
 */
export function isDiagnosticResponse(value: unknown): value is DiagnosticResponse {
  const obj = value as Record<string, unknown>;
  return (
    obj &&
    typeof obj === 'object' &&
    obj.analysisType === 'diagnostic' &&
    Array.isArray(obj.pathologies)
  );
}

/**
 * Type guard for construction response
 */
export function isConstructionResponse(value: unknown): value is ConstructionResponse {
  const obj = value as Record<string, unknown>;
  return (
    obj &&
    typeof obj === 'object' &&
    obj.analysisType === 'construction' &&
    Array.isArray(obj.issues)
  );
}

/**
 * Type guard for edge function error
 */
export function isEdgeFunctionError(value: unknown): value is EdgeFunctionError {
  const obj = value as Record<string, unknown>;
  return (
    obj &&
    typeof obj === 'object' &&
    typeof obj.error === 'string' &&
    typeof obj.message === 'string' &&
    typeof obj.code === 'string'
  );
}

/**
 * Score breakdown for devis analysis
 */
export interface ScoreBreakdown {
  scoreTotal?: number;
  [key: string]: unknown;
}

/**
 * Recommendations for devis
 */
export interface DevisRecommendations {
  budgetRealEstime?: number;
  margeNegociation?: number;
  [key: string]: unknown;
}

/**
 * Analyzed devis from database
 */
export interface DevisAnalyzed {
  id: string;
  projectName?: string;
  fileName?: string;
  devisNumber?: string;
  entreprise?: {
    nom: string;
    [key: string]: unknown;
  };
  projectType?: string;
  status: 'analyzed' | 'pending' | 'error';
  score_total?: number;
  grade?: string;
  amount?: number;
  created_at?: string;
  recommendations?: DevisRecommendations;
  detected_overcosts?: number;
  score_entreprise?: ScoreBreakdown;
  score_prix?: ScoreBreakdown;
  score_completude?: ScoreBreakdown;
  score_conformite?: ScoreBreakdown;
  score_delais?: ScoreBreakdown;
}

/**
 * Analysis result with detailed scores
 */
export interface AnalysisResult {
  detailedScores: {
    entreprise: number;
    prix: number;
    completude: number;
    conformite: number;
    delais: number;
  };
  rawData: {
    scoreEntreprise: ScoreBreakdown | null;
    scorePrix: ScoreBreakdown | null;
    scoreCompletude: ScoreBreakdown | null;
    scoreConformite: ScoreBreakdown | null;
    scoreDelais: ScoreBreakdown | null;
    montantTotal: number;
    margeNegociation?: number;
    surcoutsDetectes: number;
    budgetRealEstime: number;
  };
}

/**
 * Edge Function response wrapper
 */
export interface EdgeFunctionResponse<T> {
  data: T | null;
  error: Error | null;
}

/**
 * Generate Embedding Edge Function response
 */
export interface GenerateEmbeddingResponse {
  embedding: EmbeddingVector;
  model: string;
  usage: {
    prompt_tokens: number;
    total_tokens: number;
  };
}

/**
 * LLM Completion Edge Function response
 */
export interface LLMCompletionResponse {
  text: string;
  model: string;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  finish_reason: string;
}

/**
 * RAG Query Edge Function response
 */
export interface RAGQueryResponse {
  context: {
    company: EnterpriseInfo | null;
    prices: PriceReference[];
    eligibility: AidInfo[];
    compliance: Record<string, unknown>;
  };
  prompt: string;
  analysisType?: 'diagnostic' | 'construction';
  analyzedAt?: string;
  model?: string;
  userId?: string;
}

/**
 * Ingest Document Edge Function response
 */
export interface IngestDocumentEdgeFunctionResponse {
  success: boolean;
  documentsProcessed: number;
  chunksCreated: number;
  embeddingsGenerated: number;
  processingTime: number;
  errors: Array<{
    documentId: string;
    error: string;
  }>;
}

/**
 * Vision Analysis Edge Function response
 */
export interface VisionAnalysisResponse {
  detectedObjects: string[];
  description: string;
  confidence: number;
  analysisType: 'diagnostic' | 'construction';
}

/**
 * Type guard for edge function error
 */
export function isEdgeFunctionResponseValid<T>(
  response: unknown
): response is EdgeFunctionResponse<T> {
  const obj = response as Record<string, unknown>;
  return obj && typeof obj === 'object' && ('data' in obj || 'error' in obj);
}
