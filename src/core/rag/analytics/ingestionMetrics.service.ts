/**
 * RAG — Ingestion Metrics Service
 * Tracks ingestion analytics: chunk counts, token stats, success rates.
 */

import { IngestionMetrics, DEFAULT_METRICS } from '../types';
import { log } from '@/lib/logger';

let metrics: IngestionMetrics = { ...DEFAULT_METRICS };

export function getIngestionMetrics(): IngestionMetrics {
  return { ...metrics };
}

export function resetIngestionMetrics(): void {
  metrics = { ...DEFAULT_METRICS };
  log('[RAG:Metrics] 🔄 Metrics reset');
}

export function incrementTotalDocuments(): void {
  metrics.total_documents_processed++;
}

export function incrementSuccessful(): void {
  metrics.successful_ingestions++;
}

export function incrementFailed(): void {
  metrics.failed_ingestions++;
}

export function recordIntegrityFailure(): void {
  metrics.integrity_check_failures++;
}

export function incrementRetrySuccess(): void {
  metrics.retry_success_rate++;
}

export function updateChunkAverage(newChunkCount: number): void {
  const total = metrics.total_documents_processed || 1;
  metrics.avg_chunks_per_document =
    (metrics.avg_chunks_per_document * (total - 1) + newChunkCount) / total;
}

export function updateEmbeddingTimeAverage(newTimeMs: number): void {
  const total = metrics.total_documents_processed || 1;
  metrics.avg_embedding_time_per_chunk =
    (metrics.avg_embedding_time_per_chunk * (total - 1) + newTimeMs) / total;
}
