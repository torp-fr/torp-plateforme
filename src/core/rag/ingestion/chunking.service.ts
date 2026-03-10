/**
 * RAG — Chunking Service
 * Splits text into semantic chunks with metadata.
 * Delegates to the shared chunking utility.
 */

export {
  chunkText,
  getChunkingStats,
  validateChunks,
} from '@/utils/chunking';

export type { Chunk, ChunkingStats } from '@/utils/chunking';
