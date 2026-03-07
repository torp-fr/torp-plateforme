console.log("TEST RAG FILE LOADED")

import { createClient } from "@supabase/supabase-js"
import dotenv from "dotenv"

dotenv.config()

console.log("RAG TEST SCRIPT STARTED")

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function main() {
  console.log("MAIN FUNCTION RUNNING")

  const question = "Quel est le prix d'un poteau béton 30x30 ?"
  console.log("Question:", question)

  console.log("STEP 1: generating embedding")

  const { data: embedData, error: embedError } =
    await supabase.functions.invoke("generate-embedding", {
      body: {
        inputs: [question]
      }
    })

  if (embedError) {
    console.error("Embedding error:", embedError)
    return
  }

  const embedding = embedData.embeddings[0]
  console.log("Embedding length:", embedding.length)

  console.log("STEP 2: calling vector search")

  const { data: results, error: searchError } =
    await supabase.rpc("match_knowledge_chunks", {
      query_embedding: embedding,
      match_count: 5
    })

  if (searchError) {
    console.error("Search error:", searchError)
    return
  }

  console.log("STEP 3: printing results")
  console.log("\n=== RESULTS ===\n")

  if (!results || results.length === 0) {
    console.log("No results found.")
    return
  }

  results.forEach((r: any, i: number) => {
    console.log(`[${i + 1}] similarity: ${r.similarity}`)
    console.log("document:", r.document_id)
    console.log("content:\n", r.content)
    console.log("\n---------------------------\n")
  })

  console.log("SCRIPT COMPLETED")
}

main().catch(err => {
  console.error("SCRIPT FAILED:", err)
})
