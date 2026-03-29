#!/usr/bin/env node
/**
 * Backfill Embeddings for NULL chunks
 *
 * Regenerates embeddings for knowledge_chunks where embedding_vector IS NULL.
 * This is used when the ingestion pipeline fails to generate embeddings.
 *
 * Stabilized with:
 * - Reduced batch size (20 chunks per request)
 * - Retry logic with exponential backoff
 * - Delay between batches to prevent Edge Function timeouts
 * - Detailed error logging
 * - Partial progress tracking
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

// ─────────────────────────────────────────────────────────────────────────
// Configuration for stable Edge Function calls
// ─────────────────────────────────────────────────────────────────────────

const BATCH_SIZE = 20; // Reduced from 50 to avoid Edge Function timeouts
const DELAY_BETWEEN_BATCHES = 1200; // 1.2 seconds between batches
const MAX_RETRIES = 3; // Retry failed batches up to 3 times
const EMBEDDING_MODEL = 'text-embedding-3-small';
const EMBEDDING_DIMENSIONS = 384; // Match current database schema (vector(384))

// ─────────────────────────────────────────────────────────────────────────
// Statistics tracking
// ─────────────────────────────────────────────────────────────────────────

interface BackfillStats {
  totalChunks: number;
  totalBatches: number;
  successfulBatches: number;
  failedBatches: number;
  embeddingsGenerated: number;
  embeddingsFailed: number;
  databaseUpdatesFailed: number;
  startTime: number;
  endTime?: number;
}

// ─────────────────────────────────────────────────────────────────────────
// Retry wrapper with exponential backoff
// ─────────────────────────────────────────────────────────────────────────

async function runWithRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = MAX_RETRIES,
  retryCount: number = 0
): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    if (retryCount >= maxRetries) {
      throw err;
    }

    const delayMs = 2000 * Math.pow(2, retryCount); // Exponential backoff: 2s, 4s, 8s
    const remainingRetries = maxRetries - retryCount;

    console.warn(
      `[RETRY] Attempt ${retryCount + 1}/${maxRetries} failed. ` +
      `Retrying in ${delayMs}ms... (${remainingRetries} retries remaining)`
    );

    await new Promise((resolve) => setTimeout(resolve, delayMs));
    return runWithRetry(fn, maxRetries, retryCount + 1);
  }
}

// ─────────────────────────────────────────────────────────────────────────
// Delay helper
// ─────────────────────────────────────────────────────────────────────────

async function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ─────────────────────────────────────────────────────────────────────────
// Edge Function call with detailed error reporting
// ─────────────────────────────────────────────────────────────────────────

async function generateEmbeddingBatch(texts: string[]): Promise<number[][]> {
  console.log(`  → Calling Edge Function for ${texts.length} texts...`);

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
    const errorDetails = {
      message: fnError.message,
      status: (fnError as any).status,
      details: (fnError as any).details,
    };
    console.error(`  [BATCH ERROR] Edge Function failed:`, errorDetails);
    throw new Error(`Edge Function error: ${fnError.message}`);
  }

  if (!data?.embeddings || !Array.isArray(data.embeddings)) {
    console.error(`  [BATCH ERROR] Invalid response structure:`, {
      hasEmbeddings: !!data?.embeddings,
      isArray: Array.isArray(data?.embeddings),
      responseKeys: Object.keys(data || {}),
    });
    throw new Error('Invalid Edge Function response — missing embeddings array');
  }

  if (data.embeddings.length !== texts.length) {
    console.error(`  [BATCH ERROR] Embedding count mismatch:`, {
      sent: texts.length,
      received: data.embeddings.length,
    });
    throw new Error(
      `Embedding count mismatch: got ${data.embeddings.length}, expected ${texts.length}`
    );
  }

  console.log(`  ✓ Received ${data.embeddings.length} embeddings`);
  return data.embeddings as number[][];
}

// ─────────────────────────────────────────────────────────────────────────
// Main backfill function
// ─────────────────────────────────────────────────────────────────────────

async function backfillEmbeddings(documentId?: string): Promise<BackfillStats> {
  const stats: BackfillStats = {
    totalChunks: 0,
    totalBatches: 0,
    successfulBatches: 0,
    failedBatches: 0,
    embeddingsGenerated: 0,
    embeddingsFailed: 0,
    databaseUpdatesFailed: 0,
    startTime: Date.now(),
  };

  try {
    console.log('\n═══════════════════════════════════════════════════════════════════');
    console.log('📊 Backfill Embeddings for NULL Chunks');
    console.log('═══════════════════════════════════════════════════════════════════\n');

    console.log(
      '📝 Configuration:',
      `batch_size=${BATCH_SIZE}, max_retries=${MAX_RETRIES}, delay=${DELAY_BETWEEN_BATCHES}ms`
    );

    console.log(
      '\n📥 Fetching chunks with NULL embedding_vector',
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
      console.log('✅ No chunks with NULL embeddings found\n');
      stats.endTime = Date.now();
      return stats;
    }

    stats.totalChunks = nullChunks.length;
    stats.totalBatches = Math.ceil(nullChunks.length / BATCH_SIZE);

    console.log(`\n📦 Found ${nullChunks.length} chunks in ${stats.totalBatches} batches\n`);
    console.log('─────────────────────────────────────────────────────────────────────\n');

    // Process batches with retry logic and delays
    for (let i = 0; i < nullChunks.length; i += BATCH_SIZE) {
      const batch = nullChunks.slice(i, i + BATCH_SIZE);
      const batchNum = Math.floor(i / BATCH_SIZE) + 1;

      console.log(`⏳ Batch ${batchNum}/${stats.totalBatches}: ${batch.length} chunks`);

      try {
        const contents = batch.map((c: any) => c.content);

        // Call Edge Function with retry logic
        const embeddings = await runWithRetry(
          () => generateEmbeddingBatch(contents),
          MAX_RETRIES
        );

        if (!embeddings || embeddings.length !== batch.length) {
          console.error(`❌ Batch ${batchNum}: embedding count mismatch`);
          stats.failedBatches++;
          stats.embeddingsFailed += batch.length;
          console.log('');
          continue;
        }

        // Update each chunk with its embedding
        let batchSuccess = 0;
        for (let j = 0; j < batch.length; j++) {
          const chunk = batch[j];
          const embedding = embeddings[j];

          if (!embedding || embedding.length === 0) {
            console.error(`  ⚠️  Chunk ${chunk.id}: invalid embedding (skipped)`);
            stats.embeddingsFailed++;
            continue;
          }

          const { error: updateError } = await supabase
            .from('knowledge_chunks')
            .update({ embedding_vector: embedding })
            .eq('id', chunk.id);

          if (updateError) {
            console.error(
              `  ⚠️  Chunk ${chunk.id}: database update failed — ${updateError.message}`
            );
            stats.databaseUpdatesFailed++;
          } else {
            batchSuccess++;
            stats.embeddingsGenerated++;
          }
        }

        console.log(`✅ Batch ${batchNum}: ${batchSuccess}/${batch.length} updated`);
        stats.successfulBatches++;

        // Delay before next batch (except for the last batch)
        if (i + BATCH_SIZE < nullChunks.length) {
          console.log(`⏸️  Waiting ${DELAY_BETWEEN_BATCHES}ms before next batch...\n`);
          await delay(DELAY_BETWEEN_BATCHES);
        } else {
          console.log('');
        }
      } catch (batchError) {
        const errorMsg =
          batchError instanceof Error ? batchError.message : String(batchError);
        const errorStack = batchError instanceof Error ? batchError.stack : undefined;

        console.error(`❌ Batch ${batchNum} failed after retries`);
        console.error(`   Message: ${errorMsg}`);
        if (errorStack) {
          console.error(`   Stack: ${errorStack}`);
        }

        stats.failedBatches++;
        stats.embeddingsFailed += batch.length;
        console.log('');

        // Continue with next batch instead of aborting
      }
    }

    stats.endTime = Date.now();

    // Print summary
    console.log('═══════════════════════════════════════════════════════════════════');
    console.log('📊 Backfill Summary\n');
    console.log(`Total chunks processed:        ${stats.totalChunks}`);
    console.log(`Total batches:                 ${stats.totalBatches}`);
    console.log(`Successful batches:            ${stats.successfulBatches}`);
    console.log(`Failed batches:                ${stats.failedBatches}`);
    console.log(`Embeddings generated:          ${stats.embeddingsGenerated}`);
    console.log(`Embeddings failed:             ${stats.embeddingsFailed}`);
    console.log(`Database updates failed:       ${stats.databaseUpdatesFailed}`);
    console.log(
      `Duration:                      ${((stats.endTime - stats.startTime) / 1000).toFixed(1)}s`
    );

    if (stats.embeddingsGenerated === stats.totalChunks) {
      console.log('\n✨ SUCCESS: All chunks have embeddings!\n');
    } else {
      console.log(
        `\n⚠️  Partial success: ${stats.embeddingsGenerated}/${stats.totalChunks} chunks embedded\n`
      );
    }

    console.log('═══════════════════════════════════════════════════════════════════\n');

    return stats;
  } catch (err) {
    stats.endTime = Date.now();
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`\n❌ Fatal error: ${msg}\n`);
    return stats;
  }
}

// ─────────────────────────────────────────────────────────────────────────
// Main entry point
// ─────────────────────────────────────────────────────────────────────────

const documentId = process.argv[2] || undefined;

backfillEmbeddings(documentId).then((stats) => {
  // Exit with success if any embeddings were generated
  const success = stats.embeddingsGenerated > 0;
  process.exit(success ? 0 : 1);
});
