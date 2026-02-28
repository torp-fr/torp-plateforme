import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/lib/supabase';
import { Loader2 } from 'lucide-react';

interface IngestionMetrics {
  total_jobs: number;
  completed_jobs: number;
  in_progress_jobs: number;
  failed_jobs: number;
  average_progress: number;
}

export function IngestionMetricsPanel() {
  const [metrics, setMetrics] = useState<IngestionMetrics | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchMetrics = async () => {
    try {
      setLoading(true);

      // Fetch ingestion jobs statistics
      const { data: jobs, error: jobsError } = await supabase
        .from('ingestion_jobs')
        .select('id, status, progress');

      if (jobsError || !jobs) {
        setMetrics({
          total_jobs: 0,
          completed_jobs: 0,
          in_progress_jobs: 0,
          failed_jobs: 0,
          average_progress: 0,
        });
        return;
      }

      const metrics = {
        total_jobs: jobs.length,
        completed_jobs: jobs.filter(j => j.status === 'completed').length,
        in_progress_jobs: jobs.filter(j => j.status === 'embedding_in_progress').length,
        failed_jobs: jobs.filter(j => j.status === 'failed').length,
        average_progress: jobs.length > 0
          ? Math.round(jobs.reduce((sum, j) => sum + (j.progress || 0), 0) / jobs.length)
          : 0,
      };

      setMetrics(metrics);
    } catch (err) {
      console.error('[IngestionMetrics] Error:', err);
      setMetrics({
        total_jobs: 0,
        completed_jobs: 0,
        in_progress_jobs: 0,
        failed_jobs: 0,
        average_progress: 0,
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMetrics();
    const interval = setInterval(fetchMetrics, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, []);

  if (loading || !metrics) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm">Chargement des métriques...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Métriques d'Ingestion</CardTitle>
        <CardDescription>Statuts des jobs d'ingestion du pipeline</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-4 gap-4">
          {/* Total Jobs */}
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">Total</p>
            <p className="text-2xl font-bold">{metrics.total_jobs}</p>
            <Badge variant="outline">Jobs</Badge>
          </div>

          {/* Completed */}
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">Complétés</p>
            <p className="text-2xl font-bold text-green-600">{metrics.completed_jobs}</p>
            <Badge className="bg-green-50 text-green-700 border-green-200">✓ OK</Badge>
          </div>

          {/* In Progress */}
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">En cours</p>
            <p className="text-2xl font-bold text-blue-600">{metrics.in_progress_jobs}</p>
            <Badge className="bg-blue-50 text-blue-700 border-blue-200">⏳ Actif</Badge>
          </div>

          {/* Failed */}
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">Échoués</p>
            <p className="text-2xl font-bold text-red-600">{metrics.failed_jobs}</p>
            <Badge className="bg-red-50 text-red-700 border-red-200">✗ Erreur</Badge>
          </div>
        </div>

        {/* Average Progress */}
        <div className="mt-6 pt-6 border-t">
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">Progression moyenne</p>
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-500 transition-all duration-300"
                    style={{ width: `${metrics.average_progress}%` }}
                  />
                </div>
              </div>
              <p className="text-lg font-bold min-w-fit">{metrics.average_progress}%</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
