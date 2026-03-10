/**
 * GET /api/debug/rag-trace?q=<query>
 * Traces the full RAG pipeline: embedding → retrieval → context compression preview.
 *
 * Mirrors: src/core/knowledge/debug/ragTrace.service.ts → traceRAG()
 *
 * Pipeline:
 *   1. Generate query embedding via Supabase Edge Function `generate-embedding`
 *   2. Run hybrid semantic search via RPC `match_knowledge_chunks`
 *   3. Return each step with metadata for debugging
 *
 * Note: Context compression (LLM-based summarisation) is skipped here to keep
 * the debug endpoint fast and free from LLM latency. Compression previews fall
 * back to raw retrieval chunk previews.
 *
 * Query params:
 *   q     - search query (required)
 *   limit - max retrieval results (default: 10)
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getServerSupabase } from '../_lib/supabase';

const EMBEDDING_MODEL = 'text-embedding-3-small';
const EMBEDDING_DIMENSIONS = 384;

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

    // ── Step 1: Generate query embedding ───────────────────────────────────
    let embedding: number[] | null = null;

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

    if (embError) {
      console.warn('[/api/debug/rag-trace] Embedding failed:', embError.message);
    } else if (embData?.embeddings?.[0]) {
      embedding = embData.embeddings[0] as number[];
    }

    const dimensions = embedding ? embedding.length : 0;

    // ── Step 2: Hybrid semantic search ─────────────────────────────────────
    type RetrievedChunk = {
      id: string;
      document_id: string;
      content: string;
      similarity: number;
    };

    let retrievalResults: RetrievedChunk[] = [];

    if (embedding) {
      const { data: rows, error: rpcError } = await supabase.rpc(
        'match_knowledge_chunks',
        {
          query_embedding: embedding,
          query_text: query,
          match_count: limit,
        }
      );

      if (rpcError) {
        console.warn('[/api/debug/rag-trace] RPC failed:', rpcError.message);
      } else {
        retrievalResults = rows ?? [];
      }
    }

    // ── Step 3: Compression preview (fallback to raw chunks) ───────────────
    // Full LLM-based compression is not run here to avoid latency and cost.
    // The frontend can trigger compression separately if needed.
    const compressionPreviews = retrievalResults.map((chunk) => ({
      preview: (chunk.content ?? '').slice(0, 200),
    }));

    return res.status(200).json({
      success: true,
      data: {
        query,
        steps: {
          embedding: { dimensions },
          retrieval: retrievalResults.map((chunk) => ({
            chunkId: chunk.id,
            similarity: chunk.similarity,
            preview: (chunk.content ?? '').slice(0, 200),
          })),
          compression: compressionPreviews,
        },
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[/api/debug/rag-trace] Error:', message);
    return res.status(500).json({ success: false, error: message });
  }
}
