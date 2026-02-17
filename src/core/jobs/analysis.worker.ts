/**
 * Analysis Worker - Async job processor
 * Processes pending analysis jobs from the queue
 * Phase 32.1: Async Orchestration & Job Queue Architecture
 */

import { supabase } from '@/lib/supabase';
import { jobService } from './job.service';
import { torpAnalyzerService } from '@/services/ai/torp-analyzer.service';
import { structuredLogger } from '@/services/observability/structured-logger';
import { errorTracking } from '@/services/observability/error-tracking';
import { pdfExtractorService } from '@/services/pdf/pdf-extractor.service';

interface ProcessJobOptions {
  maxRetries?: number;
  timeout?: number;
}

/**
 * Process a single analysis job
 * Fetches devis, extracts text, runs TORP analysis, saves results
 */
export async function processAnalysisJob(
  jobId: string,
  options: ProcessJobOptions = {}
): Promise<void> {
  const { timeout = 300000 } = options; // 5 minutes default
  const startTime = Date.now();

  try {
    // Fetch job
    const job = await jobService.getJobById(jobId);
    if (!job) {
      throw new Error(`Job ${jobId} not found`);
    }

    // Mark as processing
    await jobService.markProcessing(jobId);
    structuredLogger.info({
      service: 'AnalysisWorker',
      method: 'processAnalysisJob',
      message: 'Starting analysis job processing',
      jobId,
      userId: job.user_id,
      devisId: job.devis_id,
    });

    // Fetch devis data
    if (!job.devis_id) {
      throw new Error('Job missing devis_id');
    }

    const { data: devisData, error: devisError } = await supabase
      .from('devis')
      .select('*')
      .eq('id', job.devis_id)
      .single();

    if (devisError || !devisData) {
      throw new Error(`Failed to fetch devis: ${devisError?.message}`);
    }

    // Update progress
    await jobService.updateProgress(jobId, 10);

    // Download PDF from storage
    structuredLogger.info({
      service: 'AnalysisWorker',
      message: 'Downloading PDF from storage',
      jobId,
      filePath: devisData.file_url,
    });

    const filePath = new URL(devisData.file_url).pathname.split('/').slice(-3).join('/');
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('devis-uploads')
      .download(filePath);

    if (downloadError || !fileData) {
      throw new Error(`Failed to download devis file: ${downloadError?.message}`);
    }

    await jobService.updateProgress(jobId, 25);

    // Extract text from PDF
    structuredLogger.info({
      service: 'AnalysisWorker',
      message: 'Extracting text from PDF',
      jobId,
    });

    const devisFile = new File([fileData], devisData.file_name, { type: 'application/pdf' });
    const devisText = await pdfExtractorService.extractText(devisFile);

    await jobService.updateProgress(jobId, 40);

    // Run TORP analysis
    structuredLogger.info({
      service: 'AnalysisWorker',
      message: 'Running TORP analysis',
      jobId,
    });

    const metadata = {
      nom: devisData.nom_projet,
      typeTravaux: devisData.type_travaux,
      budget: devisData.montant_total?.toString(),
      userType: 'B2B' as const, // Determine from context if available
    };

    const analysisResult = await torpAnalyzerService.analyzeDevis(devisText, metadata as any);

    await jobService.updateProgress(jobId, 85);

    // Save analysis results back to devis table
    structuredLogger.info({
      service: 'AnalysisWorker',
      message: 'Saving analysis results',
      jobId,
      score: analysisResult.scoreGlobal,
      grade: analysisResult.grade,
    });

    const { error: updateError } = await supabase
      .from('devis')
      .update({
        status: 'analyzed',
        analyzed_at: new Date().toISOString(),
        analysis_duration: Math.round((Date.now() - startTime) / 1000),
        score_total: analysisResult.scoreGlobal,
        grade: analysisResult.grade,
        score_entreprise: analysisResult.scoreEntreprise,
        score_prix: analysisResult.scorePrix,
        score_completude: analysisResult.scoreCompletude,
        score_conformite: analysisResult.scoreConformite,
        score_delais: analysisResult.scoreDelais,
        score_innovation_durable: analysisResult.scoreInnovationDurable || null,
        score_transparence: analysisResult.scoreTransparence || null,
        recommendations: analysisResult.recommandations,
        extracted_data: analysisResult.extractedData || null,
        detected_overcosts: analysisResult.surcoutsDetectes,
        potential_savings: analysisResult.scorePrix?.economiesPotentielles || 0,
        updated_at: new Date().toISOString(),
      })
      .eq('id', job.devis_id);

    if (updateError) {
      throw new Error(`Failed to save analysis results: ${updateError.message}`);
    }

    await jobService.updateProgress(jobId, 100);

    // Mark job as completed
    await jobService.markCompleted(jobId, job.devis_id);

    const duration = Date.now() - startTime;
    structuredLogger.info({
      service: 'AnalysisWorker',
      method: 'processAnalysisJob',
      message: 'Analysis job completed successfully',
      jobId,
      devisId: job.devis_id,
      duration,
      score: analysisResult.scoreGlobal,
      grade: analysisResult.grade,
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);

    structuredLogger.error({
      service: 'AnalysisWorker',
      method: 'processAnalysisJob',
      message: 'Analysis job failed',
      jobId,
      error: errorMessage,
      duration,
    });

    // Track error
    errorTracking.captureException(error, {
      context: 'analysis_worker',
      jobId,
    });

    // Mark job as failed
    try {
      await jobService.markFailed(jobId, errorMessage);
    } catch (failError) {
      structuredLogger.error({
        service: 'AnalysisWorker',
        message: 'Failed to mark job as failed',
        jobId,
        error: failError instanceof Error ? failError.message : String(failError),
      });
    }

    throw error;
  }
}

/**
 * Process next pending job from queue
 * Called by Edge Function or scheduled task
 */
export async function processNextPendingJob(
  options: ProcessJobOptions = {}
): Promise<{ success: boolean; jobId?: string; error?: string }> {
  try {
    structuredLogger.info({
      service: 'AnalysisWorker',
      message: 'Polling for next pending job',
    });

    const job = await jobService.getNextPendingJob();
    if (!job) {
      structuredLogger.debug({
        service: 'AnalysisWorker',
        message: 'No pending jobs found',
      });
      return { success: true };
    }

    structuredLogger.info({
      service: 'AnalysisWorker',
      message: 'Found pending job to process',
      jobId: job.id,
    });

    await processAnalysisJob(job.id, options);
    return { success: true, jobId: job.id };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    structuredLogger.error({
      service: 'AnalysisWorker',
      method: 'processNextPendingJob',
      message: 'Error processing next pending job',
      error: errorMessage,
    });
    return { success: false, error: errorMessage };
  }
}

/**
 * Continuous job processor - processes jobs in sequence
 * Used for testing or single-threaded execution
 */
export async function runJobProcessor(options: ProcessJobOptions = {}): Promise<void> {
  structuredLogger.info({
    service: 'AnalysisWorker',
    message: 'Starting job processor loop',
  });

  try {
    while (true) {
      const result = await processNextPendingJob(options);

      if (!result.success) {
        structuredLogger.warn({
          service: 'AnalysisWorker',
          message: 'Job processing error, waiting before retry',
          error: result.error,
        });
        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, 5000));
      } else if (!result.jobId) {
        // No jobs available, wait and poll again
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
    }
  } catch (error) {
    structuredLogger.error({
      service: 'AnalysisWorker',
      message: 'Job processor loop error',
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

export default {
  processAnalysisJob,
  processNextPendingJob,
  runJobProcessor,
};
