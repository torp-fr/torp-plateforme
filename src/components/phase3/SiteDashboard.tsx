/**
 * SiteDashboard - Dashboard de synthèse pour le suivi de chantier Phase 3
 */

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import {
  AlertTriangle,
  CheckCircle,
  Clock,
  TrendingUp,
  TrendingDown,
  Minus,
  RefreshCw,
  FileText,
  AlertCircle,
} from 'lucide-react';
import { useProgressReport } from '@/hooks/phase3/useProgressReport';
import { useQualityControls } from '@/hooks/phase3/useQualityControls';
import { useCoordination } from '@/hooks/phase3/useCoordination';
import { useSituations } from '@/hooks/phase3/useSituations';
import { cn } from '@/lib/utils';

interface SiteDashboardProps {
  projetId: string;
  className?: string;
}

export function SiteDashboard({ projetId, className }: SiteDashboardProps) {
  const { latestReport, trends, alerts, isGenerating, generateReport } = useProgressReport({
    projetId,
  });
  const { stats: qualityStats } = useQualityControls({ projetId });
  const { conflicts, slots } = useCoordination({ projetId });
  const { budget } = useSituations({ projetId });

  const getTrendIcon = (trend?: string) => {
    switch (trend) {
      case 'acceleration':
        return <TrendingUp className="h-4 w-4 text-green-500" />;
      case 'regression':
        return <TrendingDown className="h-4 w-4 text-red-500" />;
      default:
        return <Minus className="h-4 w-4 text-gray-500" />;
    }
  };

  const getTendanceBadge = (tendance?: string) => {
    switch (tendance) {
      case 'en_avance':
        return <Badge className="bg-green-100 text-green-800">En avance</Badge>;
      case 'conforme':
        return <Badge className="bg-blue-100 text-blue-800">Conforme</Badge>;
      case 'leger_retard':
        return <Badge className="bg-yellow-100 text-yellow-800">Léger retard</Badge>;
      case 'retard_critique':
        return <Badge className="bg-red-100 text-red-800">Retard critique</Badge>;
      default:
        return <Badge variant="outline">N/A</Badge>;
    }
  };

  const criticalAlerts = alerts.filter((a: any) => a.severite === 'critical');
  const warningAlerts = alerts.filter((a: any) => a.severite === 'warning');
  const activeConflicts = conflicts.filter((c: any) => c.statut !== 'resolu');

  return (
    <div className={cn('space-y-6', className)}>
      {/* En-tête avec actions */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Tableau de bord chantier</h2>
          <p className="text-muted-foreground">
            Dernière mise à jour:{' '}
            {latestReport?.created_at
              ? new Date(latestReport.created_at).toLocaleDateString('fr-FR', {
                  day: 'numeric',
                  month: 'long',
                  hour: '2-digit',
                  minute: '2-digit',
                })
              : 'Jamais'}
          </p>
        </div>
        <Button onClick={() => generateReport()} disabled={isGenerating}>
          <RefreshCw className={cn('mr-2 h-4 w-4', isGenerating && 'animate-spin')} />
          {isGenerating ? 'Génération...' : 'Actualiser le rapport'}
        </Button>
      </div>

      {/* Alertes critiques */}
      {criticalAlerts.length > 0 && (
        <Card className="border-red-200 bg-red-50">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-red-700">
              <AlertTriangle className="h-5 w-5" />
              Alertes critiques ({criticalAlerts.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {criticalAlerts.map((alert: any, i: number) => (
                <li key={i} className="flex items-start gap-2 text-sm text-red-800">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <div>
                    <span className="font-medium">{alert.titre}</span>
                    <p className="text-red-600">{alert.description}</p>
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* KPIs principaux */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* Avancement global */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avancement global</CardTitle>
            {getTrendIcon(trends?.trend)}
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {latestReport?.avancement_global?.toFixed(1) || 0}%
            </div>
            <Progress
              value={latestReport?.avancement_global || 0}
              className="mt-2"
            />
            <div className="mt-2">{getTendanceBadge(latestReport?.tendance)}</div>
          </CardContent>
        </Card>

        {/* Score qualité */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Score qualité</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{qualityStats?.tauxConformite || 0}%</div>
            <Progress
              value={qualityStats?.tauxConformite || 0}
              className={cn(
                'mt-2',
                (qualityStats?.tauxConformite || 0) < 70 && '[&>div]:bg-red-500',
                (qualityStats?.tauxConformite || 0) >= 70 &&
                  (qualityStats?.tauxConformite || 0) < 90 &&
                  '[&>div]:bg-yellow-500'
              )}
            />
            <p className="mt-2 text-xs text-muted-foreground">
              {qualityStats?.ncOuvertes || 0} NC ouvertes
            </p>
          </CardContent>
        </Card>

        {/* Coordination */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Coordination</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{slots.length} créneaux</div>
            <p className="text-xs text-muted-foreground">Cette semaine</p>
            {activeConflicts.length > 0 && (
              <Badge variant="destructive" className="mt-2">
                {activeConflicts.length} conflit(s)
              </Badge>
            )}
          </CardContent>
        </Card>

        {/* Budget */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Budget consommé</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {budget?.pourcentageConsomme?.toFixed(1) || 0}%
            </div>
            <Progress value={budget?.pourcentageConsomme || 0} className="mt-2" />
            <p className="mt-2 text-xs text-muted-foreground">
              {budget?.montantRestant?.toLocaleString('fr-FR') || 0} € restant
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Alertes warning */}
      {warningAlerts.length > 0 && (
        <Card className="border-yellow-200 bg-yellow-50">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-yellow-700">
              <AlertTriangle className="h-5 w-5" />
              Points de vigilance ({warningAlerts.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="grid gap-2 md:grid-cols-2">
              {warningAlerts.map((alert: any, i: number) => (
                <li key={i} className="text-sm text-yellow-800">
                  <span className="font-medium">{alert.titre}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Progression hebdomadaire */}
      {trends && (
        <Card>
          <CardHeader>
            <CardTitle>Tendances</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <p className="text-sm text-muted-foreground">Progression cette semaine</p>
                <p
                  className={cn(
                    'text-xl font-bold',
                    trends.weeklyProgression > 0 ? 'text-green-600' : 'text-red-600'
                  )}
                >
                  {trends.weeklyProgression > 0 ? '+' : ''}
                  {trends.weeklyProgression.toFixed(1)}%
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Vélocité moyenne</p>
                <p className="text-xl font-bold">{trends.averageVelocity.toFixed(1)}%/semaine</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Tendance</p>
                <div className="flex items-center gap-2">
                  {getTrendIcon(trends.trend)}
                  <span className="text-xl font-bold capitalize">{trends.trend}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
