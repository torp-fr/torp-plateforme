/**
 * Knowledge Index Service v2.0 (Phase 30)
 * Indexes chunks into pgvector and provides SQL-level semantic search.
 *
 * Key changes from v1.0:
 *  - Bug fix: getSupabaseClient() did not exist — replaced with supabase import
 *  - Embeddings written to `embedding_vector` (vector(384)) via single bulk upsert
 *  - semanticSearch() uses supabase.rpc('match_knowledge_chunks') — no in-memory scan
 *  - Backward-compat: existing rows with the old `embedding` column are not touched
 */

import type { KnowledgeChunk as ChunkerChunk } from './knowledgeChunker.service';
import { generateEmbeddingsForChunks, generateEmbedding } from './knowledgeEmbedding.service';
import { verifyAndPersistIntegrity } from '../integrity/knowledgeIntegrity.service';
import { getKnowledgeConflictService } from '../conflicts/knowledgeConflict.service';
import { supabase } from '@/lib/supabase';
import { log, warn, error } from '@/lib/logger';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface IndexStats {
  chunksIndexed: number;
  embeddingsGenerated: number;
  indexSize: number;
  lastUpdated: string;
}

// ---------------------------------------------------------------------------
// indexChunks
// ---------------------------------------------------------------------------

/**
 * Generate embeddings for document chunks and persist them in a single bulk
 * upsert to the `embedding_vector` column, then run integrity verification
 * and (non-blocking) conflict detection.
 */
export async function indexChunks(documentId: string, chunks: ChunkerChunk[]): Promise<boolean> {
  try {
    log('[KnowledgeIndex] Indexing', chunks.length, 'chunks for document:', documentId);

    // Step 1: Generate embeddings in batches (real OpenAI calls via Edge Function)
    const embeddings = await generateEmbeddingsForChunks(chunks);
    log('[KnowledgeIndex] Generated', embeddings.length, 'embeddings');

    if (embeddings.length === 0) {
      warn('[KnowledgeIndex] No embeddings generated — aborting index');
      return false;
    }

    // Step 2: Fetch chunk IDs for this document (one query, ordered by chunk_index)
    const { data: chunkRows, error: fetchError } = await supabase
      .from('knowledge_chunks')
      .select('id, chunk_index')
      .eq('document_id', documentId)
      .order('chunk_index', { ascending: true });

    if (fetchError || !chunkRows) {
      warn('[KnowledgeIndex] Failed to fetch chunk IDs:', fetchError?.message);
      return false;
    }

    // Step 3: Build bulk upsert payload — match embedding[i] to chunk by chunk_index
    //         New writes go to `embedding_vector` (pgvector); `embedding` is left intact
    //         for backward compatibility with any existing rows.
    const updates = chunkRows
      .map((row) => {
        const match = embeddings[row.chunk_index];
        if (!match) return null;
        return {
          id: row.id,
          embedding_vector: match.embedding,
        };
      })
      .filter((u): u is { id: string; embedding_vector: number[] } => u !== null);

    if (updates.length === 0) {
      warn('[KnowledgeIndex] No embedding updates to apply');
      return false;
    }

    // Step 4: Single bulk upsert — one round-trip regardless of chunk count
    const { error: upsertError } = await supabase
      .from('knowledge_chunks')
      .upsert(updates, { onConflict: 'id' });

    if (upsertError) {
      warn('[KnowledgeIndex] Bulk upsert failed:', upsertError.message);
      return false;
    }

    log('[KnowledgeIndex] Bulk upsert complete —', updates.length, 'chunks updated');

    // Step 5: Integrity verification (blocking — result feeds is_publishable flag)
    log('[KnowledgeIndex] Starting integrity verification for document:', documentId);
    const integrityResult = await verifyAndPersistIntegrity(documentId);

    if (integrityResult.success) {
      log('[KnowledgeIndex] Integrity score:', integrityResult.report.integrityScore);
      log('[KnowledgeIndex] Publishable:', integrityResult.report.isPublishable);
    } else {
      warn('[KnowledgeIndex] Integrity verification failed:', integrityResult.error);
    }

    // Step 6: Conflict detection (non-blocking — errors must not fail ingestion)
    try {
      const conflictService = getKnowledgeConflictService();
      const conflictResult = await conflictService.detectKnowledgeConflicts(documentId);
      if (conflictResult.conflictsDetected > 0) {
        log('[KnowledgeIndex] Conflicts detected:', {
          documentId,
          count: conflictResult.conflictsDetected,
          timeMs: conflictResult.processingTimeMs,
        });
      }
    } catch (conflictError) {
      warn('[KnowledgeIndex] Conflict detection failed (non-blocking):', conflictError);
    }

    log('[KnowledgeIndex] Indexing complete for document:', documentId);
    return true;
  } catch (err) {
    error('[KnowledgeIndex] Indexing failed:', err);
    return false;
  }
}

// ---------------------------------------------------------------------------
// semanticSearch
// ---------------------------------------------------------------------------

/**
 * Search for the most relevant chunks using SQL-level vector similarity.
 * Delegates to the `match_knowledge_chunks` PostgreSQL function which uses
 * the HNSW index on `embedding_vector` — no in-memory similarity scan.
 *
 * Requires migration 20260304000001_phase30_pgvector_embeddings.sql to be applied.
 */
export async function semanticSearch(
  query: string,
  limit: number = 10
): Promise<{ chunkId: string; content: string; similarity: number; documentId: string }[]> {
  try {
    log('[KnowledgeIndex] Semantic search for:', query);

    // Generate query embedding (single call)
    const queryEmbeddingResult = await generateEmbedding('query', query);
    if (!queryEmbeddingResult) {
      throw new Error('Failed to generate query embedding');
    }

    // SQL vector search via pgvector — ORDER BY embedding_vector <=> query_embedding
    const { data, error: rpcError } = await supabase.rpc('match_knowledge_chunks', {
      query_embedding: queryEmbeddingResult.embedding,
      match_count: limit,
    });

    if (rpcError) {
      throw new Error(`Vector search RPC failed: ${rpcError.message}`);
    }

    const results = (data || []).map((row: {
      id: string;
      document_id: string;
      content: string;
      similarity: number;
    }) => ({
      chunkId: row.id,
      documentId: row.document_id,
      content: row.content,
      similarity: row.similarity,
    }));

    log('[KnowledgeIndex] Found', results.length, 'relevant chunks');
    return results;
  } catch (err) {
    error('[KnowledgeIndex] Search failed:', err);
    return [];
  }
}

// ---------------------------------------------------------------------------
// getIndexStats
// ---------------------------------------------------------------------------

export async function getIndexStats(): Promise<IndexStats> {
  try {
    const { data: chunks, error: fetchError } = await supabase
      .from('knowledge_chunks')
      .select('embedding_vector');

    if (fetchError) {
      throw new Error(`Failed to get stats: ${fetchError.message}`);
    }

    const indexedChunks = (chunks || []).filter((c: any) => c.embedding_vector !== null).length;
    const totalChunks = chunks?.length || 0;

    return {
      chunksIndexed: indexedChunks,
      embeddingsGenerated: indexedChunks,
      // 384 dimensions × 4 bytes per float
      indexSize: totalChunks * 384 * 4,
      lastUpdated: new Date().toISOString(),
    };
  } catch (err) {
    error('[KnowledgeIndex] Failed to get stats:', err);
    return {
      chunksIndexed: 0,
      embeddingsGenerated: 0,
      indexSize: 0,
      lastUpdated: new Date().toISOString(),
    };
  }
}

// ---------------------------------------------------------------------------
// rebuildIndex
// ---------------------------------------------------------------------------

export async function rebuildIndex(documentId: string): Promise<boolean> {
  try {
    log('[KnowledgeIndex] Rebuilding index for document:', documentId);

    const { data: chunks, error: fetchError } = await supabase
      .from('knowledge_chunks')
      .select('*')
      .eq('document_id', documentId);

    if (fetchError || !chunks) {
      throw new Error(`Failed to fetch chunks: ${fetchError?.message}`);
    }

    const chunkerChunks = chunks.map((chunk: any) => ({
      content: chunk.content,
      tokenCount: chunk.token_count,
      startIndex: 0,
      endIndex: chunk.content.length,
    }));

    return await indexChunks(documentId, chunkerChunks);
  } catch (err) {
    error('[KnowledgeIndex] Rebuild failed:', err);
    return false;
  }
}

// ---------------------------------------------------------------------------
// optimizeIndex
// ---------------------------------------------------------------------------

export async function optimizeIndex(): Promise<{
  duplicatesRemoved: number;
  consolidatedChunks: number;
}> {
  try {
    log('[KnowledgeIndex] Starting index optimization');
    // Deduplication and consolidation logic — reserved for future implementation
    return { duplicatesRemoved: 0, consolidatedChunks: 0 };
  } catch (err) {
    error('[KnowledgeIndex] Optimization failed:', err);
    return { duplicatesRemoved: 0, consolidatedChunks: 0 };
  }
}
