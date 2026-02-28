/**
 * Edge Function: cancel-ingestion
 * Phase 41: Graceful Ingestion Job Cancellation
 *
 * Responsibilities:
 * 1. Input: job_id (uuid)
 * 2. Update ingestion_jobs.status = 'cancelled'
 * 3. Set cancelled_at = now()
 * 4. Validate job exists and is cancellable
 * 5. Return success/error response
 *
 * Cancellation Flow:
 * - User requests cancellation
 * - Function updates status to 'cancelled'
 * - Running functions check status before major steps
 * - Running functions stop immediately on cancellation
 * - Already-processed data is preserved
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders, handleCors } from '../_shared/cors.ts';

// ============================================================
// TYPES
// ============================================================

interface CancelIngestionRequest {
  job_id: string; // UUID of ingestion_job to cancel
}

// ============================================================
// CONSTANTS
// ============================================================

const CANCELLABLE_STATUSES = [
  'pending',                // Not yet started
  'analyzed',               // Analysis complete, awaiting chunking
  'chunk_preview_ready',    // Chunks ready, awaiting embedding
  'extracting',             // Text extraction in progress
  'chunking',               // Chunking in progress
  'embedding'               // Embedding generation in progress
];

const FINAL_STATUSES = [
  'completed',              // Already finished successfully
  'failed',                 // Already failed
  'cancelled'               // Already cancelled
];

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
// MAIN HANDLER
// ============================================================

serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    console.log('[CANCEL-INGESTION] Starting cancellation request');

    // ============================================================
    // 1. PARSE REQUEST
    // ============================================================

    const { job_id } = (await req.json()) as CancelIngestionRequest;

    if (!job_id || typeof job_id !== 'string') {
      return errorResponse('Missing or invalid job_id parameter');
    }

    console.log(`[CANCEL-INGESTION] Processing cancellation for job: ${job_id}`);

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
      console.log(`[CANCEL-INGESTION] Job not found: ${jobError?.message || 'unknown error'}`);
      return errorResponse(`Job not found: ${jobError?.message || 'unknown error'}`, 404);
    }

    console.log('[CANCEL-INGESTION] Job loaded:', {
      id: job.id,
      status: job.status,
      created_at: job.created_at
    });

    // ============================================================
    // 4. VALIDATE JOB IS CANCELLABLE
    // ============================================================

    // Check if job is already in a final state
    if (FINAL_STATUSES.includes(job.status)) {
      console.log(`[CANCEL-INGESTION] Job is in final state: ${job.status}`);
      return errorResponse(
        `Cannot cancel job with status '${job.status}'. Job is already ${job.status}.`,
        400
      );
    }

    // Verify job status is cancellable
    if (!CANCELLABLE_STATUSES.includes(job.status)) {
      console.log(`[CANCEL-INGESTION] Job status not recognized: ${job.status}`);
      return errorResponse(
        `Job status '${job.status}' is not recognized`,
        400
      );
    }

    console.log(`[CANCEL-INGESTION] Job is cancellable (status: ${job.status})`);

    // ============================================================
    // 5. UPDATE JOB STATUS TO CANCELLED
    // ============================================================

    const cancelled_at = new Date().toISOString();

    const { error: updateError } = await supabase
      .from('ingestion_jobs')
      .update({
        status: 'cancelled',
        cancelled_at,
        updated_at: cancelled_at,
        error_message: 'Job cancelled by user request'
      })
      .eq('id', job_id);

    if (updateError) {
      console.error('[CANCEL-INGESTION] Failed to update job:', updateError);
      return errorResponse(
        `Failed to cancel job: ${updateError.message}`,
        500
      );
    }

    console.log('[CANCEL-INGESTION] Job status updated to cancelled');

    // ============================================================
    // 6. LOG CANCELLATION AUDIT TRAIL
    // ============================================================

    // Try to log the cancellation event (non-blocking)
    try {
      await supabase
        .from('ingestion_job_audit_log')
        .insert({
          job_id,
          old_status: job.status,
          new_status: 'cancelled',
          transition_reason: 'Cancelled by user request',
          error_message: 'User-initiated cancellation'
        });

      console.log('[CANCEL-INGESTION] Cancellation logged to audit trail');
    } catch (auditErr) {
      console.warn('[CANCEL-INGESTION] Warning: Failed to log audit trail:', auditErr);
      // Don't fail the cancellation due to audit log failure
    }

    // ============================================================
    // 7. RETURN SUCCESS RESPONSE
    // ============================================================

    console.log('[CANCEL-INGESTION] Cancellation complete');

    return successResponse({
      job_id,
      status: 'cancelled',
      previous_status: job.status,
      cancelled_at,
      message: 'Ingestion job cancelled successfully. Running operations will stop before their next major step.'
    });
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : 'Unknown error';
    console.error('[CANCEL-INGESTION] Unhandled error:', errorMsg);
    return errorResponse(`Internal error: ${errorMsg}`, 500);
  }
});
