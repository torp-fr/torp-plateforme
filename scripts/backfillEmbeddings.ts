import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config()

console.log("Backfill embeddings started")

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const PAGE_SIZE = 100

async function generateEmbeddings(texts: string[]) {
  const { data, error } = await supabase.functions.invoke(
    'generate-embedding',
    {
      body: {
        inputs: texts
      }
    }
  )

  if (error) {
    console.error("Edge function error:", error)
    throw error
  }

  console.log("EDGE RAW RESPONSE:", JSON.stringify(data).slice(0,200))

  let embeddings = null

  if (data?.embeddings) {
    embeddings = data.embeddings
  } else if (data?.data?.embeddings) {
    embeddings = data.data.embeddings
  }

  if (!embeddings) {
    console.error("Embeddings missing in response")
    return []
  }

  console.log("Embeddings returned:", embeddings.length)

  return embeddings
}

async function run() {
  let from = 0
  let processed = 0
  let written = 0

  while (true) {
    const { data, error } = await supabase
      .from('knowledge_chunks')
      .select('id, content')
      .is('embedding_vector', null)
      .range(from, from + PAGE_SIZE - 1)

    if (error) throw error
    if (!data || data.length === 0) break

    console.log(`Processing ${data.length} chunks`)

    const texts = data.map(d => d.content)
    const embeddings = await generateEmbeddings(texts)

    for (let i = 0; i < data.length; i++) {
      const vec = embeddings[i]
      if (!vec || vec.length === 0) continue

      const literal = `[${vec.join(',')}]`

      const { error: updErr } = await supabase
        .from('knowledge_chunks')
        .update({ embedding_vector: literal })
        .eq('id', data[i].id)

      if (updErr) {
        console.warn("Update failed:", updErr)
        continue
      }

      written++
    }

    processed += data.length
    from += PAGE_SIZE
  }

  console.log("Chunks processed:", processed)
  console.log("Embeddings written:", written)
}

run().catch(err => {
  console.error(err)
  process.exit(1)
})
