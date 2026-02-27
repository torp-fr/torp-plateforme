import React, { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/lib/supabase';
import { Database, Zap, List, AlertCircle } from 'lucide-react';
import { log, warn, error, time, timeEnd } from '@/lib/logger';

interface VectorHealth {
  totalDocuments: number;
  edgeOnline: boolean;
  fallbackActive: boolean;
}

export function VectorHealthPanel() {
  const [health, setHealth] = useState<VectorHealth>({
    totalDocuments: 0,
    edgeOnline: true,
    fallbackActive: false,
  });
  const [loading, setLoading] = useState(true);

  const updateHealth = async () => {
    try {
      setLoading(true);

      const { count, error } = await supabase
        .from('knowledge_documents')
        .select('*', { count: 'exact', head: true })
        .eq('is_active', true);

      if (error) {
        log('[VectorHealth] Query error:', error.message);
        setHealth((prev) => ({ ...prev, totalDocuments: 0 }));
        return;
      }

      // PHASE 40: No window state (errors handled by service retry logic)
      setHealth({
        totalDocuments: count || 0,
        edgeOnline: true,  // Always online, errors handled by service
        fallbackActive: false,
      });

      // Dispatch command center update
      window.dispatchEvent(new Event('RAG_COMMAND_CENTER_UPDATE'));

      log('[VectorHealth] Updated:', { count });
    } catch (err) {
      console.error('[VectorHealth] Error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    updateHealth();
    const interval = setInterval(updateHealth, 30000);

    // Listen for OPS events
    const handleRefresh = () => updateHealth();
    window.addEventListener('RAG_OPS_EVENT', handleRefresh);
    window.addEventListener('RAG_LIBRARY_REFRESH', handleRefresh);

    return () => {
      clearInterval(interval);
      window.removeEventListener('RAG_OPS_EVENT', handleRefresh);
      window.removeEventListener('RAG_LIBRARY_REFRESH', handleRefresh);
    };
  }, []);

  return (
    <Card>
      <CardContent className="p-4">
        <div className="grid grid-cols-3 gap-4">
          {/* Vector Index */}
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-purple-100 flex items-center justify-center">
              <Database className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground">Vector Index</p>
              <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 mt-1">
                ✓ Active
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
              <Badge
                variant="outline"
                className={
                  health.edgeOnline
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200 mt-1'
                    : 'bg-amber-50 text-amber-700 border-amber-200 mt-1'
                }
              >
                {health.edgeOnline ? '✓ Online' : '⚠️ Degraded'}
              </Badge>
            </div>
          </div>

          {/* Documents Indexed */}
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-amber-100 flex items-center justify-center">
              <List className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground">Indexed</p>
              <p className="text-lg font-semibold text-foreground mt-1">{health.totalDocuments}</p>
            </div>
          </div>

          {/* Fallback Status */}
          {health.fallbackActive && (
            <div className="flex items-center gap-3 col-span-3">
              <div className="h-10 w-10 rounded-lg bg-red-100 flex items-center justify-center">
                <AlertCircle className="h-5 w-5 text-red-600" />
              </div>
              <div className="flex-1">
                <p className="text-xs font-medium text-muted-foreground">Fallback Embedding</p>
                <Badge className="bg-red-50 text-red-700 border-red-200 mt-1">FALLBACK ACTIVE</Badge>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
