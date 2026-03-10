/**
 * API Type Definitions
 * Shared types for the RAG Backend API layer
 */

// ---------------------------------------------------------------------------
// Engine types
// ---------------------------------------------------------------------------

export interface EngineStatus {
  status: 'running' | 'stopped' | 'error';
  rag: 'active' | 'inactive';
  version: string;
}

export interface EngineStats {
  documents: number;
  chunks: number;
  embeddings: number;
}

export interface OrchestrationState {
  last_run: string | null;
  status: 'idle' | 'running' | 'error';
}

// ---------------------------------------------------------------------------
// Debug types
// ---------------------------------------------------------------------------

export interface IngestionDebugData {
  documents: number;
  chunks: number;
  embeddings: number;
  avgQuality: number;
  publishableDocuments: number;
}

export interface RetrievalDebugResult {
  rank: number;
  similarity: number;
  documentId: string;
  chunkId: string;
  preview: string;
}

export interface ChunkVisualization {
  chunk: number;
  tokens: number;
  quality: number | null;
  preview: string;
}

// ---------------------------------------------------------------------------
// Generic response envelope
// ---------------------------------------------------------------------------

export interface ApiOkResponse<T> {
  ok: true;
  data: T;
}

export interface ApiErrorResponse {
  ok: false;
  error: string;
}

export type ApiResponse<T> = ApiOkResponse<T> | ApiErrorResponse;
