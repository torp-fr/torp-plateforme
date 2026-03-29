// ─────────────────────────────────────────────────────────────────────────────
// engine.test.ts — Phase 3B Jalon 3
// Unit tests: EngineService (getStats, getStatus, getLastOrchestration)
//             + Zod query schema validation
// Framework: Vitest + mock Supabase (no real DB calls)
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Supabase mock ────────────────────────────────────────────────────────────

const mockFrom = vi.fn();

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    auth: {
      admin: { createUser: vi.fn(), deleteUser: vi.fn() },
      getUser: vi.fn(),
      signInWithPassword: vi.fn(),
      refreshSession: vi.fn(),
      resetPasswordForEmail: vi.fn().mockResolvedValue({ error: null }),
    },
    from: mockFrom,
  })),
}));

vi.stubEnv('SUPABASE_URL', 'https://test.supabase.co');
vi.stubEnv('SUPABASE_ANON_KEY', 'test-anon-key');
vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'test-service-role-key');
vi.stubEnv('PUBLIC_BASE_URL', 'https://torp.fr');

// ─── Helpers ──────────────────────────────────────────────────────────────────

const NOW = new Date('2026-03-28T12:00:00Z');

function makeJob(status: string, minsAgo: number, durationMs?: number) {
  const createdAt = new Date(NOW.getTime() - minsAgo * 60_000);
  const startedAt = createdAt;
  const completedAt = durationMs != null
    ? new Date(startedAt.getTime() + durationMs)
    : null;
  return {
    status,
    created_at: createdAt.toISOString(),
    started_at: startedAt.toISOString(),
    completed_at: completedAt?.toISOString() ?? null,
  };
}

function makeOrchestrationRun(overrides: Record<string, unknown> = {}) {
  return {
    id: 'run-uuid-1',
    name: 'Orchestration',
    status: 'completed',
    input_count: 10,
    output_count: 9,
    error_count: 1,
    duration_ms: 4200,
    started_at: new Date(NOW.getTime() - 5 * 60_000).toISOString(),
    completed_at: new Date(NOW.getTime() - 1 * 60_000).toISOString(),
    created_at: new Date(NOW.getTime() - 5 * 60_000).toISOString(),
    ...overrides,
  };
}

/** Create a chainable mock for: .from().select().gte().order() */
function makeChain(resolved: unknown) {
  const chain: Record<string, unknown> = {};
  const self = () => chain;
  chain.select    = vi.fn().mockReturnValue(chain);
  chain.gte       = vi.fn().mockReturnValue(chain);
  chain.lte       = vi.fn().mockReturnValue(chain);
  chain.eq        = vi.fn().mockReturnValue(chain);
  chain.order     = vi.fn().mockReturnValue(chain);
  chain.limit     = vi.fn().mockReturnValue(chain);
  chain.single    = vi.fn().mockResolvedValue(resolved);
  chain.maybeSingle = vi.fn().mockResolvedValue(resolved);
  // Array resolution (no .single() / .maybeSingle())
  chain.then      = vi.fn().mockImplementation((cb: (v: unknown) => unknown) => Promise.resolve(resolved).then(cb));
  // Make the chain thenable so await works on it directly
  Object.defineProperty(chain, Symbol.toStringTag, { value: 'MockChain' });
  return chain;
}

/** Wrap resolved array result in { data, error } */
function dbOk(data: unknown) { return { data, error: null }; }
function dbErr(msg: string)  { return { data: null, error: { message: msg, code: 'DB_ERROR' } }; }

// ─── EngineService.getStats ───────────────────────────────────────────────────

describe('EngineService.getStats', () => {
  let engineService: Awaited<ReturnType<typeof import('../core/services/EngineService.js')>>['engineService'];

  beforeEach(async () => {
    vi.resetModules();
    vi.clearAllMocks();
    const mod = await import('../core/services/EngineService.js');
    engineService = mod.engineService;
  });

  it('returns zero metrics when no jobs in period', async () => {
    mockFrom.mockReturnValue({ ...makeChain(dbOk([])), then: undefined });
    // Simulate direct array return
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      gte:    vi.fn().mockReturnThis(),
      order:  vi.fn().mockResolvedValue(dbOk([])),
    });

    const result = await engineService.getStats('24h');

    expect(result.metrics.total_executions).toBe(0);
    expect(result.metrics.successful).toBe(0);
    expect(result.metrics.failed).toBe(0);
    expect(result.metrics.success_rate).toBe(0);
    expect(result.timeline).toHaveLength(0);
    expect(result.period).toBe('24h');
  });

  it('computes success_rate from completed/total ratio', async () => {
    const jobs = [
      makeJob('completed', 10, 2000),
      makeJob('completed', 20, 3000),
      makeJob('failed',    30),
      makeJob('failed',    40),
    ];
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      gte:    vi.fn().mockReturnThis(),
      order:  vi.fn().mockResolvedValue(dbOk(jobs)),
    });

    const result = await engineService.getStats('24h');

    expect(result.metrics.total_executions).toBe(4);
    expect(result.metrics.successful).toBe(2);
    expect(result.metrics.failed).toBe(2);
    expect(result.metrics.success_rate).toBe(50.0);
  });

  it('computes average_duration_ms from started_at/completed_at', async () => {
    const jobs = [
      makeJob('completed', 5,  4000),  // 4000ms
      makeJob('completed', 10, 6000),  // 6000ms — avg = 5000ms
    ];
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      gte:    vi.fn().mockReturnThis(),
      order:  vi.fn().mockResolvedValue(dbOk(jobs)),
    });

    const result = await engineService.getStats('1h');

    expect(result.metrics.average_duration_ms).toBe(5000);
  });

  it('groups jobs into hourly timeline buckets', async () => {
    const jobs = [
      makeJob('completed', 10),
      makeJob('completed', 20),
      makeJob('failed',    70),  // 1h10m ago — different bucket
    ];
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      gte:    vi.fn().mockReturnThis(),
      order:  vi.fn().mockResolvedValue(dbOk(jobs)),
    });

    const result = await engineService.getStats('24h');

    // Must have at least 2 distinct buckets
    expect(result.timeline.length).toBeGreaterThanOrEqual(2);
    // Each bucket has required fields
    for (const entry of result.timeline) {
      expect(entry).toHaveProperty('timestamp');
      expect(entry).toHaveProperty('executions');
      expect(entry).toHaveProperty('successes');
      expect(entry).toHaveProperty('failures');
      expect(entry).toHaveProperty('avg_duration_ms');
    }
  });

  it('throws on DB error', async () => {
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      gte:    vi.fn().mockReturnThis(),
      order:  vi.fn().mockResolvedValue(dbErr('Connection refused')),
    });

    await expect(engineService.getStats('24h')).rejects.toThrow('DB error');
  });

  it('accepts all valid period values', async () => {
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      gte:    vi.fn().mockReturnThis(),
      order:  vi.fn().mockResolvedValue(dbOk([])),
    });

    for (const period of ['1h', '24h', '7d'] as const) {
      const result = await engineService.getStats(period);
      expect(result.period).toBe(period);
    }
  });
});

// ─── EngineService.getStatus ──────────────────────────────────────────────────

describe('EngineService.getStatus', () => {
  let engineService: Awaited<ReturnType<typeof import('../core/services/EngineService.js')>>['engineService'];

  beforeEach(async () => {
    vi.resetModules();
    vi.clearAllMocks();
    const mod = await import('../core/services/EngineService.js');
    engineService = mod.engineService;
  });

  it('returns degraded status when 10% < error_rate <= 30%', async () => {
    // 2/10 = 20% — degraded range (10 < 20 <= 30)
    const jobs = Array.from({ length: 10 }, (_, i) =>
      makeJob(i < 8 ? 'completed' : 'failed', i + 1)
    );
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      gte:    vi.fn().mockReturnThis(),
      order:  vi.fn().mockResolvedValue(dbOk(jobs)),
    });

    const result = await engineService.getStatus();
    expect(result.status).toBe('degraded');
  });

  it('returns operational when all jobs succeed', async () => {
    const jobs = [makeJob('completed', 5), makeJob('completed', 10)];
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      gte:    vi.fn().mockReturnThis(),
      order:  vi.fn().mockResolvedValue(dbOk(jobs)),
    });

    const result = await engineService.getStatus();
    expect(result.status).toBe('operational');
    expect(result.health_score).toBe(100);
  });

  it('returns down when error_rate > 30%', async () => {
    const jobs = Array.from({ length: 10 }, (_, i) =>
      makeJob(i < 6 ? 'failed' : 'completed', i + 1)
    ); // 6/10 = 60%
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      gte:    vi.fn().mockReturnThis(),
      order:  vi.fn().mockResolvedValue(dbOk(jobs)),
    });

    const result = await engineService.getStatus();
    expect(result.status).toBe('down');
    expect(result.health_score).toBeLessThan(50);
  });

  it('returns operational with health_score=100 when no jobs', async () => {
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      gte:    vi.fn().mockReturnThis(),
      order:  vi.fn().mockResolvedValue(dbOk([])),
    });

    const result = await engineService.getStatus();
    expect(result.status).toBe('operational');
    expect(result.health_score).toBe(100);
    expect(result.details.total_executions_1h).toBe(0);
  });

  it('counts pending and processing in processing_queue', async () => {
    const jobs = [
      makeJob('pending',    1),
      makeJob('pending',    2),
      makeJob('processing', 3),
      makeJob('completed',  4),
    ];
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      gte:    vi.fn().mockReturnThis(),
      order:  vi.fn().mockResolvedValue(dbOk(jobs)),
    });

    const result = await engineService.getStatus();
    expect(result.details.pending).toBe(2);
    expect(result.details.in_progress).toBe(1);
    expect(result.details.processing_queue).toBe(3);
  });

  it('throws on DB error', async () => {
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      gte:    vi.fn().mockReturnThis(),
      order:  vi.fn().mockResolvedValue(dbErr('timeout')),
    });

    await expect(engineService.getStatus()).rejects.toThrow('DB error');
  });
});

// ─── EngineService.getLastOrchestration ───────────────────────────────────────

describe('EngineService.getLastOrchestration', () => {
  let engineService: Awaited<ReturnType<typeof import('../core/services/EngineService.js')>>['engineService'];

  beforeEach(async () => {
    vi.resetModules();
    vi.clearAllMocks();
    const mod = await import('../core/services/EngineService.js');
    engineService = mod.engineService;
  });

  it('returns run data when a row exists', async () => {
    const run = makeOrchestrationRun();
    mockFrom.mockReturnValue({
      select:      vi.fn().mockReturnThis(),
      order:       vi.fn().mockReturnThis(),
      limit:       vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue(dbOk(run)),
    });

    const result = await engineService.getLastOrchestration();

    expect(result.id).toBe('run-uuid-1');
    expect(result.status).toBe('completed');
    expect(result.input_count).toBe(10);
    expect(result.output_count).toBe(9);
    expect(result.error_count).toBe(1);
    expect(result.duration_ms).toBe(4200);
  });

  it('returns idle state when no row exists (null from maybeSingle)', async () => {
    mockFrom.mockReturnValue({
      select:      vi.fn().mockReturnThis(),
      order:       vi.fn().mockReturnThis(),
      limit:       vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue(dbOk(null)),
    });

    const result = await engineService.getLastOrchestration();

    expect(result.id).toBeNull();
    expect(result.status).toBe('idle');
    expect(result.duration_ms).toBe(0);
  });

  it('falls back to duration_ms=0 when column is null', async () => {
    const run = makeOrchestrationRun({ duration_ms: null });
    mockFrom.mockReturnValue({
      select:      vi.fn().mockReturnThis(),
      order:       vi.fn().mockReturnThis(),
      limit:       vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue(dbOk(run)),
    });

    const result = await engineService.getLastOrchestration();
    expect(result.duration_ms).toBe(0);
  });

  it('throws on DB error (non-PGRST116)', async () => {
    mockFrom.mockReturnValue({
      select:      vi.fn().mockReturnThis(),
      order:       vi.fn().mockReturnThis(),
      limit:       vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue(dbErr('internal error')),
    });

    await expect(engineService.getLastOrchestration()).rejects.toThrow('DB error');
  });
});

// ─── Zod query schema ─────────────────────────────────────────────────────────

describe('StatsQuerySchema (period validation)', () => {
  it('accepts valid period values', () => {
    const { z } = require('zod');
    const PeriodSchema = z.object({ period: z.enum(['1h', '24h', '7d']).default('24h') });

    expect(PeriodSchema.safeParse({ period: '1h' }).success).toBe(true);
    expect(PeriodSchema.safeParse({ period: '24h' }).success).toBe(true);
    expect(PeriodSchema.safeParse({ period: '7d' }).success).toBe(true);
  });

  it('defaults to 24h when period is omitted', () => {
    const { z } = require('zod');
    const PeriodSchema = z.object({ period: z.enum(['1h', '24h', '7d']).default('24h') });
    const result = PeriodSchema.parse({});
    expect(result.period).toBe('24h');
  });

  it('rejects invalid period values', () => {
    const { z } = require('zod');
    const PeriodSchema = z.object({ period: z.enum(['1h', '24h', '7d']).default('24h') });
    expect(PeriodSchema.safeParse({ period: '30d' }).success).toBe(false);
    expect(PeriodSchema.safeParse({ period: '' }).success).toBe(false);
  });
});
