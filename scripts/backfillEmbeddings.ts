#!/usr/bin/env node
/**
 * Embedding Backfill Script
 *
 * Repairs existing knowledge_chunks rows whose embedding_vector is NULL.
 * This can happen when chunks were inserted before the embedding persistence
 * fix was deployed (batchIngestKnowledge.ts commit bc3d7b8).
 *
 * Usage:
 *   pnpm backfill:embeddings
 *
 * The script is idempotent: re-running it only touches chunks that still
 * have NULL embedding_vector. Already-vectorised chunks are never modified.
 *
 * Env:
 *   SUPABASE_SERVICE_ROLE_KEY  (preferred — required for UPDATE on chunks)
 *   VITE_SUPABASE_URL          (or SUPABASE_URL)
 *   VITE_SUPABASE_ANON_KEY     (fallback if no service role key)
 */

import fs   from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

// ---------------------------------------------------------------------------
// 1. Bootstrap: load .env BEFORE any service import resolves env vars
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
  // dotenv not installed — env vars must already be in the shell environment
}

// ---------------------------------------------------------------------------
// 2. Service imports (resolved after env is ready)
// ---------------------------------------------------------------------------

import { generateEmbeddingsForChunks } from '@/core/knowledge/ingestion/knowledgeEmbedding.service';
import { getSupabase }                 from '@/lib/supabase';

// ---------------------------------------------------------------------------
// 3. Main
// ---------------------------------------------------------------------------

async function run(): Promise<void> {
  const supabase = getSupabase();

  // ── Step 1: Fetch all chunks with missing embeddings ─────────────────────
  const { data: chunks, error: fetchError } = await supabase
    .from('knowledge_chunks')
    .select('id, content')
    .is('embedding_vector', null);

  if (fetchError) {
    throw new Error(`Failed to fetch chunks: ${fetchError.message}`);
  }

  if (!chunks || chunks.length === 0) {
    console.log('BACKFILL COMPLETE — no chunks missing embeddings');
    return;
  }

  console.log('BACKFILL START', chunks.length);

  // ── Step 2: Map to KnowledgeChunk shape for the embedding service ─────────
  // generateEmbeddingsForChunks requires { content, tokenCount, startIndex, endIndex }.
  // tokenCount is estimated (chars / 4) — only used for logging inside the service.
  const knowledgeChunks = chunks.map((c: { id: string; content: string }) => ({
    content:    c.content,
    tokenCount: Math.ceil(c.content.length / 4),
    startIndex: 0,
    endIndex:   c.content.length,
  }));

  // ── Step 3: Generate embeddings (batched at 100 per Edge Function call) ──
  const embedResults = await generateEmbeddingsForChunks(knowledgeChunks);

  if (embedResults.length === 0) {
    throw new Error('Embedding service returned 0 results — check Edge Function and OpenAI key');
  }

  // ── Step 4: Persist each embedding by chunk primary key ──────────────────
  const limit = Math.min(chunks.length, embedResults.length);
  let persisted = 0;

  for (let i = 0; i < limit; i++) {
    const chunkId   = chunks[i].id;
    const embedding = embedResults[i].embedding;

    const { data, error: updErr } = await supabase
      .from('knowledge_chunks')
      .update({ embedding_vector: embedding })
      .eq('id', chunkId)
      .select('id');

    if (updErr) {
      throw new Error(`Embedding persist error for chunk ${chunkId}: ${updErr.message}`);
    }

    if (!data || data.length === 0) {
      throw new Error(`UPDATE affected 0 rows for chunk ${chunkId} — check RLS policies`);
    }

    console.log('EMBEDDING WRITTEN', chunkId);
    persisted++;
  }

  console.log(`BACKFILL COMPLETE — ${persisted}/${chunks.length} embeddings written`);

  // ── Step 5: Warn on partial alignment ────────────────────────────────────
  if (embedResults.length < chunks.length) {
    const missing = chunks.length - embedResults.length;
    console.warn(
      `WARNING: ${missing} chunk(s) received no embedding from the service — re-run to retry`
    );
    process.exit(1);
  }
}

run().catch((e) => {
  console.error('[Backfill FATAL]', e instanceof Error ? e.message : e);
  process.exit(1);
});
