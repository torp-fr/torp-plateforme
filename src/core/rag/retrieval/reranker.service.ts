/**
 * RAG — Reranker Service
 * Pluggable reranker architecture for ranking retrieved chunks.
 *
 * Modes:
 *   "cosine" (default) — cosine similarity against pre-stored embedding_vector
 *                        Fast, deterministic, no LLM calls
 *   "llm"              — cross-encoder reranking via LLM
 *                        Slower but higher quality ranking, models query-chunk interaction
 *
 * Pipeline position:
 *   keywordSearch / semanticSearch → rerankChunks → caller
 */

import { generateEmbedding } from '../embeddings/embedding.service';
import { aiOrchestrator } from '@/services/ai/aiOrchestrator.service';
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
// LlmReranker — Cross-encoder reranking via LLM
// ---------------------------------------------------------------------------

class LlmReranker implements Reranker {
  /**
   * Rerank chunks using an LLM as a cross-encoder.
   *
   * For each chunk, uses the LLM to score relevance to the query from 0-1.
   * This captures query-chunk interaction and semantic understanding that
   * bi-encoder approaches (like cosine similarity) cannot model.
   *
   * Trade-offs:
   *   Pros:  Higher ranking quality, semantic understanding, query-aware
   *   Cons:  N LLM API calls (expensive), slower (~1-2s per chunk), quota limited
   *
   * Cost: ~$0.005 per chunk (GPT-4o-mini at 2K input tokens avg)
   * Latency: ~200-500ms per chunk (serial) or ~1-2s for batch (parallel)
   */
  async rerank(query: string, chunks: SearchResult[], topN: number): Promise<SearchResult[]> {
    if (chunks.length === 0) return [];

    log('[RAG:Reranker:LLM] 📊 Starting LLM cross-encoder reranking for', chunks.length, 'chunks');

    try {
      // Score each chunk in parallel using the LLM
      const scoredChunks = await Promise.all(
        chunks.map(async (chunk) => {
          const score = await this.scoreChunk(query, chunk);
          return { chunk: { ...chunk, llm_relevance_score: score }, score };
        })
      );

      // Sort by LLM relevance score (descending)
      scoredChunks.sort((a, b) => b.score - a.score);

      const topChunks = scoredChunks.slice(0, topN).map((s) => s.chunk);

      log('[RAG:Reranker:LLM] ✅ LLM reranking complete — top', topChunks.length, 'chunks selected');
      return topChunks;
    } catch (err) {
      warn('[RAG:Reranker:LLM] ⚠️ LLM reranking failed:', (err as Error).message);
      // Fallback: return chunks in original order
      return chunks.slice(0, topN);
    }
  }

  /**
   * Score a single chunk's relevance to the query using the LLM.
   *
   * Returns a score from 0 (irrelevant) to 1 (highly relevant).
   * Prompt is designed to elicit numeric scores for consistent parsing.
   */
  private async scoreChunk(query: string, chunk: SearchResult): Promise<number> {
    try {
      const systemPrompt =
        'You are an expert evaluator of document relevance. ' +
        'Score the relevance of a passage to a query from 0 to 1. ' +
        'Return ONLY a number between 0 and 1, for example: 0.85';

      const userPrompt =
        `Query: ${query}\n\n` +
        `Passage: ${chunk.content.substring(0, 500)}\n\n` +
        `Relevance score (0-1):`;

      const result = await aiOrchestrator.generateCompletion(userPrompt, {
        systemPrompt,
        temperature: 0.1, // Deterministic scoring
        maxTokens: 10, // Just a number
      } as any);

      // Parse the response — expect a number
      const scoreText = result.content.trim();
      const score = parseFloat(scoreText);

      if (isNaN(score) || score < 0 || score > 1) {
        warn('[RAG:Reranker:LLM] ⚠️ Invalid score response:', scoreText, '— defaulting to 0.5');
        return 0.5;
      }

      return score;
    } catch (err) {
      warn('[RAG:Reranker:LLM] ⚠️ Failed to score chunk:', (err as Error).message);
      return 0.5; // Default neutral score on error
    }
  }
}

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

export type RerankerMode = 'cosine' | 'llm';

const cosineReranker = new CosineReranker();
const llmReranker = new LlmReranker();

const RERANKERS: Record<RerankerMode, Reranker> = {
  cosine: cosineReranker,
  llm: llmReranker,
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
