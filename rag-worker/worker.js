import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";
import pdf from "pdf-parse";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

function chunkText(text, size = 1200) {
  const chunks = [];
  for (let i = 0; i < text.length; i += size) {
    chunks.push(text.slice(i, i + size));
  }
  return chunks;
}

async function processDocument(doc) {
  console.log("Processing:", doc.id);

  await supabase
    .from("knowledge_documents")
    .update({ ingestion_status: "processing" })
    .eq("id", doc.id);

  const { data } = await supabase.storage
    .from("knowledge-files")
    .download(doc.file_path);

  const buffer = Buffer.from(await data.arrayBuffer());

  const parsed = await pdf(buffer);
  const text = parsed.text;

  if (!text || text.length < 20) {
    throw new Error("No text extracted");
  }

  const chunks = chunkText(text);

  for (const chunk of chunks) {
    const embedding = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: chunk,
    });

    await supabase.from("knowledge_chunks").insert({
      document_id: doc.id,
      content: chunk,
      embedding: embedding.data[0].embedding,
    });
  }

  await supabase
    .from("knowledge_documents")
    .update({
      ingestion_status: "completed",
      ingestion_progress: 100,
    })
    .eq("id", doc.id);

  console.log("Completed:", doc.id);
}

async function run() {
  const { data: docs } = await supabase
    .from("knowledge_documents")
    .select("*")
    .eq("ingestion_status", "queued")
    .limit(5);

  for (const doc of docs) {
    try {
      await processDocument(doc);
    } catch (err) {
      console.error("ERROR:", err);
      await supabase
        .from("knowledge_documents")
        .update({ ingestion_status: "error" })
        .eq("id", doc.id);
    }
  }
}

setInterval(run, 10000);
