/**
 * Retrieval Debugger Service
 * Developer tool to inspect retrieval results and debug semantic search.
 */

import { log, error } from '@/lib/logger';
import { semanticSearch } from '../ingestion/knowledgeIndex.service';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RetrievalDebugResult {
  rank: number;
  similarity: number;
  documentId: string;
  chunkId: string;
  preview: string;
}

// ---------------------------------------------------------------------------
// debugRetrieval
// ---------------------------------------------------------------------------

/**
 * Runs semanticSearch and returns debugging metadata for each retrieved chunk.
 * Preview contains the first 200 characters of the chunk content.
 */
export async function debugRetrieval(
  query: string,
  limit = 10
): Promise<RetrievalDebugResult[]> {
  log('[RetrievalDebugger] Debug query:', query);

  try {
    const results = await semanticSearch(query, limit);

    return results.map((chunk, index) => ({
      rank: index + 1,
      similarity: chunk.similarity,
      documentId: chunk.documentId,
      chunkId: chunk.chunkId,
      preview: chunk.content.slice(0, 200),
    }));
  } catch (err) {
    error('[RetrievalDebugger] Failed to debug retrieval:', err);
    return [];
  }
}
