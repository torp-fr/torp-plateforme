import "./config/loadEnv.js";
import "./config/validateEnv.js";

// ── Global error guards ────────────────────────────────────────────────────────
// Catch async errors thrown outside promise chains (e.g. google-auth-library).
// These handlers prevent the process from crashing on uncaught exceptions.
process.on('uncaughtException', (err) => {
  console.error('[GLOBAL ERROR] uncaughtException:', err.message);
  if (err.stack) console.error(err.stack);
});

process.on('unhandledRejection', (reason) => {
  console.error('[GLOBAL ERROR] unhandledRejection:', reason);
});
// ────────────────────────────────────────────────────────────────────────────────

import path from "path";
import { fileURLToPath } from "url";
import { supabase } from "./core/supabaseClient.js";
import {
  extractDocumentText,
  detectSourceType,
} from "./extractors/extractionService.js";
import { cleanText, removeHeaders, normalizeLineEndings } from "./processors/cleanText.js";
import { smartChunkText } from "./processors/smartChunker.js";
import { generateBatchEmbeddings } from "./core/embeddingService.js";

// Google Vision credentials are handled inline in ocrService.js — no file write needed.
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BUILD_ID = "SEMANTIC_CHUNKING_V2";
const BATCH_SIZE = 50;
const EMBEDDING_DIMENSION = 384;
const POLL_INTERVAL = 10000;

// Note: CHUNK_SIZE parameter is now deprecated — smartChunker uses token-based sizing (700-900 tokens)

async function downloadFile(storagePath) {
  const MAX_RETRIES = 3;
  const bucket = "documents"; // STORAGE_BUCKETS.KNOWLEDGE — see src/constants/storage.ts

  // Defensive logging before attempting download
  console.log(`  [DOWNLOAD] ════════════════════════════════════════`);
  console.log(`  [DOWNLOAD] bucket: "${bucket}"`);
  console.log(`  [DOWNLOAD] path: "${storagePath}"`);
  console.log(`  [DOWNLOAD] path length: ${storagePath?.length || 'undefined'}`);
  console.log(`  [DOWNLOAD] path type: ${typeof storagePath}`);
  console.log(`  [DOWNLOAD] ════════════════════════════════════════`);

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      console.log(`  [DOWNLOAD] Attempt ${attempt}/${MAX_RETRIES}`);

      // Validate path before attempting download
      if (!storagePath) {
        throw new Error("storagePath is null or undefined");
      }
      if (typeof storagePath !== 'string') {
        throw new Error(`storagePath must be string, got ${typeof storagePath}`);
      }
      if (storagePath.trim().length === 0) {
        throw new Error("storagePath is empty string");
      }

      const { data, error } = await supabase.storage
        .from(bucket)
        .download(storagePath);

      if (error) {
        // Detailed error logging
        console.error(`  [DOWNLOAD ERROR] Attempt ${attempt}/${MAX_RETRIES}`);
        console.error(`  [DOWNLOAD ERROR] bucket: "${bucket}"`);
        console.error(`  [DOWNLOAD ERROR] path: "${storagePath}"`);
        console.error(`  [DOWNLOAD ERROR] error object:`, error);

        const errDetail = error?.message ||
                         (error && typeof error === 'object' ? JSON.stringify(error) : String(error)) ||
                         'unknown error';
        console.error(`  [DOWNLOAD ERROR] error detail: ${errDetail}`);

        if (attempt < MAX_RETRIES) {
          const delay = 2000 * attempt;
          console.log(`  [DOWNLOAD] Retrying after ${delay}ms...`);
          await new Promise(r => setTimeout(r, delay));
          continue;
        }
        throw new Error(`Storage download failed after ${MAX_RETRIES} attempts: ${errDetail}`);
      }

      if (!data) {
        throw new Error("Storage returned empty data (file not found or inaccessible)");
      }

      // Convert Blob to ArrayBuffer
      const arrayBuffer = await data.arrayBuffer();

      // Diagnostic logging with comprehensive buffer info
      console.log(`  [DOWNLOAD RESULT]`, {
        hasData: !!data,
        dataType: data?.constructor?.name || 'unknown',
        arrayBufferByteLength: arrayBuffer?.byteLength || 0,
        hasByteLength: !!arrayBuffer?.byteLength,
        error: null,
      });

      // Validate buffer is not empty
      if (!arrayBuffer) {
        throw new Error("arrayBuffer is null or undefined after conversion");
      }

      if (arrayBuffer.byteLength === 0) {
        throw new Error("Downloaded file buffer is empty (file may be corrupted, 0 bytes, or access denied)");
      }

      console.log(`  [BUFFER SIZE] ${arrayBuffer.byteLength} bytes`);
      console.log(`  [DOWNLOAD] ✅ Downloaded and validated ${arrayBuffer.byteLength} bytes`);

      return arrayBuffer;
    } catch (err) {
      console.error(`  [DOWNLOAD] Exception (attempt ${attempt}/${MAX_RETRIES}):`, err);

      if (attempt < MAX_RETRIES && !err.message?.includes('Storage download failed after')) {
        const delay = 2000 * attempt;
        console.log(`  [DOWNLOAD] Retrying after ${delay}ms...`);
        await new Promise(r => setTimeout(r, delay));
        continue;
      }

      throw new Error(`Failed to download file: ${err.message}`);
    }
  }
}

function fallbackChunking(text, chunkSize) {
  const chunks = [];
  const trimmedText = text.trim();

  if (!trimmedText || trimmedText.length === 0) {
    return chunks;
  }

  for (let i = 0; i < trimmedText.length; i += chunkSize) {
    chunks.push({
      content: trimmedText.substring(i, i + chunkSize),
      chunk_index: chunks.length,
      section_title: null,
      section_level: null,
      metadata: {},
    });
  }

  return chunks;
}

function computeAuthorityWeight(category) {
  const weights = {
    DTU: 5,
    EUROCODE: 5,
    NORM: 4,
    REGULATION: 4,
    LEGAL: 4,
    TECHNICAL_GUIDE: 3,
    GUIDELINE: 2,
    BEST_PRACTICE: 2,
    MANUAL: 1,
    TRAINING: 1,
    CASE_STUDY: 1,
    LESSONS_LEARNED: 1,
    PRICING_REFERENCE: 1,
  };

  return weights[category] || 1;
}

async function processDocument(doc) {
  const documentId = doc.id;
  console.log(`Processing: ${documentId}`);

  try {
    // Step 0: Idempotency guard
    //   count > 10  → valid ingestion, skip
    //   1–10 chunks → likely partial/broken OCR, delete and reprocess
    //   0 chunks    → fresh document, process normally
    const { count } = await supabase
      .from("knowledge_chunks")
      .select("*", { count: "exact", head: true })
      .eq("document_id", documentId);

    if (count > 10) {
      console.log(`[SKIP] Document already processed (${count} chunks)`);

      await supabase
        .from("knowledge_documents")
        .update({
          ingestion_status: "completed",
          ingestion_progress: 100,
        })
        .eq("id", documentId);

      return;
    }

    if (count > 0 && count <= 10) {
      console.log(`[REPROCESS] Low chunk count detected (${count} chunks) — deleting and reprocessing`);

      await supabase
        .from("knowledge_chunks")
        .delete()
        .eq("document_id", documentId);
    }

    // Step 1: Claim document (atomic pattern)
    const { data: claimed, error: claimError } = await supabase
      .from("knowledge_documents")
      .update({
        ingestion_status: "processing",
        ingestion_progress: 10,
      })
      .eq("id", documentId)
      .eq("ingestion_status", "pending")
      .select()
      .single();

    if (claimError || !claimed) {
      console.log(`  ⚠️ Document already processing or invalid`);
      return;
    }

    // Step 2: Download file (moved before chunk deletion for safety)
    // Chunks will be deleted AFTER text validation succeeds
    console.log(`  📥 Downloading file...`);
    console.log(`  📥 Document file_path from DB: "${doc.file_path}"`);
    const arrayBuffer = await downloadFile(doc.file_path);

    // Validate arrayBuffer before extraction
    console.log(`  📥 ArrayBuffer validation:`);
    console.log(`     - Type: ${arrayBuffer?.constructor?.name || 'null'}`);
    console.log(`     - ByteLength: ${arrayBuffer?.byteLength || 0}`);
    console.log(`     - Is valid: ${!!(arrayBuffer && arrayBuffer.byteLength > 0)}`);

    if (!arrayBuffer || arrayBuffer.byteLength === 0) {
      throw new Error(`TEXT_EXTRACTION_FAILED: Downloaded arrayBuffer is empty or invalid`);
    }

    // Step 4: Extract text based on file type
    console.log(`  🔍 Extracting text...`);
    const extractionResult = await extractDocumentText(
      arrayBuffer,
      doc.file_path,
      doc.mime_type
    );
    const rawText = extractionResult.text;
    const sourceType = detectSourceType(doc.mime_type, doc.file_path);
    const extractionConfidence = extractionResult.confidence;
    const authorityWeight = computeAuthorityWeight(doc.category);
    // category is required for rule extraction — fail early if missing
    if (!doc.category || typeof doc.category !== 'string' || doc.category.trim().length === 0) {
      console.error(`[CATEGORY ERROR] Document ${documentId} has no category — cannot propagate to chunks. Aborting.`);
      await supabase
        .from("knowledge_documents")
        .update({
          ingestion_status: "failed",
          last_ingestion_error: "Document has no category — required for chunk propagation",
        })
        .eq("id", documentId);
      return;
    }

    const documentMetadata = {
      category: doc.category,
      documentVersion: doc.version_number || null,
      authorityWeight,
      metierTarget: doc.metier_target || null,
      documentType: doc.category,
      effectiveDate: doc.effective_date || null,
      expirationDate: doc.expiration_date || null,
    };

    console.log(
      `  ✅ Extracted ${rawText.length} characters (${extractionConfidence})`
    );

    // Step 5: Clean and normalize text
    // Order: normalizeLineEndings → cleanText → removeHeaders
    //   normalizeLineEndings  : \r\n / \r  → \n  (platform normalization)
    //   cleanText             : collapse horizontal whitespace, preserve \n\n
    //   removeHeaders         : collapse >2 consecutive blank lines
    console.log(`  🧹 Cleaning text...`);
    let cleanedText = normalizeLineEndings(rawText);
    cleanedText = cleanText(cleanedText);
    cleanedText = removeHeaders(cleanedText);

    if (!cleanedText || cleanedText.trim().length < 200) {
      console.error(`[OCR REQUIRED] Document ${documentId} has no text — OCR needed (extracted ${cleanedText?.length || 0} chars)`);
      await supabase
        .from("knowledge_documents")
        .update({
          ingestion_status: "failed",
          ingestion_progress: 0,
          last_ingestion_error: "No extractable text",
        })
        .eq("id", documentId);
      return;
    }

    // ✅ Text validation passed — NOW safe to delete old chunks
    console.log(`  🗑️ Deleting existing chunks (text validation passed)...`);
    await supabase
      .from("knowledge_chunks")
      .delete()
      .eq("document_id", documentId);

    // Step 6: Create smart chunks with metadata
    // smartChunkText runs its own internal section detection (SECTION_HEADER_RE).
    // Note: Using semantic chunking (700-900 tokens per chunk, ~2800-3600 chars)
    console.log(`  ✂️ Creating semantic chunks...`);

    let chunks = smartChunkText(cleanedText);

    if (chunks.length === 0) {
      console.log(`  ⚠️ Smart chunker returned 0 chunks, activating fallback chunking`);
      chunks = fallbackChunking(cleanedText, 2500);

      if (chunks.length === 0) {
        console.error(`[CHUNKING FAILED] Document ${documentId} — both smart and fallback chunkers returned 0 chunks`);
        await supabase
          .from("knowledge_documents")
          .update({
            ingestion_status: "failed",
            ingestion_progress: 0,
            last_ingestion_error: "Could not chunk document",
          })
          .eq("id", documentId);
        return;
      }

      console.log(`  ✅ Fallback created ${chunks.length} chunks`);
    } else {
      console.log(`  ✅ Created ${chunks.length} chunks (semantic chunking)`);
    }

    // Step 8: Update progress
    await supabase
      .from("knowledge_documents")
      .update({
        ingestion_progress: 30,
      })
      .eq("id", documentId);

    // Step 9: Batch insert chunks
    console.log(`  📝 Inserting chunks (batch size: ${BATCH_SIZE})...`);
    let insertedChunks = 0;

    for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
      const batch = chunks.slice(i, i + BATCH_SIZE);
      const payload = batch.map((chunk) => ({
        document_id: documentId,
        chunk_index: chunk.chunk_index,
        content: chunk.content,
        token_count: Math.ceil(chunk.content.length / 4),
        metadata: chunk.metadata || {},
        section_title: chunk.section_title || null,
        section_level: chunk.section_level || null,
        source_type: sourceType || null,
        extraction_confidence: extractionConfidence || null,
        category: documentMetadata.category,
        document_version: documentMetadata.documentVersion || null,
        authority_weight: documentMetadata.authorityWeight || null,
        metier_target: documentMetadata.metierTarget || null,
        document_type: documentMetadata.documentType || null,
        effective_date: documentMetadata.effectiveDate || null,
        expiration_date: documentMetadata.expirationDate || null,
      }));

      const { error: insertError } = await supabase
        .from("knowledge_chunks")
        .insert(payload);

      if (insertError) {
        throw new Error(
          `Chunk insert failed at index ${i}: ${insertError.message}`
        );
      }

      insertedChunks += payload.length;
    }

    console.log(`  ✅ Inserted ${insertedChunks} chunks`);
    console.log(`  📊 Category distribution: { "${documentMetadata.category}": ${insertedChunks} }`);

    // Step 10: Update progress before embeddings
    await supabase
      .from("knowledge_documents")
      .update({
        ingestion_progress: 50,
      })
      .eq("id", documentId);

    // Step 11: Generate batch embeddings
    console.log(`  🤖 Generating embeddings (batch mode)...`);
    const texts = chunks.map((c) => c.content);
    const embeddings = await generateBatchEmbeddings(texts);

    // Validate all embeddings
    for (let i = 0; i < embeddings.length; i++) {
      if (embeddings[i].length !== EMBEDDING_DIMENSION) {
        throw new Error(
          `Embedding ${i} has invalid dimension: ${embeddings[i].length}`
        );
      }
    }

    // Step 12: Batch update chunks with embeddings
    console.log(`  📊 Batch updating ${embeddings.length} embeddings...`);
    const now = new Date().toISOString();

    // Update each chunk individually to avoid upsert constraints
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const embedding = embeddings[i];

      const { error: updateError } = await supabase
        .from("knowledge_chunks")
        .update({
          embedding_vector: embedding,
          embedding_generated_at: now,
        })
        .eq("document_id", documentId)
        .eq("chunk_index", chunk.chunk_index);

      if (updateError) {
        throw new Error(
          `Failed to update embedding for chunk ${chunk.chunk_index}: ${updateError.message}`
        );
      }
    }

    console.log(`  ✅ Updated ${embeddings.length} embeddings`);

    // Step 13: Mark as completed
    console.log(`  ✅ Marking document as completed...`);
    const { error: completeError } = await supabase
      .from("knowledge_documents")
      .update({
        ingestion_status: "completed",
        ingestion_progress: 100,
      })
      .eq("id", documentId);

    if (completeError) {
      throw new Error(`Failed to mark as completed: ${completeError.message}`);
    }

    console.log(`Completed: ${documentId}`);
  } catch (error) {
    console.error(`❌ Error processing document ${documentId}:`);
    console.error(`  Message: ${error.message}`);
    if (error.stack) {
      console.error(`  Stack:`, error.stack);
    }

    try {
      await supabase
        .from("knowledge_documents")
        .update({
          ingestion_status: "failed",
          last_ingestion_error: error.message,
        })
        .eq("id", documentId);
    } catch (updateError) {
      console.error(
        `Failed to update error status: ${updateError.message}`
      );
    }
  }
}

async function pollDocuments() {
  try {
    const { data: documents, error } = await supabase
      .from("knowledge_documents")
      .select("*")
      .eq("ingestion_status", "pending")
      .limit(1);

    if (error) {
      console.error(`Database error: ${error.message}`);
      return;
    }

    if (documents && documents.length > 0) {
      try {
        await processDocument(documents[0]);
      } catch (err) {
        console.error('[WORKER] Document processing failed:', err.message);
        if (err.stack) console.error(err.stack);
      }
    }
  } catch (error) {
    console.error(`Poll error: ${error.message}`);
  }
}

// 📋 INITIALIZATION SUMMARY
console.log("═══════════════════════════════════════════════════════════════════");
console.log("🚀 RAG Worker v2 started (Semantic Chunking)");
console.log("═══════════════════════════════════════════════════════════════════");
console.log(`📋 Build ID: ${BUILD_ID}`);
console.log(`📍 Poll interval: ${POLL_INTERVAL}ms`);
console.log(`📦 Batch size: ${BATCH_SIZE}`);
console.log(`📝 Chunking: Semantic (700-900 tokens, ~2800-3600 chars)`);
console.log(`🔑 Formats: PDF, DOCX, XLSX, Images (OCR), TXT`);
console.log(`📂 Worker path: ${__filename}`);
console.log("═══════════════════════════════════════════════════════════════════");

setInterval(pollDocuments, POLL_INTERVAL);

// Initial poll immediately
pollDocuments();
