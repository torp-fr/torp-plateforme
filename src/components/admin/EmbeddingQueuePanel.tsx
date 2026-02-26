import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/lib/supabase';
import { Loader2 } from 'lucide-react';

interface QueueItem {
  id: string;
  title: string;
  ingestion_status?: string;
  created_at: string;
}

export function EmbeddingQueuePanel() {
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [embeddingPaused, setEmbeddingPaused] = useState(false);

  const fetchQueue = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data, error: dbError } = await supabase
        .from('knowledge_documents')
        .select('id, title, ingestion_status, created_at')
        .neq('ingestion_status', 'completed')
        .order('created_at', { ascending: false })
        .limit(5);

      if (dbError) {
        console.log('[EmbeddingQueue] Status column unavailable');
        setQueue([]);
        return;
      }

      setQueue(data || []);
      console.log('[EmbeddingQueue] Pending:', data?.length || 0);

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
    // Prevent duplicate subscription
    if (window.__RAG_QUEUE_SUBSCRIBED__) {
      console.log('[EmbeddingQueue] Subscription already active');
      return;
    }
    window.__RAG_QUEUE_SUBSCRIBED__ = true;

    fetchQueue();
    const interval = setInterval(fetchQueue, 10000);

    // Listen for refresh events
    const handleRefresh = () => fetchQueue();
    window.addEventListener('RAG_LIBRARY_REFRESH', handleRefresh);
    window.addEventListener('RAG_RETRY_REQUESTED', handleRefresh);

    // PHASE 8: Listen for embedding pause/resume
    const handlePause = () => {
      console.log('[EmbeddingQueue] Embedding paused');
      setEmbeddingPaused(true);
    };
    const handleResume = () => {
      console.log('[EmbeddingQueue] Embedding resumed');
      setEmbeddingPaused(false);
      fetchQueue();
    };
    window.addEventListener('RAG_EMBEDDING_PAUSED', handlePause);
    window.addEventListener('RAG_EMBEDDING_RESUMED', handleResume);

    return () => {
      clearInterval(interval);
      window.removeEventListener('RAG_LIBRARY_REFRESH', handleRefresh);
      window.removeEventListener('RAG_RETRY_REQUESTED', handleRefresh);
      window.removeEventListener('RAG_EMBEDDING_PAUSED', handlePause);
      window.removeEventListener('RAG_EMBEDDING_RESUMED', handleResume);
      window.__RAG_QUEUE_SUBSCRIBED__ = false;
    };
  }, []);

  const getStatusColor = (status?: string) => {
    if (!status || status === 'completed') return 'bg-green-50 text-green-700 border-green-200';
    if (status === 'processing') return 'bg-blue-50 text-blue-700 border-blue-200';
    if (status === 'error') return 'bg-red-50 text-red-700 border-red-200';
    return 'bg-amber-50 text-amber-700 border-amber-200';
  };

  const getStatusLabel = (status?: string) => {
    if (!status || status === 'completed') return '✓ Complété';
    if (status === 'processing') return '⏳ Traitement';
    if (status === 'error') return '✗ Erreur';
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
          {embeddingPaused && (
            <Badge className="bg-amber-100 text-amber-700 border-amber-200">
              ⏸️ PAUSED
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {embeddingPaused && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200/50 mb-4">
            <p className="text-sm text-amber-700">Embedding pipeline is paused. Waiting for edge recovery...</p>
          </div>
        )}
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
                <Badge variant="outline" className={getStatusColor(item.ingestion_status)}>
                  {getStatusLabel(item.ingestion_status)}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
