import { createClient } from "@supabase/supabase-js";
import { OpenAI } from "openai";
import pdf from "pdf-parse";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

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

async function extractText(arrayBuffer, mimeType) {
  try {
    const uint8Array = new Uint8Array(arrayBuffer);

    // Check for PDF header
    const header = String.fromCharCode(
      uint8Array[0],
      uint8Array[1],
      uint8Array[2],
      uint8Array[3]
    );

    if (header === "%PDF" || mimeType === "application/pdf") {
      console.log(`  📄 PDF detected - parsing...`);
      const buffer = Buffer.from(arrayBuffer);
      const pdfData = await pdf(buffer);
      return pdfData.text;
    }

    // Plain text
    console.log(`  📝 Text file detected`);
    return new TextDecoder().decode(uint8Array);
  } catch (error) {
    throw new Error(`Text extraction failed: ${error.message}`);
  }
}

function chunkText(text, chunkSize) {
  const chunks = [];
  for (let i = 0; i < text.length; i += chunkSize) {
    chunks.push({
      content: text.substring(i, i + chunkSize),
      tokenCount: Math.ceil(text.substring(i, i + chunkSize).length / 4),
    });
  }
  return chunks;
}

async function generateEmbedding(text) {
  try {
    const response = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: text,
    });

    const embedding = response.data[0].embedding;

    if (embedding.length !== EMBEDDING_DIMENSION) {
      throw new Error(
        `Embedding dimension mismatch: expected ${EMBEDDING_DIMENSION}, got ${embedding.length}`
      );
    }

    return embedding;
  } catch (error) {
    throw new Error(`Embedding generation failed: ${error.message}`);
  }
}

async function processDocument(doc) {
  const documentId = doc.id;
  console.log(`Processing: ${documentId}`);

  try {
    // Step 1: Claim document
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

    // Step 2: Download file
    console.log(`  📥 Downloading file...`);
    const arrayBuffer = await downloadFile(doc.file_path);

    // Step 3: Extract text
    console.log(`  🔍 Extracting text...`);
    const text = await extractText(arrayBuffer, doc.mime_type);
    console.log(`  ✅ Extracted ${text.length} characters`);

    // Step 4: Chunk text
    console.log(`  ✂️ Chunking text...`);
    const chunks = chunkText(text, CHUNK_SIZE);
    console.log(`  ✅ Created ${chunks.length} chunks`);

    // Step 5: Update progress
    await supabase
      .from("knowledge_documents")
      .update({
        ingestion_progress: 30,
      })
      .eq("id", documentId);

    // Step 6: Batch insert chunks
    console.log(`  📚 Inserting chunks...`);
    let insertedChunks = 0;

    for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
      const batch = chunks.slice(i, i + BATCH_SIZE);
      const payload = batch.map((chunk, batchIndex) => ({
        document_id: documentId,
        chunk_index: i + batchIndex,
        content: chunk.content,
        token_count: chunk.tokenCount,
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

    // Step 7: Generate embeddings
    console.log(`  🤖 Generating embeddings...`);
    let embeddedChunks = 0;
    let failedEmbeddings = 0;

    for (let i = 0; i < chunks.length; i++) {
      try {
        const embedding = await generateEmbedding(chunks[i].content);

        const { error: updateError } = await supabase
          .from("knowledge_chunks")
          .update({
            embedding,
            embedding_generated_at: new Date().toISOString(),
          })
          .eq("document_id", documentId)
          .eq("chunk_index", i);

        if (updateError) {
          throw new Error(`Failed to store embedding: ${updateError.message}`);
        }

        embeddedChunks++;
      } catch (error) {
        console.error(`    ❌ Embedding failed for chunk ${i}: ${error.message}`);
        failedEmbeddings++;
      }
    }

    console.log(`  ✅ Generated ${embeddedChunks} embeddings`);

    if (failedEmbeddings > 0) {
      throw new Error(
        `${failedEmbeddings} embeddings failed out of ${chunks.length}`
      );
    }

    // Step 8: Mark as completed
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

console.log("🚀 RAG Worker started");
console.log(`📍 Poll interval: ${POLL_INTERVAL}ms`);
console.log(`📦 Batch size: ${BATCH_SIZE}`);
console.log(`📄 Chunk size: ${CHUNK_SIZE}`);

setInterval(pollDocuments, POLL_INTERVAL);

// Initial poll immediately
pollDocuments();
