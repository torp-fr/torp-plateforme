/**
 * Knowledge Debug API Client
 * Connects to backend debug services for the Knowledge Control Center.
 */

import { apiGet } from '@/services/api/client';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface IngestionStats {
  documents: number;
  chunks: number;
  embeddings: number;
  avgQuality: number;
  publishableDocuments: number;
}

export interface RetrievalResult {
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

export interface RAGTrace {
  query: string;
  steps: {
    embedding: {
      dimensions: number;
    };
    retrieval: {
      chunkId: string;
      similarity: number;
      preview: string;
    }[];
    compression: {
      preview: string;
    }[];
  };
}

// ---------------------------------------------------------------------------
// API Functions
// ---------------------------------------------------------------------------

export async function getIngestionStats(): Promise<IngestionStats> {
  return apiGet<IngestionStats>('/debug/ingestion');
}

export async function debugRetrieval(query: string): Promise<RetrievalResult[]> {
  return apiGet<RetrievalResult[]>(`/debug/retrieval?q=${encodeURIComponent(query)}`);
}

export async function getChunks(documentId: string): Promise<ChunkVisualization[]> {
  return apiGet<ChunkVisualization[]>(`/debug/chunks?documentId=${encodeURIComponent(documentId)}`);
}

export async function traceRAG(query: string): Promise<RAGTrace> {
  return apiGet<RAGTrace>(`/debug/rag-trace?q=${encodeURIComponent(query)}`);
}
