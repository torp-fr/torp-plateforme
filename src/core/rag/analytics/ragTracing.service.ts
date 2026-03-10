/**
 * RAG — Tracing Service
 * Tracks the embedding → retrieval → compression pipeline for observability.
 */

import { log } from '@/lib/logger';

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

const traces: RagTraceEntry[] = [];
const MAX_TRACES = 100;

/**
 * Record a RAG pipeline trace entry.
 */
export function recordRagTrace(entry: Omit<RagTraceEntry, 'timestamp'>): void {
  const trace: RagTraceEntry = {
    ...entry,
    timestamp: new Date().toISOString(),
  };

  traces.unshift(trace);
  if (traces.length > MAX_TRACES) {
    traces.pop();
  }

  log('[RAG:Tracing] 📊 Trace recorded:', {
    traceId: trace.traceId,
    query: trace.query.substring(0, 50),
    retrievalCount: trace.retrievalCount,
    totalMs: trace.totalMs,
  });
}

/**
 * Get recent trace entries.
 */
export function getRecentTraces(limit = 10): RagTraceEntry[] {
  return traces.slice(0, limit);
}

/**
 * Clear all stored traces.
 */
export function clearTraces(): void {
  traces.length = 0;
}
