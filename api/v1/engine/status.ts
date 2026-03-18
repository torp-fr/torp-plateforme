/**
 * GET /api/v1/engine/status
 * Returns platform status and engine pipeline health summary.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { ENGINE_REGISTRY, getEngineStats } from '../../../src/core/platform/engineRegistry.js';

export default function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    const stats = getEngineStats();
    return res.status(200).json({
      success: true,
      data: {
        status: 'ok',
        timestamp: new Date().toISOString(),
        engines: stats,
        registry: ENGINE_REGISTRY.map((e) => ({ id: e.id, status: e.status })),
      },
    });
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    return res.status(500).json({ success: false, error: 'Internal error', message: error.message });
  }
}
