/**
 * RAG — Embedding Orchestrator Service
 * Batches embedding generation with retry logic and concurrency control.
 */

import { generateEmbedding } from './embedding.service';
import { log, warn } from '@/lib/logger';

const BATCH_SIZE = 10;
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 500;

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Generate embeddings for a batch of texts with retry logic.
 */
export async function batchGenerateEmbeddings(
  texts: string[]
): Promise<Array<number[] | null>> {
  const results: Array<number[] | null> = new Array(texts.length).fill(null);

  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE);
    log('[RAG:EmbeddingOrchestrator] Processing batch', Math.floor(i / BATCH_SIZE) + 1, 'of', Math.ceil(texts.length / BATCH_SIZE));

    await Promise.all(
      batch.map(async (text, batchIdx) => {
        const globalIdx = i + batchIdx;
        for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
          const embedding = await generateEmbedding(text);
          if (embedding) {
            results[globalIdx] = embedding;
            return;
          }
          if (attempt < MAX_RETRIES) {
            warn(`[RAG:EmbeddingOrchestrator] Retry ${attempt}/${MAX_RETRIES} for chunk ${globalIdx}`);
            await sleep(RETRY_DELAY_MS * attempt);
          }
        }
        console.error(`[RAG:EmbeddingOrchestrator] ❌ Failed to embed chunk ${globalIdx} after ${MAX_RETRIES} attempts`);
      })
    );
  }

  return results;
}
