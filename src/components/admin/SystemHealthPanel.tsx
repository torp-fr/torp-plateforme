/**
 * System Health Panel (Phase 30.3)
 * Admin dashboard component displaying system health and resilience metrics
 * Shows API health, circuit breaker states, cache performance, and alerts
 */

import React, { useState, useEffect } from 'react';
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Check,
  Clock,
  Database,
  Zap,
  Shield,
  TrendingDown,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { apiResilienceService } from '@/core/infrastructure/apiResilience.service';
import { apiQuotaMonitorService } from '@/core/infrastructure/apiQuotaMonitor.service';
import { intelligentCacheService } from '@/core/infrastructure/intelligentCache.service';
import { engineWatchdogService } from '@/core/infrastructure/engineWatchdog.service';

export interface SystemHealthPanelProps {
  loading?: boolean;
  refreshInterval?: number; // milliseconds
}

interface HealthMetrics {
  apiHealth: Record<string, any>;
  circuitBreakerStatus: Record<string, any>;
  cacheStats: any;
  watchdogReport: any;
}

export function SystemHealthPanel({ loading = false, refreshInterval = 30000 }: SystemHealthPanelProps) {
  const [metrics, setMetrics] = useState<Partial<HealthMetrics>>({});
  const [isLoading, setIsLoading] = useState(loading);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  // Load metrics on mount and on interval
  useEffect(() => {
    const loadMetrics = async () => {
      setIsLoading(true);
      try {
        // Fetch all health metrics in parallel
        const [quotaStatuses, cbStatus, watchdogReport] = await Promise.all([
          apiQuotaMonitorService.getQuotaStatus(),
          Promise.resolve(apiResilienceService.getCircuitBreakerStatus()),
          engineWatchdogService.generateReport(),
        ]);

        const cacheStats = intelligentCacheService.getStats();

        // Build API health map
        const apiHealthMap: Record<string, any> = {};
        quotaStatuses?.forEach((status) => {
          apiHealthMap[status.apiName] = status;
        });

        setMetrics({
          apiHealth: apiHealthMap,
          circuitBreakerStatus: cbStatus,
          cacheStats,
          watchdogReport,
        });

        setLastRefresh(new Date());
      } catch (error) {
        console.error('[SystemHealthPanel] Error loading metrics:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadMetrics();

    // Set up refresh interval
    const interval = setInterval(loadMetrics, refreshInterval);

    return () => clearInterval(interval);
  }, [refreshInterval]);

  const getStatusColor = (
    status: 'healthy' | 'degraded' | 'down' | 'warning' | 'critical'
  ): string => {
    switch (status) {
      case 'healthy':
        return 'text-green-600';
      case 'warning':
        return 'text-yellow-600';
      case 'degraded':
        return 'text-yellow-600';
      case 'critical':
      case 'down':
        return 'text-red-600';
      default:
        return 'text-gray-600';
    }
  };

  const getStatusBadgeClass = (
    status: 'healthy' | 'degraded' | 'down' | 'warning' | 'critical'
  ): string => {
    switch (status) {
      case 'healthy':
        return 'bg-green-100 text-green-800 border-green-300';
      case 'warning':
        return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'degraded':
        return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'critical':
      case 'down':
        return 'bg-red-100 text-red-800 border-red-300';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Shield className="h-6 w-6 text-blue-600" />
          Santé Système & Résilience
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Dernière mise à jour: {lastRefresh.toLocaleTimeString('fr-FR')}
        </p>
      </div>

      {/* Critical Alerts */}
      {metrics.watchdogReport?.criticalAlerts && metrics.watchdogReport.criticalAlerts.length > 0 && (
        <Alert className="bg-red-50 border-red-200">
          <AlertTriangle className="h-4 w-4 text-red-600" />
          <AlertDescription className="text-red-700">
            <strong>{metrics.watchdogReport.criticalAlerts.length} alertes critiques détectées</strong>
            <ul className="mt-2 space-y-1 text-sm">
              {metrics.watchdogReport.criticalAlerts.slice(0, 3).map((alert: any, idx: number) => (
                <li key={idx}>• {alert.message}</li>
              ))}
              {metrics.watchdogReport.criticalAlerts.length > 3 && (
                <li>• +{metrics.watchdogReport.criticalAlerts.length - 3} alertes supplémentaires</li>
              )}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {/* System Status Overview */}
      <Card>
        <CardHeader>
          <CardTitle>État Global du Système</CardTitle>
          <CardDescription>Synthèse de la santé de tous les composants</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Overall Health */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">État du système</p>
                <p className="text-2xl font-bold capitalize mt-1">
                  {metrics.watchdogReport?.systemStatus || 'unknown'}
                </p>
              </div>
              <div
                className={`h-12 w-12 rounded-lg flex items-center justify-center ${
                  metrics.watchdogReport?.systemStatus === 'healthy'
                    ? 'bg-green-100'
                    : metrics.watchdogReport?.systemStatus === 'warning'
                      ? 'bg-yellow-100'
                      : 'bg-red-100'
                }`}
              >
                <Activity
                  className={`h-6 w-6 ${getStatusColor(
                    metrics.watchdogReport?.systemStatus || 'critical'
                  )}`}
                />
              </div>
            </div>

            {/* Alerts Summary */}
            <div className="grid grid-cols-2 gap-2">
              <div className="p-3 rounded-lg bg-red-50 border border-red-200">
                <p className="text-xs text-red-600 font-medium">Alertes Critiques</p>
                <p className="text-2xl font-bold text-red-600 mt-1">
                  {metrics.watchdogReport?.criticalAlerts?.length || 0}
                </p>
              </div>
              <div className="p-3 rounded-lg bg-yellow-50 border border-yellow-200">
                <p className="text-xs text-yellow-600 font-medium">Avertissements</p>
                <p className="text-2xl font-bold text-yellow-600 mt-1">
                  {metrics.watchdogReport?.warnings?.length || 0}
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* API Health Status */}
      <Card>
        <CardHeader>
          <CardTitle>Santé des API Externes</CardTitle>
          <CardDescription>État des intégrations API et utilisation des quotas</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {Object.entries(metrics.apiHealth || {})
              .sort(([_a, statusA]: [string, any], [_b, statusB]: [string, any]) => {
                // Sort by status severity
                const statusOrder = { critical: 0, warning: 1, healthy: 2 };
                return (statusOrder[statusA?.status as keyof typeof statusOrder] || 99) -
                  (statusOrder[statusB?.status as keyof typeof statusOrder] || 99)
                  ? 1
                  : -1;
              })
              .map(([apiName, status]: [string, any]) => (
                <div key={apiName} className="flex items-center justify-between p-3 rounded-lg border">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <p className="font-semibold capitalize">{apiName}</p>
                      <Badge
                        className={`text-xs border ${getStatusBadgeClass(status?.status || 'critical')}`}
                      >
                        {status?.status || 'unknown'}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <div>
                        <p className="text-muted-foreground">Appels aujourd'hui</p>
                        <p className="font-semibold">{status?.totalCallsToday || 0}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Quota restant</p>
                        <p className="font-semibold">{status?.quotaRemaining || 0}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Taux succès</p>
                        <p className="font-semibold">{status?.successRate || 0}%</p>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="w-16 h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${
                          status?.quotaUsagePercent > 95
                            ? 'bg-red-500'
                            : status?.quotaUsagePercent > 75
                              ? 'bg-yellow-500'
                              : 'bg-green-500'
                        }`}
                        style={{ width: `${Math.min(status?.quotaUsagePercent || 0, 100)}%` }}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {status?.quotaUsagePercent || 0}% utilisé
                    </p>
                  </div>
                </div>
              ))}
          </div>
        </CardContent>
      </Card>

      {/* Circuit Breaker Status */}
      <Card>
        <CardHeader>
          <CardTitle>État des Circuit Breakers</CardTitle>
          <CardDescription>Protection contre les défaillances en cascade</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Object.entries(metrics.circuitBreakerStatus || {}).map(([apiName, cbState]: [string, any]) => {
              const isOpen = cbState?.state === 'open';
              const isHalfOpen = cbState?.state === 'half-open';

              return (
                <div
                  key={apiName}
                  className={`p-4 rounded-lg border ${
                    isOpen
                      ? 'bg-red-50 border-red-200'
                      : isHalfOpen
                        ? 'bg-yellow-50 border-yellow-200'
                        : 'bg-green-50 border-green-200'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <p className="font-semibold capitalize">{apiName}</p>
                    <Badge
                      className={`text-xs border ${
                        isOpen
                          ? 'bg-red-100 text-red-800 border-red-300'
                          : isHalfOpen
                            ? 'bg-yellow-100 text-yellow-800 border-yellow-300'
                            : 'bg-green-100 text-green-800 border-green-300'
                      }`}
                    >
                      {cbState?.state || 'unknown'}
                    </Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <p className="text-muted-foreground">Défaillances</p>
                      <p className="font-semibold">{cbState?.failure_count || 0}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Succès</p>
                      <p className="font-semibold">{cbState?.success_count || 0}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Cache Performance */}
      <Card>
        <CardHeader>
          <CardTitle>Performance du Cache</CardTitle>
          <CardDescription>Taux de succès et efficacité du cache intelligent</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 rounded-lg bg-blue-50 border border-blue-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-blue-600 font-medium">Entrées en cache</p>
                  <p className="text-2xl font-bold text-blue-700 mt-1">
                    {metrics.cacheStats?.totalEntries || 0}
                  </p>
                </div>
                <Database className="h-6 w-6 text-blue-600" />
              </div>
            </div>

            <div className="p-4 rounded-lg bg-green-50 border border-green-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-green-600 font-medium">Taux de succès (HitRatio)</p>
                  <p className="text-2xl font-bold text-green-700 mt-1">
                    {metrics.cacheStats?.hitRatio || 0}%
                  </p>
                </div>
                <Check className="h-6 w-6 text-green-600" />
              </div>
            </div>

            <div className="p-4 rounded-lg bg-purple-50 border border-purple-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-purple-600 font-medium">Âge moyen</p>
                  <p className="text-2xl font-bold text-purple-700 mt-1">
                    {metrics.cacheStats?.averageAge ? `${(metrics.cacheStats.averageAge / 1000).toFixed(0)}s` : 'N/A'}
                  </p>
                </div>
                <Clock className="h-6 w-6 text-purple-600" />
              </div>
            </div>
          </div>

          {/* Cache Details */}
          <div className="mt-4 p-3 rounded-lg bg-gray-50 border border-gray-200">
            <p className="text-sm font-medium mb-2">Statistiques détaillées</p>
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div>
                <p className="text-muted-foreground">Accès réussis</p>
                <p className="font-semibold">{metrics.cacheStats?.hitCount || 0}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Accès échoués</p>
                <p className="font-semibold">{metrics.cacheStats?.missCount || 0}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Total accès</p>
                <p className="font-semibold">
                  {(metrics.cacheStats?.hitCount || 0) + (metrics.cacheStats?.missCount || 0)}
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Warnings Section */}
      {metrics.watchdogReport?.warnings && metrics.watchdogReport.warnings.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-600" />
              Avertissements Système
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {metrics.watchdogReport.warnings.map((warning: any, idx: number) => (
                <div key={idx} className="p-3 rounded-lg bg-yellow-50 border border-yellow-200">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <p className="font-medium text-yellow-900">{warning.message}</p>
                      {warning.details && (
                        <p className="text-xs text-yellow-700 mt-1">
                          {JSON.stringify(warning.details, null, 2).split('\n')[0]}
                        </p>
                      )}
                    </div>
                    <Badge className="bg-yellow-100 text-yellow-800 border-yellow-300 text-xs">
                      {warning.type}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Auto-refresh indicator */}
      <div className="flex items-center justify-center text-xs text-muted-foreground">
        <div className="h-2 w-2 bg-green-500 rounded-full mr-2 animate-pulse" />
        Rafraîchissement automatique toutes les {(refreshInterval / 1000).toFixed(0)}s
      </div>
    </div>
  );
}

export default SystemHealthPanel;
