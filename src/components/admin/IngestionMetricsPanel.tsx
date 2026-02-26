import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/lib/supabase';
import { TrendingUp, Calendar, Clock } from 'lucide-react';
import { Loader2 } from 'lucide-react';
import { log, warn, error, time, timeEnd } from '@/lib/logger';

interface Metrics {
  totalDocuments: number;
  last24hCount: number;
  last7dCount: number;
}

export function IngestionMetricsPanel() {
  const [metrics, setMetrics] = useState<Metrics>({
    totalDocuments: 0,
    last24hCount: 0,
    last7dCount: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        setLoading(true);

        const now = new Date();
        const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
        const last7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

        // Total documents
        const { count: totalCount, error: totalError } = await supabase
          .from('knowledge_documents')
          .select('*', { count: 'exact', head: true })
          .eq('is_active', true);

        if (totalError) throw totalError;

        // Last 24h
        const { count: count24h, error: error24h } = await supabase
          .from('knowledge_documents')
          .select('*', { count: 'exact', head: true })
          .eq('is_active', true)
          .gt('created_at', last24h);

        if (error24h) throw error24h;

        // Last 7d
        const { count: count7d, error: error7d } = await supabase
          .from('knowledge_documents')
          .select('*', { count: 'exact', head: true })
          .eq('is_active', true)
          .gt('created_at', last7d);

        if (error7d) throw error7d;

        setMetrics({
          totalDocuments: totalCount || 0,
          last24hCount: count24h || 0,
          last7dCount: count7d || 0,
        });

        log('[Ingestion Metrics] Total:', totalCount, '| 24h:', count24h, '| 7d:', count7d);
      } catch (err) {
        console.error('[Ingestion Metrics] Error:', err);
        // Fail silently
      } finally {
        setLoading(false);
      }
    };

    fetchMetrics();
  }, []);

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Métriques d'ingestion</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 gap-4">
          {/* Total Documents */}
          <div className="p-4 rounded-lg border border-border/50 bg-gradient-to-br from-blue-50/30 to-blue-100/10">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="h-4 w-4 text-blue-600" />
              <p className="text-xs font-medium text-muted-foreground">Total</p>
            </div>
            <p className="text-2xl font-bold text-foreground">{metrics.totalDocuments}</p>
            <p className="text-xs text-muted-foreground/60 mt-1">documents ingérés</p>
          </div>

          {/* Last 24h */}
          <div className="p-4 rounded-lg border border-border/50 bg-gradient-to-br from-emerald-50/30 to-emerald-100/10">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="h-4 w-4 text-emerald-600" />
              <p className="text-xs font-medium text-muted-foreground">24h</p>
            </div>
            <p className="text-2xl font-bold text-foreground">{metrics.last24hCount}</p>
            <p className="text-xs text-muted-foreground/60 mt-1">dernières 24 heures</p>
          </div>

          {/* Last 7d */}
          <div className="p-4 rounded-lg border border-border/50 bg-gradient-to-br from-purple-50/30 to-purple-100/10">
            <div className="flex items-center gap-2 mb-2">
              <Calendar className="h-4 w-4 text-purple-600" />
              <p className="text-xs font-medium text-muted-foreground">7j</p>
            </div>
            <p className="text-2xl font-bold text-foreground">{metrics.last7dCount}</p>
            <p className="text-xs text-muted-foreground/60 mt-1">derniers 7 jours</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
