import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/lib/supabase';
import { Loader2, Upload, Copy, Brain, Database } from 'lucide-react';

interface TimelineItem {
  id: string;
  title: string;
  created_at: string;
  category?: string;
}

interface PipelineState {
  upload: boolean;
  chunking: boolean;
  embedding: boolean;
  indexed: boolean;
}

export function RAGIngestionTimeline() {
  const [items, setItems] = useState<TimelineItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [pipelineState, setPipelineState] = useState<PipelineState>({
    upload: false,
    chunking: false,
    embedding: false,
    indexed: false,
  });

  const updatePipelineState = () => {
    // Derive pipeline state from window globals and local state
    const edgeOnline = !Boolean((window as any).RAG_EDGE_OFFLINE);
    const queueSubscribed = Boolean((window as any).RAG_QUEUE_SUBSCRIBED);
    const hasItems = items.length > 0;

    setPipelineState({
      upload: hasItems,
      chunking: hasItems && queueSubscribed,
      embedding: hasItems && edgeOnline,
      indexed: hasItems && edgeOnline,
    });

    console.log('[RAG Timeline] Pipeline state updated:', {
      upload: hasItems,
      chunking: hasItems && queueSubscribed,
      embedding: hasItems && edgeOnline,
      indexed: hasItems && edgeOnline,
    });
  };

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

  useEffect(() => {
    fetchTimeline();
  }, []);

  useEffect(() => {
    updatePipelineState();

    // Listen for command center updates
    const handleUpdate = () => updatePipelineState();
    window.addEventListener('RAG_COMMAND_CENTER_UPDATE', handleUpdate);
    window.addEventListener('RAG_OPS_EVENT', handleUpdate);
    window.addEventListener('RAG_LIBRARY_REFRESH', handleUpdate);

    return () => {
      window.removeEventListener('RAG_COMMAND_CENTER_UPDATE', handleUpdate);
      window.removeEventListener('RAG_OPS_EVENT', handleUpdate);
      window.removeEventListener('RAG_LIBRARY_REFRESH', handleUpdate);
    };
  }, [items]);

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

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Pipeline d'ingestion</CardTitle>
        <CardDescription>Flux de traitement du cerveau métier</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Pipeline Flow Visualizer */}
        <div className="bg-muted/30 p-4 rounded-lg">
          <p className="text-xs font-semibold text-muted-foreground mb-4">PIPELINE</p>
          <div className="flex items-center justify-between gap-2">
            {/* Upload Stage */}
            <div className="flex flex-col items-center gap-2 flex-1">
              <div
                className={`h-10 w-10 rounded-lg flex items-center justify-center transition-all ${
                  pipelineState.upload
                    ? 'bg-blue-100 text-blue-600'
                    : 'bg-gray-100 text-gray-400'
                }`}
              >
                <Upload className="h-5 w-5" />
              </div>
              <p className="text-xs font-medium text-center">Upload</p>
              {pipelineState.upload && (
                <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700">
                  ✓
                </Badge>
              )}
            </div>

            {/* Arrow */}
            <div className={`text-2xl ${pipelineState.chunking ? 'text-amber-500' : 'text-gray-300'}`}>
              →
            </div>

            {/* Chunking Stage */}
            <div className="flex flex-col items-center gap-2 flex-1">
              <div
                className={`h-10 w-10 rounded-lg flex items-center justify-center transition-all ${
                  pipelineState.chunking
                    ? 'bg-amber-100 text-amber-600'
                    : 'bg-gray-100 text-gray-400'
                }`}
              >
                <Copy className="h-5 w-5" />
              </div>
              <p className="text-xs font-medium text-center">Chunking</p>
              {pipelineState.chunking && (
                <Badge variant="outline" className="text-xs bg-amber-50 text-amber-700">
                  ⏳
                </Badge>
              )}
            </div>

            {/* Arrow */}
            <div className={`text-2xl ${pipelineState.embedding ? 'text-purple-500' : 'text-gray-300'}`}>
              →
            </div>

            {/* Embedding Stage */}
            <div className="flex flex-col items-center gap-2 flex-1">
              <div
                className={`h-10 w-10 rounded-lg flex items-center justify-center transition-all ${
                  pipelineState.embedding
                    ? 'bg-purple-100 text-purple-600'
                    : 'bg-gray-100 text-gray-400'
                }`}
              >
                <Brain className="h-5 w-5" />
              </div>
              <p className="text-xs font-medium text-center">Embedding</p>
              {pipelineState.embedding && (
                <Badge variant="outline" className="text-xs bg-purple-50 text-purple-700">
                  🧠
                </Badge>
              )}
            </div>

            {/* Arrow */}
            <div className={`text-2xl ${pipelineState.indexed ? 'text-green-500' : 'text-gray-300'}`}>
              →
            </div>

            {/* Indexed Stage */}
            <div className="flex flex-col items-center gap-2 flex-1">
              <div
                className={`h-10 w-10 rounded-lg flex items-center justify-center transition-all ${
                  pipelineState.indexed
                    ? 'bg-green-100 text-green-600'
                    : 'bg-gray-100 text-gray-400'
                }`}
              >
                <Database className="h-5 w-5" />
              </div>
              <p className="text-xs font-medium text-center">Indexed</p>
              {pipelineState.indexed && (
                <Badge variant="outline" className="text-xs bg-green-50 text-green-700">
                  ✓
                </Badge>
              )}
            </div>
          </div>
        </div>

        {/* Timeline Items */}
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucune activité d'ingestion</p>
        ) : (
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
        )}
      </CardContent>
    </Card>
  );
}
