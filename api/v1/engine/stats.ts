/**
 * GET /api/v1/engine/stats
 * Returns full engine registry with stats per status bucket.
 *
 * Used by CockpitOrchestration to render the engine grid.
 * Response shape matches what the frontend apiGet('/api/v1/engine/stats') expects:
 *   payload.engines  → EngineRegistryEntry[]
 *   payload.stats    → { total, active, inactive, error }
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  ENGINE_REGISTRY,
  getEngineStats,
} from '../../../src/core/platform/engineRegistry.js';

export default function handler(req: VercelRequest, res: VercelResponse) {
  console.log('🔥 [stats] API CALLED:', req.method, req.url);

  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    console.log('🔥 [stats] calling getEngineStats()');
    const stats = getEngineStats();
    console.log('🔥 [stats] stats OK:', JSON.stringify(stats));

    return res.status(200).json({
      success: true,
      data: {
        stats,
        engines: ENGINE_REGISTRY,
      },
    });
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    console.error('🔥 [stats] FULL ERROR:', error.message);
    console.error('🔥 [stats] STACK:', error.stack);
    return res.status(500).json({
      success: false,
      error: 'Internal error',
      message: error.message,
      stack: error.stack,
    });
  }
}
