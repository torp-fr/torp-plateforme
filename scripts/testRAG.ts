import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

console.log("RAG retrieval test started");

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {

  const question = "Quel est le prix d'un poteau béton 30x30 ?";

  console.log("\nQuestion:");
  console.log(question);

  // 1️⃣ Generate embedding for the question
  const { data: embedData, error: embedError } =
    await supabase.functions.invoke("generate-embedding", {
      body: {
        inputs: [question],
      },
    });

  if (embedError) {
    console.error("Embedding error:", embedError);
    return;
  }

  const embedding = embedData.embeddings[0];

  console.log("\nEmbedding generated (length):", embedding.length);

  // 2️⃣ Call vector search function
  const { data: results, error: searchError } = await supabase.rpc(
    "match_knowledge_chunks",
    {
      query_embedding: embedding,
      match_count: 5,
    }
  );

  if (searchError) {
    console.error("Search error:", searchError);
    return;
  }

  console.log("\n=== RESULTS ===\n");

  if (!results || results.length === 0) {
    console.log("No results found.");
    return;
  }

  results.forEach((r: any, i: number) => {
    console.log(`[${i + 1}] similarity: ${r.similarity.toFixed(3)}`);
    console.log("document:", r.document_id);
    console.log("content:\n", r.content);
    console.log("\n-----------------------------\n");
  });
}

main().catch(console.error);
