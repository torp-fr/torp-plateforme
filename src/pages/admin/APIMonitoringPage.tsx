/**
 * APIMonitoringPage — Real-time health dashboard for all 13 external APIs.
 * Shows status (🟢 🟡 🔴), response time, 24h chart grouped by category.
 * Auto-refreshes every 30s. Reads directly from api_health_metrics table.
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

// ── API catalogue (13 APIs tracked) ──────────────────────────────────────────

const API_DEFINITIONS = [
  // AI APIs
  { name: 'OpenAI-GPT-4o',        category: 'IA',                   type: 'Completion' },
  { name: 'OpenAI-Embeddings',     category: 'IA',                   type: 'Embedding' },
  { name: 'OpenAI-Vision',         category: 'IA',                   type: 'Vision' },
  { name: 'Anthropic-Claude',      category: 'IA',                   type: 'Completion' },
  { name: 'Google-Vision-OCR',     category: 'IA',                   type: 'OCR' },
  // Enterprise data
  { name: 'INSEE-SIRENE',          category: 'Données Entreprise',   type: 'SIRET Lookup' },
  { name: 'Pappers',               category: 'Données Entreprise',   type: 'Enterprise Data' },
  // Geolocation
  { name: 'Geoplateforme',          category: 'Géolocalisation',      type: 'Geocoding' },
  { name: 'BDNB',                  category: 'Géolocalisation',      type: 'Bâtiments' },
  { name: 'API-Carto',             category: 'Géolocalisation',      type: 'Cadastre/PLU' },
  // Enrichment
  { name: 'Georisques',            category: 'Enrichissement',       type: 'Risques naturels' },
  { name: 'ADEME-RGE',             category: 'Enrichissement',       type: 'Certifications RGE' },
  { name: 'ADEME-DPE',             category: 'Enrichissement',       type: 'Performance Énergétique' },
] as const;

type APIName = typeof API_DEFINITIONS[number]['name'];

// ── Types ────────────────────────────────────────────────────────────────────

interface APIStatus {
  api_name: string;
  status: 'online' | 'degraded' | 'down' | 'unknown';
  response_time_ms: number;
  error_message: string | null;
  checked_at: string;
}

interface HistoryRow {
  api_name: string;
  response_time_ms: number;
  checked_at: string;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: APIStatus['status'] }) {
  const map = {
    online:   { label: 'En ligne',   variant: 'default'     as const, icon: <CheckCircle2 className="h-3 w-3" /> },
    degraded: { label: 'Dégradé',    variant: 'secondary'   as const, icon: <AlertTriangle className="h-3 w-3" /> },
    down:     { label: 'Hors ligne', variant: 'destructive' as const, icon: <XCircle className="h-3 w-3" /> },
    unknown:  { label: 'Inconnu',    variant: 'outline'     as const, icon: <Clock className="h-3 w-3" /> },
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
  if (ms <= 0) return '—';
  return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`;
}

function getCategoryOrder() {
  const seen: string[] = [];
  for (const d of API_DEFINITIONS) {
    if (!seen.includes(d.category)) seen.push(d.category);
  }
  return seen;
}

const CATEGORY_ORDER = getCategoryOrder();
const CHART_COLORS = ['#6366f1', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6', '#06b6d4'];

const EMPTY_STATUS = (name: string): APIStatus => ({
  api_name: name,
  status: 'unknown',
  response_time_ms: 0,
  error_message: null,
  checked_at: '',
});

// ── Page ──────────────────────────────────────────────────────────────────────

export function APIMonitoringPage() {
  const [apis, setApis] = useState<APIStatus[]>(() =>
    API_DEFINITIONS.map(d => EMPTY_STATUS(d.name))
  );
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

      const [latestRes, historyRes] = await Promise.allSettled([
        supabase
          .from('api_health_metrics')
          .select('api_name, status, response_time_ms, error_message, checked_at')
          .order('checked_at', { ascending: false })
          .limit(200),
        supabase
          .from('api_health_metrics')
          .select('api_name, response_time_ms, checked_at')
          .gte('checked_at', since24h)
          .order('checked_at', { ascending: true }),
      ]);

      // Build latest-per-API map
      if (latestRes.status === 'fulfilled' && latestRes.value.data) {
        const rows = latestRes.value.data as APIStatus[];
        const latestMap = new Map<string, APIStatus>();
        for (const row of rows) {
          if (!latestMap.has(row.api_name)) latestMap.set(row.api_name, row);
        }
        setApis(
          API_DEFINITIONS.map(d => latestMap.get(d.name) ?? EMPTY_STATUS(d.name))
        );
      }

      if (historyRes.status === 'fulfilled' && historyRes.value.data) {
        setHistory(historyRes.value.data as HistoryRow[]);
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

  // Build recharts dataset: response time per API (top 5 only for readability)
  const chartData = (() => {
    const byTime = new Map<string, Record<string, number>>();
    for (const row of history) {
      const label = new Date(row.checked_at).toLocaleTimeString('fr-FR', {
        hour: '2-digit', minute: '2-digit',
      });
      const bucket = byTime.get(label) ?? {};
      bucket[row.api_name] = row.response_time_ms;
      byTime.set(label, bucket);
    }
    return Array.from(byTime.entries())
      .slice(-30)
      .map(([time, values]) => ({ time, ...values }));
  })();

  const chartAPIs = [...new Set(history.map(h => h.api_name))].slice(0, 6);

  const onlineCount   = apis.filter(a => a.status === 'online').length;
  const degradedCount = apis.filter(a => a.status === 'degraded').length;
  const downCount     = apis.filter(a => a.status === 'down').length;

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
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Activity className="h-8 w-8 text-primary" />
            Surveillance API
          </h1>
          <p className="text-muted-foreground">
            Statut en temps réel des 13 APIs externes — rafraîchissement toutes les 30s
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

      {/* KPI cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
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
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                <Clock className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total</p>
                <p className="text-2xl font-bold text-blue-600">{apis.length}/13</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Category tables */}
      {CATEGORY_ORDER.map(category => {
        const categoryAPIs = API_DEFINITIONS.filter(d => d.category === category);
        const categoryStatuses = categoryAPIs.map(
          d => apis.find(a => a.api_name === d.name) ?? EMPTY_STATUS(d.name)
        );
        return (
          <Card key={category}>
            <CardHeader>
              <CardTitle>
                {category}
                <span className="ml-2 text-sm font-normal text-muted-foreground">
                  ({categoryAPIs.length} APIs)
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-muted-foreground">
                      <th className="text-left py-2 font-medium">API</th>
                      <th className="text-left py-2 font-medium">Type</th>
                      <th className="text-left py-2 font-medium">Statut</th>
                      <th className="text-right py-2 font-medium">Temps de réponse</th>
                      <th className="text-left py-2 font-medium">Dernière vérif.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {categoryAPIs.map((def, i) => {
                      const s = categoryStatuses[i];
                      return (
                        <tr key={def.name} className="border-b last:border-0 hover:bg-muted/30">
                          <td className="py-3 font-medium">{def.name}</td>
                          <td className="py-3 text-muted-foreground text-xs">{def.type}</td>
                          <td className="py-3"><StatusBadge status={s.status} /></td>
                          <td className="py-3 text-right font-mono">
                            {formatTime(s.response_time_ms)}
                          </td>
                          <td className="py-3 text-muted-foreground">
                            {s.checked_at
                              ? new Date(s.checked_at).toLocaleTimeString('fr-FR')
                              : 'Jamais'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        );
      })}

      {/* Response time chart — last 24h */}
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
                {chartAPIs.map((name, i) => (
                  <Line
                    key={name}
                    type="monotone"
                    dataKey={name}
                    stroke={CHART_COLORS[i % CHART_COLORS.length]}
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
