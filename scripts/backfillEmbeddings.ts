console.log("Backfill script booting...");

import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const PAGE_SIZE = 100;

async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  const { data, error } = await supabase.functions.invoke("generate-embedding", {
    body: {
      inputs: texts,
      model: "text-embedding-3-small"
    }
  });
  if (error) {
    console.error("Embedding generation failed:", error);
    throw error;
  }
  return data.embeddings;
}

async function main() {
  let from = 0;
  let written = 0;

  while (true) {
    const { data, error } = await supabase
      .from("knowledge_chunks")
      .select("id, content")
      .is("embedding_vector", null)
      .range(from, from + PAGE_SIZE - 1);

    if (error) {
      console.error("DB fetch failed:", error);
      throw error;
    }
    if (!data || data.length === 0) break;

    console.log(`Found ${data.length} chunks without embeddings`);
    console.log("Generating embeddings...");

    let embeddings: number[][];
    try {
      embeddings = await generateEmbeddings(data.map(c => c.content));
    } catch (err) {
      console.warn("Batch embedding failed, skipping batch");
      from += PAGE_SIZE;
      continue;
    }

    for (let i = 0; i < data.length; i++) {
      const vec = embeddings[i];
      if (!vec || vec.length === 0) {
        console.warn("Empty embedding for chunk:", data[i].id);
        continue;
      }
      const vectorLiteral = `[${vec.join(",")}]`;
      const { error: updErr } = await supabase
        .from("knowledge_chunks")
        .update({ embedding_vector: vectorLiteral })
        .eq("id", data[i].id);
      if (updErr) {
        console.warn("Update failed:", data[i].id, updErr.message);
        continue;
      }
      written++;
    }

    from += PAGE_SIZE;
    if (data.length < PAGE_SIZE) break;
  }

  console.log("Embeddings written:", written);
  console.log("Done.");
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
