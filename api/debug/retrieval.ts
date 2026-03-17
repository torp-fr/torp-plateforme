/**
 * GET /api/debug/retrieval?q=<query>
 * Runs semantic search and returns debug metadata for each retrieved chunk.
 *
 * Mirrors: src/core/knowledge/debug/retrievalDebugger.service.ts → debugRetrieval()
 *
 * Pipeline:
 *   1. Generate query embedding via Supabase Edge Function `generate-embedding`
 *   2. Call RPC `match_knowledge_chunks` for hybrid vector + FTS search
 *   3. Return ranked results with preview of first 200 chars per chunk
 *
 * Query params:
 *   q          - search query (required)
 *   limit      - max results (default: 10)
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getServerSupabase } from '../_lib/supabase.js';

const EMBEDDING_MODEL = 'text-embedding-3-small';
const EMBEDDING_DIMENSIONS = 1536;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  const query = typeof req.query.q === 'string' ? req.query.q.trim() : '';
  if (!query) {
    return res
      .status(400)
      .json({ success: false, error: 'Missing required query param: q' });
  }

  const limit = Math.min(
    parseInt(typeof req.query.limit === 'string' ? req.query.limit : '10', 10) || 10,
    50
  );

  try {
    const supabase = getServerSupabase();

    // Step 1: Generate embedding via Supabase Edge Function
    const { data: embData, error: embError } = await supabase.functions.invoke(
      'generate-embedding',
      {
        body: {
          inputs: [query],
          model: EMBEDDING_MODEL,
          dimensions: EMBEDDING_DIMENSIONS,
        },
      }
    );

    if (embError || !embData?.embeddings?.[0]) {
      throw new Error(
        `Embedding generation failed: ${embError?.message ?? 'No embeddings returned'}`
      );
    }

    const queryEmbedding: number[] = embData.embeddings[0];

    // Step 2: Hybrid semantic search via pgvector + FTS
    const { data: rows, error: rpcError } = await supabase.rpc(
      'match_knowledge_chunks',
      {
        query_embedding: queryEmbedding,
        query_text: query,
        match_count: limit,
      }
    );

    if (rpcError) {
      throw new Error(`RPC match_knowledge_chunks failed: ${rpcError.message}`);
    }

    const results = (rows ?? []).map(
      (
        row: {
          id: string;
          document_id: string;
          content: string;
          similarity: number;
        },
        index: number
      ) => ({
        rank: index + 1,
        similarity: row.similarity,
        documentId: row.document_id,
        chunkId: row.id,
        preview: (row.content ?? '').slice(0, 200),
      })
    );

    return res.status(200).json({ success: true, data: results });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[/api/debug/retrieval] Error:', message);
    return res.status(500).json({ success: false, error: message });
  }
}
