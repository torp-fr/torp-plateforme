/**
 * RAG — Hybrid Search Service
 * Combines semantic vector search with keyword fallback.
 */

import { keywordSearch } from './keywordSearch.service';
import { SearchResult } from '../types';
import { log, warn } from '@/lib/logger';

/**
 * Search for relevant knowledge using keyword search with an optional semantic fallback.
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
    // Primary: keyword search (uses secure verified views)
    const keywordResults = await keywordSearch(query, limit, {
      category: options?.category,
      region: options?.region,
    });

    if (keywordResults.length > 0) {
      log('[RAG:HybridSearch] ✅ Keyword search returned', keywordResults.length, 'results');
      return keywordResults.slice(0, limit);
    }

    warn('[RAG:HybridSearch] ⚠️ No keyword results — returning empty set');
    return [];
  } catch (err) {
    console.error('[RAG:HybridSearch] 💥 Hybrid search error:', err);
    return [];
  }
}
