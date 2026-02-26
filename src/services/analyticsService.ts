/**
 * Analytics Service (Phase 30.2)
 * Fetches real metrics from Supabase analytics views
 * Supports live intelligence integration for cockpit dashboard
 */

import { supabase } from '@/lib/supabase';
import { log, warn, error, time, timeEnd } from '@/lib/logger';

export interface AnalyticsMetrics {
  totalAnalyses: number;
  averageScore: number;
  enrichmentRate: number;
  averageLegalRiskScore: number;
  averageDoctrineConfidenceScore: number;
  verifiedEnterprisesCount: number;
  rgeCertifiedCount: number;
  completeEnrichmentCount: number;
  partialEnrichmentCount: number;
  degradedEnrichmentCount: number;
  liveDoctrineEngineStatus: 'active' | 'degraded' | 'error' | 'idle';
  liveDoctrineLastExecution: string;
  apiCallsToday: number;
}

/**
 * Fetch global analytics overview with live intelligence
 */
export async function fetchAnalyticsOverview(): Promise<Partial<AnalyticsMetrics> | null> {
  try {
    log('[AnalyticsService] Fetching analytics overview...');

    const { data, error } = await supabase.from('analytics_overview_with_intelligence').select('*').single();

    if (error) {
      console.error('[AnalyticsService] Error fetching overview:', error);
      return null;
    }

    return {
      totalAnalyses: data?.total_analyses || 0,
      averageScore: parseFloat(data?.average_score || '0'),
      enrichmentRate: parseFloat(data?.enrichment_rate || '0'),
      averageLegalRiskScore: parseFloat(data?.average_legal_risk_score || '0'),
      averageDoctrineConfidenceScore: parseFloat(data?.average_doctrine_confidence_score || '0'),
      verifiedEnterprisesCount: data?.verified_enterprises_count || 0,
      rgeCertifiedCount: data?.rge_certified_count || 0,
      completeEnrichmentCount: data?.complete_enrichment_count || 0,
      partialEnrichmentCount: data?.partial_enrichment_count || 0,
      degradedEnrichmentCount: data?.degraded_enrichment_count || 0,
    };
  } catch (error) {
    console.error('[AnalyticsService] Exception fetching overview:', error);
    return null;
  }
}

/**
 * Fetch live intelligence status
 */
export async function fetchLiveIntelligenceStatus(): Promise<{
  status: 'active' | 'degraded' | 'error' | 'idle';
  lastExecution: string;
  apiCallsToday: number;
} | null> {
  try {
    log('[AnalyticsService] Fetching live intelligence status...');

    const { data, error } = await supabase
      .from('engine_execution_with_live_intelligence')
      .select('*')
      .eq('engine_name', 'liveDoctrineActivation')
      .single();

    if (error) {
      warn('[AnalyticsService] Live intelligence engine not found in stats:', error);
      return {
        status: 'idle',
        lastExecution: 'N/A',
        apiCallsToday: 0,
      };
    }

    // Determine status based on success rate and recency
    const successRate = parseFloat(data?.success_rate || '0');
    const lastExecution = data?.last_execution;
    const timeSinceLastExecution = lastExecution ? (Date.now() - new Date(lastExecution).getTime()) / 1000 / 60 : null; // minutes

    let status: 'active' | 'degraded' | 'error' | 'idle' = 'idle';
    if (!lastExecution) {
      status = 'idle';
    } else if (successRate >= 95 && timeSinceLastExecution && timeSinceLastExecution < 60) {
      status = 'active';
    } else if (successRate >= 80 || timeSinceLastExecution && timeSinceLastExecution < 120) {
      status = 'degraded';
    } else {
      status = 'error';
    }

    return {
      status,
      lastExecution: lastExecution
        ? new Date(lastExecution).toLocaleTimeString('fr-FR')
        : 'N/A',
      apiCallsToday: data?.api_calls_today || 0,
    };
  } catch (error) {
    console.error('[AnalyticsService] Exception fetching intelligence status:', error);
    return {
      status: 'error',
      lastExecution: 'N/A',
      apiCallsToday: 0,
    };
  }
}

/**
 * Fetch API health status
 */
export async function fetchAPIHealthStatus(): Promise<
  Record<
    string,
    {
      status: 'operational' | 'degraded' | 'error';
      successRate: number;
      lastCall: string;
    }
  > | null
> {
  try {
    log('[AnalyticsService] Fetching API health status...');

    const { data, error } = await supabase.from('api_health_stats').select('*');

    if (error) {
      console.error('[AnalyticsService] Error fetching API health:', error);
      return null;
    }

    const healthStatus: Record<string, any> = {};

    data?.forEach((api: any) => {
      const successRate = parseFloat(api.success_rate || '0');
      let status: 'operational' | 'degraded' | 'error' = 'operational';

      if (successRate < 80) {
        status = 'error';
      } else if (successRate < 95) {
        status = 'degraded';
      }

      healthStatus[api.api_name] = {
        status,
        successRate,
        lastCall: api.last_call_timestamp
          ? new Date(api.last_call_timestamp).toLocaleTimeString('fr-FR')
          : 'N/A',
      };
    });

    return healthStatus;
  } catch (error) {
    console.error('[AnalyticsService] Exception fetching API health:', error);
    return null;
  }
}

/**
 * Fetch fraud distribution with live enrichment context
 */
export async function fetchFraudDistributionWithIntelligence(): Promise<
  Record<
    string,
    {
      count: number;
      percentage: number;
      unverifiedEnterpriseCount: number;
      uncertifiedRgeCount: number;
      highGeoRiskCount: number;
      averageDoctrineConfidence: number;
    }
  > | null
> {
  try {
    log('[AnalyticsService] Fetching fraud distribution with intelligence...');

    const { data, error } = await supabase.from('fraud_distribution_with_intelligence').select('*');

    if (error) {
      console.error('[AnalyticsService] Error fetching fraud distribution:', error);
      return null;
    }

    const distribution: Record<string, any> = {};

    data?.forEach((row: any) => {
      const fraudLevel = row.fraud_level || 'unknown';
      distribution[fraudLevel] = {
        count: row.count || 0,
        percentage: parseFloat(row.percentage || '0'),
        unverifiedEnterpriseCount: row.unverified_enterprise_count || 0,
        uncertifiedRgeCount: row.uncertified_rge_count || 0,
        highGeoRiskCount: row.high_geo_risk_count || 0,
        averageDoctrineConfidence: parseFloat(row.average_doctrine_confidence || '0'),
      };
    });

    return distribution;
  } catch (error) {
    console.error('[AnalyticsService] Exception fetching fraud distribution:', error);
    return null;
  }
}

/**
 * Fetch grade distribution with live enrichment context
 */
export async function fetchGradeDistributionWithIntelligence(): Promise<
  Record<
    string,
    {
      count: number;
      percentage: number;
      completeEnriched: number;
      partialEnriched: number;
      degradedEnriched: number;
      notEnriched: number;
      averageLegalRiskScore: number;
      averageDoctrineConfidence: number;
    }
  > | null
> {
  try {
    log('[AnalyticsService] Fetching grade distribution with intelligence...');

    const { data, error } = await supabase
      .from('grade_distribution_with_intelligence')
      .select('*');

    if (error) {
      console.error('[AnalyticsService] Error fetching grade distribution:', error);
      return null;
    }

    const distribution: Record<string, any> = {};

    data?.forEach((row: any) => {
      const grade = row.final_grade || 'unknown';
      distribution[grade] = {
        count: row.count || 0,
        percentage: parseFloat(row.percentage || '0'),
        completeEnriched: row.complete_enriched || 0,
        partialEnriched: row.partial_enriched || 0,
        degradedEnriched: row.degraded_enriched || 0,
        notEnriched: row.not_enriched || 0,
        averageLegalRiskScore: parseFloat(row.average_legal_risk_score || '0'),
        averageDoctrineConfidence: parseFloat(row.average_doctrine_confidence || '0'),
      };
    });

    return distribution;
  } catch (error) {
    console.error('[AnalyticsService] Exception fetching grade distribution:', error);
    return null;
  }
}

/**
 * Fetch recent orchestrations with live intelligence context
 */
export async function fetchRecentOrchestrationsWithIntelligence(limit: number = 20): Promise<any[] | null> {
  try {
    log(`[AnalyticsService] Fetching recent orchestrations (limit: ${limit})...`);

    const { data, error } = await supabase
      .from('recent_orchestrations_with_intelligence')
      .select('*')
      .limit(limit);

    if (error) {
      console.error('[AnalyticsService] Error fetching orchestrations:', error);
      return null;
    }

    return data || [];
  } catch (error) {
    console.error('[AnalyticsService] Exception fetching orchestrations:', error);
    return null;
  }
}

/**
 * Fetch all analytics data for the cockpit (combined call)
 */
export async function fetchCockpitMetrics(): Promise<Partial<AnalyticsMetrics> | null> {
  try {
    log('[AnalyticsService] Fetching complete cockpit metrics...');

    const [overview, intelligence] = await Promise.all([
      fetchAnalyticsOverview(),
      fetchLiveIntelligenceStatus(),
    ]);

    return {
      ...(overview || {}),
      liveDoctrineEngineStatus: intelligence?.status || 'idle',
      liveDoctrineLastExecution: intelligence?.lastExecution || 'N/A',
      apiCallsToday: intelligence?.apiCallsToday || 0,
    };
  } catch (error) {
    console.error('[AnalyticsService] Exception fetching cockpit metrics:', error);
    return null;
  }
}

export default {
  fetchAnalyticsOverview,
  fetchLiveIntelligenceStatus,
  fetchAPIHealthStatus,
  fetchFraudDistributionWithIntelligence,
  fetchGradeDistributionWithIntelligence,
  fetchRecentOrchestrationsWithIntelligence,
  fetchCockpitMetrics,
};
