/**
 * Ingestion Dashboard Service
 * Developer tool to inspect global knowledge ingestion metrics.
 */

import { supabase } from '@/lib/supabase';
import { log, error } from '@/lib/logger';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface IngestionDashboard {
  documents: number;
  chunks: number;
  embeddings: number;
  avgQuality: number;
  publishableDocuments: number;
}

// ---------------------------------------------------------------------------
// getIngestionDashboard
// ---------------------------------------------------------------------------

/**
 * Returns global ingestion metrics from the knowledge base.
 * Queries knowledge_documents and knowledge_chunks tables.
 */
export async function getIngestionDashboard(): Promise<IngestionDashboard> {
  log('[IngestionDashboard] Fetching ingestion metrics');

  try {
    const [
      { count: documents },
      { count: chunks },
      { count: embeddings },
      { count: publishableDocuments },
      { data: qualityRows },
    ] = await Promise.all([
      supabase.from('knowledge_documents').select('*', { count: 'exact', head: true }),
      supabase.from('knowledge_chunks').select('*', { count: 'exact', head: true }),
      supabase
        .from('knowledge_chunks')
        .select('*', { count: 'exact', head: true })
        .not('embedding_vector', 'is', null),
      supabase
        .from('knowledge_documents')
        .select('*', { count: 'exact', head: true })
        .eq('is_publishable', true),
      supabase.from('knowledge_chunks').select('metadata'),
    ]);

    let avgQuality = 0;
    if (qualityRows && qualityRows.length > 0) {
      const scores = qualityRows
        .map((row: { metadata?: { qualityScore?: number } }) => row.metadata?.qualityScore)
        .filter((score): score is number => typeof score === 'number');

      if (scores.length > 0) {
        avgQuality = scores.reduce((sum, s) => sum + s, 0) / scores.length;
      }
    }

    const result: IngestionDashboard = {
      documents: documents ?? 0,
      chunks: chunks ?? 0,
      embeddings: embeddings ?? 0,
      avgQuality: Math.round(avgQuality * 1000) / 1000,
      publishableDocuments: publishableDocuments ?? 0,
    };

    log('[IngestionDashboard] Metrics retrieved:', result);
    return result;
  } catch (err) {
    error('[IngestionDashboard] Failed to fetch metrics:', err);
    return {
      documents: 0,
      chunks: 0,
      embeddings: 0,
      avgQuality: 0,
      publishableDocuments: 0,
    };
  }
}
