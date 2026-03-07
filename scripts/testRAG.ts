import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config()

console.log("RAG retrieval test started")

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const question = "Quel est le prix d'un poteau béton 30x30 ?"

async function main() {
  console.log("\n=== RAG TEST ===")
  console.log(`Question: ${question}`)

  // Step 1: Generate embedding via Edge Function
  const { data, error: fnErr } = await supabase.functions.invoke('generate-embedding', {
    body: { inputs: [question] }
  })

  if (fnErr) throw new Error(`Edge function error: ${fnErr.message}`)
  if (!data?.embeddings?.[0]) throw new Error("Edge function did not return embeddings")

  const embedding: number[] = data.embeddings[0]
  console.log(`\nEmbedding generated (${embedding.length} dimensions)`)

  // Step 2: Call match_knowledge_chunks RPC
  const { data: chunks, error: rpcErr } = await supabase.rpc('match_knowledge_chunks', {
    query_embedding: embedding,
    match_count: 5
  })

  if (rpcErr) throw new Error(`RPC error: ${rpcErr.message}`)
  if (!chunks || chunks.length === 0) {
    console.log("No chunks retrieved.")
    return
  }

  // Step 3: Print results
  console.log("\nResults:")
  chunks.forEach((chunk: { similarity: number; document_id: string; content: string }, i: number) => {
    console.log(`\n[${i + 1}] similarity: ${chunk.similarity.toFixed(4)}`)
    console.log(`document: ${chunk.document_id}`)
    console.log(`content:\n${chunk.content}`)
  })
}

main().catch(console.error)
