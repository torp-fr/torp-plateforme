/**
 * Live Intelligence Page - Real-time analytics
 * Phase 32.2: Real data from Supabase
 */

import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { TrendingUp, Users, FileText, Loader2 } from 'lucide-react';
import { analyticsService } from '@/services/api/analytics.service';
import { EmptyState } from '@/components/ui/EmptyState';
import { useToast } from '@/hooks/use-toast';

interface GlobalStats {
  userCount: number;
  analysisCount: number;
  analysisLast30: number;
  growth: string;
}

export function LiveIntelligencePage() {
  const [stats, setStats] = useState<GlobalStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    const fetchStats = async () => {
      try {
        setIsLoading(true);
        const data = await analyticsService.getGlobalStats();
        setStats(data);
        setError(null);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to fetch statistics';
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

    fetchStats();
    // Refresh every 60 seconds
    const interval = setInterval(fetchStats, 60000);
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

  if (!stats) {
    return (
      <EmptyState
        title="Aucune donnée disponible"
        description="Les données apparaîtront ici lorsque le système sera utilisé"
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-foreground">Live Intelligence</h1>
        <p className="text-muted-foreground">Real-time platform analytics and insights</p>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.userCount.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">Platform users</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Analyses Completed</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.analysisCount.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">All time</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Analyses (30d)</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.analysisLast30.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">Last month</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Growth</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.growth}</div>
            <p className="text-xs text-muted-foreground">vs previous month</p>
          </CardContent>
        </Card>
      </div>

      {/* Activity Info */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
          <CardDescription>Latest platform events</CardDescription>
        </CardHeader>
        <CardContent>
          <EmptyState
            title="No activity yet"
            description="Platform activity will appear here as users interact with the system"
          />
        </CardContent>
      </Card>
    </div>
  );
}

export default LiveIntelligencePage;
