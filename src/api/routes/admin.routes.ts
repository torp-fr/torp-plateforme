// ─────────────────────────────────────────────────────────────────────────────
// admin.routes.ts — Admin management endpoints — Phase 3B Jalon 1
//
// All routes require: authenticateJWT + requireAdmin
//
// GET    /admin/users                — List users (paginated)
// GET    /admin/rate-limits          — List all rate-limit configs
// GET    /admin/rate-limits/:userId  — Get config + current usage for user
// PUT    /admin/rate-limits/:userId  — Update rate-limit config
// DELETE /admin/users/:userId        — Hard delete user
// GET    /admin/health               — Admin health check
// ─────────────────────────────────────────────────────────────────────────────

import { Router, type Request, type Response } from 'express';
import { createClient } from '@supabase/supabase-js';
import { authService } from '../../core/services/AuthService.js';
import { authenticateJWT, requireAdmin, type AuthenticatedRequest } from '../middleware/auth.js';
import { validateBody, validateParams, validateQuery } from '../../utils/validation.utils.js';
import {
  ListUsersQuerySchema,
  UserIdParamSchema,
  UpdateRateLimitSchema,
  UpdatePlatformSettingsSchema,
} from '../../schemas/admin.schemas.js';

// Admin-only Supabase client (service role) for monitoring tables
const supabaseAdmin = createClient(
  process.env.SUPABASE_URL ?? '',
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
);

const router = Router();

// All admin routes require auth + admin role
router.use(authenticateJWT, requireAdmin);

// ─── GET /admin/users ─────────────────────────────────────────────────────────

router.get('/users', validateQuery(ListUsersQuerySchema), async (req: Request, res: Response) => {
  try {
    const { page, limit } = req.query as unknown as { page: number; limit: number };
    const { users, total } = await authService.listUsers(page, limit);
    res.status(200).json({
      users,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    console.error('[admin/users]', err);
    res.status(500).json({ error: 'Internal Server Error', code: 'LIST_USERS_FAILED' });
  }
});

// ─── GET /admin/rate-limits ───────────────────────────────────────────────────

router.get('/rate-limits', async (_req: Request, res: Response) => {
  try {
    const rateLimits = await authService.listRateLimits();
    res.status(200).json({ rateLimits });
  } catch (err) {
    console.error('[admin/rate-limits]', err);
    res.status(500).json({ error: 'Internal Server Error', code: 'LIST_RATE_LIMITS_FAILED' });
  }
});

// ─── GET /admin/rate-limits/:userId ──────────────────────────────────────────

router.get('/rate-limits/:userId', validateParams(UserIdParamSchema), async (req: Request, res: Response) => {
  const { userId } = req.params as { userId: string };

  try {
    const [profile, limits] = await Promise.allSettled([
      authService.getProfile(userId),
      authService.getRateLimits(userId),
    ]);

    if (profile.status === 'rejected') {
      const code = (profile.reason as NodeJS.ErrnoException).code;
      if (code === 'PROFILE_NOT_FOUND') {
        res.status(404).json({ error: 'Not Found', code: 'USER_NOT_FOUND', message: 'User not found' });
        return;
      }
      throw profile.reason;
    }

    res.status(200).json({
      user:       profile.value,
      rateLimits: limits.status === 'fulfilled' ? limits.value : null,
    });
  } catch (err) {
    console.error('[admin/rate-limits/:userId GET]', err);
    res.status(500).json({ error: 'Internal Server Error', code: 'GET_RATE_LIMIT_FAILED' });
  }
});

// ─── PUT /admin/rate-limits/:userId ──────────────────────────────────────────

router.put(
  '/rate-limits/:userId',
  validateParams(UserIdParamSchema),
  validateBody(UpdateRateLimitSchema),
  async (req: Request, res: Response) => {
  const { userId } = req.params as { userId: string };

  try {
    const updated = await authService.updateRateLimits(userId, req.body as Parameters<typeof authService.updateRateLimits>[1]);
    res.status(200).json({ message: 'Rate limits updated', rateLimits: updated });
  } catch (err) {
    console.error('[admin/rate-limits/:userId PUT]', err);
    res.status(500).json({ error: 'Internal Server Error', code: 'UPDATE_RATE_LIMIT_FAILED' });
  }
});

// ─── DELETE /admin/users/:userId ──────────────────────────────────────────────

router.delete('/users/:userId', validateParams(UserIdParamSchema), async (req: AuthenticatedRequest, res: Response) => {
  const { userId } = req.params as { userId: string };

  // Prevent self-deletion
  if (userId === req.user?.id) {
    res.status(400).json({
      error: 'Bad Request',
      code: 'CANNOT_DELETE_SELF',
      message: 'You cannot delete your own account via the admin endpoint',
    });
    return;
  }

  try {
    await authService.deleteUser(userId);
    console.info(`[admin/users] deleted user=${userId} by admin=${req.user?.id}`);
    res.status(200).json({ message: 'User deleted successfully' });
  } catch (err) {
    console.error('[admin/users/:userId DELETE]', err);
    res.status(500).json({ error: 'Internal Server Error', code: 'DELETE_USER_FAILED' });
  }
});

// ─── GET /admin/settings ──────────────────────────────────────────────────────

router.get('/settings', async (_req: Request, res: Response) => {
  try {
    const data = await authService.getSettings();
    res.status(200).json({ success: true, data });
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === 'SETTINGS_NOT_FOUND') {
      res.status(404).json({ error: 'Settings not found', code: 'SETTINGS_NOT_FOUND' });
      return;
    }
    console.error('[admin/settings GET]', err);
    res.status(500).json({ error: 'Internal Server Error', code: 'GET_SETTINGS_ERROR' });
  }
});

// ─── PUT /admin/settings ──────────────────────────────────────────────────────

router.put(
  '/settings',
  validateBody(UpdatePlatformSettingsSchema),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const data = await authService.updateSettings(req.body, req.user!.id);
      res.status(200).json({ success: true, message: 'Settings updated successfully', data });
    } catch (err) {
      console.error('[admin/settings PUT]', err);
      res.status(500).json({ error: 'Internal Server Error', code: 'UPDATE_SETTINGS_ERROR' });
    }
  },
);

// ─── GET /admin/health ────────────────────────────────────────────────────────

router.get('/health', async (_req: Request, res: Response) => {
  try {
    // Lightweight check: count rate_limits rows
    const { rateLimits } = await authService.listRateLimits().then(r => ({ rateLimits: r }));
    res.status(200).json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      rateLimitCount: rateLimits.length,
    });
  } catch (err) {
    console.error('[admin/health]', err);
    res.status(503).json({ status: 'error', message: 'Admin health check failed' });
  }
});

// ─── GET /admin/api-health ─────────────────────────────────────────────────────
// Returns the latest health check per API (last 24h)

router.get('/api-health', async (_req: Request, res: Response) => {
  try {
    // Latest status per API: subquery picks most recent row per api_name
    const { data, error } = await supabaseAdmin
      .from('api_health_metrics')
      .select('api_name, status, response_time_ms, error_message, checked_at')
      .gte('checked_at', new Date(Date.now() - 24 * 3_600_000).toISOString())
      .order('checked_at', { ascending: false });

    if (error) throw error;

    // Deduplicate: keep most recent row per api_name
    const seen = new Set<string>();
    const latest = (data ?? []).filter((row: { api_name: string }) => {
      if (seen.has(row.api_name)) return false;
      seen.add(row.api_name);
      return true;
    });

    res.status(200).json({ apis: latest });
  } catch (err) {
    console.error('[admin/api-health GET]', err);
    res.status(500).json({ error: 'Internal Server Error', code: 'GET_API_HEALTH_FAILED' });
  }
});

// ─── GET /admin/api-health/history ────────────────────────────────────────────

router.get('/api-health/history', async (req: Request, res: Response) => {
  const apiName = req.query.api as string | undefined;
  const hoursBack = Math.min(Number(req.query.hours ?? 24), 168); // max 7 days

  try {
    let query = supabaseAdmin
      .from('api_health_metrics')
      .select('api_name, status, response_time_ms, checked_at')
      .gte('checked_at', new Date(Date.now() - hoursBack * 3_600_000).toISOString())
      .order('checked_at', { ascending: true })
      .limit(500);

    if (apiName) query = query.eq('api_name', apiName);

    const { data, error } = await query;
    if (error) throw error;

    res.status(200).json({ history: data ?? [] });
  } catch (err) {
    console.error('[admin/api-health/history GET]', err);
    res.status(500).json({ error: 'Internal Server Error', code: 'GET_API_HISTORY_FAILED' });
  }
});

// ─── GET /admin/costs/summary ─────────────────────────────────────────────────

router.get('/costs/summary', async (req: Request, res: Response) => {
  const period = (req.query.period as 'today' | 'month' | 'all_time') ?? 'month';
  const currency = (req.query.currency as string) ?? 'EUR';

  const exchangeRates: Record<string, number> = {
    EUR: 1.00, USD: 1.08, GBP: 0.86, JPY: 161.5, CHF: 0.96,
  };

  try {
    const now = new Date();
    let startDate: string;
    if (period === 'today') {
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    } else if (period === 'month') {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    } else {
      startDate = '2026-01-01T00:00:00Z';
    }

    const { data: costs, error } = await supabaseAdmin
      .from('api_costs')
      .select('api_name, cost_usd')
      .gte('recorded_at', startDate);

    if (error) throw error;

    const rate = exchangeRates[currency] ?? 1.0;
    const costByApi = new Map<string, number>();
    let totalUsd = 0;

    for (const row of (costs ?? []) as Array<{ api_name: string; cost_usd: number }>) {
      costByApi.set(row.api_name, (costByApi.get(row.api_name) ?? 0) + row.cost_usd);
      totalUsd += row.cost_usd;
    }

    const breakdown = Array.from(costByApi.entries())
      .map(([apiName, costUsd]) => ({
        api_name: apiName,
        cost_usd: costUsd,
        cost_in_currency: costUsd * rate,
        percentage: totalUsd > 0 ? (costUsd / totalUsd) * 100 : 0,
      }))
      .sort((a, b) => b.cost_usd - a.cost_usd);

    res.status(200).json({
      period,
      currency,
      total_cost: totalUsd * rate,
      total_cost_usd: totalUsd,
      cost_by_api: breakdown,
      top_5: breakdown.slice(0, 5),
    });
  } catch (err) {
    console.error('[admin/costs/summary GET]', err);
    res.status(500).json({ error: 'Internal Server Error', code: 'GET_COSTS_SUMMARY_FAILED' });
  }
});

// ─── GET /admin/costs/:apiName ────────────────────────────────────────────────

router.get('/costs/:apiName', async (req: Request, res: Response) => {
  const { apiName } = req.params as { apiName: string };
  const currency = (req.query.currency as string) ?? 'EUR';
  const exchangeRates: Record<string, number> = {
    EUR: 1.00, USD: 1.08, GBP: 0.86, JPY: 161.5, CHF: 0.96,
  };

  try {
    const { data: costs, error } = await supabaseAdmin
      .from('api_costs')
      .select('cost_usd, recorded_at')
      .eq('api_name', apiName)
      .order('recorded_at', { ascending: false })
      .limit(30);

    if (error) throw error;

    const rate = exchangeRates[currency] ?? 1.0;
    const dailyMap = new Map<string, number>();

    for (const row of (costs ?? []) as Array<{ cost_usd: number; recorded_at: string }>) {
      const day = row.recorded_at.substring(0, 10);
      dailyMap.set(day, (dailyMap.get(day) ?? 0) + row.cost_usd);
    }

    const daily = Array.from(dailyMap.entries())
      .map(([date, costUsd]) => ({ date, cost_usd: costUsd, cost_in_currency: costUsd * rate }))
      .reverse();

    const totalUsd = daily.reduce((s, d) => s + d.cost_usd, 0);

    res.status(200).json({
      api_name: apiName,
      currency,
      total_cost: totalUsd * rate,
      total_cost_usd: totalUsd,
      daily_costs: daily,
    });
  } catch (err) {
    console.error(`[admin/costs/${req.params.apiName} GET]`, err);
    res.status(500).json({ error: 'Internal Server Error', code: 'GET_API_COSTS_FAILED' });
  }
});

// ─── GET /admin/dlq ───────────────────────────────────────────────────────────

router.get('/dlq', async (_req: Request, res: Response) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('pipeline_dead_letters')
      .select('*')
      .eq('resolved', false)
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) throw error;

    res.status(200).json({ items: data ?? [], total: (data ?? []).length });
  } catch (err) {
    console.error('[admin/dlq GET]', err);
    res.status(500).json({ error: 'Internal Server Error', code: 'GET_DLQ_FAILED' });
  }
});

// ─── POST /admin/dlq/:requestId/retry ────────────────────────────────────────

router.post('/dlq/:requestId/retry', async (req: Request, res: Response) => {
  const { requestId } = req.params as { requestId: string };

  try {
    const { error } = await supabaseAdmin
      .from('pipeline_dead_letters')
      .update({ attempt_count: supabaseAdmin.rpc('increment', { x: 1 }) })
      .eq('id', requestId);

    if (error) throw error;

    res.status(200).json({ message: 'Retry queued', requestId });
  } catch (err) {
    console.error(`[admin/dlq/${requestId}/retry POST]`, err);
    res.status(500).json({ error: 'Internal Server Error', code: 'DLQ_RETRY_FAILED' });
  }
});

// ─── GET /admin/pipeline/certification ────────────────────────────────────────

router.get('/pipeline/certification', async (_req: Request, res: Response) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('certification_scores')
      .select('siret, grade, total_score, computed_at')
      .order('computed_at', { ascending: false })
      .limit(200);

    if (error) throw error;

    const rows = (data ?? []) as Array<{ siret: string; grade: string; total_score: number; computed_at: string }>;

    // Grade distribution
    const distribution: Record<string, number> = { A: 0, B: 0, C: 0, D: 0, E: 0 };
    for (const row of rows) {
      if (row.grade in distribution) distribution[row.grade]++;
    }

    const avgScore = rows.length > 0
      ? rows.reduce((s, r) => s + r.total_score, 0) / rows.length
      : 0;

    res.status(200).json({
      total: rows.length,
      distribution,
      avg_score: Math.round(avgScore * 10) / 10,
      recent: rows.slice(0, 10),
    });
  } catch (err) {
    console.error('[admin/pipeline/certification GET]', err);
    res.status(500).json({ error: 'Internal Server Error', code: 'GET_CERTIFICATION_FAILED' });
  }
});

// ─── GET /admin/pipeline/executions ───────────────────────────────────────────
// Aggregated execution stats from pipeline_executions table

router.get('/pipeline/executions', async (req: Request, res: Response) => {
  const hoursBack = Math.min(Number(req.query.hours ?? 24), 168); // max 7 days

  try {
    const since = new Date(Date.now() - hoursBack * 3_600_000).toISOString();

    const { data, error } = await supabaseAdmin
      .from('pipeline_executions')
      .select('pipeline_name, status, execution_time_ms, started_at, error_message')
      .gte('started_at', since)
      .order('started_at', { ascending: false })
      .limit(1000);

    if (error) throw error;

    type ExecRow = { pipeline_name: string; status: string; execution_time_ms: number | null; started_at: string; error_message: string | null };
    const rows = (data ?? []) as ExecRow[];

    // Aggregate per pipeline
    const byPipeline = new Map<string, {
      total: number; completed: number; failed: number; running: number;
      totalTimeMs: number; validTimeSamples: number;
      lastRun: string; lastError: string | null;
    }>();

    for (const row of rows) {
      const entry = byPipeline.get(row.pipeline_name) ?? {
        total: 0, completed: 0, failed: 0, running: 0,
        totalTimeMs: 0, validTimeSamples: 0, lastRun: '', lastError: null,
      };
      entry.total++;
      if (row.status === 'completed') entry.completed++;
      if (row.status === 'failed') { entry.failed++; if (!entry.lastError) entry.lastError = row.error_message; }
      if (row.status === 'running') entry.running++;
      if (row.execution_time_ms) { entry.totalTimeMs += row.execution_time_ms; entry.validTimeSamples++; }
      if (!entry.lastRun || row.started_at > entry.lastRun) entry.lastRun = row.started_at;
      byPipeline.set(row.pipeline_name, entry);
    }

    const pipelines = Array.from(byPipeline.entries())
      .map(([name, s]) => ({
        pipeline_name:    name,
        total:            s.total,
        completed:        s.completed,
        failed:           s.failed,
        running:          s.running,
        success_rate:     s.total > 0 ? Math.round((s.completed / s.total) * 100) : 0,
        avg_execution_ms: s.validTimeSamples > 0 ? Math.round(s.totalTimeMs / s.validTimeSamples) : null,
        last_run:         s.lastRun || null,
        last_error:       s.lastError,
      }))
      .sort((a, b) => b.total - a.total);

    const totalCompleted = rows.filter(r => r.status === 'completed').length;
    const totalFailed    = rows.filter(r => r.status === 'failed').length;
    const validTimes     = rows.filter(r => r.execution_time_ms).map(r => r.execution_time_ms as number);

    res.status(200).json({
      period_hours:     hoursBack,
      total:            rows.length,
      completed:        totalCompleted,
      failed:           totalFailed,
      success_rate:     rows.length > 0 ? Math.round((totalCompleted / rows.length) * 100) : 0,
      avg_execution_ms: validTimes.length > 0
        ? Math.round(validTimes.reduce((s, t) => s + t, 0) / validTimes.length)
        : null,
      pipelines,
    });
  } catch (err) {
    console.error('[admin/pipeline/executions GET]', err);
    res.status(500).json({ error: 'Internal Server Error', code: 'GET_EXECUTIONS_FAILED' });
  }
});

// ─── GET /admin/pipeline/learning ─────────────────────────────────────────────

router.get('/pipeline/learning', async (_req: Request, res: Response) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('company_profiles')
      .select('siret, raison_sociale, devis_count, learning_confidence, updated_at')
      .order('learning_confidence', { ascending: false })
      .limit(50);

    if (error) throw error;

    const rows = (data ?? []) as Array<{
      siret: string;
      raison_sociale: string;
      devis_count: number;
      learning_confidence: number;
      updated_at: string;
    }>;

    const avgConfidence = rows.length > 0
      ? rows.reduce((s, r) => s + r.learning_confidence, 0) / rows.length
      : 0;

    const fullyLearned = rows.filter(r => r.learning_confidence >= 1.0).length;

    res.status(200).json({
      total_companies: rows.length,
      avg_confidence: Math.round(avgConfidence * 100) / 100,
      fully_learned: fullyLearned,
      companies: rows,
    });
  } catch (err) {
    console.error('[admin/pipeline/learning GET]', err);
    res.status(500).json({ error: 'Internal Server Error', code: 'GET_LEARNING_FAILED' });
  }
});

export default router;
