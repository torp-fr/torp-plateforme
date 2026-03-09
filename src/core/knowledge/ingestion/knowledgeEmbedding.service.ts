/**
 * Knowledge Embedding Service v2.0 (Phase 30)
 * Generates real embeddings via OpenAI text-embedding-3-small through the
 * Supabase Edge Function `generate-embedding`.
 *
 * Key changes from v1.0:
 *  - Placeholder hash-based generator replaced with real OpenAI calls
 *  - True batch support: chunks are sent in groups of BATCH_SIZE per API call
 *  - Dimension is fixed at 384 (OpenAI dimensions param)
 *  - Auth token retrieved from the existing supabase singleton (no new client)
 */

import type { KnowledgeChunk } from './knowledgeChunker.service';
import { supabase } from '@/lib/supabase';
import { log, warn, error } from '@/lib/logger';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const EMBEDDING_MODEL = 'text-embedding-3-small';
const EMBEDDING_DIMENSIONS = 384; // Enforced via OpenAI `dimensions` param
const BATCH_SIZE = 100;           // Edge Function cap; OpenAI allows up to 2048

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface EmbeddingResult {
  chunkId: string;
  embedding: number[];
  model: string;
  confidence: number;
}

// ---------------------------------------------------------------------------
// Internal: invoke the generate-embedding Edge Function for a batch of texts
// ---------------------------------------------------------------------------

async function invokeBatchEmbedding(inputs: string[]): Promise<number[][]> {
  const { data, error: fnError } = await supabase.functions.invoke(
    'generate-embedding',
    {
      body: { inputs, model: EMBEDDING_MODEL, dimensions: EMBEDDING_DIMENSIONS },
    }
  );

  if (fnError) {
    console.error('[KnowledgeEmbedding] Edge Function response:', JSON.stringify(data, null, 2));
    throw new Error(`[KnowledgeEmbedding] Edge Function error: ${fnError.message}`);
  }

  if (!data?.embeddings || !Array.isArray(data.embeddings)) {
    console.error('[KnowledgeEmbedding] Edge Function response:', JSON.stringify(data, null, 2));
    throw new Error('[KnowledgeEmbedding] Invalid response from Edge Function — missing embeddings array');
  }

  if (data.embeddings.length === 0) {
    throw new Error('[KnowledgeEmbedding] No embeddings returned');
  }

  return data.embeddings as number[][];
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Generate embedding for a single text.
 * Throws error if generation fails (instead of returning null).
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  try {
    const embeddings = await invokeBatchEmbedding([text]);
    if (!embeddings[0]) {
      throw new Error('[KnowledgeEmbedding] No embedding returned for text');
    }
    return embeddings[0];
  } catch (err) {
    error('[KnowledgeEmbedding] Single embedding failed:', err);
    throw err;
  }
}

/**
 * Generate embeddings for multiple texts in a single batch.
 * Throws error if generation fails or returns inconsistent size.
 */
export async function embedBatch(texts: string[]): Promise<number[][]> {
  try {
    if (texts.length === 0) {
      return [];
    }

    log('[KnowledgeEmbedding] Generating embeddings for', texts.length, 'texts');

    const embeddings = await invokeBatchEmbedding(texts);

    if (!embeddings || embeddings.length !== texts.length) {
      throw new Error('[KnowledgeEmbedding] Batch returned inconsistent size');
    }

    log('[KnowledgeEmbedding] Batch complete —', embeddings.length, 'embeddings generated');

    return embeddings;
  } catch (err) {
    error('[KnowledgeEmbedding] Batch embedding failed:', err);
    throw err;
  }
}

/**
 * Generate embeddings for multiple chunks in batches.
 * Sends up to BATCH_SIZE texts per Edge Function call, respecting the
 * server-side limit of 100 inputs per request.
 */
export async function generateEmbeddingsForChunks(
  chunks: KnowledgeChunk[]
): Promise<EmbeddingResult[]> {
  if (chunks.length === 0) {
    return [];
  }

  log('[KnowledgeEmbedding] Generating embeddings for', chunks.length, 'chunks in batches of', BATCH_SIZE);

  const results: EmbeddingResult[] = [];

  for (let offset = 0; offset < chunks.length; offset += BATCH_SIZE) {
    const batch = chunks.slice(offset, offset + BATCH_SIZE);
    const inputs = batch.map((c) => c.content);

    try {
      const embeddings = await invokeBatchEmbedding(inputs);

      batch.forEach((chunk, i) => {
        if (embeddings[i]) {
          results.push({
            chunkId: `chunk_${offset + i}`,
            embedding: embeddings[i],
            model: EMBEDDING_MODEL,
            confidence: 1.0,
          });
        }
      });

      log('[KnowledgeEmbedding] Batch', Math.floor(offset / BATCH_SIZE) + 1, 'complete —', batch.length, 'embeddings');
    } catch (err) {
      warn('[KnowledgeEmbedding] Batch failed (offset', offset, '):', err);
      // Continue with next batch rather than aborting entirely
    }
  }

  log('[KnowledgeEmbedding] Generated', results.length, '/', chunks.length, 'embeddings');
  return results;
}

/**
 * Cosine similarity between two embeddings.
 * Retained for use by the conflict detection service.
 */
export function cosineSimilarity(embedding1: number[], embedding2: number[]): number {
  if (embedding1.length !== embedding2.length) {
    return 0;
  }

  let dotProduct = 0;
  let norm1 = 0;
  let norm2 = 0;

  for (let i = 0; i < embedding1.length; i++) {
    dotProduct += embedding1[i] * embedding2[i];
    norm1 += embedding1[i] * embedding1[i];
    norm2 += embedding2[i] * embedding2[i];
  }

  const denominator = Math.sqrt(norm1) * Math.sqrt(norm2);
  return denominator > 0 ? dotProduct / denominator : 0;
}

/**
 * Find similar embeddings from a candidate list (in-memory).
 * Used by the conflict detection service for chunk-level comparisons.
 */
export function findSimilarEmbeddings(
  queryEmbedding: number[],
  candidates: { id: string; embedding: number[] }[],
  threshold: number = 0.7,
  limit: number = 5
): { id: string; similarity: number }[] {
  return candidates
    .map((candidate) => ({
      id: candidate.id,
      similarity: cosineSimilarity(queryEmbedding, candidate.embedding),
    }))
    .filter((result) => result.similarity >= threshold)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, limit);
}

// ---------------------------------------------------------------------------
// Model metadata (updated for Phase 30)
// ---------------------------------------------------------------------------

export const EMBEDDING_MODELS = {
  openai: {
    name: 'OpenAI text-embedding-3-small',
    dimensions: EMBEDDING_DIMENSIONS,
    provider: 'OpenAI',
    description: 'Production embeddings via Supabase Edge Function (dimensions=384)',
  },
  local: {
    name: 'MiniLM-L6-v2',
    dimensions: 384,
    provider: 'Sentence Transformers',
    description: 'Local embedding model for privacy use-cases',
  },
} as const;
