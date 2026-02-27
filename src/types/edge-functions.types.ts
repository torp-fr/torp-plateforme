/**
 * Edge Function Type Definitions and Helpers
 * Provides type-safe wrappers for Supabase Edge Function invocations
 */

import type {
  GenerateEmbeddingResponse,
  LLMCompletionResponse,
  RAGQueryResponse,
  IngestDocumentEdgeFunctionResponse,
  VisionAnalysisResponse,
} from './rag.types';

/**
 * Generic Edge Function invoke response wrapper
 */
export interface EdgeFunctionInvokeResult<T> {
  data: T | null;
  error: EdgeFunctionError | null;
}

/**
 * Edge Function error structure
 */
export interface EdgeFunctionError extends Error {
  message: string;
  context?: Record<string, unknown>;
  status?: number;
}

/**
 * Request/Response types for each Edge Function
 */

/**
 * Generate Embedding Edge Function
 */
export interface GenerateEmbeddingRequest {
  text: string;
  model?: string;
}

/**
 * LLM Completion Edge Function
 */
export interface LLMCompletionRequest {
  messages: Array<{
    role: 'user' | 'assistant' | 'system';
    content: string;
  }>;
  model?: string;
  provider?: 'openai' | 'anthropic';
  max_tokens?: number;
  temperature?: number;
  system?: string;
  response_format?: { type: 'json_object' } | { type: 'text' };
}

/**
 * RAG Query Edge Function
 */
export interface RAGQueryRequest {
  action: 'analyze' | 'extract' | 'enterprise' | 'prices' | 'aids';
  devisText?: string;
  siret?: string;
  siren?: string;
  nom?: string;
  categories?: string[];
}

/**
 * Ingest Document Edge Function
 */
export interface IngestDocumentRequest {
  documentId: string;
  overlapPercent?: number;
  chunkSize?: number;
}

/**
 * Vision Analysis Edge Function
 */
export interface VisionAnalysisRequest {
  imageUrl: string;
  model?: string;
  analysisType?: 'diagnostic' | 'construction';
}

/**
 * Type guard for edge function error
 */
export function isEdgeFunctionError(value: unknown): value is EdgeFunctionError {
  const obj = value as Record<string, unknown>;
  return (
    obj &&
    typeof obj === 'object' &&
    typeof obj.message === 'string'
  );
}

/**
 * Type guard for successful edge function response
 */
export function isEdgeFunctionSuccess<T>(
  result: EdgeFunctionInvokeResult<T>
): result is { data: T; error: null } {
  return result.error === null && result.data !== null;
}

/**
 * Type guard for failed edge function response
 */
export function isEdgeFunctionFailure(
  result: EdgeFunctionInvokeResult<unknown>
): result is { data: null; error: EdgeFunctionError } {
  return result.error !== null;
}

/**
 * Helper to validate embedding response
 */
export function isValidEmbeddingResponse(
  value: unknown
): value is GenerateEmbeddingResponse {
  const obj = value as Record<string, unknown>;
  return (
    obj &&
    typeof obj === 'object' &&
    Array.isArray(obj.embedding) &&
    obj.embedding.length === 1536 &&
    typeof obj.model === 'string'
  );
}

/**
 * Helper to validate LLM completion response
 */
export function isValidLLMCompletionResponse(
  value: unknown
): value is LLMCompletionResponse {
  const obj = value as Record<string, unknown>;
  return (
    obj &&
    typeof obj === 'object' &&
    typeof obj.text === 'string' &&
    typeof obj.model === 'string' &&
    obj.finish_reason !== undefined
  );
}

/**
 * Helper to validate RAG query response
 */
export function isValidRAGQueryResponse(value: unknown): value is RAGQueryResponse {
  const obj = value as Record<string, unknown>;
  return (
    obj &&
    typeof obj === 'object' &&
    obj.context !== undefined &&
    typeof obj.prompt === 'string'
  );
}

/**
 * Helper to validate ingest document response
 */
export function isValidIngestDocumentResponse(
  value: unknown
): value is IngestDocumentEdgeFunctionResponse {
  const obj = value as Record<string, unknown>;
  return (
    obj &&
    typeof obj === 'object' &&
    typeof obj.success === 'boolean' &&
    typeof obj.documentsProcessed === 'number' &&
    typeof obj.chunksCreated === 'number'
  );
}

/**
 * Helper to validate vision analysis response
 */
export function isValidVisionAnalysisResponse(
  value: unknown
): value is VisionAnalysisResponse {
  const obj = value as Record<string, unknown>;
  return (
    obj &&
    typeof obj === 'object' &&
    Array.isArray(obj.detectedObjects) &&
    typeof obj.description === 'string' &&
    typeof obj.confidence === 'number'
  );
}

/**
 * Helper function to safely extract response data with type checking
 */
export function extractEdgeFunctionData<T>(
  result: EdgeFunctionInvokeResult<T>,
  validator?: (value: unknown) => value is T
): T {
  if (result.error) {
    throw new Error(`Edge Function error: ${result.error.message}`);
  }

  if (!result.data) {
    throw new Error('Edge Function returned no data');
  }

  if (validator && !validator(result.data)) {
    throw new Error('Edge Function response validation failed');
  }

  return result.data;
}

/**
 * Safe invoke wrapper that enforces type checking
 */
export async function safeEdgeFunctionInvoke<T>(
  client: any, // Supabase client
  functionName: string,
  request: Record<string, unknown>,
  validator?: (value: unknown) => value is T
): Promise<T> {
  const { data, error } = (await client.functions.invoke(functionName, {
    body: request,
  })) as EdgeFunctionInvokeResult<T>;

  if (error) {
    throw error;
  }

  return extractEdgeFunctionData({ data, error }, validator);
}
