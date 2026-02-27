import React, { useEffect, useState, useRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, Zap, Activity } from 'lucide-react';
import { log, warn, error, time, timeEnd } from '@/lib/logger';

interface CommandState {
  orchestratorState: 'ACTIVE' | 'DEGRADED' | 'FALLBACK';
  heartbeat: 'beating' | 'stale';
  lastEventTime: number | null;
  bigDocMode: boolean;
  lockedDocCount: number;
  streamMode: boolean;
  adaptiveLevel: 'FAST' | 'NORMAL' | 'SAFE' | 'CRITICAL';
  latencyTrend: 'STABLE' | 'RISING' | 'FALLING';
  predictedRisk: 'LOW' | 'MEDIUM' | 'HIGH';
}

export function AICommandCenterStrip() {
  const [state, setState] = useState<CommandState>({
    orchestratorState: 'ACTIVE',
    heartbeat: 'beating',
    lastEventTime: Date.now(),
    bigDocMode: false,
    lockedDocCount: 0,
    streamMode: false,
    adaptiveLevel: 'NORMAL',
    latencyTrend: 'STABLE',
    predictedRisk: 'LOW',
  });

  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Initialize command state
    const updateCommandState = () => {
      const edgeOffline = Boolean((window as any).RAG_EDGE_OFFLINE);
      const queueSubscribed = Boolean((window as any).RAG_QUEUE_SUBSCRIBED);

      let orchestratorState: 'ACTIVE' | 'DEGRADED' | 'FALLBACK' = 'ACTIVE';
      if (edgeOffline) orchestratorState = 'FALLBACK';
      else if (!queueSubscribed) orchestratorState = 'DEGRADED';

      // PHASE 36.13: Remove global locks - monitoring only
      setState((prev) => ({
        ...prev,
        orchestratorState,
        lastEventTime: Date.now(),
      }));


    };

    // Listen for OPS events
    window.addEventListener('RAG_OPS_EVENT', updateCommandState);
    window.addEventListener('RAG_COMMAND_CENTER_UPDATE', updateCommandState);

    // PHASE 14: Listen for real edge status updates
    const handleEdgeUpdate = () => {
      const offline = Boolean((window as any).RAG_EDGE_OFFLINE);
      setState(prev => ({
        ...prev,
        orchestratorState: offline ? 'FALLBACK' : prev.orchestratorState,
      }));
    };
    window.addEventListener('RAG_EDGE_STATUS_UPDATED', handleEdgeUpdate);

    // PHASE 9: Listen for big document mode events
    const handleBigDocMode = () => {

      setState(prev => ({ ...prev, bigDocMode: true }));
    };
    const handleBigDocClear = () => {

      setState(prev => ({ ...prev, bigDocMode: false }));
    };
    window.addEventListener('RAG_BIG_DOC_MODE_ACTIVATED', handleBigDocMode);
    window.addEventListener('RAG_BIG_DOC_MODE_CLEARED', handleBigDocClear);

    // PHASE 36.13: Remove document lock monitoring - each document independent

    // PHASE 11: Listen for stream mode events
    const handleStreamModeActivated = () => {

      setState(prev => ({ ...prev, streamMode: true }));
    };
    const handleStreamModeCleared = () => {

      setState(prev => ({ ...prev, streamMode: false }));
    };
    window.addEventListener('RAG_STREAM_MODE_ACTIVATED', handleStreamModeActivated);
    window.addEventListener('RAG_STREAM_MODE_CLEARED', handleStreamModeCleared);

    // PHASE 36.13: Remove adaptive stream controller - simplified monitoring

    // PATCH 5: HEARTBEAT MONITOR - stabilized interval
    // If edge is offline (FALLBACK), use 15s interval to reduce load
    // Otherwise use 5s for responsiveness
    const heartbeatInterval = Boolean((window as any).RAG_EDGE_OFFLINE) ? 15000 : 5000;
    log(`[RAG COMMAND CENTER] Heartbeat interval: ${heartbeatInterval}ms (Edge: ${(window as any).RAG_EDGE_OFFLINE ? 'OFFLINE' : 'ONLINE'})`);

    heartbeatIntervalRef.current = setInterval(() => {
      // PHASE 36.13: Remove pipeline lock - monitoring only, never block
      setState((prev) => {
        const now = Date.now();
        const lastEvent = prev.lastEventTime || Date.now();
        const elapsed = now - lastEvent;

        const heartbeat = elapsed > 20000 ? 'stale' : 'beating';

        if (heartbeat !== prev.heartbeat) {

        }

        return { ...prev, heartbeat };
      });
    }, heartbeatInterval);

    return () => {
      window.removeEventListener('RAG_OPS_EVENT', updateCommandState);
      window.removeEventListener('RAG_COMMAND_CENTER_UPDATE', updateCommandState);
      window.removeEventListener('RAG_EDGE_STATUS_UPDATED', handleEdgeUpdate);
      window.removeEventListener('RAG_BIG_DOC_MODE_ACTIVATED', handleBigDocMode);
      window.removeEventListener('RAG_BIG_DOC_MODE_CLEARED', handleBigDocClear);
      window.removeEventListener('RAG_DOC_LOCKED', handleDocLocked);
      window.removeEventListener('RAG_DOC_UNLOCKED', handleDocUnlocked);
      window.removeEventListener('RAG_STREAM_MODE_ACTIVATED', handleStreamModeActivated);
      window.removeEventListener('RAG_STREAM_MODE_CLEARED', handleStreamModeCleared);
      window.removeEventListener('RAG_STREAM_CONTROLLER_UPDATED', handleStreamControllerUpdated);
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
      }
    };
  }, []);

  const getStateColor = (): string => {
    if (state.orchestratorState === 'FALLBACK') return 'bg-red-50 text-red-700 border-red-200';
    if (state.orchestratorState === 'DEGRADED') return 'bg-amber-50 text-amber-700 border-amber-200';
    return 'bg-green-50 text-green-700 border-green-200';
  };

  const getStateIcon = () => {
    if (state.orchestratorState === 'FALLBACK') return <AlertCircle className="h-4 w-4" />;
    if (state.orchestratorState === 'DEGRADED') return <Zap className="h-4 w-4" />;
    return <Activity className="h-4 w-4" />;
  };

  const getHeartbeatColor = (): string => {
    return state.heartbeat === 'beating'
      ? 'bg-emerald-500 animate-pulse'
      : 'bg-gray-400';
  };

  return (
    <Card className="border-2 border-primary/20 bg-gradient-to-r from-primary/5 to-primary/2">
      <CardContent className="p-4">
        <div className="flex items-center justify-between gap-4">
          {/* Command Center Header */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <div className={`h-2 w-2 rounded-full ${getHeartbeatColor()}`} />
              <span className="text-xs font-semibold text-muted-foreground">AI COMMAND CENTER</span>
            </div>
          </div>

          {/* Orchestrator State */}
          <div className="flex items-center gap-2">
            {getStateIcon()}
            <Badge variant="outline" className={getStateColor()}>
              {state.orchestratorState}
            </Badge>
          </div>

          {/* PHASE 9: Big Document Mode Badge */}
          {state.bigDocMode && (
            <Badge className="bg-blue-100 text-blue-700 border-blue-200">
              📚 BIG DOC MODE
            </Badge>
          )}

          {/* PHASE 17: Document Locks Badge */}
          {state.lockedDocCount > 0 && (
            <Badge className="bg-red-100 text-red-700 border-red-200">
              🔒 {state.lockedDocCount} DOC LOCKED
            </Badge>
          )}

          {/* PHASE 11: Stream Mode Badge */}
          {state.streamMode && (
            <Badge className="bg-cyan-100 text-cyan-700 border-cyan-200">
              🌊 STREAM MODE
            </Badge>
          )}

          {/* PHASE 12: Adaptive Level Badge */}
          {state.streamMode && (
            <Badge
              className={
                state.adaptiveLevel === 'FAST'
                  ? 'bg-green-100 text-green-700 border-green-200'
                  : state.adaptiveLevel === 'NORMAL'
                    ? 'bg-blue-100 text-blue-700 border-blue-200'
                    : state.adaptiveLevel === 'SAFE'
                      ? 'bg-orange-100 text-orange-700 border-orange-200'
                      : 'bg-red-100 text-red-700 border-red-200'
              }
            >
              {state.adaptiveLevel === 'FAST'
                ? '🟢 FAST'
                : state.adaptiveLevel === 'NORMAL'
                  ? '🟡 NORMAL'
                  : state.adaptiveLevel === 'SAFE'
                    ? '🟠 SAFE'
                    : '🔴 CRITICAL'}
            </Badge>
          )}

          {/* PHASE 13: Predicted Risk Badge */}
          {state.streamMode && (
            <Badge
              className={
                state.predictedRisk === 'HIGH'
                  ? 'bg-red-100 text-red-700 border-red-200'
                  : state.predictedRisk === 'MEDIUM'
                    ? 'bg-orange-100 text-orange-700 border-orange-200'
                    : 'bg-green-100 text-green-700 border-green-200'
              }
            >
              {state.predictedRisk === 'HIGH'
                ? '🔮 HIGH'
                : state.predictedRisk === 'MEDIUM'
                  ? '🔮 MEDIUM'
                  : '🔮 LOW'}
            </Badge>
          )}

          {/* Heartbeat Badge */}
          <Badge
            variant="outline"
            className={
              state.heartbeat === 'beating'
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : 'bg-gray-50 text-gray-700 border-gray-200'
            }
          >
            {state.heartbeat === 'beating' ? '✓ Heartbeat' : '⚠️ Stale'}
          </Badge>

          {/* Last Event Time */}
          <div className="text-xs text-muted-foreground">
            {state.lastEventTime
              ? `Last: ${new Date(state.lastEventTime).toLocaleTimeString('fr-FR')}`
              : 'Initializing...'}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
