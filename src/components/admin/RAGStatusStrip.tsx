import React, { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/lib/supabase';
import { Brain, Zap, Database, Clock } from 'lucide-react';
import { Loader2 } from 'lucide-react';
import { log, warn, error, time, timeEnd } from '@/lib/logger';

interface RAGStatus {
  totalDocuments: number;
  lastIngestionTime: string | null;
  vectorStatus: 'operational' | 'idle' | 'error';
  embeddingEngine: 'active' | 'idle' | 'paused';
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
  const [bigDocMode, setBigDocMode] = useState(false);
  const [pipelineLocked, setPipelineLocked] = useState(false);
  const [streamMode, setStreamMode] = useState(false);
  const [adaptiveLevel, setAdaptiveLevel] = useState<'FAST' | 'NORMAL' | 'SAFE' | 'CRITICAL'>('NORMAL');
  const [predictedRisk, setPredictedRisk] = useState<'LOW' | 'MEDIUM' | 'HIGH'>('LOW');

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

      // PHASE 8: Check if embedding is paused
      const isEmbeddingPaused = Boolean((window as any).__RAG_EMBEDDING_PAUSED__);
      const embeddingEngine = isEmbeddingPaused ? 'paused' : 'active';

      setStatus({
        totalDocuments: count || 0,
        lastIngestionTime: data?.[0]?.created_at || null,
        vectorStatus: count && count > 0 ? 'operational' : 'idle',
        embeddingEngine,
      });

      // Dispatch command center update
      window.dispatchEvent(new Event('RAG_COMMAND_CENTER_UPDATE'));

      log('[RAGStatus] Updated:', { count, edgeOnline: isEdgeOnline });
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

    // PHASE 8: Listen for embedding pause/resume events
    const handleEmbeddingPause = () => {
      log('[RAGStatusStrip] Embedding paused');
      fetchStatus();
    };
    const handleEmbeddingResume = () => {
      log('[RAGStatusStrip] Embedding resumed');
      fetchStatus();
    };
    window.addEventListener('RAG_EMBEDDING_PAUSED', handleEmbeddingPause);
    window.addEventListener('RAG_EMBEDDING_RESUMED', handleEmbeddingResume);

    // PHASE 9: Listen for big document mode events
    const handleBigDocActivated = () => {
      log('[RAGStatusStrip] Big doc mode activated');
      setBigDocMode(true);
    };
    const handleBigDocCleared = () => {
      log('[RAGStatusStrip] Big doc mode cleared');
      setBigDocMode(false);
    };
    window.addEventListener('RAG_BIG_DOC_MODE_ACTIVATED', handleBigDocActivated);
    window.addEventListener('RAG_BIG_DOC_MODE_CLEARED', handleBigDocCleared);

    // PHASE 10: Listen for pipeline lock events
    const handlePipelineLocked = () => {
      log('[RAGStatusStrip] Pipeline locked');
      setPipelineLocked(true);
    };
    const handlePipelineUnlocked = () => {
      log('[RAGStatusStrip] Pipeline unlocked');
      setPipelineLocked(false);
    };
    window.addEventListener('RAG_PIPELINE_LOCKED', handlePipelineLocked);
    window.addEventListener('RAG_PIPELINE_UNLOCKED', handlePipelineUnlocked);

    // PHASE 11: Listen for stream mode events
    const handleStreamModeActivated = () => {
      log('[RAGStatusStrip] Stream mode activated');
      setStreamMode(true);
    };
    const handleStreamModeCleared = () => {
      log('[RAGStatusStrip] Stream mode cleared');
      setStreamMode(false);
    };
    window.addEventListener('RAG_STREAM_MODE_ACTIVATED', handleStreamModeActivated);
    window.addEventListener('RAG_STREAM_MODE_CLEARED', handleStreamModeCleared);

    // PHASE 12: Listen for adaptive stream controller updates
    const handleStreamControllerUpdated = () => {
      const controller = (window as any).__RAG_STREAM_CONTROLLER__ || {};
      const predictor = (window as any).__RAG_LATENCY_PREDICTOR__ || {};
      setAdaptiveLevel(controller.adaptiveLevel || 'NORMAL');
      setPredictedRisk(predictor.predictedRisk || 'LOW');
    };
    window.addEventListener('RAG_STREAM_CONTROLLER_UPDATED', handleStreamControllerUpdated);

    // PHASE 17: Listen for document lock events
    window.addEventListener('RAG_DOC_LOCKED', fetchStatus);
    window.addEventListener('RAG_DOC_UNLOCKED', fetchStatus);

    return () => {
      clearInterval(interval);
      window.removeEventListener('RAG_OPS_EVENT', handleOpsEvent);
      window.removeEventListener('RAG_LIBRARY_REFRESH', handleOpsEvent);
      window.removeEventListener('RAG_EMBEDDING_PAUSED', handleEmbeddingPause);
      window.removeEventListener('RAG_EMBEDDING_RESUMED', handleEmbeddingResume);
      window.removeEventListener('RAG_BIG_DOC_MODE_ACTIVATED', handleBigDocActivated);
      window.removeEventListener('RAG_BIG_DOC_MODE_CLEARED', handleBigDocCleared);
      window.removeEventListener('RAG_PIPELINE_LOCKED', handlePipelineLocked);
      window.removeEventListener('RAG_PIPELINE_UNLOCKED', handlePipelineUnlocked);
      window.removeEventListener('RAG_STREAM_MODE_ACTIVATED', handleStreamModeActivated);
      window.removeEventListener('RAG_STREAM_MODE_CLEARED', handleStreamModeCleared);
      window.removeEventListener('RAG_STREAM_CONTROLLER_UPDATED', handleStreamControllerUpdated);
      window.removeEventListener('RAG_DOC_LOCKED', fetchStatus);
      window.removeEventListener('RAG_DOC_UNLOCKED', fetchStatus);
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
            <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${
              pipelineLocked
                ? 'bg-red-100'
                : status.embeddingEngine === 'paused'
                  ? 'bg-amber-100'
                  : adaptiveLevel === 'CRITICAL'
                    ? 'bg-red-100'
                    : streamMode
                      ? 'bg-cyan-100'
                      : 'bg-blue-100'
            }`}>
              <Zap className={`h-5 w-5 ${
                pipelineLocked
                  ? 'text-red-600'
                  : status.embeddingEngine === 'paused'
                    ? 'text-amber-600'
                    : adaptiveLevel === 'CRITICAL'
                      ? 'text-red-600'
                      : streamMode
                        ? 'text-cyan-600'
                        : 'text-blue-600'
              }`} />
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground">Engine</p>
              <Badge
                variant="outline"
                className={
                  pipelineLocked
                    ? 'bg-red-50 text-red-700 border-red-200'
                    : status.embeddingEngine === 'paused'
                      ? 'bg-amber-50 text-amber-700 border-amber-200'
                      : adaptiveLevel === 'CRITICAL'
                        ? 'bg-red-50 text-red-700 border-red-200'
                        : predictedRisk === 'HIGH'
                          ? 'bg-red-50 text-red-700 border-red-200'
                          : streamMode && adaptiveLevel === 'SAFE'
                            ? 'bg-orange-50 text-orange-700 border-orange-200'
                            : streamMode
                              ? 'bg-cyan-50 text-cyan-700 border-cyan-200'
                              : bigDocMode
                                ? 'bg-purple-50 text-purple-700 border-purple-200'
                                : edgeOnline
                                  ? 'bg-blue-50 text-blue-700 border-blue-200'
                                  : 'bg-red-50 text-red-700 border-red-200'
                }
              >
                {pipelineLocked
                  ? '🔒 Locked'
                  : status.embeddingEngine === 'paused'
                    ? '⏸️ Paused'
                    : adaptiveLevel === 'CRITICAL'
                      ? '🔴 Critical'
                      : predictedRisk === 'HIGH'
                        ? '🔮 High Risk'
                        : streamMode && adaptiveLevel === 'SAFE'
                          ? '⚠️ Adaptive Safe'
                          : streamMode
                            ? '🌊 Streaming'
                            : bigDocMode
                              ? '⚡ Throttled'
                              : edgeOnline
                                ? '✓ Online'
                                : '⚠️ Fallback'}
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
