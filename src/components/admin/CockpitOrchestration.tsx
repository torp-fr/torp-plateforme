/**
 * Cockpit d'Orchestration TORP (Phase 29.1)
 * Main admin dashboard with real-time platform metrics
 * Displays: Global KPIs, Engine Status, Knowledge Health, Fraud Distribution, Adaptive Impact, Recent Logs
 */

import React, { useState, useEffect } from 'react';
import {
  BarChart3,
  Zap,
  AlertTriangle,
  BookOpen,
  TrendingUp,
  Users,
  Database,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  MetricCard,
  EngineStatusGrid,
  GradeDistribution,
  FraudDistribution,
  RecentOrchestrationTable,
} from './DashboardMetrics';
import { ENGINE_REGISTRY } from '@/core/platform/engineRegistry';

interface CockpitMetrics {
  totalAnalyses: number;
  averageScore: number;
  gradeDistribution: Record<string, number>;
  fraudScoreAverage: number;
  coherenceScoreAverage: number;
  doctrineActivationRate: number;
  documentsCount: number;
  chunksCount: number;
  doctrineConfidenceAverage: number;
  fraudDistribution: Record<string, number>;
  adaptiveAdjustmentRate: number;
  averageNormativePenalty: number;
  averagePricingPenalty: number;
  recentOrchestrations: any[];
}

interface CockpitProps {
  metrics?: CockpitMetrics;
  loading?: boolean;
}

export function CockpitOrchestration({ metrics, loading = false }: CockpitProps) {
  const [selectedSection, setSelectedSection] = useState<string>('global');
  const [engines, setEngines] = useState<any[]>([]);

  useEffect(() => {
    // Load engine status from registry
    const engineList = ENGINE_REGISTRY.map((engine) => ({
      id: engine.id,
      name: engine.name,
      status: engine.status || 'idle',
      lastExecution: new Date().toLocaleTimeString('fr-FR'),
      averageTime: Math.random() * 500 + 100, // Placeholder
      successRate: 95 + Math.random() * 5, // Placeholder
    }));
    setEngines(engineList);
  }, []);

  // Default metrics if not provided
  const defaultMetrics: CockpitMetrics = {
    totalAnalyses: 0,
    averageScore: 0,
    gradeDistribution: { A: 0, B: 0, C: 0, D: 0, E: 0 },
    fraudScoreAverage: 0,
    coherenceScoreAverage: 0,
    doctrineActivationRate: 0,
    documentsCount: 0,
    chunksCount: 0,
    doctrineConfidenceAverage: 0,
    fraudDistribution: { low: 0, moderate: 0, high: 0, critical: 0 },
    adaptiveAdjustmentRate: 0,
    averageNormativePenalty: 0,
    averagePricingPenalty: 0,
    recentOrchestrations: [],
  };

  const displayMetrics = metrics || defaultMetrics;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-foreground font-display flex items-center gap-3">
          <Zap className="h-8 w-8 text-amber-500" />
          Cockpit d'Orchestration TORP
        </h1>
        <p className="text-muted-foreground mt-1">
          Supervision temps réel des moteurs et métiques plateforme
        </p>
      </div>

      {/* Alert */}
      {loading && (
        <Alert className="bg-blue-50 border-blue-200">
          <Zap className="h-4 w-4 text-blue-600" />
          <AlertDescription className="text-blue-700">
            Chargement des données en temps réel...
          </AlertDescription>
        </Alert>
      )}

      {/* SECTION 1: MÉTRIQUES GLOBALES */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-primary" />
          <h2 className="text-2xl font-bold">Métriques Globales</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            title="Total Analyses"
            value={displayMetrics.totalAnalyses}
            icon={Users}
            loading={loading}
            change={
              displayMetrics.totalAnalyses > 0
                ? { value: 12, direction: 'up' }
                : undefined
            }
          />
          <MetricCard
            title="Score Final Moyen"
            value={displayMetrics.averageScore.toFixed(1)}
            icon={TrendingUp}
            loading={loading}
          />
          <MetricCard
            title="Score Fraude Moyen"
            value={displayMetrics.fraudScoreAverage.toFixed(1)}
            icon={AlertTriangle}
            loading={loading}
          />
          <MetricCard
            title="Cohérence Moyenne"
            value={displayMetrics.coherenceScoreAverage.toFixed(1)}
            icon={BarChart3}
            loading={loading}
          />
        </div>

        {/* Grade Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>Répartition des Grades</CardTitle>
            <CardDescription>Distribution des grades finals (A/B/C/D/E)</CardDescription>
          </CardHeader>
          <CardContent>
            <GradeDistribution
              distribution={displayMetrics.gradeDistribution}
              total={displayMetrics.totalAnalyses}
              loading={loading}
            />
          </CardContent>
        </Card>

        {/* Doctrine Activation Rate */}
        <Card>
          <CardHeader>
            <CardTitle>Activation Doctrine</CardTitle>
            <CardDescription>Taux d'enrichissement par la Knowledge Base</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-end gap-4">
              <div>
                <p className="text-4xl font-bold text-primary">
                  {displayMetrics.doctrineActivationRate.toFixed(1)}%
                </p>
                <p className="text-sm text-muted-foreground mt-2">
                  {Math.round(
                    (displayMetrics.doctrineActivationRate / 100) * displayMetrics.totalAnalyses
                  )}{' '}
                  analyses enrichies
                </p>
              </div>
              <div className="flex-1">
                <div className="w-full bg-gray-200 rounded-full h-3">
                  <div
                    className="bg-blue-500 h-3 rounded-full transition-all"
                    style={{ width: `${displayMetrics.doctrineActivationRate}%` }}
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* SECTION 2: STATUT DES MOTEURS */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Zap className="h-5 w-5 text-blue-600" />
          <h2 className="text-2xl font-bold">Statut des Moteurs</h2>
          <span className="text-sm text-muted-foreground ml-auto">
            {engines.length} moteurs actifs
          </span>
        </div>

        <EngineStatusGrid engines={engines} loading={loading} />
      </div>

      {/* SECTION 3: SANTÉ BASE DE CONNAISSANCES */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <BookOpen className="h-5 w-5 text-amber-600" />
          <h2 className="text-2xl font-bold">Santé de la Base de Connaissances</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <MetricCard
            title="Documents Totaux"
            value={displayMetrics.documentsCount}
            icon={Database}
            loading={loading}
          />
          <MetricCard
            title="Chunks Totaux"
            value={displayMetrics.chunksCount}
            icon={Database}
            loading={loading}
          />
          <MetricCard
            title="Confidence Doctrine Moyenne"
            value={displayMetrics.doctrineConfidenceAverage.toFixed(1)}
            icon={TrendingUp}
            loading={loading}
          />
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Coverage Normative</CardTitle>
            <CardDescription>Pourcentage de lots couverts par la doctrine</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Couverture des lots</span>
                <span className="text-lg font-bold text-amber-600">
                  {(displayMetrics.doctrineActivationRate || 0).toFixed(1)}%
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div
                  className="bg-amber-500 h-3 rounded-full transition-all"
                  style={{
                    width: `${displayMetrics.doctrineActivationRate || 0}%`,
                  }}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* SECTION 4: DASHBOARD FRAUDE */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-red-600" />
          <h2 className="text-2xl font-bold">Distribution Fraude</h2>
        </div>

        <Card>
          <CardContent className="p-6">
            <FraudDistribution
              distribution={displayMetrics.fraudDistribution}
              total={displayMetrics.totalAnalyses}
              loading={loading}
            />
          </CardContent>
        </Card>
      </div>

      {/* SECTION 5: IMPACT ADAPTATIF */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-green-600" />
          <h2 className="text-2xl font-bold">Impact Adaptatif</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <MetricCard
            title="% Projets Ajustés"
            value={displayMetrics.adaptiveAdjustmentRate.toFixed(1) + '%'}
            icon={TrendingUp}
            loading={loading}
          />
          <MetricCard
            title="Pénalité Normative Moyenne"
            value={displayMetrics.averageNormativePenalty.toFixed(2)}
            icon={BarChart3}
            loading={loading}
          />
          <MetricCard
            title="Pénalité Pricing Moyenne"
            value={displayMetrics.averagePricingPenalty.toFixed(2)}
            icon={BarChart3}
            loading={loading}
          />
        </div>
      </div>

      {/* SECTION 6: LOG ORCHESTRATION RÉCENTE */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Zap className="h-5 w-5 text-green-600" />
          <h2 className="text-2xl font-bold">Log Orchestration Récente</h2>
        </div>

        <Card>
          <CardContent className="p-6">
            <RecentOrchestrationTable
              orchestrations={displayMetrics.recentOrchestrations}
              loading={loading}
            />
          </CardContent>
        </Card>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between py-4 border-t text-sm text-muted-foreground">
        <p>Dernière mise à jour: {new Date().toLocaleTimeString('fr-FR')}</p>
        <p>TORP Platform • Cockpit d'Orchestration v1.0</p>
      </div>
    </div>
  );
}

export default CockpitOrchestration;
