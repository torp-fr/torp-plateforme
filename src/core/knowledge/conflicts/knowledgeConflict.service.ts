/**
 * Knowledge Conflict Detection Service
 * MVP: Detect conflicts between documents using embedding similarity
 *
 * CONSTRAINTS:
 * ✓ Read-only from embeddings (no modification)
 * ✓ Non-blocking (errors caught, logged, not thrown)
 * ✓ Performance-safe (limits on comparisons)
 * ✓ No impact on ingestion pipeline
 */

import { createClient } from '@supabase/supabase-js';
import { log, warn, error as errorLog } from '../../../services/logging';
import {
  KnowledgeConflict,
  ConflictDetectionResult,
  ConflictDetectionOptions,
  ConflictStatistics,
  ConflictType,
} from './knowledgeConflict.types';

/**
 * Cosine similarity calculation
 * @param a Vector A
 * @param b Vector B
 * @returns Similarity score (0.0 - 1.0)
 */
function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    return 0;
  }

  // Dot product
  let dotProduct = 0;
  let magnitudeA = 0;
  let magnitudeB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    magnitudeA += a[i] * a[i];
    magnitudeB += b[i] * b[i];
  }

  const magnitude = Math.sqrt(magnitudeA) * Math.sqrt(magnitudeB);
  if (magnitude === 0) {
    return 0;
  }

  return dotProduct / magnitude;
}

/**
 * Knowledge Conflict Detection Service
 */
export class KnowledgeConflictService {
  private supabase = createClient(
    process.env.SUPABASE_URL || '',
    process.env.SUPABASE_ANON_KEY || ''
  );

  private readonly DEFAULT_SIMILARITY_THRESHOLD = 0.92;
  private readonly DEFAULT_MAX_COMPARISONS = 500;

  /**
   * Detect conflicts for a specific document
   * Main entry point for conflict detection
   *
   * @param documentId Document to check for conflicts
   * @param options Detection options
   * @returns Detection result with conflicts found
   */
  async detectKnowledgeConflicts(
    documentId: string,
    options?: ConflictDetectionOptions
  ): Promise<ConflictDetectionResult> {
    const startTime = Date.now();
    const threshold = options?.similarityThreshold || this.DEFAULT_SIMILARITY_THRESHOLD;
    const maxComparisons = options?.maxComparisons || this.DEFAULT_MAX_COMPARISONS;

    try {
      log('[CONFLICT ENGINE] 🔍 Starting conflict detection', {
        documentId,
        threshold,
        maxComparisons,
      });

      // Step 1: Get chunks for target document
      const { data: targetChunks, error: targetError } = await this.supabase
        .from('knowledge_chunks')
        .select('id, embedding, document_id')
        .eq('document_id', documentId);

      if (targetError || !targetChunks) {
        warn('[CONFLICT ENGINE] ⚠️ Failed to fetch target chunks:', targetError?.message);
        return {
          documentId,
          conflictsDetected: 0,
          conflicts: [],
          processingTimeMs: Date.now() - startTime,
        };
      }

      if (targetChunks.length === 0) {
        log('[CONFLICT ENGINE] ℹ️ Target document has no chunks');
        return {
          documentId,
          conflictsDetected: 0,
          conflicts: [],
          processingTimeMs: Date.now() - startTime,
        };
      }

      log('[CONFLICT ENGINE] 📦 Loaded', targetChunks.length, 'target chunks');

      // Step 2: Get other chunks (with safety limit)
      const { data: otherChunks, error: otherError } = await this.supabase
        .from('knowledge_chunks')
        .select('id, embedding, document_id')
        .neq('document_id', documentId)
        .limit(maxComparisons);

      if (otherError || !otherChunks) {
        warn('[CONFLICT ENGINE] ⚠️ Failed to fetch comparison chunks:', otherError?.message);
        return {
          documentId,
          conflictsDetected: 0,
          conflicts: [],
          processingTimeMs: Date.now() - startTime,
        };
      }

      log('[CONFLICT ENGINE] 📦 Loaded', otherChunks.length, 'comparison chunks');

      // Step 3: Compare embeddings and detect conflicts
      const conflicts: KnowledgeConflict[] = [];
      let comparisonCount = 0;

      for (const targetChunk of targetChunks) {
        if (!targetChunk.embedding) continue;

        const targetEmbedding = Array.isArray(targetChunk.embedding)
          ? targetChunk.embedding
          : JSON.parse(targetChunk.embedding);

        for (const otherChunk of otherChunks) {
          if (!otherChunk.embedding) continue;

          comparisonCount++;

          const otherEmbedding = Array.isArray(otherChunk.embedding)
            ? otherChunk.embedding
            : JSON.parse(otherChunk.embedding);

          const similarity = cosineSimilarity(targetEmbedding, otherEmbedding);

          // High similarity = potential conflict
          if (similarity > threshold) {
            const conflict: KnowledgeConflict = {
              documentA: documentId,
              documentB: otherChunk.document_id,
              chunkA: targetChunk.id,
              chunkB: otherChunk.id,
              similarityScore: parseFloat(similarity.toFixed(2)),
              conflictScore: parseFloat(Math.min(1, similarity - threshold).toFixed(2)),
              conflictType: 'semantic_contradiction',
              conflictReason: 'High semantic similarity between documents suggests potential conflict',
            };

            conflicts.push(conflict);
          }
        }
      }

      log('[CONFLICT ENGINE] ✅ Comparisons complete', {
        comparisons: comparisonCount,
        conflictsFound: conflicts.length,
      });

      // Step 4: Persist conflicts (non-blocking)
      if (conflicts.length > 0) {
        await this.persistConflicts(conflicts);
      }

      const result: ConflictDetectionResult = {
        documentId,
        conflictsDetected: conflicts.length,
        conflicts,
        processingTimeMs: Date.now() - startTime,
      };

      log('[CONFLICT ENGINE] 🎯 Detection complete', {
        conflicts: result.conflictsDetected,
        timeMs: result.processingTimeMs,
      });

      return result;
    } catch (error) {
      errorLog('[CONFLICT ENGINE] 💥 Detection error:', error);

      return {
        documentId,
        conflictsDetected: 0,
        conflicts: [],
        processingTimeMs: Date.now() - startTime,
      };
    }
  }

  /**
   * Persist detected conflicts to database
   * Non-blocking, catches errors gracefully
   *
   * @param conflicts Conflicts to persist
   */
  private async persistConflicts(conflicts: KnowledgeConflict[]): Promise<void> {
    try {
      const conflictRows = conflicts.map((c) => ({
        document_a_id: c.documentA,
        document_b_id: c.documentB,
        chunk_a_id: c.chunkA,
        chunk_b_id: c.chunkB,
        similarity_score: c.similarityScore,
        conflict_score: c.conflictScore,
        conflict_type: c.conflictType,
        conflict_reason: c.conflictReason,
      }));

      const { error } = await this.supabase
        .from('knowledge_conflicts')
        .upsert(conflictRows, {
          onConflict: 'document_a_id,document_b_id,conflict_type',
          ignoreDuplicates: true,
        });

      if (error) {
        warn('[CONFLICT ENGINE] ⚠️ Failed to persist conflicts:', error.message);
        return;
      }

      log('[CONFLICT ENGINE] 💾 Persisted', conflictRows.length, 'conflicts');
    } catch (error) {
      errorLog('[CONFLICT ENGINE] 💥 Persistence error:', error);
      // Non-blocking: don't throw
    }
  }

  /**
   * Get conflict statistics
   */
  async getConflictStatistics(): Promise<ConflictStatistics | null> {
    try {
      const { data: conflicts, error } = await this.supabase
        .from('knowledge_conflicts')
        .select('conflict_type, conflict_score, status');

      if (error || !conflicts) {
        warn('[CONFLICT ENGINE] ⚠️ Failed to fetch statistics:', error?.message);
        return null;
      }

      const stats: ConflictStatistics = {
        totalConflicts: conflicts.length,
        unreviewedCount: conflicts.filter((c) => c.status === 'unreviewed').length,
        byType: {
          numerical_conflict: 0,
          regulatory_conflict: 0,
          semantic_contradiction: 0,
          source_priority_conflict: 0,
        },
        avgConflictScore: 0,
        highSeverityCount: 0,
      };

      let totalScore = 0;

      for (const conflict of conflicts) {
        const type = conflict.conflict_type as ConflictType;
        stats.byType[type] = (stats.byType[type] || 0) + 1;
        totalScore += conflict.conflict_score || 0;

        if ((conflict.conflict_score || 0) > 0.8) {
          stats.highSeverityCount++;
        }
      }

      stats.avgConflictScore =
        conflicts.length > 0
          ? parseFloat((totalScore / conflicts.length).toFixed(2))
          : 0;

      return stats;
    } catch (error) {
      errorLog('[CONFLICT ENGINE] 💥 Statistics error:', error);
      return null;
    }
  }
}

/**
 * Singleton instance
 */
let instance: KnowledgeConflictService | null = null;

/**
 * Get or create service instance
 */
export function getKnowledgeConflictService(): KnowledgeConflictService {
  if (!instance) {
    instance = new KnowledgeConflictService();
  }
  return instance;
}

/**
 * Reset instance (for testing)
 */
export function resetKnowledgeConflictService(): void {
  instance = null;
}

// Export singleton as default
export default getKnowledgeConflictService();
