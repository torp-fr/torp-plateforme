/**
 * Analytics Service - Real data analytics from Supabase
 * Phase 32.2: Real Data Analytics Switchover
 * NO MOCKS - Only real database queries
 */

import { supabase } from '@/lib/supabase';
import { structuredLogger } from '@/services/observability/structured-logger';
import { log, warn, error, time, timeEnd } from '@/lib/logger';

/**
 * Global platform statistics
 */
export async function getGlobalStats() {
  try {
    structuredLogger.info({
      service: 'AnalyticsService',
      method: 'getGlobalStats',
      message: 'Fetching global statistics',
    });

    // Get total users from profiles
    // Calculate date ranges
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const previousMonthStart = new Date(thirtyDaysAgo);
    previousMonthStart.setDate(previousMonthStart.getDate() - 30);

    log('[AnalyticsService] Fetching global stats with parallelized queries', {
      thirtyDaysAgo: thirtyDaysAgo.toISOString(),
      previousMonthStart: previousMonthStart.toISOString(),
    });

    // Parallelize all 4 queries with Promise.all()
    const [userResult, analysisResult, analysisLast30Result, analysisPrevious30Result] = await Promise.all([
      // Query 1: Total users
      supabase
        .from('profiles')
        .select('id', { count: 'exact', head: true }),
      // Query 2: Total completed analyses
      supabase
        .from('analysis_jobs')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'completed'),
      // Query 3: Analyses last 30 days
      supabase
        .from('analysis_jobs')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'completed')
        .gte('completed_at', thirtyDaysAgo.toISOString()),
      // Query 4: Analyses previous 30 days
      supabase
        .from('analysis_jobs')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'completed')
        .gte('completed_at', previousMonthStart.toISOString())
        .lt('completed_at', thirtyDaysAgo.toISOString()),
    ]);

    // Check for errors
    if (userResult.error) throw userResult.error;
    if (analysisResult.error) throw analysisResult.error;
    if (analysisLast30Result.error) throw analysisLast30Result.error;
    if (analysisPrevious30Result.error) throw analysisPrevious30Result.error;

    const userCount = userResult.count || 0;
    const analysisCount = analysisResult.count || 0;
    const analysisLast30 = analysisLast30Result.count || 0;
    const analysisPrevious30 = analysisPrevious30Result.count || 0;

    // Calculate growth percentage
    const growth = analysisPrevious30 > 0
      ? Math.round(((analysisLast30 - analysisPrevious30) / analysisPrevious30) * 100)
      : (analysisLast30 > 0 ? 100 : 0);  // 100% growth if previous was 0 and current > 0, else 0%

    log('[AnalyticsService] Global stats fetched successfully', {
      userCount,
      analysisCount,
      analysisLast30,
      analysisPrevious30,
      growth,
    });

    return {
      userCount,
      analysisCount,
      analysisLast30,
      growth,
    };
  } catch (error) {
    structuredLogger.error({
      service: 'AnalyticsService',
      method: 'getGlobalStats',
      message: 'Failed to fetch global stats',
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

/**
 * Engine performance status (latest score snapshot)
 *
 * ❌ NOT IMPLEMENTED - Scheduled for Phase 35
 * Requires:
 * 1. Create score_snapshots table in Supabase
 * 2. Set up scheduled job to record engine metrics
 * 3. Implement query to fetch latest metrics
 *
 * @throws Error - This endpoint is not yet implemented
 */
export async function getEngineStatus() {
  throw new Error('[AnalyticsService] getEngineStatus() not implemented - scheduled for Phase 35. Need score_snapshots table.');
}

/**
 * Recent analysis jobs
 */
export async function getRecentJobs(limit: number = 10) {
  try {
    structuredLogger.info({
      service: 'AnalyticsService',
      method: 'getRecentJobs',
      message: 'Fetching recent jobs',
      limit,
    });

    const { data, error } = await supabase
      .from('analysis_jobs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      throw error;
    }

    return data || [];
  } catch (error) {
    structuredLogger.error({
      service: 'AnalyticsService',
      method: 'getRecentJobs',
      message: 'Failed to fetch recent jobs',
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

/**
 * Live intelligence data (latest snapshots)
 *
 * ❌ NOT IMPLEMENTED - Scheduled for Phase 35
 * Requires:
 * 1. Create live_intelligence_snapshots table
 * 2. Verify data structure with Product team
 * 3. Set up real-time data pipeline
 * 4. Implement WebSocket for real-time updates
 *
 * @throws Error - This endpoint is not yet implemented
 */
export async function getLiveIntelligence(limit: number = 10) {
  throw new Error(
    `[AnalyticsService] getLiveIntelligence(${limit}) not implemented - scheduled for Phase 35. Need live_intelligence_snapshots table.`
  );
}

/**
 * Job status distribution
 */
export async function getJobStatusDistribution() {
  try {
    structuredLogger.info({
      service: 'AnalyticsService',
      method: 'getJobStatusDistribution',
      message: 'Fetching job status distribution',
    });

    const statuses = ['pending', 'processing', 'completed', 'failed', 'cancelled'];

    log('[AnalyticsService] Fetching job status distribution with parallelized queries');

    // Parallelize all 5 status queries with Promise.all()
    const results = await Promise.all(
      statuses.map((status) =>
        supabase
          .from('analysis_jobs')
          .select('id', { count: 'exact', head: true })
          .eq('status', status)
      )
    );

    // Check for errors and build distribution object
    const distribution: Record<string, number> = {};
    results.forEach((result, index) => {
      const status = statuses[index];
      if (result.error) {
        throw result.error;
      }
      distribution[status] = result.count || 0;
    });

    log('[AnalyticsService] Job distribution fetched:', distribution);
    return distribution;
  } catch (error) {
    structuredLogger.error({
      service: 'AnalyticsService',
      method: 'getJobStatusDistribution',
      message: 'Failed to fetch job status distribution',
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

/**
 * Platform health metrics
 */
export async function getPlatformHealth() {
  try {
    structuredLogger.info({
      service: 'AnalyticsService',
      method: 'getPlatformHealth',
      message: 'Fetching platform health',
    });

    // Check if database is accessible
    const { data, error: dbError } = await supabase
      .from('profiles')
      .select('id', { count: 'exact', head: true });

    const dbHealthy = !dbError && data !== null;

    return {
      database: dbHealthy ? 'operational' : 'error',
      api: 'operational', // API is healthy if we can query
      storage: 'operational', // Assume healthy if system is running
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    structuredLogger.error({
      service: 'AnalyticsService',
      method: 'getPlatformHealth',
      message: 'Failed to fetch platform health',
      error: error instanceof Error ? error.message : String(error),
    });
    return {
      database: 'error',
      api: 'error',
      storage: 'error',
      timestamp: new Date().toISOString(),
    };
  }
}

/**
 * User activity over time (last 30 days)
 */
export async function getUserActivityMetrics(days: number = 30) {
  try {
    structuredLogger.info({
      service: 'AnalyticsService',
      method: 'getUserActivityMetrics',
      message: 'Fetching user activity metrics',
      days,
    });

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const { data, error } = await supabase
      .from('analysis_jobs')
      .select('created_at')
      .gte('created_at', startDate.toISOString())
      .order('created_at', { ascending: true });

    if (error) {
      throw error;
    }

    // Group by date
    const activityByDate: Record<string, number> = {};
    (data || []).forEach(job => {
      const date = new Date(job.created_at).toLocaleDateString();
      activityByDate[date] = (activityByDate[date] || 0) + 1;
    });

    return activityByDate;
  } catch (error) {
    structuredLogger.error({
      service: 'AnalyticsService',
      method: 'getUserActivityMetrics',
      message: 'Failed to fetch user activity metrics',
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

export const analyticsService = {
  getGlobalStats,
  getEngineStatus,
  getRecentJobs,
  getLiveIntelligence,
  getJobStatusDistribution,
  getPlatformHealth,
  getUserActivityMetrics,
};

export default analyticsService;
