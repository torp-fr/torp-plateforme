/**
 * Edge Function: create-ingestion-job
 * Phase 42: Automated document ingestion job creation
 *
 * Responsibilities:
 * 1. Receive: file_name, file_path, file_size_bytes
 * 2. Create ingestion_jobs record with status = 'uploaded'
 * 3. Return job_id for subsequent operations
 * 4. Fast operation (<100ms)
 * 5. Admin-only access
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders, handleCors } from '../_shared/cors.ts';

// ============================================================
// TYPES
// ============================================================

interface CreateIngestionJobRequest {
  file_name: string;        // Original filename
  file_path: string;        // Storage path (documents/...)
  file_size_bytes: number;  // File size in bytes
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
      message: 'Ingestion job created successfully',
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
    const body = await req.json() as CreateIngestionJobRequest;

    // Validate required fields
    if (!body.file_name || !body.file_path || body.file_size_bytes === undefined) {
      return errorResponse('Missing required fields: file_name, file_path, file_size_bytes');
    }

    // Validate file_size is positive
    if (body.file_size_bytes <= 0) {
      return errorResponse('file_size_bytes must be positive', 400);
    }

    // Initialize Supabase client
    const authHeader = req.headers.get('Authorization') || '';
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') || '',
      Deno.env.get('SUPABASE_ANON_KEY') || '',
      {
        global: {
          headers: { Authorization: authHeader },
        },
      }
    );

    // Get authenticated user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

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

    // Create ingestion_job record
    const { data: job, error: jobError } = await supabase
      .from('ingestion_jobs')
      .insert({
        company_id: userCompany.company_id,
        user_id: user.id,
        file_path: body.file_path,
        file_size_bytes: body.file_size_bytes,
        status: 'uploaded',
        progress: 0,
      })
      .select('id')
      .single();

    if (jobError || !job) {
      console.error('[CREATE-INGESTION-JOB] Database error:', jobError);
      return errorResponse('Failed to create ingestion job', 500);
    }

    console.log('[CREATE-INGESTION-JOB] ✅ Job created:', {
      job_id: job.id,
      file_name: body.file_name,
      file_size_bytes: body.file_size_bytes,
      company_id: userCompany.company_id,
    });

    return successResponse(job.id);
  } catch (error) {
    console.error('[CREATE-INGESTION-JOB] ❌ Error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return errorResponse(message, 500);
  }
});
