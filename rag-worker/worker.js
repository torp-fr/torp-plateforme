import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { supabase } from "./core/supabaseClient.js";
import {
  extractDocumentText,
  detectSourceType,
} from "./extractors/extractionService.js";
import { cleanText, removeHeaders, normalizeLineEndings } from "./processors/cleanText.js";
import { structureSections } from "./processors/structureSections.js";
import { smartChunkText } from "./processors/smartChunker.js";
import { generateBatchEmbeddings } from "./core/embeddingService.js";

// ===============================
// ⚠️ TEMPORARY: OBLIGATION EXTRACTION TEST
// This import executes the extraction test on worker startup
// Remove this import after testing is complete
// ===============================
try {
  await import("./scripts/testObligationExtraction.js");
  console.log("⚠️ TEST OBLIGATION EXTRACTION MODE ACTIVE - Test script executed");
} catch (testError) {
  console.warn("⚠️ TEST OBLIGATION EXTRACTION: Test import failed (non-critical)", testError.message);
  // Continue worker execution even if test fails
}

// ===============================
// GOOGLE VISION AUTH INITIALIZER
// ===============================
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

if (process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
  try {
    const credentialsPath = path.join(__dirname, "google-credentials.json");
    fs.writeFileSync(
      credentialsPath,
      process.env.GOOGLE_SERVICE_ACCOUNT_JSON
    );
    process.env.GOOGLE_APPLICATION_CREDENTIALS = credentialsPath;
    console.log("✅ Google Vision credentials initialized from environment variable.");
  } catch (error) {
    console.error("❌ Failed to initialize Google Vision credentials:", error.message);
  }
} else {
  console.warn("⚠️ GOOGLE_SERVICE_ACCOUNT_JSON environment variable not found. OCR may fail.");
}

const BUILD_ID = "NUCLEAR_VERIFY_2500_V1";
const BATCH_SIZE = 50;
const CHUNK_SIZE = 2500;
const EMBEDDING_DIMENSION = 1536;
const POLL_INTERVAL = 10000;

// 🔒 HARD LOCK: Verify chunk size at build time
if (CHUNK_SIZE !== 2500) {
  throw new Error("🚨 FATAL: CHUNK_SIZE mismatch at build time. Expected 2500, got " + CHUNK_SIZE);
}

async function downloadFile(storagePath) {
  try {
    const { data, error } = await supabase.storage
      .from("knowledge-files")
      .download(storagePath);

    if (error) {
      throw new Error(`Storage download failed: ${error.message}`);
    }

    return await data.arrayBuffer();
  } catch (error) {
    throw new Error(`Failed to download file: ${error.message}`);
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

    // Step 2: Delete existing chunks to avoid duplicates
    console.log(`  🗑️ Cleaning up existing chunks...`);
    await supabase
      .from("knowledge_chunks")
      .delete()
      .eq("document_id", documentId);

    // Step 3: Download file
    console.log(`  📥 Downloading file...`);
    const arrayBuffer = await downloadFile(doc.file_path);

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
    const documentMetadata = {
      category: doc.category || null,
      documentVersion: doc.version_number || null,
      authorityWeight,
      metierTarget: doc.metier_target || null,
      documentType: doc.category || null,
      effectiveDate: doc.effective_date || null,
      expirationDate: doc.expiration_date || null,
    };

    console.log(
      `  ✅ Extracted ${rawText.length} characters (${extractionConfidence})`
    );

    // Step 5: Clean and normalize text
    console.log(`  🧹 Cleaning text...`);
    let cleanedText = normalizeLineEndings(rawText);
    cleanedText = removeHeaders(cleanedText);
    cleanedText = cleanText(cleanedText);

    if (!cleanedText || cleanedText.trim().length === 0) {
      throw new Error("No text content to process after cleaning");
    }

    // Step 6: Structure text into sections
    console.log(`  📚 Structuring sections...`);
    const sections = structureSections(cleanedText);
    console.log(`  ✅ Found ${sections.length} sections`);

    // Step 7: Create smart chunks with metadata
    console.log(`  ✂️ Creating smart chunks...`);

    // 🚨 PRODUCTION ERROR CHECK
    if (CHUNK_SIZE !== 2500) {
      throw new Error("🚨 PRODUCTION ERROR: CHUNK_SIZE is not 2500. Current value: " + CHUNK_SIZE);
    }

    let chunks = smartChunkText(cleanedText, sections, CHUNK_SIZE);

    if (chunks.length === 0) {
      console.log(`  ⚠️ Smart chunker returned 0 chunks, activating fallback chunking`);
      chunks = fallbackChunking(cleanedText, CHUNK_SIZE);

      if (chunks.length === 0) {
        throw new Error(
          "Fallback chunking also returned 0 chunks - text too small or invalid"
        );
      }

      console.log(`  ✅ Fallback created ${chunks.length} chunks`);
    } else {
      console.log(`  ✅ Created ${chunks.length} chunks`);
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
        section_title: chunk.section_title,
        section_level: chunk.section_level,
        metadata: JSON.stringify(chunk.metadata),
        source_type: sourceType,
        extraction_confidence: extractionConfidence,
        category: documentMetadata.category,
        document_version: documentMetadata.documentVersion,
        authority_weight: documentMetadata.authorityWeight,
        metier_target: documentMetadata.metierTarget,
        document_type: documentMetadata.documentType,
        effective_date: documentMetadata.effectiveDate,
        expiration_date: documentMetadata.expirationDate,
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
          embedding: embedding,
          embedding_generated_at: now,
          embedding_status: "completed",
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
    console.error(`Error: ${error.message}`);

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
      await processDocument(documents[0]);
    }
  } catch (error) {
    console.error(`Poll error: ${error.message}`);
  }
}

// 🚨 NUCLEAR VERIFICATION - RUNTIME PROOF
console.log("🚨🚨🚨 BUILD VERSION: CHUNK_SIZE_2500_ACTIVE 🚨🚨🚨");
console.log("🚨 Runtime CHUNK_SIZE value:", CHUNK_SIZE);
console.log("🚨 Worker file path:", __filename);
console.log("🚨 BUILD ID:", BUILD_ID);

console.log("🚀 RAG Worker v2 started");
console.log(`📍 Poll interval: ${POLL_INTERVAL}ms`);
console.log(`📦 Batch size: ${BATCH_SIZE}`);
console.log(`📄 Chunk size: ${CHUNK_SIZE}`);
console.log(`🔑 Formats: PDF, DOCX, XLSX, Images (OCR), TXT`);

setInterval(pollDocuments, POLL_INTERVAL);

// Initial poll immediately
pollDocuments();
