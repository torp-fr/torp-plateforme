/**
 * Job Service - Core layer for job lifecycle management
 * Handles job creation, status updates, and persistence
 * Phase 32.1: Async Orchestration & Job Queue Architecture
 */

import { supabase } from '@/lib/supabase';
import type { Database } from '@/types/supabase';
import { structuredLogger } from '@/services/observability/structured-logger';

type JobStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';

export interface AnalysisJob {
  id: string;
  user_id: string;
  project_id: string | null;
  devis_id: string | null;
  status: JobStatus;
  progress: number;
  error_message: string | null;
  result_snapshot_id: string | null;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
}

export interface CreateJobInput {
  user_id: string;
  project_id?: string;
  devis_id?: string;
}

/**
 * Job Service - Manages analysis job lifecycle
 * Respects Service Layer Enforcement architecture pattern
 */
export class JobService {
  /**
   * Create a new analysis job
   * Returns job with initial 'pending' status
   */
  async createJob(input: CreateJobInput): Promise<AnalysisJob> {
    console.log('[STEP 2] JobService.createJob() ENTERED');
    console.log('[STEP 2] createJob input:', {
      user_id: input.user_id,
      project_id: input.project_id,
      devis_id: input.devis_id,
    });

    console.log('[STEP 2] About to insert into analysis_jobs table');
    const insertStart = performance.now();

    const { data, error } = await supabase
      .from('analysis_jobs')
      .insert({
        user_id: input.user_id,
        project_id: input.project_id || null,
        devis_id: input.devis_id || null,
        status: 'pending',
        progress: 0,
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    const insertDuration = performance.now() - insertStart;
    console.log('[STEP 2] Insert completed in ms:', insertDuration.toFixed(0));

    if (error) {
      console.error('[STEP 2] createJob INSERT FAILED:', error);
      structuredLogger.error({
        service: 'JobService',
        method: 'createJob',
        message: 'Failed to create analysis job',
        error: error.message,
        userId: input.user_id,
        devisId: input.devis_id,
      });
      throw new Error(`Failed to create job: ${error.message}`);
    }

    console.log('[STEP 2] Job created successfully:', data.id);
    structuredLogger.info({
      service: 'JobService',
      method: 'createJob',
      message: 'Analysis job created',
      jobId: data.id,
      userId: input.user_id,
      status: 'pending',
    });

    return data as AnalysisJob;
  }

  /**
   * Get job by ID with RLS enforcement
   */
  async getJobById(jobId: string): Promise<AnalysisJob | null> {
    const { data, error } = await supabase
      .from('analysis_jobs')
      .select('*')
      .eq('id', jobId)
      .single();

    if (error && error.code !== 'PGRST116') {
      // PGRST116 = not found (expected case)
      structuredLogger.error({
        service: 'JobService',
        method: 'getJobById',
        message: 'Failed to fetch job',
        error: error.message,
        jobId,
      });
      throw new Error(`Failed to fetch job: ${error.message}`);
    }

    return data ? (data as AnalysisJob) : null;
  }

  /**
   * Get all jobs for a user
   */
  async getUserJobs(userId: string): Promise<AnalysisJob[]> {
    const { data, error } = await supabase
      .from('analysis_jobs')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      structuredLogger.error({
        service: 'JobService',
        method: 'getUserJobs',
        message: 'Failed to fetch user jobs',
        error: error.message,
        userId,
      });
      throw new Error(`Failed to fetch jobs: ${error.message}`);
    }

    return (data || []) as AnalysisJob[];
  }

  /**
   * Mark job as processing
   */
  async markProcessing(jobId: string): Promise<AnalysisJob> {
    const { data, error } = await supabase
      .from('analysis_jobs')
      .update({
        status: 'processing',
        started_at: new Date().toISOString(),
      })
      .eq('id', jobId)
      .select()
      .single();

    if (error) {
      structuredLogger.error({
        service: 'JobService',
        method: 'markProcessing',
        message: 'Failed to mark job as processing',
        error: error.message,
        jobId,
      });
      throw new Error(`Failed to update job: ${error.message}`);
    }

    structuredLogger.info({
      service: 'JobService',
      method: 'markProcessing',
      message: 'Job marked as processing',
      jobId,
    });

    return data as AnalysisJob;
  }

  /**
   * Update job progress (0-100)
   */
  async updateProgress(jobId: string, progress: number): Promise<void> {
    const clampedProgress = Math.max(0, Math.min(100, progress));

    const { error } = await supabase
      .from('analysis_jobs')
      .update({ progress: clampedProgress })
      .eq('id', jobId);

    if (error) {
      structuredLogger.warn({
        service: 'JobService',
        method: 'updateProgress',
        message: 'Failed to update job progress',
        error: error.message,
        jobId,
        progress: clampedProgress,
      });
      // Don't throw - progress update is non-critical
    }
  }

  /**
   * Mark job as completed
   */
  async markCompleted(jobId: string, resultSnapshotId?: string): Promise<AnalysisJob> {
    const { data, error } = await supabase
      .from('analysis_jobs')
      .update({
        status: 'completed',
        progress: 100,
        completed_at: new Date().toISOString(),
        result_snapshot_id: resultSnapshotId || null,
      })
      .eq('id', jobId)
      .select()
      .single();

    if (error) {
      structuredLogger.error({
        service: 'JobService',
        method: 'markCompleted',
        message: 'Failed to mark job as completed',
        error: error.message,
        jobId,
      });
      throw new Error(`Failed to complete job: ${error.message}`);
    }

    structuredLogger.info({
      service: 'JobService',
      method: 'markCompleted',
      message: 'Job marked as completed',
      jobId,
      duration: data.completed_at && data.started_at
        ? new Date(data.completed_at).getTime() - new Date(data.started_at).getTime()
        : undefined,
    });

    return data as AnalysisJob;
  }

  /**
   * Mark job as failed with error message
   */
  async markFailed(jobId: string, errorMessage: string): Promise<AnalysisJob> {
    const { data, error } = await supabase
      .from('analysis_jobs')
      .update({
        status: 'failed',
        error_message: errorMessage,
        completed_at: new Date().toISOString(),
      })
      .eq('id', jobId)
      .select()
      .single();

    if (error) {
      structuredLogger.error({
        service: 'JobService',
        method: 'markFailed',
        message: 'Failed to mark job as failed',
        error: error.message,
        jobId,
      });
      throw new Error(`Failed to fail job: ${error.message}`);
    }

    structuredLogger.error({
      service: 'JobService',
      method: 'markFailed',
      message: 'Job marked as failed',
      jobId,
      errorMessage,
    });

    return data as AnalysisJob;
  }

  /**
   * Cancel a job
   */
  async cancelJob(jobId: string): Promise<AnalysisJob> {
    const { data, error } = await supabase
      .from('analysis_jobs')
      .update({
        status: 'cancelled',
        completed_at: new Date().toISOString(),
      })
      .eq('id', jobId)
      .select()
      .single();

    if (error) {
      structuredLogger.error({
        service: 'JobService',
        method: 'cancelJob',
        message: 'Failed to cancel job',
        error: error.message,
        jobId,
      });
      throw new Error(`Failed to cancel job: ${error.message}`);
    }

    structuredLogger.info({
      service: 'JobService',
      method: 'cancelJob',
      message: 'Job cancelled',
      jobId,
    });

    return data as AnalysisJob;
  }

  /**
   * Get next pending job for processing
   * Used by worker to fetch jobs
   */
  async getNextPendingJob(): Promise<AnalysisJob | null> {
    const { data, error } = await supabase
      .from('analysis_jobs')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .limit(1)
      .single();

    if (error && error.code !== 'PGRST116') {
      structuredLogger.error({
        service: 'JobService',
        method: 'getNextPendingJob',
        message: 'Failed to fetch pending job',
        error: error.message,
      });
      return null;
    }

    return data ? (data as AnalysisJob) : null;
  }
}

/**
 * Singleton instance for application-wide use
 */
export const jobService = new JobService();
export default jobService;
