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
} from '@/core/platform/engineRegistry';

export default function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    const stats = getEngineStats();

    return res.status(200).json({
      success: true,
      data: {
        stats,
        engines: ENGINE_REGISTRY,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[/api/v1/engine/stats] Error:', message);
    return res.status(500).json({ success: false, error: message });
  }
}
