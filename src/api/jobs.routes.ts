/**
 * Jobs Facade Routes
 * Découplage du frontend du job service
 * Expose les endpoints pour la gestion des jobs d'analyse
 */

import type { Express } from 'express';
import { jobService } from '@/core/jobs/job.service';

/**
 * GET /api/v1/jobs/:id
 * Récupère les détails d'un job par son ID
 */
async function handleGetJob(req: any, res: any) {
  try {
    const { id } = req.params;

    if (!id || typeof id !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Job ID is required',
      });
    }

    const job = await jobService.getJobById(id);

    if (!job) {
      return res.status(404).json({
        success: false,
        error: 'Job not found',
      });
    }

    res.status(200).json({
      success: true,
      data: job,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Get Job] Error:', message);
    res.status(500).json({
      success: false,
      error: message,
    });
  }
}

/**
 * GET /api/v1/jobs/status/:id
 * Récupère le statut d'un job
 */
async function handleGetJobStatus(req: any, res: any) {
  try {
    const { id } = req.params;

    if (!id || typeof id !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Job ID is required',
      });
    }

    const job = await jobService.getJobById(id);

    if (!job) {
      return res.status(404).json({
        success: false,
        error: 'Job not found',
      });
    }

    res.status(200).json({
      success: true,
      data: {
        id: job.id,
        status: job.status,
        progress: job.progress,
        error_message: job.error_message,
        created_at: job.created_at,
        started_at: job.started_at,
        completed_at: job.completed_at,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Get Job Status] Error:', message);
    res.status(500).json({
      success: false,
      error: message,
    });
  }
}

/**
 * Enregistre les routes jobs sur l'app Express
 */
export function registerJobRoutes(app: Express) {
  app.get('/api/v1/jobs/:id', handleGetJob);
  app.get('/api/v1/jobs/status/:id', handleGetJobStatus);
}
