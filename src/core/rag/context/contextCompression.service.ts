/**
 * RAG — Context Compression Service
 * Reduces token usage by compressing context before LLM input.
 * Context compression is handled in the generation pipeline (outside retrieval layer).
 */

import { SearchResult } from '../types';
import { log } from '@/lib/logger';

const DEFAULT_MAX_CHARS_PER_CHUNK = 200;
const DEFAULT_MAX_CHUNKS = 5;

export interface CompressionOptions {
  maxCharsPerChunk?: number;
  maxChunks?: number;
}

/**
 * Compress retrieved knowledge chunks to fit within token budget.
 */
export function compressContext(
  results: SearchResult[],
  options: CompressionOptions = {}
): SearchResult[] {
  const maxCharsPerChunk = options.maxCharsPerChunk ?? DEFAULT_MAX_CHARS_PER_CHUNK;
  const maxChunks = options.maxChunks ?? DEFAULT_MAX_CHUNKS;

  const compressed = results
    .slice(0, maxChunks)
    .map((r) => ({
      ...r,
      content:
        r.content.length > maxCharsPerChunk
          ? r.content.substring(0, maxCharsPerChunk) + '...'
          : r.content,
    }));

  log('[RAG:ContextCompression] Compressed', results.length, '->', compressed.length, 'chunks');
  return compressed;
}
