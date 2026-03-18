/**
 * backfillEmbeddings.js
 *
 * One-shot script: generate and store embeddings for every knowledge_chunk
 * that currently has embedding_vector IS NULL.
 *
 * Uses the same Supabase client, OpenAI client, and embedding service as
 * worker.js — no separate configuration required.
 *
 * Run from inside rag-worker/:
 *   node backfillEmbeddings.js
 *
 * Environment variables (loaded from ../../.env.local or ../../.env):
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *   OPENAI_API_KEY
 */

import "./config/loadEnv.js";

import { supabase } from "./core/supabaseClient.js";
import { generateBatchEmbeddings } from "./core/embeddingService.js";

// ── Constants ─────────────────────────────────────────────────────────────────

const PAGE_SIZE = 100;        // rows fetched from Supabase per iteration
const OPENAI_BATCH_SIZE = 20; // max texts per generateBatchEmbeddings call (matches embeddingService)

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Return total count of chunks still missing an embedding.
 * Used only for progress display — not load-bearing.
 */
async function countPending() {
  const { count, error } = await supabase
    .from("knowledge_chunks")
    .select("id", { count: "exact", head: true })
    .is("embedding_vector", null);

  if (error) {
    console.warn("[Backfill] Could not fetch pending count:", error.message);
    return null;
  }
  return count;
}

/**
 * Fetch the next PAGE_SIZE chunks that still need an embedding.
 * Returns an array of { id, content } objects.
 */
async function fetchPendingChunks() {
  const { data, error } = await supabase
    .from("knowledge_chunks")
    .select("id, content")
    .is("embedding_vector", null)
    .limit(PAGE_SIZE);

  if (error) {
    throw new Error(`Failed to fetch pending chunks: ${error.message}`);
  }

  return data ?? [];
}

/**
 * Write one embedding back to its chunk row.
 */
async function saveEmbedding(id, embedding) {
  const { error } = await supabase
    .from("knowledge_chunks")
    .update({
      embedding_vector: embedding,
      embedding_generated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) {
    throw new Error(`Failed to save embedding for chunk ${id}: ${error.message}`);
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log("[Backfill] Starting embedding backfill...");

  const initialPending = await countPending();
  const total = initialPending ?? "?";
  console.log(`[Backfill] Chunks pending: ${total}`);

  if (initialPending === 0) {
    console.log("[Backfill] Nothing to do — all chunks already have embeddings.");
    return;
  }

  let processed = 0;
  let iterations = 0;

  while (true) {
    iterations++;

    // ── Step 1: Fetch next page ──────────────────────────────────────────────
    const chunks = await fetchPendingChunks();

    if (chunks.length === 0) {
      console.log("[Backfill] No more pending chunks. Done.");
      break;
    }

    console.log(`\n[Backfill] Page ${iterations}: ${chunks.length} chunks fetched`);

    // ── Step 2: Generate embeddings in sub-batches of OPENAI_BATCH_SIZE ──────
    const allEmbeddings = [];

    for (let i = 0; i < chunks.length; i += OPENAI_BATCH_SIZE) {
      const subBatch = chunks.slice(i, i + OPENAI_BATCH_SIZE);
      const texts = subBatch.map((c) => c.content);

      console.log(
        `[Backfill]   Embedding sub-batch ${Math.floor(i / OPENAI_BATCH_SIZE) + 1}: ` +
        `chunks ${i + 1}–${i + subBatch.length}`
      );

      const embeddings = await generateBatchEmbeddings(texts);
      allEmbeddings.push(...embeddings);
    }

    // ── Step 3: Save embeddings to Supabase ───────────────────────────────────
    for (let i = 0; i < chunks.length; i++) {
      await saveEmbedding(chunks[i].id, allEmbeddings[i]);
    }

    processed += chunks.length;
    const remaining = typeof total === "number" ? total - processed : "?";
    console.log(`[Backfill] Progress: ${processed} processed / ${total} total (${remaining} remaining)`);
  }

  console.log(`\n[Backfill] ✅ Complete. Total chunks embedded this run: ${processed}`);
}

main().catch((err) => {
  console.error("[Backfill] ❌ Fatal error:", err.message);
  process.exit(1);
});
