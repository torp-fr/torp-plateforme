/**
 * Dashboard Metrics Components (Phase 29.1)
 * KPI cards and metrics for the Admin Cockpit
 */

import React from 'react';
import {
  TrendingUp,
  TrendingDown,
  AlertCircle,
  CheckCircle,
  Activity,
  BookOpen,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface MetricCardProps {
  title: string;
  value: string | number;
  change?: {
    value: number;
    direction: 'up' | 'down';
  };
  icon?: React.ElementType;
  trend?: boolean;
  loading?: boolean;
}

export function MetricCard({
  title,
  value,
  change,
  icon: Icon,
  trend = false,
  loading = false,
}: MetricCardProps) {
  return (
    <Card className="h-full">
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="text-3xl font-bold text-foreground mt-2">
              {loading ? '...' : value}
            </p>
            {change && (
              <div className="flex items-center gap-1 mt-2">
                {change.direction === 'up' ? (
                  <TrendingUp className="h-4 w-4 text-green-600" />
                ) : (
                  <TrendingDown className="h-4 w-4 text-red-600" />
                )}
                <span
                  className={`text-sm font-medium ${
                    change.direction === 'up' ? 'text-green-600' : 'text-red-600'
                  }`}
                >
                  {change.direction === 'up' ? '+' : '-'}
                  {Math.abs(change.value)}%
                </span>
              </div>
            )}
          </div>
          {Icon && (
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center ml-4">
              <Icon className="h-6 w-6 text-primary" />
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

interface EngineStatusGridProps {
  engines: Array<{
    id: string;
    name: string;
    status: 'active' | 'idle' | 'error' | 'disabled';
    lastExecution?: string;
    averageTime?: number;
    successRate?: number;
  }>;
  loading?: boolean;
}

export function EngineStatusGrid({ engines, loading = false }: EngineStatusGridProps) {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800 border-green-300';
      case 'idle':
        return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'error':
        return 'bg-red-100 text-red-800 border-red-300';
      case 'disabled':
        return 'bg-gray-100 text-gray-800 border-gray-300';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active':
        return <Activity className="h-4 w-4" />;
      case 'error':
        return <AlertCircle className="h-4 w-4" />;
      case 'idle':
        return <CheckCircle className="h-4 w-4" />;
      default:
        return null;
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {loading ? (
        <div className="col-span-full text-center py-8 text-muted-foreground">
          Chargement des moteurs...
        </div>
      ) : engines.length === 0 ? (
        <div className="col-span-full text-center py-8 text-muted-foreground">
          Aucun moteur disponible
        </div>
      ) : (
        engines.map((engine) => (
          <Card key={engine.id}>
            <CardContent className="p-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-sm">{engine.name}</h3>
                  <div className={`flex items-center gap-1 px-2 py-1 rounded-full border text-xs font-medium ${getStatusColor(engine.status)}`}>
                    {getStatusIcon(engine.status)}
                    {engine.status}
                  </div>
                </div>

                {engine.lastExecution && (
                  <div className="text-xs text-muted-foreground">
                    Dernière: {engine.lastExecution}
                  </div>
                )}

                <div className="flex gap-4">
                  {engine.averageTime !== undefined && (
                    <div>
                      <p className="text-xs text-muted-foreground">Temps moyen</p>
                      <p className="text-sm font-semibold">{engine.averageTime}ms</p>
                    </div>
                  )}
                  {engine.successRate !== undefined && (
                    <div>
                      <p className="text-xs text-muted-foreground">Succès</p>
                      <p className="text-sm font-semibold">{engine.successRate}%</p>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}

interface GradeDistributionProps {
  distribution: Record<string, number>;
  total: number;
  loading?: boolean;
}

export function GradeDistribution({ distribution, total, loading = false }: GradeDistributionProps) {
  const gradeColors = {
    A: 'bg-green-500',
    B: 'bg-blue-500',
    C: 'bg-yellow-500',
    D: 'bg-orange-500',
    E: 'bg-red-500',
  };

  if (loading) {
    return <div className="text-center py-8 text-muted-foreground">Chargement...</div>;
  }

  return (
    <div className="space-y-4">
      {Object.entries(distribution).map(([grade, count]) => {
        const percentage = total > 0 ? (count / total) * 100 : 0;
        const colorClass = gradeColors[grade as keyof typeof gradeColors] || 'bg-gray-500';

        return (
          <div key={grade}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-medium">Grade {grade}</span>
              <span className="text-xs text-muted-foreground">
                {count} ({percentage.toFixed(1)}%)
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className={`${colorClass} h-2 rounded-full transition-all`}
                style={{ width: `${percentage}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

interface FraudDistributionProps {
  distribution: Record<string, number>;
  total: number;
  loading?: boolean;
}

export function FraudDistribution({ distribution, total, loading = false }: FraudDistributionProps) {
  const fraudColors = {
    low: 'bg-green-100 text-green-800 border-green-300',
    moderate: 'bg-yellow-100 text-yellow-800 border-yellow-300',
    high: 'bg-orange-100 text-orange-800 border-orange-300',
    critical: 'bg-red-100 text-red-800 border-red-300',
  };

  if (loading) {
    return <div className="text-center py-8 text-muted-foreground">Chargement...</div>;
  }

  return (
    <div className="grid grid-cols-2 gap-3">
      {Object.entries(distribution).map(([level, count]) => {
        const percentage = total > 0 ? (count / total) * 100 : 0;
        const colorClass = fraudColors[level as keyof typeof fraudColors] || 'bg-gray-100 text-gray-800 border-gray-300';

        return (
          <div
            key={level}
            className={`p-4 rounded-lg border text-center ${colorClass}`}
          >
            <div className="text-2xl font-bold">{count}</div>
            <div className="text-xs font-medium uppercase mt-1">{level}</div>
            <div className="text-xs opacity-75">{percentage.toFixed(1)}%</div>
          </div>
        );
      })}
    </div>
  );
}

interface RecentOrchestrationTableProps {
  orchestrations: Array<{
    id: string;
    projectId: string;
    finalGrade?: string;
    adaptiveScore?: number;
    fraudScore?: number;
    coherenceScore?: number;
    timestamp: string;
    duration?: number;
  }>;
  loading?: boolean;
}

export function RecentOrchestrationTable({
  orchestrations,
  loading = false,
}: RecentOrchestrationTableProps) {
  const getGradeColor = (grade?: string) => {
    switch (grade) {
      case 'A':
        return 'bg-green-100 text-green-800';
      case 'B':
        return 'bg-blue-100 text-blue-800';
      case 'C':
        return 'bg-yellow-100 text-yellow-800';
      case 'D':
        return 'bg-orange-100 text-orange-800';
      case 'E':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b">
            <th className="text-left py-3 px-4 font-semibold text-muted-foreground">Devis ID</th>
            <th className="text-left py-3 px-4 font-semibold text-muted-foreground">Grade</th>
            <th className="text-left py-3 px-4 font-semibold text-muted-foreground">Adaptatif</th>
            <th className="text-left py-3 px-4 font-semibold text-muted-foreground">Fraude</th>
            <th className="text-left py-3 px-4 font-semibold text-muted-foreground">Cohérence</th>
            <th className="text-left py-3 px-4 font-semibold text-muted-foreground">Durée</th>
            <th className="text-left py-3 px-4 font-semibold text-muted-foreground">Date</th>
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <tr>
              <td colSpan={7} className="text-center py-6 text-muted-foreground">
                Chargement...
              </td>
            </tr>
          ) : orchestrations.length === 0 ? (
            <tr>
              <td colSpan={7} className="text-center py-6 text-muted-foreground">
                Aucune orchestration récente
              </td>
            </tr>
          ) : (
            orchestrations.map((orch) => (
              <tr key={orch.id} className="border-b hover:bg-muted/50">
                <td className="py-3 px-4 font-mono text-xs">
                  {orch.projectId.substring(0, 8)}...
                </td>
                <td className="py-3 px-4">
                  {orch.finalGrade ? (
                    <Badge className={`${getGradeColor(orch.finalGrade)} font-bold`}>
                      {orch.finalGrade}
                    </Badge>
                  ) : (
                    <span className="text-muted-foreground">-</span>
                  )}
                </td>
                <td className="py-3 px-4">
                  {orch.adaptiveScore !== undefined
                    ? orch.adaptiveScore.toFixed(1)
                    : '-'}
                </td>
                <td className="py-3 px-4">
                  {orch.fraudScore !== undefined ? orch.fraudScore.toFixed(1) : '-'}
                </td>
                <td className="py-3 px-4">
                  {orch.coherenceScore !== undefined
                    ? orch.coherenceScore.toFixed(1)
                    : '-'}
                </td>
                <td className="py-3 px-4">
                  {orch.duration ? `${orch.duration}ms` : '-'}
                </td>
                <td className="py-3 px-4 text-xs text-muted-foreground">
                  {new Date(orch.timestamp).toLocaleString('fr-FR')}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
