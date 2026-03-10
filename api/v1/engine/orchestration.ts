/**
 * GET /api/v1/engine/orchestration
 * Returns orchestration status, engine execution flow, and last orchestration run.
 *
 * Queries the `orchestration_runs` table for the latest run instead of reading
 * in-memory state (which does not persist across serverless invocations).
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { ENGINE_REGISTRY } from '@/core/platform/engineRegistry';
import { getServerSupabase } from '../../_lib/supabase';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    const supabase = getServerSupabase();

    // Fetch the most recent orchestration run from the database.
    const { data: runs, error: dbError } = await supabase
      .from('orchestration_runs')
      .select('id, status, started_at, completed_at, error')
      .order('started_at', { ascending: false })
      .limit(1);

    if (dbError) {
      console.error('[/api/v1/engine/orchestration] DB error:', dbError.message);
    }

    const lastRun = runs?.[0] ?? null;
    const currentStatus = lastRun?.status === 'running' ? 'running' : 'idle';

    // Engine execution order derived from registry — no hardcoded metadata.
    const flow = ENGINE_REGISTRY.map((engine) => engine.id);

    return res.status(200).json({
      success: true,
      data: {
        status: currentStatus,
        flow,
        lastOrchestration: lastRun
          ? {
              id: lastRun.id,
              status: lastRun.status,
              startTime: lastRun.started_at,
              endTime: lastRun.completed_at ?? null,
              error: lastRun.error ?? null,
            }
          : null,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[/api/v1/engine/orchestration] Error:', message);
    return res.status(500).json({ success: false, error: message });
  }
}
