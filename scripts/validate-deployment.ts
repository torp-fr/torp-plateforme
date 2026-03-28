#!/usr/bin/env tsx
/**
 * validate-deployment.ts — Post-deploy validation script
 *
 * Runs a series of checks against a live deployment to confirm
 * all pipeline services are operational.
 *
 * Usage:
 *   tsx scripts/validate-deployment.ts
 *   tsx scripts/validate-deployment.ts --base-url https://torp-worker.railway.app
 *   tsx scripts/validate-deployment.ts --smoke   (also runs smoke test)
 *
 * Exit codes:
 *   0 — all checks passed
 *   1 — one or more checks failed
 */

const DEFAULT_BASE_URL = process.env['PIPELINE_BASE_URL'] ?? 'http://localhost:3001';

// Parse args
const args = process.argv.slice(2);
const baseUrlArg = args.find(a => a.startsWith('--base-url='))?.split('=')[1]
  ?? (args[args.indexOf('--base-url') + 1] !== undefined && !args[args.indexOf('--base-url') + 1]?.startsWith('--')
    ? args[args.indexOf('--base-url') + 1]
    : null)
  ?? DEFAULT_BASE_URL;

const runSmoke = args.includes('--smoke');

// ─────────────────────────────────────────────────────────────────────────────

interface ValidationResult {
  name:     string;
  passed:   boolean;
  message:  string;
  details?: unknown;
}

const results: ValidationResult[] = [];
let failCount = 0;

function pass(name: string, message: string, details?: unknown) {
  results.push({ name, passed: true, message, details });
  console.log(`  ✓ ${name}: ${message}`);
}

function fail(name: string, message: string, details?: unknown) {
  results.push({ name, passed: false, message, details });
  console.log(`  ✗ ${name}: ${message}`);
  if (details) console.log(`    └─ ${JSON.stringify(details)}`);
  failCount++;
}

async function get(path: string): Promise<{ ok: boolean; status: number; body: unknown }> {
  const url = `${baseUrlArg}${path}`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
    let body: unknown;
    try { body = await res.json(); } catch { body = null; }
    return { ok: res.ok, status: res.status, body };
  } catch (err) {
    return { ok: false, status: 0, body: { error: err instanceof Error ? err.message : String(err) } };
  }
}

async function post(path: string, payload = {}): Promise<{ ok: boolean; status: number; body: unknown }> {
  const url = `${baseUrlArg}${path}`;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(30000),
    });
    let body: unknown;
    try { body = await res.json(); } catch { body = null; }
    return { ok: res.ok, status: res.status, body };
  } catch (err) {
    return { ok: false, status: 0, body: { error: err instanceof Error ? err.message : String(err) } };
  }
}

// ─────────────────────────────────────────────────────────────────────────────

console.log(`\n╔══════════════════════════════════════════════════╗`);
console.log(`║   TORP Pipeline — Deployment Validation          ║`);
console.log(`╚══════════════════════════════════════════════════╝`);
console.log(`\nTarget: ${baseUrlArg}`);
console.log(`Smoke test: ${runSmoke ? 'yes' : 'no (--smoke to enable)'}`);
console.log(`\nRunning checks...\n`);

// ── Check 1: Liveness ─────────────────────────────────────────────────────────
console.log('[ Liveness ]');
{
  const r = await get('/api/v1/pipeline/health');
  if (r.ok && r.status === 200) {
    const body = r.body as Record<string, unknown>;
    pass('liveness', `Process alive — uptime ${body['uptime_s'] ?? '?'}s`);
  } else {
    fail('liveness', `HTTP ${r.status}`, r.body);
  }
}

// ── Check 2: Readiness (DB + config) ─────────────────────────────────────────
console.log('\n[ Readiness ]');
{
  const r = await get('/api/v1/pipeline/health/deep');
  const body = r.body as Record<string, unknown> | null;

  if (!body) {
    fail('readiness', 'No response body');
  } else {
    const checks = (body['checks'] as Array<{ name: string; status: string; message: string }>) ?? [];
    const overall = body['status'] as string;

    if (overall === 'ok') {
      pass('readiness', 'All checks passed');
    } else if (overall === 'degraded') {
      pass('readiness', 'Degraded but operational (some optional vars missing)');
    } else {
      fail('readiness', `System unavailable (${overall})`, body);
    }

    for (const c of checks) {
      const icon = c.status === 'ok' ? '✓' : c.status === 'degraded' ? '~' : '✗';
      console.log(`    ${icon} ${c.name}: ${c.message}`);
    }
  }
}

// ── Check 3: Pipeline status endpoint ────────────────────────────────────────
console.log('\n[ Pipeline API ]');
{
  const r = await get('/api/v1/pipeline/pipelines/status');
  if (r.ok) {
    pass('pipelines/status', 'Endpoint reachable');
  } else if (r.status === 401 || r.status === 403) {
    pass('pipelines/status', 'Endpoint reachable (auth required — expected)');
  } else if (r.status === 404) {
    fail('pipelines/status', 'Route not registered (404)');
  } else {
    fail('pipelines/status', `HTTP ${r.status}`, r.body);
  }
}

// ── Check 4: Audit public endpoint (no auth) ──────────────────────────────────
{
  const r = await get('/api/v1/pipeline/audit/TESTCODE1');
  if (r.status === 404) {
    pass('audit/public', 'Public audit endpoint reachable (TESTCODE1 not found — expected)');
  } else if (r.status === 200 || r.status === 400) {
    pass('audit/public', 'Public audit endpoint reachable');
  } else {
    fail('audit/public', `Unexpected status ${r.status}`, r.body);
  }
}

// ── Check 5: Smoke test (optional) ───────────────────────────────────────────
if (runSmoke) {
  console.log('\n[ Smoke Test — EnrichissementEntreprise ]');
  const r = await post('/api/v1/pipeline/health/smoke');
  const body = r.body as Record<string, unknown> | null;

  if (!body) {
    fail('smoke_test', 'No response body');
  } else if (r.status === 200 && body['status'] !== 'error') {
    pass('smoke_test', `Pipeline executed — status=${body['status']}, duration=${body['duration_ms']}ms`);
    if (body['warnings'] && (body['warnings'] as unknown[]).length > 0) {
      console.log(`    ~ Warnings: ${JSON.stringify(body['warnings'])}`);
    }
  } else {
    fail('smoke_test', `Pipeline smoke test failed`, body);
  }
}

// ── Summary ───────────────────────────────────────────────────────────────────
console.log('\n' + '─'.repeat(52));
console.log(`Results: ${results.filter(r => r.passed).length}/${results.length} passed`);

if (failCount === 0) {
  console.log(`\n✅ Deployment validated successfully.\n`);
  process.exit(0);
} else {
  console.log(`\n❌ ${failCount} check(s) failed. Review the output above.\n`);
  process.exit(1);
}
