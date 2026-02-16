/**
 * Knowledge Embedding Service v1.0
 * Generates embeddings for semantic search (placeholder)
 * Will be enhanced in Phase 30 with actual embedding models
 */

import type { KnowledgeChunk } from './knowledgeChunker.service';

/**
 * Embedding result
 */
export interface EmbeddingResult {
  chunkId: string;
  embedding: number[];
  model: string;
  confidence: number;
}

/**
 * Generate placeholder embedding
 * Will be replaced with actual model (OpenAI, Cohere, local model) in Phase 30
 */
export function generatePlaceholderEmbedding(text: string): number[] {
  // Create deterministic hash-based embedding
  // This is NOT a real embedding - just a placeholder
  const seed = 42;
  let hash = seed;

  for (let i = 0; i < text.length; i++) {
    hash = ((hash << 5) - hash) + text.charCodeAt(i);
    hash = hash & hash; // Convert to 32bit integer
  }

  // Generate 384-dimensional pseudo-embedding
  const embedding: number[] = [];
  for (let i = 0; i < 384; i++) {
    hash = (hash * 9301 + 49297) % 233280;
    embedding.push((hash / 233280) * 2 - 1); // Range: -1 to 1
  }

  return embedding;
}

/**
 * Generate embedding for chunk
 */
export async function generateEmbedding(
  chunkId: string,
  text: string,
  model: string = 'placeholder'
): Promise<EmbeddingResult | null> {
  try {
    console.log('[KnowledgeEmbedding] Generating embedding for:', chunkId);

    let embedding: number[] = [];

    if (model === 'placeholder') {
      // Phase 28-29: Use placeholder
      embedding = generatePlaceholderEmbedding(text);
    } else if (model === 'openai') {
      // Phase 30: Use OpenAI embeddings
      // embedding = await getOpenAIEmbedding(text);
      embedding = generatePlaceholderEmbedding(text);
    } else if (model === 'local') {
      // Phase 30: Use local embedding model
      // embedding = await getLocalEmbedding(text);
      embedding = generatePlaceholderEmbedding(text);
    }

    return {
      chunkId,
      embedding,
      model,
      confidence: 0.95, // Placeholder confidence
    };
  } catch (error) {
    console.error('[KnowledgeEmbedding] Embedding generation failed:', error);
    return null;
  }
}

/**
 * Generate embeddings for multiple chunks
 */
export async function generateEmbeddingsForChunks(
  chunks: KnowledgeChunk[]
): Promise<EmbeddingResult[]> {
  try {
    console.log('[KnowledgeEmbedding] Generating embeddings for', chunks.length, 'chunks');

    const results: EmbeddingResult[] = [];

    for (let i = 0; i < chunks.length; i++) {
      const result = await generateEmbedding(`chunk_${i}`, chunks[i].content);
      if (result) {
        results.push(result);
      }
    }

    console.log('[KnowledgeEmbedding] Generated', results.length, 'embeddings');
    return results;
  } catch (error) {
    console.error('[KnowledgeEmbedding] Batch embedding failed:', error);
    return [];
  }
}

/**
 * Cosine similarity between two embeddings
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
 * Find similar embeddings
 */
export function findSimilarEmbeddings(
  queryEmbedding: number[],
  candidates: { id: string; embedding: number[] }[],
  threshold: number = 0.7,
  limit: number = 5
): { id: string; similarity: number }[] {
  const results = candidates
    .map((candidate) => ({
      id: candidate.id,
      similarity: cosineSimilarity(queryEmbedding, candidate.embedding),
    }))
    .filter((result) => result.similarity >= threshold)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, limit);

  return results;
}

/**
 * Embedding model info (for Phase 30)
 */
export const EMBEDDING_MODELS = {
  placeholder: {
    name: 'Placeholder (Testing)',
    dimensions: 384,
    provider: 'internal',
    description: 'Placeholder embedding for development',
  },
  openai: {
    name: 'OpenAI text-embedding-3-small',
    dimensions: 1536,
    provider: 'OpenAI',
    description: 'High-quality embeddings from OpenAI (Phase 30)',
  },
  local: {
    name: 'MiniLM-L6-v2',
    dimensions: 384,
    provider: 'Sentence Transformers',
    description: 'Local embedding model for privacy (Phase 30)',
  },
} as const;

/**
 * Get recommended model for use case
 */
export function getRecommendedEmbeddingModel(useCase: 'testing' | 'production' | 'privacy'): string {
  switch (useCase) {
    case 'testing':
      return 'placeholder';
    case 'production':
      return 'openai';
    case 'privacy':
      return 'local';
    default:
      return 'placeholder';
  }
}
