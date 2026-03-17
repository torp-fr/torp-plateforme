/**
 * GET /api/debug/ingestion
 * Returns global knowledge ingestion metrics.
 *
 * Mirrors the logic from:
 *   src/core/knowledge/debug/ingestionDashboard.service.ts → getIngestionDashboard()
 *
 * Queries:
 *   - knowledge_documents: total count, publishable count
 *   - knowledge_chunks: total count, embeddings count (embedding_vector IS NOT NULL), avg quality
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getServerSupabase } from '../_lib/supabase.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    const supabase = getServerSupabase();

    const [
      { count: documents, error: e1 },
      { count: chunks, error: e2 },
      { count: embeddings, error: e3 },
      { count: publishableDocuments, error: e4 },
      { data: qualityRows, error: e5 },
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

    const errors = [e1, e2, e3, e4, e5].filter(Boolean);
    if (errors.length > 0) {
      console.error('[/api/debug/ingestion] DB errors:', errors.map((e) => e?.message));
    }

    let avgQuality = 0;
    if (qualityRows && qualityRows.length > 0) {
      const scores = qualityRows
        .map((row: { metadata?: { qualityScore?: number } }) => row.metadata?.qualityScore)
        .filter((score): score is number => typeof score === 'number');

      if (scores.length > 0) {
        avgQuality = scores.reduce((sum, s) => sum + s, 0) / scores.length;
      }
    }

    return res.status(200).json({
      success: true,
      data: {
        documents: documents ?? 0,
        chunks: chunks ?? 0,
        embeddings: embeddings ?? 0,
        avgQuality: Math.round(avgQuality * 1000) / 1000,
        publishableDocuments: publishableDocuments ?? 0,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[/api/debug/ingestion] Error:', message);
    return res.status(500).json({ success: false, error: message });
  }
}
