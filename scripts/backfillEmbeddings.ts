import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const PAGE_SIZE = 100;

async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  const { data, error } = await supabase.functions.invoke('generate-embedding', {
    body: {
      inputs: texts,
      model: 'text-embedding-3-small',
    },
  });

  if (error) throw error;

  return data.embeddings as number[][];
}

async function run(): Promise<void> {
  console.log('Starting embedding backfill');

  let from      = 0;
  let processed = 0;

  while (true) {
    // SELECT chunks where embedding_vector IS NULL (paginated)
    const { data, error } = await supabase
      .from('knowledge_chunks')
      .select('id, content')
      .is('embedding_vector', null)
      .range(from, from + PAGE_SIZE - 1);

    if (error) throw error;
    if (!data || data.length === 0) break;

    console.log(`Processing ${data.length} chunks (offset ${from})`);

    // Generate embeddings for this page
    let embeddings: number[][];
    try {
      embeddings = await generateEmbeddings(data.map((c) => c.content));
    } catch (err) {
      console.warn('Embedding generation failed for batch at offset', from, err);
      from += PAGE_SIZE;
      continue;  // non-fatal: skip batch, keep going
    }

    // Persist each vector as a Postgres literal '[x,y,z,...]'
    for (let i = 0; i < data.length; i++) {
      const vec = embeddings[i];

      if (!vec || vec.length === 0) {
        console.warn('Empty embedding', data[i].id);
        continue;
      }

      const vectorLiteral = `[${vec.join(',')}]`;

      const { error: updErr } = await supabase
        .from('knowledge_chunks')
        .update({ embedding_vector: vectorLiteral })
        .eq('id', data[i].id);

      if (updErr) {
        console.warn('Failed chunk', data[i].id, updErr.message);
        continue;
      }

      processed++;
    }

    from += PAGE_SIZE;
    if (data.length < PAGE_SIZE) break;  // last page
  }

  console.log('Backfill complete');
  console.log('Embeddings written:', processed);
}

run().catch((err) => {
  console.error('BACKFILL FAILED', err);
  process.exit(1);
});
