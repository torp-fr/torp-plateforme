/**
 * RAG — Reranker Service
 * Pluggable reranker architecture.
 *
 * Modes:
 *   "cosine" (default) — cosine similarity against pre-stored embedding_vector
 *   "llm"              — reserved for a future external reranker API
 *
 * Pipeline position:
 *   keywordSearch / semanticSearch → rerankChunks → caller
 */

import { generateEmbedding } from '../embeddings/embedding.service';
import { SearchResult } from '../types';
import { log, warn } from '@/lib/logger';

const DEFAULT_TOP_N = 10;

// ---------------------------------------------------------------------------
// Reranker interface
// ---------------------------------------------------------------------------

interface Reranker {
  rerank(query: string, chunks: SearchResult[], topN: number): Promise<SearchResult[]>;
}

// ---------------------------------------------------------------------------
// Cosine similarity helper
// ---------------------------------------------------------------------------

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

// ---------------------------------------------------------------------------
// CosineReranker
// ---------------------------------------------------------------------------

class CosineReranker implements Reranker {
  async rerank(query: string, chunks: SearchResult[], topN: number): Promise<SearchResult[]> {
    const queryEmbedding = await generateEmbedding(query);
    if (!queryEmbedding) {
      warn('[RAG:Reranker] ⚠️ Failed to generate query embedding — returning original order');
      return chunks.slice(0, topN);
    }

    const scored = chunks.map((chunk) => {
      const chunkEmbedding = chunk.embedding_vector;
      const similarity = chunkEmbedding ? cosineSimilarity(queryEmbedding, chunkEmbedding) : 0;
      if (!chunkEmbedding) {
        warn('[RAG:Reranker] ⚠️ Chunk missing embedding_vector, score=0:', chunk.id);
      }
      return { chunk: { ...chunk, embedding_similarity: similarity }, similarity };
    });

    scored.sort((a, b) => b.similarity - a.similarity);
    return scored.slice(0, topN).map((s) => s.chunk);
  }
}

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

export type RerankerMode = 'cosine' | 'llm';

const cosineReranker = new CosineReranker();

const RERANKERS: Partial<Record<RerankerMode, Reranker>> = {
  cosine: cosineReranker,
  // "llm" will be registered here once the external reranker is implemented
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface RerankOptions {
  mode?: RerankerMode;
}

/**
 * Rerank chunks using the selected strategy.
 *
 * @param query   - The original user query.
 * @param chunks  - Candidate chunks from the retrieval step.
 * @param topN    - Maximum number of results to return.
 * @param options - { mode: "cosine" (default) | "llm" }
 */
export async function rerankChunks(
  query: string,
  chunks: SearchResult[],
  topN: number = DEFAULT_TOP_N,
  options: RerankOptions = {},
): Promise<SearchResult[]> {
  if (chunks.length === 0) return [];

  const mode: RerankerMode = options.mode ?? 'cosine';
  log('[RAG:Reranker] 🔀 Reranking', chunks.length, 'chunks — mode:', mode);

  try {
    const reranker = RERANKERS[mode];
    if (!reranker) throw new Error(`Reranker "${mode}" is not registered`);
    const reranked = await reranker.rerank(query, chunks, topN);
    log('[RAG:Reranker] ✅ Reranked to top', reranked.length, 'chunks');
    return reranked;
  } catch (err) {
    warn(`[RAG:Reranker] ⚠️ Reranker "${mode}" failed — falling back to cosine:`, (err as Error).message);
    const reranked = await cosineReranker.rerank(query, chunks, topN);
    log('[RAG:Reranker] ✅ Cosine fallback reranked to top', reranked.length, 'chunks');
    return reranked;
  }
}
