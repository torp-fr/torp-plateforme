/**
 * GET /api/v1/engine/status
 * Returns the current orchestration status and engine registry summary.
 *
 * In a serverless context, orchestration state is not persisted in memory.
 * Status reflects the static registry — 'idle' unless a DB-backed run is active.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';

// ENGINE_REGISTRY has no external imports — safe to import.
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
        status: 'idle',
        timestamp: new Date().toISOString(),
        registry: {
          total: stats.total,
          active: stats.active,
          inactive: stats.inactive,
          error: stats.error,
        },
        engines: ENGINE_REGISTRY.map((e) => ({
          id: e.id,
          name: e.name,
          status: e.status,
        })),
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[/api/v1/engine/status] Error:', message);
    return res.status(500).json({ success: false, error: message });
  }
}
