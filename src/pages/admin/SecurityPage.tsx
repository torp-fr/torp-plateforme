/**
 * Security Page - Security management
 * Phase 32.2: Real data from platform health checks
 */

import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Shield, CheckCircle, AlertTriangle, Loader2 } from 'lucide-react';
import { analyticsService } from '@/services/api/analytics.service';
import { EmptyState } from '@/components/ui/EmptyState';
import { useToast } from '@/hooks/use-toast';

interface HealthStatus {
  database: string;
  api: string;
  storage: string;
  timestamp: string;
}

export function SecurityPage() {
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    const fetchHealth = async () => {
      try {
        setIsLoading(true);
        const data = await analyticsService.getPlatformHealth();
        setHealth(data);
        setError(null);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to fetch security status';
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
    const interval = setInterval(fetchHealth, 30000);
    return () => clearInterval(interval);
  }, [toast]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <EmptyState
        title="Impossible de charger les données"
        description={error}
      />
    );
  }

  const getStatusColor = (status: string) => {
    return status === 'operational'
      ? 'bg-green-100 text-green-800'
      : 'bg-red-100 text-red-800';
  };

  const getStatusLabel = (status: string) => {
    return status === 'operational' ? '✓ Secure' : '✗ Issue';
  };

  const getStatusIcon = (status: string) => {
    return status === 'operational' ? (
      <CheckCircle className="h-5 w-5 text-green-600" />
    ) : (
      <AlertTriangle className="h-5 w-5 text-red-600" />
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Security</h1>
        <p className="text-muted-foreground">Monitor and manage security settings</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Security Status
          </CardTitle>
          <CardDescription>
            Last checked: {health ? new Date(health.timestamp).toLocaleString() : 'N/A'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {health && (
              <>
                <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                  <span className="text-sm font-medium">Database Security</span>
                  <span
                    className={`inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(health.database)}`}
                  >
                    {getStatusIcon(health.database)}
                    {getStatusLabel(health.database)}
                  </span>
                </div>
                <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                  <span className="text-sm font-medium">API Security</span>
                  <span
                    className={`inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(health.api)}`}
                  >
                    {getStatusIcon(health.api)}
                    {getStatusLabel(health.api)}
                  </span>
                </div>
                <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                  <span className="text-sm font-medium">Storage Security</span>
                  <span
                    className={`inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(health.storage)}`}
                  >
                    {getStatusIcon(health.storage)}
                    {getStatusLabel(health.storage)}
                  </span>
                </div>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Security Features</CardTitle>
          <CardDescription>Platform security implementation</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              <div>
                <p className="text-sm font-medium">Row Level Security (RLS)</p>
                <p className="text-xs text-muted-foreground">Enabled on all tables</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              <div>
                <p className="text-sm font-medium">Encrypted Data Transport</p>
                <p className="text-xs text-muted-foreground">HTTPS/TLS enforced</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              <div>
                <p className="text-sm font-medium">Authentication</p>
                <p className="text-xs text-muted-foreground">Supabase Auth with JWT</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              <div>
                <p className="text-sm font-medium">No Mock Data in Production</p>
                <p className="text-xs text-muted-foreground">Phase 32.2 enforcement</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default SecurityPage;
