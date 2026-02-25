import React, { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/lib/supabase';
import { Database, Zap, List } from 'lucide-react';

interface VectorHealth {
  totalDocuments: number;
  edgeOnline: boolean;
}

export function VectorHealthPanel() {
  const [health, setHealth] = useState<VectorHealth>({
    totalDocuments: 0,
    edgeOnline: true,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchHealth = async () => {
      try {
        setLoading(true);

        const { count, error } = await supabase
          .from('knowledge_documents')
          .select('*', { count: 'exact', head: true })
          .eq('is_active', true);

        if (error) {
          console.log('[Vector Health] Query error:', error.message);
          setHealth((prev) => ({ ...prev, totalDocuments: 0 }));
          return;
        }

        const edgeOnline = !window.__RAG_EDGE_OFFLINE__;

        setHealth({
          totalDocuments: count || 0,
          edgeOnline,
        });

        console.log('[Vector Health] Updated:', { count, edgeOnline });
      } catch (err) {
        console.error('[Vector Health] Error:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchHealth();
    const interval = setInterval(fetchHealth, 30000);
    return () => clearInterval(interval);
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
                    : 'bg-red-50 text-red-700 border-red-200 mt-1'
                }
              >
                {health.edgeOnline ? '✓ Online' : '✗ Fallback'}
              </Badge>
            </div>
          </div>

          {/* Documents */}
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-amber-100 flex items-center justify-center">
              <List className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground">Indexed</p>
              <p className="text-lg font-semibold text-foreground mt-1">{health.totalDocuments}</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
