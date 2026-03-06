#!/usr/bin/env node

import 'dotenv/config';
import { getSupabase } from '../src/lib/supabase.js';
import { generateEmbeddingsForChunks } from '../src/core/knowledge/ingestion/knowledgeEmbedding.service.js';

async function run() {
  const supabase = getSupabase();

  const { data: chunks, error } = await supabase
    .from('knowledge_chunks')
    .select('id, content')
    .is('embedding_vector', null);

  if (error) throw error;

  if (!chunks || chunks.length === 0) {
    console.log('BACKFILL COMPLETE — nothing to repair');
    return;
  }

  console.log('BACKFILL START', chunks.length);

  const pipelineChunks = chunks.map(c => ({
    content: c.content,
    tokenCount: Math.ceil(c.content.length / 4),
    startIndex: 0,
    endIndex: c.content.length,
  }));

  const embeddings = await generateEmbeddingsForChunks(pipelineChunks);

  if (!embeddings || embeddings.length === 0) {
    throw new Error('Embedding service returned zero results');
  }

  let written = 0;

  for (let i = 0; i < embeddings.length; i++) {
    const chunkId = chunks[i].id;
    const embedding = embeddings[i].embedding;

    const { error: updErr } = await supabase
      .from('knowledge_chunks')
      .update({ embedding_vector: embedding })
      .eq('id', chunkId);

    if (updErr) throw updErr;

    console.log('EMBEDDING WRITTEN', chunkId);
    written++;
  }

  console.log(`BACKFILL COMPLETE — ${written}/${chunks.length}`);
}

run().catch(err => {
  console.error('BACKFILL FAILED', err);
  process.exit(1);
});
