/**
 * Analytics - Panel d'administration TORP
 * Réservé aux comptes admin - suivi et gestion de la plateforme
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { KnowledgeBaseUpload } from '@/components/KnowledgeBaseUpload';
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
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ENGINE_REGISTRY, getEngineStats } from '@/core/platform/engineRegistry';
import { API_REGISTRY, getAPIStats } from '@/core/platform/apiRegistry';
import { getOrchestrationStatus, getOrchestrationStats, getLastOrchestration } from '@/core/platform/engineOrchestrator';
import { analyticsService } from '@/services/api/analytics.service';
import type { ContextEngineResult } from '@/core/engines/context.engine';

type TabType = 'overview' | 'upload-kb' | 'users' | 'settings';

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
        // Query knowledge base document count
        const { supabase } = await import('@/lib/supabase');
        const { count, error: dbError } = await supabase
          .from('documents')
          .select('id', { count: 'exact', head: true });

        if (dbError) throw dbError;
        console.log('[Analytics] Knowledge base docs:', count);
        setDocCount(count || 0);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to load document count';
        console.error('[Analytics] Document count error:', message);
        setError(message);
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
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-foreground font-display">Panel d'Administration</h1>
        <p className="text-muted-foreground mt-1">Suivi et gestion de la plateforme TORP</p>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-2 border-b overflow-x-auto">
        <Button
          variant={activeTab === 'overview' ? 'default' : 'ghost'}
          onClick={() => setActiveTab('overview')}
          className="rounded-b-none"
        >
          <BarChart3 className="h-4 w-4 mr-2" />
          Vue d'ensemble
        </Button>
        <Button
          variant={activeTab === 'upload-kb' ? 'default' : 'ghost'}
          onClick={() => setActiveTab('upload-kb')}
          className="rounded-b-none"
        >
          <Database className="h-4 w-4 mr-2" />
          Base de Connaissances
        </Button>
        <Button
          variant={activeTab === 'users' ? 'default' : 'ghost'}
          onClick={() => setActiveTab('users')}
          className="rounded-b-none"
        >
          <Users className="h-4 w-4 mr-2" />
          Utilisateurs
        </Button>
        <Button
          variant={activeTab === 'settings' ? 'default' : 'ghost'}
          onClick={() => setActiveTab('settings')}
          className="rounded-b-none"
        >
          <Settings className="h-4 w-4 mr-2" />
          Paramètres
        </Button>
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && <OverviewTab />}
      {activeTab === 'upload-kb' && <UploadKBTab />}
      {activeTab === 'users' && <UsersTab navigate={navigate} />}
      {activeTab === 'settings' && <SettingsTab />}
    </div>
  );
}

/**
 * Overview Tab Component - Platform Control Center
 */
function OverviewTab() {
  const engineStats = getEngineStats();
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

      {/* Platform Engines Section */}
      <Card className="border-l-4 border-l-blue-500">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Cpu className="h-5 w-5 text-blue-600" />
              <CardTitle className="text-primary font-display">Platform Engines</CardTitle>
            </div>
            <Badge variant="outline">{engineStats.total} engines</Badge>
          </div>
          <CardDescription>Orchestration engines pour analyse et enrichissement</CardDescription>
        </CardHeader>
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
            {ENGINE_REGISTRY.map((engine) => (
              <div key={engine.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                <div>
                  <p className="font-medium text-sm">{engine.name}</p>
                  <p className="text-xs text-muted-foreground">{engine.description}</p>
                </div>
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
            ))}
          </div>
        </CardContent>
      </Card>

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
        <Button onClick={() => navigate('/admin/users')}>
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
