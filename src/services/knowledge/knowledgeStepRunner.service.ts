// =======================================================
// PHASE 41 — TRANSACTIONAL STEP RUNNER (DB-DRIVEN)
// Zero global state. Zero window locks.
// =======================================================

import { supabase } from "@/lib/supabase";
import { log, warn, error as logError } from '@/lib/logger';
import { chunkSmart, type Chunk } from '@/core/knowledge/ingestion/smartChunker.service';
import { classifyDocument } from '@/core/knowledge/ingestion/documentClassifier.service';
import { extractDocumentContent } from '@/core/knowledge/ingestion/documentExtractor.service';
import { normalizeText } from '@/core/knowledge/ingestion/textNormalizer.service';
import { sanitizeText } from '@/utils/text-sanitizer';

// ---------------------------------------------------------------------------
// Embedding constants
// ---------------------------------------------------------------------------

const EMBEDDING_BATCH_SIZE = 100; // texts per Edge Function call (server cap)
const INSERT_BATCH_SIZE    = 100; // rows per Supabase insert call

const MAX_ATTEMPTS = 3;
const PIPELINE_TIMEOUT_MS = 2 * 60 * 1000; // 2 minutes

// Embedding dimension must match database schema: knowledge_chunks.embedding_vector vector(384)
// Phase 42 migration (20260307000002_hybrid_rag_search.sql) will upgrade this to 1536,
// but hasn't been applied to the Supabase database yet. Update when migration is applied.
const EMBEDDING_DIMENSIONS = 384;

// Storage bucket used by uploadDocumentForServerIngestion
const KNOWLEDGE_STORAGE_BUCKET = 'documents';

// =======================================================
// Public Entry Point
// =======================================================

export async function runKnowledgeIngestion(documentId: string) {
  // PRODUCTION PROBE — search for this tag in Vercel / browser DevTools console.
  // If absent after upload, the wrong pipeline is executing.
  console.log('[INGESTION_PIPELINE_V2]', { documentId, pipeline: 'knowledgeStepRunner', ts: new Date().toISOString() });
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

    // Mark as failed in database, preserving the error message
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
    // .select() returns all columns including file_path, mime_type, title
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

    // ── Step 0: Extract text from file if content not yet extracted ──────────
    //
    // The upload path stores the file in Supabase Storage and creates the DB
    // row with content = NULL. This step downloads the file, extracts plain
    // text, sanitizes it and persists both raw and sanitized forms to the DB.
    //
    if (!doc.sanitized_content && !doc.content) {
      log('[INGESTION] content is missing — starting text extraction');

      if (!doc.file_path) {
        throw new Error(
          'TEXT_EXTRACTION_FAILED: document has no file_path and no pre-extracted content'
        );
      }

      // Transition to EXTRACTING state
      await supabase
        .from('knowledge_documents')
        .update({ ingestion_status: 'extracting', ingestion_progress: 20 })
        .eq('id', doc.id);

      // ── 0a: Download file from Supabase Storage ──
      log(`[INGESTION] 📥 Downloading file from storage bucket: ${KNOWLEDGE_STORAGE_BUCKET}`);
      log(`[INGESTION] File path: ${doc.file_path}`);
      log(`[INGESTION] File size: ${doc.file_size} bytes`);
      log(`[INGESTION] File MIME type: ${doc.mime_type}`);

      // Defensive checks before download
      if (!doc.file_path) {
        throw new Error(
          `TEXT_EXTRACTION_FAILED: document has no file_path in database`
        );
      }
      if (typeof doc.file_path !== 'string') {
        throw new Error(
          `TEXT_EXTRACTION_FAILED: file_path is not a string (got ${typeof doc.file_path})`
        );
      }
      if (doc.file_path.trim().length === 0) {
        throw new Error(
          `TEXT_EXTRACTION_FAILED: file_path is empty string`
        );
      }

      const { data: fileBlob, error: downloadError } = await supabase.storage
        .from(KNOWLEDGE_STORAGE_BUCKET)
        .download(doc.file_path);

      if (downloadError) {
        log(`[INGESTION] ❌ Storage download error object:`, downloadError);
        const errorMsg = downloadError?.message ?? JSON.stringify(downloadError) ?? 'unknown error';
        log(`[INGESTION] ❌ Storage download failed: ${errorMsg}`);
        throw new Error(
          `TEXT_EXTRACTION_FAILED: storage download failed: ${errorMsg}`
        );
      }

      if (!fileBlob) {
        log(`[INGESTION] ❌ Storage returned no data (file not found or inaccessible)`);
        throw new Error(
          `TEXT_EXTRACTION_FAILED: storage returned empty data (file not found)`
        );
      }

      log(`[INGESTION] ✅ File downloaded successfully`);

      // ── 0b: Convert Blob → Uint8Array (browser-safe, no Node.js Buffer) ──
      const arrayBuffer = await fileBlob.arrayBuffer();
      const buffer = new Uint8Array(arrayBuffer);
      log(`[INGESTION] Buffer size: ${buffer.length} bytes`);

      // Derive the filename from the storage path for extension detection
      const filename = doc.file_path.split('/').pop() || doc.title || 'document';
      const fileExt = filename.split('.').pop()?.toLowerCase() || 'unknown';
      log(`[INGESTION] File extension detected: .${fileExt}`);

      // ── 0c: Extract plain text (pdf-parse / mammoth / exceljs / plain UTF-8) ──
      log(`[INGESTION] 🔍 Extracting text from: ${filename}`);
      let rawText: string;
      try {
        rawText = await extractDocumentContent(buffer, filename);
        log(`[INGESTION] ✅ Text extraction completed (raw length: ${rawText.length} chars)`);
      } catch (extractError) {
        const errorMsg = extractError instanceof Error ? extractError.message : String(extractError);
        log(`[INGESTION] ❌ Text extraction failed: ${errorMsg}`);
        throw new Error(
          `TEXT_EXTRACTION_FAILED: ${errorMsg}`
        );
      }

      if (!rawText || rawText.trim().length === 0) {
        log(`[INGESTION] ⚠️ Warning: Extraction returned empty text (scanned PDF or image-only document?)`);
        throw new Error(
          'TEXT_EXTRACTION_FAILED: no text could be extracted from document (possibly scanned PDF without OCR)'
        );
      }

      // ── 0d: Normalize then sanitize ──
      log(`[INGESTION] sanitizing text (raw chars: ${rawText.length})`);
      const normalizedText = normalizeText(rawText);
      const sanitizedText  = sanitizeText(normalizedText);

      if (!sanitizedText || sanitizedText.trim().length === 0) {
        throw new Error(
          'TEXT_EXTRACTION_FAILED: sanitized text is empty after normalization'
        );
      }

      // ── 0e: Persist extracted content ──
      const { error: updateError } = await supabase
        .from('knowledge_documents')
        .update({
          content:           rawText,
          sanitized_content: sanitizedText,
        })
        .eq('id', doc.id);

      if (updateError) {
        throw new Error(
          `TEXT_EXTRACTION_FAILED: failed to store extracted content: ${updateError.message}`
        );
      }

      // Propagate extracted content so the rest of this function can use it
      doc.content           = rawText;
      doc.sanitized_content = sanitizedText;

      log(`[INGESTION] text extraction complete (sanitized chars: ${sanitizedText.length})`);
    }

    // ── Step 1: Validate content ─────────────────────────────────────────────
    const sanitized = doc.sanitized_content || doc.content;
    if (!sanitized || sanitized.trim().length === 0) {
      throw new Error('TEXT_EXTRACTION_FAILED: no content available after extraction');
    }

    log(`[PROCESS] Document size: ${(sanitized.length / 1024).toFixed(2)}KB`);

    // ── Step 2: Classify and chunk ───────────────────────────────────────────
    await supabase
      .from('knowledge_documents')
      .update({ ingestion_status: 'chunking', ingestion_progress: 40 })
      .eq('id', doc.id);

    log('[INGESTION] chunking document');
    const docType = classifyDocument(sanitized);
    log(`[PROCESS] Document type: ${docType}`);

    const rawChunks = chunkSmart(sanitized, docType);

    // Hard safety: split any chunk still exceeding 4000 characters.
    // This is a deterministic backstop — independent of document structure
    // or smartChunker strategy. A 4.7M-char document must never reach
    // the embedding step as a single chunk.
    const SAFE_MAX = 4_000;
    const safeChunks = rawChunks.flatMap((chunk) => {
      if (chunk.content.length <= SAFE_MAX) return [chunk];
      const split = [];
      for (let i = 0; i < chunk.content.length; i += SAFE_MAX) {
        split.push({
          ...chunk,
          content: chunk.content.slice(i, i + SAFE_MAX),
          metadata: { ...chunk.metadata, splitMode: 'forced' },
        });
      }
      return split;
    });

    console.log('[INGESTION_PIPELINE_V2]', {
      documentId: doc.id,
      totalChars: sanitized.length,
      chunks: safeChunks.length,
    });

    // Hard guarantee: a document larger than 2000 chars must never silently collapse to 1 chunk.
    if (safeChunks.length <= 1 && sanitized.length > 2000) {
      throw new Error('CRITICAL: chunking failed — only 1 chunk produced for large document');
    }

    if (!safeChunks.length) {
      throw new Error('No chunks generated from content');
    }

    log(`[PROCESS] Generated ${safeChunks.length} chunks (raw: ${rawChunks.length})`);

    // ── Step 3: Generate embeddings ──────────────────────────────────────────
    await supabase
      .from('knowledge_documents')
      .update({ ingestion_status: 'embedding', ingestion_progress: 75 })
      .eq('id', doc.id);

    log('[INGESTION] generating embeddings');
    console.log(`\n\n⚠️  [CRITICAL] About to call processEmbeddingsInBatches()`);
    console.log(`⚠️  [CRITICAL] documentId: ${doc.id}`);
    console.log(`⚠️  [CRITICAL] chunks.length: ${safeChunks.length}`);
    await processEmbeddingsInBatches(doc.id, safeChunks);
    console.log(`⚠️  [CRITICAL] processEmbeddingsInBatches() completed\n\n`);

    // ── Step 4: Mark as completed ────────────────────────────────────────────
    await markCompleted(doc.id, safeChunks.length);
    log(`[PROCESS] Ingestion complete for document ${doc.id}`);
  } catch (err: any) {
    logError(`[PROCESS] Error processing document ${doc.id}:`, err.message);
    throw err;
  }
}

// =======================================================
// Embedding helpers
// =======================================================

/**
 * Call the generate-embedding Edge Function with a batch of texts.
 * Returns one embedding vector per input, preserving order.
 * Throws on network / Edge Function failure — caller handles per-batch fallback.
 *
 * CRITICAL: Must pass Authorization header (Bearer token) — Edge Function requires it.
 */
async function generateEmbeddingBatch(texts: string[]): Promise<number[][]> {
  console.log(`[EMBEDDING:BATCH] ========== STARTING BATCH EMBEDDING GENERATION ==========`);
  console.log(`[EMBEDDING:BATCH] Invoking Edge Function for ${texts.length} texts`);
  console.log(`[EMBEDDING:BATCH] Request body:`, {
    textCount: texts.length,
    model: 'text-embedding-3-small',
    dimensions: EMBEDDING_DIMENSIONS,
    totalChars: texts.reduce((sum, t) => sum + t.length, 0),
  });

  // NOTE: The Supabase client is configured with credentials from environment
  // (SUPABASE_SERVICE_ROLE_KEY or SUPABASE_ANON_KEY).
  // The JS SDK automatically includes the Authorization header.
  console.log('[EMBEDDING:BATCH] Supabase client configured with:');
  console.log('[EMBEDDING:BATCH]   SUPABASE_SERVICE_ROLE_KEY available:', !!process.env.SUPABASE_SERVICE_ROLE_KEY);
  console.log('[EMBEDDING:BATCH]   VITE_SUPABASE_ANON_KEY available:', !!process.env.VITE_SUPABASE_ANON_KEY || !!process.env.SUPABASE_ANON_KEY);
  console.log('[EMBEDDING:BATCH] Supabase JS SDK will automatically include correct Authorization header');

  console.log(`[EMBEDDING:BATCH] About to invoke Edge Function 'generate-embedding'`);
  console.log(`[EMBEDDING:BATCH] Supabase functions object exists:`, !!supabase.functions);
  console.log(`[EMBEDDING:BATCH] Invoke method exists:`, typeof supabase.functions.invoke);
  console.log(`[EMBEDDING:BATCH] Note: NOT passing custom Authorization header - letting Supabase client handle it`);

  let data: any;
  let fnError: any;

  try {
    console.log(`[EMBEDDING:BATCH] Calling supabase.functions.invoke() ...`);
    const result = await supabase.functions.invoke(
      'generate-embedding',
      {
        // IMPORTANT: Do NOT pass custom Authorization header.
        // Supabase JS SDK automatically includes the correct auth credentials
        // from the client instance (SUPABASE_SERVICE_ROLE_KEY when available).
        // Passing a custom header can override/conflict with these credentials.
        body: { inputs: texts, model: 'text-embedding-3-small', dimensions: EMBEDDING_DIMENSIONS },
      }
    );
    data = result.data;
    fnError = result.error;
    console.log(`[EMBEDDING:BATCH] Invoke returned. Error present:`, !!fnError);
    console.log(`[EMBEDDING:BATCH] Data present:`, !!data);
  } catch (invokeErr: any) {
    console.error(`[EMBEDDING:BATCH] ❌ INVOKE THREW EXCEPTION (not just error response)`);
    console.error(`[EMBEDDING:BATCH] Exception type:`, invokeErr?.constructor?.name);
    console.error(`[EMBEDDING:BATCH] Exception message:`, invokeErr?.message);
    console.error(`[EMBEDDING:BATCH] Exception details:`, invokeErr);
    throw invokeErr;
  }

  if (fnError) {
    console.error(`[EMBEDDING:BATCH] Edge Function invocation failed`);
    console.error(`[EMBEDDING:BATCH] Error type:`, fnError?.constructor?.name);
    console.error(`[EMBEDDING:BATCH] Error message:`, fnError.message);
    console.error(`[EMBEDDING:BATCH] Error status:`, fnError?.status);
    console.error(`[EMBEDDING:BATCH] Full error:`, JSON.stringify(fnError, null, 2));
    throw new Error(`Edge Function error: ${fnError.message}`);
  }

  console.log(`[EMBEDDING:BATCH] Edge Function returned successfully`);
  console.log(`[EMBEDDING:BATCH] Response data type:`, typeof data);
  console.log(`[EMBEDDING:BATCH] Response data keys:`, Object.keys(data || {}));
  console.log(`[EMBEDDING:BATCH] Response data:`, JSON.stringify(data, null, 2));

  if (!data?.embeddings || !Array.isArray(data.embeddings)) {
    console.error(`[EMBEDDING:BATCH] Invalid response structure`);
    console.error(`[EMBEDDING:BATCH] data.embeddings exists:`, !!data?.embeddings);
    console.error(`[EMBEDDING:BATCH] is array:`, Array.isArray(data?.embeddings));
    throw new Error('Invalid Edge Function response — missing embeddings array');
  }

  console.log(`[EMBEDDING:BATCH] Successfully parsed ${data.embeddings.length} embeddings`);
  console.log(`[EMBEDDING:BATCH] First embedding dimensions:`, data.embeddings[0]?.length ?? 'N/A');
  return data.embeddings as number[][];
}

// =======================================================
// Embedding Batch Processor
// =======================================================

async function processEmbeddingsInBatches(documentId: string, chunks: Chunk[]) {
  console.log(`\n\n🔴🔴🔴 [CRITICAL] ENTERED processEmbeddingsInBatches() 🔴🔴🔴`);
  console.log(`\n\n========== [EMBEDDING] STARTING EMBEDDING GENERATION PHASE ==========`);
  console.log(`[EMBEDDING] Document ID: ${documentId}`);
  console.log(`[EMBEDDING] Total chunks to embed: ${chunks.length}`);
  console.log(`[EMBEDDING] Batch size: ${EMBEDDING_BATCH_SIZE}`);
  console.log(`[EMBEDDING] Will process in ${Math.ceil(chunks.length / EMBEDDING_BATCH_SIZE)} batches`);
  console.log(`[EMBEDDING] Supabase instance available:`, !!supabase);
  console.log(`[EMBEDDING] Environment: ${typeof window === 'undefined' ? 'SERVER/NODE.JS' : 'BROWSER'}`);

  console.log(`\n🔴 [CRITICAL] FOR LOOP CHECK: chunks.length=${chunks.length}, EMBEDDING_BATCH_SIZE=${EMBEDDING_BATCH_SIZE}`);
  console.log(`🔴 [CRITICAL] FOR LOOP will iterate: ${Math.ceil(chunks.length / EMBEDDING_BATCH_SIZE)} times`);

  for (let i = 0; i < chunks.length; i += EMBEDDING_BATCH_SIZE) {
    console.log(`\n🔴 [CRITICAL] INSIDE FOR LOOP at iteration i=${i}`);
    await ensureStillProcessing(documentId);

    const batch      = chunks.slice(i, i + EMBEDDING_BATCH_SIZE);
    const texts      = batch.map(c => c.content);
    const batchLabel = `batch ${Math.floor(i / EMBEDDING_BATCH_SIZE) + 1}`;

    console.log(`🔴 [CRITICAL] About to call generateEmbeddingBatch with ${texts.length} texts`);
    // Log batch information before embedding generation
    console.log(`[EMBEDDING] ${batchLabel} starting`);
    console.log(`[EMBEDDING] ${batchLabel} chunk count:`, batch.length);
    console.log(`[EMBEDDING] ${batchLabel} total text length:`, texts.reduce((sum, t) => sum + t.length, 0), 'chars');
    console.log(`[EMBEDDING] ${batchLabel} avg text length:`, Math.round(texts.reduce((sum, t) => sum + t.length, 0) / texts.length), 'chars');

    // Generate all embeddings for this batch in a single Edge Function call.
    // On failure, insert chunks with null embeddings rather than aborting the document.
    let embeddings: (number[] | null)[] = new Array(batch.length).fill(null);
    try {
      console.log(`[EMBEDDING] ${batchLabel} calling Edge Function...`);
      const result = await generateEmbeddingBatch(texts);
      console.log(`[EMBEDDING] ${batchLabel} received ${result.length} embeddings from OpenAI`);
      embeddings = result.map(e => (Array.isArray(e) && e.length > 0 ? e : null));
      console.log(`[EMBEDDING] ${batchLabel} processed embeddings: ${embeddings.filter(e => e !== null).length} valid, ${embeddings.filter(e => e === null).length} null`);
    } catch (err: any) {
      console.error(`[EMBEDDING] ❌ ${batchLabel} embedding call FAILED`);
      console.error(`[EMBEDDING] ${batchLabel} error type:`, err?.constructor?.name);
      console.error(`[EMBEDDING] ${batchLabel} error message:`, err?.message);
      console.error(`[EMBEDDING] ${batchLabel} error details:`, err);
      console.error(`[EMBEDDING] ${batchLabel} stack trace:`, err?.stack);
      warn(`[EMBEDDING] ${batchLabel} embedding call failed: ${err.message} — chunks will be stored without vectors`);
    }

    // Build insert records (skip empty-content chunks)
    const records = batch
      .filter(c => c.content && c.content.trim().length > 0)
      .map((chunk, idx) => ({
        document_id:      documentId,
        content:          chunk.content,
        chunk_index:      i + idx,
        token_count:      chunk.tokenCount,
        metadata:         chunk.metadata ?? {},
        embedding_vector: embeddings[idx] ?? null,
      }));

    if (records.length === 0) {
      warn(`[EMBEDDING] ${batchLabel} produced no valid records — skipping`);
      continue;
    }

    // Defensive guard: created_by must NEVER appear in a chunk row.
    for (const row of records) {
      if ('created_by' in row) {
        throw new Error(
          `Invalid chunk payload: created_by must not be present in knowledge_chunks. ` +
          `Document ID: ${documentId}, batch: ${batchLabel}`
        );
      }
    }

    // Insert in sub-batches of INSERT_BATCH_SIZE
    for (let j = 0; j < records.length; j += INSERT_BATCH_SIZE) {
      const insertSlice = records.slice(j, j + INSERT_BATCH_SIZE);

      console.log("SUPABASE INSERT TABLE:", "knowledge_chunks");
      console.log("SUPABASE INSERT PAYLOAD:", JSON.stringify(insertSlice, null, 2));

      let insertError: any;

      try {
        const result = await supabase.from('knowledge_chunks').insert(insertSlice);
        insertError = result.error;

        if (insertError) {
          console.error(`[EMBEDDING] ❌ DATABASE ERROR (${batchLabel})`);
          console.error('[EMBEDDING] Error message:', insertError.message);
          console.error('[EMBEDDING] Error code:', (insertError as any).code);
          console.error('[EMBEDDING] Error details:', JSON.stringify(insertError, null, 2));
          console.error('[EMBEDDING] Document ID:', documentId);
          console.error('[EMBEDDING] Batch label:', batchLabel);
          console.error('[EMBEDDING] Chunks in batch:', insertSlice.length);
          console.error('[EMBEDDING] First chunk:', JSON.stringify(insertSlice[0], null, 2));
        }
      } catch (e) {
        console.error(`[EMBEDDING] ❌ EXCEPTION THROWN (${batchLabel})`);
        console.error('[EMBEDDING] Exception message:', e instanceof Error ? e.message : String(e));
        console.error('[EMBEDDING] Exception type:', e?.constructor?.name);
        console.error('[EMBEDDING] Stack trace:', e instanceof Error ? e.stack : 'N/A');
        console.error('[EMBEDDING] Full exception:', e);
        console.error('[EMBEDDING] Document ID:', documentId);
        insertError = e;
      }

      if (insertError) {
        const errorMsg = insertError instanceof Error ? insertError.message : insertError?.message || 'Unknown error';
        throw new Error(`[EMBEDDING] Failed to persist chunks (${batchLabel}): ${errorMsg}`);
      }
    }

    const successCount = records.filter(r => r.embedding_vector !== null).length;
    log(`[EMBEDDING] ${batchLabel} complete — ${successCount}/${records.length} chunks embedded`);
  }
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

  // Accept any intermediate processing state (processing, extracting, chunking, embedding)
  const activeStatuses = ['processing', 'extracting', 'chunking', 'embedding'];
  if (!data || !activeStatuses.includes(data.ingestion_status)) {
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

async function markCompleted(documentId: string, chunkCount?: number) {
  const { error: updateError } = await supabase
    .from("knowledge_documents")
    .update({
      ingestion_status: "completed",
      ingestion_completed_at: new Date().toISOString(),
      pipeline_timeout_at: null,
      ingestion_progress: 100,
      ...(chunkCount !== undefined && { chunk_count: chunkCount }),
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
