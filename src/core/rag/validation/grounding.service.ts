/**
 * RAG — Answer Grounding Validation Service
 * Validates that LLM-generated answers are grounded in retrieved knowledge.
 *
 * Pipeline:
 * 1. Extracts key sentences from the answer.
 * 2. For each sentence, computes a weighted grounding score:
 *    - Token overlap against retrieved chunks  (weight: 0.6)
 *    - Numeric consistency (numbers + units)   (weight: 0.4)
 * 3. Computes a mean support score across all sentences (0–100%).
 * 4. Warns if score falls below threshold (default: 70%).
 *
 * Numeric consistency catches hallucinated figures that token overlap misses:
 * - Bare numbers must appear in at least one retrieved chunk.
 * - Unit+value pairs (e.g. "45 mm", "3.5 kWh") are checked as a unit —
 *   both the value and the unit must co-occur in a chunk.
 */

import { SearchResult } from '../types';
import { log } from '@/lib/logger';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface GroundingResult {
  isGrounded: boolean;
  supportScore: number; // 0-100% (mean weighted sentence score)
  groundedSentences: number; // count of sentences with score ≥ threshold
  totalSentences: number;
  warnings: string[];
  details: {
    sentenceSupport: Array<{ sentence: string; supported: boolean; matchedChunks: string[] }>;
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Configuration
// ─────────────────────────────────────────────────────────────────────────────

const GROUNDING_THRESHOLD = 70; // Minimum support score (%) to consider answer grounded
const MIN_SENTENCE_LENGTH = 10; // Ignore very short sentences (noise filtering)
const SIMILARITY_THRESHOLD = 0.3; // Minimum weighted sentence score to be "supported"

/** Weighted combination: token match 60%, numeric consistency 40% */
const TOKEN_MATCH_WEIGHT = 0.6;
const NUMERIC_MATCH_WEIGHT = 0.4;

// ─────────────────────────────────────────────────────────────────────────────
// Numeric & Unit Patterns
// ─────────────────────────────────────────────────────────────────────────────

/** Physical and financial units tracked for hallucination detection. */
const DETECTABLE_UNITS = ['%', 'm²', 'm2', 'kWh', '€', 'mm', 'cm', 'kg', 'MPa'];

/**
 * Matches number+unit pairs like "45 kWh", "3.5m²", "1,200€".
 * Built once from DETECTABLE_UNITS for efficiency.
 */
const UNIT_VALUE_RE = new RegExp(
  `\\d+(?:[.,]\\d+)?\\s*(?:${DETECTABLE_UNITS.join('|')})`,
  'g'
);

/** Matches standalone numbers: integers and decimals (e.g. 45, 3.14, 1,234). */
const BARE_NUMBER_RE = /\d+(?:[.,]\d+)?/g;

// ─────────────────────────────────────────────────────────────────────────────
// Numeric Claim Extraction
// ─────────────────────────────────────────────────────────────────────────────

interface NumericClaim {
  /** Normalized form for chunk matching — no whitespace (e.g. "45mm", "3.5kWh"). */
  compact: string;
  /** Whether this claim has a unit; unit+value are checked strictly together. */
  isUnitValue: boolean;
}

/**
 * Extract all numeric claims from a sentence, avoiding double-counting.
 *
 * Strategy:
 * - Pass 1: find all unit+value pairs and record their character spans.
 * - Pass 2: find all bare numbers; skip any position already covered by a span.
 *
 * This ensures "45mm" yields one claim (unit+value) rather than two (number + unit).
 */
function extractNumericClaims(sentence: string): NumericClaim[] {
  const claims: NumericClaim[] = [];
  const coveredRanges: Array<[number, number]> = [];

  // Pass 1: unit+value pairs (strict check)
  for (const m of sentence.matchAll(UNIT_VALUE_RE)) {
    const start = m.index!;
    const end = start + m[0].length;
    coveredRanges.push([start, end]);
    claims.push({ compact: m[0].replace(/\s+/g, ''), isUnitValue: true });
  }

  // Pass 2: bare numbers not already inside a unit+value span
  for (const m of sentence.matchAll(BARE_NUMBER_RE)) {
    const start = m.index!;
    const end = start + m[0].length;
    const isCovered = coveredRanges.some(([rs, re]) => start >= rs && end <= re);
    if (!isCovered) {
      claims.push({ compact: m[0], isUnitValue: false });
    }
  }

  return claims;
}

// ─────────────────────────────────────────────────────────────────────────────
// Token Helpers
// ─────────────────────────────────────────────────────────────────────────────

function extractSentences(text: string): string[] {
  if (!text) return [];
  return text
    .split(/[.!?]+/)
    .map((s) => s.trim())
    .filter((s) => s.length >= MIN_SENTENCE_LENGTH);
}

function tokenize(text: string): Set<string> {
  const normalized = text.toLowerCase().replace(/[^\w\s]/g, ' ');
  return new Set(normalized.split(/\s+/).filter((t) => t.length > 2));
}

// ─────────────────────────────────────────────────────────────────────────────
// Sentence Scoring
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Score one sentence's grounding against all retrieved chunks.
 *
 *   sentence_score = (best_token_overlap × 0.6) + (numeric_consistency × 0.4)
 *
 * Token overlap: highest overlap ratio across all chunks.
 * Numeric consistency:
 *   - 1.0 when sentence contains no numbers (vacuously consistent).
 *   - For unit+value claims: compact form must appear in compact chunk text.
 *   - For bare number claims: number must appear anywhere in chunk text.
 *
 * A sentence is "supported" when sentence_score ≥ SIMILARITY_THRESHOLD.
 */
function scoreSentence(
  sentence: string,
  chunks: SearchResult[]
): { score: number; supported: boolean; matchedChunks: string[] } {
  // ── Token overlap ─────────────────────────────────────────────────────────
  const sentenceTokens = tokenize(sentence);
  const matchedChunks: string[] = [];
  let bestTokenOverlap = 0;

  for (const chunk of chunks) {
    const chunkTokens = tokenize(chunk.content);
    let overlaps = 0;
    for (const t of sentenceTokens) {
      if (chunkTokens.has(t)) overlaps++;
    }
    const ratio = sentenceTokens.size > 0 ? overlaps / sentenceTokens.size : 0;
    if (ratio > bestTokenOverlap) bestTokenOverlap = ratio;
    if (ratio >= SIMILARITY_THRESHOLD) matchedChunks.push(chunk.id);
  }

  // ── Numeric consistency ───────────────────────────────────────────────────
  const claims = extractNumericClaims(sentence);
  let numericScore = 1.0; // vacuously consistent when no numeric claims

  if (claims.length > 0) {
    const allChunkText = chunks.map((c) => c.content).join(' ');
    const compactChunkText = allChunkText.replace(/\s+/g, ''); // unit+value matching

    let supported = 0;
    for (const claim of claims) {
      if (claim.isUnitValue) {
        // Strict: value and unit must co-occur (compact form found in compact text)
        if (compactChunkText.includes(claim.compact)) supported++;
      } else {
        // Loose: bare number present anywhere in chunk text
        if (allChunkText.includes(claim.compact)) supported++;
      }
    }
    numericScore = supported / claims.length;
  }

  // ── Weighted sentence score ───────────────────────────────────────────────
  const score = bestTokenOverlap * TOKEN_MATCH_WEIGHT + numericScore * NUMERIC_MATCH_WEIGHT;

  return { score, supported: score >= SIMILARITY_THRESHOLD, matchedChunks };
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Validation Function
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Validate that an LLM-generated answer is grounded in retrieved knowledge.
 *
 * supportScore is the mean weighted sentence score (0–100%), reflecting both
 * textual similarity and numeric consistency with retrieved chunks.
 *
 * @param answer          - The LLM-generated response text
 * @param retrievedChunks - The chunks used to generate the answer
 * @returns GroundingResult with weighted support score and per-sentence details
 */
export function validateGrounding(answer: string, retrievedChunks: SearchResult[]): GroundingResult {
  if (!answer || answer.trim().length === 0) {
    return {
      isGrounded: false,
      supportScore: 0,
      groundedSentences: 0,
      totalSentences: 0,
      warnings: ['Empty answer cannot be grounded'],
      details: { sentenceSupport: [] },
    };
  }

  if (retrievedChunks.length === 0) {
    return {
      isGrounded: false,
      supportScore: 0,
      groundedSentences: 0,
      totalSentences: 0,
      warnings: ['No retrieved chunks to ground answer against'],
      details: { sentenceSupport: [] },
    };
  }

  const sentences = extractSentences(answer);

  if (sentences.length === 0) {
    return {
      isGrounded: false,
      supportScore: 0,
      groundedSentences: 0,
      totalSentences: 0,
      warnings: ['No extractable sentences from answer'],
      details: { sentenceSupport: [] },
    };
  }

  // Score each sentence using weighted token overlap + numeric consistency
  const scored = sentences.map((sentence) => {
    const { score, supported, matchedChunks } = scoreSentence(sentence, retrievedChunks);
    return {
      sentence: sentence.substring(0, 80) + (sentence.length > 80 ? '...' : ''),
      supported,
      matchedChunks,
      _score: score,
    };
  });

  const groundedSentences = scored.filter((s) => s.supported).length;
  const meanScore = scored.reduce((sum, s) => sum + s._score, 0) / scored.length;
  const supportScore = Math.round(meanScore * 100);

  const sentenceSupport = scored.map(({ sentence, supported, matchedChunks }) => ({
    sentence,
    supported,
    matchedChunks,
  }));

  // Build warnings
  const warnings: string[] = [];

  if (supportScore < GROUNDING_THRESHOLD) {
    warnings.push(
      `Answer may not be fully supported by retrieved knowledge (support score: ${supportScore}%). ` +
        `${sentences.length - groundedSentences} of ${sentences.length} sentences lack grounding.`
    );
  }

  const unsupportedSentences = sentenceSupport.filter((s) => !s.supported);
  if (unsupportedSentences.length > 0 && unsupportedSentences.length <= 3) {
    warnings.push(
      `Ungrounded claims: ${unsupportedSentences.map((s) => `"${s.sentence}"`).join('; ')}`
    );
  }

  log('[RAG:Grounding] ✓ Grounding validation complete:', {
    supportScore,
    groundedSentences,
    totalSentences: sentences.length,
    isGrounded: supportScore >= GROUNDING_THRESHOLD,
  });

  return {
    isGrounded: supportScore >= GROUNDING_THRESHOLD,
    supportScore,
    groundedSentences,
    totalSentences: sentences.length,
    warnings,
    details: { sentenceSupport },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Formatting
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Format grounding result for logging and user display.
 */
export function formatGroundingResult(result: GroundingResult): string {
  const status = result.isGrounded ? '✅ GROUNDED' : '⚠️ PARTIAL GROUNDING';
  const line1 = `${status} — Support Score: ${result.supportScore}% (${result.groundedSentences}/${result.totalSentences} sentences)`;

  if (result.warnings.length === 0) {
    return line1;
  }

  const warningLines = result.warnings.map((w) => `  • ${w}`);
  return `${line1}\n${warningLines.join('\n')}`;
}
