import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config()

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function run() {
  const payload = {
    title: "debug-node-test",
    category: "manuel",
    source: "ingestion",
    version: "1.0",
    file_size: 0,
    created_by: null
  }

  console.log("INSERT PAYLOAD:", payload)

  const { data, error } = await supabase
    .from("knowledge_documents")
    .insert([payload])
    .select()

  console.log("DATA:", data)
  console.log("ERROR:", error)
}

run()
