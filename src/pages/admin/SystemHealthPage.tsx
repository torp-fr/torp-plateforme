/**
 * System Health Page - Admin Analytics
 * Displays system health metrics and monitoring
 * Phase 32.2: Real data from Supabase
 */

import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { AlertCircle, Loader2, Shield, CheckCircle } from 'lucide-react';
import { analyticsService } from '@/services/api/analytics.service';
import { EmptyState } from '@/components/ui/EmptyState';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';

interface HealthStatus {
  database: string;
  api: string;
  storage: string;
  timestamp: string;
}

export function SystemHealthPage() {
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    const fetchHealth = async () => {
      try {
        if (!health) setIsLoading(true);
        const healthData = await analyticsService.getPlatformHealth();
        setHealth(healthData);
        setError(null);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to fetch health metrics';
        setError(message);
        toast({
          title: 'Erreur',
          description: message,
          variant: 'destructive',
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchHealth();
    // Refresh every 30 seconds
    const interval = setInterval(fetchHealth, 30000);
    return () => clearInterval(interval);
  }, [toast]);

  if (error && !health) {
    return (
      <EmptyState
        title="Impossible de charger les métriques"
        description={error || 'Les données de santé système ne sont pas disponibles'}
      />
    );
  }

  const getStatusColor = (status: string) => {
    return status === 'operational'
      ? 'bg-green-100 text-green-800'
      : 'bg-red-100 text-red-800';
  };

  const getStatusLabel = (status: string) => {
    return status === 'operational' ? '✓ Opérationnel' : '✗ Erreur';
  };

  if (!health && isLoading) {
    return (
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-foreground">Santé & Sécurité Système</h1>
          <p className="text-muted-foreground">État du système et contrôles de sécurité de la plateforme</p>
        </div>

        {/* Skeleton Loader */}
        <Card>
          <CardHeader className="space-y-2">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-40" />
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-6 w-24" />
            </div>
            <div className="flex items-center justify-between">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-6 w-24" />
            </div>
            <div className="flex items-center justify-between">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-6 w-24" />
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!health) {
    return (
      <EmptyState
        title="Aucune donnée disponible"
        description="Les données de santé système ne sont pas disponibles"
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Santé & Sécurité Système</h1>
          <p className="text-muted-foreground">État du système et contrôles de sécurité de la plateforme</p>
        </div>
        {isLoading && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Actualisation...</span>
          </div>
        )}
      </div>

      {/* Status Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5" />
            Status Overview
          </CardTitle>
          <CardDescription>
            Last updated: {new Date(health.timestamp).toLocaleString()}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Database</span>
              <span
                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(health.database)}`}
              >
                {getStatusLabel(health.database)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">API Server</span>
              <span
                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(health.api)}`}
              >
                {getStatusLabel(health.api)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">File Storage</span>
              <span
                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(health.storage)}`}
              >
                {getStatusLabel(health.storage)}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Security Controls */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Contrôles de Sécurité
          </CardTitle>
          <CardDescription>État des mécanismes de sécurité de la plateforme</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[
              { name: 'Row Level Security (RLS)', detail: 'Activé sur toutes les tables' },
              { name: 'Chiffrement Transport (HTTPS/TLS)', detail: 'Enforced' },
              { name: 'Authentification JWT', detail: 'Supabase Auth' },
              { name: 'Contrôle d\'accès (RBAC)', detail: 'Rôles user / admin / super_admin' },
            ].map(ctrl => (
              <div key={ctrl.name} className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium">{ctrl.name}</p>
                  <p className="text-xs text-muted-foreground">{ctrl.detail}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default SystemHealthPage;
