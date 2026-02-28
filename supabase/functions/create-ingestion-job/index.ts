/**
 * Edge Function: create-ingestion-job
 * Step 1 of 3-step ingestion pipeline
 *
 * Responsibilities:
 * - Create ingestion_job record in database
 * - Validate user and company
 * - Set status = 'uploaded'
 *
 * The 3-step pipeline:
 * 1. create-ingestion-job (THIS) → Create job record
 * 2. analyze-document → Extract PDF text, fill knowledge_documents
 * 3. launch-ingestion → Chunking, embeddings, insert knowledge_chunks
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders, handleCors } from '../_shared/cors.ts';

// ============================================================
// CONSTANTS
// ============================================================

const JOB_STATUS_UPLOADED = 'uploaded';

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

    if (!supabaseUrl || !supabaseServiceKey) {
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
        file_name: body.file_name,
        status: JOB_STATUS_UPLOADED,
        progress: 0,
      })
      .select('id')
      .single();

    if (jobError || !job) {
      console.error('[CREATE-INGESTION] Job creation failed:', jobError);
      return errorResponse('Failed to create ingestion job', 500);
    }

    const jobId = job.id;
    console.log(`[CREATE-INGESTION] ✅ Job created: ${jobId}`);

    return successResponse(jobId);
  } catch (error) {
    console.error('[CREATE-INGESTION] ❌ Error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return errorResponse(message, 500);
  }
});
