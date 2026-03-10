/**
 * RAG — Reranker Service
 * Pluggable reranker architecture for ranking retrieved chunks.
 *
 * Modes:
 *   "cosine" (default) — cosine similarity against pre-stored embedding_vector
 *                        Fast, deterministic, no LLM calls
 *   "llm"              — batch cross-encoder reranking via LLM (1 API call for all chunks)
 *                        Higher quality ranking, query-aware; falls back to cosine on error
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
// LlmReranker — Batch cross-encoder reranking via LLM
// ---------------------------------------------------------------------------

class LlmReranker implements Reranker {
  /** Maximum characters taken from each chunk in the batch prompt. */
  private readonly CHUNK_TRUNCATION = 400;

  /**
   * Rerank chunks using a single batch LLM call.
   *
   * All passages are sent in one request; the LLM returns a JSON score map.
   * On any failure (LLM error or parse error) the error propagates to
   * rerankChunks(), which falls back to cosine reranking.
   *
   * Trade-offs vs. per-chunk calls:
   *   Pros:  1 API call regardless of N, ~10-50× cheaper, much lower latency
   *   Cons:  Very long prompts (>30 chunks) may degrade scoring accuracy
   *
   * Cost:    ~$0.005 for the whole batch (GPT-4o-mini, 2–4K tokens)
   * Latency: ~500-900ms per request (vs. N × 200-500ms previously)
   */
  async rerank(query: string, chunks: SearchResult[], topN: number): Promise<SearchResult[]> {
    if (chunks.length === 0) return [];

    log('[RAG:Reranker:LLM] 📊 Batch LLM reranking for', chunks.length, 'chunks');

    // Errors propagate to rerankChunks() → cosine fallback
    const scores = await this.scoreBatch(query, chunks);

    const scored = chunks.map((chunk, i) => ({
      chunk: { ...chunk, llm_relevance_score: scores[i] },
      score: scores[i],
    }));

    scored.sort((a, b) => b.score - a.score);
    const topChunks = scored.slice(0, topN).map((s) => s.chunk);

    log('[RAG:Reranker:LLM] ✅ Batch reranking complete — top', topChunks.length, 'selected');
    return topChunks;
  }

  /**
   * Score all chunks in a single LLM call.
   *
   * Prompt:
   *   Query: {query}
   *
   *   Passages:
   *   [1] <content>
   *   [2] <content>
   *   ...
   *
   *   Return JSON: {"1": 0.92, "2": 0.31, ...}
   *
   * Returns scores indexed 0…N-1 (matching the input array order).
   * Throws on LLM error or parse failure so the caller can fall back.
   */
  private async scoreBatch(query: string, chunks: SearchResult[]): Promise<number[]> {
    const passages = chunks
      .map((c, i) => `[${i + 1}] ${c.content.substring(0, this.CHUNK_TRUNCATION)}`)
      .join('\n');

    const systemPrompt =
      'You are an expert evaluator of document relevance. ' +
      'Given a query and numbered passages, score each passage from 0.0 (irrelevant) ' +
      'to 1.0 (highly relevant). ' +
      'Return ONLY a valid JSON object mapping each passage number to its score. ' +
      'Example for 3 passages: {"1": 0.92, "2": 0.31, "3": 0.75}';

    const userPrompt =
      `Query: ${query}\n\n` +
      `Passages:\n${passages}\n\n` +
      `Return JSON: {"1": score, "2": score, ...}`;

    const result = await aiOrchestrator.generateCompletion(userPrompt, {
      systemPrompt,
      temperature: 0.1,
      maxTokens: Math.max(50, chunks.length * 12), // ~12 tokens per score entry
    } as any);

    return this.parseScores(result.content, chunks.length);
  }

  /**
   * Parse the JSON score map returned by the LLM.
   *
   * Tolerant of surrounding prose and markdown fences: extracts the first
   * outermost JSON object found in the response text.
   *
   * Throws with a descriptive message on any parse failure so rerank()
   * propagates the error up to the cosine fallback in rerankChunks().
   */
  private parseScores(responseText: string, count: number): number[] {
    // Extract outermost { ... } — tolerant of prose/fences around the JSON
    const start = responseText.indexOf('{');
    const end = responseText.lastIndexOf('}');
    if (start === -1 || end === -1 || end <= start) {
      throw new Error(`No JSON object found in LLM response: "${responseText.substring(0, 120)}"`);
    }

    const raw = JSON.parse(responseText.slice(start, end + 1)) as Record<string, unknown>;

    const scores: number[] = [];
    for (let i = 1; i <= count; i++) {
      const val = raw[String(i)];
      const score = typeof val === 'number' ? val : parseFloat(String(val));
      if (isNaN(score) || score < 0 || score > 1) {
        throw new Error(`Invalid score for passage ${i}: ${JSON.stringify(val)}`);
      }
      scores.push(score);
    }

    return scores; // 0-indexed, length === count
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
