/**
 * APIMonitoringPage — Tab 9: Real-time external API health dashboard.
 * Shows status (🟢 🟡 🔴), response time, error rate + 24h history chart.
 * Auto-refreshes every 30s (Pattern A).
 */

import { useState, useEffect, useCallback } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import {
  Activity, RefreshCw, CheckCircle2, AlertTriangle, XCircle, Clock,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/lib/supabase';

// ── Types ────────────────────────────────────────────────────────────────────

interface APIStatus {
  api_name: string;
  status: 'online' | 'degraded' | 'down' | 'unknown';
  response_time_ms: number;
  error_message: string | null;
  checked_at: string;
}

interface HistoryPoint {
  api_name: string;
  status: string;
  response_time_ms: number;
  checked_at: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: APIStatus['status'] }) {
  const map = {
    online:   { label: 'En ligne',  variant: 'default' as const,     icon: <CheckCircle2 className="h-3 w-3" /> },
    degraded: { label: 'Dégradé',   variant: 'secondary' as const,   icon: <AlertTriangle className="h-3 w-3" /> },
    down:     { label: 'Hors ligne', variant: 'destructive' as const, icon: <XCircle className="h-3 w-3" /> },
    unknown:  { label: 'Inconnu',   variant: 'outline' as const,      icon: <Clock className="h-3 w-3" /> },
  };
  const { label, variant, icon } = map[status] ?? map.unknown;
  return (
    <Badge variant={variant} className="gap-1">
      {icon}
      {label}
    </Badge>
  );
}

function formatTime(ms: number) {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

// ── Page ──────────────────────────────────────────────────────────────────────

export function APIMonitoringPage() {
  const [apis, setApis] = useState<APIStatus[]>([]);
  const [history, setHistory] = useState<HistoryPoint[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const headers = { Authorization: `Bearer ${session.access_token}` };

      const [statusRes, historyRes] = await Promise.allSettled([
        fetch('/api/v1/admin/api-health', { headers }),
        fetch('/api/v1/admin/api-health/history?hours=24', { headers }),
      ]);

      if (statusRes.status === 'fulfilled' && statusRes.value.ok) {
        const json = await statusRes.value.json();
        setApis(json.apis ?? []);
      }

      if (historyRes.status === 'fulfilled' && historyRes.value.ok) {
        const json = await historyRes.value.json();
        setHistory(json.history ?? []);
      }

      setLastRefresh(new Date());
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchData();
    const id = setInterval(() => void fetchData(), 30_000);
    return () => clearInterval(id);
  }, [fetchData]);

  // Build recharts dataset: response time per API over time
  const chartData = (() => {
    const byTime = new Map<string, Record<string, number>>();
    for (const point of history) {
      const label = new Date(point.checked_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
      const existing = byTime.get(label) ?? { time: 0 };
      existing[point.api_name] = point.response_time_ms;
      byTime.set(label, existing);
    }
    return Array.from(byTime.entries())
      .slice(-30) // last 30 data points
      .map(([time, values]) => ({ time, ...values }));
  })();

  const apiNames = [...new Set(history.map(h => h.api_name))];
  const COLORS = ['#6366f1', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6', '#06b6d4'];

  const onlineCount  = apis.filter(a => a.status === 'online').length;
  const degradedCount = apis.filter(a => a.status === 'degraded').length;
  const downCount    = apis.filter(a => a.status === 'down').length;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-3 gap-4">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-24" />)}
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Activity className="h-8 w-8 text-primary" />
            Surveillance API
          </h1>
          <p className="text-muted-foreground">
            Statut en temps réel des APIs externes — rafraîchissement toutes les 30s
          </p>
        </div>
        <div className="flex items-center gap-3">
          {lastRefresh && (
            <span className="text-xs text-muted-foreground">
              Mis à jour : {lastRefresh.toLocaleTimeString('fr-FR')}
            </span>
          )}
          <Button variant="outline" size="sm" onClick={() => void fetchData()}>
            <RefreshCw className="h-4 w-4 mr-1" />
            Actualiser
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-green-100 flex items-center justify-center">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">En ligne</p>
                <p className="text-2xl font-bold text-green-600">{onlineCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-yellow-100 flex items-center justify-center">
                <AlertTriangle className="h-5 w-5 text-yellow-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Dégradées</p>
                <p className="text-2xl font-bold text-yellow-600">{degradedCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-red-100 flex items-center justify-center">
                <XCircle className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Hors ligne</p>
                <p className="text-2xl font-bold text-red-600">{downCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Status Table */}
      <Card>
        <CardHeader>
          <CardTitle>Statut des APIs ({apis.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {apis.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              Aucune donnée de monitoring disponible. Démarrez l'APIHealthMonitor pour collecter des métriques.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-muted-foreground">
                    <th className="text-left py-2 font-medium">API</th>
                    <th className="text-left py-2 font-medium">Statut</th>
                    <th className="text-right py-2 font-medium">Temps de réponse</th>
                    <th className="text-left py-2 font-medium">Dernière vérif.</th>
                    <th className="text-left py-2 font-medium">Erreur</th>
                  </tr>
                </thead>
                <tbody>
                  {apis.map(api => (
                    <tr key={api.api_name} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="py-3 font-medium">{api.api_name}</td>
                      <td className="py-3"><StatusBadge status={api.status} /></td>
                      <td className="py-3 text-right font-mono">
                        {api.response_time_ms > 0 ? formatTime(api.response_time_ms) : '—'}
                      </td>
                      <td className="py-3 text-muted-foreground">
                        {new Date(api.checked_at).toLocaleTimeString('fr-FR')}
                      </td>
                      <td className="py-3 text-red-600 text-xs max-w-xs truncate">
                        {api.error_message ?? '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Response Time Chart */}
      {chartData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Temps de réponse — 24h</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="time" tick={{ fontSize: 11 }} />
                <YAxis unit="ms" tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: number) => `${v}ms`} />
                <Legend />
                {apiNames.map((name, i) => (
                  <Line
                    key={name}
                    type="monotone"
                    dataKey={name}
                    stroke={COLORS[i % COLORS.length]}
                    dot={false}
                    strokeWidth={2}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
