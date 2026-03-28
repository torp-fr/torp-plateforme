/**
 * Brain Metrics Service
 * Read-only analytics layer for RAG engine monitoring
 * PHASE: Metrics & Observability
 *
 * PURPOSE:
 * Provides comprehensive metrics for Brain (RAG) health monitoring
 * without impacting the ingestion pipeline or modifying any data.
 *
 * CONSTRAINTS:
 * ✓ Read-only operations (SELECT only)
 * ✓ No pipeline impact (no triggers, no side effects)
 * ✓ No refactoring (all existing tables unchanged)
 */

import { createClient } from '@supabase/supabase-js';
import { log, warn, error as errorLog } from '../logging';
import {
  BrainHealthMetrics,
  BrainEmbeddingMetrics,
  BrainGlobalHealth,
  BrainMetricsSummary,
  BrainMetricsResponse,
  BrainMetricsError,
} from './brainMetrics.types';

/**
 * BrainMetrics Service
 * Aggregates read-only metrics from Brain views
 */
export class BrainMetricsService {
  private supabase = createClient(
    process.env.SUPABASE_URL || '',
    process.env.SUPABASE_ANON_KEY || ''
  );

  /**
   * Get all Brain metrics (comprehensive snapshot)
   * Returns: Health, Embedding, Global Health, and Summary metrics
   *
   * @returns Combined metrics response
   */
  async getBrainMetrics(): Promise<BrainMetricsResponse | BrainMetricsError> {
    const startTime = Date.now();

    try {
      log('[BRAIN METRICS] 📊 Retrieving Brain metrics snapshot...');

      // Fetch all metrics in parallel for performance
      const [healthResult, embeddingResult, globalHealthResult, summaryResult] =
        await Promise.all([
          this.getBrainHealthMetrics(),
          this.getBrainEmbeddingMetrics(),
          this.getBrainGlobalHealth(),
          this.getBrainMetricsSummary(),
        ]);

      // Check for errors in any result
      if (
        'error' in healthResult ||
        'error' in embeddingResult ||
        'error' in globalHealthResult ||
        'error' in summaryResult
      ) {
        const failedMetrics = [
          healthResult,
          embeddingResult,
          globalHealthResult,
          summaryResult,
        ].filter((r) => 'error' in r);

        errorLog(
          '[BRAIN METRICS] 🔴 Failed to retrieve some metrics:',
          failedMetrics
        );

        return {
          error: true,
          code: 'RETRIEVAL_FAILED',
          message: 'Failed to retrieve one or more metrics',
          details: failedMetrics,
        };
      }

      const response: BrainMetricsResponse = {
        health: healthResult,
        embedding: embeddingResult,
        global_health: globalHealthResult,
        summary: summaryResult,
        retrieved_at: new Date().toISOString(),
      };

      const elapsed = Date.now() - startTime;
      log(`[BRAIN METRICS] ✅ Metrics retrieved in ${elapsed}ms`, {
        health_documents: response.health.total_documents,
        embedding_coverage: response.embedding.embedding_coverage_percent,
        health_score: response.global_health.overall_health_score,
      });

      return response;
    } catch (err) {
      const elapsed = Date.now() - startTime;
      errorLog(
        `[BRAIN METRICS] 💥 Error retrieving metrics after ${elapsed}ms:`,
        err
      );

      return {
        error: true,
        code: 'RETRIEVAL_FAILED',
        message: err instanceof Error ? err.message : 'Unknown error',
      };
    }
  }

  /**
   * Get Brain health metrics
   * Document counts, statuses, quality scores
   */
  async getBrainHealthMetrics(): Promise<
    BrainHealthMetrics | BrainMetricsError
  > {
    try {
      const { data, error } = await this.supabase
        .from('brain_health_metrics')
        .select('*')
        .single();

      if (error) {
        warn('[BRAIN METRICS] ⚠️ Health metrics query error:', error.message);
        return {
          error: true,
          code: 'RETRIEVAL_FAILED',
          message: error.message,
        };
      }

      if (!data) {
        warn('[BRAIN METRICS] ⚠️ No health metrics data returned');
        return {
          error: true,
          code: 'RETRIEVAL_FAILED',
          message: 'No data returned from brain_health_metrics view',
        };
      }

      return data as BrainHealthMetrics;
    } catch (err) {
      errorLog('[BRAIN METRICS] 💥 Health metrics error:', err);
      return {
        error: true,
        code: 'RETRIEVAL_FAILED',
        message: err instanceof Error ? err.message : 'Unknown error',
      };
    }
  }

  /**
   * Get Brain embedding metrics
   * Embedding coverage, chunk distribution, token counts
   */
  async getBrainEmbeddingMetrics(): Promise<
    BrainEmbeddingMetrics | BrainMetricsError
  > {
    try {
      const { data, error } = await this.supabase
        .from('brain_embedding_metrics')
        .select('*')
        .single();

      if (error) {
        warn(
          '[BRAIN METRICS] ⚠️ Embedding metrics query error:',
          error.message
        );
        return {
          error: true,
          code: 'RETRIEVAL_FAILED',
          message: error.message,
        };
      }

      if (!data) {
        warn('[BRAIN METRICS] ⚠️ No embedding metrics data returned');
        return {
          error: true,
          code: 'RETRIEVAL_FAILED',
          message: 'No data returned from brain_embedding_metrics view',
        };
      }

      return data as BrainEmbeddingMetrics;
    } catch (err) {
      errorLog('[BRAIN METRICS] 💥 Embedding metrics error:', err);
      return {
        error: true,
        code: 'RETRIEVAL_FAILED',
        message: err instanceof Error ? err.message : 'Unknown error',
      };
    }
  }

  /**
   * Get Brain global health
   * Overall health score, system status, RPC performance
   */
  async getBrainGlobalHealth(): Promise<BrainGlobalHealth | BrainMetricsError> {
    try {
      const { data, error } = await this.supabase
        .from('brain_global_health')
        .select('*')
        .single();

      if (error) {
        warn('[BRAIN METRICS] ⚠️ Global health query error:', error.message);
        return {
          error: true,
          code: 'RETRIEVAL_FAILED',
          message: error.message,
        };
      }

      if (!data) {
        warn('[BRAIN METRICS] ⚠️ No global health data returned');
        return {
          error: true,
          code: 'RETRIEVAL_FAILED',
          message: 'No data returned from brain_global_health view',
        };
      }

      return data as BrainGlobalHealth;
    } catch (err) {
      errorLog('[BRAIN METRICS] 💥 Global health error:', err);
      return {
        error: true,
        code: 'RETRIEVAL_FAILED',
        message: err instanceof Error ? err.message : 'Unknown error',
      };
    }
  }

  /**
   * Get Brain metrics summary
   * Quick snapshot of all key metrics
   */
  async getBrainMetricsSummary(): Promise<
    BrainMetricsSummary | BrainMetricsError
  > {
    try {
      const { data, error } = await this.supabase
        .from('brain_metrics_summary')
        .select('*')
        .single();

      if (error) {
        warn('[BRAIN METRICS] ⚠️ Summary metrics query error:', error.message);
        return {
          error: true,
          code: 'RETRIEVAL_FAILED',
          message: error.message,
        };
      }

      if (!data) {
        warn('[BRAIN METRICS] ⚠️ No summary metrics data returned');
        return {
          error: true,
          code: 'RETRIEVAL_FAILED',
          message: 'No data returned from brain_metrics_summary view',
        };
      }

      return data as BrainMetricsSummary;
    } catch (err) {
      errorLog('[BRAIN METRICS] 💥 Summary metrics error:', err);
      return {
        error: true,
        code: 'RETRIEVAL_FAILED',
        message: err instanceof Error ? err.message : 'Unknown error',
      };
    }
  }

  /**
   * Check if Brain is healthy based on metrics
   * Returns: true if overall_health_score >= 70 AND system_status !== 'CRITICAL'
   */
  async isBrainHealthy(): Promise<boolean> {
    const metrics = await this.getBrainGlobalHealth();

    if ('error' in metrics) {
      warn('[BRAIN METRICS] ⚠️ Cannot determine health (metrics unavailable)');
      return false;
    }

    const isHealthy =
      metrics.overall_health_score >= 70 && metrics.system_status !== 'CRITICAL';

    log('[BRAIN METRICS] 🔍 Health check:', {
      score: metrics.overall_health_score,
      status: metrics.system_status,
      healthy: isHealthy,
    });

    return isHealthy;
  }

  /**
   * Get human-readable health status
   * Returns: Brief description of Brain health status
   */
  async getHealthStatus(): Promise<string> {
    const metrics = await this.getBrainGlobalHealth();

    if ('error' in metrics) {
      return '⚠️ Unknown (metrics unavailable)';
    }

    const { overall_health_score, system_status, total_docs } = metrics;

    const statusEmoji =
      system_status === 'HEALTHY'
        ? '✅'
        : system_status === 'DEGRADED'
          ? '⚠️'
          : '🔴';

    return `${statusEmoji} ${system_status} (Score: ${overall_health_score}/100, Docs: ${total_docs})`;
  }
}

/**
 * Singleton instance
 */
let instance: BrainMetricsService | null = null;

/**
 * Get or create BrainMetrics service instance
 */
export function getBrainMetricsService(): BrainMetricsService {
  if (!instance) {
    instance = new BrainMetricsService();
  }
  return instance;
}

/**
 * Reset instance (for testing)
 */
export function resetBrainMetricsService(): void {
  instance = null;
}

// Export singleton as default
export default getBrainMetricsService();
