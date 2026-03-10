/**
 * RAG — Embedding Service
 * Generates vector embeddings via the AI Orchestrator.
 */

import { aiOrchestrator } from '@/services/ai/aiOrchestrator.service';
import { log } from '@/lib/logger';

/**
 * Generate an embedding vector for a text string.
 * Returns null on failure (caller decides how to handle).
 */
export async function generateEmbedding(text: string): Promise<number[] | null> {
  try {
    const result = await aiOrchestrator.generateEmbedding({ text });
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
