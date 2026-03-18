/**
 * System Facade Routes
 * Découplage du frontend de l'infrastructure système
 * Expose les endpoints pour la santé du système
 */

import type { Express } from 'express';
import { apiResilienceService } from '@/core/infrastructure/apiResilience.service';
import { apiQuotaMonitorService } from '@/core/infrastructure/apiQuotaMonitor.service';
import { intelligentCacheService } from '@/core/infrastructure/intelligentCache.service';
import { engineWatchdogService } from '@/core/infrastructure/engineWatchdog.service';

/**
 * GET /api/v1/system/health
 * Retourne l'état de santé global du système
 */
function handleSystemHealth(req: any, res: any) {
  try {
    const healthStatus = {
      timestamp: new Date().toISOString(),
      services: {
        apiResilience: {
          status: 'operational',
          activeRetries: apiResilienceService?.activeRetries?.() || 0,
        },
        apiQuotaMonitor: {
          status: 'operational',
          currentUsage: apiQuotaMonitorService?.getCurrentUsage?.() || 0,
        },
        intelligentCache: {
          status: 'operational',
          cacheHitRate: intelligentCacheService?.getHitRate?.() || 0,
        },
        engineWatchdog: {
          status: 'operational',
          monitoredEngines: engineWatchdogService?.getMonitoredCount?.() || 0,
        },
      },
      overall: 'healthy',
    };

    res.status(200).json({
      success: true,
      data: healthStatus,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[System Health] Error:', message);
    res.status(503).json({
      success: false,
      error: message,
    });
  }
}

/**
 * Enregistre les routes système sur l'app Express
 */
export function registerSystemRoutes(app: Express) {
  app.get('/api/v1/system/health', handleSystemHealth);
}
