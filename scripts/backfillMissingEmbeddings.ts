#!/usr/bin/env node
/**
 * Backfill Embeddings for NULL chunks
 *
 * Regenerates embeddings for knowledge_chunks where embedding_vector IS NULL.
 * This is used when the ingestion pipeline fails to generate embeddings.
 *
 * Usage:
 *   npx ts-node scripts/backfillMissingEmbeddings.ts [documentId]
 *
 * Examples:
 *   npx ts-node scripts/backfillMissingEmbeddings.ts                    # Backfill all documents
 *   npx ts-node scripts/backfillMissingEmbeddings.ts <document-uuid>    # Backfill specific document
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

const BATCH_SIZE = 50; // Embeddings per Edge Function call
const EMBEDDING_MODEL = 'text-embedding-3-small';
const EMBEDDING_DIMENSIONS = 1536;

async function generateEmbeddingBatch(texts: string[]): Promise<number[][]> {
  console.log(`[BATCH] Generating ${texts.length} embeddings...`);

  const { data, error: fnError } = await supabase.functions.invoke(
    'generate-embedding',
    {
      body: {
        inputs: texts,
        model: EMBEDDING_MODEL,
        dimensions: EMBEDDING_DIMENSIONS,
      },
    }
  );

  if (fnError) {
    throw new Error(`Edge Function error: ${fnError.message}`);
  }

  if (!data?.embeddings || !Array.isArray(data.embeddings)) {
    throw new Error('Invalid Edge Function response — missing embeddings array');
  }

  if (data.embeddings.length !== texts.length) {
    throw new Error(
      `Embedding count mismatch: got ${data.embeddings.length}, expected ${texts.length}`
    );
  }

  return data.embeddings as number[][];
}

async function backfillEmbeddings(documentId?: string): Promise<number> {
  try {
    console.log('\n📊 Backfill Embeddings\n');
    console.log(
      '📝 Fetching chunks with NULL embedding_vector',
      documentId ? `for document ${documentId}...` : 'across all documents...'
    );

    // Fetch all chunks with NULL embedding_vector
    let query = supabase
      .from('knowledge_chunks')
      .select('id, document_id, content, chunk_index')
      .is('embedding_vector', null);

    if (documentId) {
      query = query.eq('document_id', documentId);
    }

    const { data: nullChunks, error: fetchError } = await query;

    if (fetchError) {
      throw new Error(`Failed to fetch NULL embedding chunks: ${fetchError.message}`);
    }

    if (!nullChunks || nullChunks.length === 0) {
      console.log('✅ No chunks with NULL embeddings found');
      return 0;
    }

    console.log(`\n📦 Found ${nullChunks.length} chunks with NULL embeddings\n`);

    let successCount = 0;
    const totalBatches = Math.ceil(nullChunks.length / BATCH_SIZE);

    for (let i = 0; i < nullChunks.length; i += BATCH_SIZE) {
      const batch = nullChunks.slice(i, i + BATCH_SIZE);
      const batchNum = Math.floor(i / BATCH_SIZE) + 1;

      try {
        console.log(`⏳ Batch ${batchNum}/${totalBatches}: ${batch.length} chunks`);

        const contents = batch.map((c: any) => c.content);
        const embeddings = await generateEmbeddingBatch(contents);

        if (!embeddings || embeddings.length !== batch.length) {
          console.error(`❌ Batch ${batchNum}: embedding count mismatch`);
          continue;
        }

        // Update each chunk with its embedding
        let batchSuccess = 0;
        for (let j = 0; j < batch.length; j++) {
          const chunk = batch[j];
          const embedding = embeddings[j];

          if (!embedding || embedding.length === 0) {
            console.error(`  ⚠️  Chunk ${chunk.id}: invalid embedding (skipped)`);
            continue;
          }

          const { error: updateError } = await supabase
            .from('knowledge_chunks')
            .update({ embedding_vector: embedding })
            .eq('id', chunk.id);

          if (updateError) {
            console.error(`  ⚠️  Chunk ${chunk.id}: update failed`);
          } else {
            batchSuccess++;
            successCount++;
          }
        }

        console.log(`✅ Batch ${batchNum}: ${batchSuccess}/${batch.length} updated\n`);
      } catch (batchError) {
        const msg = batchError instanceof Error ? batchError.message : String(batchError);
        console.error(`❌ Batch ${batchNum} failed: ${msg}\n`);
        // Continue with next batch
      }
    }

    console.log(`\n✨ Backfill complete: ${successCount}/${nullChunks.length} embeddings regenerated\n`);
    return successCount;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`\n❌ Backfill failed: ${msg}\n`);
    return 0;
  }
}

// Main
const documentId = process.argv[2] || undefined;
backfillEmbeddings(documentId)
  .then((count) => {
    process.exit(count > 0 ? 0 : 1);
  })
  .catch((err) => {
    console.error('❌ Fatal error:', err);
    process.exit(1);
  });
