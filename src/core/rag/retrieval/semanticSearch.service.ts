/**
 * RAG — Semantic Search Service
 * Vector similarity search via Supabase pgvector RPC.
 */

import { semanticSearch as coreSemanticSearch } from '@/core/knowledge/ingestion/knowledgeIndex.service';
import { SimilarDocument } from '../types';
import { log } from '@/lib/logger';

/**
 * Search for similar documents using vector similarity.
 * Returns documents matching the query above the relevance threshold.
 */
export async function searchSimilarDocuments(
  query: string,
  options: {
    limit?: number;
    minRelevance?: number;
  } = {}
): Promise<SimilarDocument[]> {
  const { limit = 5, minRelevance = 0.5 } = options;
  log('[RAG:SemanticSearch] 🔍 Searching for similar documents:', query);

  try {
    const results = await coreSemanticSearch(query, limit);

    const filtered = results
      .filter((r) => r.similarity >= minRelevance)
      .map((r) => ({
        id: r.chunkId,
        relevanceScore: r.similarity,
        content: r.content,
      }));

    log('[RAG:SemanticSearch] ✅ Found', filtered.length, 'similar documents');
    return filtered;
  } catch (err) {
    console.error('[RAG:SemanticSearch] ❌ Semantic search failed:', err);
    return [];
  }
}
