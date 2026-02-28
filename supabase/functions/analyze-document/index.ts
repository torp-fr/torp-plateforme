/**
 * Edge Function: analyze-document
 * Phase 41: Document Analysis Orchestration
 *
 * Responsibilities:
 * 1. Load file from Supabase Storage
 * 2. Detect: page count, extractable pages, OCR-requiring pages
 * 3. Estimate: embedding tokens, embedding cost, OCR cost
 * 4. Update ingestion_jobs with status='analyzed' and analyzed_at=now()
 * 5. Do NOT perform OCR or generate embeddings
 * 6. Log internal usage if LLM used
 * 7. Be idempotent and abort if job.status='cancelled'
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders, handleCors } from '../_shared/cors.ts';
import { trackLLMUsage, type LogRequest } from '../_shared/llm-usage-logger.ts';
import { validateTokens, countTokens } from '../_shared/token-counter.ts';

// ============================================================
// TYPES
// ============================================================

interface AnalyzeDocumentRequest {
  job_id: string; // UUID of ingestion_job
}

interface AnalysisResult {
  page_count: number;
  extractable_pages: number;
  ocr_pages: number;
  text_density: {
    high: number;      // Pages with 70%+ text
    medium: number;    // Pages with 40-70% text
    low: number;       // Pages with <40% text
  };
  page_details?: Array<{
    page_number: number;
    text_density: 'high' | 'medium' | 'low';
    has_images: boolean;
    has_tables: boolean;
  }>;
}

// ============================================================
// CONSTANTS
// ============================================================

const EMBEDDING_MODEL = 'text-embedding-3-small';
const EMBEDDING_PRICE_PER_MTK = 0.00002; // $0.02 per 1M tokens
const OCR_PRICE_PER_PAGE = 0.015;        // $0.015 per page for Vision API
const TOKENS_PER_PAGE_ESTIMATE = 250;    // Conservative estimate: 250 tokens per page

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
// HELPER: Load File from Supabase Storage
// ============================================================

async function loadFileFromStorage(
  supabase: any,
  filePath: string
): Promise<ArrayBuffer> {
  console.log(`[ANALYZE] Loading file from storage: ${filePath}`);

  try {
    const { data, error } = await supabase.storage
      .from('documents')
      .download(filePath);

    if (error) {
      throw new Error(`Storage download error: ${error.message}`);
    }

    if (!data) {
      throw new Error('No data returned from storage');
    }

    // Convert blob to ArrayBuffer
    return await data.arrayBuffer();
  } catch (err) {
    console.error('[ANALYZE] Storage load error:', err);
    throw err;
  }
}

// ============================================================
// HELPER: Extract PDF Metadata Using pdf-parse Library
// ============================================================

async function analyzePDFStructure(buffer: ArrayBuffer): Promise<AnalysisResult> {
  console.log('[ANALYZE] Analyzing PDF structure');

  // Dynamic import of pdfjs-dist for PDF analysis
  const pdfjsLib = await import('https://esm.sh/pdfjs-dist@4.0.0');

  const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(buffer) }).promise;
  const pageCount = pdf.numPages;

  console.log(`[ANALYZE] PDF has ${pageCount} pages`);

  let extractablePages = 0;
  let ocrPages = 0;
  const textDensity = { high: 0, medium: 0, low: 0 };
  const pageDetails: Array<{
    page_number: number;
    text_density: 'high' | 'medium' | 'low';
    has_images: boolean;
    has_tables: boolean;
  }> = [];

  // Analyze each page
  for (let i = 1; i <= Math.min(pageCount, 100); i++) {
    // Limit analysis to first 100 pages to avoid timeout
    try {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      const text = content.items.map((item: any) => item.str || '').join('');

      // Calculate text density
      const pageArea = (page.view[2] - page.view[0]) * (page.view[3] - page.view[1]);
      const textLength = text.length;
      const density = textLength / (pageArea / 100); // Rough estimate

      let densityLevel: 'high' | 'medium' | 'low';
      if (density > 0.7) {
        densityLevel = 'high';
        textDensity.high++;
        extractablePages++;
      } else if (density > 0.4) {
        densityLevel = 'medium';
        textDensity.medium++;
        extractablePages++;
      } else {
        densityLevel = 'low';
        textDensity.low++;
        ocrPages++;
      }

      pageDetails.push({
        page_number: i,
        text_density: densityLevel,
        has_images: content.items.some((item: any) => item.hasEOL === undefined),
        has_tables: text.includes('|') || text.split('\n').length > 20 // Heuristic
      });

      console.log(`[ANALYZE] Page ${i}: ${densityLevel} density (${textLength} chars)`);
    } catch (err) {
      console.warn(`[ANALYZE] Error analyzing page ${i}:`, err);
      ocrPages++;
      textDensity.low++;
    }
  }

  // If PDF has more than 100 pages, estimate the rest
  let estimatedOCRPages = ocrPages;
  if (pageCount > 100) {
    // Assume similar distribution for remaining pages
    const estimatedRatio = ocrPages / 100;
    estimatedOCRPages = Math.ceil(estimatedRatio * pageCount);
  }

  return {
    page_count: pageCount,
    extractable_pages: extractablePages,
    ocr_pages: estimatedOCRPages,
    text_density: {
      high: textDensity.high,
      medium: textDensity.medium,
      low: textDensity.low
    },
    page_details: pageDetails
  };
}

// ============================================================
// HELPER: Estimate Tokens and Costs
// ============================================================

function estimateTokensAndCosts(analysis: AnalysisResult): {
  estimated_embedding_tokens: number;
  estimated_embedding_cost: number;
  estimated_ocr_cost: number;
} {
  console.log('[ANALYZE] Estimating tokens and costs');

  // Estimate total tokens: TOKENS_PER_PAGE_ESTIMATE * extractable_pages
  const estimated_embedding_tokens = analysis.extractable_pages * TOKENS_PER_PAGE_ESTIMATE;

  // Estimate embedding cost: (tokens / 1_000_000) * price_per_1m_tokens
  const estimated_embedding_cost =
    (estimated_embedding_tokens / 1_000_000) * (EMBEDDING_PRICE_PER_MTK * 1_000_000);

  // Estimate OCR cost: ocr_pages * price_per_page
  const estimated_ocr_cost = analysis.ocr_pages * OCR_PRICE_PER_PAGE;

  console.log('[ANALYZE] Cost estimates:', {
    tokens: estimated_embedding_tokens,
    embedding_cost: estimated_embedding_cost,
    ocr_cost: estimated_ocr_cost
  });

  return {
    estimated_embedding_tokens,
    estimated_embedding_cost,
    estimated_ocr_cost
  };
}

// ============================================================
// MAIN HANDLER
// ============================================================

serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  const startTime = Date.now();

  try {
    console.log('[ANALYZE] Starting document analysis');

    // ============================================================
    // 1. PARSE REQUEST
    // ============================================================

    const { job_id } = (await req.json()) as AnalyzeDocumentRequest;

    if (!job_id || typeof job_id !== 'string') {
      return errorResponse('Missing or invalid job_id parameter');
    }

    console.log(`[ANALYZE] Processing job: ${job_id}`);

    // ============================================================
    // 2. CREATE SUPABASE CLIENT
    // ============================================================

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseServiceKey) {
      return errorResponse('Missing Supabase configuration', 500);
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

    console.log('[ANALYZE] Job loaded:', {
      id: job.id,
      status: job.status,
      file_path: job.file_path,
      file_size: job.file_size_bytes
    });

    // ============================================================
    // 4. CHECK IF JOB IS CANCELLED (ABORT)
    // ============================================================

    if (job.status === 'cancelled') {
      console.log('[ANALYZE] Job is cancelled - aborting');
      return errorResponse('Job has been cancelled', 400);
    }

    // ============================================================
    // 5. CHECK IDEMPOTENCY (ALREADY ANALYZED)
    // ============================================================

    if (job.status !== 'pending') {
      console.log('[ANALYZE] Job already processed - returning cached result');
      return successResponse({
        message: 'Job already analyzed',
        analysis_results: job.analysis_results,
        estimated_embedding_tokens: job.estimated_embedding_tokens,
        estimated_embedding_cost: job.estimated_embedding_cost,
        estimated_ocr_cost: job.estimated_ocr_cost
      });
    }

    // ============================================================
    // 6. LOAD FILE FROM STORAGE
    // ============================================================

    let fileBuffer: ArrayBuffer;
    try {
      fileBuffer = await loadFileFromStorage(supabase, job.file_path);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown storage error';
      console.error('[ANALYZE] Failed to load file:', errorMsg);

      // Update job with error
      await supabase
        .from('ingestion_jobs')
        .update({
          status: 'failed',
          error_message: `Storage load error: ${errorMsg}`,
          updated_at: new Date().toISOString()
        })
        .eq('id', job_id);

      return errorResponse(`Failed to load file: ${errorMsg}`, 500);
    }

    console.log(`[ANALYZE] File loaded: ${fileBuffer.byteLength} bytes`);

    // ============================================================
    // 7. ANALYZE PDF STRUCTURE
    // ============================================================

    let analysis: AnalysisResult;
    try {
      analysis = await analyzePDFStructure(fileBuffer);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown analysis error';
      console.error('[ANALYZE] PDF analysis failed:', errorMsg);

      // Update job with error
      await supabase
        .from('ingestion_jobs')
        .update({
          status: 'failed',
          error_message: `PDF analysis error: ${errorMsg}`,
          updated_at: new Date().toISOString()
        })
        .eq('id', job_id);

      return errorResponse(`PDF analysis failed: ${errorMsg}`, 500);
    }

    console.log('[ANALYZE] PDF analysis complete:', analysis);

    // ============================================================
    // 8. ESTIMATE TOKENS AND COSTS
    // ============================================================

    const { estimated_embedding_tokens, estimated_embedding_cost, estimated_ocr_cost } =
      estimateTokensAndCosts(analysis);

    // ============================================================
    // 9. UPDATE INGESTION JOB WITH ANALYSIS RESULTS
    // ============================================================

    const analyzed_at = new Date().toISOString();

    const { error: updateError } = await supabase
      .from('ingestion_jobs')
      .update({
        status: 'analyzed',
        analysis_results: analysis,
        estimated_embedding_tokens,
        estimated_embedding_cost,
        estimated_ocr_cost,
        analyzed_at,
        progress: 25, // Analysis is 25% of the pipeline
        updated_at: analyzed_at
      })
      .eq('id', job_id);

    if (updateError) {
      console.error('[ANALYZE] Failed to update job:', updateError);
      return errorResponse(`Failed to update job: ${updateError.message}`, 500);
    }

    console.log('[ANALYZE] Job updated successfully');

    // ============================================================
    // 10. LOG INTERNAL USAGE (No LLM used in this function)
    // ============================================================

    const latencyMs = Date.now() - startTime;
    console.log(`[ANALYZE] Analysis complete in ${latencyMs}ms`);

    // ============================================================
    // 11. RETURN SUCCESS RESPONSE
    // ============================================================

    return successResponse({
      job_id,
      status: 'analyzed',
      analysis_results: analysis,
      estimates: {
        embedding_tokens: estimated_embedding_tokens,
        embedding_cost: estimated_embedding_cost,
        ocr_cost: estimated_ocr_cost
      },
      latency_ms: latencyMs
    });
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : 'Unknown error';
    console.error('[ANALYZE] Unhandled error:', errorMsg);
    return errorResponse(`Internal error: ${errorMsg}`, 500);
  }
});
