/**
 * RAG — Hybrid Search Service
 * Runs keyword and semantic search in parallel, merges results, then reranks.
 * Results are cached to eliminate redundant searches for repeated queries.
 */

import { keywordSearch } from './keywordSearch.service';
import { semanticSearch } from '@/core/knowledge/ingestion/knowledgeIndex.service';
import { rerankChunks } from './reranker.service';
import { rewriteQuery } from './queryRewrite.service';
import { decomposeQuery } from './queryDecomposition.service';
import { getCachedResults, cacheResults } from './retrievalCache.service';
import { recordRagTrace } from '../analytics/ragTracing.service';
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
 * documentId is used as the source fallback when source metadata is unavailable
 * (the match_knowledge_chunks RPC does not return document source/category fields).
 */
function semanticToSearchResult(chunk: {
  chunkId: string;
  content: string;
  similarity: number;
  documentId: string;
}): SearchResult {
  return {
    id: chunk.chunkId,
    source: chunk.documentId,
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
 *
 * Results are cached by (query, category, region) with a 5-minute TTL.
 * Repeated identical queries return instant cached results.
 */
export async function searchRelevantKnowledge(
  query: string,
  options?: {
    category?: string;
    region?: string;
    limit?: number;
  }
): Promise<SearchResult[]> {
  // Trace instrumentation
  const traceId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const pipelineStart = Date.now();
  let rewriteMs = 0;
  let decomposeMs = 0;
  let retrievalMs = 0;
  let rerankMs = 0;
  let rewrittenQuery = query;
  let subQueries: string[] = [];

  const limit = options?.limit ?? computeRetrievalLimit(query);

  log('[RAG:HybridSearch] 🔍 Hybrid knowledge search:', query);

  try {
    // Step 0: Check cache for existing results (using original query as key)
    const cachedResults = getCachedResults(query, options?.category, options?.region);
    if (cachedResults) {
      log('[RAG:HybridSearch] ⚡ Returning', cachedResults.length, 'cached results (skipping retrieval)');
      // Log cache hit trace (non-blocking)
      const totalMs = Date.now() - pipelineStart;
      recordRagTrace({
        traceId,
        query,
        retrievalLimit: limit,
        retrievalCount: cachedResults.length,
        compressedCount: cachedResults.length,
        totalMs,
      });
      return cachedResults;
    }
    // Step 1: rewrite query to improve retrieval quality (falls back on failure)
    const rewriteStart = Date.now();
    const effectiveQuery = await rewriteQuery(query);
    rewriteMs = Date.now() - rewriteStart;
    rewrittenQuery = effectiveQuery;
    if (effectiveQuery !== query) {
      log('[RAG:HybridSearch] ✏️ Using rewritten query:', effectiveQuery);
    }

    // Step 2: decompose into independent sub-queries for compound questions
    const decomposeStart = Date.now();
    subQueries = await decomposeQuery(effectiveQuery);
    decomposeMs = Date.now() - decomposeStart;
    log('[RAG:HybridSearch] 🔍 Running retrieval for', subQueries.length, 'sub-quer(ies)');

    // Step 3: run both searches concurrently for every sub-query, then flatten
    const retrievalStart = Date.now();
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
    retrievalMs = Date.now() - retrievalStart;

    log(
      '[RAG:HybridSearch] 📊 keyword=%d semantic=%d (across all sub-queries)',
      allKeyword.length,
      allSemantic.length,
    );

    if (allKeyword.length === 0 && allSemantic.length === 0) {
      warn('[RAG:HybridSearch] ⚠️ Both searches returned 0 results');
      const totalMs = Date.now() - pipelineStart;
      recordRagTrace({
        traceId,
        query,
        rewrittenQuery,
        subQueries,
        retrievalLimit: limit,
        retrievalCount: 0,
        compressedCount: 0,
        rewriteMs,
        decomposeMs,
        retrievalMs,
        totalMs,
      });
      return [];
    }

    const merged = mergeResults(allKeyword, allSemantic);

    log('[RAG:HybridSearch] 🔀 Merged pool size:', merged.length);

    // Step 4: Rerank (using default cosine mode unless specified)
    const rerankStart = Date.now();
    const finalResults = await rerankChunks(effectiveQuery, merged, limit);
    rerankMs = Date.now() - rerankStart;

    // Step 5: Cache the final results for future identical queries
    cacheResults(query, finalResults, options?.category, options?.region);

    // Log comprehensive trace (non-blocking fire-and-forget)
    const totalMs = Date.now() - pipelineStart;
    recordRagTrace({
      traceId,
      query,
      rewrittenQuery,
      subQueries,
      retrievalLimit: limit,
      retrievalCount: merged.length,
      compressedCount: finalResults.length,
      rerankMode: 'cosine', // Default mode
      rewriteMs,
      decomposeMs,
      retrievalMs,
      rerankMs,
      totalMs,
    });

    return finalResults;
  } catch (err) {
    console.error('[RAG:HybridSearch] 💥 Hybrid search error:', err);
    // Log error trace (non-blocking)
    const totalMs = Date.now() - pipelineStart;
    recordRagTrace({
      traceId,
      query,
      rewrittenQuery,
      subQueries,
      retrievalLimit: limit,
      retrievalCount: 0,
      compressedCount: 0,
      rewriteMs,
      decomposeMs,
      retrievalMs,
      rerankMs,
      totalMs,
    });
    return [];
  }
}
