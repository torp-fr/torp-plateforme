import React, { useEffect, useState, useRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, Zap, Activity } from 'lucide-react';

interface CommandState {
  orchestratorState: 'ACTIVE' | 'DEGRADED' | 'FALLBACK';
  heartbeat: 'beating' | 'stale';
  lastEventTime: number | null;
}

export function AICommandCenterStrip() {
  const [state, setState] = useState<CommandState>({
    orchestratorState: 'ACTIVE',
    heartbeat: 'beating',
    lastEventTime: Date.now(),
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

      setState((prev) => ({
        ...prev,
        orchestratorState,
        lastEventTime: Date.now(),
      }));

      console.log('[RAG COMMAND CENTER] Heartbeat updated:', orchestratorState);
    };

    // Listen for OPS events
    window.addEventListener('RAG_OPS_EVENT', updateCommandState);
    window.addEventListener('RAG_COMMAND_CENTER_UPDATE', updateCommandState);

    // Heartbeat monitor - check for stale events
    heartbeatIntervalRef.current = setInterval(() => {
      setState((prev) => {
        const now = Date.now();
        const lastEvent = prev.lastEventTime || Date.now();
        const elapsed = now - lastEvent;

        const heartbeat = elapsed > 20000 ? 'stale' : 'beating';

        if (heartbeat !== prev.heartbeat) {
          console.log('[RAG COMMAND CENTER] Heartbeat status:', heartbeat);
        }

        return { ...prev, heartbeat };
      });
    }, 5000);

    return () => {
      window.removeEventListener('RAG_OPS_EVENT', updateCommandState);
      window.removeEventListener('RAG_COMMAND_CENTER_UPDATE', updateCommandState);
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
