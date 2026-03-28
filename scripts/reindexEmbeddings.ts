#!/usr/bin/env tsx
/**
 * reindexEmbeddings.ts — Backfill missing embedding_vector values
 *
 * Finds all knowledge_chunks where embedding_vector IS NULL,
 * calls the generate-embedding Edge Function in batches,
 * and writes results back to embedding_vector.
 *
 * Safe: read-only until Edge Function returns; only updates
 * embedding_vector and embedding_generated_at — never touches schema.
 *
 * Usage:
 *   pnpm reindex:embeddings
 *   pnpm reindex:embeddings --dry-run    (count only, no writes)
 *   pnpm reindex:embeddings --limit 500  (cap at N chunks)
 *   pnpm reindex:embeddings --json       (machine-readable output)
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

// ─── CLI flags ────────────────────────────────────────────────────────────────

const DRY_RUN  = process.argv.includes('--dry-run');
const JSON_MODE = process.argv.includes('--json');

const limitArg = process.argv.find(a => a.startsWith('--limit='))
  ?? (process.argv.includes('--limit') ? `--limit=${process.argv[process.argv.indexOf('--limit') + 1]}` : undefined);
const LIMIT = limitArg ? parseInt(limitArg.split('=')[1], 10) : Infinity;

// ─── constants ────────────────────────────────────────────────────────────────

const BATCH_SIZE          = 50;   // chunks per Edge Function call
const PAGE_SIZE           = 500;  // rows fetched per Supabase query
const EMBEDDING_MODEL     = 'text-embedding-3-small';
const EMBEDDING_DIMENSIONS = 384; // must match knowledge_chunks.embedding_vector column type

// ─── helpers ──────────────────────────────────────────────────────────────────

const C = {
  ok:    '\x1b[32m✓\x1b[0m',
  warn:  '\x1b[33m⚠\x1b[0m',
  error: '\x1b[31m✗\x1b[0m',
  reset: '\x1b[0m',
  bold:  '\x1b[1m',
  dim:   '\x1b[2m',
  cyan:  '\x1b[36m',
};

function log(...args: unknown[]): void {
  if (!JSON_MODE) console.log(...args);
}

function progress(done: number, total: number, errors: number): void {
  if (JSON_MODE) return;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  const bar = '█'.repeat(Math.floor(pct / 5)) + '░'.repeat(20 - Math.floor(pct / 5));
  process.stdout.write(`\r  [${bar}] ${pct}%  ${done}/${total} embedded  ${errors} errors   `);
}

// ─── credentials ──────────────────────────────────────────────────────────────

const url = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL ?? '';
const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.VITE_SUPABASE_ANON_KEY ?? '';

if (!url || !key) {
  console.error('Aborted: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.');
  process.exit(1);
}

const supabase = createClient(url, key);

log(`\n${C.bold}Reindex Embeddings${C.reset}${DRY_RUN ? `  ${C.cyan}[DRY RUN]${C.reset}` : ''}${isFinite(LIMIT) ? `  ${C.cyan}[limit=${LIMIT}]${C.reset}` : ''}`);

// ─── Step 1: count missing ────────────────────────────────────────────────────

log('\n── Counting chunks with missing embedding_vector …');

const { count: totalMissing, error: countErr } = await supabase
  .from('knowledge_chunks')
  .select('*', { count: 'exact', head: true })
  .is('embedding_vector', null);

if (countErr) {
  console.error(`${C.error} Failed to count chunks: ${countErr.message}`);
  process.exit(1);
}

const toProcess = Math.min(totalMissing ?? 0, isFinite(LIMIT) ? LIMIT : Infinity);

if (toProcess === 0) {
  log(`\n${C.ok}  COUNT(embedding_vector) = COUNT(*) — nothing to do.\n`);
  if (JSON_MODE) console.log(JSON.stringify({ status: 'complete', processed: 0, errors: 0 }));
  process.exit(0);
}

log(`  Found ${totalMissing} chunk(s) missing embedding_vector${isFinite(LIMIT) ? ` (capped at ${LIMIT})` : ''}\n`);

if (DRY_RUN) {
  log(`${C.warn}  DRY RUN: would process ${toProcess} chunk(s). Re-run without --dry-run to apply.\n`);
  if (JSON_MODE) console.log(JSON.stringify({ status: 'dry-run', wouldProcess: toProcess }));
  process.exit(0);
}

// ─── Step 2: fetch and embed in pages ────────────────────────────────────────

let processedTotal = 0;
let embeddedTotal  = 0;
let errorTotal     = 0;
let offset         = 0;

while (processedTotal < toProcess) {
  const remaining = toProcess - processedTotal;
  const fetchSize = Math.min(PAGE_SIZE, remaining);

  const { data: chunks, error: fetchErr } = await supabase
    .from('knowledge_chunks')
    .select('id, content')
    .is('embedding_vector', null)
    .order('created_at', { ascending: true })
    .range(offset, offset + fetchSize - 1);

  if (fetchErr) {
    console.error(`\n${C.error} Failed to fetch chunks at offset ${offset}: ${fetchErr.message}`);
    errorTotal += fetchSize;
    break;
  }

  if (!chunks || chunks.length === 0) break;

  // Process in batches of BATCH_SIZE
  for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
    const batch = chunks.slice(i, i + BATCH_SIZE);
    const texts = batch.map(c => c.content ?? '').filter(Boolean);

    if (texts.length === 0) {
      errorTotal += batch.length;
      continue;
    }

    try {
      const { data: efData, error: efErr } = await supabase.functions.invoke(
        'generate-embedding',
        { body: { inputs: texts, model: EMBEDDING_MODEL, dimensions: EMBEDDING_DIMENSIONS } }
      );

      if (efErr || !efData?.embeddings || !Array.isArray(efData.embeddings)) {
        const msg = efErr?.message ?? 'Invalid response (no embeddings array)';
        if (!JSON_MODE) process.stdout.write('\n');
        console.error(`${C.warn} Batch failed (offset ${processedTotal + i}): ${msg}`);
        errorTotal += batch.length;
        continue;
      }

      const embeddings: number[][] = efData.embeddings;
      const now = new Date().toISOString();

      // Write each embedding back
      const updates = batch.map((chunk, idx) => ({
        id: chunk.id,
        embedding_vector: embeddings[idx] ?? null,
        embedding_generated_at: now,
      }));

      // Upsert in sub-batches to avoid hitting PostgREST body limits
      for (const update of updates) {
        if (!update.embedding_vector) { errorTotal++; continue; }

        const { error: writeErr } = await supabase
          .from('knowledge_chunks')
          .update({
            embedding_vector: update.embedding_vector,
            embedding_generated_at: update.embedding_generated_at,
          })
          .eq('id', update.id)
          .is('embedding_vector', null); // idempotency guard

        if (writeErr) {
          errorTotal++;
        } else {
          embeddedTotal++;
        }
      }
    } catch (e: any) {
      if (!JSON_MODE) process.stdout.write('\n');
      console.error(`${C.error} Batch exception: ${e.message}`);
      errorTotal += batch.length;
    }

    processedTotal += batch.length;
    progress(embeddedTotal, toProcess, errorTotal);
  }

  offset += chunks.length;

  // If we got fewer rows than fetched (last page), stop
  if (chunks.length < fetchSize) break;
}

if (!JSON_MODE) process.stdout.write('\n');

// ─── Final report ─────────────────────────────────────────────────────────────

const { count: remainingMissing } = await supabase
  .from('knowledge_chunks')
  .select('*', { count: 'exact', head: true })
  .is('embedding_vector', null);

const summary = {
  processed:  processedTotal,
  embedded:   embeddedTotal,
  errors:     errorTotal,
  stillMissing: remainingMissing ?? 0,
  complete:   (remainingMissing ?? 0) === 0,
};

if (JSON_MODE) {
  console.log(JSON.stringify(summary, null, 2));
} else {
  console.log(`\n${'═'.repeat(64)}`);
  console.log(`${C.bold}  Reindex summary${C.reset}`);
  console.log('═'.repeat(64));
  console.log(`  ${C.ok}  Embedded      : ${embeddedTotal}`);
  console.log(`  ${C.error}  Errors        : ${errorTotal}`);
  console.log(`  ${C.warn}  Still missing : ${remainingMissing ?? 0}`);
  if (summary.complete) {
    console.log(`\n  ${C.ok} COUNT(embedding_vector) = COUNT(*) — pipeline complete.`);
  } else {
    console.log(`\n  ${C.warn} ${remainingMissing} chunks still need embeddings.`);
    if (errorTotal > 0) {
      console.log(`     Re-run: pnpm reindex:embeddings`);
    }
  }
  console.log('');
}

process.exit(summary.complete && errorTotal === 0 ? 0 : 1);
