#!/usr/bin/env tsx
/**
 * autoFixPipeline.ts — Ingestion pipeline repair tool
 *
 * Safe repairs only (never modifies schema):
 *   1. Reset stuck documents  →  processing > 30 min → back to 'pending'
 *   2. Trigger re-ingestion   →  call rag-ingestion Edge Function for reset docs
 *   3. Report source audit    →  flag embedding column name violations (no auto-fix)
 *
 * Usage:
 *   pnpm fix:pipeline
 *   pnpm fix:pipeline --dry-run     (show what would change, write nothing)
 *   pnpm fix:pipeline --json        (machine-readable output)
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

// ─── types ────────────────────────────────────────────────────────────────────

type Severity = 'ok' | 'warn' | 'error' | 'fixed';

interface ActionResult {
  action: string;
  status: Severity;
  message: string;
  detail?: string;
  count?: number;
}

// ─── CLI flags ────────────────────────────────────────────────────────────────

const DRY_RUN  = process.argv.includes('--dry-run');
const JSON_MODE = process.argv.includes('--json');

// ─── output helpers ───────────────────────────────────────────────────────────

const results: ActionResult[] = [];

const C = {
  ok:    '\x1b[32m✓\x1b[0m',
  fixed: '\x1b[36m⚡\x1b[0m',
  warn:  '\x1b[33m⚠\x1b[0m',
  error: '\x1b[31m✗\x1b[0m',
  reset: '\x1b[0m',
  bold:  '\x1b[1m',
  dim:   '\x1b[2m',
  cyan:  '\x1b[36m',
};

function record(action: string, status: Severity, message: string, detail?: string, count?: number): void {
  results.push({ action, status, message, detail, count });
  if (!JSON_MODE) {
    const icon = status === 'fixed' ? C.fixed : C[status as keyof typeof C] ?? C.warn;
    const colour = status === 'ok' || status === 'fixed' ? '\x1b[32m'
      : status === 'warn' ? '\x1b[33m' : '\x1b[31m';
    console.log(`  ${icon}  ${colour}${message}${C.reset}`);
    if (detail) console.log(`     ${C.dim}${detail}${C.reset}`);
  }
}

function section(title: string): void {
  if (!JSON_MODE) console.log(`\n${C.bold}── ${title} ${'─'.repeat(Math.max(0, 60 - title.length))}${C.reset}`);
}

// ─── credentials ──────────────────────────────────────────────────────────────

const url    = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL ?? '';
const key    = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.VITE_SUPABASE_ANON_KEY ?? '';

if (!url || !key) {
  console.error('Aborted: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.');
  process.exit(1);
}

if (!JSON_MODE) {
  console.log(`\n${C.bold}Pipeline Auto-Fix${C.reset}${DRY_RUN ? `  ${C.cyan}[DRY RUN — no writes]${C.reset}` : ''}`);
}

const supabase = createClient(url, key);

// ─── 1. Reset stuck documents ─────────────────────────────────────────────────

section('1. Stuck documents');

const STUCK_THRESHOLD_MS = 30 * 60 * 1000; // 30 minutes
const thirtyMinAgo = new Date(Date.now() - STUCK_THRESHOLD_MS).toISOString();

const { data: stuckDocs, error: stuckErr } = await supabase
  .from('knowledge_documents')
  .select('id, title, ingestion_status, ingestion_started_at, ingestion_attempts')
  .in('ingestion_status', ['processing', 'extracting', 'chunking', 'embedding'])
  .lt('ingestion_started_at', thirtyMinAgo);

if (stuckErr) {
  record('stuck.query', 'error', 'Failed to query stuck documents', stuckErr.message);
} else if (!stuckDocs || stuckDocs.length === 0) {
  record('stuck.reset', 'ok', 'No stuck documents found');
} else {
  if (!JSON_MODE) {
    console.log(`     ${C.dim}Found ${stuckDocs.length} stuck document(s):${C.reset}`);
    for (const d of stuckDocs.slice(0, 10)) {
      console.log(`     ${C.dim}  → ${d.id} "${d.title}" [${d.ingestion_status}] attempts=${d.ingestion_attempts ?? 0}${C.reset}`);
    }
  }

  if (DRY_RUN) {
    record('stuck.reset', 'warn',
      `DRY RUN: Would reset ${stuckDocs.length} document(s) to pending`,
      'Re-run without --dry-run to apply');
  } else {
    const ids = stuckDocs.map(d => d.id);

    const { error: resetErr } = await supabase
      .from('knowledge_documents')
      .update({
        ingestion_status: 'pending',
        ingestion_started_at: null,
        pipeline_timeout_at: null,
        last_ingestion_error: 'Reset by autoFixPipeline after 30-min timeout',
      })
      .in('id', ids)
      .in('ingestion_status', ['processing', 'extracting', 'chunking', 'embedding']);

    if (resetErr) {
      record('stuck.reset', 'error',
        `Failed to reset ${stuckDocs.length} document(s)`, resetErr.message);
    } else {
      record('stuck.reset', 'fixed',
        `Reset ${stuckDocs.length} document(s) to pending`,
        `IDs: ${ids.slice(0, 3).join(', ')}${ids.length > 3 ? ` +${ids.length - 3} more` : ''}`,
        stuckDocs.length);

      // Re-trigger ingestion for reset documents
      section('1b. Re-trigger ingestion');
      let triggered = 0;
      let triggerErrors = 0;

      for (const doc of stuckDocs) {
        try {
          const { error: trigErr } = await supabase.functions.invoke('rag-ingestion', {
            body: { documentId: doc.id },
          });
          if (trigErr) {
            triggerErrors++;
            if (!JSON_MODE) console.log(`     ${C.dim}  ⚠ ${doc.id}: ${trigErr.message}${C.reset}`);
          } else {
            triggered++;
          }
        } catch (e: any) {
          triggerErrors++;
          if (!JSON_MODE) console.log(`     ${C.dim}  ⚠ ${doc.id}: ${e.message}${C.reset}`);
        }
      }

      if (triggerErrors === 0) {
        record('stuck.retrigger', 'fixed',
          `Re-triggered ingestion for ${triggered} document(s)`,
          undefined, triggered);
      } else {
        record('stuck.retrigger', 'warn',
          `Re-triggered ${triggered}/${stuckDocs.length} documents (${triggerErrors} failed)`);
      }
    }
  }
}

// ─── 2. Embedding backfill summary ────────────────────────────────────────────

section('2. Embedding backfill');

const { count: missingCount, error: missingErr } = await supabase
  .from('knowledge_chunks')
  .select('*', { count: 'exact', head: true })
  .is('embedding_vector', null);

const { count: totalCount } = await supabase
  .from('knowledge_chunks')
  .select('*', { count: 'exact', head: true });

if (missingErr) {
  record('embeddings.check', 'error', 'Failed to count missing embeddings', missingErr.message);
} else {
  const missing = missingCount ?? 0;
  const total   = totalCount ?? 0;

  if (missing === 0) {
    record('embeddings.check', 'ok',
      `COUNT(embedding_vector) = COUNT(*) — all ${total} chunks embedded`);
  } else {
    record('embeddings.check', 'warn',
      `${missing}/${total} chunks missing embedding_vector`,
      `Run: pnpm reindex:embeddings to backfill`, missing);
  }
}

// ─── 3. Failed documents ──────────────────────────────────────────────────────

section('3. Failed documents');

const MAX_RETRY_ATTEMPTS = 3;

const { data: failedDocs, error: failedErr } = await supabase
  .from('knowledge_documents')
  .select('id, title, ingestion_attempts, last_ingestion_error')
  .eq('ingestion_status', 'failed')
  .lt('ingestion_attempts', MAX_RETRY_ATTEMPTS);

if (failedErr) {
  record('failed.query', 'error', 'Failed to query failed documents', failedErr.message);
} else if (!failedDocs || failedDocs.length === 0) {
  record('failed.reset', 'ok', 'No retryable failed documents');
} else {
  if (!JSON_MODE) {
    for (const d of failedDocs.slice(0, 5)) {
      console.log(`     ${C.dim}  → "${d.title}" attempts=${d.ingestion_attempts ?? 0} error=${d.last_ingestion_error?.slice(0, 60)}${C.reset}`);
    }
  }

  if (DRY_RUN) {
    record('failed.reset', 'warn',
      `DRY RUN: Would retry ${failedDocs.length} failed document(s)`);
  } else {
    const ids = failedDocs.map(d => d.id);
    const { error: retryErr } = await supabase
      .from('knowledge_documents')
      .update({ ingestion_status: 'pending', last_ingestion_error: null })
      .in('id', ids);

    if (retryErr) {
      record('failed.reset', 'error', 'Failed to reset failed documents', retryErr.message);
    } else {
      record('failed.reset', 'fixed',
        `Queued ${failedDocs.length} failed document(s) for retry`,
        undefined, failedDocs.length);
    }
  }
}

// ─── Summary ──────────────────────────────────────────────────────────────────

const errors  = results.filter(r => r.status === 'error').length;
const fixed   = results.filter(r => r.status === 'fixed').length;
const warns   = results.filter(r => r.status === 'warn').length;

if (JSON_MODE) {
  console.log(JSON.stringify({
    dryRun: DRY_RUN,
    results,
    summary: { errors, fixed, warns, ok: results.length - errors - fixed - warns },
  }, null, 2));
} else {
  console.log(`\n${'═'.repeat(64)}`);
  console.log(`${C.bold}  Fix summary${DRY_RUN ? ' (DRY RUN)' : ''}${C.reset}`);
  console.log('═'.repeat(64));
  console.log(`  ${C.fixed}  Fixed   : ${fixed}`);
  console.log(`  ${C.warn}  Warnings: ${warns}`);
  console.log(`  ${C.error}  Errors  : ${errors}`);
  if (fixed > 0) {
    console.log(`\n  ${C.fixed} ${fixed} repair(s) applied.`);
  }
  if (errors > 0) {
    console.log(`\n  ${C.error} Some repairs failed — check logs above.`);
  }
  console.log('');
}

process.exit(errors > 0 ? 1 : 0);
