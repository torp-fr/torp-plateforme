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

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        setLoading(true);

        // Fetch document count and latest ingestion time
        const { data, error: countError } = await supabase
          .from('knowledge_documents')
          .select('id, created_at')
          .eq('is_active', true)
          .order('created_at', { ascending: false })
          .limit(1);

        if (countError) throw countError;

        // Count total documents
        const { count, error: totalError } = await supabase
          .from('knowledge_documents')
          .select('*', { count: 'exact', head: true })
          .eq('is_active', true);

        if (totalError) throw totalError;

        setStatus({
          totalDocuments: count || 0,
          lastIngestionTime: data?.[0]?.created_at || null,
          vectorStatus: count && count > 0 ? 'operational' : 'idle',
          embeddingEngine: 'active',
        });

        console.log('[RAG Status] Updated:', { count, lastIngestion: data?.[0]?.created_at });
      } catch (err) {
        console.error('[RAG Status] Error:', err);
        // Fail silently
      } finally {
        setLoading(false);
      }
    };

    fetchStatus();
    const interval = setInterval(fetchStatus, 30000); // Refresh every 30s
    return () => clearInterval(interval);
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
              <p className="text-xs font-medium text-muted-foreground">Vector Status</p>
              <Badge
                variant="outline"
                className={
                  status.vectorStatus === 'operational'
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : status.vectorStatus === 'idle'
                      ? 'bg-gray-50 text-gray-700 border-gray-200'
                      : 'bg-red-50 text-red-700 border-red-200'
                }
              >
                {status.vectorStatus === 'operational' ? '✓ Opérationnel' : 'Inactif'}
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
                {status.embeddingEngine === 'active' ? '✓ Actif' : 'Inactif'}
              </Badge>
            </div>
          </div>

          {/* Total Documents */}
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-amber-100 flex items-center justify-center">
              <Database className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground">Documents</p>
              <p className="text-lg font-semibold text-foreground">{status.totalDocuments}</p>
            </div>
          </div>

          {/* Last Ingestion */}
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-green-100 flex items-center justify-center">
              <Clock className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground">Dernière</p>
              <p className="text-xs font-medium text-foreground">
                {status.lastIngestionTime
                  ? new Date(status.lastIngestionTime).toLocaleTimeString('fr-FR')
                  : 'N/A'}
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
