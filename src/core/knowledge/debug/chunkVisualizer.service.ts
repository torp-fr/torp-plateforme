/**
 * Chunk Visualizer Service
 * Developer tool to visualize how a document was chunked in the knowledge base.
 */

import { supabase } from '@/lib/supabase';
import { log, error } from '@/lib/logger';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ChunkVisualization {
  chunk: number;
  tokens: number;
  quality: number | null;
  preview: string;
}

// ---------------------------------------------------------------------------
// visualizeChunks
// ---------------------------------------------------------------------------

/**
 * Returns a visualization of all chunks for a given document, ordered by chunk_index.
 * Preview contains the first 250 characters of each chunk.
 */
export async function visualizeChunks(documentId: string): Promise<ChunkVisualization[]> {
  log('[ChunkVisualizer] Visualizing chunks for document:', documentId);

  try {
    const { data, error: queryError } = await supabase
      .from('knowledge_chunks')
      .select('chunk_index, token_count, metadata, content')
      .eq('document_id', documentId)
      .order('chunk_index', { ascending: true });

    if (queryError) {
      throw new Error(`Failed to fetch chunks: ${queryError.message}`);
    }

    if (!data || data.length === 0) {
      log('[ChunkVisualizer] No chunks found for document:', documentId);
      return [];
    }

    const result: ChunkVisualization[] = data.map(
      (row: {
        chunk_index: number;
        token_count: number;
        metadata?: { qualityScore?: number };
        content: string;
      }) => ({
        chunk: row.chunk_index,
        tokens: row.token_count ?? 0,
        quality: row.metadata?.qualityScore ?? null,
        preview: (row.content ?? '').slice(0, 250),
      })
    );

    log('[ChunkVisualizer] Visualization complete:', {
      documentId,
      totalChunks: result.length,
    });

    return result;
  } catch (err) {
    error('[ChunkVisualizer] Failed to visualize chunks:', err);
    return [];
  }
}
