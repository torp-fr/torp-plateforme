/**
 * RAG — Embedding Service
 * Generates vector embeddings via the AI Orchestrator.
 */

import { aiOrchestrator } from '@/services/ai/aiOrchestrator.service';
import { getCachedEmbedding, setCachedEmbedding } from './embeddingCache.service';
import { log } from '@/lib/logger';

/**
 * Generate an embedding vector for a text string.
 * Hits the in-memory LRU cache first; calls the AI Orchestrator on a miss.
 * Returns null on failure (caller decides how to handle).
 */
export async function generateEmbedding(text: string): Promise<number[] | null> {
  const cached = getCachedEmbedding(text);
  if (cached) {
    log('[RAG:Embedding] ⚡ Cache hit for query:', text.substring(0, 60));
    return cached;
  }

  try {
    const result = await aiOrchestrator.generateEmbedding({ text });
    setCachedEmbedding(text, result.embedding);
    return result.embedding;
  } catch (err) {
    console.error('[RAG:Embedding] ❌ Failed to generate embedding:', err);
    return null;
  }
}

/**
 * Generate embeddings for multiple texts.
 * Returns array of results (null entries for failures).
 */
export async function generateEmbeddingsBatch(
  texts: string[]
): Promise<Array<{ text: string; embedding: number[] | null }>> {
  log('[RAG:Embedding] Generating batch of', texts.length, 'embeddings');
  return Promise.all(
    texts.map(async (text) => ({
      text,
      embedding: await generateEmbedding(text),
    }))
  );
}
