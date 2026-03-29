/**
 * CostTrackingPage — API cost tracking with period + multi-currency support.
 * Reads directly from api_costs table. Budget alerts at 80/95/100%.
 * Auto-refreshes every 60s.
 */

import { useState, useEffect, useCallback } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from 'recharts';
import { DollarSign, AlertTriangle, RefreshCw } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/lib/supabase';

// ── Types ────────────────────────────────────────────────────────────────────

interface CostBreakdown {
  api_name: string;
  cost_usd: number;
  cost_in_currency: number;
  percentage: number;
}

interface CostSummary {
  period: string;
  currency: string;
  total_cost: number;
  total_cost_usd: number;
  cost_by_api: CostBreakdown[];
}

type Currency = 'EUR' | 'USD' | 'GBP' | 'JPY' | 'CHF';
type Period   = 'today' | 'month' | 'all_time';

const MONTHLY_BUDGET_EUR = 500;
const CURRENCY_SYMBOLS: Record<Currency, string> = {
  EUR: '€', USD: '$', GBP: '£', JPY: '¥', CHF: 'CHF ',
};
// Approximate EUR conversion rates (USD base → EUR)
const EUR_RATES: Record<Currency, number> = {
  USD: 1.08, EUR: 1.0, GBP: 0.86, JPY: 164, CHF: 0.97,
};
const CHART_COLORS = ['#6366f1', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6', '#06b6d4', '#f97316'];

function periodCutoff(period: Period): string {
  if (period === 'today') {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d.toISOString();
  }
  if (period === 'month') {
    const d = new Date();
    d.setDate(1);
    d.setHours(0, 0, 0, 0);
    return d.toISOString();
  }
  return new Date(0).toISOString();
}

// ── Page ──────────────────────────────────────────────────────────────────────

export function CostTrackingPage() {
  const [summary, setSummary]     = useState<CostSummary | null>(null);
  const [currency, setCurrency]   = useState<Currency>('EUR');
  const [period, setPeriod]       = useState<Period>('month');
  const [isLoading, setIsLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const symbol = CURRENCY_SYMBOLS[currency];
  const budgetInCurrency = MONTHLY_BUDGET_EUR * (currency === 'EUR' ? 1 : EUR_RATES[currency] / EUR_RATES['EUR']);

  const fetchData = useCallback(async () => {
    try {
      const { data: rows } = await supabase
        .from('api_costs')
        .select('api_name, cost_usd')
        .gte('recorded_at', periodCutoff(period));

      if (rows) {
        // Aggregate by API
        const byCost: Record<string, number> = {};
        for (const row of rows) {
          byCost[row.api_name] = (byCost[row.api_name] ?? 0) + (row.cost_usd as number);
        }

        const usdToTarget = 1 / EUR_RATES['USD'] * EUR_RATES[currency];
        const totalUsd = Object.values(byCost).reduce((s, c) => s + c, 0);
        const totalConverted = totalUsd * usdToTarget;

        const costByApi: CostBreakdown[] = Object.entries(byCost)
          .map(([api_name, cost_usd]) => ({
            api_name,
            cost_usd,
            cost_in_currency: cost_usd * usdToTarget,
            percentage: totalUsd > 0 ? (cost_usd / totalUsd) * 100 : 0,
          }))
          .sort((a, b) => b.cost_usd - a.cost_usd);

        setSummary({
          period,
          currency,
          total_cost: totalConverted,
          total_cost_usd: totalUsd,
          cost_by_api: costByApi,
        });
      }

      setLastRefresh(new Date());
    } finally {
      setIsLoading(false);
    }
  }, [currency, period]);

  useEffect(() => {
    setIsLoading(true);
    void fetchData();
    const id = setInterval(() => void fetchData(), 60_000);
    return () => clearInterval(id);
  }, [fetchData]);

  const budgetPct  = summary && period === 'month'
    ? (summary.total_cost / budgetInCurrency) * 100
    : 0;
  const alertLevel =
    budgetPct >= 100 ? 'exceeded'
    : budgetPct >= 95 ? 'critical'
    : budgetPct >= 80 ? 'warning'
    : null;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-2 gap-4">
          <Skeleton className="h-24" /><Skeleton className="h-24" />
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  const apis = summary?.cost_by_api ?? [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <DollarSign className="h-8 w-8 text-primary" />
            Suivi des Coûts
          </h1>
          <p className="text-muted-foreground">
            Dépenses par API — multi-devises — alertes budgétaires
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
            <SelectTrigger className="w-28">
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
        </div>
      </div>

      {/* Budget alert */}
      {alertLevel && (
        <div className={`flex items-center gap-3 p-4 rounded-lg border ${
          alertLevel === 'exceeded' ? 'bg-red-50 border-red-200 text-red-800'
          : alertLevel === 'critical' ? 'bg-orange-50 border-orange-200 text-orange-800'
          : 'bg-yellow-50 border-yellow-200 text-yellow-800'
        }`}>
          <AlertTriangle className="h-5 w-5 flex-shrink-0" />
          <span className="font-medium">
            {alertLevel === 'exceeded' && `Budget mensuel dépassé ! ${symbol}${summary?.total_cost.toFixed(2)} / ${symbol}${budgetInCurrency.toFixed(0)}`}
            {alertLevel === 'critical' && `95% du budget mensuel atteint — ${symbol}${summary?.total_cost.toFixed(2)} / ${symbol}${budgetInCurrency.toFixed(0)}`}
            {alertLevel === 'warning'  && `80% du budget mensuel atteint — ${symbol}${summary?.total_cost.toFixed(2)} / ${symbol}${budgetInCurrency.toFixed(0)}`}
          </span>
        </div>
      )}

      {/* KPI cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">
              Coût total ({period === 'today' ? "aujourd'hui" : period === 'month' ? 'ce mois' : 'total'})
            </p>
            <p className="text-3xl font-bold mt-1">
              {symbol}{(summary?.total_cost ?? 0).toFixed(2)}
            </p>
            {period === 'month' && (
              <div className="mt-2">
                <div className="flex justify-between text-xs text-muted-foreground mb-1">
                  <span>Budget {symbol}{budgetInCurrency.toFixed(0)}</span>
                  <span>{Math.round(budgetPct)}%</span>
                </div>
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      budgetPct >= 100 ? 'bg-red-500' : budgetPct >= 80 ? 'bg-yellow-500' : 'bg-green-500'
                    }`}
                    style={{ width: `${Math.min(100, budgetPct)}%` }}
                  />
                </div>
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Coût en USD</p>
            <p className="text-3xl font-bold mt-1">${(summary?.total_cost_usd ?? 0).toFixed(2)}</p>
            <p className="text-xs text-muted-foreground mt-1">{apis.length} APIs actives</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">API la plus coûteuse</p>
            {apis[0] ? (
              <>
                <p className="text-lg font-bold mt-1 truncate">{apis[0].api_name}</p>
                <p className="text-sm text-muted-foreground">
                  {symbol}{apis[0].cost_in_currency.toFixed(3)} ({Math.round(apis[0].percentage)}%)
                </p>
              </>
            ) : (
              <p className="text-muted-foreground text-sm mt-1">—</p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Cost table */}
        <Card>
          <CardHeader><CardTitle>Détail par API</CardTitle></CardHeader>
          <CardContent>
            {apis.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">
                Aucune dépense enregistrée pour cette période.
              </p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-muted-foreground">
                    <th className="text-left py-2 font-medium">API</th>
                    <th className="text-right py-2 font-medium">Coût</th>
                    <th className="text-right py-2 font-medium">%</th>
                  </tr>
                </thead>
                <tbody>
                  {apis.map(api => (
                    <tr key={api.api_name} className="border-b last:border-0">
                      <td className="py-2.5 font-medium">{api.api_name}</td>
                      <td className="py-2.5 text-right font-mono">
                        {symbol}{api.cost_in_currency.toFixed(3)}
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
            )}
          </CardContent>
        </Card>

        {/* Pie chart */}
        {apis.length > 0 && (
          <Card>
            <CardHeader><CardTitle>Répartition des coûts</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie
                    data={apis.map(a => ({ name: a.api_name, value: a.cost_in_currency }))}
                    cx="50%" cy="50%"
                    outerRadius={90}
                    dataKey="value"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  >
                    {apis.map((_, i) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: number) => `${symbol}${v.toFixed(3)}`} />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Bar chart — top 7 */}
      {apis.length > 1 && (
        <Card>
          <CardHeader><CardTitle>Top APIs par coût</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={apis.slice(0, 7).map(a => ({ name: a.api_name, cost: a.cost_in_currency }))}>
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
