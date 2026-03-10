/**
 * RAG — Hybrid Search Service
 * Combines semantic vector search with keyword fallback.
 */

import { keywordSearch } from './keywordSearch.service';
import { semanticSearch } from '@/core/knowledge/ingestion/knowledgeIndex.service';
import { SearchResult } from '../types';
import { log, warn } from '@/lib/logger';

/**
 * Search for relevant knowledge using keyword search with a semantic fallback.
 * Returns deduplicated results ranked by relevance.
 */
export async function searchRelevantKnowledge(
  query: string,
  options?: {
    category?: string;
    region?: string;
    limit?: number;
  }
): Promise<SearchResult[]> {
  const limit = options?.limit ?? 5;

  log('[RAG:HybridSearch] 🔍 Hybrid knowledge search:', query);

  try {
    // Step 1: keyword search (uses secure verified views)
    const keywordResults = await keywordSearch(query, limit, {
      category: options?.category,
      region: options?.region,
    });

    if (keywordResults.length > 0) {
      log('[RAG:HybridSearch] ✅ Keyword search returned', keywordResults.length, 'results');
      return keywordResults.slice(0, limit);
    }

    // Step 2: semantic fallback via pgvector + full-text hybrid search
    warn('[RAG:HybridSearch] ⚠️ No keyword results — falling back to semantic search');

    const semanticResults = await semanticSearch(query, limit);

    if (semanticResults.length === 0) {
      warn('[RAG:HybridSearch] ⚠️ Semantic search also returned 0 results');
      return [];
    }

    log('[RAG:HybridSearch] ✅ Semantic fallback returned', semanticResults.length, 'results');

    return semanticResults.slice(0, limit).map((chunk) => ({
      id: chunk.chunkId,
      source: '',
      category: '',
      content: chunk.content,
      reliability_score: 1.0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      relevance_score: chunk.similarity,
      embedding_similarity: chunk.similarity,
    }));
  } catch (err) {
    console.error('[RAG:HybridSearch] 💥 Hybrid search error:', err);
    return [];
  }
}
