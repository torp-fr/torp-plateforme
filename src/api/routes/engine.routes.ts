// ─────────────────────────────────────────────────────────────────────────────
// engine.routes.ts — Engine metrics endpoints — Phase 3B Jalon 3
//
// GET /api/v1/engine/stats?period=24h  — Execution metrics per period
// GET /api/v1/engine/status            — Operational status + health score
// GET /api/v1/engine/orchestration     — Last orchestration run
//
// All routes require JWT (authenticateJWT).
// ─────────────────────────────────────────────────────────────────────────────

import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { authenticateJWT, type AuthenticatedRequest } from '../middleware/auth.js';
import { validateQuery } from '../../utils/validation.utils.js';
import { engineService } from '../../core/services/EngineService.js';

const router = Router();

// All engine routes require a valid JWT
router.use(authenticateJWT);

// ─── Query schemas ────────────────────────────────────────────────────────────

const StatsQuerySchema = z.object({
  period: z.enum(['1h', '24h', '7d']).default('24h'),
});

// ─── GET /engine/stats ────────────────────────────────────────────────────────

router.get('/stats', validateQuery(StatsQuerySchema), async (req: Request, res: Response) => {
  const { period } = req.query as { period: '1h' | '24h' | '7d' };

  try {
    const data = await engineService.getStats(period);
    res.status(200).json({ success: true, data });
  } catch (err) {
    console.error('[engine/stats]', err);
    res.status(500).json({ error: 'Internal Server Error', code: 'ENGINE_STATS_ERROR' });
  }
});

// ─── GET /engine/status ───────────────────────────────────────────────────────

router.get('/status', async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const data = await engineService.getStatus();
    res.status(200).json({ success: true, data });
  } catch (err) {
    console.error('[engine/status]', err);
    res.status(500).json({ error: 'Internal Server Error', code: 'ENGINE_STATUS_ERROR' });
  }
});

// ─── GET /engine/orchestration ────────────────────────────────────────────────

router.get('/orchestration', async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const data = await engineService.getLastOrchestration();
    res.status(200).json({ success: true, data });
  } catch (err) {
    console.error('[engine/orchestration]', err);
    res.status(500).json({ error: 'Internal Server Error', code: 'ENGINE_ORCHESTRATION_ERROR' });
  }
});

export default router;
