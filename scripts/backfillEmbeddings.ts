import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config()

console.log("NUCLEAR EMBEDDING BACKFILL STARTED")

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function run() {
  const { data: chunks, error } = await supabase
    .from('knowledge_chunks')
    .select('id, content')
    .is('embedding_vector', null)

  if (error) throw error

  if (!chunks || chunks.length === 0) {
    console.log("No chunks require embeddings")
    return
  }

  console.log(`Chunks needing embeddings: ${chunks.length}`)

  const texts = chunks.map(c => c.content)

  const { data, error: fnErr } = await supabase.functions.invoke(
    'generate-embedding',
    {
      body: { inputs: texts }
    }
  )

  if (fnErr) throw fnErr

  if (!data || !data.embeddings) {
    throw new Error("Edge function did not return embeddings")
  }

  const embeddings = data.embeddings

  console.log(`Embeddings generated: ${embeddings.length}`)

  let written = 0

  for (let i = 0; i < chunks.length; i++) {
    const vec = embeddings[i]
    if (!vec) continue

    const literal = `[${vec.join(',')}]`

    const { error: updErr } = await supabase
      .from('knowledge_chunks')
      .update({
        embedding_vector: literal
      })
      .eq('id', chunks[i].id)

    if (!updErr) written++
  }

  console.log("Embeddings written:", written)
}

run().catch(err => {
  console.error(err)
  process.exit(1)
})
