/**
 * GET /api/v1/engine/status
 * Operational status + health score.
 *
 * Delegates to EngineService — same logic as the Express route.
 * Auth: JWT Bearer token required.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getServerSupabase } from '../../_lib/supabase.js';
import { engineService } from '../../../src/core/services/EngineService.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  // ── Auth guard ──────────────────────────────────────────────────────────────
  const token = (req.headers.authorization ?? '').replace('Bearer ', '').trim();
  if (!token) {
    return res.status(401).json({ success: false, error: 'Unauthorized', code: 'MISSING_TOKEN' });
  }

  const supabase = getServerSupabase();
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) {
    return res.status(401).json({ success: false, error: 'Unauthorized', code: 'INVALID_TOKEN' });
  }

  // ── Handler ─────────────────────────────────────────────────────────────────
  try {
    const data = await engineService.getStatus();
    return res.status(200).json({ success: true, data });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[/engine/status]', message);
    return res.status(500).json({ success: false, error: 'Internal error', code: 'ENGINE_STATUS_ERROR' });
  }
}
