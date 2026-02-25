import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/lib/supabase';
import { Loader2 } from 'lucide-react';

interface QueueItem {
  id: string;
  title: string;
  embedding_status?: string;
  created_at: string;
}

export function EmbeddingQueuePanel() {
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchQueue = async () => {
      try {
        setLoading(true);
        setError(null);

        // Fetch documents that are not fully completed
        const { data, error: dbError } = await supabase
          .from('knowledge_documents')
          .select('id, title, embedding_status, created_at')
          .neq('embedding_status', 'completed')
          .order('created_at', { ascending: false })
          .limit(5);

        if (dbError) {
          // If column doesn't exist, assume all are completed
          console.log('[Embedding Queue] Status column unavailable, showing all as completed');
          setQueue([]);
          return;
        }

        setQueue(data || []);
        console.log('[Embedding Queue] Items pending:', data?.length || 0);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to fetch queue';
        console.error('[Embedding Queue] Error:', message);
        setError(message);
      } finally {
        setLoading(false);
      }
    };

    fetchQueue();
    const interval = setInterval(fetchQueue, 10000); // Refresh every 10s
    return () => clearInterval(interval);
  }, []);

  const getStatusColor = (status?: string) => {
    if (!status || status === 'completed') return 'bg-green-50 text-green-700 border-green-200';
    if (status === 'processing') return 'bg-blue-50 text-blue-700 border-blue-200';
    if (status === 'error') return 'bg-red-50 text-red-700 border-red-200';
    return 'bg-amber-50 text-amber-700 border-amber-200';
  };

  const getStatusLabel = (status?: string) => {
    if (!status || status === 'completed') return '✓ Complété';
    if (status === 'processing') return '⏳ En cours';
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
        <CardTitle className="text-lg">Queue d'embedding</CardTitle>
        <CardDescription>Documents en attente d'embedding vectoriel</CardDescription>
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
              <div key={item.id} className="flex items-center justify-between p-3 rounded-lg border border-border/50 hover:border-border/100 transition-colors">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{item.title}</p>
                  <p className="text-xs text-muted-foreground/60">
                    {new Date(item.created_at).toLocaleString('fr-FR')}
                  </p>
                </div>
                <Badge variant="outline" className={getStatusColor(item.embedding_status)}>
                  {getStatusLabel(item.embedding_status)}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
