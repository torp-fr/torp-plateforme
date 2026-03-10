/**
 * RAG — Answer Grounding Validation Service
 * Validates that LLM-generated answers are grounded in retrieved knowledge.
 *
 * Purpose: Detect hallucinations and unsupported claims by measuring how much
 * of the LLM answer is actually supported by the retrieved documents.
 *
 * Pipeline: After LLM generates a response, this service:
 * 1. Extracts key sentences from the answer
 * 2. Checks overlap with retrieved chunk content
 * 3. Computes a support score (0-100%)
 * 4. Warns if score falls below threshold (default: 70%)
 */

import { SearchResult } from '../types';
import { log, warn } from '@/lib/logger';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface GroundingResult {
  isGrounded: boolean;
  supportScore: number; // 0-100%
  groundedSentences: number; // count of sentences with support
  totalSentences: number; // total sentences in answer
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
const SIMILARITY_THRESHOLD = 0.3; // Token overlap ratio for a match

// ─────────────────────────────────────────────────────────────────────────────
// Helper Functions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Extract sentences from text.
 * Splits on periods, exclamation marks, question marks.
 * Filters out empty or very short sentences.
 */
function extractSentences(text: string): string[] {
  if (!text) return [];

  // Split on sentence-ending punctuation
  const raw = text.split(/[.!?]+/).map((s) => s.trim()).filter((s) => s.length >= MIN_SENTENCE_LENGTH);

  return raw;
}

/**
 * Extract tokens from text (simple split on whitespace and punctuation).
 * Used for overlap calculation.
 */
function extractTokens(text: string): Set<string> {
  const normalized = text.toLowerCase().replace(/[^\w\s]/g, ' ');
  const tokens = normalized.split(/\s+/).filter((t) => t.length > 2); // Filter tiny tokens
  return new Set(tokens);
}

/**
 * Calculate token overlap ratio between two texts.
 * Returns: (overlapping tokens) / (unique tokens in target sentence)
 * High ratio = strong support.
 */
function calculateTokenOverlap(sentence: string, chunkContent: string): number {
  const sentenceTokens = extractTokens(sentence);
  const chunkTokens = extractTokens(chunkContent);

  if (sentenceTokens.size === 0) return 0;

  let overlaps = 0;
  for (const token of sentenceTokens) {
    if (chunkTokens.has(token)) overlaps++;
  }

  return overlaps / sentenceTokens.size;
}

/**
 * Check if a sentence is supported by the retrieved chunks.
 * A sentence is "supported" if it has sufficient token overlap with at least one chunk.
 */
function isSentenceSupported(sentence: string, chunks: SearchResult[]): { supported: boolean; matchedChunks: string[] } {
  const matchedChunks: string[] = [];

  for (const chunk of chunks) {
    const overlap = calculateTokenOverlap(sentence, chunk.content);
    if (overlap >= SIMILARITY_THRESHOLD) {
      matchedChunks.push(chunk.id);
      return { supported: true, matchedChunks };
    }
  }

  return { supported: false, matchedChunks };
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Validation Function
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Validate that an LLM-generated answer is grounded in retrieved knowledge.
 *
 * @param answer - The LLM-generated response text
 * @param retrievedChunks - The chunks used to generate the answer
 * @returns GroundingResult with support score and details
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

  // Extract sentences from the answer
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

  // Check grounding for each sentence
  const sentenceSupport = sentences.map((sentence) => {
    const { supported, matchedChunks } = isSentenceSupported(sentence, retrievedChunks);
    return {
      sentence: sentence.substring(0, 80) + (sentence.length > 80 ? '...' : ''),
      supported,
      matchedChunks,
    };
  });

  // Calculate support score
  const groundedSentences = sentenceSupport.filter((s) => s.supported).length;
  const supportScore = Math.round((groundedSentences / sentences.length) * 100);

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
