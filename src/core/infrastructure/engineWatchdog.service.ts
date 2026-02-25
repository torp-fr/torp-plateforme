/**
 * Engine Execution Watchdog Service (Phase 30.3)
 * Monitors engine health, detects anomalies, and generates alerts
 * Ensures platform stability and early warning of issues
 */

import { createClient } from '@supabase/supabase-js';
import { structuredLogger } from '@/services/observability/structured-logger';

const logger = structuredLogger;

const supabase = createClient(
  process.env.REACT_APP_SUPABASE_URL || '',
  process.env.REACT_APP_SUPABASE_ANON_KEY || ''
);

export interface WatchdogAlert {
  type: 'slow_execution' | 'error_spike' | 'fraud_anomaly' | 'api_unavailable' | 'enrichment_degradation';
  severity: 'info' | 'warning' | 'critical';
  message: string;
  details: Record<string, any>;
  timestamp: Date;
}

export interface WatchdogReport {
  warnings: WatchdogAlert[];
  criticalAlerts: WatchdogAlert[];
  systemStatus: 'healthy' | 'warning' | 'critical';
  generatedAt: Date;
}

class EngineWatchdogService {
  private readonly SLOW_EXECUTION_THRESHOLD_MS = 2000; // Engines should complete in <2s
  private readonly ERROR_SPIKE_THRESHOLD = 0.3; // >30% error rate
  private readonly HIGH_FRAUD_RATE = 0.5; // >50% analyses as fraud
  private readonly ENRICHMENT_DEGRADATION_THRESHOLD = 0.5; // <50% enrichment

  /**
   * Detect slow engine executions
   */
  async detectSlowExecution(): Promise<WatchdogAlert[]> {
    const alerts: WatchdogAlert[] = [];

    try {
      const { data, error } = await supabase
        .from('score_snapshots')
        .select('engine_name, execution_time_ms, timestamp')
        .gte('timestamp', new Date(Date.now() - 60 * 60 * 1000).toISOString()) // Last hour
        .order('timestamp', { ascending: false });

      if (error) throw error;

      // Group by engine and calculate average execution time
      const engineStats: Record<string, { times: number[]; count: number }> = {};

      (data || []).forEach((snapshot: any) => {
        if (!engineStats[snapshot.engine_name]) {
          engineStats[snapshot.engine_name] = { times: [], count: 0 };
        }
        engineStats[snapshot.engine_name].times.push(snapshot.execution_time_ms || 0);
        engineStats[snapshot.engine_name].count++;
      });

      // Detect slow engines
      Object.entries(engineStats).forEach(([engineName, stats]) => {
        const avgTime = stats.times.reduce((a, b) => a + b, 0) / stats.count;
        const slowCount = stats.times.filter((t) => t > this.SLOW_EXECUTION_THRESHOLD_MS).length;
        const slowPercent = (slowCount / stats.count) * 100;

        if (avgTime > this.SLOW_EXECUTION_THRESHOLD_MS) {
          alerts.push({
            type: 'slow_execution',
            severity: slowPercent > 50 ? 'critical' : 'warning',
            message: `Engine '${engineName}' executing slowly (avg ${avgTime.toFixed(0)}ms)`,
            details: {
              engineName,
              averageExecutionTimeMs: Math.round(avgTime * 100) / 100,
              slowExecutions: slowCount,
              totalExecutions: stats.count,
              slowPercentage: Math.round(slowPercent * 100) / 100,
            },
            timestamp: new Date(),
          });
        }
      });
    } catch (error) {
      logger.error(
        `[Watchdog] Error detecting slow execution: ${error instanceof Error ? error.message : String(error)}`
      );
    }

    return alerts;
  }

  /**
   * Detect error spikes in engine executions
   */
  async detectErrorSpike(): Promise<WatchdogAlert[]> {
    const alerts: WatchdogAlert[] = [];

    try {
      const { data, error } = await supabase
        .from('score_snapshots')
        .select('engine_name, status, timestamp')
        .gte('timestamp', new Date(Date.now() - 60 * 60 * 1000).toISOString()); // Last hour

      if (error) throw error;

      // Group by engine and calculate error rate
      const engineStats: Record<string, { total: number; errors: number }> = {};

      (data || []).forEach((snapshot: any) => {
        if (!engineStats[snapshot.engine_name]) {
          engineStats[snapshot.engine_name] = { total: 0, errors: 0 };
        }
        engineStats[snapshot.engine_name].total++;
        if (snapshot.status !== 'completed') {
          engineStats[snapshot.engine_name].errors++;
        }
      });

      // Detect error spikes
      Object.entries(engineStats).forEach(([engineName, stats]) => {
        const errorRate = stats.total > 0 ? stats.errors / stats.total : 0;

        if (errorRate > this.ERROR_SPIKE_THRESHOLD) {
          alerts.push({
            type: 'error_spike',
            severity: errorRate > 0.7 ? 'critical' : 'warning',
            message: `Engine '${engineName}' showing elevated error rate (${(errorRate * 100).toFixed(1)}%)`,
            details: {
              engineName,
              errorRate: Math.round(errorRate * 10000) / 100,
              failedExecutions: stats.errors,
              totalExecutions: stats.total,
            },
            timestamp: new Date(),
          });
        }
      });
    } catch (error) {
      logger.error(
        `[Watchdog] Error detecting error spike: ${error instanceof Error ? error.message : String(error)}`
      );
    }

    return alerts;
  }

  /**
   * Detect high fraud rate anomalies
   */
  async detectHighFraudRateAnomaly(): Promise<WatchdogAlert[]> {
    const alerts: WatchdogAlert[] = [];

    try {
      const { data, error } = await supabase
        .from('analysis_results')
        .select('id, fraud_score, fraud_level')
        .gte('created_at', new Date(Date.now() - 60 * 60 * 1000).toISOString()); // Last hour

      if (error) throw error;

      const analyses = data || [];
      if (analyses.length === 0) return alerts;

      // Calculate fraud statistics
      const highFraudCount = analyses.filter(
        (a: any) => a.fraud_level === 'high' || a.fraud_level === 'critical'
      ).length;
      const fraudRate = highFraudCount / analyses.length;

      // Check for anomaly
      if (fraudRate > this.HIGH_FRAUD_RATE) {
        alerts.push({
          type: 'fraud_anomaly',
          severity: fraudRate > 0.7 ? 'critical' : 'warning',
          message: `High fraud detection rate detected (${(fraudRate * 100).toFixed(1)}% of analyses)`,
          details: {
            highFraudAnalyses: highFraudCount,
            totalAnalyses: analyses.length,
            fraudRate: Math.round(fraudRate * 10000) / 100,
            timeWindow: '1 hour',
          },
          timestamp: new Date(),
        });
      }
    } catch (error) {
      logger.error(
        `[Watchdog] Error detecting fraud anomaly: ${error instanceof Error ? error.message : String(error)}`
      );
    }

    return alerts;
  }

  /**
   * Detect API unavailability
   */
  async detectAPIUnavailability(): Promise<WatchdogAlert[]> {
    const alerts: WatchdogAlert[] = [];

    try {
      const { data, error } = await supabase
        .from('api_call_logs')
        .select('api_name, response_code, response_time_ms')
        .gte('created_at', new Date(Date.now() - 60 * 60 * 1000).toISOString()); // Last hour

      if (error) throw error;

      // Group by API and calculate health
      const apiStats: Record<string, { total: number; failures: number; timeouts: number }> = {};

      (data || []).forEach((call: any) => {
        if (!apiStats[call.api_name]) {
          apiStats[call.api_name] = { total: 0, failures: 0, timeouts: 0 };
        }
        apiStats[call.api_name].total++;

        if (call.response_code >= 400 || call.response_code < 200) {
          apiStats[call.api_name].failures++;
        }
        if ((call.response_time_ms || 0) > 5000) {
          apiStats[call.api_name].timeouts++;
        }
      });

      // Detect unavailability
      Object.entries(apiStats).forEach(([apiName, stats]) => {
        const failureRate = stats.total > 0 ? stats.failures / stats.total : 0;
        const timeoutRate = stats.total > 0 ? stats.timeouts / stats.total : 0;

        if (failureRate > 0.5 || timeoutRate > 0.3) {
          const severity =
            failureRate > 0.8 || timeoutRate > 0.5 ? 'critical' : 'warning';

          alerts.push({
            type: 'api_unavailable',
            severity,
            message: `API '${apiName}' showing degraded availability`,
            details: {
              apiName,
              failureRate: Math.round(failureRate * 10000) / 100,
              timeoutRate: Math.round(timeoutRate * 10000) / 100,
              failedCalls: stats.failures,
              timedOutCalls: stats.timeouts,
              totalCalls: stats.total,
            },
            timestamp: new Date(),
          });
        }
      });
    } catch (error) {
      logger.error(
        `[Watchdog] Error detecting API unavailability: ${error instanceof Error ? error.message : String(error)}`
      );
    }

    return alerts;
  }

  /**
   * Detect enrichment degradation
   */
  async detectEnrichmentDegradation(): Promise<WatchdogAlert[]> {
    const alerts: WatchdogAlert[] = [];

    try {
      const { data, error } = await supabase
        .from('analytics_overview_with_intelligence')
        .select('enrichment_rate, degraded_enrichment_count, complete_enrichment_count')
        .single();

      if (error) throw error;

      if (data) {
        const enrichmentRate = parseFloat(data.enrichment_rate || '0');
        const degradedCount = data.degraded_enrichment_count || 0;
        const completeCount = data.complete_enrichment_count || 0;

        if (enrichmentRate < this.ENRICHMENT_DEGRADATION_THRESHOLD * 100) {
          const severity = enrichmentRate < 30 ? 'critical' : 'warning';

          alerts.push({
            type: 'enrichment_degradation',
            severity,
            message: `Enrichment coverage below threshold (${enrichmentRate.toFixed(1)}%)`,
            details: {
              enrichmentRate: Math.round(enrichmentRate * 100) / 100,
              completeEnrichments: completeCount,
              degradedEnrichments: degradedCount,
              threshold: this.ENRICHMENT_DEGRADATION_THRESHOLD * 100,
            },
            timestamp: new Date(),
          });
        }
      }
    } catch (error) {
      logger.error(
        `[Watchdog] Error detecting enrichment degradation: ${error instanceof Error ? error.message : String(error)}`
      );
    }

    return alerts;
  }

  /**
   * Generate comprehensive watchdog report
   */
  async generateReport(): Promise<WatchdogReport> {
    logger.info('[Watchdog] Generating system health report...');

    const allAlerts: WatchdogAlert[] = [];

    // Run all detection checks in parallel
    const [slowExecution, errorSpikes, fraudAnomalies, apiUnavailable, enrichmentDegradation] =
      await Promise.all([
        this.detectSlowExecution(),
        this.detectErrorSpike(),
        this.detectHighFraudRateAnomaly(),
        this.detectAPIUnavailability(),
        this.detectEnrichmentDegradation(),
      ]);

    allAlerts.push(
      ...slowExecution,
      ...errorSpikes,
      ...fraudAnomalies,
      ...apiUnavailable,
      ...enrichmentDegradation
    );

    // Separate warnings and critical alerts
    const warnings = allAlerts.filter((a) => a.severity === 'warning');
    const criticalAlerts = allAlerts.filter((a) => a.severity === 'critical');

    // Determine overall system status
    const systemStatus: 'healthy' | 'warning' | 'critical' =
      criticalAlerts.length > 0 ? 'critical' : warnings.length > 0 ? 'warning' : 'healthy';

    logger.info(
      `[Watchdog] Report generated: ${systemStatus} (${warnings.length} warnings, ${criticalAlerts.length} critical)`
    );

    return {
      warnings,
      criticalAlerts,
      systemStatus,
      generatedAt: new Date(),
    };
  }
}

// Export singleton instance
export const engineWatchdogService = new EngineWatchdogService();
export default engineWatchdogService;
