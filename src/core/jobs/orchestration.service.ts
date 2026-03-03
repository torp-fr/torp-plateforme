/**
 * Orchestration Service - Database-backed orchestration tracking
 * Manages orchestration_runs and engine_executions tables
 * Phase 37: Database Orchestration Tracking
 */

import { supabase } from '@/lib/supabase';
import { structuredLogger } from '@/services/observability/structured-logger';
import { log, warn, error } from '@/lib/logger';

export interface OrchestrationRun {
  id: string;
  job_id: string | null;
  status: 'running' | 'completed' | 'failed';
  started_at: string;
  completed_at: string | null;
  created_at: string;
}

export interface EngineExecution {
  id: string;
  orchestration_id: string;
  engine_id: string;
  status: 'pending' | 'running' | 'completed' | 'skipped' | 'failed';
  duration_ms: number | null;
  result: Record<string, any> | null;
  error: string | null;
  created_at: string;
}

/**
 * Orchestration Service - Manages database-backed orchestration tracking
 */
export class OrchestrationService {
  /**
   * Create a new orchestration run
   */
  async createOrchestrationRun(jobId?: string): Promise<OrchestrationRun> {
    const { data, error } = await supabase
      .from('orchestration_runs')
      .insert({
        job_id: jobId || null,
        status: 'running',
        started_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      structuredLogger.error({
        service: 'OrchestrationService',
        method: 'createOrchestrationRun',
        message: 'Failed to create orchestration run',
        error: error.message,
        jobId,
      });
      throw new Error(`Failed to create orchestration run: ${error.message}`);
    }

    log('[OrchestrationService] Orchestration run created:', data.id);
    return data as OrchestrationRun;
  }

  /**
   * Record engine execution
   */
  async recordEngineExecution(
    orchestrationId: string,
    engineId: string,
    status: 'pending' | 'running' | 'completed' | 'skipped' | 'failed',
    durationMs?: number,
    result?: Record<string, any>,
    errorMessage?: string
  ): Promise<EngineExecution> {
    const { data, error } = await supabase
      .from('engine_executions')
      .insert({
        orchestration_id: orchestrationId,
        engine_id: engineId,
        status: status,
        duration_ms: durationMs || null,
        result: result || null,
        error: errorMessage || null,
      })
      .select()
      .single();

    if (error) {
      warn('[OrchestrationService] Failed to record engine execution (non-critical):', {
        orchestrationId,
        engineId,
        error: error.message,
      });
      // Non-critical error - don't throw
      return null as any;
    }

    log('[OrchestrationService] Engine execution recorded:', {
      orchestrationId,
      engineId,
      status,
      durationMs,
    });
    return data as EngineExecution;
  }

  /**
   * Complete orchestration run
   */
  async completeOrchestrationRun(
    orchestrationId: string,
    status: 'completed' | 'failed',
    errorMessage?: string
  ): Promise<OrchestrationRun> {
    const { data, error } = await supabase
      .from('orchestration_runs')
      .update({
        status: status,
        completed_at: new Date().toISOString(),
      })
      .eq('id', orchestrationId)
      .select()
      .single();

    if (error) {
      structuredLogger.error({
        service: 'OrchestrationService',
        method: 'completeOrchestrationRun',
        message: 'Failed to complete orchestration run',
        error: error.message,
        orchestrationId,
        status,
      });
      throw new Error(`Failed to complete orchestration run: ${error.message}`);
    }

    log('[OrchestrationService] Orchestration run completed:', {
      orchestrationId,
      status,
    });
    return data as OrchestrationRun;
  }

  /**
   * Get orchestration run by ID
   */
  async getOrchestrationRun(orchestrationId: string): Promise<OrchestrationRun | null> {
    const { data, error } = await supabase
      .from('orchestration_runs')
      .select('*')
      .eq('id', orchestrationId)
      .single();

    if (error && error.code !== 'PGRST116') {
      structuredLogger.warn({
        service: 'OrchestrationService',
        method: 'getOrchestrationRun',
        message: 'Failed to fetch orchestration run',
        error: error.message,
        orchestrationId,
      });
      return null;
    }

    return data ? (data as OrchestrationRun) : null;
  }

  /**
   * Get engine executions for an orchestration
   */
  async getEngineExecutions(orchestrationId: string): Promise<EngineExecution[]> {
    const { data, error } = await supabase
      .from('engine_executions')
      .select('*')
      .eq('orchestration_id', orchestrationId)
      .order('created_at', { ascending: true });

    if (error) {
      warn('[OrchestrationService] Failed to fetch engine executions:', {
        orchestrationId,
        error: error.message,
      });
      return [];
    }

    return (data || []) as EngineExecution[];
  }
}

/**
 * Singleton instance for application-wide use
 */
export const orchestrationService = new OrchestrationService();
export default orchestrationService;
