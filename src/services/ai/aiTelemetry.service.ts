import { log, warn, error, time, timeEnd } from '@/lib/logger';

/**
 * AI Telemetry Service
 * Lightweight observability for AI operations (structured JSON logging)
 *
 * PHASE 36.12.1: Production monitoring without external dependencies
 * - Logs to console (structured JSON)
 * - Tracks provider usage, latency, retries, fallbacks
 * - Zero functional impact on AI operations
 */

// ============================================================================
// TYPES
// ============================================================================

export interface AIRequestMetric {
  // Identification
  requestId: string;
  operation: 'completion' | 'json' | 'embedding' | 'embedding_fallback';

  // Provider information
  primaryProvider: string;
  providerUsed: string;
  fallbackTriggered: boolean;

  // Performance
  latencyMs: number;
  retriesUsed: number;

  // Data
  inputLength: number;
  outputLength?: number;

  // Synthetic data
  isSyntheticEmbedding?: boolean;
  embeddingDimension?: number;

  // Metadata
  timestamp: string;
  success: true;
}

export interface AIErrorMetric {
  // Identification
  requestId: string;
  operation: 'completion' | 'json' | 'embedding' | 'embedding_fallback';

  // Error information
  primaryProvider: string;
  lastProviderTried: string;
  retriesExhausted: boolean;
  errorCode: string;
  errorMessage: string;

  // Performance (at failure)
  latencyMs: number;
  retriesUsed: number;

  // Data
  inputLength: number;

  // Metadata
  timestamp: string;
  success: false;
}

export type AIMetric = AIRequestMetric | AIErrorMetric;

// ============================================================================
// TELEMETRY SERVICE
// ============================================================================

class AITelemetryService {
  private readonly TAG = '[AI_TELEMETRY]';
  private requestCounter = 0;

  /**
   * Track successful AI request
   * Called after successful operation (completion, embedding, etc.)
   */
  trackAIRequest(metric: AIRequestMetric): void {
    this.logMetric(metric);
  }

  /**
   * Track failed AI request
   * Called when operation fails after all retries exhausted
   */
  logAIError(metric: AIErrorMetric): void {
    this.logMetric(metric);
  }

  /**
   * Internal: Log metric as structured JSON
   */
  private logMetric(metric: AIMetric): void {
    const level = metric.success ? 'INFO' : 'WARN';
    const summary = this.buildSummary(metric);

    // Structured JSON log
    const log = {
      timestamp: new Date().toISOString(),
      tag: this.TAG,
      level,
      operation: metric.operation,
      provider: metric.success
        ? metric.providerUsed
        : metric.lastProviderTried,
      latencyMs: metric.latencyMs,
      retries: metric.retriesUsed,
      summary,
      metric, // Full metric data
    };

    // Output as structured JSON (for parsing by logs infrastructure)
    log(JSON.stringify(log));
  }

  /**
   * Build human-readable summary for quick scanning
   */
  private buildSummary(metric: AIMetric): string {
    if (metric.success) {
      const parts = [
        `${metric.operation}`,
        `via ${metric.providerUsed}`,
        `in ${metric.latencyMs}ms`,
      ];

      if (metric.fallbackTriggered) {
        parts.push('(fallback)');
      }

      if (metric.isSyntheticEmbedding) {
        parts.push('[synthetic]');
      }

      if (metric.retriesUsed > 0) {
        parts.push(`retried ${metric.retriesUsed}x`);
      }

      return parts.join(' | ');
    } else {
      const parts = [
        `${metric.operation} FAILED`,
        `provider: ${metric.lastProviderTried}`,
        `error: ${metric.errorCode}`,
      ];

      if (metric.retriesExhausted) {
        parts.push(`(${metric.retriesUsed} retries exhausted)`);
      }

      return parts.join(' | ');
    }
  }
}

// ============================================================================
// SINGLETON EXPORT
// ============================================================================

export const aiTelemetry = new AITelemetryService();

export default aiTelemetry;
