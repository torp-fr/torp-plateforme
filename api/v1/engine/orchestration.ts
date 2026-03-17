/**
 * GET /api/v1/engine/orchestration
 * Returns orchestration status, engine execution flow, and last orchestration run.
 *
 * Queries the `orchestration_runs` table for the latest run instead of reading
 * in-memory state (which does not persist across serverless invocations).
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { ENGINE_REGISTRY } from '../../../src/core/platform/engineRegistry';
import { getServerSupabase } from '../../_lib/supabase';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  console.log('🔥 [orchestration] API CALLED:', req.method, req.url);

  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    console.log('🔥 [orchestration] calling getServerSupabase()');
    const supabase = getServerSupabase();
    console.log('🔥 [orchestration] Supabase client ready');

    // Fetch the most recent orchestration run from the database.
    const { data: runs, error: dbError } = await supabase
      .from('orchestration_runs')
      .select('id, status, started_at, completed_at, error')
      .order('started_at', { ascending: false })
      .limit(1);

    if (dbError) {
      console.error('🔥 [orchestration] DB error:', dbError.message);
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
    const error = err instanceof Error ? err : new Error(String(err));
    console.error('🔥 [orchestration] FULL ERROR:', error.message);
    console.error('🔥 [orchestration] STACK:', error.stack);
    return res.status(500).json({
      success: false,
      error: 'Internal error',
      message: error.message,
      stack: error.stack,
    });
  }
}
