/**
 * GET /api/debug/chunks?documentId=<id>
 * Returns a visualization of all chunks for a given document, ordered by chunk_index.
 *
 * Mirrors: src/core/knowledge/debug/chunkVisualizer.service.ts → visualizeChunks()
 *
 * Query params:
 *   documentId - document UUID (required)
 *
 * Response data per chunk:
 *   chunk   - chunk_index (order in document)
 *   tokens  - token_count
 *   quality - metadata.qualityScore (null if not set)
 *   preview - first 250 chars of content
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getServerSupabase } from '../_lib/supabase.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  const documentId =
    typeof req.query.documentId === 'string' ? req.query.documentId.trim() : '';

  if (!documentId) {
    return res
      .status(400)
      .json({ success: false, error: 'Missing required query param: documentId' });
  }

  try {
    const supabase = getServerSupabase();

    const { data, error: dbError } = await supabase
      .from('knowledge_chunks')
      .select('chunk_index, token_count, metadata, content')
      .eq('document_id', documentId)
      .order('chunk_index', { ascending: true });

    if (dbError) {
      throw new Error(`Failed to fetch chunks: ${dbError.message}`);
    }

    const chunks = (data ?? []).map(
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

    return res.status(200).json({ success: true, data: chunks });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[/api/debug/chunks] Error:', message);
    return res.status(500).json({ success: false, error: message });
  }
}
