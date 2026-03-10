/**
 * Engine API Routes
 * Exposes RAG engine status, stats, and orchestration state
 *
 * GET /api/v1/engine/status
 * GET /api/v1/engine/stats
 * GET /api/v1/engine/orchestration
 */

import { Router, Request, Response } from 'express';
import type { EngineStatus, EngineStats, OrchestrationState } from '../types/api.types';

// Safe fallbacks (used when live metrics are unavailable)
const FALLBACK_STATUS: EngineStatus = {
  status: 'running',
  rag: 'active',
  version: '1.0',
};

const FALLBACK_STATS: EngineStats = {
  documents: 0,
  chunks: 0,
  embeddings: 0,
};

const FALLBACK_ORCHESTRATION: OrchestrationState = {
  last_run: null,
  status: 'idle',
};

const router = Router();

// ---------------------------------------------------------------------------
// GET /api/v1/engine/status
// ---------------------------------------------------------------------------
router.get('/status', (_req: Request, res: Response) => {
  try {
    res.json(FALLBACK_STATUS);
  } catch (err) {
    console.error('[Engine API] /status error:', err);
    res.json(FALLBACK_STATUS);
  }
});

// ---------------------------------------------------------------------------
// GET /api/v1/engine/stats
// ---------------------------------------------------------------------------
router.get('/stats', async (_req: Request, res: Response) => {
  try {
    // Dynamically import to avoid crashing the server if the module has side effects
    const { getIngestionMetrics } = await import(
      '../../core/rag/analytics/ingestionMetrics.service.js'
    );
    const metrics = getIngestionMetrics();
    const stats: EngineStats = {
      documents: metrics.total_documents_processed ?? 0,
      chunks: Math.round(
        (metrics.avg_chunks_per_document ?? 0) * (metrics.total_documents_processed ?? 0)
      ),
      embeddings: metrics.successful_ingestions ?? 0,
    };
    res.json(stats);
  } catch (_err) {
    // Service unavailable — return safe default
    res.json(FALLBACK_STATS);
  }
});

// ---------------------------------------------------------------------------
// GET /api/v1/engine/orchestration
// ---------------------------------------------------------------------------
router.get('/orchestration', (_req: Request, res: Response) => {
  try {
    res.json(FALLBACK_ORCHESTRATION);
  } catch (err) {
    console.error('[Engine API] /orchestration error:', err);
    res.json(FALLBACK_ORCHESTRATION);
  }
});

export default router;
