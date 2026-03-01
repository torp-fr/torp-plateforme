// =======================================================
// PHASE 41 — TRANSACTIONAL STEP RUNNER (DB-DRIVEN)
// Zero global state. Zero window locks.
// =======================================================

import { supabase } from "@/lib/supabase";
import { knowledgeBrainService } from '@/services/ai/knowledge-brain.service';
import { log, warn, error as logError } from '@/lib/logger';

// PHASE 40: Server-side hash computation via Supabase Edge Function or RLS trigger
// Browser code cannot use crypto module
// Hash will be computed by server when inserting/updating documents

const MAX_ATTEMPTS = 3;
const PIPELINE_TIMEOUT_MS = 2 * 60 * 1000; // 2 minutes

// =======================================================
// Public Entry Point
// =======================================================

export async function runKnowledgeIngestion(documentId: string) {
  log(`[INGESTION] Starting knowledge ingestion for document ${documentId}`);

  try {
    // Step 1: Claim document (atomic DB lock)
    const claimed = await claimDocument(documentId);
    if (!claimed) {
      log(`[INGESTION] Could not claim document ${documentId} (already processing or max retries)`);
      return;
    }

    // Step 2: Process document (extract, chunk, embed)
    await processDocument(claimed);

    log(`[INGESTION] ✅ Ingestion complete for document ${documentId}`);
  } catch (err: any) {
    const errorMsg = err?.message || "Unknown error";
    logError(`[INGESTION] ❌ Ingestion failed for document ${documentId}:`, errorMsg);

    // Mark as failed in database
    await markFailed(documentId, errorMsg);
  }
}

// =======================================================
// Claim (Atomic DB Lock)
// =======================================================

async function claimDocument(documentId: string) {
  try {
    // Fetch current document first
    const { data: currentDoc, error: fetchError } = await supabase
      .from("knowledge_documents")
      .select("ingestion_attempts, ingestion_status")
      .eq("id", documentId)
      .single();

    if (fetchError || !currentDoc) {
      logError("[CLAIM] Document not found:", fetchError?.message);
      return null;
    }

    // Check if already processing or max retries exceeded
    if (currentDoc.ingestion_status !== "pending") {
      log("[CLAIM] Document already processing or completed");
      return null;
    }

    if (currentDoc.ingestion_attempts >= MAX_ATTEMPTS) {
      await markFailed(documentId, "Max retry attempts exceeded");
      return null;
    }

    // Atomic update: claim document for processing
    const { data, error } = await supabase
      .from("knowledge_documents")
      .update({
        ingestion_status: "processing",
        ingestion_attempts: (currentDoc.ingestion_attempts || 0) + 1,
        processing_started_at: new Date().toISOString(),
        pipeline_timeout_at: new Date(Date.now() + PIPELINE_TIMEOUT_MS).toISOString(),
      })
      .eq("id", documentId)
      .eq("ingestion_status", "pending")
      .select()
      .single();

    if (error || !data) {
      log("[CLAIM] Failed to claim document (already processing)");
      return null;
    }

    log("[CLAIM] Document claimed successfully", { documentId, attempt: data.ingestion_attempts });
    return data;
  } catch (err: any) {
    logError("[CLAIM] Error claiming document:", err.message);
    return null;
  }
}

// =======================================================
// Main Pipeline
// =======================================================

async function processDocument(doc: any) {
  log(`[PROCESS] Starting ingestion for document ${doc.id}`);

  try {
    // Verify document is still in processing state
    await ensureStillProcessing(doc.id);
    checkTimeout(doc);

    // Step 1: Validate content
    const sanitized = doc.sanitized_content || doc.content;
    if (!sanitized || sanitized.trim().length === 0) {
      throw new Error("Missing sanitized content");
    }

    log(`[PROCESS] Document size: ${(sanitized.length / 1024).toFixed(2)}KB`);

    // Step 2: Chunk the document
    const chunks = chunkText(sanitized);
    if (!chunks.length) {
      throw new Error("No chunks generated from content");
    }

    log(`[PROCESS] Generated ${chunks.length} chunks`);

    // Step 3: Generate embeddings
    await processEmbeddingsInBatches(doc.id, chunks);

    // Step 4: Mark as completed
    await markCompleted(doc.id);
    log(`[PROCESS] Ingestion complete for document ${doc.id}`);
  } catch (err: any) {
    logError(`[PROCESS] Error processing document ${doc.id}:`, err.message);
    throw err;
  }
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
  log(`[EMBEDDING] Processing batch of ${batch.length} chunks for document ${documentId}`);

  // Sequential processing with concurrency limit (max 3 parallel)
  const results: { chunk: string; embedding: number[] | null; error?: string }[] = [];

  for (let i = 0; i < batch.length; i += 3) {
    const chunk = batch.slice(i, i + 3);
    const embeddings = await Promise.all(
      chunk.map(async (text) => {
        try {
          const embedding = await knowledgeBrainService.generateEmbedding(text);
          return embedding;
        } catch (err: any) {
          logError(`[EMBEDDING] Failed for chunk: ${err.message}`);
          return null;
        }
      })
    );

    for (let j = 0; j < chunk.length; j++) {
      results.push({
        chunk: chunk[j],
        embedding: embeddings[j],
      });
    }
  }

  // Persist chunks and embeddings
  const embeddingData = results
    .filter(r => r.chunk && r.chunk.trim().length > 0) // Skip empty chunks
    .map((r, idx) => ({
      document_id: documentId,
      content: r.chunk,
      embedding: r.embedding || null, // pgvector expects array<float> or null
      token_count: Math.ceil(r.chunk.length / 4), // Estimate: 1 token ≈ 4 chars
      chunk_index: idx,
    }));

  if (embeddingData.length === 0) {
    throw new Error("No valid chunks to persist");
  }

  const { error } = await supabase
    .from("knowledge_chunks")
    .insert(embeddingData);

  if (error) {
    logError(`[EMBEDDING] Failed to persist embeddings:`, error.message);
    throw new Error(`Embedding persistence failed: ${error.message}`);
  }

  const successCount = embeddingData.filter(e => e.embedding).length;
  log(`[EMBEDDING] Batch complete - ${successCount}/${embeddingData.length} chunks embedded`);
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
  const { error: updateError } = await supabase
    .from("knowledge_documents")
    .update({
      ingestion_status: "completed",
      ingestion_completed_at: new Date().toISOString(),
      pipeline_timeout_at: null,
      ingestion_progress: 100,
    })
    .eq("id", documentId);

  if (updateError) {
    logError(`[MARK_COMPLETED] Failed to mark document as completed:`, updateError.message);
  } else {
    log(`[MARK_COMPLETED] Document completed successfully:`, documentId);
  }
}

async function markFailed(documentId: string, errorMessage: string) {
  const { error: updateError } = await supabase
    .from("knowledge_documents")
    .update({
      ingestion_status: "failed",
      last_ingestion_error: JSON.stringify({
        reason: "INGESTION_ERROR",
        message: errorMessage,
        timestamp: new Date().toISOString(),
      }),
      pipeline_timeout_at: null,
    })
    .eq("id", documentId);

  if (updateError) {
    logError(`[MARK_FAILED] Failed to mark document as failed:`, updateError.message);
  } else {
    log(`[MARK_FAILED] Document marked as failed:`, documentId);
  }
}
