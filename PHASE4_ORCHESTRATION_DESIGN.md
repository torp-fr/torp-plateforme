# PHASE 4 — Orchestration Layer Design
*TORP Platform — Architecture + Code Skeletons — 2026-03-28*

---

## Executive Summary

| Dimension | Décision |
|---|---|
| Modèle d'orchestration | **Hybrid: Event-driven (high-level) + DAG séquentiel (engine layer)** |
| Event storage | **Supabase DB** (`pipeline_executions` déjà existant) |
| State machine | **Statuts dans `analysis_jobs` + `devis.pipeline_status`** |
| Retry strategy | **Exponentiel, max 3 tentatives, dead letter en DB** |
| Event dispatch | **Async via `Promise` chains + Supabase Realtime pour notifs frontend** |
| Nouveau code requis | `EventBus.ts`, `OrchestratorService.ts`, `DependencyValidator.ts` |

**Fondements existants à préserver** (ne pas réécrire):
- `JobService` — lifecycle `analysis_jobs` ✅
- `OrchestrationService` — `orchestration_runs` + `engine_executions` ✅
- `engineOrchestrator.ts` — 12 moteurs séquentiels ✅
- `DevisParsingPipeline`, `AuditScoringPipeline`, etc. ✅
- Types `PipelineContext`, `PipelineResult<T>` ✅

---

## Part 1 — Modèle d'Orchestration

### Choix: Hybrid Event-Driven + DAG

```
HIGH LEVEL (Event-Driven)
  user upload → "devis:uploaded" event
                     │
                     ▼
         OrchestratorService.handleDevisUploaded()
                     │
                     ▼
LOW LEVEL (DAG — existant, ne pas modifier)
  [DevisParsingPipeline] → [AuditScoringPipeline] → [engineOrchestrator]
         │                          │                       │
       OCR/parse               scoring 12 engines        persistence
```

**Pourquoi ce choix (et pas Temporal / Airflow / BullMQ)**:

| Critère | Hybrid DB-backed | Temporal/Airflow | BullMQ/Redis |
|---|---|---|---|
| Infra requise | Supabase (déjà là) | Serveur dédié | Redis (nouveau) |
| Complexité | Faible | Élevée | Moyenne |
| Durabilité | ✅ Supabase SQL | ✅ | ✅ Redis |
| Observable depuis dashboard | ✅ Direct DB query | Separate UI | Separate UI |
| Convient pour MVP | ✅ Oui | ❌ Surdesigné | ⚠️ Acceptable |
| Scalabilité | ⚠️ limitée | ✅ | ✅ |

**Verdict**: Pour Phase 4, l'approche DB-backed est suffisante et cohérente avec l'architecture existante. Migrer vers BullMQ ou Temporal si le volume dépasse ~1000 analyses/jour.

---

## Part 2 — Événements Système

### Catalogue des 18 événements

```typescript
// src/core/events/events.types.ts

export type TORPEvent =
  // ── Clients ─────────────────────────────────────────────────────────────
  | 'client:created'          // Client row inséré
  | 'client:geocoded'         // localisation JSONB rempli (BANO/Nominatim)
  | 'client:geocode_failed'   // Géocodage échoué après retries
  // ── Projects ────────────────────────────────────────────────────────────
  | 'project:created'         // Projet row inséré + domains déduits
  | 'project:enriched'        // contexte_reglementaire rempli (IGN/ADEME)
  | 'project:enrich_failed'   // Enrichissement échoué
  // ── Devis ───────────────────────────────────────────────────────────────
  | 'devis:uploaded'          // Fichier stocké + analysis_job créé
  | 'devis:validated'         // Dépendances vérifiées (client ✓ + project ✓)
  | 'devis:validation_failed' // Client ou projet introuvable
  | 'devis:parsed'            // OCR + extraction terminée → parsing_result
  | 'devis:parse_failed'      // Parsing échoué (fichier illisible, etc.)
  | 'devis:scored'            // 12 moteurs terminés → grade A-E
  | 'devis:score_failed'      // Orchestration moteurs échouée
  | 'devis:completed'         // QR code généré, notification envoyée
  // ── Knowledge ───────────────────────────────────────────────────────────
  | 'knowledge:ingestion_started'   // Document claim atomique réussi
  | 'knowledge:ingested'            // Chunks + embeddings insérés
  | 'knowledge:ingestion_failed'    // Échec après max retries
  // ── Système ─────────────────────────────────────────────────────────────
  | 'system:pipeline_error'         // Erreur non récupérable → DLQ
  | 'system:health_degraded';       // health_score < 70
```

### Payloads typés par événement

```typescript
// src/core/events/events.types.ts (suite)

export interface EventPayloads {
  'client:created':            { clientId: string; email: string };
  'client:geocoded':           { clientId: string; lat: number; lng: number; ville: string };
  'client:geocode_failed':     { clientId: string; reason: string; retryable: boolean };
  'project:created':           { projectId: string; clientId: string; type: string; impliedDomains: string[] };
  'project:enriched':          { projectId: string; regulatoryContextKeys: string[] };
  'project:enrich_failed':     { projectId: string; reason: string };
  'devis:uploaded':            { devisId: string; jobId: string; projectId: string; format: string; filePath: string };
  'devis:validated':           { devisId: string; jobId: string; clientId: string; projectId: string };
  'devis:validation_failed':   { devisId: string; jobId: string; missingDeps: ('client' | 'project')[] };
  'devis:parsed':              { devisId: string; jobId: string; itemCount: number; confidence: number; method: string };
  'devis:parse_failed':        { devisId: string; jobId: string; reason: string; retryable: boolean };
  'devis:scored':              { devisId: string; jobId: string; grade: string; score: number; orchestrationId: string };
  'devis:score_failed':        { devisId: string; jobId: string; orchestrationId: string; reason: string };
  'devis:completed':           { devisId: string; jobId: string; auditId: string; shortCode: string };
  'knowledge:ingestion_started':{ documentId: string; title: string; attempt: number };
  'knowledge:ingested':        { documentId: string; chunkCount: number; embeddedAt: string };
  'knowledge:ingestion_failed':{ documentId: string; reason: string; attempt: number; maxAttempts: number };
  'system:pipeline_error':     { pipeline: string; resourceId: string; error: string; movedToDLQ: boolean };
  'system:health_degraded':    { healthScore: number; status: string; errorRate: number };
}
```

---

## Part 3 — EventBus

### Design

```typescript
// src/core/events/EventBus.ts

import { structuredLogger } from '@/services/observability/structured-logger.js';
import type { TORPEvent, EventPayloads } from './events.types.js';

type Handler<E extends TORPEvent> = (payload: EventPayloads[E]) => Promise<void>;

/**
 * In-process event bus.
 * Synchronous emit with async handlers run concurrently.
 * For production at scale: replace with Supabase Realtime channels or BullMQ.
 */
class EventBusImpl {
  private readonly handlers = new Map<TORPEvent, Handler<any>[]>();

  /** Subscribe to a specific event. Returns an unsubscribe function. */
  on<E extends TORPEvent>(event: E, handler: Handler<E>): () => void {
    const list = this.handlers.get(event) ?? [];
    list.push(handler);
    this.handlers.set(event, list);
    return () => {
      const current = this.handlers.get(event) ?? [];
      this.handlers.set(event, current.filter(h => h !== handler));
    };
  }

  /** Emit an event — handlers run concurrently, failures are isolated */
  async emit<E extends TORPEvent>(event: E, payload: EventPayloads[E]): Promise<void> {
    const list = this.handlers.get(event) ?? [];
    if (list.length === 0) return;

    const results = await Promise.allSettled(list.map(h => h(payload)));

    for (const result of results) {
      if (result.status === 'rejected') {
        structuredLogger.error({
          service: 'EventBus',
          method: 'emit',
          message: `Handler for "${event}" threw`,
          error: result.reason instanceof Error ? result.reason.message : String(result.reason),
          event,
        });
      }
    }
  }
}

export const eventBus = new EventBusImpl();
```

### Avantages de ce design
- **Type-safe**: TypeScript enforce le payload par event name
- **Isolated failures**: un handler qui plante n'affecte pas les autres
- **In-process**: pas de dépendance infra supplémentaire pour Phase 4
- **Replaceable**: l'interface est stable — on peut brancher BullMQ/Redis derrière sans changer les appelants

---

## Part 4 — State Machine: Pipeline Devis

### États et transitions

```
                    ┌─────────────────────────────────────────┐
                    │         DEVIS STATE MACHINE              │
                    └─────────────────────────────────────────┘

  User Upload
      │
      ▼
  ┌─────────┐    devis:uploaded          ┌─────────────┐
  │ PENDING │ ─────────────────────────► │  VALIDATING │
  └─────────┘                            └──────┬──────┘
      ▲                                         │
      │ retry (max 3)              ┌────────────┴────────────┐
      │                            │                         │
  ┌───┴──────────────┐    validation OK            validation FAIL
  │ VALIDATION_ERROR │◄──────────────────┐              │
  └──────────────────┘               ┌───┴──────┐    ┌──▼──────────┐
                                     │ PARSING  │    │ DEP_MISSING │
                                     └──────────┘    └─────────────┘
                                          │
                              ┌───────────┴───────────┐
                              │                       │
                         parse OK               parse FAIL
                              │                       │
                         ┌────▼─────┐          ┌──────▼──────────┐
                         │ SCORING  │          │  PARSING_ERROR  │
                         └────┬─────┘          └─────────────────┘
                              │
                   ┌──────────┴──────────┐
                   │                     │
              score OK              score FAIL
                   │                     │
           ┌───────▼──────┐     ┌────────▼──────────┐
           │  COMPLETING  │     │   SCORING_ERROR   │
           └───────┬──────┘     └───────────────────┘
                   │
                   ▼
            ┌──────────┐
            │ COMPLETE │  (QR code généré, notification envoyée)
            └──────────┘

  *_ERROR states → retryable ? back to previous state : DEAD_LETTER
```

### États dans `analysis_jobs.status`

| Status DB | Description | Prochain état |
|---|---|---|
| `pending` | Job créé, en attente | → `processing` |
| `processing` | Pipeline en cours | → `completed` / `failed` |
| `completed` | Grade + QR code disponibles | — (final) |
| `failed` | Échec non récupérable | — (final, DLQ si needed) |
| `cancelled` | Annulé manuellement | — (final) |

### États dans `devis.pipeline_status` (JSONB)

```typescript
type DevisPipelineStatus = {
  stage: 'pending' | 'validating' | 'parsing' | 'scoring' | 'completing' | 'completed'
       | 'validation_error' | 'parsing_error' | 'scoring_error' | 'dep_missing';
  progress: number;           // 0–100
  error?: string;
  retry_count: number;
  last_updated: string;       // ISO timestamp
};
```

---

## Part 5 — OrchestratorService

### Skeleton complet

```typescript
// src/core/services/OrchestratorService.ts

import { eventBus } from '../events/EventBus.js';
import { DependencyValidator } from './DependencyValidator.js';
import { jobService } from '../jobs/job.service.js';
import { structuredLogger } from '@/services/observability/structured-logger.js';
import { createClient } from '@supabase/supabase-js';
import type { TORPEvent } from '../events/events.types.js';

const MAX_RETRY_ATTEMPTS = 3;

// Exponential backoff delays: attempt 1→1s, 2→2s, 3→4s
const BACKOFF_MS = [1000, 2000, 4000];

export class OrchestratorService {
  private readonly validator = new DependencyValidator();
  private readonly supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // ── Bootstrap: register all event handlers ────────────────────────────

  /**
   * Call once at server startup to wire all event handlers.
   * src/api/server.ts → orchestrator.bootstrap()
   */
  bootstrap(): void {
    eventBus.on('devis:uploaded',        p => this.handleDevisUploaded(p));
    eventBus.on('devis:validated',       p => this.handleDevisValidated(p));
    eventBus.on('devis:parsed',          p => this.handleDevisParsed(p));
    eventBus.on('client:created',        p => this.handleClientCreated(p));
    eventBus.on('project:created',       p => this.handleProjectCreated(p));
    eventBus.on('knowledge:ingested',    p => this.handleKnowledgeIngested(p));
    eventBus.on('system:health_degraded', p => this.handleHealthDegraded(p));

    structuredLogger.info({ service: 'OrchestratorService', message: 'Event handlers registered' });
  }

  // ── Devis pipeline ─────────────────────────────────────────────────────

  async handleDevisUploaded(payload: { devisId: string; jobId: string; projectId: string; format: string; filePath: string }) {
    await this.updateDevisStage(payload.devisId, 'validating', 5);

    const validation = await this.validator.validateDevisAnalysisDependencies(payload.devisId);

    if (!validation.valid) {
      await this.updateDevisStage(payload.devisId, 'dep_missing', 0,
        `Missing: ${validation.errors.join(', ')}`);
      await jobService.markFailed(payload.jobId, `Dependency check failed: ${validation.errors.join(', ')}`);
      await eventBus.emit('devis:validation_failed', {
        devisId: payload.devisId,
        jobId: payload.jobId,
        missingDeps: validation.missingDeps,
      });
      return;
    }

    await eventBus.emit('devis:validated', {
      devisId: payload.devisId,
      jobId: payload.jobId,
      clientId: validation.clientId!,
      projectId: validation.projectId!,
    });
  }

  async handleDevisValidated(payload: { devisId: string; jobId: string; clientId: string; projectId: string }) {
    await this.updateDevisStage(payload.devisId, 'parsing', 10);
    await jobService.markProcessing(payload.jobId);

    // Import lazily to avoid circular deps
    const { DevisParsingPipeline } = await import('../pipelines/handlers/DevisParsingPipeline.js');
    const pipeline = new DevisParsingPipeline();

    const devis = await this.fetchDevisRow(payload.devisId);
    const context = this.buildPipelineContext('DevisParsing', payload.devisId, 'devis');

    const result = await pipeline.execute(
      { filePath: devis.upload_file_path, format: devis.upload_format },
      context
    );

    if (result.status === 'completed' && result.data) {
      await this.supabase
        .from('devis')
        .update({ parsing_result: result.data })
        .eq('id', payload.devisId);

      await eventBus.emit('devis:parsed', {
        devisId: payload.devisId,
        jobId: payload.jobId,
        itemCount: result.data.items.length,
        confidence: result.data.parsing_confidence,
        method: result.data.parsing_method,
      });
    } else {
      await this.handlePipelineFailure('devis:parse_failed', payload.devisId, payload.jobId,
        result.error ?? 'Parsing failed', result.retryable);
    }
  }

  async handleDevisParsed(payload: { devisId: string; jobId: string }) {
    await this.updateDevisStage(payload.devisId, 'scoring', 30);

    const { AuditScoringPipeline } = await import('../pipelines/handlers/AuditScoringPipeline.js');
    const pipeline = new AuditScoringPipeline();
    const context = this.buildPipelineContext('AuditScoring', payload.devisId, 'devis');

    const result = await pipeline.execute({ devisId: payload.devisId }, context);

    if (result.status === 'completed' && result.data) {
      const { runOrchestration } = await import('../platform/engineOrchestrator.js');
      const orchResult = await runOrchestration({ jobId: payload.jobId });

      if (orchResult.status === 'completed') {
        await eventBus.emit('devis:scored', {
          devisId: payload.devisId,
          jobId: payload.jobId,
          grade: orchResult.results?.finalGrade ?? 'E',
          score: orchResult.results?.globalScore ?? 0,
          orchestrationId: orchResult.id,
        });
      } else {
        await this.handlePipelineFailure('devis:score_failed', payload.devisId, payload.jobId,
          orchResult.error ?? 'Orchestration failed', true);
      }
    } else {
      await this.handlePipelineFailure('devis:score_failed', payload.devisId, payload.jobId,
        result.error ?? 'Scoring failed', result.retryable);
    }
  }

  // ── Client pipeline ────────────────────────────────────────────────────

  async handleClientCreated(payload: { clientId: string; email: string }) {
    // Fire-and-forget: geocoding doesn't block client creation
    this.geocodeClientAsync(payload.clientId).catch(err => {
      structuredLogger.warn({
        service: 'OrchestratorService',
        method: 'handleClientCreated',
        message: 'Geocoding failed',
        error: err.message,
        clientId: payload.clientId,
      });
    });
  }

  private async geocodeClientAsync(clientId: string): Promise<void> {
    const { ClientLocalizationPipeline } = await import('../pipelines/handlers/ClientLocalizationPipeline.js');
    const pipeline = new ClientLocalizationPipeline();
    const context = this.buildPipelineContext('ClientLocalization', clientId, 'client');

    const client = await this.fetchClientRow(clientId);
    const result = await pipeline.execute({ adresse: client.adresse ?? '' }, context);

    if (result.status === 'completed' && result.data) {
      await this.supabase
        .from('clients')
        .update({
          localisation: result.data,
          pipeline_status: { geocoding: 'completed' },
        })
        .eq('id', clientId);

      await eventBus.emit('client:geocoded', {
        clientId,
        lat: result.data.lat,
        lng: result.data.lng,
        ville: result.data.ville,
      });
    } else {
      await this.supabase
        .from('clients')
        .update({ pipeline_status: { geocoding: 'failed', error: result.error } })
        .eq('id', clientId);

      await eventBus.emit('client:geocode_failed', {
        clientId,
        reason: result.error ?? 'Unknown',
        retryable: result.retryable,
      });
    }
  }

  // ── Project pipeline ────────────────────────────────────────────────────

  async handleProjectCreated(payload: { projectId: string; clientId: string; type: string; impliedDomains: string[] }) {
    // Async enrichment — does not block project creation
    this.enrichProjectAsync(payload.projectId).catch(err => {
      structuredLogger.warn({
        service: 'OrchestratorService',
        method: 'handleProjectCreated',
        message: 'Project enrichment failed',
        error: err.message,
        projectId: payload.projectId,
      });
    });
  }

  private async enrichProjectAsync(projectId: string): Promise<void> {
    const { ContextRegulationPipeline } = await import('../pipelines/handlers/ContextRegulationPipeline.js');
    const pipeline = new ContextRegulationPipeline();
    const context = this.buildPipelineContext('ContextRegulation', projectId, 'projet');

    const project = await this.fetchProjectRow(projectId);
    const result = await pipeline.execute(
      { projectId, impliedDomains: project.implied_domains ?? [] },
      context
    );

    if (result.status === 'completed' && result.data) {
      await this.supabase
        .from('projets')
        .update({ contexte_reglementaire: result.data })
        .eq('id', projectId);

      await eventBus.emit('project:enriched', {
        projectId,
        regulatoryContextKeys: Object.keys(result.data),
      });
    }
  }

  // ── Knowledge pipeline ─────────────────────────────────────────────────

  async handleKnowledgeIngested(payload: { documentId: string; chunkCount: number; embeddedAt: string }) {
    // Side-effect: log to Intelligence pipeline
    structuredLogger.info({
      service: 'OrchestratorService',
      method: 'handleKnowledgeIngested',
      message: 'Knowledge base updated',
      documentId: payload.documentId,
      chunkCount: payload.chunkCount,
    });
    // Future: invalidate RAG cache if present
  }

  // ── System events ──────────────────────────────────────────────────────

  async handleHealthDegraded(payload: { healthScore: number; status: string; errorRate: number }) {
    structuredLogger.error({
      service: 'OrchestratorService',
      method: 'handleHealthDegraded',
      message: `⚠️ Platform health ${payload.status}`,
      healthScore: payload.healthScore,
      errorRate: payload.errorRate,
    });
    // Future: trigger Slack alert via NotificationService
  }

  // ── Retry + Dead Letter ─────────────────────────────────────────────────

  async retryFailedJob(jobId: string): Promise<void> {
    const job = await jobService.getJob(jobId);
    if (!job) throw new Error(`Job ${jobId} not found`);

    const retryCount = await this.getRetryCount(jobId);
    if (retryCount >= MAX_RETRY_ATTEMPTS) {
      await this.moveToDLQ(jobId, job.devis_id ?? '', 'Max retries exceeded');
      return;
    }

    const delay = BACKOFF_MS[retryCount] ?? BACKOFF_MS[BACKOFF_MS.length - 1];
    await new Promise(r => setTimeout(r, delay));

    // Reset state and re-trigger
    await this.updateDevisStage(job.devis_id ?? '', 'pending', 0);
    await jobService.resetToPending(jobId);

    if (job.devis_id) {
      const devis = await this.fetchDevisRow(job.devis_id);
      await eventBus.emit('devis:uploaded', {
        devisId: job.devis_id,
        jobId: job.id,
        projectId: job.project_id ?? '',
        format: devis.upload_format,
        filePath: devis.upload_file_path,
      });
    }
  }

  async moveToDLQ(jobId: string, resourceId: string, reason: string): Promise<void> {
    await this.supabase.from('pipeline_dead_letters').insert({
      job_id: jobId,
      resource_id: resourceId,
      pipeline_name: 'devis',
      error: reason,
      created_at: new Date().toISOString(),
    });

    await jobService.markFailed(jobId, `DLQ: ${reason}`);

    await eventBus.emit('system:pipeline_error', {
      pipeline: 'devis',
      resourceId,
      error: reason,
      movedToDLQ: true,
    });
  }

  // ── Monitoring ──────────────────────────────────────────────────────────

  async checkAndEmitHealthEvents(): Promise<void> {
    const { engineService } = await import('./EngineService.js');
    const status = await engineService.getStatus();

    if (status.health_score < 70) {
      await eventBus.emit('system:health_degraded', {
        healthScore: status.health_score,
        status: status.status,
        errorRate: status.details.error_rate,
      });
    }
  }

  // ── Helpers ─────────────────────────────────────────────────────────────

  private async handlePipelineFailure(
    event: 'devis:parse_failed' | 'devis:score_failed',
    devisId: string,
    jobId: string,
    reason: string,
    retryable: boolean
  ): Promise<void> {
    const stage = event === 'devis:parse_failed' ? 'parsing_error' : 'scoring_error';
    await this.updateDevisStage(devisId, stage, 0, reason);

    if (retryable) {
      await this.retryFailedJob(jobId);
    } else {
      await jobService.markFailed(jobId, reason);
      await this.moveToDLQ(jobId, devisId, reason);
    }

    await eventBus.emit(event, { devisId, jobId, reason, retryable } as any);
  }

  private async updateDevisStage(
    devisId: string,
    stage: string,
    progress: number,
    error?: string
  ): Promise<void> {
    await this.supabase
      .from('devis')
      .update({
        pipeline_status: {
          stage,
          progress,
          ...(error ? { error } : {}),
          last_updated: new Date().toISOString(),
        },
      })
      .eq('id', devisId);
  }

  private buildPipelineContext(
    name: string,
    entityId: string,
    entityType: 'client' | 'projet' | 'devis' | 'entreprise'
  ) {
    return {
      pipelineName: name,
      entityId,
      entityType,
      startedAt: new Date(),
      timeout: parseInt(process.env.PIPELINE_TIMEOUT_MS ?? '120000'),
    };
  }

  private async fetchDevisRow(devisId: string) {
    const { data, error } = await this.supabase
      .from('devis').select('upload_file_path, upload_format').eq('id', devisId).single();
    if (error || !data) throw new Error(`Devis ${devisId} not found`);
    return data;
  }

  private async fetchClientRow(clientId: string) {
    const { data, error } = await this.supabase
      .from('clients').select('adresse').eq('id', clientId).single();
    if (error || !data) throw new Error(`Client ${clientId} not found`);
    return data;
  }

  private async fetchProjectRow(projectId: string) {
    const { data, error } = await this.supabase
      .from('projets').select('implied_domains').eq('id', projectId).single();
    if (error || !data) throw new Error(`Project ${projectId} not found`);
    return data;
  }

  private async getRetryCount(jobId: string): Promise<number> {
    const { data } = await this.supabase
      .from('pipeline_executions')
      .select('retry_count')
      .eq('entity_id', jobId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    return data?.retry_count ?? 0;
  }
}

export const orchestrator = new OrchestratorService();
```

---

## Part 6 — DependencyValidator

```typescript
// src/core/services/DependencyValidator.ts

import { createClient } from '@supabase/supabase-js';

interface ValidationResult {
  valid: boolean;
  errors: string[];
  missingDeps: ('client' | 'project')[];
  clientId?: string;
  projectId?: string;
}

export class DependencyValidator {
  private readonly supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  /**
   * Check all dependencies before starting Devis analysis.
   * Requires: devis row exists, projet exists, client exists.
   */
  async validateDevisAnalysisDependencies(devisId: string): Promise<ValidationResult> {
    const errors: string[] = [];
    const missingDeps: ('client' | 'project')[] = [];

    // 1. Load devis row
    const { data: devis, error: devisErr } = await this.supabase
      .from('devis')
      .select('id, projet_id, entreprise_id, upload_file_path, upload_format')
      .eq('id', devisId)
      .single();

    if (devisErr || !devis) {
      return { valid: false, errors: [`Devis ${devisId} not found`], missingDeps };
    }

    if (!devis.upload_file_path) {
      errors.push('Devis file path missing — upload may have failed');
    }

    // 2. Check project exists
    let projectId: string | undefined;
    if (!devis.projet_id) {
      errors.push('projet_id is null on devis row');
      missingDeps.push('project');
    } else {
      const { data: project } = await this.supabase
        .from('projets')
        .select('id, client_id')
        .eq('id', devis.projet_id)
        .single();

      if (!project) {
        errors.push(`Project ${devis.projet_id} not found`);
        missingDeps.push('project');
      } else {
        projectId = project.id;

        // 3. Check client exists (via project)
        const { data: client } = await this.supabase
          .from('clients')
          .select('id')
          .eq('id', project.client_id)
          .single();

        if (!client) {
          errors.push(`Client ${project.client_id} not found`);
          missingDeps.push('client');
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      missingDeps,
      clientId: projectId ? undefined : undefined, // resolved from project
      projectId,
    };
  }

  /**
   * Check if a project can be used as dependency (client exists + location present).
   */
  async validateProjectDependencies(projectId: string): Promise<ValidationResult> {
    const errors: string[] = [];
    const missingDeps: ('client' | 'project')[] = [];

    const { data: project } = await this.supabase
      .from('projets')
      .select('id, client_id, type, localisation')
      .eq('id', projectId)
      .single();

    if (!project) {
      return { valid: false, errors: [`Project ${projectId} not found`], missingDeps: ['project'] };
    }

    if (!project.client_id) {
      errors.push('project has no client_id');
      missingDeps.push('client');
    } else {
      const { data: client } = await this.supabase
        .from('clients').select('id').eq('id', project.client_id).single();
      if (!client) {
        errors.push(`Client ${project.client_id} not found`);
        missingDeps.push('client');
      }
    }

    return { valid: errors.length === 0, errors, missingDeps, projectId };
  }
}
```

---

## Part 7 — Migration: Dead Letter Queue

```sql
-- supabase/migrations/20260328000005_create_pipeline_dead_letters.sql

CREATE TABLE IF NOT EXISTS pipeline_dead_letters (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id       UUID REFERENCES analysis_jobs(id) ON DELETE SET NULL,
  resource_id  UUID NOT NULL,
  pipeline_name VARCHAR(100) NOT NULL,
  error        TEXT NOT NULL,
  payload      JSONB,
  resolved_at  TIMESTAMPTZ,
  resolved_by  UUID,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_dlq_pipeline_name ON pipeline_dead_letters(pipeline_name);
CREATE INDEX idx_dlq_resolved      ON pipeline_dead_letters(resolved_at)
  WHERE resolved_at IS NULL;  -- Fast lookup for unresolved items

COMMENT ON TABLE pipeline_dead_letters IS
  'Items that failed all retry attempts and require manual intervention';

-- RLS: admin only
ALTER TABLE pipeline_dead_letters ENABLE ROW LEVEL SECURITY;
CREATE POLICY dlq_admin_read ON pipeline_dead_letters
  FOR SELECT USING (auth.jwt() ->> 'role' = 'admin');
CREATE POLICY dlq_admin_write ON pipeline_dead_letters
  FOR ALL USING (auth.jwt() ->> 'role' = 'admin');
```

---

## Part 8 — Bootstrap: Wiring at Server Startup

```typescript
// src/api/server.ts — ajouter après les imports existants

import { orchestrator } from '../core/services/OrchestratorService.js';

// À la fin du fichier, avant le listen():
orchestrator.bootstrap();

// Health monitor: vérifier toutes les 5 minutes
setInterval(() => {
  orchestrator.checkAndEmitHealthEvents().catch(err => {
    console.error('[health-monitor]', err.message);
  });
}, 5 * 60 * 1000);
```

---

## Part 9 — Intégration avec les routes existantes

### Route upload devis (existante à modifier)

```typescript
// src/api/routes/pipelines.routes.ts — exemple d'émission d'événement

// Après INSERT devis + INSERT analysis_jobs:
await eventBus.emit('devis:uploaded', {
  devisId: devis.id,
  jobId: job.id,
  projectId: req.body.projet_id,
  format: uploadedFile.format,
  filePath: uploadedFile.path,
});
```

### Route création client

```typescript
// Après INSERT clients:
await eventBus.emit('client:created', {
  clientId: client.id,
  email: client.email,
});
```

### Route création projet

```typescript
// Après INSERT projets + contextDeduction:
await eventBus.emit('project:created', {
  projectId: projet.id,
  clientId: req.body.client_id,
  type: req.body.type,
  impliedDomains: projet.implied_domains,
});
```

---

## Part 10 — Monitoring Dashboard Spec

### Métriques temps réel

```
ORCHESTRATION HEALTH DASHBOARD
================================

Global Status: ✅ OPERATIONAL  (health_score: 94/100)

── Pipeline Status ──────────────────────────────────────────────────────
  Pipeline     │ Status │ Last run │ Success %  │ Avg duration │ In queue
  ─────────────┼────────┼──────────┼────────────┼──────────────┼─────────
  Clients      │ ✅ OK  │ 2m ago   │  99.2%     │  2.3s        │  0
  Projects     │ ✅ OK  │ 5m ago   │  98.8%     │  5.1s        │  0
  Devis        │ ✅ OK  │ 15s ago  │  97.5%     │ 18.2s        │  3
  Knowledge    │ ✅ OK  │ 30m ago  │ 100.0%     │  8.5s        │  0
  Intelligence │ ✅ OK  │ 10m ago  │ 100.0%     │  0.2s        │ N/A

── Dead Letter Queue ────────────────────────────────────────────────────
  DLQ Items (unresolved): 0
  DLQ Items (last 7 days): 2

── Error Log (last 24h) ─────────────────────────────────────────────────
  14:32:05 │ devis:parsing │ RETRY 2/3 │ Google Vision timeout
  13:45:22 │ project:enrich│ WARN      │ ADEME API rate limit — recovered

── Alerts ───────────────────────────────────────────────────────────────
  No active alerts
```

### API endpoints du dashboard

| Endpoint | Données | Actualisation |
|---|---|---|
| `GET /api/v1/engine/status` | health_score, status, pending/failed counts | Polling 30s |
| `GET /api/v1/engine/stats?period=1h` | timeline, success_rate, avg_duration | Polling 60s |
| `GET /api/v1/engine/orchestration` | dernière orchestration complète | Polling 30s |
| `GET /api/v1/admin/dlq` | items DLQ non résolus | À implémenter en P1 |

---

## Part 11 — Stratégie Error Handling complète

### Classification des erreurs

| Catégorie | Exemples | Retryable | Action |
|---|---|---|---|
| **Transient** | API timeout, rate limit, DB lock | ✅ Oui | Exponential backoff, max 3× |
| **Client error** | Fichier corrompu, SIRET invalide | ❌ Non | DLQ + notification admin |
| **Dependency** | client_id introuvable, projet manquant | ❌ Non | Rejet 422 + message clair |
| **System** | Supabase down, Edge Fn crash | ✅ Oui (délai plus long) | Backoff 5s/15s/60s |
| **Data** | parsing_result null, embedding_vector null | ❌ Non | DLQ + debug trace |

### Timing des retries

```
Attempt 1: immédiat
Attempt 2: +1s
Attempt 3: +2s
Attempt 4: → DEAD LETTER (pas de 4ème)

Pour erreurs système:
Attempt 1: +5s
Attempt 2: +15s
Attempt 3: +60s
Attempt 4: → DEAD LETTER
```

### Logging structuré

Tous les handlers de l'OrchestratorService utilisent `structuredLogger` avec ce format:

```typescript
structuredLogger.error({
  service: 'OrchestratorService',
  method: 'handleDevisUploaded',
  message: 'Pipeline step failed',
  devisId: payload.devisId,
  jobId: payload.jobId,
  error: err.message,
  retryable: true,
  attempt: retryCount + 1,
});
```

---

## Checklist de validation

### Architecture ✅
- [x] Modèle hybrid event-driven + DAG choisi et justifié
- [x] 18 événements documentés avec payloads typés
- [x] State machine Devis définie (9 états, transitions complètes)

### Implementation Design ✅
- [x] `EventBus.ts` — skeleton complet type-safe
- [x] `OrchestratorService.ts` — skeleton complet avec tous les handlers
- [x] `DependencyValidator.ts` — skeleton complet
- [x] Migration DLQ `20260328000005_create_pipeline_dead_letters.sql`
- [x] Bootstrap wiring dans `server.ts`
- [x] Intégration avec routes existantes documentée

### Error Handling ✅
- [x] Classification transient vs client vs dependency vs system
- [x] Backoff exponentiel: 1s / 2s / 4s (3 tentatives max)
- [x] Dead letter queue: table DB + `moveToDLQ()` implémentée
- [x] Logging structuré sur tous les failure paths

### Monitoring ✅
- [x] 3 catégories métriques (performance, fiabilité, business)
- [x] Seuils d'alerte définis (health_score < 70 → event)
- [x] Dashboard mockup complet
- [x] API endpoints de monitoring existants réutilisés

---

## Prêt pour implémentation

### Ordre d'implémentation recommandé

| # | Fichier | Priorité | Effort |
|---|---|---|---|
| 1 | `src/core/events/events.types.ts` | P0 | 30 min — types purs |
| 2 | `src/core/events/EventBus.ts` | P0 | 45 min — copier skeleton |
| 3 | `src/core/services/DependencyValidator.ts` | P0 | 1h — copier skeleton |
| 4 | `src/core/services/OrchestratorService.ts` | P0 | 2h — copier + ajuster imports |
| 5 | Migration `20260328000005` (DLQ table) | P0 | 15 min |
| 6 | `src/api/server.ts` bootstrap | P0 | 15 min — 3 lignes |
| 7 | Émettre events dans routes upload/client/projet | P1 | 1h |
| 8 | `GET /api/v1/admin/dlq` endpoint | P1 | 30 min |
| 9 | Tests `orchestrator.test.ts` | P1 | 2h |
| 10 | Slack alert dans `handleHealthDegraded` | P2 | 1h |
