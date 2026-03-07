import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config()

console.log("RAG TEST SCRIPT STARTED")

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const question = "Quel est le prix d'un poteau béton 30x30 ?"

async function main() {
  console.log("Question:", question)
  console.log("Generating embedding...")

  const { data, error: fnErr } = await supabase.functions.invoke('generate-embedding', {
    body: { inputs: [question] }
  })

  if (fnErr) {
    console.error("Embedding error:", fnErr)
    return
  }

  if (!data?.embeddings?.[0]) {
    console.error("Embedding error: no embeddings returned", JSON.stringify(data))
    return
  }

  const embedding: number[] = data.embeddings[0]
  console.log("Embedding length:", embedding.length)

  console.log("Calling vector search...")

  const { data: chunks, error: rpcErr } = await supabase.rpc('match_knowledge_chunks', {
    query_embedding: embedding,
    match_count: 5
  })

  if (rpcErr) {
    console.error("Search error:", rpcErr)
    return
  }

  console.log("Printing results...")
  console.log("\n=== RESULTS ===\n")

  if (!chunks || chunks.length === 0) {
    console.log("No chunks retrieved.")
    return
  }

  chunks.forEach((chunk: { similarity: number; document_id: string; content: string }, i: number) => {
    console.log(`[${i + 1}] similarity: ${chunk.similarity.toFixed(4)}`)
    console.log(`document: ${chunk.document_id}`)
    console.log(`content: ${chunk.content}`)
    console.log()
  })
}

main().catch(console.error)
