/**
 * RAG Trace Service
 * Developer tool to trace the full RAG pipeline: embedding → retrieval → compression.
 */

import { log, warn, error } from '@/lib/logger';
import { generateEmbedding } from '../ingestion/knowledgeEmbedding.service';
import { semanticSearch } from '../ingestion/knowledgeIndex.service';
import { compressContext } from '../compression/contextCompression.service';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

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
// traceRAG
// ---------------------------------------------------------------------------

/**
 * Traces the full RAG pipeline for a given query.
 * Pipeline: generate embedding → semantic search → compress context.
 * Falls back to original chunks if compression fails.
 */
export async function traceRAG(query: string): Promise<RAGTrace> {
  log('[RAGTrace] Tracing query:', query);

  // Step 1: Generate query embedding
  const embedding = await generateEmbedding(query);
  const dimensions = embedding ? embedding.length : 0;

  if (!embedding) {
    warn('[RAGTrace] Failed to generate embedding for query:', query);
  }

  // Step 2: Run semantic search
  let retrievalResults: { chunkId: string; content: string; similarity: number; documentId: string }[] = [];
  try {
    retrievalResults = await semanticSearch(query, 10);
    log('[RAGTrace] Retrieval complete:', { count: retrievalResults.length });
  } catch (err) {
    error('[RAGTrace] Retrieval failed:', err);
  }

  // Step 3: Compress retrieved chunks (fallback to originals on failure)
  let compressionPreviews: { preview: string }[] = [];
  try {
    const compressed = await compressContext(query, retrievalResults);
    compressionPreviews = compressed.map(content => ({ preview: content.slice(0, 200) }));
    log('[RAGTrace] Compression complete:', { count: compressionPreviews.length });
  } catch (err) {
    error('[RAGTrace] Compression failed, falling back to original chunks:', err);
    compressionPreviews = retrievalResults.map(chunk => ({ preview: chunk.content.slice(0, 200) }));
  }

  return {
    query,
    steps: {
      embedding: {
        dimensions,
      },
      retrieval: retrievalResults.map(chunk => ({
        chunkId: chunk.chunkId,
        similarity: chunk.similarity,
        preview: chunk.content.slice(0, 200),
      })),
      compression: compressionPreviews,
    },
  };
}
