import React, { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/lib/supabase';
import { Brain, Zap, Database, Clock } from 'lucide-react';
import { Loader2 } from 'lucide-react';

interface RAGStatus {
  totalDocuments: number;
  lastIngestionTime: string | null;
  vectorStatus: 'operational' | 'idle' | 'error';
  embeddingEngine: 'active' | 'idle';
}

export function RAGStatusStrip() {
  const [status, setStatus] = useState<RAGStatus>({
    totalDocuments: 0,
    lastIngestionTime: null,
    vectorStatus: 'operational',
    embeddingEngine: 'active',
  });
  const [loading, setLoading] = useState(true);
  const [edgeOnline, setEdgeOnline] = useState(true);

  const fetchStatus = async () => {
    try {
      setLoading(true);

      const { data, error: countError } = await supabase
        .from('knowledge_documents')
        .select('id, created_at')
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1);

      if (countError) throw countError;

      const { count, error: totalError } = await supabase
        .from('knowledge_documents')
        .select('*', { count: 'exact', head: true })
        .eq('is_active', true);

      if (totalError) throw totalError;

      const isEdgeOnline = !window.__RAG_EDGE_OFFLINE__;
      setEdgeOnline(isEdgeOnline);

      setStatus({
        totalDocuments: count || 0,
        lastIngestionTime: data?.[0]?.created_at || null,
        vectorStatus: count && count > 0 ? 'operational' : 'idle',
        embeddingEngine: 'active',
      });

      console.log('[RAGStatus] Updated:', { count, edgeOnline: isEdgeOnline });
    } catch (err) {
      console.error('[RAGStatus] Error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 30000);

    // Listen for OPS events
    const handleOpsEvent = () => fetchStatus();
    window.addEventListener('RAG_OPS_EVENT', handleOpsEvent);
    window.addEventListener('RAG_LIBRARY_REFRESH', handleOpsEvent);

    return () => {
      clearInterval(interval);
      window.removeEventListener('RAG_OPS_EVENT', handleOpsEvent);
      window.removeEventListener('RAG_LIBRARY_REFRESH', handleOpsEvent);
    };
  }, []);

  if (loading) {
    return (
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {/* Vector Status */}
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-purple-100 flex items-center justify-center">
              <Brain className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground">Vector</p>
              <Badge
                variant="outline"
                className={
                  status.vectorStatus === 'operational'
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : 'bg-gray-50 text-gray-700 border-gray-200'
                }
              >
                {status.vectorStatus === 'operational' ? '✓ Active' : 'Idle'}
              </Badge>
            </div>
          </div>

          {/* Embedding Engine */}
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-blue-100 flex items-center justify-center">
              <Zap className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground">Engine</p>
              <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                {edgeOnline ? '✓ Online' : '⚠️ Fallback'}
              </Badge>
            </div>
          </div>

          {/* Total Documents */}
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-amber-100 flex items-center justify-center">
              <Database className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground">Indexed</p>
              <p className="text-lg font-semibold text-foreground">{status.totalDocuments}</p>
            </div>
          </div>

          {/* Last Ingestion */}
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-green-100 flex items-center justify-center">
              <Clock className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground">Last</p>
              <p className="text-xs font-medium text-foreground">
                {status.lastIngestionTime
                  ? new Date(status.lastIngestionTime).toLocaleTimeString('fr-FR')
                  : 'N/A'}
              </p>
            </div>
          </div>

          {/* Edge Status */}
          {!edgeOnline && (
            <div className="flex items-center gap-3 md:col-span-2">
              <div className="h-10 w-10 rounded-lg bg-red-100 flex items-center justify-center">
                <Zap className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground">Edge Function</p>
                <Badge variant="destructive">OFFLINE - Fallback Active</Badge>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
