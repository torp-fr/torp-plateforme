console.log("Backfill embeddings started")

import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
dotenv.config()

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const PAGE_SIZE = 100

async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  const { data, error } = await supabase.functions.invoke('generate-embedding', {
    body: {
      inputs: texts,
      model: "text-embedding-3-small",
      dimensions: 1536
    }
  })
  if (error) {
    console.error("Embedding generation failed:", error)
    throw error
  }
  return data
}

async function run() {
  let from = 0
  let totalProcessed = 0
  let totalWritten = 0

  while (true) {
    const { data, error } = await supabase
      .from('knowledge_chunks')
      .select('id, content')
      .is('embedding_vector', null)
      .range(from, from + PAGE_SIZE - 1)

    if (error) throw error
    if (!data || data.length === 0) {
      console.log("No more chunks to process.")
      break
    }

    totalProcessed += data.length
    console.log(`Processing ${data.length} chunks (total so far: ${totalProcessed})`)

    const texts = data.map(d => d.content)
    const embeddings = await generateEmbeddings(texts)

    for (let i = 0; i < data.length; i++) {
      const vec = embeddings[i]
      if (!vec) {
        console.warn(`No embedding returned for chunk id=${data[i].id}, skipping.`)
        continue
      }

      const literal = `[${vec.join(',')}]`

      const { error: updErr } = await supabase
        .from('knowledge_chunks')
        .update({ embedding_vector: literal })
        .eq('id', data[i].id)

      if (updErr) {
        console.warn(`Update failed for chunk id=${data[i].id}:`, updErr)
      } else {
        totalWritten++
      }
    }

    from += PAGE_SIZE
  }

  console.log(`Chunks processed: ${totalProcessed}`)
  console.log(`Embeddings written: ${totalWritten}`)
}

run().catch(err => {
  console.error(err)
  process.exit(1)
})
