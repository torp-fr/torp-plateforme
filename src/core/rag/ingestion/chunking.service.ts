/**
 * RAG — Chunking Service
 * Semantic-aware chunking for the ingestion pipeline.
 *
 * Strategy: split on paragraph boundaries (double newline), then merge
 * adjacent paragraphs until the TARGET_CHUNK_CHARS threshold is reached.
 * Oversized paragraphs are split further by word boundary.
 */

export { getChunkingStats, validateChunks } from '@/utils/chunking';
export type { Chunk, ChunkingStats } from '@/utils/chunking';

import type { Chunk } from '@/utils/chunking';

const TARGET_CHUNK_CHARS = 1200;
const MAX_CHUNK_CHARS = 1600;

/** Heuristic: 1 token ≈ 4 characters */
function estimateTokenCount(text: string): number {
  return Math.ceil(text.length / 4);
}

function makeChunk(text: string): Chunk {
  const content = text.trim();
  return {
    content,
    characterCount: content.length,
    tokenCount: estimateTokenCount(content),
  };
}

/**
 * Split `text` by word boundaries so that no piece exceeds MAX_CHUNK_CHARS.
 * Used as a fallback for paragraphs that are individually too large.
 */
function splitByWords(text: string): string[] {
  const pieces: string[] = [];
  const words = text.split(/\s+/);
  let current = '';

  for (const word of words) {
    if (current.length === 0) {
      current = word;
    } else if (current.length + 1 + word.length > MAX_CHUNK_CHARS) {
      pieces.push(current);
      current = word;
    } else {
      current += ' ' + word;
    }
  }

  if (current.length > 0) pieces.push(current);
  return pieces;
}

/**
 * Chunk `text` using semantic paragraph boundaries.
 *
 * 1. Split on double newlines to get paragraphs.
 * 2. Merge consecutive paragraphs until adding the next one would exceed
 *    TARGET_CHUNK_CHARS — at that point flush the current chunk.
 * 3. Any paragraph that on its own exceeds MAX_CHUNK_CHARS is split by
 *    word boundary before being considered for merging.
 *
 * The `maxTokens` parameter is accepted for API compatibility but the
 * character-based thresholds above govern actual splitting behaviour.
 */
export function chunkText(text: string, _maxTokens: number = 1000): Chunk[] {
  if (!text || text.trim().length === 0) {
    return [];
  }

  const chunks: Chunk[] = [];
  let current = '';

  // Normalised paragraphs, empty ones filtered out
  const rawParagraphs = text.split(/\n\n+/).map((p) => p.trim()).filter(Boolean);

  // Expand any paragraph that exceeds MAX_CHUNK_CHARS into word-split pieces
  const paragraphs: string[] = [];
  for (const para of rawParagraphs) {
    if (para.length > MAX_CHUNK_CHARS) {
      paragraphs.push(...splitByWords(para));
    } else {
      paragraphs.push(para);
    }
  }

  for (const para of paragraphs) {
    if (current.length === 0) {
      current = para;
    } else if (current.length + 2 + para.length > TARGET_CHUNK_CHARS) {
      // Flush accumulated chunk, start fresh with this paragraph
      chunks.push(makeChunk(current));
      current = para;
    } else {
      // Merge: preserve paragraph separation with double newline
      current += '\n\n' + para;
    }
  }

  if (current.trim().length > 0) {
    chunks.push(makeChunk(current));
  }

  return chunks;
}
