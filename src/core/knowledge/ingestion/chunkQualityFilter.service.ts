/**
 * Chunk Quality Filter Service
 * Rejects low-quality chunks before embeddings are generated and attaches
 * a quality score to every chunk that passes.
 *
 * Position in the ingestion pipeline:
 *   SmartChunker → [THIS SERVICE] → EmbeddingGenerator
 *
 * Rejection rules (any one condition is enough to discard a chunk):
 *  R1  tokenCount < 20          — too short to carry useful semantics
 *  R2  tokenCount > 4000        — too large; integrity engine would also flag it
 *  R3  alphabetic ratio < 0.2   — mostly numbers, symbols, or whitespace
 *  R4  pure numeric/symbol      — no prose content at all
 *
 * Quality score (0–1, attached to chunk.metadata.qualityScore):
 *  score = 0.5 × lengthScore + 0.5 × alphaScore
 *
 *  lengthScore — 1.0 inside the ideal token range [50, 400], linearly
 *                ramped down outside it (still > 0 within [20, 1000])
 *  alphaScore  — alphabetic-character ratio clamped to [0, 1]
 */

import type { Chunk } from './smartChunker.service';
import { log } from '@/lib/logger';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MIN_TOKENS = 20;
const MAX_TOKENS = 4000;

/** Ideal token range — full lengthScore within these bounds */
const IDEAL_MIN_TOKENS = 50;
const IDEAL_MAX_TOKENS = 400;

/** Minimum fraction of alphabetic characters required to pass */
const MIN_ALPHA_RATIO = 0.2;

// ---------------------------------------------------------------------------
// Metrics
// ---------------------------------------------------------------------------

/** Count characters that are Unicode letters (covers accented and non-Latin) */
function countAlpha(text: string): number {
  return (text.match(/\p{L}/gu) ?? []).length;
}

/** Alphabetic ratio: letters / total non-whitespace characters */
function alphaRatio(text: string): number {
  const nonWhitespace = text.replace(/\s/g, '').length;
  if (nonWhitespace === 0) return 0;
  return countAlpha(text) / nonWhitespace;
}

/**
 * Length score in [0, 1].
 *
 * Ideal range [IDEAL_MIN_TOKENS, IDEAL_MAX_TOKENS] → 1.0
 * Below IDEAL_MIN_TOKENS → linear ramp from 0 at MIN_TOKENS to 1 at IDEAL_MIN_TOKENS
 * Above IDEAL_MAX_TOKENS → linear ramp from 1 at IDEAL_MAX_TOKENS to 0 at MAX_TOKENS
 */
function lengthScore(tokenCount: number): number {
  if (tokenCount < MIN_TOKENS || tokenCount > MAX_TOKENS) return 0;
  if (tokenCount < IDEAL_MIN_TOKENS) {
    return (tokenCount - MIN_TOKENS) / (IDEAL_MIN_TOKENS - MIN_TOKENS);
  }
  if (tokenCount > IDEAL_MAX_TOKENS) {
    return (MAX_TOKENS - tokenCount) / (MAX_TOKENS - IDEAL_MAX_TOKENS);
  }
  return 1;
}

/**
 * Compute the composite quality score for one chunk.
 * Returns a value in [0, 1] — higher is better.
 */
function computeQualityScore(chunk: Chunk): number {
  const ls = lengthScore(chunk.tokenCount);
  const as = Math.min(1, alphaRatio(chunk.content));
  return parseFloat((0.5 * ls + 0.5 * as).toFixed(4));
}

// ---------------------------------------------------------------------------
// Rejection tests
// ---------------------------------------------------------------------------

/** R1 — below minimum token threshold */
function isTooShort(chunk: Chunk): boolean {
  return chunk.tokenCount < MIN_TOKENS;
}

/** R2 — above maximum token threshold */
function isTooLong(chunk: Chunk): boolean {
  return chunk.tokenCount > MAX_TOKENS;
}

/** R3 — alphabetic content is too sparse */
function isAlphaTooLow(chunk: Chunk): boolean {
  return alphaRatio(chunk.content) < MIN_ALPHA_RATIO;
}

/** R4 — content is exclusively digits, punctuation, and whitespace */
function isPureNumericOrSymbol(chunk: Chunk): boolean {
  return !/\p{L}/u.test(chunk.content);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Filter a list of chunks, removing low-quality entries and annotating
 * survivors with a `qualityScore` in their metadata.
 *
 * @param chunks - Raw chunks produced by SmartChunker
 * @returns Filtered chunks, each with metadata.qualityScore attached
 */
export function filterChunks(chunks: Chunk[]): Chunk[] {
  let rejectedShort = 0;
  let rejectedLong = 0;
  let rejectedAlpha = 0;
  let rejectedSymbol = 0;

  const passed: Chunk[] = [];

  for (const chunk of chunks) {
    // Evaluate rejection rules in cheapest-first order
    if (isTooShort(chunk)) {
      rejectedShort++;
      continue;
    }
    if (isTooLong(chunk)) {
      rejectedLong++;
      continue;
    }
    if (isPureNumericOrSymbol(chunk)) {
      rejectedSymbol++;
      continue;
    }
    if (isAlphaTooLow(chunk)) {
      rejectedAlpha++;
      continue;
    }

    // Chunk passes — attach quality score to metadata
    passed.push({
      ...chunk,
      metadata: {
        ...chunk.metadata,
        qualityScore: computeQualityScore(chunk),
      },
    });
  }

  const totalRejected = rejectedShort + rejectedLong + rejectedAlpha + rejectedSymbol;

  log(
    '[ChunkQualityFilter] Input:', chunks.length,
    '| Passed:', passed.length,
    '| Rejected:', totalRejected,
    `(short=${rejectedShort} long=${rejectedLong} symbol=${rejectedSymbol} alpha=${rejectedAlpha})`
  );

  return passed;
}
