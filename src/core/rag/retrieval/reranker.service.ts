/**
 * RAG — Reranker Service
 * Re-scores retrieved chunks using cosine similarity between the query
 * embedding and the pre-computed embedding stored in each chunk
 * (knowledge_chunks.embedding_vector). No chunk re-embedding required.
 *
 * Pipeline position:
 *   keywordSearch / semanticSearch → rerankChunks → caller
 */

import { generateEmbedding } from '../embeddings/embedding.service';
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
 * chunk's pre-stored embedding_vector (knowledge_chunks.embedding_vector).
 *
 * Steps:
 *   1. Generate query embedding (single API call)
 *   2. Score each chunk that carries embedding_vector via cosine similarity
 *      (chunks without embedding_vector are skipped — score stays 0)
 *   3. Sort descending and return top `topN` results
 *
 * Falls back to the original order if query embedding generation fails.
 */
export async function rerankChunks(
  query: string,
  chunks: SearchResult[],
  topN: number = DEFAULT_TOP_N
): Promise<SearchResult[]> {
  if (chunks.length === 0) return [];

  log('[RAG:Reranker] 🔀 Reranking', chunks.length, 'chunks for query:', query);

  // Step 1: query embedding (single API call — no chunk re-embedding)
  const queryEmbedding = await generateEmbedding(query);
  if (!queryEmbedding) {
    warn('[RAG:Reranker] ⚠️ Failed to generate query embedding — returning original order');
    return chunks.slice(0, topN);
  }

  // Step 2: score each chunk using its stored embedding_vector
  const scored = chunks.map((chunk) => {
    const chunkEmbedding = chunk.embedding_vector;
    const similarity = chunkEmbedding ? cosineSimilarity(queryEmbedding, chunkEmbedding) : 0;
    if (!chunkEmbedding) {
      warn('[RAG:Reranker] ⚠️ Chunk missing embedding_vector, score=0:', chunk.id);
    }
    return { chunk: { ...chunk, embedding_similarity: similarity }, similarity };
  });

  // Step 3: sort descending and return top N
  scored.sort((a, b) => b.similarity - a.similarity);

  const reranked = scored.slice(0, topN).map((s) => s.chunk);
  log('[RAG:Reranker] ✅ Reranked to top', reranked.length, 'chunks');

  return reranked;
}
