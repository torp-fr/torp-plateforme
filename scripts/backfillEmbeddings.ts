#!/usr/bin/env node

import 'dotenv/config';
import { getSupabase } from '@/lib/supabase';
import { generateEmbeddingsForChunks } from '@/core/knowledge/ingestion/knowledgeEmbedding.service';

async function run(): Promise<void> {
  const supabase = getSupabase();

  const { data: chunks, error } = await supabase
    .from('knowledge_chunks')
    .select('id, content')
    .is('embedding_vector', null);

  if (error) {
    throw new Error(`Failed to fetch chunks: ${error.message}`);
  }

  if (!chunks || chunks.length === 0) {
    console.log('BACKFILL COMPLETE — no chunks missing embeddings');
    return;
  }

  console.log('BACKFILL START', chunks.length);

  const knowledgeChunks = chunks.map((c) => ({
    content: c.content,
    tokenCount: Math.ceil(c.content.length / 4),
    startIndex: 0,
    endIndex: c.content.length,
  }));

  const embedResults = await generateEmbeddingsForChunks(knowledgeChunks);

  if (!embedResults || embedResults.length === 0) {
    throw new Error('Embedding service returned zero results');
  }

  const limit = Math.min(chunks.length, embedResults.length);
  let persisted = 0;

  for (let i = 0; i < limit; i++) {
    const chunkId = chunks[i].id;
    const embedding = embedResults[i].embedding;

    const { data, error: updErr } = await supabase
      .from('knowledge_chunks')
      .update({ embedding_vector: embedding })
      .eq('id', chunkId)
      .select('id');

    if (updErr) {
      throw new Error(`Embedding persist error for ${chunkId}: ${updErr.message}`);
    }

    if (!data || data.length === 0) {
      throw new Error(`Embedding update affected 0 rows for ${chunkId}`);
    }

    console.log('EMBEDDING WRITTEN', chunkId);
    persisted++;
  }

  console.log(`BACKFILL COMPLETE — ${persisted}/${chunks.length} embeddings written`);
}

run().catch((e) => {
  console.error('[BACKFILL FATAL]', e);
  process.exit(1);
});
