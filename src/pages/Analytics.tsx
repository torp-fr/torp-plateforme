/**
 * Analytics - Cockpit d'Administration TORP (Phase 29.1)
 * Réservé aux comptes admin - suivi et gestion de la plateforme
 * Displays: Global KPIs, Engine Status, Knowledge Health, Fraud Distribution, Recent Logs
 */

import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useApp } from '@/context/AppContext';
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
import type { ContextEngineResult } from '@/core/engines/context.engine';

type TabType = 'overview' | 'orchestration' | 'kb' | 'doctrine' | 'fraud' | 'adaptive' | 'apis' | 'logs' | 'upload-kb' | 'users' | 'config';

export function Analytics() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { userType } = useApp();
  const [activeTab, setActiveTab] = useState<TabType>('orchestration');
  const [loading, setLoading] = useState(false);

  // Get tab from URL query parameter
  useEffect(() => {
    const tab = searchParams.get('tab') as TabType;
    if (tab) {
      setActiveTab(tab);
    }
  }, [searchParams]);

  // Check if user is admin
  if (userType !== 'admin' && userType !== 'super_admin') {
    return (
      <div className="space-y-8">
        <Alert className="bg-destructive/10 border-destructive/20">
          <AlertCircle className="h-4 w-4 text-destructive" />
          <AlertDescription className="text-destructive">
            <strong>Accès refusé</strong> - Cette page est réservée aux administrateurs.
            <br />
            Vous avez été redirigé vers votre tableau de bord personnel.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
    setSearchParams({ tab });
  };

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
 * Overview Tab Component - Platform Control Center
 */
function OverviewTab() {
  const engineStats = getEngineStats();
  const apiStats = getAPIStats();

  return (
    <div className="space-y-8">
      {/* Admin Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Total Users */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-muted-foreground text-sm">Utilisateurs</p>
                <p className="text-4xl font-bold text-foreground mt-2">0</p>
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
                <p className="text-4xl font-bold text-foreground mt-2">0</p>
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
                <p className="text-4xl font-bold text-foreground mt-2">+0%</p>
              </div>
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <TrendingUp className="h-6 w-6 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

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
                <span className="text-2xl font-bold">0</span>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              Aucun document n'a été ingéré dans la Knowledge Base pour le moment. Les documents seront utilisés pour enrichir les analyses par RAG.
            </p>
          </div>
        </CardContent>
      </Card>
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
