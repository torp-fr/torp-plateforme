/**
 * Analysis Service - Refactored for async job queue
 * Handles async analysis requests using job orchestration
 * Phase 32.1: Async Orchestration & Job Queue Architecture
 */

import { supabase } from '@/lib/supabase';
import { jobService } from '@/core/jobs/job.service';
import { devisService } from '@/services/api/supabase/devis.service';
import { structuredLogger } from '@/services/observability/structured-logger';

export interface AnalysisRequest {
  userId: string;
  file: File;
  projectName: string;
  projectType?: string;
  budget?: string;
  surface?: number;
  description?: string;
  startDate?: string;
  urgency?: string;
  constraints?: string;
  userType?: 'B2C' | 'B2B' | 'B2G';
}

/**
 * Request analysis - async flow
 * 1. Upload devis file
 * 2. Create analysis job
 * 3. Return job ID for status tracking
 */
export async function requestAnalysis(request: AnalysisRequest): Promise<string> {
  const startTime = Date.now();

  try {
    structuredLogger.info({
      service: 'AnalysisService',
      method: 'requestAnalysis',
      message: 'Starting async analysis request',
      userId: request.userId,
      projectName: request.projectName,
    });

    // Step 1: Upload devis file
    structuredLogger.info({
      service: 'AnalysisService',
      message: 'Uploading devis file',
      userId: request.userId,
      fileName: request.file.name,
    });

    const devisResult = await devisService.uploadDevis(
      request.userId,
      request.file,
      request.projectName,
      {
        typeTravaux: request.projectType,
        budget: request.budget,
        surface: request.surface,
        description: request.description,
        delaiSouhaite: request.startDate,
        urgence: request.urgency,
        contraintes: request.constraints,
        userType: request.userType,
      }
    );

    structuredLogger.info({
      service: 'AnalysisService',
      message: 'Devis uploaded successfully',
      devisId: devisResult.id,
    });

    // Step 2: Create analysis job
    structuredLogger.info({
      service: 'AnalysisService',
      message: 'Creating analysis job',
      userId: request.userId,
      devisId: devisResult.id,
    });

    const job = await jobService.createJob({
      user_id: request.userId,
      devis_id: devisResult.id,
    });

    structuredLogger.info({
      service: 'AnalysisService',
      method: 'requestAnalysis',
      message: 'Analysis job created successfully',
      jobId: job.id,
      devisId: devisResult.id,
      duration: Date.now() - startTime,
    });

    // Step 3: Return job ID
    return job.id;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const duration = Date.now() - startTime;

    structuredLogger.error({
      service: 'AnalysisService',
      method: 'requestAnalysis',
      message: 'Failed to request analysis',
      error: errorMessage,
      userId: request.userId,
      duration,
    });

    throw error;
  }
}

/**
 * Get user's analysis jobs
 */
export async function getUserAnalysisJobs(userId: string) {
  try {
    return await jobService.getUserJobs(userId);
  } catch (error) {
    structuredLogger.error({
      service: 'AnalysisService',
      method: 'getUserAnalysisJobs',
      message: 'Failed to fetch user jobs',
      error: error instanceof Error ? error.message : String(error),
      userId,
    });
    throw error;
  }
}

/**
 * Get analysis job status
 */
export async function getAnalysisJobStatus(jobId: string) {
  try {
    const job = await jobService.getJobById(jobId);
    if (!job) {
      throw new Error('Job not found');
    }
    return job;
  } catch (error) {
    structuredLogger.error({
      service: 'AnalysisService',
      method: 'getAnalysisJobStatus',
      message: 'Failed to fetch job status',
      error: error instanceof Error ? error.message : String(error),
      jobId,
    });
    throw error;
  }
}

export const analysisService = {
  requestAnalysis,
  getUserAnalysisJobs,
  getAnalysisJobStatus,
};

export default analysisService;
