// ─────────────────────────────────────────────────────────────────────────────
// EngineService.ts — Real-time engine metrics from Supabase
// Phase 3B — Jalon 3
//
// Source of truth for the 3 engine endpoints:
//   GET /api/v1/engine/stats
//   GET /api/v1/engine/status
//   GET /api/v1/engine/orchestration
//
// Reads from:
//   - analysis_jobs    → stats + status
//   - orchestration_runs → last orchestration
// ─────────────────────────────────────────────────────────────────────────────

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { config } from '../../config/index.js';

// ─── Types ────────────────────────────────────────────────────────────────────

export type Period = '1h' | '24h' | '7d';

export interface EngineMetrics {
  total_executions: number;
  successful:       number;
  failed:           number;
  average_duration_ms: number;
  success_rate:     number;
}

export interface TimelineEntry {
  timestamp:       string;
  executions:      number;
  successes:       number;
  failures:        number;
  avg_duration_ms: number;
}

export interface StatsResult {
  period:   Period;
  metrics:  EngineMetrics;
  timeline: TimelineEntry[];
}

export interface StatusDetails {
  processing_queue:    number;
  pending:             number;
  in_progress:         number;
  last_execution_at:   string | null;
  error_rate_1h:       number;
  total_executions_1h: number;
}

export type OperationalStatus = 'operational' | 'degraded' | 'down';

export interface StatusResult {
  status:       OperationalStatus;
  details:      StatusDetails;
  health_score: number;
}

export interface OrchestrationRow {
  id:            string;
  name:          string;
  status:        string;
  input_count:   number;
  output_count:  number;
  error_count:   number;
  duration_ms:   number | null;
  started_at:    string | null;
  completed_at:  string | null;
  created_at:    string;
}

export interface OrchestrationResult {
  id:           string | null;
  created_at:   string | null;
  status:       string;
  input_count:  number;
  output_count: number;
  error_count:  number;
  duration_ms:  number;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const PERIOD_MS: Record<Period, number> = {
  '1h':  3_600_000,
  '24h': 86_400_000,
  '7d':  604_800_000,
};

const IDLE_ORCHESTRATION: OrchestrationResult = {
  id: null, created_at: null, status: 'idle',
  input_count: 0, output_count: 0, error_count: 0, duration_ms: 0,
};

// ─── Service ─────────────────────────────────────────────────────────────────

export class EngineService {
  private readonly db: SupabaseClient;

  constructor() {
    if (!config.supabase.url || !config.supabase.serviceRoleKey) {
      throw new Error('[EngineService] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    }
    this.db = createClient(config.supabase.url, config.supabase.serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }

  // ── GET /engine/stats ─────────────────────────────────────────────────────

  async getStats(period: Period = '24h'): Promise<StatsResult> {
    const since = new Date(Date.now() - PERIOD_MS[period]).toISOString();

    const { data: jobs, error } = await this.db
      .from('analysis_jobs')
      .select('status, created_at, started_at, completed_at')
      .gte('created_at', since)
      .order('created_at', { ascending: true });

    if (error) throw new Error(`[EngineService.getStats] DB error: ${error.message}`);

    const rows = jobs ?? [];

    // Compute duration_ms from timestamps (analysis_jobs has no duration_ms column)
    const durations = rows
      .filter(j => j.started_at && j.completed_at)
      .map(j => new Date(j.completed_at!).getTime() - new Date(j.started_at!).getTime());

    const total       = rows.length;
    const successful  = rows.filter(j => j.status === 'completed').length;
    const failed      = rows.filter(j => j.status === 'failed').length;
    const avgDuration = durations.length
      ? durations.reduce((a, b) => a + b, 0) / durations.length
      : 0;

    const metrics: EngineMetrics = {
      total_executions: total,
      successful,
      failed,
      average_duration_ms: Math.round(avgDuration),
      success_rate:        total > 0 ? parseFloat(((successful / total) * 100).toFixed(1)) : 0,
    };

    const timeline = this.groupByHour(rows);

    return { period, metrics, timeline };
  }

  // ── GET /engine/status ────────────────────────────────────────────────────

  async getStatus(): Promise<StatusResult> {
    const since = new Date(Date.now() - PERIOD_MS['1h']).toISOString();

    const { data: jobs, error } = await this.db
      .from('analysis_jobs')
      .select('status, created_at')
      .gte('created_at', since)
      .order('created_at', { ascending: false });

    if (error) throw new Error(`[EngineService.getStatus] DB error: ${error.message}`);

    const rows       = jobs ?? [];
    const total      = rows.length;
    const failed     = rows.filter(j => j.status === 'failed').length;
    const pending    = rows.filter(j => j.status === 'pending').length;
    const processing = rows.filter(j => j.status === 'processing').length;
    const errorRate  = total > 0 ? (failed / total) * 100 : 0;

    let status: OperationalStatus = 'operational';
    if (errorRate > 30) status = 'down';
    else if (errorRate > 10) status = 'degraded';

    const healthScore = Math.round(Math.max(0, 100 * (1 - errorRate / 100)));

    return {
      status,
      details: {
        processing_queue:    pending + processing,
        pending,
        in_progress:         processing,
        last_execution_at:   rows[0]?.created_at ?? null,
        error_rate_1h:       parseFloat(errorRate.toFixed(1)),
        total_executions_1h: total,
      },
      health_score: healthScore,
    };
  }

  // ── GET /engine/orchestration ─────────────────────────────────────────────

  async getLastOrchestration(): Promise<OrchestrationResult> {
    const { data, error } = await this.db
      .from('orchestration_runs')
      .select('id, name, status, input_count, output_count, error_count, duration_ms, started_at, completed_at, created_at')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw new Error(`[EngineService.getLastOrchestration] DB error: ${error.message}`);

    if (!data) return { ...IDLE_ORCHESTRATION };

    const row = data as OrchestrationRow;

    return {
      id:           row.id,
      created_at:   row.created_at,
      status:       row.status,
      input_count:  row.input_count,
      output_count: row.output_count,
      error_count:  row.error_count,
      duration_ms:  row.duration_ms ?? 0,
    };
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  private groupByHour(
    rows: Array<{ status: string; created_at: string; started_at?: string | null; completed_at?: string | null }>,
  ): TimelineEntry[] {
    const buckets = new Map<string, { executions: number; successes: number; failures: number; durations: number[] }>();

    for (const row of rows) {
      const key = row.created_at.substring(0, 13) + ':00:00Z';

      if (!buckets.has(key)) {
        buckets.set(key, { executions: 0, successes: 0, failures: 0, durations: [] });
      }

      const b = buckets.get(key)!;
      b.executions++;
      if (row.status === 'completed') b.successes++;
      if (row.status === 'failed') b.failures++;

      if (row.started_at && row.completed_at) {
        b.durations.push(
          new Date(row.completed_at).getTime() - new Date(row.started_at).getTime(),
        );
      }
    }

    return Array.from(buckets.entries()).map(([timestamp, b]) => ({
      timestamp,
      executions:      b.executions,
      successes:       b.successes,
      failures:        b.failures,
      avg_duration_ms: b.durations.length
        ? Math.round(b.durations.reduce((a, c) => a + c, 0) / b.durations.length)
        : 0,
    }));
  }
}

export const engineService = new EngineService();
