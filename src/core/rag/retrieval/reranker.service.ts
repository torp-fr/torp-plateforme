/**
 * RAG — Reranker Service
 * Re-scores retrieved chunks using cosine similarity between the query
 * embedding and per-chunk content embeddings computed in memory.
 *
 * Pipeline position:
 *   keywordSearch / semanticSearch → rerankChunks → caller
 */

import { generateEmbedding, generateEmbeddingsBatch } from '../embeddings/embedding.service';
import { SearchResult } from '../types';
import { log, warn } from '@/lib/logger';

const DEFAULT_TOP_N = 10;

// ---------------------------------------------------------------------------
// Cosine similarity (in-memory, no dependencies)
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
// Public API
// ---------------------------------------------------------------------------

/**
 * Rerank chunks by cosine similarity between the query embedding and each
 * chunk's content embedding.
 *
 * Steps:
 *   1. Generate query embedding
 *   2. Batch-embed all chunk content strings
 *   3. Score each chunk via cosine similarity
 *   4. Sort descending and return top `topN` results
 *
 * Falls back to the original order if embedding generation fails.
 */
export async function rerankChunks(
  query: string,
  chunks: SearchResult[],
  topN: number = DEFAULT_TOP_N
): Promise<SearchResult[]> {
  if (chunks.length === 0) return [];

  log('[RAG:Reranker] 🔀 Reranking', chunks.length, 'chunks for query:', query);

  // Step 1: query embedding
  const queryEmbedding = await generateEmbedding(query);
  if (!queryEmbedding) {
    warn('[RAG:Reranker] ⚠️ Failed to generate query embedding — returning original order');
    return chunks.slice(0, topN);
  }

  // Step 2: batch-embed chunk content
  const batchResults = await generateEmbeddingsBatch(chunks.map((c) => c.content));

  // Step 3: score each chunk
  const scored = chunks.map((chunk, i) => {
    const chunkEmbedding = batchResults[i]?.embedding;
    const similarity = chunkEmbedding ? cosineSimilarity(queryEmbedding, chunkEmbedding) : 0;
    return { chunk: { ...chunk, embedding_similarity: similarity }, similarity };
  });

  // Step 4: sort descending and return top N
  scored.sort((a, b) => b.similarity - a.similarity);

  const reranked = scored.slice(0, topN).map((s) => s.chunk);
  log('[RAG:Reranker] ✅ Reranked to top', reranked.length, 'chunks');

  return reranked;
}
