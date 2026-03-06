#!/usr/bin/env node
/**
 * Embedding Backfill Script
 *
 * Finds every knowledge_chunk where embedding_vector IS NULL, generates
 * embeddings via the generate-embedding Edge Function, and writes them
 * back as Postgres vector literals ('[x,y,z,...]').
 *
 * Usage:
 *   pnpm tsx scripts/backfillEmbeddings.ts
 *   pnpm tsx scripts/backfillEmbeddings.ts --dry-run   # generate only, no DB writes
 *
 * Env:
 *   SUPABASE_SERVICE_ROLE_KEY  (preferred)
 *   VITE_SUPABASE_URL          (or SUPABASE_URL)
 *   VITE_SUPABASE_ANON_KEY     (fallback)
 */

import fs   from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

// ---------------------------------------------------------------------------
// Bootstrap: load .env before any service import resolves env vars
// ---------------------------------------------------------------------------

const require = createRequire(import.meta.url);

try {
  const dotenv  = require('dotenv');
  const envFile = ['.env.local', '.env'].find((f) =>
    fs.existsSync(path.resolve(process.cwd(), f))
  );
  if (envFile) {
    dotenv.config({ path: path.resolve(process.cwd(), envFile) });
  }
} catch {
  // dotenv not installed — env vars must already be present in the shell
}

// ---------------------------------------------------------------------------
// Imports (after env is ready)
// ---------------------------------------------------------------------------

import { getSupabase } from '@/lib/supabase';

// ---------------------------------------------------------------------------
// Constants — must match the values used during ingestion
// ---------------------------------------------------------------------------

const EMBEDDING_MODEL      = 'text-embedding-3-small';
const EMBEDDING_DIMENSIONS = 384;
const BATCH_SIZE           = 100;   // Edge Function hard cap
const PAGE_SIZE            = 1000;  // Supabase select page size

// ---------------------------------------------------------------------------
// Logging helpers
// ---------------------------------------------------------------------------

const SEP2 = '═'.repeat(72);

function tag(label: string) { return `[Backfill:${label}]`.padEnd(24); }
function info(label: string, msg: string) { console.log(`${tag(label)} ${msg}`); }
function warn(label: string, msg: string) { console.warn(`${tag(label)} ⚠  ${msg}`); }
function ok  (label: string, msg: string) { console.log(`${tag(label)} ✓  ${msg}`); }
function ms(start: number) { return `${Date.now() - start}ms`; }

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface ChunkRow { id: string; content: string; }

/** Paginated fetch of all chunks where embedding_vector IS NULL. */
async function fetchNullChunks(): Promise<ChunkRow[]> {
  const supabase = getSupabase();
  const rows: ChunkRow[] = [];
  let from = 0;

  for (;;) {
    const { data, error } = await supabase
      .from('knowledge_chunks')
      .select('id, content')
      .is('embedding_vector', null)
      .range(from, from + PAGE_SIZE - 1);

    if (error) throw new Error(`Failed to fetch chunks: ${error.message}`);
    if (!data || data.length === 0) break;

    rows.push(...(data as ChunkRow[]));
    if (data.length < PAGE_SIZE) break;  // last page
    from += PAGE_SIZE;
  }

  return rows;
}

/** Call the generate-embedding Edge Function for up to BATCH_SIZE texts. */
async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  const supabase = getSupabase();

  const { data, error } = await supabase.functions.invoke('generate-embedding', {
    body: { inputs: texts, model: EMBEDDING_MODEL, dimensions: EMBEDDING_DIMENSIONS },
  });

  if (error) throw new Error(`Edge Function error: ${error.message}`);

  if (!data?.embeddings || !Array.isArray(data.embeddings) || data.embeddings.length === 0) {
    throw new Error('Invalid response from Edge Function — missing embeddings array');
  }

  return data.embeddings as number[][];
}

/** Write a single vector to the DB as a Postgres vector literal '[x,y,z,...]'. */
async function persistVector(chunkId: string, vec: number[]): Promise<boolean> {
  const supabase = getSupabase();

  // pgvector requires the value as a Postgres literal string, not a JS array.
  const vectorString = `[${vec.join(',')}]`;

  const { data, error } = await supabase
    .from('knowledge_chunks')
    .update({ embedding_vector: vectorString })
    .eq('id', chunkId)
    .select('id');

  if (error) {
    warn('DB', `Update failed for chunk ${chunkId}: ${error.message}`);
    return false;
  }

  if (!data || data.length === 0) {
    warn('DB', `Update matched 0 rows for chunk ${chunkId}`);
    return false;
  }

  return true;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function run(): Promise<void> {
  const dryRun = process.argv.includes('--dry-run');

  console.log(SEP2);
  console.log('  Knowledge Brain — Embedding Backfill');
  console.log(SEP2);
  info('Init', `Dry run : ${dryRun ? 'yes (--dry-run)' : 'no'}`);
  info('Init', `Batch   : ${BATCH_SIZE} chunks per Edge Function call`);

  // ── Step 1: SELECT chunks where embedding_vector IS NULL ──────────────────
  const t0 = Date.now();
  info('Fetch', 'Querying chunks with embedding_vector IS NULL ...');
  const chunks = await fetchNullChunks();

  if (chunks.length === 0) {
    ok('Fetch', 'No NULL embeddings found — nothing to do.');
    return;
  }

  info('Fetch', `Found ${chunks.length} chunk(s) without embeddings  (${ms(t0)})`);

  let totalGenerated = 0;
  let totalPersisted = 0;
  let totalFailed    = 0;

  // ── Step 2 & 3: Generate then persist in BATCH_SIZE batches ──────────────
  for (let offset = 0; offset < chunks.length; offset += BATCH_SIZE) {
    const batch   = chunks.slice(offset, offset + BATCH_SIZE);
    const batchNo = Math.floor(offset / BATCH_SIZE) + 1;
    const total   = Math.ceil(chunks.length / BATCH_SIZE);

    info('Batch', `[${batchNo}/${total}] Generating embeddings for ${batch.length} chunk(s) ...`);
    const tBatch = Date.now();

    // ── Generate ────────────────────────────────────────────────────────────
    let embeddings: number[][];
    try {
      embeddings = await generateEmbeddings(batch.map((c) => c.content));
    } catch (err) {
      warn('Batch', `Generation failed for batch ${batchNo}: ${err instanceof Error ? err.message : err}`);
      totalFailed += batch.length;
      continue;  // non-fatal: try remaining batches
    }

    totalGenerated += embeddings.length;
    info('Batch', `Generated ${embeddings.length}/${batch.length}  (${ms(tBatch)})`);

    if (dryRun) {
      info('DryRun', `Skipping DB writes for batch ${batchNo}`);
      continue;
    }

    // ── Persist ─────────────────────────────────────────────────────────────
    for (let i = 0; i < batch.length; i++) {
      const vec = embeddings[i];

      if (!vec || vec.length === 0) {
        warn('DB', `Empty embedding for chunk ${batch[i].id} — skipping`);
        totalFailed++;
        continue;
      }

      const written = await persistVector(batch[i].id, vec);
      if (written) {
        totalPersisted++;
      } else {
        totalFailed++;
      }
    }

    info('Batch', `Batch ${batchNo} done — persisted so far: ${totalPersisted}`);
  }

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log(SEP2);
  info('Summary', `Chunks found        : ${chunks.length}`);
  info('Summary', `Embeddings generated: ${totalGenerated}`);
  info('Summary', `Vectors written     : ${totalPersisted}`);
  info('Summary', `Failures / skipped  : ${totalFailed}`);
  console.log(SEP2);

  if (totalFailed > 0) {
    warn('Summary', `${totalFailed} chunk(s) could not be backfilled — re-run to retry`);
    process.exit(1);
  }

  ok('Done', 'All embeddings backfilled successfully.');
}

run().catch((e) => {
  console.error('[Backfill FATAL]', e instanceof Error ? e.message : e);
  process.exit(1);
});
