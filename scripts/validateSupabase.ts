#!/usr/bin/env node
/**
 * Knowledge Brain — Supabase Validation Script
 *
 * Validates the full ingestion pipeline against a live Supabase instance:
 *   Step 1 : Environment variables present
 *   Step 2 : Supabase connectivity (knowledge_documents table reachable)
 *   Step 3 : HNSW vector index exists on knowledge_chunks
 *   Step 4 : Run a real batch ingest on ./test_corpus
 *   Step 5 : Embedding count — all chunks have embeddings
 *   Step 6 : Integrity score distribution
 *   Step 7 : Conflict detection — count active conflicts
 *   Step 8 : End-to-end summary
 *
 * Usage:
 *   pnpm validate:supabase
 *   pnpm validate:supabase --skip-ingest   (skip Step 4 — only inspect existing data)
 *
 * Requires: VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env.local
 */

import fs   from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { createRequire } from 'node:module';

// ---------------------------------------------------------------------------
// 1. Bootstrap: load .env before any service import resolves env vars
// ---------------------------------------------------------------------------

const require = createRequire(import.meta.url);

try {
  const dotenv  = require('dotenv');
  const envFile = ['.env.local', '.env'].find((f) =>
    fs.existsSync(path.resolve(process.cwd(), f))
  );
  if (envFile) {
    dotenv.config({ path: path.resolve(process.cwd(), envFile) });
    console.log(`[Validate] Loaded env from ${envFile}`);
  }
} catch {
  // dotenv not installed — env vars must already be in the shell environment
}

import { supabase } from '@/lib/supabase';

// ---------------------------------------------------------------------------
// 2. Helpers
// ---------------------------------------------------------------------------

const SEP  = '─'.repeat(72);
const SEP2 = '═'.repeat(72);

function step(n: number, title: string): void {
  console.log(`\n${SEP}`);
  console.log(`  STEP ${n}: ${title}`);
  console.log(SEP);
}

function pass(msg: string)  { console.log(`  ✓  ${msg}`); }
function warn(msg: string)  { console.warn(`  ⚠  ${msg}`); }
function fail(msg: string)  { console.error(`  ✗  ${msg}`); }
function info(msg: string)  { console.log(`  →  ${msg}`); }

interface StepResult {
  step: number;
  title: string;
  status: 'pass' | 'fail' | 'warn' | 'skip';
  detail: string;
}

const results: StepResult[] = [];

function record(step: number, title: string, status: StepResult['status'], detail: string): void {
  results.push({ step, title, status, detail });
}

const args = process.argv.slice(2);
const skipIngest = args.includes('--skip-ingest');

// ---------------------------------------------------------------------------
// STEP 1 — Environment variables
// ---------------------------------------------------------------------------

step(1, 'Environment variables');

const supabaseUrl  = process.env.VITE_SUPABASE_URL  ?? '';
const supabaseKey  = process.env.VITE_SUPABASE_ANON_KEY ?? '';
const openaiKey    = process.env.OPENAI_API_KEY ?? '';

let envOk = true;

if (supabaseUrl && !supabaseUrl.includes('localhost')) {
  pass(`VITE_SUPABASE_URL  = ${supabaseUrl}`);
} else if (supabaseUrl.includes('localhost')) {
  warn(`VITE_SUPABASE_URL points to localhost — will test local Supabase`);
  info(`  ${supabaseUrl}`);
} else {
  fail('VITE_SUPABASE_URL is not set');
  envOk = false;
}

if (supabaseKey && supabaseKey.length > 20) {
  pass(`VITE_SUPABASE_ANON_KEY = ${supabaseKey.slice(0, 10)}… (${supabaseKey.length} chars)`);
} else {
  fail('VITE_SUPABASE_ANON_KEY is not set or too short');
  envOk = false;
}

if (openaiKey && openaiKey.startsWith('sk-')) {
  pass(`OPENAI_API_KEY     = ${openaiKey.slice(0, 8)}… (set)`);
} else {
  warn('OPENAI_API_KEY is not set — embeddings will fail if Edge Function calls OpenAI directly');
}

if (!envOk) {
  fail('Required credentials missing. Create .env.local with VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.');
  record(1, 'Environment variables', 'fail', 'Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY');
  printSummary();
  process.exit(1);
}

record(1, 'Environment variables', 'pass', 'All required env vars present');

// ---------------------------------------------------------------------------
// STEP 2 — Supabase connectivity
// ---------------------------------------------------------------------------

step(2, 'Supabase connectivity — knowledge_documents table');

const { count: docCount, error: connErr } = await supabase
  .from('knowledge_documents')
  .select('*', { count: 'exact', head: true });

if (connErr) {
  fail(`Cannot reach knowledge_documents: ${connErr.message}`);
  record(2, 'Supabase connectivity', 'fail', connErr.message);
  printSummary();
  process.exit(1);
}

pass(`knowledge_documents reachable — ${docCount ?? 0} document(s) currently in table`);
record(2, 'Supabase connectivity', 'pass', `${docCount ?? 0} documents`);

// ---------------------------------------------------------------------------
// STEP 3 — HNSW vector index
// ---------------------------------------------------------------------------

step(3, 'HNSW vector index on knowledge_chunks');

// Query pg_indexes via rpc (Supabase exposes pg_catalog via RPC)
const { data: indexData, error: indexErr } = await supabase.rpc('exec_sql', {
  sql: `SELECT indexname, indexdef
        FROM pg_indexes
        WHERE tablename = 'knowledge_chunks'
          AND (indexname ILIKE '%hnsw%' OR indexname ILIKE '%embedding%')
        ORDER BY indexname;`,
});

if (indexErr) {
  // Supabase anon key may not have access to pg_catalog RPC — try a simpler check
  warn(`pg_indexes query failed (${indexErr.message}) — RPC may not be available with anon key`);
  warn('Cannot verify HNSW index directly; check manually in Supabase SQL editor:');
  info("  SELECT indexname FROM pg_indexes WHERE tablename = 'knowledge_chunks' AND indexname ILIKE '%hnsw%';");
  record(3, 'HNSW vector index', 'warn', 'Cannot verify — RPC requires service_role key');
} else if (indexData && Array.isArray(indexData) && indexData.length > 0) {
  for (const idx of indexData) {
    pass(`Index found: ${idx.indexname}`);
    info(`  ${idx.indexdef}`);
  }
  record(3, 'HNSW vector index', 'pass', `${indexData.length} vector index(es) found`);
} else {
  fail('No HNSW index found on knowledge_chunks — run migration 20260216000000_phase29_knowledge_ingestion.sql');
  record(3, 'HNSW vector index', 'fail', 'No HNSW index — migration may not have run');
}

// ---------------------------------------------------------------------------
// STEP 4 — Run real batch ingest on test_corpus
// ---------------------------------------------------------------------------

step(4, 'Real batch ingest — ./test_corpus');

let ingestSucceeded = 0;
let ingestFailed    = 0;
let ingestChunks    = 0;
let ingestEmbeddings = 0;

if (skipIngest) {
  warn('Skipping ingest (--skip-ingest flag set) — reading existing data only');
  record(4, 'Batch ingest', 'skip', '--skip-ingest flag set');
} else {
  info('Running: pnpm ingest:batch ./test_corpus');
  info('(Duplicate detection will skip files already ingested)');
  console.log('');

  try {
    const output = execSync(
      'pnpm tsx --tsconfig tsconfig.json scripts/batchIngestKnowledge.ts ./test_corpus',
      { encoding: 'utf8', stdio: 'pipe', cwd: process.cwd() }
    );

    // Parse summary lines from output
    const succeededMatch = output.match(/Documents succeeded\s*:\s*(\d+)/);
    const failedMatch    = output.match(/Documents failed\s*:\s*(\d+)/);
    const chunksMatch    = output.match(/Total chunks created\s*:\s*(\d+)/);
    const embMatch       = output.match(/Total embeddings\s*:\s*(\d+)/);

    ingestSucceeded  = succeededMatch  ? parseInt(succeededMatch[1],  10) : 0;
    ingestFailed     = failedMatch     ? parseInt(failedMatch[1],     10) : 0;
    ingestChunks     = chunksMatch     ? parseInt(chunksMatch[1],     10) : 0;
    ingestEmbeddings = embMatch        ? parseInt(embMatch[1],        10) : 0;

    // Print the batch summary section only
    const summaryStart = output.indexOf('BATCH SUMMARY');
    if (summaryStart !== -1) {
      console.log(output.slice(summaryStart - 2).split('\n').map((l) => `  ${l}`).join('\n'));
    }

    if (ingestFailed > 0) {
      warn(`${ingestFailed} document(s) failed ingest — check output above`);
      record(4, 'Batch ingest', 'warn', `${ingestSucceeded} OK, ${ingestFailed} failed, ${ingestChunks} chunks`);
    } else if (ingestSucceeded === 0) {
      warn('0 documents ingested — all may have been skipped (duplicates) or test_corpus is empty');
      record(4, 'Batch ingest', 'warn', 'No new documents ingested');
    } else {
      pass(`${ingestSucceeded} document(s) ingested successfully`);
      pass(`${ingestChunks} chunk(s) created, ${ingestEmbeddings} embedding(s) generated`);
      record(4, 'Batch ingest', ingestEmbeddings > 0 ? 'pass' : 'warn',
        `${ingestSucceeded} docs, ${ingestChunks} chunks, ${ingestEmbeddings} embeddings`);
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    fail(`Batch ingest process failed: ${msg}`);
    record(4, 'Batch ingest', 'fail', msg.slice(0, 120));
  }
}

// ---------------------------------------------------------------------------
// STEP 5 — Embedding coverage
// ---------------------------------------------------------------------------

step(5, 'Embedding coverage — chunks with vs without embeddings');

const { data: embStats, error: embErr } = await supabase.rpc('exec_sql', {
  sql: `SELECT
          COUNT(*) FILTER (WHERE embedding IS NOT NULL)  AS with_embedding,
          COUNT(*) FILTER (WHERE embedding IS NULL)      AS without_embedding,
          COUNT(*)                                        AS total
        FROM knowledge_chunks;`,
});

if (embErr) {
  warn(`Cannot query embedding stats via RPC (${embErr.message})`);
  warn('Check manually: SELECT COUNT(*) FILTER (WHERE embedding IS NOT NULL) FROM knowledge_chunks;');
  record(5, 'Embedding coverage', 'warn', 'Cannot verify — RPC requires service_role key');
} else if (embStats && Array.isArray(embStats) && embStats.length > 0) {
  const { with_embedding, without_embedding, total } = embStats[0] as {
    with_embedding: number; without_embedding: number; total: number;
  };
  const pct = total > 0 ? Math.round((with_embedding / total) * 100) : 0;
  info(`Total chunks          : ${total}`);
  info(`With embedding        : ${with_embedding}  (${pct}%)`);
  info(`Without embedding     : ${without_embedding}`);

  if (without_embedding === 0 && total > 0) {
    pass('100% embedding coverage');
    record(5, 'Embedding coverage', 'pass', `${total} chunks, 100% embedded`);
  } else if (total === 0) {
    warn('No chunks in table — run Step 4 first');
    record(5, 'Embedding coverage', 'warn', 'Table empty');
  } else {
    warn(`${without_embedding} chunk(s) still missing embeddings`);
    record(5, 'Embedding coverage', 'warn', `${without_embedding}/${total} chunks missing embeddings`);
  }
} else {
  warn('No data returned from embedding stats query');
  record(5, 'Embedding coverage', 'warn', 'No data returned');
}

// ---------------------------------------------------------------------------
// STEP 6 — Integrity scores
// ---------------------------------------------------------------------------

step(6, 'Integrity scores — knowledge_documents');

const { data: intDocs, error: intErr } = await supabase
  .from('knowledge_documents')
  .select('title, integrity_score, is_publishable, ingestion_status, category')
  .order('created_at', { ascending: false })
  .limit(20);

if (intErr) {
  fail(`Cannot query integrity scores: ${intErr.message}`);
  record(6, 'Integrity scores', 'fail', intErr.message);
} else if (!intDocs || intDocs.length === 0) {
  warn('No documents found in knowledge_documents');
  record(6, 'Integrity scores', 'warn', 'Table empty');
} else {
  const publishable  = intDocs.filter((d) => d.is_publishable).length;
  const withScore    = intDocs.filter((d) => d.integrity_score != null);
  const avgScore     = withScore.length > 0
    ? (withScore.reduce((s, d) => s + (d.integrity_score ?? 0), 0) / withScore.length).toFixed(3)
    : 'n/a';

  info(`Documents (last 20)   : ${intDocs.length}`);
  info(`Publishable           : ${publishable}/${intDocs.length}`);
  info(`Average integrity     : ${avgScore}`);

  console.log('');
  console.log('  Title                              Cat             Score   Publishable  Status');
  console.log('  ' + '─'.repeat(70));
  for (const d of intDocs) {
    const title    = (d.title ?? '(no title)').slice(0, 34).padEnd(34);
    const cat      = (d.category ?? '—').slice(0, 16).padEnd(16);
    const score    = d.integrity_score != null ? String(d.integrity_score).padStart(6) : '   n/a';
    const pub      = d.is_publishable ? '  yes' : '   no';
    const status   = d.ingestion_status ?? '—';
    console.log(`  ${title} ${cat} ${score}  ${pub}      ${status}`);
  }

  if (publishable > 0) {
    pass(`${publishable} publishable document(s)`);
    record(6, 'Integrity scores', 'pass', `avg=${avgScore}, ${publishable} publishable`);
  } else {
    warn('No publishable documents yet (integrity_score threshold = 0.7)');
    record(6, 'Integrity scores', 'warn', 'No publishable docs');
  }
}

// ---------------------------------------------------------------------------
// STEP 7 — Conflict detection
// ---------------------------------------------------------------------------

step(7, 'Conflict detection — knowledge_conflicts table');

const { data: conflicts, count: conflictCount, error: conflictErr } = await supabase
  .from('knowledge_conflicts')
  .select('*', { count: 'exact', head: false })
  .eq('status', 'active')
  .order('created_at', { ascending: false })
  .limit(10);

if (conflictErr) {
  warn(`Cannot query knowledge_conflicts: ${conflictErr.message}`);
  record(7, 'Conflict detection', 'warn', conflictErr.message);
} else {
  const total = conflictCount ?? 0;
  info(`Active conflicts      : ${total}`);

  if (total === 0) {
    pass('No active conflicts detected');
    record(7, 'Conflict detection', 'pass', 'No active conflicts');
  } else {
    warn(`${total} active conflict(s) — review in admin dashboard`);
    if (conflicts && conflicts.length > 0) {
      console.log('');
      console.log('  Latest conflicts:');
      for (const c of conflicts.slice(0, 5)) {
        const row = c as Record<string, unknown>;
        info(`  [${row.conflict_type ?? '?'}] ${row.title ?? '(no title)'}  severity=${row.severity ?? '?'}`);
      }
    }
    record(7, 'Conflict detection', 'warn', `${total} active conflicts`);
  }
}

// ---------------------------------------------------------------------------
// STEP 8 — End-to-end summary
// ---------------------------------------------------------------------------

printSummary();

// ---------------------------------------------------------------------------
// Helper: print final summary table
// ---------------------------------------------------------------------------

function printSummary(): void {
  console.log(`\n${SEP2}`);
  console.log('  VALIDATION SUMMARY');
  console.log(SEP2);

  const colW = 36;
  console.log(`  ${'Step'.padEnd(6)} ${'Title'.padEnd(colW)} Status  Detail`);
  console.log(`  ${'─'.repeat(6)} ${'─'.repeat(colW)} ${'─'.repeat(6)}  ${'─'.repeat(30)}`);

  for (const r of results) {
    const icon = r.status === 'pass' ? '✓' : r.status === 'warn' ? '⚠' : r.status === 'skip' ? '○' : '✗';
    const num   = `STEP ${r.step}`.padEnd(6);
    const title = r.title.padEnd(colW);
    const stat  = r.status.toUpperCase().padEnd(6);
    console.log(`  ${num} ${title} ${icon} ${stat}  ${r.detail}`);
  }

  const passes  = results.filter((r) => r.status === 'pass').length;
  const warns   = results.filter((r) => r.status === 'warn').length;
  const fails   = results.filter((r) => r.status === 'fail').length;
  const skips   = results.filter((r) => r.status === 'skip').length;

  console.log(SEP2);
  console.log(`  Passed: ${passes}  Warned: ${warns}  Failed: ${fails}  Skipped: ${skips}`);
  console.log(SEP2);
}
