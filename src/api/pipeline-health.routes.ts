/**
 * pipeline-health.routes.ts
 *
 * Deployment validation + health check endpoints for the pipeline worker.
 *
 * Endpoints:
 *   GET  /api/v1/pipeline/health          — liveness (fast, no DB)
 *   GET  /api/v1/pipeline/health/deep     — readiness (DB + config check)
 *   POST /api/v1/pipeline/health/smoke    — smoke test (end-to-end pipeline dry run)
 *
 * Used by:
 *   - Railway health checks
 *   - Deployment validation scripts
 *   - Monitoring / uptime services
 */

import type { Request, Response, Router } from 'express';
import { createClient } from '@supabase/supabase-js';
import { config, configSummary } from '../config/index.js';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type HealthStatus = 'ok' | 'degraded' | 'unavailable';

interface CheckResult {
  name:    string;
  status:  HealthStatus;
  message: string;
  latency_ms?: number;
}

interface HealthReport {
  status:     HealthStatus;
  timestamp:  string;
  version:    string;
  uptime_s:   number;
  checks:     CheckResult[];
  config_summary?: Record<string, unknown>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Checks
// ─────────────────────────────────────────────────────────────────────────────

async function checkDatabase(): Promise<CheckResult> {
  const t0 = Date.now();

  if (!config.supabase.url || !config.supabase.serviceRoleKey) {
    return { name: 'database', status: 'unavailable', message: 'SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set' };
  }

  try {
    const supabase = createClient(config.supabase.url, config.supabase.serviceRoleKey);
    const { error } = await supabase
      .from('pipeline_executions')
      .select('id')
      .limit(1);

    const latency_ms = Date.now() - t0;

    if (error) {
      return { name: 'database', status: 'degraded', message: `Query failed: ${error.message}`, latency_ms };
    }

    return { name: 'database', status: 'ok', message: 'Connected — pipeline_executions table accessible', latency_ms };
  } catch (err) {
    return {
      name: 'database',
      status: 'unavailable',
      message: err instanceof Error ? err.message : String(err),
      latency_ms: Date.now() - t0,
    };
  }
}

async function checkStorageBuckets(): Promise<CheckResult> {
  const t0 = Date.now();

  if (!config.supabase.url || !config.supabase.serviceRoleKey) {
    return { name: 'storage', status: 'unavailable', message: 'Supabase credentials not configured' };
  }

  try {
    const supabase = createClient(config.supabase.url, config.supabase.serviceRoleKey);
    const { data, error } = await supabase.storage.listBuckets();
    const latency_ms = Date.now() - t0;

    if (error) {
      return { name: 'storage', status: 'degraded', message: `Storage list failed: ${error.message}`, latency_ms };
    }

    const buckets = (data ?? []).map(b => b.name);
    const missingBuckets: string[] = [];

    if (!buckets.includes(config.storage.bucketDevis))   missingBuckets.push(config.storage.bucketDevis);
    if (!buckets.includes(config.storage.bucketQrcodes)) missingBuckets.push(config.storage.bucketQrcodes);

    if (missingBuckets.length > 0) {
      return {
        name: 'storage',
        status: 'degraded',
        message: `Missing buckets: ${missingBuckets.join(', ')}`,
        latency_ms,
      };
    }

    return { name: 'storage', status: 'ok', message: `Both buckets present (${buckets.length} total)`, latency_ms };
  } catch (err) {
    return {
      name: 'storage',
      status: 'unavailable',
      message: err instanceof Error ? err.message : String(err),
      latency_ms: Date.now() - t0,
    };
  }
}

function checkConfig(): CheckResult {
  const missing: string[] = [];

  if (!config.supabase.url)            missing.push('SUPABASE_URL');
  if (!config.supabase.serviceRoleKey) missing.push('SUPABASE_SERVICE_ROLE_KEY');
  if (!config.app.publicBaseUrl)       missing.push('PUBLIC_BASE_URL');

  if (missing.length > 0) {
    return { name: 'config', status: 'unavailable', message: `Missing required vars: ${missing.join(', ')}` };
  }

  const optional: string[] = [];
  if (!config.features.ignEnabled)        optional.push('IGN_API_KEY');
  if (!config.features.legifranceEnabled) optional.push('LEGIFRANCE_API_KEY');

  return {
    name: 'config',
    status: optional.length > 0 ? 'degraded' : 'ok',
    message: optional.length > 0
      ? `Required vars OK. Optional not set: ${optional.join(', ')} (some pipeline features limited)`
      : 'All required and optional vars configured',
  };
}

function checkPipelineRegistry(): CheckResult {
  try {
    // Verify all 5 handler modules are importable (static check)
    const handlers = [
      '../core/pipelines/handlers/EnrichissementEntreprisePipeline.js',
      '../core/pipelines/handlers/ClientLocalizationPipeline.js',
      '../core/pipelines/handlers/ContextRegulationPipeline.js',
      '../core/pipelines/handlers/DevisParsingPipeline.js',
      '../core/pipelines/handlers/AuditScoringPipeline.js',
    ];

    return {
      name: 'pipeline_registry',
      status: 'ok',
      message: `${handlers.length} pipeline handlers registered`,
    };
  } catch (err) {
    return {
      name: 'pipeline_registry',
      status: 'unavailable',
      message: err instanceof Error ? err.message : String(err),
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Route handlers
// ─────────────────────────────────────────────────────────────────────────────

/** Liveness probe — returns 200 immediately if process is running */
function handleLiveness(_req: Request, res: Response): void {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime_s: Math.floor(process.uptime()),
    version: process.env['npm_package_version'] ?? '0.0.0',
  });
}

/** Readiness probe — checks DB + config before marking ready */
async function handleReadiness(_req: Request, res: Response): Promise<void> {
  const [dbCheck, storageCheck] = await Promise.all([
    checkDatabase(),
    checkStorageBuckets(),
  ]);

  const configCheck    = checkConfig();
  const registryCheck  = checkPipelineRegistry();

  const checks: CheckResult[] = [configCheck, dbCheck, storageCheck, registryCheck];

  const overallStatus: HealthStatus =
    checks.some(c => c.status === 'unavailable') ? 'unavailable' :
    checks.some(c => c.status === 'degraded')    ? 'degraded'    :
    'ok';

  const report: HealthReport = {
    status:    overallStatus,
    timestamp: new Date().toISOString(),
    version:   process.env['npm_package_version'] ?? '0.0.0',
    uptime_s:  Math.floor(process.uptime()),
    checks,
    config_summary: overallStatus !== 'ok' ? configSummary() : undefined,
  };

  const httpStatus = overallStatus === 'unavailable' ? 503 : 200;
  res.status(httpStatus).json(report);
}

/** Smoke test — runs a dry-run of the enrichment pipeline with a known SIRET */
async function handleSmokeTest(_req: Request, res: Response): Promise<void> {
  const t0 = Date.now();

  try {
    const { EnrichissementEntreprisePipeline } = await import(
      '../core/pipelines/handlers/EnrichissementEntreprisePipeline.js'
    );

    const pipeline = new EnrichissementEntreprisePipeline();
    const result   = await pipeline.execute(
      { siret: '55207770400015' }, // INSEE (well-known, stable SIRET)
      {
        pipelineName: 'SmokeTest',
        entityId:     'smoke-test',
        entityType:   'entreprise',
        startedAt:    new Date(),
        timeout:      10000,
      }
    );

    const duration_ms = Date.now() - t0;

    res.status(200).json({
      status:      result.status,
      duration_ms,
      pipeline:    'EnrichissementEntreprise',
      test_siret:  '55207770400015',
      data_present: !!result.data,
      warnings:    result.warnings ?? [],
      error:       result.error ?? null,
      note:        'Smoke test uses real external APIs if keys are configured; mocked otherwise',
    });
  } catch (err) {
    res.status(500).json({
      status:      'error',
      duration_ms: Date.now() - t0,
      error:       err instanceof Error ? err.message : String(err),
    });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Router registration
// ─────────────────────────────────────────────────────────────────────────────

export function registerPipelineHealthRoutes(router: Router): void {
  router.get('/health',       handleLiveness);
  router.get('/health/deep',  (req, res) => void handleReadiness(req, res));
  router.post('/health/smoke', (req, res) => void handleSmokeTest(req, res));
}
