// =======================================================
// PHASE 41 — TRANSACTIONAL STEP RUNNER (DB-DRIVEN)
// Zero global state. Zero window locks.
// =======================================================

import { supabase } from "@/lib/supabase";
import { createHash } from "crypto";

const MAX_ATTEMPTS = 3;
const PIPELINE_TIMEOUT_MS = 2 * 60 * 1000; // 2 minutes

// =======================================================
// Public Entry Point
// =======================================================

export async function runKnowledgeIngestion(documentId: string) {
  const claimed = await claimDocument(documentId);
  if (!claimed) return;

  try {
    await processDocument(claimed);
  } catch (err: any) {
    await markFailed(documentId, err?.message || "Unknown error");
  }
}

// =======================================================
// Claim (Atomic DB Lock)
// =======================================================

async function claimDocument(documentId: string) {
  const { data, error } = await supabase
    .from("knowledge_documents")
    .update({
      ingestion_status: "processing",
      ingestion_attempts: supabase.rpc("increment_attempts"), // optional
      processing_started_at: new Date().toISOString(),
      pipeline_timeout_at: new Date(Date.now() + PIPELINE_TIMEOUT_MS).toISOString(),
    })
    .eq("id", documentId)
    .eq("ingestion_status", "pending")
    .select()
    .single();

  if (error || !data) return null;

  if (data.ingestion_attempts >= MAX_ATTEMPTS) {
    await markFailed(documentId, "Max retry attempts exceeded");
    return null;
  }

  return data;
}

// =======================================================
// Main Pipeline
// =======================================================

async function processDocument(doc: any) {
  await ensureStillProcessing(doc.id);

  checkTimeout(doc);

  const sanitized = doc.sanitized_content;
  if (!sanitized) throw new Error("Missing sanitized content");

  // Dedup via hash
  const hash = createHash("sha256").update(sanitized).digest("hex");

  const { data: existing } = await supabase
    .from("knowledge_documents")
    .select("id")
    .eq("content_hash", hash)
    .limit(1);

  if (existing && existing.length > 0) {
    await markCompleted(doc.id);
    return;
  }

  await supabase
    .from("knowledge_documents")
    .update({ content_hash: hash })
    .eq("id", doc.id);

  // Step 1 — Chunking
  const chunks = chunkText(sanitized);

  if (!chunks.length) {
    throw new Error("No chunks generated");
  }

  // Step 2 — Embeddings (Batch + concurrency limit)
  await processEmbeddingsInBatches(doc.id, chunks);

  await markCompleted(doc.id);
}

// =======================================================
// Chunking
// =======================================================

function chunkText(text: string, size = 3000) {
  const chunks: string[] = [];
  for (let i = 0; i < text.length; i += size) {
    const chunk = text.slice(i, i + size).trim();
    if (chunk.length > 30) chunks.push(chunk);
  }
  return chunks;
}

// =======================================================
// Embedding Batch Processor
// =======================================================

async function processEmbeddingsInBatches(documentId: string, chunks: string[]) {
  const batchSize = 20;

  for (let i = 0; i < chunks.length; i += batchSize) {
    await ensureStillProcessing(documentId);

    const batch = chunks.slice(i, i + batchSize);

    await generateEmbeddingBatch(documentId, batch);
  }
}

async function generateEmbeddingBatch(documentId: string, batch: string[]) {
  // TODO: replace with real embedding call
  await Promise.all(
    batch.map(async (chunk) => {
      // simulate embedding call
      return true;
    })
  );
}

// =======================================================
// Guards
// =======================================================

async function ensureStillProcessing(documentId: string) {
  const { data } = await supabase
    .from("knowledge_documents")
    .select("ingestion_status, pipeline_timeout_at")
    .eq("id", documentId)
    .single();

  if (!data || data.ingestion_status !== "processing") {
    throw new Error("Document no longer in processing state");
  }

  checkTimeout(data);
}

function checkTimeout(doc: any) {
  if (doc.pipeline_timeout_at) {
    if (new Date() > new Date(doc.pipeline_timeout_at)) {
      throw new Error("Pipeline timeout exceeded");
    }
  }
}

// =======================================================
// Final States
// =======================================================

async function markCompleted(documentId: string) {
  await supabase
    .from("knowledge_documents")
    .update({
      ingestion_status: "completed",
      ingestion_completed_at: new Date().toISOString(),
      pipeline_timeout_at: null,
    })
    .eq("id", documentId);
}

async function markFailed(documentId: string, errorMessage: string) {
  await supabase
    .from("knowledge_documents")
    .update({
      ingestion_status: "failed",
      last_error: errorMessage,
      pipeline_timeout_at: null,
    })
    .eq("id", documentId);
}
