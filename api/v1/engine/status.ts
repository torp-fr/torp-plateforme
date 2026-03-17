/**
 * GET /api/v1/engine/status
 * DEBUG MODE — minimal probe, no imports, isolates runtime crash origin.
 * Restore full implementation once runtime is confirmed stable.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';

export default function handler(req: VercelRequest, res: VercelResponse) {
  console.log('🔥 [status] API CALLED:', req.method, req.url);
  return res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
}
