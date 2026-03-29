/**
 * CostDashboardPage — Per-user API cost view.
 * Users see only their own spending (user_id = auth.uid() via RLS).
 * Pie chart + bar chart + CSV export + period/currency filter.
 * Auto-refreshes every 60s.
 */

import { useState, useEffect, useCallback } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from 'recharts';
import { DollarSign, Download, RefreshCw, TrendingUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/lib/supabase';
import { useApp } from '@/context/AppContext';

// ── Types ─────────────────────────────────────────────────────────────────────

interface CostBreakdown {
  api_name: string;
  cost_usd: number;
  cost_in_currency: number;
  percentage: number;
}

type Currency = 'EUR' | 'USD' | 'GBP' | 'JPY' | 'CHF';
type Period   = 'today' | 'month' | 'all_time';

const CURRENCY_SYMBOLS: Record<Currency, string> = {
  EUR: '€', USD: '$', GBP: '£', JPY: '¥', CHF: 'CHF ',
};

// EUR/1 USD = EUR rate (approximate)
const USD_TO_EUR = 1 / 1.08;
const EUR_TO: Record<Currency, number> = {
  EUR: 1.00, USD: 1 / USD_TO_EUR, GBP: 1 / 0.86, JPY: 164, CHF: 1 / 0.97,
};

const CHART_COLORS = ['#6366f1', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6', '#06b6d4', '#f97316'];

function periodCutoff(period: Period): string {
  if (period === 'today') {
    const d = new Date(); d.setHours(0, 0, 0, 0); return d.toISOString();
  }
  if (period === 'month') {
    const d = new Date(); d.setDate(1); d.setHours(0, 0, 0, 0); return d.toISOString();
  }
  return new Date(0).toISOString();
}

function usdToTarget(costUsd: number, currency: Currency): number {
  return costUsd * USD_TO_EUR * EUR_TO[currency];
}

// ── Page ──────────────────────────────────────────────────────────────────────

export function CostDashboardPage() {
  const { user } = useApp();
  const [breakdowns, setBreakdowns] = useState<CostBreakdown[]>([]);
  const [totalUsd, setTotalUsd]     = useState(0);
  const [currency, setCurrency]     = useState<Currency>('EUR');
  const [period, setPeriod]         = useState<Period>('month');
  const [isLoading, setIsLoading]   = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const symbol = CURRENCY_SYMBOLS[currency];

  const fetchData = useCallback(async () => {
    if (!user?.id) return;
    try {
      const { data: rows } = await supabase
        .from('api_costs')
        .select('api_name, cost_usd')
        .eq('user_id', user.id)
        .gte('recorded_at', periodCutoff(period));

      if (rows) {
        const byCost: Record<string, number> = {};
        for (const row of rows) {
          byCost[row.api_name] = (byCost[row.api_name] ?? 0) + (row.cost_usd as number);
        }

        const total = Object.values(byCost).reduce((s, c) => s + c, 0);
        const list: CostBreakdown[] = Object.entries(byCost)
          .map(([api_name, cost_usd]) => ({
            api_name,
            cost_usd,
            cost_in_currency: usdToTarget(cost_usd, currency),
            percentage: total > 0 ? (cost_usd / total) * 100 : 0,
          }))
          .sort((a, b) => b.cost_usd - a.cost_usd);

        setBreakdowns(list);
        setTotalUsd(total);
      }
      setLastRefresh(new Date());
    } finally {
      setIsLoading(false);
    }
  }, [user?.id, currency, period]);

  useEffect(() => {
    setIsLoading(true);
    void fetchData();
    const id = setInterval(() => void fetchData(), 60_000);
    return () => clearInterval(id);
  }, [fetchData]);

  const totalConverted = usdToTarget(totalUsd, currency);

  function exportCSV() {
    const periodLabel = period === 'today' ? 'today' : period === 'month' ? 'month' : 'all';
    const header = 'API,USD,Amount,Percentage\n';
    const rows = breakdowns.map(b =>
      `${b.api_name},${b.cost_usd.toFixed(6)},${b.cost_in_currency.toFixed(6)},${b.percentage.toFixed(2)}`
    ).join('\n');
    const blob = new Blob([header + rows], { type: 'text/csv' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `costs_${periodLabel}_${currency}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-3 gap-4">
          <Skeleton className="h-24" /><Skeleton className="h-24" /><Skeleton className="h-24" />
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
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <DollarSign className="h-6 w-6 text-primary" />
            Mes dépenses
          </h1>
          <p className="text-muted-foreground text-sm">
            Coûts API générés par vos analyses TORP
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Select value={period} onValueChange={(v) => setPeriod(v as Period)}>
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="today">Aujourd'hui</SelectItem>
              <SelectItem value="month">Ce mois</SelectItem>
              <SelectItem value="all_time">Tout</SelectItem>
            </SelectContent>
          </Select>
          <Select value={currency} onValueChange={(v) => setCurrency(v as Currency)}>
            <SelectTrigger className="w-24">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(['EUR', 'USD', 'GBP', 'JPY', 'CHF'] as Currency[]).map(c => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={() => void fetchData()}>
            <RefreshCw className="h-4 w-4 mr-1" />
            Actualiser
          </Button>
          {breakdowns.length > 0 && (
            <Button variant="outline" size="sm" onClick={exportCSV}>
              <Download className="h-4 w-4 mr-1" />
              Export CSV
            </Button>
          )}
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">
              Total ({period === 'today' ? "aujourd'hui" : period === 'month' ? 'ce mois' : 'tout'})
            </p>
            <p className="text-3xl font-bold mt-1">
              {symbol}{totalConverted.toFixed(4)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              ${totalUsd.toFixed(4)} USD
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">APIs utilisées</p>
            <p className="text-3xl font-bold mt-1">{breakdowns.length}</p>
            <p className="text-xs text-muted-foreground mt-1">
              services externes
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">API principale</p>
            {breakdowns[0] ? (
              <>
                <p className="text-lg font-bold mt-1 truncate flex items-center gap-1">
                  <TrendingUp className="h-4 w-4 text-primary flex-shrink-0" />
                  {breakdowns[0].api_name}
                </p>
                <p className="text-xs text-muted-foreground">
                  {symbol}{breakdowns[0].cost_in_currency.toFixed(4)} ({Math.round(breakdowns[0].percentage)}%)
                </p>
              </>
            ) : (
              <p className="text-muted-foreground text-sm mt-1">—</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Empty state */}
      {breakdowns.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <DollarSign className="h-12 w-12 text-gray-200 mb-3" />
            <p className="text-muted-foreground">Aucune dépense pour cette période.</p>
            <p className="text-sm text-muted-foreground mt-1">
              Les coûts apparaissent après chaque analyse de devis.
            </p>
          </CardContent>
        </Card>
      )}

      {breakdowns.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Cost table */}
          <Card>
            <CardHeader><CardTitle>Détail par API</CardTitle></CardHeader>
            <CardContent>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-muted-foreground">
                    <th className="text-left py-2 font-medium">API</th>
                    <th className="text-right py-2 font-medium">Coût</th>
                    <th className="text-right py-2 font-medium">%</th>
                  </tr>
                </thead>
                <tbody>
                  {breakdowns.map(api => (
                    <tr key={api.api_name} className="border-b last:border-0">
                      <td className="py-2.5 font-medium">{api.api_name}</td>
                      <td className="py-2.5 text-right font-mono">
                        {symbol}{api.cost_in_currency.toFixed(4)}
                      </td>
                      <td className="py-2.5 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <div className="w-16 h-1.5 rounded-full bg-muted overflow-hidden">
                            <div
                              className="h-full rounded-full bg-primary"
                              style={{ width: `${api.percentage}%` }}
                            />
                          </div>
                          <span className="text-muted-foreground text-xs w-8 text-right">
                            {Math.round(api.percentage)}%
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>

          {/* Pie chart */}
          <Card>
            <CardHeader><CardTitle>Répartition des coûts</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie
                    data={breakdowns.map(a => ({ name: a.api_name, value: a.cost_in_currency }))}
                    cx="50%" cy="50%"
                    outerRadius={90}
                    dataKey="value"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  >
                    {breakdowns.map((_, i) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: number) => `${symbol}${v.toFixed(4)}`} />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Bar chart — top 7 */}
      {breakdowns.length > 1 && (
        <Card>
          <CardHeader><CardTitle>Top APIs par coût</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={breakdowns.slice(0, 7).map(a => ({ name: a.api_name, cost: a.cost_in_currency }))}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: number) => `${symbol}${v.toFixed(4)}`} />
                <Bar dataKey="cost" fill="#6366f1" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {lastRefresh && (
        <p className="text-xs text-muted-foreground text-right">
          Dernière mise à jour : {lastRefresh.toLocaleTimeString('fr-FR')}
        </p>
      )}
    </div>
  );
}

export default CostDashboardPage;
