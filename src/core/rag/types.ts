/**
 * RAG System — Shared Types & Constants
 * Central type definitions for the entire RAG pipeline.
 */

// ---------------------------------------------------------------------------
// Core document types
// ---------------------------------------------------------------------------

export interface KnowledgeDocument {
  id: string;
  source: string;
  category: string;
  region?: string;
  content: string;
  reliability_score: number;
  created_at: string;
  updated_at: string;
}

export interface SearchResult {
  id: string;
  source: string;
  category: string;
  content: string;
  reliability_score: number;
  created_at: string;
  updated_at: string;
  relevance_score: number;
  embedding_similarity: number;
}

export interface SimilarDocument {
  id: string;
  relevanceScore: number;
  content: string;
}

export interface MarketPriceReference {
  type_travaux: string;
  region: string;
  min_price: number;
  max_price: number;
  avg_price: number;
  reliability_score: number;
  is_active: boolean;
}

// ---------------------------------------------------------------------------
// Ingestion state machine
// ---------------------------------------------------------------------------

export type IngestionStatus =
  | 'pending'
  | 'processing'
  | 'chunking'
  | 'embedding'
  | 'complete'
  | 'failed';

export interface IngestionState {
  ingestion_status: IngestionStatus;
  ingestion_progress: number;
  ingestion_started_at?: string;
  ingestion_completed_at?: string;
  last_ingestion_error?: string;
  last_ingestion_step?: string;
  embedding_integrity_checked?: boolean;
}

export const ALLOWED_TRANSITIONS: Record<IngestionStatus, IngestionStatus[]> = {
  pending: ['processing'],
  processing: ['chunking', 'failed'],
  chunking: ['embedding', 'failed'],
  embedding: ['complete', 'failed'],
  failed: ['pending'],
  complete: [],
};

// ---------------------------------------------------------------------------
// Metrics
// ---------------------------------------------------------------------------

export interface IngestionMetrics {
  total_documents_processed: number;
  successful_ingestions: number;
  failed_ingestions: number;
  avg_chunks_per_document: number;
  avg_embedding_time_per_chunk: number;
  integrity_check_failures: number;
  retry_success_rate: number;
}

export const DEFAULT_METRICS: IngestionMetrics = {
  total_documents_processed: 0,
  successful_ingestions: 0,
  failed_ingestions: 0,
  avg_chunks_per_document: 0,
  avg_embedding_time_per_chunk: 0,
  integrity_check_failures: 0,
  retry_success_rate: 0,
};
