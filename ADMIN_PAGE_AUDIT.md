# Admin Page Audit — TORP Platform
> Generated 2026-03-28 — pre-PROMPT G baseline

---

## Current Tabs / Sections

| Route | Page Component | Purpose | Auto-refresh |
|-------|---------------|---------|-------------|
| `/admin` | `DashboardPage.tsx` | Quick-actions hub + `OverviewTab` | — |
| `/admin/users` | `AdminUsersPage.tsx` | User list, promote/demote, stats | — |
| `/admin/orchestrations` | `OrchestrationsPage.tsx` | Job status distribution (active/done/pending) | 30 s |
| `/admin/intelligence` | `LiveIntelligencePage.tsx` | Global stats, recent analysis jobs | 60 s |
| `/admin/knowledge` | `KnowledgeBasePage.tsx` | RAG upload + library + ingestion metrics | event-driven |
| `/admin/knowledge-debug` | `KnowledgeControlCenter` | Debug / advanced RAG tools | — |
| `/admin/system` | `SystemHealthPage.tsx` | DB/API/Storage status + security controls | 30 s |
| `/admin/settings` | `AdminSettingsPage.tsx` | Platform name, maintenance mode, notifications, security | — |

> `SecurityPage.tsx` also exists at `/admin/security` but is not in the live nav — partial overlap with SystemHealthPage.

---

## Navigation Structure

```
AdminRoute (guard) → AdminLayout (sidebar)
  └─ /admin/*
       ├─ index          → DashboardPage
       ├─ users          → AdminUsersPage
       ├─ orchestrations → OrchestrationsPage
       ├─ intelligence   → LiveIntelligencePage
       ├─ knowledge      → KnowledgeBasePage
       ├─ knowledge-debug → KnowledgeControlCenter
       ├─ system         → SystemHealthPage
       └─ settings       → AdminSettingsPage
```

### Adding a new tab

1. Add a route constant to `src/navigation/admin.navigation.ts`:
   ```typescript
   ADMIN_ROUTES.API_MONITORING = '/admin/api-monitoring'
   ```
2. Add a nav item to `src/components/layout/AdminLayout.tsx` sidebar array.
3. Add a `<Route>` in `App.tsx` inside the admin block.

---

## Reusable Components (`src/components/admin/`)

| Component | File | Reuse opportunity |
|-----------|------|-------------------|
| `MetricCard` | `DashboardMetrics.tsx` | KPI tile (title, value, change%, icon, trend) |
| `EngineStatusGrid` | `DashboardMetrics.tsx` | 3-col status grid with badges |
| `GradeDistribution` | `DashboardMetrics.tsx` | Horizontal progress-bar chart (A–E) |
| `FraudDistribution` | `DashboardMetrics.tsx` | 2×2 risk-level grid |
| `RecentOrchestrationTable` | `DashboardMetrics.tsx` | Paginated table with badges |
| `SystemHealthPanel` | `SystemHealthPanel.tsx` | Full health dashboard (API status, circuit breakers, cache) |
| `CockpitOrchestration` | `CockpitOrchestration.tsx` | Complete cockpit with 8 sections |
| `RAGStatusStrip` | `RAGStatusStrip.tsx` | 4-col pipeline-status strip |
| `VectorHealthPanel` | `VectorHealthPanel.tsx` | 3-col vector DB strip |
| `AICommandCenterStrip` | `AICommandCenterStrip.tsx` | Heartbeat + orchestrator state |
| `IngestionMetricsPanel` | `IngestionMetricsPanel.tsx` | 3 time-window document counts |
| `KnowledgeLibraryManager` | `KnowledgeLibraryManager.tsx` | Searchable doc table with pagination |
| `EmbeddingQueuePanel` | `EmbeddingQueuePanel.tsx` | Live embedding queue (10 s refresh) |
| `CockpitHeader` | `CockpitHeader.tsx` | Sticky "TORP Control Center" header + status badges |
| `QuickActions` | `QuickActions.tsx` | 4-card action panel |

---

## Existing API Routes (`/api/v1/admin/`)

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/admin/users` | Paginated user list |
| DELETE | `/admin/users/:userId` | Hard delete user |
| GET | `/admin/rate-limits` | All rate-limit configs |
| GET | `/admin/rate-limits/:userId` | Per-user rate limits + usage |
| PUT | `/admin/rate-limits/:userId` | Update user rate limits |
| GET | `/admin/settings` | Platform settings |
| PUT | `/admin/settings` | Update platform settings |
| GET | `/admin/health` | Lightweight health ping |

### Other admin-adjacent endpoints already in use

| Method | Endpoint | Used by |
|--------|----------|---------|
| GET | `/api/v1/analytics/global-stats` | LiveIntelligencePage |
| GET | `/api/v1/analytics/recent-jobs` | LiveIntelligencePage |
| GET | `/api/v1/analytics/job-status` | OrchestrationsPage |
| GET | `/api/v1/platform/health` | SystemHealthPage, SecurityPage |
| GET | `/api/v1/engine/stats` | CockpitOrchestration |
| GET | `/api/v1/system/health` | SystemHealthPanel |

---

## Data Sources (Supabase tables currently queried)

| Table | Used by |
|-------|---------|
| `profiles` | AdminUsersPage (via admin.service) |
| `platform_settings` | AdminSettingsPage |
| `analysis_jobs` | OrchestrationsPage |
| `knowledge_documents` | KnowledgeBasePage, RAGStatusStrip, VectorHealthPanel, EmbeddingQueuePanel, IngestionMetricsPanel |
| `admin_audit_log` | admin.service (getAuditLog, not yet surfaced in UI) |
| `rate_limits` | admin.routes (rate-limit endpoints) |

---

## State Management Patterns

### Pattern A — Fetch-on-mount + interval refresh
```typescript
useEffect(() => {
  fetchData();
  const id = setInterval(fetchData, 30_000);
  return () => clearInterval(id);
}, []);
```
Used by: SystemHealthPage (30 s), SecurityPage (30 s), OrchestrationsPage (30 s), LiveIntelligencePage (60 s)

### Pattern B — Window event bus
```typescript
window.addEventListener('RAG_OPS_EVENT', handler);
window.dispatchEvent(new Event('RAG_LIBRARY_REFRESH'));
```
Used by: RAGStatusStrip, VectorHealthPanel, KnowledgeLibraryManager, EmbeddingQueuePanel, AICommandCenterStrip

### Pattern C — Supabase session JWT for API calls
```typescript
const { data: { session } } = await supabase.auth.getSession();
fetch(url, { headers: { Authorization: `Bearer ${session.access_token}` } });
```
Used by: adminSettings.service.ts — all admin API calls follow this pattern.

---

## UI / Styling

| Concern | Approach |
|---------|---------|
| Component library | shadcn/ui (`Card`, `Badge`, `Button`, `Table`, `Alert`, `Skeleton`) |
| Icons | Lucide React |
| Styling | Tailwind CSS utility classes |
| Charts | **None** — progress bars (`<div style={{ width: '%' }}>`) + KPI cards + tables |
| Dark mode | `next-themes` (already in package.json) |

**recharts is in `package.json` as a dependency** — it's installed but not used in any admin page yet. PROMPT G can freely adopt it.

---

## Gaps / What Does NOT Exist Yet

| Gap | Notes |
|-----|-------|
| API cost tracking / spend dashboard | No cost data stored; no endpoint; no UI |
| External API health monitoring page | `SystemHealthPanel` shows circuit breakers but is embedded in cockpit, not a standalone page |
| Pipeline metrics visualization | `pipeline_metrics` table created in migration 20260328000005 but never read in UI |
| Per-API quota usage charts | Partial in `SystemHealthPanel` (text only, no time-series) |
| Certification / star scores UI | `certification_scores` table created but no admin view |
| Company memory / learning dashboard | `company_profiles` table created but no admin view |
| Dead-letter queue (DLQ) management | `pipeline_dead_letters` table created but no admin view |
| Benchmark results explorer | `benchmark_results` table created but no admin view |

---

## Recommendations for PROMPT G

### 1. Add new tabs without touching existing routes
```typescript
// admin.navigation.ts
ADMIN_ROUTES.API_MONITORING  = '/admin/api-monitoring'   // new
ADMIN_ROUTES.COST_TRACKING   = '/admin/costs'            // new
ADMIN_ROUTES.PIPELINE_HEALTH = '/admin/pipeline-health'  // new
```
Then add 3 entries to the `AdminLayout.tsx` sidebar array.

### 2. Reuse `MetricCard` for all KPI tiles
All numeric KPIs (cost today, API calls, error rate) should use the existing `MetricCard` component from `DashboardMetrics.tsx`. It already supports `change%`, `trend` (up/down), `loading` skeleton.

### 3. Reuse `SystemHealthPanel` as a subcomponent
Don't re-implement circuit-breaker / API health display. Either extend `SystemHealthPanel` or embed it in the new API Monitoring page with a different data source.

### 4. Follow the Fetch-on-mount + interval pattern (Pattern A)
All new monitoring pages should use `setInterval(fetch, 30_000)` with cleanup. Match existing refresh rates.

### 5. recharts is available — use it for time-series data
Since it's already in `package.json` and no admin page uses it yet, PROMPT G is the right moment to introduce time-series cost charts / API call volume charts with recharts.

### 6. Add new backend routes under `/api/v1/admin/`
Pattern: authenticate with `authenticateJWT` + `requireAdmin`, then query Supabase with service role. Validate body with Zod. See `admin.routes.ts` for the exact template.

### 7. New DB queries needed for PROMPT G
| Feature | Table | Query |
|---------|-------|-------|
| API call counts | `pipeline_metrics` | COUNT per pipeline_name per day |
| Cost estimates | `pipeline_metrics` | SUM duration_ms + join LLM call logs |
| DLQ management | `pipeline_dead_letters` | SELECT WHERE resolved=false |
| Certification overview | `certification_scores` | GROUP BY grade, siret |
| Company learning status | `company_profiles` | SELECT siret, learning_confidence, devis_count |

### 8. No Zustand / Redux — keep `useState` + `useEffect`
The entire admin section uses local React state only. Maintain that pattern; no global store needed.

### 9. Avoid duplicating SecurityPage + SystemHealthPage
Both pages query `/api/v1/platform/health` and show near-identical content. PROMPT G should consolidate or extend `SystemHealthPage` rather than creating a third overlap.

### 10. Window event bus for cross-component refresh
If new dashboards need to trigger refreshes in sibling components, use `window.dispatchEvent(new Event('TORP_METRICS_REFRESH'))` following the existing RAG event pattern.
