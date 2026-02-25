/**
 * API Quota & Rate Monitoring Service (Phase 30.3)
 * Tracks API usage, detects quota limits and abuse patterns
 * Provides quota visibility for admin dashboard
 */

import { supabase } from '@/lib/supabase';
import { structuredLogger } from '@/services/observability/structured-logger';

const logger = structuredLogger;

export interface APIQuotaStatus {
  apiName: string;
  totalCallsToday: number;
  quotaLimit: number;
  quotaRemaining: number;
  quotaUsagePercent: number;
  callsLastHour: number;
  averageResponseTime: number;
  successRate: number;
  lastCallTime?: string;
  status: 'healthy' | 'warning' | 'critical';
}

export interface AbusePattern {
  detected: boolean;
  pattern: string;
  severity: 'low' | 'medium' | 'high';
  details: string;
}

interface APIQuotaConfig {
  [apiName: string]: {
    dailyLimit: number;
    hourlyLimit: number;
    warningThreshold: number; // % of quota
    criticalThreshold: number; // % of quota
  };
}

class APIQuotaMonitorService {
  private quotaConfig: APIQuotaConfig = {
    insee: {
      dailyLimit: 1000,
      hourlyLimit: 100,
      warningThreshold: 80,
      criticalThreshold: 95,
    },
    rge: {
      dailyLimit: 500,
      hourlyLimit: 50,
      warningThreshold: 75,
      criticalThreshold: 90,
    },
    ban: {
      dailyLimit: 2000,
      hourlyLimit: 200,
      warningThreshold: 80,
      criticalThreshold: 95,
    },
    cadastre: {
      dailyLimit: 300,
      hourlyLimit: 30,
      warningThreshold: 70,
      criticalThreshold: 85,
    },
    georisques: {
      dailyLimit: 500,
      hourlyLimit: 50,
      warningThreshold: 75,
      criticalThreshold: 90,
    },
  };

  /**
   * Track API call
   */
  async trackApiUsage(
    apiName: string,
    responseCode: number,
    responseTimeMs: number,
    errorMessage?: string
  ): Promise<void> {
    try {
      // This would be called during actual API execution
      // The api_call_logs table is already being populated by the execution layer
      logger.debug(
        `[APIQuotaMonitor] Tracked ${apiName}: ${responseCode} (${responseTimeMs}ms)`
      );
    } catch (error) {
      logger.error(
        `[APIQuotaMonitor] Error tracking API usage: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Check quota status for API
   */
  async checkQuota(apiName: string): Promise<APIQuotaStatus> {
    try {
      const config = this.quotaConfig[apiName];
      if (!config) {
        throw new Error(`Unknown API: ${apiName}`);
      }

      // Get today's calls
      const { data: todayData, error: todayError } = await supabase
        .from('api_call_logs')
        .select('id, response_time_ms, response_code')
        .eq('api_name', apiName)
        .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

      if (todayError) throw todayError;

      // Get last hour calls
      const { data: hourData, error: hourError } = await supabase
        .from('api_call_logs')
        .select('id, response_time_ms, response_code')
        .eq('api_name', apiName)
        .gte('created_at', new Date(Date.now() - 60 * 60 * 1000).toISOString());

      if (hourError) throw hourError;

      const totalCallsToday = todayData?.length || 0;
      const callsLastHour = hourData?.length || 0;

      // Calculate metrics
      const quotaRemaining = Math.max(0, config.dailyLimit - totalCallsToday);
      const quotaUsagePercent = (totalCallsToday / config.dailyLimit) * 100;

      // Calculate average response time
      const allCalls = todayData || [];
      const avgResponseTime =
        allCalls.length > 0
          ? allCalls.reduce((sum, call) => sum + (call.response_time_ms || 0), 0) /
            allCalls.length
          : 0;

      // Calculate success rate
      const successfulCalls =
        allCalls.filter((call) => call.response_code >= 200 && call.response_code < 300).length ||
        0;
      const successRate = allCalls.length > 0 ? (successfulCalls / allCalls.length) * 100 : 100;

      // Determine status
      let status: 'healthy' | 'warning' | 'critical' = 'healthy';
      if (quotaUsagePercent >= config.criticalThreshold) {
        status = 'critical';
      } else if (quotaUsagePercent >= config.warningThreshold) {
        status = 'warning';
      }

      // Get last call time
      const { data: lastCall } = await supabase
        .from('api_call_logs')
        .select('created_at')
        .eq('api_name', apiName)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      return {
        apiName,
        totalCallsToday,
        quotaLimit: config.dailyLimit,
        quotaRemaining,
        quotaUsagePercent: Math.round(quotaUsagePercent * 100) / 100,
        callsLastHour,
        averageResponseTime: Math.round(avgResponseTime * 100) / 100,
        successRate: Math.round(successRate * 100) / 100,
        lastCallTime: lastCall?.created_at
          ? new Date(lastCall.created_at).toLocaleTimeString('fr-FR')
          : undefined,
        status,
      };
    } catch (error) {
      logger.error(
        `[APIQuotaMonitor] Error checking quota for ${apiName}: ${error instanceof Error ? error.message : String(error)}`
      );

      return {
        apiName,
        totalCallsToday: 0,
        quotaLimit: this.quotaConfig[apiName]?.dailyLimit || 1000,
        quotaRemaining: this.quotaConfig[apiName]?.dailyLimit || 1000,
        quotaUsagePercent: 0,
        callsLastHour: 0,
        averageResponseTime: 0,
        successRate: 0,
        status: 'critical',
      };
    }
  }

  /**
   * Get quota status for all monitored APIs
   */
  async getQuotaStatus(): Promise<APIQuotaStatus[]> {
    const statuses: APIQuotaStatus[] = [];

    for (const apiName of Object.keys(this.quotaConfig)) {
      const status = await this.checkQuota(apiName);
      statuses.push(status);
    }

    return statuses;
  }

  /**
   * Detect abuse patterns
   */
  async detectAbusePattern(apiName: string): Promise<AbusePattern> {
    try {
      const config = this.quotaConfig[apiName];
      if (!config) {
        return {
          detected: false,
          pattern: 'unknown_api',
          severity: 'low',
          details: `API ${apiName} not recognized`,
        };
      }

      // Get last hour data
      const { data: hourData, error: hourError } = await supabase
        .from('api_call_logs')
        .select('id, response_code, response_time_ms, created_at')
        .eq('api_name', apiName)
        .gte('created_at', new Date(Date.now() - 60 * 60 * 1000).toISOString())
        .order('created_at', { ascending: false });

      if (hourError) throw hourError;

      const calls = hourData || [];

      // Pattern 1: Exceeding hourly limit
      if (calls.length > config.hourlyLimit) {
        return {
          detected: true,
          pattern: 'rate_limit_exceeded',
          severity: 'high',
          details: `${calls.length} calls in last hour (limit: ${config.hourlyLimit})`,
        };
      }

      // Pattern 2: High error rate
      const errorCalls = calls.filter(
        (call) => call.response_code >= 400 || call.response_code < 200
      );
      const errorRate = calls.length > 0 ? (errorCalls.length / calls.length) * 100 : 0;

      if (errorRate > 50) {
        return {
          detected: true,
          pattern: 'high_error_rate',
          severity: 'medium',
          details: `${errorRate.toFixed(1)}% error rate (${errorCalls.length}/${calls.length} calls)`,
        };
      }

      // Pattern 3: Timeout pattern
      const slowCalls = calls.filter((call) => (call.response_time_ms || 0) > 5000);
      if (slowCalls.length > calls.length * 0.5) {
        return {
          detected: true,
          pattern: 'slow_responses',
          severity: 'medium',
          details: `${slowCalls.length}/${calls.length} calls taking >5s`,
        };
      }

      // Pattern 4: Sudden spike
      const recentMinute = calls.filter(
        (call) =>
          new Date(call.created_at).getTime() >
          Date.now() - 60 * 1000
      );
      if (recentMinute.length > config.hourlyLimit / 12) {
        // More than 1/12 of hourly limit in 1 minute
        return {
          detected: true,
          pattern: 'traffic_spike',
          severity: 'medium',
          details: `${recentMinute.length} calls in last minute`,
        };
      }

      return {
        detected: false,
        pattern: 'none',
        severity: 'low',
        details: 'Normal API usage patterns',
      };
    } catch (error) {
      logger.error(
        `[APIQuotaMonitor] Error detecting abuse pattern: ${error instanceof Error ? error.message : String(error)}`
      );

      return {
        detected: false,
        pattern: 'error',
        severity: 'low',
        details: 'Could not analyze patterns',
      };
    }
  }

  /**
   * Get quota configuration for specific API
   */
  public getQuotaConfig(apiName: string) {
    return this.quotaConfig[apiName];
  }

  /**
   * Update quota configuration (admin action)
   */
  public setQuotaConfig(apiName: string, config: Partial<APIQuotaConfig[string]>): void {
    if (this.quotaConfig[apiName]) {
      this.quotaConfig[apiName] = {
        ...this.quotaConfig[apiName],
        ...config,
      };
      logger.info(`[APIQuotaMonitor] Updated quota config for ${apiName}`);
    }
  }
}

// Export singleton instance
export const apiQuotaMonitorService = new APIQuotaMonitorService();
export default apiQuotaMonitorService;
