/**
 * RAG Evaluation Suite — Metric Computations
 *
 * Pure functions: no I/O, no LLM calls, no side effects.
 * Each metric returns a normalized value in a documented range.
 */

import { SearchResult } from '../types';

// ---------------------------------------------------------------------------
// Retrieval recall
// ---------------------------------------------------------------------------

/**
 * Compute keyword-based retrieval recall.
 *
 * Checks whether the combined text of retrieved chunks contains each
 * expected keyword (case-insensitive substring match). Returns the
 * fraction of keywords that were found.
 *
 * @returns [0, 1] — 1.0 when all keywords are found or none expected.
 */
export function computeRetrievalRecall(
  retrievedChunks: SearchResult[],
  expectedKeywords?: string[],
): number {
  if (!expectedKeywords || expectedKeywords.length === 0) return 1;
  if (retrievedChunks.length === 0) return 0;

  const haystack = retrievedChunks
    .map((c) => c.content.toLowerCase())
    .join(' ');

  const matched = expectedKeywords.filter((kw) =>
    haystack.includes(kw.toLowerCase()),
  );

  return matched.length / expectedKeywords.length;
}

// ---------------------------------------------------------------------------
// Reranker effectiveness
// ---------------------------------------------------------------------------

/**
 * Estimate reranker effectiveness from the scores attached to returned chunks.
 *
 * Prefers LLM relevance scores (set by LlmReranker) over embedding similarity
 * (set by CosineReranker). Returns the mean score across all returned chunks.
 *
 * @returns [0, 1]
 */
export function computeRerankerScore(retrievedChunks: SearchResult[]): number {
  if (retrievedChunks.length === 0) return 0;

  // LLM cross-encoder scores take priority (richer signal)
  const llmScored = retrievedChunks.filter(
    (c) => typeof (c as any).llm_relevance_score === 'number',
  );
  if (llmScored.length > 0) {
    const sum = llmScored.reduce(
      (acc, c) => acc + ((c as any).llm_relevance_score as number),
      0,
    );
    return sum / llmScored.length;
  }

  // Fall back to embedding_similarity (cosine reranker)
  const withSim = retrievedChunks.filter(
    (c) => typeof c.embedding_similarity === 'number' && c.embedding_similarity > 0,
  );
  if (withSim.length === 0) return 0;

  return (
    withSim.reduce((acc, c) => acc + c.embedding_similarity, 0) / withSim.length
  );
}

// ---------------------------------------------------------------------------
// Citation score
// ---------------------------------------------------------------------------

/**
 * Compute citation coverage of an LLM-generated answer.
 *
 * Detects citation markers of the form [n] (e.g. [1], [12]).
 * Compares the count of markers against the number of non-trivial sentences
 * in the answer. Capped at 1.0.
 *
 * Heuristic: a sentence is "non-trivial" if it is longer than 20 characters
 * after trimming. This filters out short interjections ("Yes.", "No.", etc.).
 *
 * Edge cases:
 *   - Empty answer or no sentences → 1.0 (nothing to cite)
 *   - Non-trivial sentences present but zero citations → 0.0
 *
 * @returns [0, 1]
 */
export function computeCitationScore(answer: string): number {
  const sentences = answer
    .split(/[.!?]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 20);

  if (sentences.length === 0) return 1;

  const citationMatches = answer.match(/\[([0-9]+)\]/g) ?? [];

  if (citationMatches.length === 0) return 0;

  return Math.min(1, citationMatches.length / sentences.length);
}
