import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { supabase } from '@/lib/supabase';
import { Loader2 } from 'lucide-react';

interface TimelineItem {
  id: string;
  title: string;
  created_at: string;
  category?: string;
}

export function RAGIngestionTimeline() {
  const [items, setItems] = useState<TimelineItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTimeline = async () => {
      try {
        setLoading(true);

        const { data, error } = await supabase
          .from('knowledge_documents')
          .select('id, title, created_at, category')
          .order('created_at', { ascending: false })
          .limit(10);

        if (error) {
          console.log('[RAG Timeline] Query error:', error.message);
          setItems([]);
          return;
        }

        setItems(data || []);
        console.log('[RAG Timeline] Loaded:', data?.length || 0);
      } catch (err) {
        console.error('[RAG Timeline] Error:', err);
        setItems([]);
      } finally {
        setLoading(false);
      }
    };

    fetchTimeline();
  }, []);

  const getProcessingState = (createdAt: string) => {
    const now = new Date();
    const created = new Date(createdAt);
    const minutes = (now.getTime() - created.getTime()) / (1000 * 60);

    if (minutes < 5) return { label: 'Processing', color: 'text-amber-600', dot: 'bg-amber-500' };
    return { label: 'Completed', color: 'text-green-600', dot: 'bg-green-500' };
  };

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

  if (items.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Timeline d'ingestion</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Aucune activité d'ingestion</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Timeline d'ingestion</CardTitle>
        <CardDescription>Activité chronologique des documents</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {items.map((item, idx) => {
            const state = getProcessingState(item.created_at);
            const safeCategory = item.category ?? 'général';

            return (
              <div key={item.id} className="flex gap-4">
                <div className="flex flex-col items-center">
                  <div className={`h-3 w-3 rounded-full ${state.dot} ring-4 ring-background`} />
                  {idx < items.length - 1 && <div className="h-12 w-0.5 bg-border/30 my-1" />}
                </div>
                <div className="flex-1 pt-1">
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-semibold ${state.color}`}>{state.label}</span>
                    <span className="text-xs text-muted-foreground/60">{safeCategory}</span>
                  </div>
                  <p className="text-sm font-medium text-foreground mt-1">{item.title ?? 'Document'}</p>
                  <p className="text-xs text-muted-foreground/60 mt-1">
                    {new Date(item.created_at).toLocaleString('fr-FR')}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
