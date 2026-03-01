/**
 * PHASE 36.10.5: Knowledge Health & Monitoring Service
 * Purpose: Production observability, health checks, and system diagnostics
 * Status: Industrial-Grade Monitoring
 */

import { supabase } from '@/lib/supabase';
import { log, warn, error, time, timeEnd } from '@/lib/logger';

interface SystemHealthStatus {
  total_documents: number;
  pending_documents: number;
  processing_documents: number;
  failed_documents: number;
  complete_documents: number;
  documents_missing_embeddings: number;
  avg_chunks_per_doc: number;
  vector_dimension_valid: boolean;
  ingestion_stalled_documents: number;
  last_document_processed_at: string | null;
  system_healthy: boolean;
  health_timestamp: string;
}

interface VectorDimensionDiagnostic {
  total_chunks_with_embeddings: number;
  avg_dimension: number;
  min_dimension: number;
  max_dimension: number;
  dimension_uniform: boolean;
  invalid_chunks: number;
  health_status: string;
  diagnostic_timestamp: string;
}

interface StalledDocument {
  document_id: string;
  ingestion_status: string;
  ingestion_started_at: string;
  minutes_stuck: number;
  ingestion_progress: number;
  chunk_count: number;
  last_ingestion_step: string | null;
  last_ingestion_error: string | null;
  stall_severity: 'MEDIUM' | 'HIGH' | 'CRITICAL';
}

interface EmbeddingGap {
  document_id: string;
  document_title: string;
  total_chunks: number;
  missing_embeddings: number;
  gap_percentage: number;
  created_at: string;
}

interface RpcPerformanceStat {
  rpc_name: string;
  total_executions: number;
  avg_execution_time_ms: number;
  min_execution_time_ms: number;
  max_execution_time_ms: number;
  error_count: number;
  error_rate_percent: number;
  avg_result_count: number;
}

interface EmbeddingPerformanceStat {
  total_embeddings_generated: number;
  avg_time_ms: number;
  min_time_ms: number;
  max_time_ms: number;
  p50_time_ms: number;
  p95_time_ms: number;
  p99_time_ms: number;
  total_documents_processed: number;
  avg_chunks_per_doc: number;
}

interface SystemStatusView {
  total_documents: number;
  complete_documents: number;
  failed_documents: number;
  pending_documents: number;
  processing_documents: number;
  documents_missing_embeddings: number;
  ingestion_stalled_documents: number;
  avg_chunks_per_doc: number;
  last_document_processed_at: string | null;
  vector_dimension_valid: boolean;
  dimension_uniform: boolean;
  total_chunks_with_embeddings: number;
  invalid_chunks: number;
  system_healthy: boolean;
  completion_percentage: number;
  failure_percentage: number;
  status_timestamp: string;
}

export class KnowledgeHealthService {
  /**
   * 🏥 GET SYSTEM HEALTH STATUS
   * Comprehensive health report of the entire knowledge base system
   */
  async getSystemHealth(): Promise<SystemHealthStatus> {
    try {
      const startTime = Date.now();

      const { data, error } = await supabase.rpc(
        'system_health_status'
      );

      if (error) {
        console.error(`[HEALTH] system_health_status RPC failed: ${error.message}`);
        throw new Error(`Health check failed: ${error.message}`);
      }

      const executionTime = Date.now() - startTime;
      log(
        `[HEALTH] System health check completed in ${executionTime}ms`
      );

      if (!data || data.length === 0) {
        throw new Error('No health data returned from RPC');
      }

      // Log health metrics
      const health = data[0] as SystemHealthStatus;
      this.logHealthMetrics(health);

      return health;
    } catch (error) {
      console.error(`[HEALTH] 🔴 Failed to get system health: ${error}`);
      throw error;
    }
  }

  /**
   * 📊 GET VECTOR DIMENSION DIAGNOSTIC
   * Validates all embeddings are exactly 1536-dimensional
   */
  async getVectorDiagnostics(): Promise<VectorDimensionDiagnostic> {
    try {
      const startTime = Date.now();

      const { data, error } = await supabase.rpc(
        'vector_dimension_diagnostic'
      );

      if (error) {
        console.error(
          `[VECTOR] vector_dimension_diagnostic RPC failed: ${error.message}`
        );
        throw new Error(`Vector diagnostic failed: ${error.message}`);
      }

      const executionTime = Date.now() - startTime;

      if (!data || data.length === 0) {
        throw new Error('No vector diagnostic data returned');
      }

      const diagnostic = data[0] as VectorDimensionDiagnostic;

      // Log vector health
      log(
        `[VECTOR] Dimension check: avg=${diagnostic.avg_dimension}, ` +
        `min=${diagnostic.min_dimension}, max=${diagnostic.max_dimension}, ` +
        `uniform=${diagnostic.dimension_uniform}, ` +
        `time=${executionTime}ms`
      );

      if (!diagnostic.dimension_uniform) {
        warn(
          `[VECTOR] ⚠️ Non-uniform vector dimensions detected! ` +
          `Invalid chunks: ${diagnostic.invalid_chunks}`
        );
      }

      return diagnostic;
    } catch (error) {
      console.error(`[VECTOR] 🔴 Vector diagnostic failed: ${error}`);
      throw error;
    }
  }

  /**
   * 🚨 GET STALLED DOCUMENTS
   * Detect documents stuck in processing states (> threshold minutes)
   */
  async getStalledDocuments(
    thresholdMinutes: number = 20
  ): Promise<StalledDocument[]> {
    try {
      const startTime = Date.now();

      const { data, error } = await supabase.rpc(
        'detect_stalled_ingestion',
        { stall_threshold_minutes: thresholdMinutes }
      );

      if (error) {
        console.error(
          `[STALL] detect_stalled_ingestion RPC failed: ${error.message}`
        );
        throw new Error(`Stall detection failed: ${error.message}`);
      }

      const executionTime = Date.now() - startTime;
      const stalledCount = (data || []).length;

      if (stalledCount > 0) {
        warn(
          `[STALL] ⚠️ Found ${stalledCount} stalled documents, ` +
          `query time=${executionTime}ms`
        );

        // Log critical stalls
        const criticalStalls = (data as StalledDocument[]).filter(
          (d) => d.stall_severity === 'CRITICAL'
        );
        if (criticalStalls.length > 0) {
          console.error(
            `[STALL] 🔴 CRITICAL: ${criticalStalls.length} documents ` +
            `stuck >60min: ${criticalStalls.map((d) => d.document_id).join(', ')}`
          );
        }
      } else {
        log(`[STALL] ✅ No stalled documents detected, time=${executionTime}ms`);
      }

      return (data as StalledDocument[]) || [];
    } catch (error) {
      console.error(`[STALL] 🔴 Stall detection failed: ${error}`);
      throw error;
    }
  }

  /**
   * 🔍 GET EMBEDDING GAPS
   * Find complete documents with missing embeddings
   */
  async getEmbeddingGaps(): Promise<EmbeddingGap[]> {
    try {
      const startTime = Date.now();

      const { data, error } = await supabase.rpc(
        'detect_embedding_gaps'
      );

      if (error) {
        console.error(
          `[EMBEDDINGS] detect_embedding_gaps RPC failed: ${error.message}`
        );
        throw new Error(`Gap detection failed: ${error.message}`);
      }

      const executionTime = Date.now() - startTime;
      const gapCount = (data || []).length;

      if (gapCount > 0) {
        warn(
          `[EMBEDDINGS] ⚠️ Found ${gapCount} documents with embedding gaps, ` +
          `time=${executionTime}ms`
        );
      } else {
        log(
          `[EMBEDDINGS] ✅ No embedding gaps detected, time=${executionTime}ms`
        );
      }

      return (data as EmbeddingGap[]) || [];
    } catch (error) {
      console.error(`[EMBEDDINGS] 🔴 Gap detection failed: ${error}`);
      throw error;
    }
  }

  /**
   * 📈 GET RPC PERFORMANCE STATISTICS
   * Analyze search RPC performance metrics
   */
  async getRpcPerformanceStats(
    timeWindowHours: number = 24
  ): Promise<RpcPerformanceStat[]> {
    try {
      const startTime = Date.now();

      const { data, error } = await supabase.rpc(
        'get_rpc_performance_stats',
        { time_window_hours: timeWindowHours }
      );

      if (error) {
        console.error(
          `[PERF] get_rpc_performance_stats RPC failed: ${error.message}`
        );
        throw new Error(`Performance stats failed: ${error.message}`);
      }

      const executionTime = Date.now() - startTime;

      if (data && data.length > 0) {
        log(
          `[PERF] RPC Performance (${timeWindowHours}h window):` +
          ` ${data.map((d: RpcPerformanceStat) =>
              `${d.rpc_name}: avg=${d.avg_execution_time_ms}ms, ` +
              `err_rate=${d.error_rate_percent}%`
            ).join(', ')}, ` +
          `query_time=${executionTime}ms`
        );
      }

      return (data as RpcPerformanceStat[]) || [];
    } catch (error) {
      console.error(`[PERF] 🔴 Performance stats failed: ${error}`);
      throw error;
    }
  }

  /**
   * ⏱️ GET EMBEDDING PERFORMANCE STATISTICS
   * Analyze embedding generation performance
   */
  async getEmbeddingPerformanceStats(
    timeWindowHours: number = 24
  ): Promise<EmbeddingPerformanceStat | null> {
    try {
      const startTime = Date.now();

      const { data, error } = await supabase.rpc(
        'get_embedding_performance_stats',
        { time_window_hours: timeWindowHours }
      );

      if (error) {
        console.error(
          `[EMBED_PERF] get_embedding_performance_stats RPC failed: ${error.message}`
        );
        throw new Error(`Embedding perf stats failed: ${error.message}`);
      }

      const executionTime = Date.now() - startTime;

      if (data && data.length > 0) {
        const stats = data[0] as EmbeddingPerformanceStat;
        log(
          `[EMBED_PERF] Embedding Performance (${timeWindowHours}h window): ` +
          `total=${stats.total_embeddings_generated}, ` +
          `avg=${stats.avg_time_ms}ms, ` +
          `p95=${stats.p95_time_ms}ms, ` +
          `p99=${stats.p99_time_ms}ms, ` +
          `query_time=${executionTime}ms`
        );
        return stats;
      }

      return null;
    } catch (error) {
      console.error(`[EMBED_PERF] 🔴 Embedding perf stats failed: ${error}`);
      throw error;
    }
  }

  /**
   * 🎯 GET COMPLETE SYSTEM STATUS VIEW
   * Single consolidated view of entire system health
   */
  async getSystemStatusView(): Promise<SystemStatusView> {
    try {
      const startTime = Date.now();

      const { data, error } = await supabase
        .from('knowledge_system_status')
        .select('*');

      if (error) {
        console.error(
          `[STATUS_VIEW] Failed to query system status view: ${error.message}`
        );
        throw new Error(`Status view query failed: ${error.message}`);
      }

      const executionTime = Date.now() - startTime;

      if (!data || data.length === 0) {
        throw new Error('No system status data returned');
      }

      const status = data[0] as SystemStatusView;

      // Log summary
      log(
        `[STATUS_VIEW] System Status Summary: ` +
        `total=${status.total_documents}, ` +
        `complete=${status.complete_documents} (${status.completion_percentage}%), ` +
        `failed=${status.failed_documents} (${status.failure_percentage}%), ` +
        `healthy=${status.system_healthy}, ` +
        `query_time=${executionTime}ms`
      );

      return status;
    } catch (error) {
      console.error(`[STATUS_VIEW] 🔴 Status view query failed: ${error}`);
      throw error;
    }
  }

  /**
   * 📊 LOG RPC METRIC
   * Record RPC execution metrics to database
   */
  async logRpcMetric(
    rpcName: string,
    executionTimeMs: number,
    resultCount: number = 0,
    error: boolean = false,
    errorMessage?: string
  ): Promise<string | null> {
    try {
      const { data, error: dbError } = await supabase.rpc(
        'log_rpc_metric',
        {
          p_rpc_name: rpcName,
          p_execution_time_ms: executionTimeMs,
          p_result_count: resultCount,
          p_error: error,
          p_error_message: errorMessage || null
        }
      );

      if (dbError) {
        warn(
          `[METRICS] Failed to log RPC metric: ${dbError.message}`
        );
        return null;
      }

      return (data as string) || null;
    } catch (error) {
      warn(`[METRICS] Failed to log RPC metric: ${error}`);
      return null;
    }
  }

  /**
   * ⏱️ LOG EMBEDDING METRIC
   * Record embedding generation metrics to database
   */
  async logEmbeddingMetric(
    documentId: string,
    chunkId: string,
    embeddingTimeMs: number,
    embeddingDimension: number = 1536,
    provider: string = 'openai'
  ): Promise<string | null> {
    try {
      const { data, error } = await supabase.rpc(
        'log_embedding_metric',
        {
          p_document_id: documentId,
          p_chunk_id: chunkId,
          p_embedding_time_ms: embeddingTimeMs,
          p_embedding_dimension: embeddingDimension,
          p_provider: provider
        }
      );

      if (error) {
        warn(
          `[METRICS] Failed to log embedding metric: ${error.message}`
        );
        return null;
      }

      return (data as string) || null;
    } catch (error) {
      warn(`[METRICS] Failed to log embedding metric: ${error}`);
      return null;
    }
  }

  /**
   * 🔐 VALIDATE SYSTEM HEALTH BEFORE SEARCH
   * Guard function: Block retrieval if system unhealthy
   */
  async validateSystemHealthBeforeSearch(): Promise<{
    healthy: boolean;
    reason?: string;
    details?: SystemHealthStatus;
  }> {
    try {
      const health = await this.getSystemHealth();

      // Fail-safe checks
      if (!health.vector_dimension_valid) {
        console.error(
          `[GUARD] 🔴 BLOCKING RETRIEVAL: Vector dimension invalid`
        );
        return {
          healthy: false,
          reason: 'Vector dimensions invalid',
          details: health
        };
      }

      if (health.documents_missing_embeddings > 0) {
        warn(
          `[GUARD] ⚠️ WARNING: ${health.documents_missing_embeddings} complete ` +
          `documents with missing embeddings`
        );
        // Not blocking - just warning
      }

      if (health.ingestion_stalled_documents > 0) {
        warn(
          `[GUARD] ⚠️ WARNING: ${health.ingestion_stalled_documents} stalled documents`
        );
        // Not blocking - just warning
      }

      if (!health.system_healthy) {
        warn(
          `[GUARD] ⚠️ System not fully healthy, but retrieval permitted`
        );
      }

      return {
        healthy: true,
        details: health
      };
    } catch (error) {
      console.error(`[GUARD] 🔴 Health validation failed: ${error}`);
      // Fail-safe: block retrieval if we can't validate
      return {
        healthy: false,
        reason: `Health validation failed: ${error}`
      };
    }
  }

  /**
   * 🏥 FULL SYSTEM DIAGNOSTICS
   * Run complete diagnostic suite
   */
  async runFullDiagnostics(): Promise<{
    timestamp: string;
    health: SystemHealthStatus;
    vector: VectorDimensionDiagnostic;
    stalled: StalledDocument[];
    gaps: EmbeddingGap[];
    rpcPerformance: RpcPerformanceStat[];
    embeddingPerformance: EmbeddingPerformanceStat | null;
    systemView: SystemStatusView;
    overallStatus: 'HEALTHY' | 'DEGRADED' | 'CRITICAL';
  }> {
    try {
      log('[DIAGNOSTICS] Starting full system diagnostics...');
      const startTime = Date.now();

      const [
        health,
        vector,
        stalled,
        gaps,
        rpcPerformance,
        embeddingPerformance,
        systemView
      ] = await Promise.all([
        this.getSystemHealth(),
        this.getVectorDiagnostics(),
        this.getStalledDocuments(),
        this.getEmbeddingGaps(),
        this.getRpcPerformanceStats(),
        this.getEmbeddingPerformanceStats(),
        this.getSystemStatusView()
      ]);

      // Determine overall status
      let overallStatus: 'HEALTHY' | 'DEGRADED' | 'CRITICAL' = 'HEALTHY';
      if (!vector.dimension_uniform || gaps.length > 0) {
        overallStatus = 'DEGRADED';
      }
      if (stalled.length > 0 || health.documents_missing_embeddings > 0) {
        overallStatus = 'DEGRADED';
      }
      if (!health.system_healthy) {
        overallStatus = 'CRITICAL';
      }

      const executionTime = Date.now() - startTime;

      log(
        `[DIAGNOSTICS] Full diagnostics completed: ` +
        `status=${overallStatus}, time=${executionTime}ms`
      );

      return {
        timestamp: new Date().toISOString(),
        health,
        vector,
        stalled,
        gaps,
        rpcPerformance,
        embeddingPerformance,
        systemView,
        overallStatus
      };
    } catch (error) {
      console.error(`[DIAGNOSTICS] 🔴 Full diagnostics failed: ${error}`);
      throw error;
    }
  }

  /**
   * 📋 PRIVATE HELPER: Log health metrics
   */
  private logHealthMetrics(health: SystemHealthStatus): void {
    const completionRate = (
      (health.complete_documents / health.total_documents) *
      100
    ).toFixed(2);
    const failureRate = (
      (health.failed_documents / health.total_documents) *
      100
    ).toFixed(2);

    this.logger.log(
      `[HEALTH] Status Summary: ` +
      `total=${health.total_documents}, ` +
      `complete=${health.complete_documents} (${completionRate}%), ` +
      `failed=${health.failed_documents} (${failureRate}%), ` +
      `pending=${health.pending_documents}, ` +
      `processing=${health.processing_documents}, ` +
      `stalled=${health.ingestion_stalled_documents}, ` +
      `vector_valid=${health.vector_dimension_valid}`
    );
  }
}
