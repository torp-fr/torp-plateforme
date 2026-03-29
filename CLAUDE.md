# CLAUDE.md — TORP Platform Architecture Reference

> **Read this file at the start of every session.**
> It gives you the full architectural context needed to make safe, targeted changes.

---

## 1. Product Overview

**TORP** (Trust-Oriented Rating Platform) is a SaaS platform that analyzes French construction quotes (*devis BTP*) and generates a **trust score from A to E**. It helps project owners assess the reliability, pricing accuracy, and regulatory compliance of construction contractors.

**Core value proposition**: Take a construction quote PDF → run 12 specialized analysis engines → return a structured trust score with a detailed narrative explanation.

---

## 2. Business Model

- SaaS, B2B (project owners, architects, project managers in BTP)
- Input: construction quote (PDF, image, text)
- Output: trust score A–E + detailed report with lot-by-lot breakdown
- Revenue: subscription per analysis or per user seat

---

## 3. Platform Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        React Frontend                           │
│              src/features/  ·  src/components/                  │
└───────────────────────────────┬─────────────────────────────────┘
                                │
┌───────────────────────────────▼─────────────────────────────────┐
│                    API Layer  (api/v1/)                          │
│         Vercel serverless functions + Edge Functions             │
└───────────────────────────────┬─────────────────────────────────┘
                                │
┌───────────────────────────────▼─────────────────────────────────┐
│              Engine Orchestrator (Platform Core)                 │
│         src/core/platform/engineOrchestrator.ts                 │
│                                                                  │
│   ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐       │
│   │ Context  │  │   Lot    │  │  Rule    │  │ Scoring  │       │
│   │ Engine   │  │ Engine   │  │ Engine   │  │ Engine   │       │
│   └──────────┘  └──────────┘  └──────────┘  └──────────┘       │
│   ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐       │
│   │Enrichment│  │  Audit   │  │Enterprise│  │ Pricing  │       │
│   │ Engine   │  │ Engine   │  │ Engine   │  │ Engine   │       │
│   └──────────┘  └──────────┘  └──────────┘  └──────────┘       │
│   ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐       │
│   │ Quality  │  │ Global   │  │  Trust   │  │Structural│       │
│   │ Engine   │  │ Scoring  │  │ Capping  │  │Consistncy│       │
│   └──────────┘  └──────────┘  └──────────┘  └──────────┘       │
└───────────────────────────────┬─────────────────────────────────┘
                                │
┌───────────────────────────────▼─────────────────────────────────┐
│                    AI Orchestration Layer                        │
│   AIOrchestrator  ·  HybridAIService  ·  KnowledgeBrain         │
│   Claude API  ·  OpenAI API  ·  Google Vision OCR               │
└───────────────────────────────┬─────────────────────────────────┘
                                │
┌───────────────────────────────▼─────────────────────────────────┐
│                 RAG Knowledge System                             │
│   Semantic search  ·  Hybrid search  ·  Context builder          │
│   knowledge_chunks (pgvector VECTOR(384))                        │
└───────────────────────────────┬─────────────────────────────────┘
                                │
┌───────────────────────────────▼─────────────────────────────────┐
│                   Supabase Backend                               │
│   PostgreSQL  ·  pgvector  ·  Storage  ·  Auth  ·  Realtime     │
│   Edge Functions (Deno)                                          │
└─────────────────────────────────────────────────────────────────┘
```

---

## 4. TORP Engine Pipeline

The engine pipeline is the analytical core. **Never modify engine logic without understanding the full pipeline.**

Engines execute sequentially via `EngineOrchestrator` (`src/core/platform/engineOrchestrator.ts`).

| # | Engine | File | Purpose |
|---|--------|------|---------|
| 1 | Context Engine | `context.engine.ts` | Extract project context, geography, category |
| 2 | Lot Engine | `lot.engine.ts` | Parse and structure work lots (corps d'état) |
| 3 | Rule Engine | `rule.engine.ts` | Apply regulatory and contractual rules |
| 4 | Scoring Engine | `scoring.engine.ts` | Compute per-lot trust scores |
| 5 | Enrichment Engine | `enrichment.engine.ts` | Enrich with external data (Pappers, cadastre) |
| 6 | Audit Engine | `audit.engine.ts` | Compliance and anomaly detection |
| 7 | Enterprise Engine | `enterprise.engine.ts` | Company verification and solvency checks |
| 8 | Pricing Engine | `pricing.engine.ts` | Unit price analysis vs market references |
| 9 | Quality Engine | `quality.engine.ts` | Document quality and completeness |
| 10 | Global Scoring | `globalScoring.engine.ts` | Aggregate final A–E score |
| 11 | Trust Capping | `trustCapping.engine.ts` | Apply ceiling rules to the trust score |
| 12 | Structural Consistency | `structuralConsistency.engine.ts` | Cross-engine coherence validation |

**Execution context**: `EngineExecutionContext` (src/core/platform/engineExecutionContext.ts)
**Engine registry**: `ENGINE_REGISTRY` (src/core/platform/engineRegistry.ts)
**Audit snapshots**: `AuditSnapshotManager` (src/core/platform/auditSnapshot.manager.ts)

---

## 5. RAG System

Retrieval-Augmented Generation enriches engine analysis with domain knowledge.

### Architecture

```
Query → Embedding (384-dim) → Semantic Search → Hybrid Reranker → Context Builder → LLM
```

### Key files

| File | Purpose |
|------|---------|
| `src/core/rag/rag.service.ts` | Main RAG entry point |
| `src/core/rag/retrieval/semanticSearch.service.ts` | pgvector cosine search |
| `src/core/rag/retrieval/hybridSearch.service.ts` | Vector + FTS hybrid |
| `src/core/rag/retrieval/reranker.service.ts` | Re-rank by relevance |
| `src/core/rag/retrieval/queryRewrite.service.ts` | Query reformulation |
| `src/core/rag/retrieval/queryDecomposition.service.ts` | Multi-query decomposition |
| `src/core/rag/context/contextBuilder.service.ts` | Build LLM context window |
| `src/core/rag/embeddings/embedding.service.ts` | Text → vector |
| `src/core/rag/embeddings/embeddingOrchestrator.service.ts` | Batch embedding management |
| `src/core/rag/analytics/ragTracing.service.ts` | RAG trace and debugging |

### Database table

```sql
knowledge_chunks (
  id uuid PRIMARY KEY,
  document_id uuid REFERENCES knowledge_documents(id),
  chunk_index int,
  content text,
  token_count int,
  metadata jsonb,
  embedding_vector vector(384),   -- CRITICAL: always this column name
  embedding_generated_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz
)
```

**CRITICAL**: The column is `embedding_vector`, never `embedding`. Any write to `knowledge_chunks` that uses `.update({ embedding: ... })` or `.insert({ embedding: ... })` will cause a PostgREST PGRST204 error.

---

## 6. Knowledge Ingestion Pipeline

Documents go through a multi-step ingestion pipeline before becoming searchable.

### Flow

```
Upload → knowledge_documents INSERT (status=pending)
  → DB trigger on_document_pending
  → rag-ingestion Edge Function (claim document)
  → knowledgeStepRunner.service.ts (browser/frontend path)
  OR
  → rag-worker/worker.js (standalone Node.js worker)
  → Extract text (PDF/OCR)
  → Chunk (smartChunker)
  → Embed (generate-embedding Edge Function → embedding_vector)
  → Write knowledge_chunks
  → Update document status → 'completed'
```

### Status states

`pending` → `processing` → `extracting` → `chunking` → `embedding` → `completed` | `failed`

### Key files

| File | Purpose |
|------|---------|
| `src/services/knowledge/knowledgeStepRunner.service.ts` | Main frontend ingestion orchestrator |
| `src/services/knowledge/ingestionStateMachine.service.ts` | State machine for document lifecycle |
| `src/core/knowledge/ingestion/knowledgeChunker.service.ts` | Text chunking |
| `src/core/knowledge/ingestion/smartChunker.service.ts` | Semantic-aware chunking |
| `src/core/knowledge/ingestion/knowledgeEmbedding.service.ts` | Embedding generation (calls Edge Function) |
| `src/core/knowledge/ingestion/knowledgeIndex.service.ts` | Write chunks to DB |
| `rag-worker/worker.js` | Standalone Node.js ingestion worker |
| `supabase/functions/rag-ingestion/index.ts` | Edge Function triggered by DB |

### Embedding constants

```typescript
const EMBEDDING_MODEL = 'text-embedding-3-small';
const EMBEDDING_DIMENSIONS = 384;  // must match vector(384) column
```

### Known fixed bug

`rag-worker/worker.js` previously wrote to `embedding: embedding` (wrong column).
**Fixed**: now correctly writes `embedding_vector: embedding`.

---

## 7. AI Orchestration Architecture

```
AIOrchestrator (src/services/ai/aiOrchestrator.service.ts)
  ├── LLM completions → llm-completion Edge Function → Claude / OpenAI
  ├── Embeddings → generate-embedding Edge Function → OpenAI
  └── Analysis pipeline → calls engine subsystem

HybridAIService (src/services/ai/hybrid-ai.service.ts)
  ├── Primary: Claude (claude.service.ts)
  ├── Secondary: OpenAI (openai.service.ts)
  └── Fallback handling and retry logic

KnowledgeBrain (src/services/ai/knowledge-brain.service.ts)
  └── RAG-augmented AI responses for knowledge queries

SecureAIService (src/services/ai/secure-ai.service.ts)
  └── PII sanitization, prompt injection guard, rate limiting
```

---

## 8. Supabase Backend Architecture

### Key tables

| Table | Purpose |
|-------|---------|
| `knowledge_documents` | Document metadata and ingestion state |
| `knowledge_chunks` | Chunked text + embedding_vector (384-dim) |
| `analysis_jobs` | Async analysis job queue |
| `orchestration_runs` | Engine orchestration audit trail |
| `engine_executions` | Per-engine execution results |
| `client_enriched_data` | Geospatial/cadastre enrichment cache |

### Database trigger

`on_document_pending` fires on INSERT to `knowledge_documents` where `ingestion_status = 'pending'`.
Calls `rag-ingestion` Edge Function via `pg_net.http_post()`.

### Authentication

Supabase Auth with RLS policies. Service role key used for ingestion scripts.

### Migrations

79+ migrations in `supabase/migrations/`. Applied via Supabase dashboard (not CLI-tracked).

---

## 9. Edge Function Architecture

All Edge Functions are in `supabase/functions/`. Runtime: Deno.

| Function | Trigger | Purpose |
|----------|---------|---------|
| `generate-embedding` | HTTP POST | Text → vector (OpenAI, 384 or 1536 dim) |
| `rag-ingestion` | DB trigger | Claim and start document ingestion |
| `rag-query` | HTTP POST | RAG search endpoint |
| `llm-completion` | HTTP POST | Claude/OpenAI completion proxy |
| `analyze-devis` | HTTP POST | Quote analysis entry point |
| `analyze-construction-photo` | HTTP POST | Photo analysis via Vision |
| `analyze-photo` | HTTP POST | Generic photo analysis |
| `google-vision-ocr` | HTTP POST | OCR via Google Vision API |
| `recognize-material` | HTTP POST | Material recognition |
| `scrape-enterprise` | HTTP POST | Company data via Pappers |
| `scrape-prices` | HTTP POST | Market price scraping |
| `scrape-regulations` | HTTP POST | Regulatory reference scraping |
| `pappers-proxy` | HTTP POST | Pappers API proxy |
| `refresh-company-cache` | Scheduled | Update company data cache |
| `cleanup-company-cache` | Scheduled | Purge stale cache entries |
| `webhook-n8n` | HTTP POST | n8n workflow integration |
| `test-company-search` | HTTP POST | Debug endpoint |

### generate-embedding specifics

- Supports `{ inputs: string[], model?, dimensions? }` (batch)
- Also supports `{ texts: string[] }` and `{ text: string }` (legacy)
- Returns `{ embeddings: number[][] }` for batch, `{ embedding: number[] }` for single
- **Deployed version**: honors `dimensions` parameter (as of last deploy)

---

## 10. Important Architectural Rules

### NEVER violate these

1. **`embedding_vector` is the only valid column name** for vector writes in `knowledge_chunks`. Never use `embedding`.

2. **Engine pipeline order is fixed**. Engines run sequentially. Do not change execution order without understanding inter-engine dependencies.

3. **Do not modify production schema directly**. Use migration files. Never execute DDL from application code.

4. **The DB trigger is authoritative for ingestion start**. `on_document_pending` triggers ingestion — never bypass it by manually setting status to `processing`.

5. **`rag-worker/worker.js` is standalone**. It has its own Supabase client and does not share code with `src/`. Changes to `src/` do not affect it.

6. **RLS is active**. Always use the service role key for server-side ingestion writes.

7. **`embedding_vector` dimension must match**. Current schema: `vector(384)`. Edge Function called with `dimensions: 384`. Do not change one without changing the other.

---

## 11. Safe Modification Guidelines

### Before modifying any file

1. Run `pnpm health:check` to confirm pipeline state
2. Identify which subsystem the file belongs to (see architecture map above)
3. Check if the file is in `rag-worker/` — it is **standalone** and separate from `src/`
4. Check for DB column name usage — always `embedding_vector` in `knowledge_chunks`

### Safe to modify

- `src/features/` — UI components
- `src/services/ai/` — AI services (with care)
- `scripts/` — Dev tooling
- `supabase/functions/` — Edge Functions (redeploy after changes)

### Requires extra care

- `src/core/engines/` — Any change affects all analyses
- `src/core/platform/engineOrchestrator.ts` — Execution order
- `src/services/knowledge/knowledgeStepRunner.service.ts` — Active ingestion path
- `rag-worker/worker.js` — Production ingestion worker

### Do not touch without a migration

- Any change to Supabase table schema
- Any change to column names or types
- Any change to pgvector dimensions

---

## 12. Known System Constraints

| Constraint | Detail |
|------------|--------|
| `embedding_vector` column | `VECTOR(384)` — Edge Function must be called with `dimensions: 384` |
| Migration tracking | Migrations applied via dashboard, not CLI. `supabase migration list` shows all as untracked |
| `rag-worker` path | Standalone Node.js — not TypeScript, not bundled, has its own `package.json` |
| Edge Function deploy | `supabase functions deploy <name>` — Docker not required (upload mode) |
| Ingestion state machine | Stuck docs (>30 min in non-final state) → reset via `pnpm fix:pipeline` |
| RLS bypass | Use `SUPABASE_SERVICE_ROLE_KEY` for ingestion scripts, not the anon key |

---

## Dev Scripts

```bash
pnpm health:check         # Read-only pipeline health check (7 checks)
pnpm fix:pipeline         # Reset stuck docs, retry failed docs
pnpm reindex:embeddings   # Backfill NULL embedding_vector for all chunks
pnpm context:generate     # Regenerate PROJECT_CONTEXT.md
pnpm claude:bootstrap     # Print session summary for AI onboarding
```
