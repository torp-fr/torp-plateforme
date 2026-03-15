#!/usr/bin/env tsx
/**
 * devHealthCheck.ts — Ingestion pipeline health diagnostic
 *
 * Checks (read-only, never writes):
 *   1. Environment variables
 *   2. Supabase connectivity
 *   3. Embedding coverage  →  COUNT(embedding_vector) vs COUNT(*)
 *   4. Stuck documents     →  processing > 30 min without completing
 *   5. Edge Function       →  generate-embedding reachable
 *   6. Source code audit   →  no .update({ embedding: }) violations
 *   7. Storage bucket      →  'documents' bucket exists with correct RLS
 *   8. Embedding dims      →  Edge Function returns 1536-dim vectors (Phase 42)
 *   9. rag-worker audit    →  rag-worker/worker.js column names
 *
 * Usage:
 *   pnpm health:check
 *   pnpm health:check --json        (machine-readable output)
 */

import fs   from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

// ─── types ────────────────────────────────────────────────────────────────────

type Severity = 'ok' | 'warn' | 'error';

interface CheckResult {
  name: string;
  status: Severity;
  message: string;
  detail?: string;
}

// ─── output helpers ───────────────────────────────────────────────────────────

const JSON_MODE = process.argv.includes('--json');
const results: CheckResult[] = [];

const C = {
  ok:    '\x1b[32m✓\x1b[0m',
  warn:  '\x1b[33m⚠\x1b[0m',
  error: '\x1b[31m✗\x1b[0m',
  reset: '\x1b[0m',
  bold:  '\x1b[1m',
  dim:   '\x1b[2m',
};

function record(name: string, status: Severity, message: string, detail?: string): void {
  results.push({ name, status, message, detail });
  if (!JSON_MODE) {
    const icon = C[status];
    const colour = status === 'ok' ? '\x1b[32m' : status === 'warn' ? '\x1b[33m' : '\x1b[31m';
    console.log(`  ${icon}  ${colour}${message}${C.reset}`);
    if (detail) console.log(`     ${C.dim}${detail}${C.reset}`);
  }
}

function section(title: string): void {
  if (!JSON_MODE) console.log(`\n${C.bold}── ${title} ${'─'.repeat(Math.max(0, 60 - title.length))}${C.reset}`);
}

// ─── 1. Environment variables ─────────────────────────────────────────────────

section('1. Environment variables');

const url  = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL ?? '';
const key  = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.VITE_SUPABASE_ANON_KEY ?? '';
const oaiKey = process.env.OPENAI_API_KEY ?? '';

if (url)    record('env.supabase_url',  'ok',    'SUPABASE_URL set',               url.slice(0, 40) + '…');
else        record('env.supabase_url',  'error', 'SUPABASE_URL missing');

if (key)    record('env.supabase_key',  'ok',    'SUPABASE key set',               key.slice(0, 12) + '…');
else        record('env.supabase_key',  'error', 'SUPABASE key missing');

if (oaiKey) record('env.openai_key',    'ok',    'OPENAI_API_KEY set');
else        record('env.openai_key',    'warn',  'OPENAI_API_KEY not set — Edge Function may fail');

if (!url || !key) {
  if (JSON_MODE) console.log(JSON.stringify({ results, summary: 'aborted' }, null, 2));
  else           console.error('\nAborted: required credentials missing.');
  process.exit(1);
}

// ─── Supabase client ──────────────────────────────────────────────────────────

const supabase = createClient(url, key);

// ─── 2. Connectivity ──────────────────────────────────────────────────────────

section('2. Supabase connectivity');

const { count: docCount, error: connErr } = await supabase
  .from('knowledge_documents')
  .select('*', { count: 'exact', head: true });

if (connErr) {
  record('db.connectivity', 'error', 'Cannot reach knowledge_documents', connErr.message);
  finalise(); process.exit(1);
}
record('db.connectivity', 'ok', `knowledge_documents reachable`, `${docCount ?? 0} document(s)`);

// ─── 3. Embedding coverage ────────────────────────────────────────────────────

section('3. Embedding coverage');

const { count: totalChunks, error: totalErr } = await supabase
  .from('knowledge_chunks')
  .select('*', { count: 'exact', head: true });

const { count: embeddedChunks, error: embErr } = await supabase
  .from('knowledge_chunks')
  .select('*', { count: 'exact', head: true })
  .not('embedding_vector', 'is', null);

const { count: missingChunks } = await supabase
  .from('knowledge_chunks')
  .select('*', { count: 'exact', head: true })
  .is('embedding_vector', null);

if (totalErr || embErr) {
  record('db.embedding_coverage', 'error', 'Failed to count chunks', (totalErr ?? embErr)!.message);
} else {
  const total    = totalChunks ?? 0;
  const embedded = embeddedChunks ?? 0;
  const missing  = missingChunks ?? 0;
  const pct      = total > 0 ? Math.round((embedded / total) * 100) : 100;

  if (missing === 0) {
    record('db.embedding_coverage', 'ok',
      `COUNT(embedding_vector) = COUNT(*) — pipeline complete`,
      `${embedded}/${total} chunks embedded (100%)`);
  } else if (pct >= 80) {
    record('db.embedding_coverage', 'warn',
      `${missing} chunks missing embedding_vector`,
      `${embedded}/${total} chunks embedded (${pct}%) — run: pnpm reindex:embeddings`);
  } else {
    record('db.embedding_coverage', 'error',
      `${missing} chunks missing embedding_vector (${pct}% coverage)`,
      `Run: pnpm reindex:embeddings to repair`);
  }
}

// ─── 4. Stuck documents ───────────────────────────────────────────────────────

section('4. Stuck documents');

const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();

const { data: stuckDocs, error: stuckErr } = await supabase
  .from('knowledge_documents')
  .select('id, title, ingestion_status, ingestion_started_at')
  .in('ingestion_status', ['processing', 'extracting', 'chunking', 'embedding'])
  .lt('ingestion_started_at', thirtyMinAgo);

if (stuckErr) {
  record('db.stuck_docs', 'warn', 'Could not query document states', stuckErr.message);
} else if (!stuckDocs || stuckDocs.length === 0) {
  record('db.stuck_docs', 'ok', 'No documents stuck in processing');
} else {
  record('db.stuck_docs', 'error',
    `${stuckDocs.length} document(s) stuck >30 min`,
    `Run: pnpm fix:pipeline to reset them`);
  if (!JSON_MODE) {
    for (const d of stuckDocs.slice(0, 5)) {
      console.log(`     ${C.dim}  → ${d.id} "${d.title}" (${d.ingestion_status})${C.reset}`);
    }
  }
}

// ─── 5. Edge Function reachability ───────────────────────────────────────────

section('5. Edge Function: generate-embedding');

try {
  const { data: efData, error: efErr } = await supabase.functions.invoke(
    'generate-embedding',
    { body: { inputs: ['health check'], model: 'text-embedding-3-small' } }
  );

  if (efErr) {
    record('edge.generate_embedding', 'error', 'Edge Function returned an error', efErr.message);
  } else if (!efData?.embeddings || !Array.isArray(efData.embeddings)) {
    record('edge.generate_embedding', 'error', 'Edge Function returned unexpected format',
      JSON.stringify(efData).slice(0, 120));
  } else {
    const dims = efData.embeddings[0]?.length ?? 0;
    record('edge.generate_embedding', 'ok',
      `generate-embedding reachable`,
      `Returned ${dims}-dim vector`);
  }
} catch (e: any) {
  record('edge.generate_embedding', 'error', 'Edge Function unreachable', e.message);
}

// ─── 6. Source code audit — wrong column names ────────────────────────────────

section('6. Source code audit');

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SCAN_DIRS = ['src', 'api', 'rag-worker', 'supabase/functions'];
const BAD_PATTERN = /\.(?:update|insert|upsert)\s*\(\s*\{[^}]*\bembedding\s*:/;

let violations = 0;

for (const dir of SCAN_DIRS) {
  const fullDir = path.join(ROOT, dir);
  if (!fs.existsSync(fullDir)) continue;

  function walk(d: string): void {
    for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
      if (entry.isDirectory()) { walk(path.join(d, entry.name)); continue; }
      if (!/\.(ts|js|mjs)$/.test(entry.name)) continue;
      const file = path.join(d, entry.name);
      const src  = fs.readFileSync(file, 'utf8');
      if (BAD_PATTERN.test(src)) {
        violations++;
        record(`code.violation.${violations}`, 'error',
          `Bad column name in ${path.relative(ROOT, file)}`,
          'Found .update({ embedding: or .insert({ embedding: — should be embedding_vector');
      }
    }
  }
  walk(fullDir);
}

if (violations === 0) {
  record('code.audit', 'ok', 'No embedding column name violations found in source');
}

// ─── 7. Storage bucket access ─────────────────────────────────────────────────

section('7. Storage bucket: documents');

try {
  const { data: buckets, error: buckErr } = await supabase.storage.listBuckets();
  if (buckErr) {
    record('storage.buckets', 'error', 'Cannot list storage buckets', buckErr.message);
  } else {
    const docBucket = buckets?.find(b => b.id === 'documents');
    if (!docBucket) {
      record('storage.bucket_exists', 'error',
        '"documents" bucket not found',
        'Apply migration: 20260315000001_documents_storage_rls.sql');
    } else {
      record('storage.bucket_exists', 'ok', '"documents" bucket exists', `public=${docBucket.public}`);
    }
  }
} catch (e: any) {
  record('storage.bucket_exists', 'error', 'Storage check failed', e.message);
}

// ─── 8. Embedding dimension validation ────────────────────────────────────────

section('8. Embedding dimension validation');

try {
  const { data: efData, error: efErr } = await supabase.functions.invoke(
    'generate-embedding',
    { body: { inputs: ['dimension check'], model: 'text-embedding-3-small', dimensions: 1536 } }
  );

  if (efErr) {
    record('embedding.dimensions', 'error', 'Dimension validation call failed', efErr.message);
  } else if (!efData?.embeddings || !Array.isArray(efData.embeddings)) {
    record('embedding.dimensions', 'error', 'Unexpected response format from Edge Function',
      JSON.stringify(efData).slice(0, 120));
  } else {
    const dims = efData.embeddings[0]?.length ?? 0;
    if (dims === 1536) {
      record('embedding.dimensions', 'ok',
        'Edge Function returns 1536-dim vectors — matches VECTOR(1536) schema (Phase 42)');
    } else {
      record('embedding.dimensions', 'error',
        `Edge Function returned ${dims}-dim vectors, expected 1536`,
        'Run: supabase functions deploy generate-embedding');
    }
  }
} catch (e: any) {
  record('embedding.dimensions', 'error', 'Dimension validation failed', e.message);
}

// ─── 9. rag-worker specific check ─────────────────────────────────────────────

section('9. rag-worker audit');

const workerPath = path.join(ROOT, 'rag-worker', 'worker.js');
if (!fs.existsSync(workerPath)) {
  record('ragworker.exists', 'warn', 'rag-worker/worker.js not found');
} else {
  const workerSrc = fs.readFileSync(workerPath, 'utf8');
  const hasBadUpdate = /\.update\(\s*\{[^}]*\bembedding\s*:/.test(workerSrc);
  const hasGoodUpdate = /\.update\(\s*\{[^}]*\bembedding_vector\s*:/.test(workerSrc);
  if (hasBadUpdate) {
    record('ragworker.column', 'error',
      'rag-worker/worker.js writes to wrong column "embedding"',
      'Fix: change embedding: to embedding_vector:');
  } else if (hasGoodUpdate) {
    record('ragworker.column', 'ok', 'rag-worker/worker.js uses embedding_vector correctly');
  } else {
    record('ragworker.column', 'warn', 'rag-worker/worker.js has no embedding update detected');
  }
}

// ─── Summary ──────────────────────────────────────────────────────────────────

function finalise(): void {
  const errors = results.filter(r => r.status === 'error').length;
  const warns  = results.filter(r => r.status === 'warn').length;

  if (JSON_MODE) {
    console.log(JSON.stringify({
      results,
      summary: { errors, warns, ok: results.length - errors - warns, healthy: errors === 0 },
    }, null, 2));
    return;
  }

  console.log(`\n${'═'.repeat(64)}`);
  console.log(`${C.bold}  Health summary${C.reset}`);
  console.log('═'.repeat(64));
  console.log(`  Checks run  : ${results.length}`);
  console.log(`  ${C.ok}  Passed    : ${results.filter(r => r.status === 'ok').length}`);
  console.log(`  ${C.warn}  Warnings  : ${warns}`);
  console.log(`  ${C.error}  Errors    : ${errors}`);

  if (errors > 0) {
    console.log(`\n  ${C.error} Pipeline has errors. Run:\n`);
    console.log(`     pnpm fix:pipeline      — reset stuck docs + patch code`);
    console.log(`     pnpm reindex:embeddings — fill missing embedding_vector`);
  } else if (warns > 0) {
    console.log(`\n  ${C.warn} Pipeline is degraded but functional.`);
  } else {
    console.log(`\n  ${C.ok} Pipeline is healthy.`);
  }
  console.log('');
}

finalise();
process.exit(results.some(r => r.status === 'error') ? 1 : 0);
