import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/lib/supabase';
import { Loader2 } from 'lucide-react';
import { log, warn, error, time, timeEnd } from '@/lib/logger';

interface QueueItem {
  id: string;
  title: string;
  status?: string; // Status from ingestion_jobs
  created_at: string;
}

export function EmbeddingQueuePanel() {
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchQueue = async () => {
    try {
      setLoading(true);
      setError(null);

      // NOTE: Ingestion status is now tracked in ingestion_jobs table
      // Fetch pending/processing jobs with their document titles
      const { data, error: dbError } = await supabase
        .from('ingestion_jobs')
        .select('id, file_name:file_name, status, created_at')
        .in('status', ['chunk_preview_ready', 'embedding_in_progress'])
        .order('created_at', { ascending: false })
        .limit(5);

      if (dbError) {

        setQueue([]);
        return;
      }

      // Map ingestion_jobs data to QueueItem format
      const mappedData = (data || []).map(item => ({
        id: item.id,
        title: item.file_name || `Job ${item.id.substring(0, 8)}`,
        status: item.status,
        created_at: item.created_at
      }));
      setQueue(mappedData);

      // Dispatch OPS event for other components
      window.dispatchEvent(new Event('RAG_OPS_EVENT'));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch queue';
      console.error('[EmbeddingQueue] Error:', message);
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // PHASE 40: No global state needed
    // React's useEffect cleanup handles unsubscription
    fetchQueue();
    const interval = setInterval(fetchQueue, 10000);

    // Listen for refresh events
    const handleRefresh = () => fetchQueue();
    window.addEventListener('RAG_LIBRARY_REFRESH', handleRefresh);
    window.addEventListener('RAG_RETRY_REQUESTED', handleRefresh);

    return () => {
      clearInterval(interval);
      window.removeEventListener('RAG_LIBRARY_REFRESH', handleRefresh);
      window.removeEventListener('RAG_RETRY_REQUESTED', handleRefresh);
    };
  }, []);

  const getStatusColor = (status?: string) => {
    if (!status || status === 'completed') return 'bg-green-50 text-green-700 border-green-200';
    if (status === 'embedding_in_progress') return 'bg-blue-50 text-blue-700 border-blue-200';
    if (status === 'failed') return 'bg-red-50 text-red-700 border-red-200';
    if (status === 'chunk_preview_ready') return 'bg-amber-50 text-amber-700 border-amber-200';
    return 'bg-gray-50 text-gray-700 border-gray-200';
  };

  const getStatusLabel = (status?: string) => {
    if (!status || status === 'completed') return '✓ Complété';
    if (status === 'embedding_in_progress') return '⏳ Génération embeddings';
    if (status === 'failed') return '✗ Erreur';
    if (status === 'chunk_preview_ready') return '⏳ Prêt à traiter';
    if (status === 'analysed') return '⏳ Analysé';
    return '⏳ En attente';
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm">Chargement...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg">Queue d'embedding</CardTitle>
            <CardDescription>Documents en attente de vectorisation</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {error ? (
          <p className="text-sm text-destructive">{error}</p>
        ) : queue.length === 0 ? (
          <div className="flex items-center gap-2 p-4 rounded-lg bg-green-50 border border-green-200/50">
            <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
            <p className="text-sm text-green-700">Queue vide — Tous les documents sont traités</p>
          </div>
        ) : (
          <div className="space-y-2">
            {queue.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between p-3 rounded-lg border border-border/50 hover:border-border/100 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{item.title ?? 'Document'}</p>
                  <p className="text-xs text-muted-foreground/60">
                    {new Date(item.created_at).toLocaleString('fr-FR')}
                  </p>
                </div>
                <Badge variant="outline" className={getStatusColor(item.status)}>
                  {getStatusLabel(item.status)}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
