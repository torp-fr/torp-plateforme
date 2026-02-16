/**
 * Knowledge Index Service v1.0
 * Indexes chunks for fast semantic search (RAG preparation)
 */

import type { KnowledgeChunk as ChunkerChunk } from './knowledgeChunker.service';
import { generateEmbeddingsForChunks } from './knowledgeEmbedding.service';
import { supabase } from '@/lib/supabase';

/**
 * Index statistics
 */
export interface IndexStats {
  chunksIndexed: number;
  embeddingsGenerated: number;
  indexSize: number;
  lastUpdated: string;
}

/**
 * Index chunks by generating embeddings
 */
export async function indexChunks(documentId: string, chunks: ChunkerChunk[]): Promise<boolean> {
  try {
    console.log('[KnowledgeIndex] Indexing', chunks.length, 'chunks for document:', documentId);

    // Use shared supabase client

    // Step 1: Generate embeddings
    const embeddings = await generateEmbeddingsForChunks(chunks);
    console.log('[KnowledgeIndex] Generated', embeddings.length, 'embeddings');

    if (embeddings.length === 0) {
      console.warn('[KnowledgeIndex] No embeddings generated');
      return false;
    }

    // Step 2: Update chunk records with embeddings
    // Note: Supabase pgvector extension would be used here for vector storage
    // For now, store embeddings as JSON
    for (let i = 0; i < chunks.length; i++) {
      const embedding = embeddings[i];
      if (embedding) {
        const { error } = await supabase
          .from('knowledge_chunks')
          .update({
            embedding: embedding.embedding,
          })
          .eq('document_id', documentId)
          .eq('chunk_index', i);

        if (error) {
          console.warn(`[KnowledgeIndex] Failed to update chunk ${i}:`, error);
        }
      }
    }

    console.log('[KnowledgeIndex] Indexing complete for document:', documentId);
    return true;
  } catch (error) {
    console.error('[KnowledgeIndex] Indexing failed:', error);
    return false;
  }
}

/**
 * Search index using semantic similarity
 */
export async function semanticSearch(
  query: string,
  limit: number = 5
): Promise<
  {
    chunkId: string;
    content: string;
    similarity: number;
    documentId: string;
  }[]
> {
  try {
    console.log('[KnowledgeIndex] Semantic search for:', query);

    const { generateEmbedding } = await import('./knowledgeEmbedding.service');

    // Generate query embedding
    const queryEmbeddingResult = await generateEmbedding('query', query);
    if (!queryEmbeddingResult) {
      throw new Error('Failed to generate query embedding');
    }

    const queryEmbedding = queryEmbeddingResult.embedding;

    // Use shared supabase client

    // Fetch all chunks with embeddings
    const { data: chunks, error } = await supabase
      .from('knowledge_chunks')
      .select('id, document_id, content, embedding');

    if (error || !chunks) {
      throw new Error(`Failed to fetch chunks: ${error?.message}`);
    }

    // Calculate similarity scores
    const { cosineSimilarity } = await import('./knowledgeEmbedding.service');

    const results = chunks
      .filter((chunk: any) => chunk.embedding && chunk.embedding.length > 0)
      .map((chunk: any) => ({
        chunkId: chunk.id,
        documentId: chunk.document_id,
        content: chunk.content,
        similarity: cosineSimilarity(queryEmbedding, chunk.embedding),
      }))
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit);

    console.log('[KnowledgeIndex] Found', results.length, 'relevant chunks');
    return results;
  } catch (error) {
    console.error('[KnowledgeIndex] Search failed:', error);
    return [];
  }
}

/**
 * Get index statistics
 */
export async function getIndexStats(): Promise<IndexStats> {
  try {
    // Use shared supabase client

    const { data: chunks, error } = await supabase
      .from('knowledge_chunks')
      .select('embedding');

    if (error) {
      throw new Error(`Failed to get stats: ${error.message}`);
    }

    const indexedChunks = (chunks || []).filter((chunk: any) => chunk.embedding).length;
    const totalChunks = chunks?.length || 0;

    return {
      chunksIndexed: indexedChunks,
      embeddingsGenerated: indexedChunks,
      indexSize: totalChunks * 384 * 4, // Rough estimate: 384 dims * 4 bytes each
      lastUpdated: new Date().toISOString(),
    };
  } catch (error) {
    console.error('[KnowledgeIndex] Failed to get stats:', error);
    return {
      chunksIndexed: 0,
      embeddingsGenerated: 0,
      indexSize: 0,
      lastUpdated: new Date().toISOString(),
    };
  }
}

/**
 * Rebuild index for document
 */
export async function rebuildIndex(documentId: string): Promise<boolean> {
  try {
    console.log('[KnowledgeIndex] Rebuilding index for document:', documentId);

    // Use shared supabase client

    // Fetch chunks
    const { data: chunks, error } = await supabase
      .from('knowledge_chunks')
      .select('*')
      .eq('document_id', documentId);

    if (error || !chunks) {
      throw new Error(`Failed to fetch chunks: ${error?.message}`);
    }

    // Convert to chunker format
    const chunkerChunks = chunks.map((chunk: any) => ({
      content: chunk.content,
      tokenCount: chunk.token_count,
      startIndex: 0,
      endIndex: chunk.content.length,
    }));

    // Re-index
    return await indexChunks(documentId, chunkerChunks);
  } catch (error) {
    console.error('[KnowledgeIndex] Rebuild failed:', error);
    return false;
  }
}

/**
 * Optimize index
 * Removes duplicate chunks, consolidates similar content
 */
export async function optimizeIndex(): Promise<{
  duplicatesRemoved: number;
  consolidatedChunks: number;
}> {
  try {
    console.log('[KnowledgeIndex] Starting index optimization');

    // This would implement deduplication and consolidation
    // For now, return statistics
    return {
      duplicatesRemoved: 0,
      consolidatedChunks: 0,
    };
  } catch (error) {
    console.error('[KnowledgeIndex] Optimization failed:', error);
    return {
      duplicatesRemoved: 0,
      consolidatedChunks: 0,
    };
  }
}
