/**
 * RAG — Hybrid Search Service
 * Runs keyword and semantic search in parallel, merges results, then reranks.
 */

import { keywordSearch } from './keywordSearch.service';
import { semanticSearch } from '@/core/knowledge/ingestion/knowledgeIndex.service';
import { rerankChunks } from './reranker.service';
import { SearchResult } from '../types';
import { log, warn } from '@/lib/logger';

/**
 * Merge keyword and semantic results, deduplicating by chunk id.
 * When the same chunk appears in both sets, keep the highest relevance_score.
 */
function mergeResults(
  keywordResults: SearchResult[],
  semanticResults: SearchResult[],
): SearchResult[] {
  const byId = new Map<string, SearchResult>();

  for (const result of [...keywordResults, ...semanticResults]) {
    const existing = byId.get(result.id);
    if (!existing || result.relevance_score > existing.relevance_score) {
      byId.set(result.id, result);
    }
  }

  return Array.from(byId.values());
}

/**
 * Map a semantic chunk to the shared SearchResult shape.
 */
function semanticToSearchResult(chunk: {
  chunkId: string;
  content: string;
  similarity: number;
}): SearchResult {
  return {
    id: chunk.chunkId,
    source: '',
    category: '',
    content: chunk.content,
    reliability_score: 1.0,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    relevance_score: chunk.similarity,
    embedding_similarity: chunk.similarity,
  };
}

/**
 * Search for relevant knowledge using true hybrid retrieval:
 * keyword + semantic run in parallel, results are merged and reranked.
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
    // Run both searches concurrently — neither blocks the other
    const [keywordResults, rawSemanticResults] = await Promise.all([
      keywordSearch(query, limit, {
        category: options?.category,
        region: options?.region,
      }),
      semanticSearch(query, limit),
    ]);

    log(
      '[RAG:HybridSearch] 📊 keyword=%d semantic=%d',
      keywordResults.length,
      rawSemanticResults.length,
    );

    if (keywordResults.length === 0 && rawSemanticResults.length === 0) {
      warn('[RAG:HybridSearch] ⚠️ Both searches returned 0 results');
      return [];
    }

    const semanticResults = rawSemanticResults.map(semanticToSearchResult);
    const merged = mergeResults(keywordResults, semanticResults);

    log('[RAG:HybridSearch] 🔀 Merged pool size:', merged.length);

    return rerankChunks(query, merged, limit);
  } catch (err) {
    console.error('[RAG:HybridSearch] 💥 Hybrid search error:', err);
    return [];
  }
}
