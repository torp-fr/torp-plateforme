/**
 * Audit Trail Types
 * Complete typing for audit system (logging, API calls, criteria evaluation)
 */

// ============================================
// API REQUEST LOG
// ============================================
export interface ApiRequest {
  id: string;
  ccfId: string;
  userId?: string;
  requestId: string;
  parentRequestId?: string;
  sourceIp?: string;
  endpoint: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  params?: Record<string, any>;
  headers?: Record<string, string>;
  statusCode?: number;
  responseTimeMs?: number;
  errorMessage?: string;
  errorDetails?: Record<string, any>;
  requestedAt: Date;
  completedAt?: Date;
  requestType?: string;
}

export interface ApiRequestInput {
  ccfId: string;
  userId?: string;
  endpoint: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  params?: Record<string, any>;
  headers?: Record<string, string>;
  sourceIp?: string;
}

export interface ApiResponseInput {
  statusCode: number;
  responseTimeMs: number;
  errorMessage?: string;
  errorDetails?: Record<string, any>;
}

// ============================================
// EXTERNAL API CALLS LOG
// ============================================
export type ExternalService = 'pappers' | 'insee' | 'rge' | 'google_maps' | 'other';

export interface ExternalApiCall {
  id: string;
  apiRequestId: string;
  externalService: ExternalService;
  endpoint?: string;
  method?: 'GET' | 'POST' | 'PUT';
  requestPayload?: Record<string, any>;
  requestHeaders?: Record<string, string>;
  responseStatus?: number;
  responsePayload?: Record<string, any>;
  responseTimeMs?: number;
  errorOccurred: boolean;
  errorCode?: string;
  errorMessage?: string;
  errorDetails?: Record<string, any>;
  ccfId?: string;
  contextData?: Record<string, any>;
  calledAt: Date;
  completedAt?: Date;
  retryCount: number;
  retryReason?: string;
}

export interface ExternalApiCallInput {
  apiRequestId: string;
  externalService: ExternalService;
  endpoint?: string;
  method?: 'GET' | 'POST' | 'PUT';
  requestPayload?: Record<string, any>;
  requestHeaders?: Record<string, string>;
  ccfId?: string;
  contextData?: Record<string, any>;
}

export interface ExternalApiCallResponse {
  responseStatus: number;
  responsePayload?: Record<string, any>;
  responseTimeMs: number;
}

export interface ExternalApiCallError {
  errorOccurred: boolean;
  errorCode?: string;
  errorMessage?: string;
  errorDetails?: Record<string, any>;
  retryCount?: number;
  retryReason?: string;
}

// ============================================
// CRITERIA EVALUATION LOG
// ============================================
export interface CriteriaEvaluation {
  id: string;
  apiRequestId: string;
  criterionName: string;
  criterionCategory?: string;
  criterionAxis?: string;
  inputData?: Record<string, any>;
  evaluationMethod?: 'formula' | 'ai_analysis' | 'threshold' | 'weighted';
  evaluationLogic?: Record<string, any>;
  score: number;
  maxScore: number;
  percentage: number;
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  justification?: string;
  findings?: string[];
  confidence?: number;
  ccfId?: string;
  roomId?: string;
  evaluatedAt: Date;
}

export interface CriteriaEvaluationInput {
  apiRequestId: string;
  criterionName: string;
  criterionCategory?: string;
  criterionAxis?: string;
  inputData?: Record<string, any>;
  evaluationMethod?: 'formula' | 'ai_analysis' | 'threshold' | 'weighted';
  evaluationLogic?: Record<string, any>;
  ccfId?: string;
  roomId?: string;
}

export interface CriteriaScore {
  score: number;
  maxScore: number;
  percentage: number;
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  justification?: string;
  findings?: string[];
  confidence?: number;
}

// ============================================
// EXECUTION CONTEXT LOG
// ============================================
export interface ExecutionContext {
  id: string;
  apiRequestId: string;
  executionId: string;
  region?: string;
  climateZone?: string;
  projectType?: string;
  workTypes?: string[];
  address?: string;
  coordinates?: { lat: number; lng: number };
  communeCode?: string;
  contractorSiret?: string;
  contractorName?: string;
  contractorSolvencyScore?: number;
  analysisConfig?: Record<string, any>;
  kbChunksUsed?: string[];
  aiModel?: string;
  aiTemperature?: number;
  aiMaxTokens?: number;
  ccfId?: string;
  userId?: string;
  startedAt: Date;
  completedAt?: Date;
  totalDurationMs?: number;
  status: 'started' | 'running' | 'completed' | 'failed';
}

export interface ExecutionContextInput {
  executionId: string;
  region?: string;
  climateZone?: string;
  projectType?: string;
  workTypes?: string[];
  address?: string;
  coordinates?: { lat: number; lng: number };
  communeCode?: string;
  contractorSiret?: string;
  contractorName?: string;
  contractorSolvencyScore?: number;
  analysisConfig?: Record<string, any>;
  kbChunksUsed?: string[];
  aiModel?: string;
  aiTemperature?: number;
  aiMaxTokens?: number;
  ccfId?: string;
  userId?: string;
}

// ============================================
// SCORE SNAPSHOT
// ============================================
export interface ScoreSnapshot {
  id: string;
  executionContextId: string;
  globalScore: number;
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  percentage: number;
  scoresByRoom?: Record<string, { score: number; grade: string }>;
  scoresByCriterion?: Record<string, number>;
  scoresByAxis?: Record<string, number>;
  strengths?: string[];
  weaknesses?: string[];
  recommendations?: string[];
  kbReferences?: Array<{
    type: string;
    ref: string;
    relevance: number;
  }>;
  ccfId?: string;
  createdAt: Date;
}

export interface ScoreSnapshotInput {
  executionContextId: string;
  globalScore: number;
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  percentage: number;
  scoresByRoom?: Record<string, { score: number; grade: string }>;
  scoresByCriterion?: Record<string, number>;
  scoresByAxis?: Record<string, number>;
  strengths?: string[];
  weaknesses?: string[];
  recommendations?: string[];
  kbReferences?: Array<{
    type: string;
    ref: string;
    relevance: number;
  }>;
  ccfId?: string;
}

// ============================================
// COMPLETE EXECUTION TRACE
// ============================================
export interface ExecutionTrace {
  executionContext: ExecutionContext;
  apiRequest: ApiRequest;
  externalApiCalls: ExternalApiCall[];
  criteriaEvaluations: CriteriaEvaluation[];
  scoreSnapshots: ScoreSnapshot[];
}

export interface ExecutionSummary {
  executionId: string;
  status: string;
  startedAt: Date;
  completedAt?: Date;
  totalDurationMs?: number;
  region?: string;
  projectType?: string;
  apiCallsMade: number;
  avgApiResponseTimeMs: number;
  criteriaEvaluated: number;
  contractorSolvencyScore?: number;
}

// ============================================
// ANALYSIS HISTORY
// ============================================
export interface AnalysisRecord {
  analysisId: string;
  analysisDate: Date;
  totalScore: number;
  finalGrade: string;
  contractorName?: string;
  summary?: string;
  executionId?: string;
}

export interface AnalysisHistoryFilter {
  startDate?: Date;
  endDate?: Date;
  minScore?: number;
  maxScore?: number;
  grade?: string;
  limit?: number;
  offset?: number;
}

// ============================================
// ANALYSIS RESULTS
// ============================================
export interface AnalysisResult {
  id: string;
  ccfId: string;
  quoteUploadId?: string;
  executionContextId?: string;
  apiRequestId?: string;
  totalScore: number;
  finalGrade: 'A' | 'B' | 'C' | 'D' | 'F';
  percentage: number;
  enterpriseScore?: number;
  enterpriseGrade?: string;
  priceScore?: number;
  priceGrade?: string;
  completenessScore?: number;
  completenessGrade?: string;
  conformityScore?: number;
  conformityGrade?: string;
  delaysScore?: number;
  delaysGrade?: string;
  summary?: string;
  strengths?: string[];
  weaknesses?: string[];
  recommendations?: string[];
  kbReferences?: Record<string, any>;
  criteriaUsed?: string[];
  dataSources?: string[];
  analysisType: 'full' | 'quick' | 'custom';
  aiModel?: string;
  createdBy?: string;
  createdAt: Date;
  updatedAt?: Date;
}

// ============================================
// AUDIT EVENTS
// ============================================
export interface AuditEvent {
  id: string;
  eventType: string;
  eventCategory?: string;
  severity: 'info' | 'warning' | 'error';
  description?: string;
  changes?: { before?: Record<string, any>; after?: Record<string, any> };
  userId?: string;
  ccfId?: string;
  apiRequestId?: string;
  occurredAt: Date;
}

// ============================================
// PAPPERS DATA
// ============================================
export interface PappersCompanyData {
  siret: string;
  siren: string;
  name: string;
  legalForm?: string;
  address?: string;
  city?: string;
  postalCode?: string;
  country?: string;
  employees?: number;
  turnover?: number;
  netIncome?: number;
  turnover2023?: number;
  netIncome2023?: number;
  turnover2022?: number;
  netIncome2022?: number;
  turnover2021?: number;
  netIncome2021?: number;
  solvencyScore?: number;
  paymentReliability?: number;
  bankruptcyRisk?: boolean;
  certifications?: Array<{
    name: string;
    issuer?: string;
    expiryDate?: Date;
  }>;
  licenses?: Array<{
    type: string;
    number?: string;
    status?: string;
    expiryDate?: Date;
  }>;
  rgeCertifications?: string[];
  activityStartDate?: Date;
  activityStatus?: string;
  activityHistory?: Array<{
    date: Date;
    event: string;
    description?: string;
  }>;
  yearsInBusiness?: number;
  executives?: Array<{
    name: string;
    role: string;
    sinceDate?: Date;
  }>;
  shareholders?: Array<{
    name: string;
    sharePercentage: number;
  }>;
  nafCode?: string;
  sector?: string;
  subsector?: string;
  fetchedAt?: Date;
}

export interface FinancialMetrics {
  score: number;
  profitability: number;
  liquidity: number;
  independence: number;
  growth: number;
  level: 'excellent' | 'good' | 'moderate' | 'risky';
}

export interface PaymentHealthData {
  score: number;
  level: 'Excellent' | 'Bon' | 'Moyen' | 'Mauvais';
  bankruptcyRisk: boolean;
  recommendations?: string[];
}

export interface Certification {
  name: string;
  issuer?: string;
  expiryDate?: Date;
  status?: string;
}

export interface ActivityEvent {
  date: Date;
  event: string;
  description?: string;
}

// ============================================
// GENERIC LOGGING INPUT
// ============================================
export interface AuditLogInput {
  type: 'api_request' | 'external_api_call' | 'criteria_evaluation' | 'execution_context' | 'score_snapshot';
  data: Record<string, any>;
  requestId?: string;
  ccfId?: string;
  userId?: string;
}
