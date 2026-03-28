# JALON 3 — Backend Analysis: Engine Endpoints
*TORP Platform — Admin Panel — 2026-03-28*

---

## Executive Summary

Les 3 endpoints engine (`/api/v1/engine/stats`, `/api/v1/engine/status`, `/api/v1/engine/orchestration`) **existent et fonctionnent**, mais présentent des problèmes structurels critiques qui les rendent inexploitables en production.

### Résumé des problèmes

| Endpoint | Statut | Problème critique |
|---|---|---|
| `GET /api/v1/engine/stats` | ⚠️ Fonctionne, données statiques | Retourne toujours 7 engines `inactive` — aucune dynamique |
| `GET /api/v1/engine/status` | ⚠️ Fonctionne, données statiques | Idem — plus `getOrchestrationStatus()` est in-memory, perdu entre invocations |
| `GET /api/v1/engine/orchestration` | ❌ Cassé en production | Requête `orchestration_runs` table qui **n'existe pas** en DB |

### Double implémentation (dette architecturale)

Ces 3 endpoints existent en **deux versions simultanées** :
- **`api/v1/engine/` (Vercel)** — Serverless functions, runtime de production
- **`src/api/engine.routes.ts` (Express)** — Routes Express, utilisées en dev local

Les deux partagent la même logique mais divergent sur `/orchestration` : la version Express appelle `getOrchestrationStatus()` / `getLastOrchestration()` (in-memory), la version Vercel requête Supabase (`orchestration_runs`). En production Vercel, seule la version Vercel est active.

### Effort estimé pour corriger

| Correction | Effort |
|---|---|
| Créer table `orchestration_runs` (migration) | 30 min |
| Alimenter `orchestration_runs` depuis `EngineOrchestrator` | 2–4h |
| Alimenter `score_snapshots` avec colonnes engine (migration déjà écrite) | 1h |
| Ajouter auth guard (admin) sur les 3 endpoints | 1h |
| Supprimer la version Express dupliquée ou la synchroniser | 1–2h |

---

## Endpoint 1 — `GET /api/v1/engine/stats`

### Implémentation actuelle

**Vercel** (`api/v1/engine/stats.ts`) :
```typescript
const stats = getEngineStats();
return res.status(200).json({
  success: true,
  data: { stats, engines: ENGINE_REGISTRY },
});
```

**Express** (`src/api/engine.routes.ts`, `handleEngineStats`) : logique identique.

Les deux appellent `getEngineStats()` et retournent `ENGINE_REGISTRY` depuis `src/core/platform/engineRegistry.ts`.

### Source de données

`ENGINE_REGISTRY` est un tableau **statique en mémoire** de 7 entrées, toutes hardcodées à `status: 'inactive'` :

```
contextEngine, lotEngine, ruleEngine, enrichmentEngine,
ragEngine, auditEngine, visionEngine
```

`getEngineStats()` compte simplement par statut :
```typescript
{ total: 7, active: 0, inactive: 7, error: 0 }
```

Ces valeurs sont constantes — elles ne changent jamais, quelles que soient les analyses en cours.

### Format de réponse

```json
{
  "success": true,
  "data": {
    "stats": { "total": 7, "active": 0, "inactive": 7, "error": 0 },
    "engines": [
      { "id": "contextEngine", "name": "Context Engine", "description": "...", "status": "inactive" },
      { "id": "lotEngine", "name": "Lot Engine", "description": "...", "status": "inactive" },
      ...
    ]
  }
}
```

> **Note `apiGet`** : le client frontend (`src/services/api/client.ts`) unwrap automatiquement `.data` — le composant reçoit directement `{ stats, engines }`.

### Consommateurs frontend

- **`CockpitOrchestration.tsx`** (`src/components/admin/CockpitOrchestration.tsx:71`) : `apiGet('/api/v1/engine/stats')` → `payload.engines` → `EngineStatusGrid`
- **`Analytics.tsx`** (`src/pages/Analytics.tsx:489`) : poll toutes les 5s, combine avec `/engine/status`

### Problèmes identifiés

1. **Données 100% statiques** : `status: 'inactive'` hardcodé pour tous les engines. L'UI affiche une grille d'engines tous inactifs en permanence.
2. **Pas d'auth guard** : l'endpoint est accessible sans token. N'importe qui peut lister les engines.
3. **Divergence registry vs pipeline** : `engineRegistry.ts` liste 7 engines (`ragEngine`, `visionEngine`…), le pipeline `engineOrchestrator.ts` en orchestre 12 différents. Les IDs ne correspondent pas.
4. **Aucune information runtime** : pas de `lastExecuted`, `averageRunTime`, `errorCount` — les colonnes `lastUpdated` et `version` de `EngineRegistryEntry` sont toujours `undefined`.

---

## Endpoint 2 — `GET /api/v1/engine/status`

### Implémentation actuelle

**Vercel** (`api/v1/engine/status.ts`) :
```typescript
const stats = getEngineStats();
return res.status(200).json({
  success: true,
  data: {
    status: 'ok',
    timestamp: new Date().toISOString(),
    engines: stats,
    registry: ENGINE_REGISTRY.map((e) => ({ id: e.id, status: e.status })),
  },
});
```

**Express** (`src/api/engine.routes.ts`, `handleEngineStatus`) : appelle `getOrchestrationStatus()` depuis `engineOrchestrator.ts` — **diverge** de la version Vercel.

### Source de données

Version Vercel : identique à `/stats` — `ENGINE_REGISTRY` statique.

Version Express : `getOrchestrationStatus()` lit l'état in-memory de l'orchestrateur (`src/core/platform/engineOrchestrator.ts:721`). Cet état **n'est pas persisté** — perdu à chaque restart serverless.

### Format de réponse (version Vercel, production)

```json
{
  "success": true,
  "data": {
    "status": "ok",
    "timestamp": "2026-03-28T10:00:00.000Z",
    "engines": { "total": 7, "active": 0, "inactive": 7, "error": 0 },
    "registry": [
      { "id": "contextEngine", "status": "inactive" },
      { "id": "lotEngine", "status": "inactive" },
      ...
    ]
  }
}
```

### Consommateurs frontend

- **`Analytics.tsx`** (`src/pages/Analytics.tsx:490`) : poll 5s, combine `stats` + `status`
- Utilisé dans `EngineStatusLiveCard` qui subscribe aussi aux INSERTs `score_snapshots` (voir section Realtime)

### Problèmes identifiés

1. **Doublon de `/stats`** : retourne sensiblement les mêmes données que `/stats`. `status: 'ok'` est hardcodé — jamais `'degraded'` ou `'error'`.
2. **Divergence Express/Vercel** : la version Express utilise `getOrchestrationStatus()` (in-memory, plus précise), la version Vercel retourne toujours `'ok'`. En production, l'admin voit toujours `'ok'`.
3. **Pas d'auth guard** : endpoint public.
4. **`status: 'ok'` non calculé** : devrait refléter si des engines sont en erreur. Actuellement ignoré.

---

## Endpoint 3 — `GET /api/v1/engine/orchestration`

### Implémentation actuelle

**Vercel** (`api/v1/engine/orchestration.ts`) :
```typescript
const supabase = getServerSupabase();
const { data: runs, error: dbError } = await supabase
  .from('orchestration_runs')
  .select('id, status, started_at, completed_at, error')
  .order('started_at', { ascending: false })
  .limit(1);

const lastRun = runs?.[0] ?? null;
const currentStatus = lastRun?.status === 'running' ? 'running' : 'idle';
const flow = ENGINE_REGISTRY.map((engine) => engine.id);
```

**Express** (`src/api/engine.routes.ts`, `handleEngineOrchestration`) : appelle `getOrchestrationStatus()` et `getLastOrchestration()` in-memory — **ne requête pas Supabase**.

### Source de données

La version Vercel (production) requête la table `orchestration_runs`.

**Cette table n'existe pas.** Aucune migration ne la crée. La recherche exhaustive dans `supabase/migrations/` ne retourne aucun résultat pour `orchestration_runs`.

### Comportement actuel en production

```typescript
// dbError sera non-null (table not found)
// runs sera null ou undefined
const lastRun = runs?.[0] ?? null;  // → null
const currentStatus = 'idle';       // toujours 'idle'
```

L'endpoint retourne `200 OK` avec `lastOrchestration: null` et `status: 'idle'` en permanence, même si une analyse est en cours. L'erreur DB est loggée côté serveur mais ignorée côté client.

### Format de réponse

```json
{
  "success": true,
  "data": {
    "status": "idle",
    "flow": ["contextEngine", "lotEngine", "ruleEngine", "enrichmentEngine", "ragEngine", "auditEngine", "visionEngine"],
    "lastOrchestration": null
  }
}
```

*(Lorsque la table existera, `lastOrchestration` sera :)*
```json
{
  "id": "uuid",
  "status": "completed",
  "startTime": "2026-03-28T09:55:00.000Z",
  "endTime": "2026-03-28T09:55:42.000Z",
  "error": null
}
```

### Consommateurs frontend

- **`LastOrchestrationResultSection`** (`src/pages/Analytics.tsx:824`) : poll 5s, lit `data.lastOrchestration`
- **`OrchestrationsPage.tsx`** (`src/pages/admin/OrchestrationsPage.tsx`) : n'appelle **pas** cet endpoint — appelle `analyticsService.getJobStatusDistribution()` via Supabase directement

### Problèmes identifiés

1. **Table `orchestration_runs` manquante** : cause silencieuse — l'endpoint répond 200 avec `null` plutôt qu'une erreur exploitable.
2. **Pas d'alimentation** : même si la table était créée, rien dans le pipeline n'y écrit. `EngineOrchestrator` ne fait pas d'INSERT dans `orchestration_runs`.
3. **Pas d'auth guard** : endpoint public.
4. **`flow` incorrect** : retourne les 7 engines du registre statique, pas les 12 engines du pipeline réel.
5. **Divergence Express/Vercel** : la version Express utilise l'in-memory de l'orchestrateur — plus fidèle mais non persistée.

---

## Realtime — `score_snapshots`

### Contexte

`EngineStatusLiveCard` dans `Analytics.tsx` subscribe aux INSERTs sur `score_snapshots` avec le filtre `snapshot_type=eq.engine` pour afficher les scores d'engines en temps réel.

### État des migrations

Deux migrations coexistent et entrent en conflit :

**Migration 1** — `040_audit_trail_tables.sql` (ancienne) :
```sql
CREATE TABLE score_snapshots (
  id UUID, execution_context_id UUID, global_score INTEGER,
  grade TEXT, scores_by_room JSONB, snapshot_type TEXT DEFAULT 'full',
  created_at TIMESTAMP, ...
);
```
Colonnes présentes : scores globaux. **Colonnes manquantes** : `engine_name`, `score`, `status`, `duration_ms`.

**Migration 2** — `20260219_runtime_observability.sql` (Phase 36.x) :
```sql
CREATE TABLE IF NOT EXISTS score_snapshots (
  id uuid, project_id uuid, engine_name text NOT NULL,
  score numeric, status text, duration_ms integer,
  meta jsonb, created_at timestamptz
);
```
Colonnes `engine_name`, `score`, `status`, `duration_ms` présentes. `snapshot_type` absent.

**Migration de fix** — `20260219_fix_score_snapshots_schema.sql` :
```sql
ALTER TABLE score_snapshots ADD COLUMN IF NOT EXISTS engine_name text;
ALTER TABLE score_snapshots ADD COLUMN IF NOT EXISTS score numeric;
ALTER TABLE score_snapshots ADD COLUMN IF NOT EXISTS status text;
ALTER TABLE score_snapshots ADD COLUMN IF NOT EXISTS duration_ms integer;
```
Ce fichier est probablement le patch de réconciliation : si la table a été créée par la migration 1 (ancienne), ce `ALTER TABLE` ajoute les colonnes manquantes.

### État probable en production

Selon l'ordre d'application des migrations :
- Si migration 1 appliquée puis fix → colonnes engine présentes, mais `snapshot_type` absent (filtre Realtime `snapshot_type=eq.engine` ne match rien)
- Si migration 2 appliquée directement → `snapshot_type` absent (même problème)
- Les migrations dans `supabase/migrations/supabase/migrations/` sont dans un sous-dossier non-standard — leur statut d'application est incertain

### Problème Realtime

Le filtre Supabase Realtime `snapshot_type=eq.engine` requiert que la colonne `snapshot_type` existe **et** que des lignes soient insérées avec cette valeur. Aucune des migrations récentes ne définit cette colonne dans `score_snapshots`. Le subscribe ne reçoit rien.

### Schema cible pour le Realtime

```sql
ALTER TABLE public.score_snapshots
ADD COLUMN IF NOT EXISTS snapshot_type text DEFAULT 'full';

-- Index pour le filtre Realtime
CREATE INDEX IF NOT EXISTS idx_score_snapshots_type
ON public.score_snapshots(snapshot_type);
```

---

## Table manquante — `orchestration_runs`

### Migration requise

```sql
-- supabase/migrations/YYYYMMDD_orchestration_runs.sql

CREATE TABLE IF NOT EXISTS public.orchestration_runs (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  status          text NOT NULL,         -- 'running' | 'completed' | 'failed'
  started_at      timestamptz NOT NULL DEFAULT now(),
  completed_at    timestamptz,
  error           text,
  job_id          uuid,                  -- référence analysis_jobs si applicable
  engine_count    integer,               -- nombre d'engines exécutés
  meta            jsonb,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_orchestration_runs_started
ON public.orchestration_runs(started_at DESC);

CREATE INDEX IF NOT EXISTS idx_orchestration_runs_status
ON public.orchestration_runs(status);

ALTER TABLE public.orchestration_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin read orchestration_runs"
ON public.orchestration_runs FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
  )
);
```

### Alimentation requise

`EngineOrchestrator.ts` doit insérer dans `orchestration_runs` aux points de cycle de vie :

```typescript
// Début d'orchestration
await supabase.from('orchestration_runs').insert({
  status: 'running', started_at: new Date().toISOString(), job_id: context.jobId
});

// Fin d'orchestration (succès)
await supabase.from('orchestration_runs').update({
  status: 'completed', completed_at: new Date().toISOString()
}).eq('id', runId);

// Fin d'orchestration (erreur)
await supabase.from('orchestration_runs').update({
  status: 'failed', completed_at: new Date().toISOString(), error: err.message
}).eq('id', runId);
```

---

## Recommandations Architecture

### 1. Unifier les deux implémentations

Les routes Express (`src/api/engine.routes.ts`) et les Vercel functions (`api/v1/engine/`) doublonnent la logique. En production seule la version Vercel est active. Options :
- **Option A** : Supprimer `src/api/engine.routes.ts` — ne l'enregistrer nulle part (vérifier `registerEngineRoutes`)
- **Option B** : Faire pointer les routes Express vers les mêmes handlers que les Vercel functions via un module partagé

### 2. Ajouter des auth guards

Les 3 endpoints exposent des informations d'infrastructure sans vérification d'identité. Ajouter en header ou middleware :

```typescript
// api/_lib/adminAuth.ts
export async function requireAdmin(req: VercelRequest, res: VercelResponse): Promise<boolean> {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) { res.status(401).json({ error: 'Unauthorized' }); return false; }
  const { data: { user } } = await supabase.auth.getUser(token);
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user?.id).single();
  if (!profile || !['admin', 'super_admin'].includes(profile.role)) {
    res.status(403).json({ error: 'Forbidden' }); return false;
  }
  return true;
}
```

### 3. Rendre `ENGINE_REGISTRY` dynamique

Actuellement tous les engines sont `status: 'inactive'`. Pour refléter l'état réel, le registre devrait être alimenté depuis `score_snapshots` ou `engine_executions` au démarrage de chaque analyse. Alternative légère : insérer dans `score_snapshots` avec `status='active'` au début de chaque engine, `status='completed'` à la fin.

### 4. Stratégie de caching pour `/stats` et `/status`

Ces endpoints sont pollés toutes les 5s par `Analytics.tsx`. En serverless, chaque invocation cold-start relit le module. Ajouter un cache HTTP côté Vercel :

```typescript
res.setHeader('Cache-Control', 's-maxage=5, stale-while-revalidate=10');
```

### 5. Plan de correction priorisé

| Priorité | Action | Impact |
|---|---|---|
| P0 | Créer migration `orchestration_runs` | `/orchestration` retourne des données réelles |
| P0 | Appliquer `20260219_fix_score_snapshots_schema.sql` + ajouter `snapshot_type` | Realtime fonctionne |
| P1 | Ajouter auth guards sur les 3 endpoints | Sécurité |
| P1 | Alimenter `orchestration_runs` depuis `EngineOrchestrator` | Données live |
| P2 | Alimenter `score_snapshots` (engine events) | Grille engines live |
| P3 | Unifier Express/Vercel implémentations | Dette technique |
| P3 | Aligner `ENGINE_REGISTRY` avec les 12 engines réels du pipeline | Cohérence |

---

## Annexe — Cartographie des consommateurs frontend

| Endpoint | Fichier | Mécanisme | Fréquence |
|---|---|---|---|
| `/engine/stats` | `CockpitOrchestration.tsx:71` | `apiGet()` one-shot | Au mount |
| `/engine/stats` | `Analytics.tsx:489` | `apiGet()` poll | 5s |
| `/engine/status` | `Analytics.tsx:490` | `apiGet()` poll | 5s |
| `/engine/orchestration` | `Analytics.tsx:824` | `apiGet()` poll | 5s |
| `score_snapshots` (Realtime) | `Analytics.tsx` | Supabase subscribe | Push |

`OrchestrationsPage.tsx` n'appelle **aucun** de ces 3 endpoints — utilise `analyticsService.getJobStatusDistribution()` (requête directe Supabase). Elle est donc fonctionnelle indépendamment.
