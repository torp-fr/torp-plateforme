/**
 * GET /api/v1/engine/stats?period=24h
 * Engine execution statistics for the dashboard.
 *
 * Delegates to EngineService — same logic as the Express route.
 * Auth: JWT Bearer token required.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getServerSupabase } from '../../_lib/supabase.js';
import { engineService } from '../../../src/core/services/EngineService.js';

const VALID_PERIODS = ['1h', '24h', '7d'] as const;
type Period = (typeof VALID_PERIODS)[number];

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
    const rawPeriod = req.query.period;
    const period: Period = VALID_PERIODS.includes(rawPeriod as Period)
      ? (rawPeriod as Period)
      : '24h';

    const data = await engineService.getStats(period);
    return res.status(200).json({ success: true, data });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[/engine/stats]', message);
    return res.status(500).json({ success: false, error: 'Internal error', code: 'ENGINE_STATS_ERROR' });
  }
}
