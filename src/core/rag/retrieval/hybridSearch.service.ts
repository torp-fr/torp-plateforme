/**
 * RAG — Hybrid Search Service
 * Runs keyword and semantic search in parallel, merges results, then reranks.
 */

import { keywordSearch } from './keywordSearch.service';
import { semanticSearch } from '@/core/knowledge/ingestion/knowledgeIndex.service';
import { rerankChunks } from './reranker.service';
import { rewriteQuery } from './queryRewrite.service';
import { decomposeQuery } from './queryDecomposition.service';
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
 * Compute a retrieval limit that scales inversely with query length.
 * Shorter queries are broader and benefit from a larger candidate pool;
 * longer queries are more specific and require fewer results.
 *
 * Thresholds (token count, split on whitespace):
 *   < 4  tokens → 20
 *   < 10 tokens → 12
 *   ≥ 10 tokens →  8
 */
export function computeRetrievalLimit(query: string): number {
  const tokenCount = query.trim().split(/\s+/).filter(Boolean).length;
  if (tokenCount < 4) return 20;
  if (tokenCount < 10) return 12;
  return 8;
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
  const limit = options?.limit ?? computeRetrievalLimit(query);

  log('[RAG:HybridSearch] 🔍 Hybrid knowledge search:', query);

  try {
    // Step 1: rewrite query to improve retrieval quality (falls back on failure)
    const effectiveQuery = await rewriteQuery(query);
    if (effectiveQuery !== query) {
      log('[RAG:HybridSearch] ✏️ Using rewritten query:', effectiveQuery);
    }

    // Step 2: decompose into independent sub-queries for compound questions
    const subQueries = await decomposeQuery(effectiveQuery);
    log('[RAG:HybridSearch] 🔍 Running retrieval for', subQueries.length, 'sub-quer(ies)');

    // Step 3: run both searches concurrently for every sub-query, then flatten
    const allKeyword: SearchResult[] = [];
    const allSemantic: SearchResult[] = [];

    await Promise.all(
      subQueries.map(async (subQuery) => {
        const [kw, sem] = await Promise.all([
          keywordSearch(subQuery, limit, {
            category: options?.category,
            region: options?.region,
          }),
          semanticSearch(subQuery, limit),
        ]);
        allKeyword.push(...kw);
        allSemantic.push(...sem.map(semanticToSearchResult));
      })
    );

    log(
      '[RAG:HybridSearch] 📊 keyword=%d semantic=%d (across all sub-queries)',
      allKeyword.length,
      allSemantic.length,
    );

    if (allKeyword.length === 0 && allSemantic.length === 0) {
      warn('[RAG:HybridSearch] ⚠️ Both searches returned 0 results');
      return [];
    }

    const merged = mergeResults(allKeyword, allSemantic);

    log('[RAG:HybridSearch] 🔀 Merged pool size:', merged.length);

    return rerankChunks(effectiveQuery, merged, limit);
  } catch (err) {
    console.error('[RAG:HybridSearch] 💥 Hybrid search error:', err);
    return [];
  }
}
