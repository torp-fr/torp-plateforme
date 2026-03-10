/**
 * RAG — Tracing Service
 * Tracks the embedding → retrieval → compression pipeline for observability.
 * Traces are persisted to the `rag_query_traces` Supabase table.
 */

import { supabase } from '@/lib/supabase';
import { log, warn } from '@/lib/logger';

export interface RagTraceEntry {
  traceId: string;
  query: string;
  retrievalCount: number;
  compressedCount: number;
  embeddingMs?: number;
  retrievalMs?: number;
  compressionMs?: number;
  totalMs?: number;
  timestamp: string;
}

// ---------------------------------------------------------------------------
// DB row → RagTraceEntry
// ---------------------------------------------------------------------------

function rowToTraceEntry(row: Record<string, unknown>): RagTraceEntry {
  const retrieved = (row.retrieved_chunks as Record<string, unknown>) ?? {};
  const reranked  = (row.reranked_chunks  as Record<string, unknown>) ?? {};
  return {
    traceId:        String(row.id ?? ''),
    query:          String(row.query ?? ''),
    retrievalCount: Number(retrieved.count  ?? 0),
    compressedCount:Number(reranked.count   ?? 0),
    embeddingMs:    retrieved.embeddingMs != null ? Number(retrieved.embeddingMs) : undefined,
    retrievalMs:    retrieved.retrievalMs  != null ? Number(retrieved.retrievalMs) : undefined,
    compressionMs:  reranked.compressionMs  != null ? Number(reranked.compressionMs) : undefined,
    totalMs:        retrieved.totalMs      != null ? Number(retrieved.totalMs)      : undefined,
    timestamp:      String(row.created_at ?? ''),
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Record a RAG pipeline trace entry.
 * Inserts into `rag_query_traces` asynchronously (fire-and-forget).
 * Does not block the caller.
 */
export function recordRagTrace(entry: Omit<RagTraceEntry, 'timestamp'>): void {
  const retrieved_chunks = {
    count:       entry.retrievalCount,
    embeddingMs: entry.embeddingMs,
    retrievalMs: entry.retrievalMs,
    totalMs:     entry.totalMs,
  };

  const reranked_chunks = {
    count:         entry.compressedCount,
    compressionMs: entry.compressionMs,
  };

  const final_context = entry.traceId;

  supabase
    .from('rag_query_traces')
    .insert({ query: entry.query, retrieved_chunks, reranked_chunks, final_context })
    .then(({ error }) => {
      if (error) {
        warn('[RAG:Tracing] ⚠️ Failed to persist trace:', error.message);
        return;
      }
      log('[RAG:Tracing] 📊 Trace persisted:', {
        traceId:        entry.traceId,
        query:          entry.query.substring(0, 50),
        retrievalCount: entry.retrievalCount,
        totalMs:        entry.totalMs,
      });
    });
}

/**
 * Get recent trace entries from the database.
 */
export async function getRecentTraces(limit = 10): Promise<RagTraceEntry[]> {
  const { data, error } = await supabase
    .from('rag_query_traces')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(Math.min(limit, 50));

  if (error) {
    warn('[RAG:Tracing] ⚠️ Failed to fetch traces:', error.message);
    return [];
  }

  return (data ?? []).map(rowToTraceEntry);
}

/**
 * Clear all stored traces.
 * No-op for DB-backed storage — delete rows directly in Supabase if needed.
 */
export function clearTraces(): void {
  warn('[RAG:Tracing] ⚠️ clearTraces() is a no-op for DB-backed storage');
}
