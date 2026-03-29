/**
 * Work Type Detection Service
 *
 * Detects construction work types from free-text quote descriptions using
 * weighted keyword and phrase matching.
 *
 * Algorithm:
 *
 *   1. Normalize input text to lowercase, strip diacritics (NFD), collapse
 *      whitespace — so "Chape Flottante" and "châpe flottante" both match.
 *
 *   2. For each WorkType:
 *      a. Test each phrase (weight = PHRASE_WEIGHT = 2).
 *      b. Test each keyword (weight = KEYWORD_WEIGHT = 1).
 *      c. Accumulate matched_score (sum of weights of matched items).
 *
 *   3. Confidence = matched_score / maxScoreForWorkType(type), capped at 1.0.
 *
 *   4. Only emit a DetectedWorkType when:
 *      - confidence ≥ DETECTION_THRESHOLD (0.15)
 *      - At least one keyword or phrase matched.
 *
 *   5. Sort results by confidence descending.
 *
 * Threshold rationale:
 *   0.15 is intentionally low to maximise recall. False positives at low
 *   confidence are harmless — they activate rules that may be non_verifiable,
 *   which is better than missing a real obligation. The decision engine
 *   downstream uses confidence ≥ 0.5 to distinguish primary from secondary.
 *
 * Source excerpt:
 *   The first 200 characters of the raw (un-normalised) input text that
 *   contains the earliest match is returned for audit purposes.
 */

import type { DetectedWorkType, WorkType } from './workTypes';
import { WORK_TYPES } from './workTypes';
import {
  WORK_TYPE_KEYWORDS,
  PHRASE_WEIGHT,
  KEYWORD_WEIGHT,
  maxScoreForWorkType,
} from './workTypeKeywords';

// =============================================================================
// Constants
// =============================================================================

/**
 * Minimum confidence score to include a work type in the result set.
 * Set intentionally low to maximise recall.
 */
export const DETECTION_THRESHOLD = 0.15;

// =============================================================================
// Text normalisation
// =============================================================================

/**
 * Normalise a string for accent-insensitive matching:
 *   1. Lowercase
 *   2. Unicode NFD decomposition (splits accented chars into base + combining)
 *   3. Strip combining diacritical marks (U+0300–U+036F)
 *   4. Collapse whitespace sequences to a single space
 *   5. Trim
 */
export function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036F]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// =============================================================================
// Single work type detection
// =============================================================================

interface MatchResult {
  matched_score:    number;
  matched_keywords: string[];
  /** Earliest character position of any match in the normalised text */
  earliest_pos:     number;
}

function matchWorkType(normalized: string, type: WorkType): MatchResult {
  const spec        = WORK_TYPE_KEYWORDS[type];
  let   matched_score    = 0;
  const matched_keywords: string[] = [];
  let   earliest_pos = Infinity;

  // Phrase matching first (higher weight, more specific)
  for (const phrase of spec.phrases) {
    const normalizedPhrase = normalizeText(phrase);
    const pos = normalized.indexOf(normalizedPhrase);
    if (pos !== -1) {
      matched_score += PHRASE_WEIGHT;
      matched_keywords.push(phrase);
      if (pos < earliest_pos) earliest_pos = pos;
    }
  }

  // Single keyword matching
  for (const keyword of spec.keywords) {
    const normalizedKw = normalizeText(keyword);
    // Word-boundary-like check: ensure the keyword is a whole token
    // (preceded and followed by non-alphanumeric or string boundary)
    const re = new RegExp(`(?<![a-z0-9])${escapeRegex(normalizedKw)}(?![a-z0-9])`, 'g');
    const match = re.exec(normalized);
    if (match) {
      matched_score += KEYWORD_WEIGHT;
      matched_keywords.push(keyword);
      if (match.index < earliest_pos) earliest_pos = match.index;
    }
  }

  return { matched_score, matched_keywords, earliest_pos };
}

/** Escape special regex characters in a literal string */
function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// =============================================================================
// Source excerpt extraction
// =============================================================================

/**
 * Return up to 200 characters of the original (un-normalised) text starting
 * near the earliest match position. The raw text is used so the excerpt is
 * human-readable in audit logs.
 *
 * @param raw        Original un-normalised text
 * @param startPos   Approximate character position in normalised text.
 *                   Since normalisation only changes diacritics and case (not
 *                   character count for most inputs), we use it as an index
 *                   into raw text directly as a best-effort approximation.
 */
function extractSourceExcerpt(raw: string, startPos: number): string {
  // Guard against Infinity (no match found — should not reach here)
  const safeStart = Math.max(0, Math.min(startPos, raw.length - 1));
  // Include a small lead-in for context
  const from = Math.max(0, safeStart - 20);
  return raw.slice(from, from + 200);
}

// =============================================================================
// Public API
// =============================================================================

/**
 * Detect construction work types present in a free-text quote description.
 *
 * @param text - The raw quote text (may contain diacritics, mixed case, line breaks)
 * @returns Array of detected work types, sorted by confidence descending,
 *          filtered to confidence ≥ DETECTION_THRESHOLD.
 */
export function detectWorkTypes(text: string): DetectedWorkType[] {
  if (!text || typeof text !== 'string') return [];

  const normalized = normalizeText(text);
  const results: DetectedWorkType[] = [];

  for (const type of WORK_TYPES) {
    const { matched_score, matched_keywords, earliest_pos } = matchWorkType(normalized, type);

    if (matched_score === 0) continue;

    const maxScore  = maxScoreForWorkType(type);
    const confidence = Math.min(matched_score / maxScore, 1.0);

    if (confidence < DETECTION_THRESHOLD) continue;

    results.push({
      work_type:        type,
      confidence:       Math.round(confidence * 1000) / 1000, // 3 decimal places
      matched_keywords: Array.from(new Set(matched_keywords)), // deduplicate
      source_excerpt:   extractSourceExcerpt(text, earliest_pos),
    });
  }

  // Sort by confidence descending
  results.sort((a, b) => b.confidence - a.confidence);

  return results;
}
