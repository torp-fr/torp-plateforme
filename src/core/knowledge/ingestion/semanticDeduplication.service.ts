/**
 * Semantic Deduplication Service
 * Rejects incoming chunks whose content is already represented in the
 * vector database with a cosine similarity above the duplicate threshold.
 *
 * Position in the ingestion pipeline:
 *   ChunkQualityFilter → [THIS SERVICE] → EmbeddingGenerator
 *
 * Algorithm per chunk:
 *  1. Generate a temporary embedding for the candidate chunk.
 *  2. Query match_knowledge_chunks() — the pgvector RPC that returns rows
 *     ordered by `embedding_vector <=> query_embedding`.
 *  3. If the nearest neighbour has similarity > SIMILARITY_THRESHOLD the
 *     chunk is a near-duplicate and is dropped.
 *  4. Surviving chunks carry a `deduplicated: true` flag in their metadata.
 *
 * Design constraints:
 *  - Non-blocking: a failure to embed or query one chunk is logged and the
 *    chunk is kept (safe default — better to store a duplicate than lose data).
 *  - Read-only against the DB: this service never writes to the database.
 *  - Generates embeddings only for dedup probing; the final embeddings
 *    written to the DB are generated later by the embedding service.
 */

import type { Chunk } from './smartChunker.service';
import { generateEmbedding } from './knowledgeEmbedding.service';
import { supabase } from '@/lib/supabase';
import { log, warn } from '@/lib/logger';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * Cosine similarity above which two chunks are considered near-duplicates.
 * 0.92 allows minor wording differences (e.g. normalisation artefacts) while
 * reliably catching re-ingested or near-identical content.
 */
const SIMILARITY_THRESHOLD = 0.92;

/**
 * We only need to check the single nearest neighbour to decide duplication.
 */
const MATCH_COUNT = 1;

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Query the vector index for the nearest existing chunk.
 * Returns the similarity of the top result, or null when the index is empty
 * or the query fails.
 */
async function nearestSimilarity(embedding: number[]): Promise<number | null> {
  const { data, error } = await supabase.rpc('match_knowledge_chunks', {
    query_embedding: embedding,
    match_count: MATCH_COUNT,
  });

  if (error) {
    warn('[SemanticDedup] RPC error:', error.message);
    return null;
  }

  if (!data || data.length === 0) {
    // Index is empty — no duplicate possible
    return null;
  }

  return (data[0] as { similarity: number }).similarity;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Remove chunks that are semantically equivalent to content already indexed.
 *
 * Chunks are probed sequentially so that a chunk accepted earlier in the
 * same batch does not cause a later chunk in the same batch to be rejected
 * (they share the same incoming document and ordering matters for structure).
 *
 * @param chunks - Quality-filtered chunks ready for embedding
 * @returns Deduplicated subset with metadata.deduplicated = true on survivors
 */
export async function deduplicateChunks(chunks: Chunk[]): Promise<Chunk[]> {
  if (chunks.length === 0) {
    return chunks;
  }

  // Guard: if the vector index is empty, no duplicate can exist.
  // Skip all embedding probes and return immediately — avoids unnecessary
  // Edge Function calls on a fresh database (first ingestion batch).
  try {
    const { count, error: countError } = await supabase
      .from('knowledge_chunks')
      .select('*', { count: 'exact', head: true });

    if (!countError && count === 0) {
      log('[SemanticDedup] Index is empty — skipping embedding probes, returning all', chunks.length, 'chunks');
      return chunks.map((c) => withDedupMeta(c, true, null));
    }
  } catch {
    // Cannot reach DB — proceed with full dedup (safe default: keep all on error)
  }

  log('[SemanticDedup] Probing', chunks.length, 'chunks against vector index');

  const kept: Chunk[] = [];
  let rejectedCount = 0;

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];

    let similarity: number | null = null;

    try {
      // Step 1: Generate a temporary embedding for this chunk
      const result = await generateEmbedding(`dedup_probe_${i}`, chunk.content);

      if (!result) {
        // Embedding failed — keep the chunk (safe default)
        warn(`[SemanticDedup] Embedding failed for chunk ${i} — keeping`);
        kept.push(withDedupMeta(chunk, false, null));
        continue;
      }

      // Step 2: Find the nearest existing chunk in the vector index
      similarity = await nearestSimilarity(result.embedding);

    } catch (err) {
      warn(`[SemanticDedup] Probe error for chunk ${i} — keeping:`, err);
      kept.push(withDedupMeta(chunk, false, null));
      continue;
    }

    // Step 3: Reject if above threshold
    const isDuplicate = similarity !== null && similarity > SIMILARITY_THRESHOLD;

    if (isDuplicate) {
      rejectedCount++;
      log(
        `[SemanticDedup] Chunk ${i} rejected — similarity ${similarity!.toFixed(4)}`,
        `> threshold ${SIMILARITY_THRESHOLD}`
      );
    } else {
      kept.push(withDedupMeta(chunk, true, similarity));
    }
  }

  log(
    '[SemanticDedup] Kept:', kept.length,
    '| Rejected as duplicate:', rejectedCount,
    '| Input:', chunks.length
  );

  return kept;
}

// ---------------------------------------------------------------------------
// Internal: metadata annotation
// ---------------------------------------------------------------------------

/**
 * Return a copy of the chunk with deduplication metadata attached.
 *
 * @param chunk      - Original chunk
 * @param passed     - Whether this chunk passed the dedup check
 * @param similarity - Nearest-neighbour similarity score, or null if unknown
 */
function withDedupMeta(
  chunk: Chunk,
  passed: boolean,
  similarity: number | null
): Chunk {
  return {
    ...chunk,
    metadata: {
      ...chunk.metadata,
      deduplicated: passed,
      nearestSimilarity: similarity,
    },
  };
}
