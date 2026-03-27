/**
 * Project Detection Service
 *
 * Detects the most likely ProjectType from a free-text description
 * (devis title, project description, cover letter).
 *
 * Algorithm — identical approach to workTypeDetection.service.ts:
 *
 *   1. Normalize input (lowercase, strip diacritics, collapse whitespace).
 *   2. For each ProjectType, score phrase matches (weight 2) + keyword matches (weight 1).
 *   3. Confidence = matched_score / maxScore, capped at 1.0.
 *   4. Return scored candidates sorted by confidence descending.
 *   5. Primary project type = candidates[0] (highest confidence).
 *
 * Disambiguation:
 *   When multiple project types score within 0.1 of each other, the service
 *   returns all candidates above DETECTION_THRESHOLD so the caller can apply
 *   domain heuristics (e.g. "piscine + terrasse" → PISCINE primary, TERRASSE secondary).
 *
 * Fallback:
 *   When no type exceeds the threshold, falls back to RENOVATION because it
 *   is the broadest category and covers the widest range of unclassified work.
 */

import type { ProjectType }          from './projectTypes';
import { PROJECT_TYPES }             from './projectTypes';
import { PROJECT_BLUEPRINTS }        from './projectBlueprints';

// =============================================================================
// Constants
// =============================================================================

/** Minimum confidence to include a candidate in results */
export const PROJECT_DETECTION_THRESHOLD = 0.10;

// =============================================================================
// Normalisation (shared with workTypeDetection)
// =============================================================================

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036F]/g, '')
    .replace(/['']/g, ' ')
    .replace(/[-_]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// =============================================================================
// Score computation
// =============================================================================

function maxScoreForType(type: ProjectType): number {
  const bp    = PROJECT_BLUEPRINTS[type];
  // phrases weight 2, keywords weight 1
  return bp.detection_phrases.length * 2 + bp.detection_keywords.length * 1;
}

function scoreType(
  normalized: string,
  type: ProjectType,
): { score: number; matched: string[] } {
  const bp      = PROJECT_BLUEPRINTS[type];
  let   score   = 0;
  const matched: string[] = [];

  // Phrase matching (weight 2)
  for (const phrase of bp.detection_phrases) {
    const normPhrase = normalize(phrase);
    if (normalized.includes(normPhrase)) {
      score += 2;
      matched.push(phrase);
    }
  }

  // Keyword matching (weight 1, whole-token)
  for (const kw of bp.detection_keywords) {
    const normKw = normalize(kw);
    // Allow multi-word keywords (e.g. "gros oeuvre")
    const re = new RegExp(`(?<![a-z0-9])${escapeRegex(normKw)}(?![a-z0-9])`, 'g');
    if (re.test(normalized)) {
      score += 1;
      matched.push(kw);
    }
  }

  return { score, matched };
}

// =============================================================================
// Public types
// =============================================================================

export interface ProjectTypeCandidate {
  project_type: ProjectType;
  confidence:   number;
  matched:      string[];
}

// =============================================================================
// Public API
// =============================================================================

/**
 * Detect all plausible project types from a free-text description.
 *
 * @param text - Raw project description or devis title
 * @returns Candidates sorted by confidence descending, filtered by threshold.
 *          Always returns at least one candidate (fallback = RENOVATION).
 */
export function detectProjectTypeCandidates(text: string): ProjectTypeCandidate[] {
  if (!text || typeof text !== 'string') {
    return [{ project_type: 'RENOVATION', confidence: 0, matched: [] }];
  }

  const normalized = normalize(text);
  const candidates: ProjectTypeCandidate[] = [];

  for (const type of PROJECT_TYPES) {
    const max = maxScoreForType(type);
    if (max === 0) continue;

    const { score, matched } = scoreType(normalized, type);
    if (score === 0) continue;

    const confidence = Math.min(score / max, 1.0);
    if (confidence < PROJECT_DETECTION_THRESHOLD) continue;

    candidates.push({
      project_type: type,
      confidence:   Math.round(confidence * 1000) / 1000,
      matched,
    });
  }

  // Sort by confidence descending
  candidates.sort((a, b) => b.confidence - a.confidence);

  // Fallback: if nothing detected, return RENOVATION with zero confidence
  if (candidates.length === 0) {
    return [{ project_type: 'RENOVATION', confidence: 0, matched: [] }];
  }

  return candidates;
}

/**
 * Detect the primary project type and confidence from a free-text description.
 *
 * @param text - Raw project description or devis title
 * @returns { project_type, confidence, all_candidates }
 */
export function detectProjectType(text: string): {
  project_type:   ProjectType;
  confidence:     number;
  all_candidates: ProjectTypeCandidate[];
} {
  const all_candidates = detectProjectTypeCandidates(text);
  const primary        = all_candidates[0];

  return {
    project_type:   primary.project_type,
    confidence:     primary.confidence,
    all_candidates,
  };
}
