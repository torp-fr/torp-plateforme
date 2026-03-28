# AI_SESSION_WORKFLOW.md — Claude Code Session Protocol

> This file defines the mandatory workflow for every AI-assisted development session on TORP.
> Following this protocol prevents unsafe changes and context errors.

---

## Mandatory Session Start

Every Claude Code session must begin with:

```bash
pnpm claude:bootstrap
```

This prints the live architecture summary, engine list, constraints, and available commands.

---

## Workflow Steps

### Step 1 — Bootstrap

```bash
pnpm claude:bootstrap
```

Outputs:
- Engine pipeline (12 engines)
- AI services count
- Edge function count
- Critical constraints summary

### Step 2 — Load context files

Read (in order):
1. `CLAUDE.md` — full architecture reference
2. `PROJECT_CONTEXT.md` — auto-generated file map

If `PROJECT_CONTEXT.md` is missing or stale:
```bash
pnpm context:generate
```

### Step 3 — Health check (if working on ingestion/RAG)

```bash
pnpm health:check
```

Confirms:
- `COUNT(embedding_vector) = COUNT(*)` in knowledge_chunks
- No stuck documents
- Edge Function reachable
- No column name violations in source

### Step 4 — Analyze the requested task

Before writing any code, identify:

1. **Which subsystem** does the task touch?
   - Engine pipeline → `src/core/engines/`
   - RAG retrieval → `src/core/rag/`
   - Knowledge ingestion → `src/services/knowledge/` + `rag-worker/`
   - AI orchestration → `src/services/ai/`
   - Edge Functions → `supabase/functions/`
   - Frontend → `src/features/`

2. **Is the file standalone?**
   - `rag-worker/worker.js` is **not** part of `src/`. Changes there are isolated.

3. **Does it touch the database?**
   - Any write to `knowledge_chunks` → must use `embedding_vector`
   - Any schema change → requires a migration file

4. **Does it touch the engine pipeline?**
   - Understand which engines run before/after
   - Check `EngineExecutionContext` for shared data

### Step 5 — Identify impacted subsystem

Map the task to the table below:

| Task type | Impacted files | Risk level |
|-----------|----------------|------------|
| UI change | `src/features/` | Low |
| AI prompt | `src/services/ai/prompts/` | Medium |
| New engine rule | `src/core/engines/*.engine.ts` | High |
| RAG retrieval | `src/core/rag/retrieval/` | Medium |
| Ingestion bug | `rag-worker/worker.js` OR `knowledgeStepRunner.service.ts` | High |
| DB column write | `knowledge_chunks` | Critical |
| Edge Function | `supabase/functions/<name>/index.ts` | Medium |
| Schema change | `supabase/migrations/` | Critical |

### Step 6 — Implement safely

Apply these rules:

- Read the target file before modifying it
- Do not change engine execution order
- Do not add columns to `knowledge_chunks` without a migration
- After changing `rag-worker/worker.js`, verify no `embedding:` writes remain
- After changing an Edge Function, redeploy it: `supabase functions deploy <name>`
- After any ingestion change, run `pnpm health:check` to verify

### Step 7 — Verify

After implementation:

```bash
# If ingestion was touched:
pnpm health:check

# If chunks may be missing embeddings:
pnpm reindex:embeddings

# If documents are stuck:
pnpm fix:pipeline
```

---

## Prohibited Actions

| Action | Why |
|--------|-----|
| Writing `embedding:` to `knowledge_chunks` | Wrong column — causes PGRST204 |
| Changing engine execution order | Breaks inter-engine dependencies |
| Executing DDL from application code | Use migration files |
| Setting ingestion_status to `processing` manually | Bypasses the claim lock |
| Using anon key for server-side ingestion writes | Fails RLS |
| Modifying `rag-worker/worker.js` from `src/` imports | They are separate runtimes |

---

## Quick Reference — Key Files

| Purpose | File |
|---------|------|
| Engine orchestrator | `src/core/platform/engineOrchestrator.ts` |
| Active ingestion path | `src/services/knowledge/knowledgeStepRunner.service.ts` |
| Standalone worker | `rag-worker/worker.js` |
| Embedding generation | `src/core/knowledge/ingestion/knowledgeEmbedding.service.ts` |
| RAG entry point | `src/core/rag/rag.service.ts` |
| AI orchestration | `src/services/ai/aiOrchestrator.service.ts` |
| DB trigger migration | `supabase/migrations/20260228191032_trigger_rag_ingestion.sql` |
| Vector upgrade migration | `supabase/migrations/20260307000002_hybrid_rag_search.sql` |
| Supabase client | `src/lib/supabase.ts` |

---

## Architecture Diagram (quick reference)

```
PDF Upload
  │
  ▼
knowledge_documents INSERT (status=pending)
  │
  ▼ [DB trigger: on_document_pending]
  │
  ├─► rag-ingestion Edge Function (claims doc)
  │
  ├─► knowledgeStepRunner.service.ts (frontend path)
  │     Extract → Chunk → Embed → Write knowledge_chunks
  │
  └─► rag-worker/worker.js (standalone worker path)
        Extract → Chunk → Embed → Write knowledge_chunks
                                    └─ embedding_vector ← ALWAYS this column
```
