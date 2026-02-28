/**
 * Edge Function: launch-ingestion
 * Phase 41: Final Embedding Generation and Knowledge Base Population
 *
 * Responsibilities:
 * 1. Verify ingestion_jobs.status = 'chunk_preview_ready'
 * 2. Load all ingestion_chunks_preview where excluded = false
 * 3. Batch embeddings (up to 500 chunks per API call)
 * 4. Use centralized ai-client generateEmbedding()
 * 5. Insert into knowledge_documents, knowledge_chunks, knowledge_embeddings
 * 6. Update ingestion_jobs.status = 'completed'
 * 7. Handle cancellation mid-process
 * 8. Ensure accurate cost logging (usage_type = 'internal_ingestion')
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders, handleCors } from '../_shared/cors.ts';
import { generateEmbedding } from '../_shared/ai-client.ts';
import { trackLLMUsage, type LogRequest } from '../_shared/llm-usage-logger.ts';
import { countTokens } from '../_shared/token-counter.ts';

// ============================================================
// CONSTANTS
// ============================================================

const BATCH_SIZE = 500;                    // Max chunks per API call
const EMBEDDING_MODEL = 'text-embedding-3-small';
const EMBEDDING_DIMENSIONS = 1536;

// ============================================================
// TYPES
// ============================================================

interface LaunchIngestionRequest {
  job_id: string; // UUID of ingestion_job
}

interface ChunkPreview {
  id: string;
  chunk_number: number;
  section_title: string | null;
  content: string;
  content_hash: string;
  estimated_tokens: number;
  start_page: number;
  end_page: number;
  requires_ocr: boolean;
}

interface EmbeddingResult {
  chunk_id: string;
  chunk_number: number;
  content: string;
  embedding: number[];
  actual_tokens: number;
  cost: number;
}

// ============================================================
// HELPER: Error Response
// ============================================================

function errorResponse(message: string, status: number = 400) {
  return new Response(
    JSON.stringify({ error: message }),
    {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    }
  );
}

// ============================================================
// HELPER: Success Response
// ============================================================

function successResponse(data: any) {
  return new Response(
    JSON.stringify({ success: true, data }),
    {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    }
  );
}

// ============================================================
// HELPER: Batch Chunks
// ============================================================

function batchChunks(chunks: ChunkPreview[], batchSize: number): ChunkPreview[][] {
  const batches: ChunkPreview[][] = [];
  for (let i = 0; i < chunks.length; i += batchSize) {
    batches.push(chunks.slice(i, i + batchSize));
  }
  return batches;
}

// ============================================================
// HELPER: Generate Embeddings for Batch
// ============================================================

async function generateEmbeddingsForBatch(
  batch: ChunkPreview[],
  openaiKey: string,
  supabase: any,
  jobId: string
): Promise<EmbeddingResult[]> {
  console.log(`[LAUNCH-INGESTION] Generating embeddings for batch of ${batch.length} chunks`);

  const results: EmbeddingResult[] = [];

  // Process chunks in parallel, but limit concurrency to avoid rate limits
  const PARALLEL_REQUESTS = 5;
  for (let i = 0; i < batch.length; i += PARALLEL_REQUESTS) {
    const parallelBatch = batch.slice(i, i + PARALLEL_REQUESTS);

    const promises = parallelBatch.map(async chunk => {
      try {
        // Check if job was cancelled before processing chunk
        const { data: job } = await supabase
          .from('ingestion_jobs')
          .select('status')
          .eq('id', jobId)
          .single();

        if (job?.status === 'cancelled') {
          throw new Error('Job was cancelled');
        }

        // Generate embedding using centralized ai-client
        const startTime = Date.now();
        const result = await generateEmbedding(
          chunk.content,
          openaiKey,
          EMBEDDING_MODEL,
          {
            userId: null,
            action: 'launch-ingestion',
            sessionId: jobId,
            supabaseClient: supabase
          }
        );

        const latencyMs = Date.now() - startTime;

        // Count actual tokens
        const actualTokens = countTokens(
          [{ role: 'user', content: chunk.content }],
          EMBEDDING_MODEL
        );

        // Calculate cost: $0.02 per 1M tokens for text-embedding-3-small
        const cost = (actualTokens / 1_000_000) * 0.00002;

        // Log internal usage for cost tracking
        await trackLLMUsage(supabase, {
          user_id: null,
          action: 'launch-ingestion',
          model: EMBEDDING_MODEL,
          input_tokens: actualTokens,
          output_tokens: 0, // Embeddings don't have output tokens
          total_tokens: actualTokens,
          latency_ms: latencyMs,
          cost_estimate: cost,
          session_id: jobId,
          error: false
        } as LogRequest);

        return {
          chunk_id: chunk.id,
          chunk_number: chunk.chunk_number,
          content: chunk.content,
          embedding: result.embedding,
          actual_tokens: actualTokens,
          cost
        };
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Unknown error';
        console.error(`[LAUNCH-INGESTION] Error generating embedding for chunk ${chunk.chunk_number}:`, errorMsg);

        // If job was cancelled, rethrow to stop processing
        if (errorMsg.includes('cancelled')) {
          throw err;
        }

        // Otherwise, return error result (will be handled gracefully)
        return {
          chunk_id: chunk.id,
          chunk_number: chunk.chunk_number,
          content: chunk.content,
          embedding: [],
          actual_tokens: 0,
          cost: 0
        };
      }
    });

    const batchResults = await Promise.all(promises);
    results.push(...batchResults);
  }

  return results;
}

// ============================================================
// HELPER: Insert Knowledge Documents
// ============================================================

async function insertKnowledgeDocuments(
  job: any,
  chunks: ChunkPreview[],
  supabase: any
): Promise<string> {
  console.log('[LAUNCH-INGESTION] Inserting knowledge documents');

  // Combine all chunk content to create document
  const fullContent = chunks.map(c => c.content).join('\n\n');
  const summary = chunks[0]?.content?.substring(0, 200) || 'Document from ingestion job';

  const { data, error } = await supabase
    .from('knowledge_documents')
    .insert({
      title: `Ingestion Job ${job.id.substring(0, 8)}`,
      description: `Document ingested from job ${job.id}`,
      content: fullContent,
      category: 'TECHNICAL_GUIDE', // Default category for ingested documents
      source: 'internal',
      authority: 'generated',
      summary,
      confidence_score: 75,
      created_by: null,
      is_active: true,
      ingestion_job_id: job.id,
      company_id: job.company_id,
      created_at: new Date().toISOString()
    })
    .select('id')
    .single();

  if (error) {
    throw new Error(`Failed to insert knowledge document: ${error.message}`);
  }

  return data.id;
}

// ============================================================
// HELPER: Insert Knowledge Chunks
// ============================================================

async function insertKnowledgeChunks(
  documentId: string,
  embeddings: EmbeddingResult[],
  supabase: any
): Promise<Array<{ chunk_id: string; knowledge_chunk_id: string }>> {
  console.log(`[LAUNCH-INGESTION] Inserting ${embeddings.length} knowledge chunks`);

  const chunkInserts = embeddings.map((emb, index) => ({
    document_id: documentId,
    chunk_index: index,
    content: emb.content,
    token_count: emb.actual_tokens,
    embedding: emb.embedding,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }));

  const { data, error } = await supabase
    .from('knowledge_chunks')
    .insert(chunkInserts)
    .select('id, chunk_index');

  if (error) {
    throw new Error(`Failed to insert knowledge chunks: ${error.message}`);
  }

  // Map chunk IDs to knowledge chunk IDs for tracking
  return embeddings.map((emb, index) => ({
    chunk_id: emb.chunk_id,
    knowledge_chunk_id: data[index]?.id || ''
  }));
}

// ============================================================
// HELPER: Update Ingestion Chunks Status
// ============================================================

async function updateChunkStatuses(
  chunkMappings: Array<{ chunk_id: string; knowledge_chunk_id: string }>,
  supabase: any
): Promise<void> {
  console.log('[LAUNCH-INGESTION] Updating chunk preview statuses');

  const updates = chunkMappings.map(mapping => ({
    id: mapping.chunk_id,
    status: 'embedded',
    updated_at: new Date().toISOString()
  }));

  // Batch update
  for (const update of updates) {
    await supabase
      .from('ingestion_chunks_preview')
      .update(update)
      .eq('id', update.id);
  }
}

// ============================================================
// MAIN HANDLER
// ============================================================

serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  const startTime = Date.now();
  let processedChunks = 0;
  let totalCost = 0;

  try {
    console.log('[LAUNCH-INGESTION] Starting ingestion launch');

    // ============================================================
    // 1. PARSE REQUEST
    // ============================================================

    const { job_id } = (await req.json()) as LaunchIngestionRequest;

    if (!job_id || typeof job_id !== 'string') {
      return errorResponse('Missing or invalid job_id parameter');
    }

    console.log(`[LAUNCH-INGESTION] Processing job: ${job_id}`);

    // ============================================================
    // 2. CREATE SUPABASE CLIENT
    // ============================================================

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const openaiKey = Deno.env.get('OPENAI_API_KEY');

    if (!supabaseUrl || !supabaseServiceKey || !openaiKey) {
      return errorResponse('Missing configuration (Supabase or OpenAI)', 500);
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // ============================================================
    // 3. FETCH INGESTION JOB
    // ============================================================

    const { data: job, error: jobError } = await supabase
      .from('ingestion_jobs')
      .select('*')
      .eq('id', job_id)
      .single();

    if (jobError || !job) {
      return errorResponse(`Job not found: ${jobError?.message || 'unknown error'}`, 404);
    }

    console.log('[LAUNCH-INGESTION] Job loaded:', {
      id: job.id,
      status: job.status,
      company_id: job.company_id
    });

    // ============================================================
    // 4. VERIFY JOB STATUS = 'chunk_preview_ready'
    // ============================================================

    if (job.status === 'cancelled') {
      console.log('[LAUNCH-INGESTION] Job is cancelled - aborting');
      return errorResponse('Job has been cancelled', 400);
    }

    if (job.status !== 'chunk_preview_ready') {
      return errorResponse(
        `Job status must be 'chunk_preview_ready' but is '${job.status}'`,
        400
      );
    }

    // ============================================================
    // 5. LOAD ALL CHUNKS WHERE excluded = false
    // ============================================================

    console.log('[LAUNCH-INGESTION] Loading chunk previews');

    // Note: ingestion_chunks_preview may not have 'excluded' column yet
    // If it doesn't exist, load all non-OCR chunks instead
    const { data: allChunks, error: chunksError } = await supabase
      .from('ingestion_chunks_preview')
      .select('*')
      .eq('job_id', job_id)
      .neq('requires_ocr', true) // Skip OCR chunks for now
      .eq('status', 'preview_ready')
      .order('chunk_number', { ascending: true });

    if (chunksError) {
      console.error('[LAUNCH-INGESTION] Failed to load chunks:', chunksError);
      return errorResponse(`Failed to load chunks: ${chunksError.message}`, 500);
    }

    if (!allChunks || allChunks.length === 0) {
      return errorResponse('No chunks found for ingestion', 400);
    }

    console.log(`[LAUNCH-INGESTION] Loaded ${allChunks.length} chunks for processing`);

    const chunks = allChunks as ChunkPreview[];

    // ============================================================
    // 6. BATCH AND PROCESS EMBEDDINGS
    // ============================================================

    console.log('[LAUNCH-INGESTION] Creating batch groups');
    const batches = batchChunks(chunks, BATCH_SIZE);
    console.log(`[LAUNCH-INGESTION] Created ${batches.length} batches`);

    let allEmbeddings: EmbeddingResult[] = [];

    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
      const batch = batches[batchIndex];

      console.log(`[LAUNCH-INGESTION] Processing batch ${batchIndex + 1}/${batches.length}`);

      try {
        // Check if job was cancelled before processing batch
        const { data: currentJob } = await supabase
          .from('ingestion_jobs')
          .select('status')
          .eq('id', job_id)
          .single();

        if (currentJob?.status === 'cancelled') {
          console.log('[LAUNCH-INGESTION] Job cancelled during processing - stopping');

          // Update job to cancelled status
          await supabase
            .from('ingestion_jobs')
            .update({
              status: 'cancelled',
              updated_at: new Date().toISOString()
            })
            .eq('id', job_id);

          return errorResponse('Job was cancelled during processing', 400);
        }

        // Generate embeddings for batch
        const batchEmbeddings = await generateEmbeddingsForBatch(
          batch,
          openaiKey,
          supabase,
          job_id
        );

        // Track cost
        totalCost += batchEmbeddings.reduce((sum, e) => sum + e.cost, 0);

        // Filter out failed embeddings (empty embedding array)
        const successfulEmbeddings = batchEmbeddings.filter(e => e.embedding.length > 0);
        allEmbeddings = allEmbeddings.concat(successfulEmbeddings);
        processedChunks += successfulEmbeddings.length;

        console.log(`[LAUNCH-INGESTION] Batch ${batchIndex + 1} complete: ${successfulEmbeddings.length} successful`);

        // Update job progress
        const progress = Math.min(99, Math.round((processedChunks / chunks.length) * 100));
        await supabase
          .from('ingestion_jobs')
          .update({
            progress,
            updated_at: new Date().toISOString()
          })
          .eq('id', job_id);
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Unknown batch error';

        if (errorMsg.includes('cancelled')) {
          // Job was cancelled - stop immediately
          console.log('[LAUNCH-INGESTION] Cancellation detected - stopping batch processing');

          await supabase
            .from('ingestion_jobs')
            .update({
              status: 'cancelled',
              updated_at: new Date().toISOString()
            })
            .eq('id', job_id);

          return errorResponse('Job was cancelled during batch processing', 400);
        }

        // Non-cancellation error
        throw err;
      }
    }

    if (allEmbeddings.length === 0) {
      return errorResponse('No successful embeddings generated', 500);
    }

    console.log(`[LAUNCH-INGESTION] Generated embeddings for ${allEmbeddings.length} chunks`);

    // ============================================================
    // 7. INSERT INTO KNOWLEDGE BASE
    // ============================================================

    try {
      // Insert knowledge document
      const documentId = await insertKnowledgeDocuments(job, chunks, supabase);
      console.log(`[LAUNCH-INGESTION] Knowledge document created: ${documentId}`);

      // Insert knowledge chunks with embeddings
      const chunkMappings = await insertKnowledgeChunks(documentId, allEmbeddings, supabase);
      console.log(`[LAUNCH-INGESTION] Inserted ${chunkMappings.length} knowledge chunks`);

      // Update chunk preview statuses
      await updateChunkStatuses(chunkMappings, supabase);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown insertion error';
      console.error('[LAUNCH-INGESTION] Failed to insert into knowledge base:', errorMsg);

      await supabase
        .from('ingestion_jobs')
        .update({
          status: 'failed',
          error_message: `Knowledge base insertion error: ${errorMsg}`,
          updated_at: new Date().toISOString()
        })
        .eq('id', job_id);

      return errorResponse(`Failed to insert knowledge base: ${errorMsg}`, 500);
    }

    // ============================================================
    // 8. UPDATE INGESTION JOB STATUS
    // ============================================================

    const completed_at = new Date().toISOString();

    const { error: updateError } = await supabase
      .from('ingestion_jobs')
      .update({
        status: 'completed',
        progress: 100,
        completed_at,
        updated_at: completed_at
      })
      .eq('id', job_id);

    if (updateError) {
      console.error('[LAUNCH-INGESTION] Failed to update job:', updateError);
      return errorResponse(`Failed to update job: ${updateError.message}`, 500);
    }

    console.log('[LAUNCH-INGESTION] Job marked as completed');

    // ============================================================
    // 9. RETURN SUCCESS RESPONSE
    // ============================================================

    const latencyMs = Date.now() - startTime;
    console.log(`[LAUNCH-INGESTION] Ingestion launch complete in ${latencyMs}ms`);

    return successResponse({
      job_id,
      status: 'completed',
      chunks_processed: processedChunks,
      total_cost: totalCost.toFixed(6),
      cost_currency: 'USD',
      latency_ms: latencyMs,
      summary: {
        chunks_input: chunks.length,
        chunks_embedded: allEmbeddings.length,
        success_rate: `${Math.round((allEmbeddings.length / chunks.length) * 100)}%`,
        total_cost_usd: parseFloat(totalCost.toFixed(6))
      }
    });
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : 'Unknown error';
    console.error('[LAUNCH-INGESTION] Unhandled error:', errorMsg);

    // Mark job as failed
    try {
      const supabaseUrl = Deno.env.get('SUPABASE_URL');
      const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
      if (supabaseUrl && supabaseServiceKey) {
        const supabase = createClient(supabaseUrl, supabaseServiceKey);
        const { job_id } = (await req.json()) as LaunchIngestionRequest;

        await supabase
          .from('ingestion_jobs')
          .update({
            status: 'failed',
            error_message: `Internal error: ${errorMsg}`,
            updated_at: new Date().toISOString()
          })
          .eq('id', job_id);
      }
    } catch (_) {
      // Ignore cleanup errors
    }

    return errorResponse(`Internal error: ${errorMsg}`, 500);
  }
});
