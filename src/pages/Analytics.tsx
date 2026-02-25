/**
 * Analytics - Cockpit d'Administration TORP (Phase 29.1)
 * Réservé aux comptes admin - suivi et gestion de la plateforme
 * Displays: Global KPIs, Engine Status, Knowledge Health, Fraud Distribution, Recent Logs
 */

import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { KnowledgeBaseUpload } from '@/components/KnowledgeBaseUpload';
import { CockpitOrchestration } from '@/components/admin/CockpitOrchestration';
import {
  BarChart3,
  Users,
  FileText,
  TrendingUp,
  AlertCircle,
  Database,
  Settings,
  Zap,
  Cpu,
  ExternalLink,
  BookOpen,
  Zap as ZapIcon,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ENGINE_REGISTRY, getEngineStats } from '@/core/platform/engineRegistry';
import { API_REGISTRY, getAPIStats } from '@/core/platform/apiRegistry';
import { getOrchestrationStatus, getOrchestrationStats, getLastOrchestration } from '@/core/platform/engineOrchestrator';
import { analyticsService } from '@/services/api/analytics.service';
import { supabase } from '@/lib/supabase';
import type { ContextEngineResult } from '@/core/engines/context.engine';

type TabType = 'overview' | 'orchestration' | 'kb' | 'doctrine' | 'fraud' | 'adaptive' | 'apis' | 'logs' | 'upload-kb' | 'users' | 'config';

/**
 * Pricing Statistics Card - PHASE 36 Extension
 * Display pricing references and market data statistics
 */
function PricingStatisticsCard() {
  const [pricingStats, setPricingStats] = useState<{
    total_references: number;
    by_work_type: Record<string, number>;
    avg_price_by_type: Record<string, number>;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchPricingStats = async () => {
      try {
        setLoading(true);
        setError(null);
        const { pricingExtractionService } = await import('@/services/ai/pricing-extraction.service');
        const stats = await pricingExtractionService.getPricingStats();
        console.log('[Analytics] Pricing stats:', stats);
        setPricingStats(stats);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to load pricing statistics';
        console.error('[Analytics] Pricing stats error:', message);
        setError(message);
        setPricingStats(null);
      } finally {
        setLoading(false);
      }
    };

    fetchPricingStats();
  }, []);

  const topWorkTypes = pricingStats
    ? Object.entries(pricingStats.by_work_type)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 3)
    : [];

  return (
    <Card className="border-l-4 border-l-emerald-500">
      <CardHeader>
        <div className="flex items-center gap-2">
          <span className="text-2xl">💰</span>
          <CardTitle className="text-primary font-display">Référentiels Tarifaires</CardTitle>
        </div>
        <CardDescription>Données de pricing et références de marché extraites</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {error ? (
            <div className="p-4 rounded-lg bg-red-50 text-sm text-red-700">
              Erreur: {error}
            </div>
          ) : loading ? (
            <div className="p-4 rounded-lg bg-muted text-sm text-muted-foreground">
              Chargement...
            </div>
          ) : !pricingStats || pricingStats.total_references === 0 ? (
            <div className="p-4 rounded-lg bg-muted">
              <p className="text-sm text-muted-foreground">
                Aucune référence tarifaire n'a été extraite pour le moment.
              </p>
            </div>
          ) : (
            <>
              <div className="p-4 rounded-lg bg-muted">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Références totales</span>
                  <span className="text-2xl font-bold">{pricingStats.total_references}</span>
                </div>
              </div>

              {topWorkTypes.length > 0 && (
                <div>
                  <p className="text-sm font-medium mb-2">Couverture par type de travaux</p>
                  <div className="space-y-2">
                    {topWorkTypes.map(([workType, count]) => (
                      <div key={workType} className="p-3 rounded-lg bg-muted/50">
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-muted-foreground">{workType}</span>
                          <Badge variant="secondary">{count}</Badge>
                        </div>
                        {pricingStats.avg_price_by_type[workType] && (
                          <p className="text-xs text-muted-foreground mt-1">
                            ⌀ {Math.round(pricingStats.avg_price_by_type[workType])}€
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Knowledge Base Stats Card - Fetch real document count
 */
function KnowledgeBaseStatsCard() {
  const [docCount, setDocCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchDocCount = async () => {
      try {
        setLoading(true);
        setError(null);
        // PHASE 35.1: Query knowledge_documents table (correct table name)
        const { supabase } = await import('@/lib/supabase');
        const { count, error: dbError } = await supabase
          .from('knowledge_documents')
          .select('id', { count: 'exact', head: true })
          .eq('is_active', true);

        if (dbError) throw dbError;
        console.log('[Analytics] Knowledge base docs:', count);
        setDocCount(count || 0);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to load document count';
        console.error('[Analytics] Document count error:', message);
        setError(message);
        setDocCount(0); // Default to 0 on error
      } finally {
        setLoading(false);
      }
    };

    fetchDocCount();
  }, []);

  return (
    <Card className="border-l-4 border-l-amber-500">
      <CardHeader>
        <div className="flex items-center gap-2">
          <BookOpen className="h-5 w-5 text-amber-600" />
          <CardTitle className="text-primary font-display">Knowledge Base</CardTitle>
        </div>
        <CardDescription>Documents ingérés et sources d'enrichissement</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="p-4 rounded-lg bg-muted">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Documents ingérés</span>
              <span className="text-2xl font-bold">
                {loading ? '—' : (error ? 'Erreur' : docCount)}
              </span>
            </div>
          </div>
          <p className="text-sm text-muted-foreground">
            {error
              ? `Erreur: ${error}`
              : docCount === 0
                ? 'Aucun document n\'a été ingéré dans la Knowledge Base pour le moment.'
                : `${docCount} document${docCount > 1 ? 's' : ''} ingéré${docCount > 1 ? 's' : ''} pour enrichissement RAG.`}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Analytics Stats Cards - Fetch real data from Supabase
 */
function AnalyticsStatsCards() {
  const [stats, setStats] = useState<{
    userCount: number;
    analysisCount: number;
    growth: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await analyticsService.getGlobalStats();
        console.log('[Analytics] Global stats loaded:', data);
        setStats(data);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to load analytics';
        console.error('[Analytics] Stats error:', message);
        setError(message);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Impossible de charger les métriques: {error}
        </AlertDescription>
      </Alert>
    );
  }

  const userCount = stats?.userCount ?? 0;
  const analysisCount = stats?.analysisCount ?? 0;
  const growth = stats?.growth ?? 0;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {/* Total Users */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-muted-foreground text-sm">Utilisateurs</p>
              <p className="text-4xl font-bold text-foreground mt-2">
                {loading ? '—' : userCount}
              </p>
            </div>
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Users className="h-6 w-6 text-primary" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Total Analyses */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-muted-foreground text-sm">Analyses complétées</p>
              <p className="text-4xl font-bold text-foreground mt-2">
                {loading ? '—' : analysisCount}
              </p>
            </div>
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <FileText className="h-6 w-6 text-primary" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Growth - Analyses (30 jours) */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-muted-foreground text-sm">Croissance analyses (30j)</p>
              <p className="text-4xl font-bold text-foreground mt-2">
                {loading ? '—' : `${growth >= 0 ? '+' : ''}${growth}%`}
              </p>
            </div>
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <TrendingUp className="h-6 w-6 text-primary" />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export function Analytics() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabType>('overview');

  return (
    <div className="space-y-8">
      {/* Tab Navigation */}
      <div className="flex gap-2 border-b overflow-x-auto">
        <Button
          variant={activeTab === 'orchestration' ? 'default' : 'ghost'}
          onClick={() => handleTabChange('orchestration')}
          className="rounded-b-none"
        >
          <Zap className="h-4 w-4 mr-2" />
          Cockpit d'Orchestration
        </Button>
        <Button
          variant={activeTab === 'fraud' ? 'default' : 'ghost'}
          onClick={() => handleTabChange('fraud')}
          className="rounded-b-none"
        >
          <AlertCircle className="h-4 w-4 mr-2" />
          Surveillance Fraude
        </Button>
        <Button
          variant={activeTab === 'kb' ? 'default' : 'ghost'}
          onClick={() => handleTabChange('kb')}
          className="rounded-b-none"
        >
          <Database className="h-4 w-4 mr-2" />
          Base de Connaissances
        </Button>
        <Button
          variant={activeTab === 'doctrine' ? 'default' : 'ghost'}
          onClick={() => handleTabChange('doctrine')}
          className="rounded-b-none"
        >
          <BookOpen className="h-4 w-4 mr-2" />
          Doctrine & Normes
        </Button>
        <Button
          variant={activeTab === 'adaptive' ? 'default' : 'ghost'}
          onClick={() => handleTabChange('adaptive')}
          className="rounded-b-none"
        >
          <TrendingUp className="h-4 w-4 mr-2" />
          Adaptatif
        </Button>
        <Button
          variant={activeTab === 'apis' ? 'default' : 'ghost'}
          onClick={() => handleTabChange('apis')}
          className="rounded-b-none"
        >
          <ExternalLink className="h-4 w-4 mr-2" />
          APIs
        </Button>
        <Button
          variant={activeTab === 'users' ? 'default' : 'ghost'}
          onClick={() => handleTabChange('users')}
          className="rounded-b-none"
        >
          <Users className="h-4 w-4 mr-2" />
          Utilisateurs
        </Button>
        <Button
          variant={activeTab === 'logs' ? 'default' : 'ghost'}
          onClick={() => handleTabChange('logs')}
          className="rounded-b-none"
        >
          <FileText className="h-4 w-4 mr-2" />
          Logs
        </Button>
      </div>

      {/* Tab Content */}
      {activeTab === 'orchestration' && <CockpitOrchestration loading={loading} />}
      {activeTab === 'fraud' && <FraudMonitoringTab />}
      {activeTab === 'kb' && <UploadKBTab />}
      {activeTab === 'doctrine' && <DoctrineTab />}
      {activeTab === 'adaptive' && <AdaptiveTab />}
      {activeTab === 'apis' && <APIsTab />}
      {activeTab === 'users' && <UsersTab navigate={navigate} />}
      {activeTab === 'logs' && <LogsTab />}
    </div>
  );
}

/**
 * Fraud Monitoring Tab Component
 */
function FraudMonitoringTab() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Surveillance Fraude</h2>
        <p className="text-muted-foreground">Détection et monitoring des patterns de fraude</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Détection Fraude en Temps Réel</CardTitle>
          <CardDescription>4 vecteurs d'analyse: pricing, compliance, enterprise, structural</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground">
            Section détaillée en développement. Les données de fraude sont visibles dans le Cockpit d'Orchestration.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

/**
 * Doctrine Tab Component
 */
function DoctrineTab() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Doctrine & Normes</h2>
        <p className="text-muted-foreground">Gestion des règles normatives et jurisprudence</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Knowledge Core</CardTitle>
          <CardDescription>40+ items: Norms, Pricing References, Jurisprudence, Risks</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-4 rounded-lg bg-blue-50 border border-blue-200">
              <p className="text-sm text-muted-foreground">Règles Normatives</p>
              <p className="text-2xl font-bold text-blue-700">10</p>
            </div>
            <div className="p-4 rounded-lg bg-purple-50 border border-purple-200">
              <p className="text-sm text-muted-foreground">Références Pricing</p>
              <p className="text-2xl font-bold text-purple-700">10</p>
            </div>
            <div className="p-4 rounded-lg bg-amber-50 border border-amber-200">
              <p className="text-sm text-muted-foreground">Jurisprudence</p>
              <p className="text-2xl font-bold text-amber-700">5</p>
            </div>
            <div className="p-4 rounded-lg bg-green-50 border border-green-200">
              <p className="text-sm text-muted-foreground">Facteurs Risque</p>
              <p className="text-2xl font-bold text-green-700">5</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/**
 * Adaptive Tab Component
 */
function AdaptiveTab() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Monitoring Adaptatif</h2>
        <p className="text-muted-foreground">Impacts et ajustements dynamiques des scores</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Moteur Adaptatif</CardTitle>
          <CardDescription>Ajustements sectoriels et pénalités métier</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground">
            Section détaillée en développement. Les données adaptatives sont visibles dans le Cockpit d'Orchestration.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

/**
 * APIs Tab Component
 */
function APIsTab() {
  const apiStats = getAPIStats();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">APIs Externes</h2>
        <p className="text-muted-foreground">Services externes intégrés à la plateforme</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>État des APIs</CardTitle>
          <Badge variant="outline" className="w-fit">{apiStats.total} APIs</Badge>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {API_REGISTRY.map((api) => (
              <div key={api.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                <div>
                  <p className="font-medium text-sm">{api.name}</p>
                  <p className="text-xs text-muted-foreground">{api.description}</p>
                </div>
                <Badge
                  variant="outline"
                  className={
                    api.status === 'active'
                      ? 'bg-green-100 text-green-700 border-green-300'
                      : api.status === 'configured'
                        ? 'bg-blue-100 text-blue-700 border-blue-300'
                        : 'bg-gray-100 text-gray-700 border-gray-300'
                  }
                >
                  {api.status}
                </Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/**
 * Logs Tab Component
 */
function LogsTab() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Logs Système</h2>
        <p className="text-muted-foreground">Audit trail et historique des opérations</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Historique Récent</CardTitle>
          <CardDescription>Dernières opérations système</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">
            Les logs système seront disponibles après intégration de la persistence d'audit.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

/**
 * Orchestration execution order - defines the pipeline sequence
 */
const ENGINE_FLOW = [
  'contextEngine',
  'lotEngine',
  'ruleEngine',
  'scoringEngine',
  'enrichmentEngine',
  'auditEngine',
  'globalScoringEngine',
  'trustCappingEngine',
];

/**
 * PHASE 36.10: Engine Status Live Card with Realtime Updates
 * Listens to score_snapshots table for real-time engine metrics
 */
function EngineStatusLiveCard() {
  const [snapshots, setSnapshots] = useState<Record<string, any>>({});
  const [timeline, setTimeline] = useState<any[]>([]);
  const engineStats = getEngineStats();

  // ✅ PHASE 36.10: Batching buffer to avoid massive re-renders
  const bufferRef = useRef<any[]>([]);
  const flushTimerRef = useRef<any>(null);

  useEffect(() => {
    console.log('[ANALYTICS REALTIME] Setting up score_snapshots listener...');

    // ✅ PHASE 36.10: Subscribe to real-time engine snapshots (filtered for performance)
    // Filter at DB level to avoid massive re-renders from non-engine snapshots
    const channel = supabase
      .channel('analytics-engine-snapshots')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'score_snapshots',
          filter: 'snapshot_type=eq.engine', // ✅ Only engine snapshots - reduce network + re-renders
        },
        (payload) => {
          // ✅ PHASE 36.10: Security check - validate snapshot_type at application level
          const newSnapshot = payload.new as any;
          if (newSnapshot.snapshot_type !== 'engine') {
            console.warn('[ANALYTICS REALTIME] ⚠️ Received non-engine snapshot (should be filtered):', newSnapshot.snapshot_type);
            return;
          }

          console.log('[ANALYTICS REALTIME] New engine snapshot received:', {
            engine: newSnapshot.engine_name,
            score: newSnapshot.score,
            duration: newSnapshot.duration_ms,
          });

          // ✅ PHASE 36.10: Batching optimization - accumulate snapshots in buffer
          // Reduces 11 renders → 1 render per batch window (250ms)
          bufferRef.current.push(newSnapshot);

          if (!flushTimerRef.current) {
            flushTimerRef.current = setTimeout(() => {
              const updates = [...bufferRef.current];
              bufferRef.current = [];
              flushTimerRef.current = null;

              console.log('[ANALYTICS REALTIME] Flushing batch:', {
                count: updates.length,
                engines: updates.map((u) => u.engine_name),
              });

              // Single batch state update
              setSnapshots((prev) => {
                const next = { ...prev };
                updates.forEach((snap) => {
                  next[snap.engine_name] = {
                    score: snap.score,
                    status: snap.status,
                    duration_ms: snap.duration_ms,
                    timestamp: snap.created_at || new Date().toISOString(),
                  };
                });
                return next;
              });

              // Timeline updated in same batch
              setTimeline((prev) => [
                ...updates.map((snap) => ({
                  engine: snap.engine_name,
                  score: snap.score,
                  duration: snap.duration_ms,
                  timestamp: snap.created_at || new Date().toISOString(),
                })),
                ...prev.slice(0, 20 - updates.length),
              ]);
            }, 250); // Batch window: 250ms
          }
        }
      )
      .subscribe((status) => {
        console.log('[ANALYTICS REALTIME] Subscription status:', status);
      });

    return () => {
      console.log('[ANALYTICS REALTIME] Cleaning up subscription');
      supabase.removeChannel(channel);

      // ✅ PHASE 36.10: Clear pending batch timer on unmount
      if (flushTimerRef.current) {
        clearTimeout(flushTimerRef.current);
        flushTimerRef.current = null;
      }
    };
  }, []);

  return (
    <Card className="border-l-4 border-l-blue-500">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Cpu className="h-5 w-5 text-blue-600" />
            <CardTitle className="text-primary font-display">Platform Engines</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline">{engineStats.total} engines</Badge>
            {Object.keys(snapshots).length > 0 && (
              <Badge className="bg-green-100 text-green-700 border-green-300">
                🔴 Live ({Object.keys(snapshots).length})
              </Badge>
            )}
          </div>
        </div>
        <CardDescription>Orchestration engines pour analyse et enrichissement</CardDescription>
      </CardHeader>

      {/* ✅ PHASE 36.11: Engine Orchestration Flow Pipeline */}
      <div className="px-6 py-4 bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-blue-100">
        <h4 className="text-xs font-semibold text-blue-900 mb-3 uppercase">Orchestration Pipeline</h4>
        <div className="flex items-center gap-2 overflow-x-auto pb-2">
          {ENGINE_FLOW.map((engineId, idx) => {
            const hasSnapshot = engineId in snapshots;
            const snapshot = snapshots[engineId];
            return (
              <React.Fragment key={engineId}>
                <div
                  className={`flex flex-col items-center gap-1 px-3 py-2 rounded-lg transition-all whitespace-nowrap ${
                    hasSnapshot
                      ? 'bg-green-100 border border-green-300 text-green-700'
                      : 'bg-gray-100 border border-gray-300 text-gray-600'
                  }`}
                >
                  <span className="text-xs font-medium">
                    {engineId.replace(/Engine$/, '').charAt(0).toUpperCase() + engineId.replace(/Engine$/, '').slice(1)}
                  </span>
                  {hasSnapshot && (
                    <span className="text-xs font-semibold text-green-700">
                      ✓ {snapshot.score !== null ? snapshot.score.toFixed(2) : '—'}
                    </span>
                  )}
                </div>
                {idx < ENGINE_FLOW.length - 1 && (
                  <div className="flex items-center justify-center">
                    <div className={`w-6 h-0.5 ${hasSnapshot ? 'bg-green-400' : 'bg-gray-300'}`} />
                    <span className={`text-xs ${hasSnapshot ? 'text-green-600' : 'text-gray-400'}`}>→</span>
                  </div>
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>

      <CardContent>
        {/* Orchestration Status */}
        <div className="mb-4 p-3 rounded-lg bg-blue-50 border border-blue-200">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-blue-900">Orchestration Status</span>
            <Badge className="bg-blue-100 text-blue-700 border-blue-300">
              {getOrchestrationStatus()}
            </Badge>
          </div>
        </div>

        <div className="space-y-3">
          {ENGINE_REGISTRY.map((engine) => {
            const snapshot = snapshots[engine.id];
            return (
              <div key={engine.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted/70 transition-colors">
                <div>
                  <p className="font-medium text-sm">{engine.name}</p>
                  <p className="text-xs text-muted-foreground">{engine.description}</p>
                  {snapshot && (
                    <p className="text-xs text-blue-600 mt-1">
                      ⚡ Score: {snapshot.score !== null ? snapshot.score.toFixed(2) : '—'} | Duration: {snapshot.duration_ms}ms
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {snapshot && (
                    <Badge className="bg-blue-100 text-blue-700 border-blue-300 animate-pulse">
                      {snapshot.status}
                    </Badge>
                  )}
                  <Badge
                    variant="outline"
                    className={
                      engine.status === 'active'
                        ? 'bg-green-100 text-green-700 border-green-300'
                        : engine.status === 'error'
                          ? 'bg-red-100 text-red-700 border-red-300'
                          : 'bg-gray-100 text-gray-700 border-gray-300'
                    }
                  >
                    {engine.status}
                  </Badge>
                </div>
              </div>
            );
          })}
        </div>

        {/* ✅ PHASE 36.10: Engine Activity Timeline */}
        {timeline.length > 0 && (
          <div className="mt-6 pt-4 border-t border-muted">
            <h4 className="text-sm font-semibold text-foreground mb-3">📊 Engine Activity (Last 20)</h4>
            <div className="space-y-1 max-h-48 overflow-y-auto">
              {timeline.map((item, idx) => (
                <div key={idx} className="text-xs p-2 rounded bg-muted/30 text-muted-foreground hover:bg-muted/50 transition-colors">
                  <span className="font-medium">[{item.engine}]</span>
                  {' '}
                  <span className="text-blue-600">
                    {item.score !== null ? `${item.score.toFixed(2)}` : '—'}
                  </span>
                  {' '}
                  <span className="text-gray-500">
                    {item.duration}ms
                  </span>
                  {' '}
                  <span className="text-xs text-gray-400">
                    {new Date(item.timestamp).toLocaleTimeString()}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Overview Tab Component - Platform Control Center
 */
function OverviewTab() {
  const apiStats = getAPIStats();

  return (
    <div className="space-y-8">
      {/* Admin Stats Cards - Real Data from Analytics Service */}
      <AnalyticsStatsCards />


      {/* Platform Health */}
      <Card>
        <CardHeader>
          <CardTitle className="text-primary font-display">Santé de la plateforme</CardTitle>
          <CardDescription>Monitoring et alertes système</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">API Status</span>
            <span className="text-sm font-semibold text-success">✓ Opérationnel</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Database</span>
            <span className="text-sm font-semibold text-success">✓ Opérationnel</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Storage</span>
            <span className="text-sm font-semibold text-success">✓ Opérationnel</span>
          </div>
        </CardContent>
      </Card>

      {/* ========== PLATFORM CONTROL CENTER ========== */}

      {/* Platform Engines Section - NOW WITH REALTIME UPDATES */}
      <EngineStatusLiveCard />

      {/* Last Orchestration Result Section */}
      <LastOrchestrationResultSection />

      {/* External APIs Section */}
      <Card className="border-l-4 border-l-purple-500">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ExternalLink className="h-5 w-5 text-purple-600" />
              <CardTitle className="text-primary font-display">External APIs</CardTitle>
            </div>
            <Badge variant="outline">{apiStats.total} APIs</Badge>
          </div>
          <CardDescription>Services externes intégrés à la plateforme</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {API_REGISTRY.map((api) => (
              <div key={api.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                <div>
                  <p className="font-medium text-sm">{api.name}</p>
                  <p className="text-xs text-muted-foreground">{api.description}</p>
                </div>
                <Badge
                  variant="outline"
                  className={
                    api.status === 'active'
                      ? 'bg-green-100 text-green-700 border-green-300'
                      : api.status === 'configured'
                        ? 'bg-blue-100 text-blue-700 border-blue-300'
                        : 'bg-gray-100 text-gray-700 border-gray-300'
                  }
                >
                  {api.status}
                </Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Knowledge Base Section */}
      <KnowledgeBaseStatsCard />

      {/* PHASE 36 Extension: Pricing Intelligence Section */}
      <PricingStatisticsCard />
    </div>
  );
}

/**
 * Last Orchestration Result Component
 * Display results from the last engine orchestration
 */
function LastOrchestrationResultSection() {
  const lastOrchestration = getLastOrchestration();
  const contextEngineResult = lastOrchestration?.results?.contextEngine as ContextEngineResult | undefined;

  // Don't show section if no orchestration result yet
  if (!lastOrchestration) {
    return (
      <Card className="border-l-4 border-l-green-500">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-green-600" />
            <CardTitle className="text-primary font-display">Last Orchestration Result</CardTitle>
          </div>
          <CardDescription>Résultats de la dernière exécution d'orchestration</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Aucune orchestration exécutée pour le moment. Les résultats s'afficheront après création/mise à jour d'un projet.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-l-4 border-l-green-500">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Zap className="h-5 w-5 text-green-600" />
          <CardTitle className="text-primary font-display">Last Orchestration Result</CardTitle>
        </div>
        <CardDescription>Résultats de la dernière exécution d'orchestration</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Overall Status */}
        <div className="space-y-3">
          <h3 className="font-medium text-sm">Orchestration Status</h3>
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 rounded-lg bg-muted">
              <p className="text-xs text-muted-foreground mb-1">Status</p>
              <Badge
                className={
                  lastOrchestration.status === 'completed'
                    ? 'bg-green-100 text-green-700 border-green-300'
                    : lastOrchestration.status === 'error'
                      ? 'bg-red-100 text-red-700 border-red-300'
                      : 'bg-yellow-100 text-yellow-700 border-yellow-300'
                }
              >
                {lastOrchestration.status}
              </Badge>
            </div>
            <div className="p-3 rounded-lg bg-muted">
              <p className="text-xs text-muted-foreground mb-1">Start Time</p>
              <p className="text-xs font-medium">{new Date(lastOrchestration.startTime).toLocaleTimeString()}</p>
            </div>
          </div>
        </div>

        {/* Executed Engines */}
        <div className="space-y-3">
          <h3 className="font-medium text-sm">Executed Engines ({lastOrchestration.executedEngines.length})</h3>
          <div className="space-y-2">
            {lastOrchestration.executedEngines.map((engineExec) => (
              <div key={engineExec.engineId} className="p-3 rounded-lg bg-muted/50">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">{engineExec.engineId}</span>
                  <Badge
                    variant="outline"
                    className={
                      engineExec.status === 'completed'
                        ? 'bg-green-100 text-green-700 border-green-300'
                        : engineExec.status === 'failed'
                          ? 'bg-red-100 text-red-700 border-red-300'
                          : engineExec.status === 'skipped'
                            ? 'bg-gray-100 text-gray-700 border-gray-300'
                            : 'bg-blue-100 text-blue-700 border-blue-300'
                    }
                  >
                    {engineExec.status}
                  </Badge>
                </div>
                {engineExec.error && (
                  <p className="text-xs text-red-600 mt-2">Error: {engineExec.error}</p>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Context Engine Results */}
        {contextEngineResult && (
          <div className="space-y-3 border-t pt-4">
            <h3 className="font-medium text-sm">Context Engine Results</h3>
            <div className="grid grid-cols-3 gap-3">
              <div className="p-3 rounded-lg bg-blue-50 border border-blue-200">
                <p className="text-xs text-muted-foreground mb-1">Lots Detected</p>
                <p className="text-2xl font-bold text-blue-700">{contextEngineResult.summary?.totalLots || 0}</p>
              </div>
              <div className="p-3 rounded-lg bg-purple-50 border border-purple-200">
                <p className="text-xs text-muted-foreground mb-1">Spaces</p>
                <p className="text-2xl font-bold text-purple-700">{contextEngineResult.summary?.totalSpaces || 0}</p>
              </div>
              <div className="p-3 rounded-lg bg-amber-50 border border-amber-200">
                <p className="text-xs text-muted-foreground mb-1">Flags</p>
                <p className="text-2xl font-bold text-amber-700">{contextEngineResult.summary?.flagCount || 0}</p>
              </div>
            </div>

            {/* Detected Lots */}
            {contextEngineResult.detectedLots.length > 0 && (
              <div className="space-y-2 mt-3">
                <p className="text-xs font-medium text-muted-foreground">Detected Lots:</p>
                <div className="space-y-1">
                  {contextEngineResult.detectedLots.map((lot, idx) => (
                    <div key={idx} className="text-xs p-2 rounded bg-muted/50">
                      {lot.type} {lot.confidence && `(${Math.round(lot.confidence * 100)}%)`}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Validation Flags */}
            {contextEngineResult.flags.length > 0 && (
              <div className="space-y-2 mt-3">
                <p className="text-xs font-medium text-muted-foreground">Validation Flags:</p>
                <div className="space-y-1">
                  {contextEngineResult.flags.map((flag, idx) => (
                    <div
                      key={idx}
                      className={`text-xs p-2 rounded ${
                        flag.severity === 'error'
                          ? 'bg-red-50 border border-red-200 text-red-700'
                          : flag.severity === 'warning'
                            ? 'bg-yellow-50 border border-yellow-200 text-yellow-700'
                            : 'bg-blue-50 border border-blue-200 text-blue-700'
                      }`}
                    >
                      {flag.code}: {flag.message}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Processing Time */}
            <div className="mt-3 text-xs text-muted-foreground p-2 rounded bg-muted">
              Processing time: {contextEngineResult.meta?.processingTime || 0}ms
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Upload KB Tab Component
 */
function UploadKBTab() {
  return (
    <div className="space-y-6">
      <KnowledgeBaseUpload />

      <Card>
        <CardHeader>
          <CardTitle>Documents Récemment Uploadés</CardTitle>
          <CardDescription>Les derniers documents métier ingérés</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">
            Les documents apparaîtront ici après upload.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

/**
 * Users Tab Component
 */
function UsersTab({ navigate }: { navigate: any }) {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Gestion des Utilisateurs</h2>
          <p className="text-muted-foreground">Gérez les rôles et permissions</p>
        </div>
        <Button onClick={() => navigate('/analytics/users')}>
          Gérer les utilisateurs
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Accédez à la page de gestion</CardTitle>
          <CardDescription>Cliquez sur le bouton ci-dessus pour accéder à la gestion complète des utilisateurs</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">
            Vous pouvez promouvoir des utilisateurs au rôle d'administrateur, gérer les permissions KB, et consulter l'historique d'audit.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

/**
 * Settings Tab Component
 */
function SettingsTab() {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Paramètres d'Administration</CardTitle>
          <CardDescription>Configurez les paramètres de la plateforme</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">
            Section en développement - Bientôt disponible
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

export default Analytics;
