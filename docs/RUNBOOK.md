# TORP Pipeline — Operations Runbook

> **Audience**: engineers on-call or doing a deploy. Keep this open when doing ops work.

---

## 1. Architecture Quick Reference

```
API Routes  →  PipelineOrchestrator  →  5 independent handlers
                      │
                      └─ pipeline_executions (Supabase)
                         entreprises / clients / projets / devis / audits / qrcodes
```

**5 pipelines and when they run:**

| Pipeline | Trigger | Output |
|----------|---------|--------|
| EnrichissementEntreprise | SIRET registered | `rcs_data`, `certifications`, `reputation` |
| ClientLocalization | Client created | `localisation` (lat/lng, normalized address) |
| ContextRegulation | Project created | `contexte_reglementaire` (PLU, ABF, aides) |
| DevisParsing | File uploaded | `parsing_result` (items, montant_ht, TVA) |
| AuditScoring | Devis parsed | `audits` record + `qrcodes` entry |

---

## 2. Health Checks

### Liveness (is the process alive?)
```
GET /api/v1/pipeline/health
→ 200 { status: "ok", uptime_s: 42 }
```

### Readiness (is the system operational?)
```
GET /api/v1/pipeline/health/deep
→ 200 { status: "ok"|"degraded"|"unavailable", checks: [...] }
```
- `ok` → all required services up
- `degraded` → running but some optional APIs unconfigured
- `unavailable` → DB unreachable or required config missing

### Deployment validation
```bash
tsx scripts/validate-deployment.ts --base-url https://your-worker.railway.app
tsx scripts/validate-deployment.ts --base-url https://your-worker.railway.app --smoke
```

---

## 3. Common Operations

### Check recent pipeline executions
```bash
tsx scripts/pipeline-cli.ts status
tsx scripts/pipeline-cli.ts status EnrichissementEntreprise
```

### Manually trigger a pipeline
```bash
# Enrich an entreprise by SIRET
tsx scripts/pipeline-cli.ts enrich 12345678901234

# Geocode an address
tsx scripts/pipeline-cli.ts geocode "12 rue de la Paix, Paris"

# Fetch regulation context for a project
tsx scripts/pipeline-cli.ts context <projet_id>

# Parse a devis
tsx scripts/pipeline-cli.ts parse <devis_id>

# Score a parsed devis
tsx scripts/pipeline-cli.ts score <devis_id>
```

### Retry failed executions
```bash
# Retry all failed
tsx scripts/pipeline-cli.ts retry-failed

# Retry specific pipeline
tsx scripts/pipeline-cli.ts retry-failed EnrichissementEntreprise
```

---

## 4. Troubleshooting

### Pipeline stuck in `processing` state

**Symptoms**: `pipeline_executions.status = 'processing'` for > 5 minutes.

**Cause**: Worker crashed mid-execution and did not update status.

**Fix**:
```sql
-- In Supabase SQL editor
UPDATE pipeline_executions
SET status = 'failed',
    error_message = 'Worker crash — reset by ops'
WHERE status = 'processing'
  AND started_at < NOW() - INTERVAL '5 minutes';
```

Then retry:
```bash
tsx scripts/pipeline-cli.ts retry-failed
```

---

### `EnrichissementEntreprise` always returns `rcs_data: null`

**Cause**: `PAPPERS_API_KEY` not set or exhausted.

**Check**:
```bash
tsx scripts/pipeline-cli.ts enrich 55207770400015
# Look for: "warnings": ["Pappers API call failed: ..."]
```

**Fix**: Set `PAPPERS_API_KEY` in Railway dashboard → Variables.
Fallback: pipeline still completes with `rcs_data: null` and certifications from data.gouv.

---

### `ClientLocalization` returns geocoding failed

**Cause**: BANO API down or address is too vague.

**Diagnosis**:
```bash
tsx scripts/pipeline-cli.ts geocode "12 rue de la Paix, Paris"
```

**Fix**:
1. Try a more specific address (house number + city)
2. BANO and Nominatim are free — no key needed. If both fail, it's a temporary outage.
3. Retry automatically: `retryable: true` means the worker will retry up to 3 times.

---

### `ContextRegulation` skips PLU / ABF

**Cause**: IGN key not set, or project type doesn't require these checks.

**Check** `config.features.ignEnabled` in health deep endpoint output.

**Expected behavior**: For `electricite_seule` project type, no external APIs are called — `needs_fetched: []`.

---

### `AuditScoring` fails with "Devis not found"

**Cause**: The chained call from `onDevisParsed` happened before the `devis` DB update committed (race condition in very fast execution).

**Fix**: Re-trigger scoring manually:
```bash
tsx scripts/pipeline-cli.ts score <devis_id>
```

---

### QR code access URL returns 404

**Cause**: `PUBLIC_BASE_URL` misconfigured in worker env, generating wrong access URLs.

**Check**:
```sql
SELECT short_code, access_url FROM qrcodes ORDER BY created_at DESC LIMIT 5;
```

**Fix**: Set `PUBLIC_BASE_URL=https://torp.fr` in Railway Variables, then regenerate affected QR codes via:
```bash
tsx scripts/pipeline-cli.ts score <devis_id>   # rewrites audit + new QR
```

---

### Worker not picking up pending executions

**Cause**: `cron.ts` scheduler not running (Railway worker process down).

**Check**: Railway dashboard → Deployments → worker logs.

**Fix**:
```bash
# Railway CLI
railway up --service worker
# or trigger redeploy from dashboard
```

---

## 5. Environment Variables Reference

| Variable | Required | Description |
|----------|----------|-------------|
| `SUPABASE_URL` | ✅ | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | Service role key (never expose to frontend) |
| `PUBLIC_BASE_URL` | ✅ | Base URL for QR code links (`https://torp.fr`) |
| `PAPPERS_API_KEY` | Optional | RCS / NAF / effectifs enrichment |
| `IGN_API_KEY` | Optional | Cadastre + PLU lookups |
| `LEGIFRANCE_API_KEY` | Optional | ABF zones, regulatory texts |
| `TRUSTPILOT_API_KEY` | Optional | Reputation scoring (B2B paid) |
| `PIPELINE_TIMEOUT_MS` | Optional | Per-pipeline timeout (default 30000) |
| `API_CALL_TIMEOUT_MS` | Optional | Per-API-call timeout (default 5000) |
| `RETRY_MAX_ATTEMPTS` | Optional | Max retries on failure (default 3) |
| `PIPELINE_JWT_SECRET` | Optional | JWT for pipeline API auth |

---

## 6. Database Reference

### Check pipeline execution counts by status
```sql
SELECT pipeline_name, status, COUNT(*) as n
FROM pipeline_executions
GROUP BY pipeline_name, status
ORDER BY pipeline_name, status;
```

### Find slow executions (> 10s)
```sql
SELECT pipeline_name, entity_type, entity_id, execution_time_ms, started_at
FROM pipeline_executions
WHERE execution_time_ms > 10000
ORDER BY execution_time_ms DESC
LIMIT 20;
```

### Check QR code scan stats
```sql
SELECT short_code, (access_stats->>'scans')::int as scans, access_url, created_at
FROM qrcodes
ORDER BY scans DESC
LIMIT 20;
```

### Reset a specific document to pending (for re-ingestion)
```sql
UPDATE pipeline_executions
SET status = 'pending', retry_count = 0, error_message = NULL
WHERE id = '<execution_id>';
```

---

## 7. Cron Schedule

The worker runs two scheduled jobs:

| Job | Frequency | What it does |
|-----|-----------|-------------|
| Entreprise refresh | Weekly (Sundays) | Re-runs enrichment for active entreprises with stale data (> 7 days) |
| Context refresh | Bi-weekly | Re-fetches PLU/ABF/aides for active projects (> 14 days) |

To run manually:
```bash
# Force refresh all entreprises
node -e "
const { PipelineOrchestrator } = require('./dist/core/orchestration/PipelineOrchestrator.js');
const orch = new PipelineOrchestrator();
orch.refreshAllEntreprises().then(() => process.exit(0));
"
```

---

## 8. Deployment Checklist

Before deploying a new version:

- [ ] `pnpm build` passes without errors
- [ ] `pnpm test` passes (or known failures are triaged)
- [ ] All required env vars are set in Railway dashboard
- [ ] Migration files applied if any schema changes
- [ ] `tsx scripts/validate-deployment.ts --base-url <staging-url>` passes
- [ ] QR code generation verified on staging with a test devis

After deploying:

- [ ] `tsx scripts/validate-deployment.ts --base-url <prod-url> --smoke` passes
- [ ] Check `pipeline_executions` table for new errors in first 5 minutes
- [ ] Verify one end-to-end flow (register SIRET → upload devis → check audit)
