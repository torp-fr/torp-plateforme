import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config()

console.log("TEST EMBEDDING SCRIPT")

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function run() {
  const { data, error } = await supabase.functions.invoke(
    'generate-embedding',
    {
      body: {
        inputs: ["test béton armé bâtiment"]
      }
    }
  )

  if (error) {
    console.error("Edge function error:", error)
    return
  }

  console.log("Edge function response:")
  console.log(JSON.stringify(data, null, 2))
}

run().catch(err => {
  console.error(err)
  process.exit(1)
})
