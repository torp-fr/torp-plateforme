/**
 * Edge Function: create-ingestion-job (PHASE 44)
 * Complete PDF-to-Knowledge workflow
 *
 * Responsibilities:
 * 1. Create ingestion_job record
 * 2. Get public URL for PDF file
 * 3. Call external PDF extractor microservice
 * 4. Split text into chunks (1200 chars)
 * 5. Generate embeddings for each chunk
 * 6. Insert knowledge_document and knowledge_chunks
 * 7. Mark job as completed
 * 8. Cost guard: max 0.10 USD per job
 *
 * Architecture:
 * - PDF extraction: External Node.js microservice (pdf-extractor-service)
 * - Chunking: 1200 char chunks with overlap
 * - Embeddings: OpenAI text-embedding-3-small
 * - Storage: knowledge_documents + knowledge_chunks
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders, handleCors } from '../_shared/cors.ts';

// ============================================================
// CONSTANTS
// ============================================================

const CHUNK_SIZE = 1200;
const CHUNK_OVERLAP = 200;
const EMBEDDING_MODEL = 'text-embedding-3-small';
const EMBEDDING_DIMENSIONS = 1536;
const MAX_COST = 0.10; // USD per job
const COST_PER_1K_TOKENS = 0.00002; // text-embedding-3-small pricing

// ============================================================
// TYPES
// ============================================================

interface CreateIngestionJobRequest {
  file_name: string;
  file_path: string;
  file_size_bytes: number;
}

interface CreateIngestionJobResponse {
  success: boolean;
  job_id?: string;
  error?: string;
  message?: string;
}

interface PdfExtractionResult {
  success: boolean;
  text?: string;
  pages?: number;
  error?: string;
}

interface EmbeddingResponse {
  data: Array<{ embedding: number[] }>;
  usage: { prompt_tokens: number };
}

// ============================================================
// RESPONSE HELPERS
// ============================================================

function successResponse(jobId: string): Response {
  return new Response(
    JSON.stringify({
      success: true,
      job_id: jobId,
      message: 'Ingestion job created and completed',
    } as CreateIngestionJobResponse),
    {
      status: 201,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    }
  );
}

function errorResponse(message: string, status: number = 400): Response {
  return new Response(
    JSON.stringify({
      success: false,
      error: message,
    } as CreateIngestionJobResponse),
    {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    }
  );
}

// ============================================================
// HELPER: Estimate tokens (rough approximation)
// ============================================================

function estimateTokens(text: string): number {
  // Rough estimate: 1 token ≈ 4 characters
  return Math.ceil(text.length / 4);
}

// ============================================================
// HELPER: Split text into chunks
// ============================================================

function chunkText(text: string, chunkSize: number = CHUNK_SIZE, overlap: number = CHUNK_OVERLAP): string[] {
  if (!text || text.length === 0) return [];

  const chunks: string[] = [];
  let startIndex = 0;

  while (startIndex < text.length) {
    const endIndex = Math.min(startIndex + chunkSize, text.length);
    chunks.push(text.slice(startIndex, endIndex).trim());

    // Move start position by (chunkSize - overlap)
    startIndex = endIndex - overlap;

    // Prevent infinite loop for small overlaps
    if (startIndex >= text.length - overlap) break;
  }

  return chunks.filter(chunk => chunk.length > 0);
}

// ============================================================
// HELPER: Generate embeddings for chunks
// ============================================================

async function generateEmbeddings(chunks: string[], openaiKey: string): Promise<{
  embeddings: number[][];
  totalTokens: number;
  cost: number;
} | null> {
  try {
    console.log(`[CREATE-INGESTION] Generating embeddings for ${chunks.length} chunks`);

    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: EMBEDDING_MODEL,
        input: chunks,
        encoding_format: 'float',
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('[CREATE-INGESTION] OpenAI API error:', errorData);
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = (await response.json()) as EmbeddingResponse;

    if (!data.data || data.data.length === 0) {
      throw new Error('No embeddings returned from OpenAI');
    }

    const totalTokens = data.usage?.prompt_tokens || 0;
    const cost = (totalTokens / 1000) * COST_PER_1K_TOKENS;

    console.log(`[CREATE-INGESTION] Embeddings generated: ${chunks.length} chunks, ${totalTokens} tokens, $${cost.toFixed(4)}`);

    if (cost > MAX_COST) {
      throw new Error(`Cost guard exceeded: $${cost.toFixed(4)} > $${MAX_COST}`);
    }

    const embeddings = data.data.map((item) => item.embedding);

    return {
      embeddings,
      totalTokens,
      cost,
    };
  } catch (error) {
    console.error('[CREATE-INGESTION] Embedding generation failed:', error);
    return null;
  }
}

// ============================================================
// HELPER: Extract PDF text via microservice
// ============================================================

async function extractPdfText(fileUrl: string, extractorUrl: string): Promise<string | null> {
  try {
    console.log(`[CREATE-INGESTION] Calling PDF extractor: ${extractorUrl}`);

    const response = await fetch(`${extractorUrl}/extract`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ file_url: fileUrl }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('[CREATE-INGESTION] PDF extractor error:', errorData);
      throw new Error(`PDF extraction failed: ${response.status}`);
    }

    const data = (await response.json()) as PdfExtractionResult;

    if (!data.success || !data.text) {
      throw new Error(data.error || 'PDF extraction returned no text');
    }

    console.log(`[CREATE-INGESTION] PDF extracted: ${data.text.length} chars, ${data.pages} pages`);

    return data.text;
  } catch (error) {
    console.error('[CREATE-INGESTION] PDF extraction error:', error);
    return null;
  }
}

// ============================================================
// MAIN HANDLER
// ============================================================

serve(async (req: Request) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return handleCors(req);
  }

  try {
    // Only allow POST
    if (req.method !== 'POST') {
      return errorResponse('Method not allowed', 405);
    }

    // Parse request body
    const body = (await req.json()) as CreateIngestionJobRequest;

    // Validate required fields
    if (!body.file_name || !body.file_path || body.file_size_bytes === undefined) {
      return errorResponse('Missing required fields: file_name, file_path, file_size_bytes');
    }

    // Validate file_size is positive
    if (body.file_size_bytes <= 0) {
      return errorResponse('file_size_bytes must be positive', 400);
    }

    // Get environment variables
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    const openaiKey = Deno.env.get('OPENAI_API_KEY') || '';
    const pdfExtractorUrl = Deno.env.get('PDF_EXTRACTOR_URL') || '';

    if (!supabaseUrl || !supabaseServiceKey || !openaiKey || !pdfExtractorUrl) {
      console.error('[CREATE-INGESTION] Missing environment configuration');
      return errorResponse('Server configuration error', 500);
    }

    // Initialize Supabase client
    const authHeader = req.headers.get('Authorization') || '';
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      global: {
        headers: { Authorization: authHeader },
      },
    });

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return errorResponse('Unauthorized', 401);
    }

    // Get user's company
    const { data: userCompany, error: companyError } = await supabase
      .from('user_company')
      .select('company_id')
      .eq('user_id', user.id)
      .single();

    if (companyError || !userCompany) {
      return errorResponse('User company not found', 403);
    }

    // ============================================================
    // STEP 1: Create ingestion_job record
    // ============================================================

    console.log('[CREATE-INGESTION] Creating ingestion job...');

    const { data: job, error: jobError } = await supabase
      .from('ingestion_jobs')
      .insert({
        company_id: userCompany.company_id,
        user_id: user.id,
        file_path: body.file_path,
        file_size_bytes: body.file_size_bytes,
        status: 'processing',
        progress: 0,
      })
      .select('id')
      .single();

    if (jobError || !job) {
      console.error('[CREATE-INGESTION] Job creation failed:', jobError);
      return errorResponse('Failed to create ingestion job', 500);
    }

    const jobId = job.id;
    console.log(`[CREATE-INGESTION] Job created: ${jobId}`);

    // ============================================================
    // STEP 2: Get public URL for file
    // ============================================================

    console.log('[CREATE-INGESTION] Getting public URL for file...');

    const { data: publicUrlData } = supabase.storage
      .from('knowledge-files')
      .getPublicUrl(body.file_path);

    const publicUrl = publicUrlData.publicUrl;
    console.log(`[CREATE-INGESTION] Public URL: ${publicUrl}`);

    // ============================================================
    // STEP 3: Extract PDF text
    // ============================================================

    console.log('[CREATE-INGESTION] Extracting PDF text...');

    const extractedText = await extractPdfText(publicUrl, pdfExtractorUrl);

    if (!extractedText || extractedText.trim().length === 0) {
      console.error('[CREATE-INGESTION] PDF extraction failed or returned empty text');

      await supabase
        .from('ingestion_jobs')
        .update({ status: 'failed', error: 'PDF extraction failed' })
        .eq('id', jobId);

      return errorResponse('Failed to extract PDF text', 400);
    }

    // ============================================================
    // STEP 4: Create knowledge_document
    // ============================================================

    console.log('[CREATE-INGESTION] Creating knowledge document...');

    const { data: doc, error: docError } = await supabase
      .from('knowledge_documents')
      .insert({
        title: body.file_name.replace(/\.[^/.]+$/, ''),
        description: `Document from ingestion job ${jobId.substring(0, 8)}`,
        content: extractedText,
        category: 'TECHNICAL_GUIDE',
        source: 'internal',
        authority: 'generated',
        summary: extractedText.substring(0, 200),
        is_active: true,
        ingestion_job_id: jobId,
      })
      .select('id')
      .single();

    if (docError || !doc) {
      console.error('[CREATE-INGESTION] Document creation failed:', docError);

      await supabase
        .from('ingestion_jobs')
        .update({ status: 'failed', error: 'Document creation failed' })
        .eq('id', jobId);

      return errorResponse('Failed to create knowledge document', 500);
    }

    const documentId = doc.id;
    console.log(`[CREATE-INGESTION] Document created: ${documentId}`);

    // ============================================================
    // STEP 5: Split text into chunks
    // ============================================================

    console.log('[CREATE-INGESTION] Chunking text...');

    const chunks = chunkText(extractedText, CHUNK_SIZE, CHUNK_OVERLAP);
    console.log(`[CREATE-INGESTION] Created ${chunks.length} chunks`);

    if (chunks.length === 0) {
      console.error('[CREATE-INGESTION] No chunks created');

      await supabase
        .from('ingestion_jobs')
        .update({ status: 'failed', error: 'No chunks created' })
        .eq('id', jobId);

      return errorResponse('Failed to create chunks', 400);
    }

    // ============================================================
    // STEP 6: Generate embeddings
    // ============================================================

    console.log('[CREATE-INGESTION] Generating embeddings...');

    const embeddingResult = await generateEmbeddings(chunks, openaiKey);

    if (!embeddingResult) {
      console.error('[CREATE-INGESTION] Embedding generation failed');

      await supabase
        .from('ingestion_jobs')
        .update({ status: 'failed', error: 'Embedding generation failed' })
        .eq('id', jobId);

      return errorResponse('Failed to generate embeddings', 500);
    }

    // ============================================================
    // STEP 7: Insert knowledge_chunks
    // ============================================================

    console.log('[CREATE-INGESTION] Inserting chunks...');

    const chunkInserts = chunks.map((content, index) => ({
      document_id: documentId,
      chunk_index: index,
      content,
      token_count: estimateTokens(content),
      embedding: embeddingResult.embeddings[index],
      embedding_status: 'embedded',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }));

    // Batch insert in groups of 100
    const BATCH_SIZE = 100;
    let insertedCount = 0;

    for (let i = 0; i < chunkInserts.length; i += BATCH_SIZE) {
      const batch = chunkInserts.slice(i, i + BATCH_SIZE);
      const { error: batchError } = await supabase
        .from('knowledge_chunks')
        .insert(batch);

      if (batchError) {
        console.error('[CREATE-INGESTION] Batch insert failed:', batchError);

        await supabase
          .from('ingestion_jobs')
          .update({ status: 'failed', error: `Chunk insert failed at batch ${Math.floor(i / BATCH_SIZE)}` })
          .eq('id', jobId);

        return errorResponse('Failed to insert chunks', 500);
      }

      insertedCount += batch.length;
      console.log(`[CREATE-INGESTION] Inserted batch ${Math.floor(i / BATCH_SIZE) + 1}: ${batch.length} chunks`);
    }

    // ============================================================
    // STEP 8: Mark job as completed
    // ============================================================

    console.log('[CREATE-INGESTION] Marking job as completed...');

    const { error: updateError } = await supabase
      .from('ingestion_jobs')
      .update({
        status: 'completed',
        progress: 100,
        completed_at: new Date().toISOString(),
      })
      .eq('id', jobId);

    if (updateError) {
      console.error('[CREATE-INGESTION] Job update failed:', updateError);
      return errorResponse('Failed to complete job', 500);
    }

    console.log('[CREATE-INGESTION] ✅ Ingestion completed successfully', {
      job_id: jobId,
      document_id: documentId,
      chunks: chunks.length,
      tokens: embeddingResult.totalTokens,
      cost: `$${embeddingResult.cost.toFixed(4)}`,
    });

    return successResponse(jobId);
  } catch (error) {
    console.error('[CREATE-INGESTION] ❌ Error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return errorResponse(message, 500);
  }
});
