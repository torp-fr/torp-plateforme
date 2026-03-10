/**
 * Knowledge Ingestion API Client
 * Connects to backend ingestion services for the Ingestion Studio.
 */

import { apiGet } from '@/services/api/client';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface UploadResult {
  documentId: string;
  chunks: number;
  tokens: number;
}

export interface ChunkPreview {
  chunk: number;
  tokens: number;
  preview: string;
}

export interface ReindexResult {
  success: boolean;
  chunksIndexed: number;
}

export interface RetrievalResult {
  rank: number;
  similarity: number;
  documentId: string;
  chunkId: string;
  preview: string;
}

// ---------------------------------------------------------------------------
// API Functions
// ---------------------------------------------------------------------------

export async function uploadKnowledgeDocument(file: File): Promise<UploadResult> {
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch('/knowledge/upload', {
    method: 'POST',
    body: formData,
  });
  if (!response.ok) {
    throw new Error(`Upload failed: ${response.status}`);
  }
  const result = await response.json();
  return result.data;
}

export async function previewChunks(text: string): Promise<ChunkPreview[]> {
  const response = await fetch('/knowledge/chunk-preview', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  });
  if (!response.ok) {
    throw new Error(`Chunk preview failed: ${response.status}`);
  }
  const result = await response.json();
  return result.data;
}

export async function reindexDocument(documentId: string): Promise<ReindexResult> {
  const response = await fetch('/knowledge/reindex', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ documentId }),
  });
  if (!response.ok) {
    throw new Error(`Reindex failed: ${response.status}`);
  }
  const result = await response.json();
  return result.data;
}

export async function testRetrieval(query: string): Promise<RetrievalResult[]> {
  return apiGet<RetrievalResult[]>(`/debug/retrieval?q=${encodeURIComponent(query)}`);
}
