import { supabase } from "./core/supabaseClient.js";
import {
  extractDocumentText,
  detectSourceType,
} from "./extractors/extractionService.js";
import { cleanText, removeHeaders, normalizeLineEndings } from "./processors/cleanText.js";
import { structureSections } from "./processors/structureSections.js";
import { smartChunkText } from "./processors/smartChunker.js";
import { generateBatchEmbeddings } from "./core/embeddingService.js";

const BATCH_SIZE = 50;
const CHUNK_SIZE = 1000;
const EMBEDDING_DIMENSION = 1536;
const POLL_INTERVAL = 10000;

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

    console.log(
      `  ✅ Extracted ${rawText.length} characters (${extractionConfidence})`
    );

    // Step 5: Clean and normalize text
    console.log(`  🧹 Cleaning text...`);
    let cleanedText = normalizeLineEndings(rawText);
    cleanedText = removeHeaders(cleanedText);
    cleanedText = cleanText(cleanedText);

    // Step 6: Structure text into sections
    console.log(`  📚 Structuring sections...`);
    const sections = structureSections(cleanedText);
    console.log(`  ✅ Found ${sections.length} sections`);

    // Step 7: Create smart chunks with metadata
    console.log(`  ✂️ Creating smart chunks...`);
    const chunks = smartChunkText(cleanedText, sections, CHUNK_SIZE);
    console.log(`  ✅ Created ${chunks.length} chunks`);

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

    // Step 12: Update chunks with embeddings
    console.log(`  📊 Storing embeddings...`);
    for (let i = 0; i < embeddings.length; i++) {
      await supabase
        .from("knowledge_chunks")
        .update({
          embedding: embeddings[i],
          embedding_generated_at: new Date().toISOString(),
        })
        .eq("document_id", documentId)
        .eq("chunk_index", i);
    }

    console.log(`  ✅ Generated ${embeddings.length} embeddings`);

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

console.log("🚀 RAG Worker v2 started");
console.log(`📍 Poll interval: ${POLL_INTERVAL}ms`);
console.log(`📦 Batch size: ${BATCH_SIZE}`);
console.log(`📄 Chunk size: ${CHUNK_SIZE}`);
console.log(`🔑 Formats: PDF, DOCX, XLSX, Images (OCR), TXT`);

setInterval(pollDocuments, POLL_INTERVAL);

// Initial poll immediately
pollDocuments();
