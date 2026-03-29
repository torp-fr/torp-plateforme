/**
 * Brain Metrics Layer Types
 * Read-only analytics for RAG engine monitoring
 */

/**
 * Brain health snapshot: document counts, statuses, quality scores
 */
export interface BrainHealthMetrics {
  metric_timestamp: string;

  // Document counts
  total_documents: number;
  publishable_documents: number;
  non_publishable_documents: number;

  // Ingestion status breakdown
  status_complete: number;
  status_processing: number;
  status_pending: number;
  status_failed: number;
  status_chunking: number;
  status_embedding: number;

  // Quality metrics
  avg_integrity_score: number; // 0.0 - 1.0
  min_integrity_score: number;
  max_integrity_score: number;

  // Error tracking
  documents_with_errors: number;

  // Chunk metrics
  total_chunks: number;
  avg_chunks_per_document: number;
}

/**
 * Embedding coverage and distribution metrics
 */
export interface BrainEmbeddingMetrics {
  metric_timestamp: string;

  // Overall embedding coverage
  total_chunks: number;
  chunks_with_embedding: number;
  chunks_without_embedding: number;

  // Coverage percentage
  embedding_coverage_percent: number; // 0.0 - 100.0

  // Document categories
  unique_categories: number;

  // Token metrics
  avg_token_count_per_chunk: number;
  min_token_count: number;
  max_token_count: number;

  // Category breakdown
  category_breakdown: Record<
    string,
    {
      total_chunks: number;
      with_embedding: number;
      coverage_percent: number;
    }
  >;
}

/**
 * Comprehensive Brain health status and RPC performance
 */
export interface BrainGlobalHealth {
  metric_timestamp: string;

  // Overall health
  overall_health_score: number; // 0 - 100
  system_status: 'HEALTHY' | 'DEGRADED' | 'CRITICAL';

  // Document metrics
  total_docs: number;
  publishable_docs: number;
  publishable_percent: number; // 0.0 - 100.0
  avg_integrity_score: number; // 0.0 - 1.0

  // Search performance (last 24h)
  searches_last_24h: number;
  search_success_rate_percent: number; // 0.0 - 100.0
  avg_search_time_ms: number;

  // RPC performance details
  rpc_performance_24h: Record<
    string,
    {
      calls_24h: number;
      successful: number;
      failed: number;
      success_rate_percent: number;
      avg_time_ms: number;
    }
  >;
}

/**
 * Quick summary: all metrics in one view
 */
export interface BrainMetricsSummary {
  overall_health_score: number; // 0 - 100
  system_status: 'HEALTHY' | 'DEGRADED' | 'CRITICAL';
  total_docs: number;
  publishable_percent: number; // 0.0 - 100.0
  embedding_coverage_percent: number; // 0.0 - 100.0
  searches_last_24h: number;
  search_success_rate_percent: number; // 0.0 - 100.0
  avg_search_time_ms: number;
  metric_timestamp: string;
}

/**
 * Combined response from getBrainMetrics()
 */
export interface BrainMetricsResponse {
  health: BrainHealthMetrics;
  embedding: BrainEmbeddingMetrics;
  global_health: BrainGlobalHealth;
  summary: BrainMetricsSummary;
  retrieved_at: string;
}

/**
 * Error response for metrics operations
 */
export interface BrainMetricsError {
  error: true;
  code: 'RETRIEVAL_FAILED' | 'INVALID_QUERY' | 'PERMISSION_DENIED';
  message: string;
  details?: unknown;
}

/**
 * Type guard for error responses
 */
export function isBrainMetricsError(
  response: unknown
): response is BrainMetricsError {
  return (
    typeof response === 'object' &&
    response !== null &&
    'error' in response &&
    (response as any).error === true
  );
}
