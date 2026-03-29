/**
 * AuditService - Complete audit trail logging system
 * Logs all API requests, external calls, criteria evaluations, and execution context
 */

import { supabase } from '@/lib/supabase';
import { log, warn, error, time, timeEnd } from '@/lib/logger';
import type {
  ApiRequest,
  ApiRequestInput,
  ApiResponseInput,
  ExternalApiCall,
  ExternalApiCallInput,
  ExternalApiCallResponse,
  ExternalApiCallError,
  CriteriaEvaluation,
  CriteriaEvaluationInput,
  CriteriaScore,
  ExecutionContext,
  ExecutionContextInput,
  ScoreSnapshot,
  ScoreSnapshotInput,
  ExecutionTrace,
  ExecutionSummary,
  AnalysisRecord,
  AnalysisHistoryFilter,
} from '@/types/audit';

class AuditService {
  private readonly tableMappings = {
    apiRequests: 'api_requests_log',
    externalApiCalls: 'external_api_calls_log',
    criteriaEvaluations: 'criteria_evaluation_log',
    executionContext: 'execution_context_log',
    scoreSnapshots: 'score_snapshots',
  };

  /**
   * Generate unique request ID for correlation
   */
  generateRequestId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Log an API request
   * Returns request_id for use in subsequent calls
   */
  async logApiRequest(input: ApiRequestInput): Promise<string> {
    const requestId = this.generateRequestId();

    try {
      const { error } = await supabase
        .from(this.tableMappings.apiRequests)
        .insert({
          ccf_id: input.ccfId,
          user_id: input.userId,
          request_id: requestId,
          source_ip: input.sourceIp,
          endpoint: input.endpoint,
          method: input.method,
          params: input.params || {},
          headers: this.sanitizeHeaders(input.headers),
          requested_at: new Date().toISOString(),
          request_type: this.inferRequestType(input.endpoint),
        });

      if (error) {
        console.error('❌ Failed to log API request:', error);
      } else {
        log(`✅ API request logged: ${requestId}`);
      }

      return requestId;
    } catch (err) {
      console.error('❌ Error logging API request:', err);
      return requestId;
    }
  }

  /**
   * Complete API request with response data
   */
  async logApiResponse(
    requestId: string,
    response: ApiResponseInput
  ): Promise<void> {
    try {
      const { error } = await supabase
        .from(this.tableMappings.apiRequests)
        .update({
          status_code: response.statusCode,
          response_time_ms: response.responseTimeMs,
          error_message: response.errorMessage,
          error_details: response.errorDetails,
          completed_at: new Date().toISOString(),
        })
        .eq('request_id', requestId);

      if (error) {
        console.error('❌ Failed to log API response:', error);
      } else {
        log(`✅ API response logged: ${requestId}`);
      }
    } catch (err) {
      console.error('❌ Error logging API response:', err);
    }
  }

  /**
   * Log external API call (Pappers, INSEE, RGE, etc)
   */
  async logExternalApiCall(
    input: ExternalApiCallInput,
    response?: ExternalApiCallResponse,
    error?: ExternalApiCallError
  ): Promise<void> {
    try {
      const payload = {
        api_request_id: input.apiRequestId,
        external_service: input.externalService,
        endpoint: input.endpoint,
        method: input.method || 'GET',
        request_payload: input.requestPayload,
        request_headers: this.sanitizeHeaders(input.requestHeaders),
        ccf_id: input.ccfId,
        context_data: input.contextData,
        called_at: new Date().toISOString(),
        ...(response && {
          response_status: response.responseStatus,
          response_payload: response.responsePayload,
          response_time_ms: response.responseTimeMs,
          completed_at: new Date().toISOString(),
        }),
        ...(error && {
          error_occurred: error.errorOccurred,
          error_code: error.errorCode,
          error_message: error.errorMessage,
          error_details: error.errorDetails,
          retry_count: error.retryCount || 0,
          retry_reason: error.retryReason,
        }),
      };

      const { error: insertError } = await supabase
        .from(this.tableMappings.externalApiCalls)
        .insert(payload);

      if (insertError) {
        console.error(`❌ Failed to log external API call (${input.externalService}):`, insertError);
      } else {
        log(`✅ External API call logged: ${input.externalService} (${response?.responseTimeMs}ms)`);
      }
    } catch (err) {
      console.error('❌ Error logging external API call:', err);
    }
  }

  /**
   * Log criteria evaluation
   */
  async logCriteriaEvaluation(
    input: CriteriaEvaluationInput,
    score: CriteriaScore
  ): Promise<void> {
    try {
      const { error } = await supabase
        .from(this.tableMappings.criteriaEvaluations)
        .insert({
          api_request_id: input.apiRequestId,
          criterion_name: input.criterionName,
          criterion_category: input.criterionCategory,
          criterion_axis: input.criterionAxis,
          input_data: input.inputData || {},
          evaluation_method: input.evaluationMethod,
          evaluation_logic: input.evaluationLogic,
          score: score.score,
          max_score: score.maxScore,
          percentage: score.percentage,
          grade: score.grade,
          justification: score.justification,
          findings: score.findings || [],
          confidence: score.confidence,
          ccf_id: input.ccfId,
          room_id: input.roomId,
          evaluated_at: new Date().toISOString(),
        });

      if (error) {
        console.error('❌ Failed to log criteria evaluation:', error);
      } else {
        log(`✅ Criteria evaluation logged: ${input.criterionName} (${score.percentage}%)`);
      }
    } catch (err) {
      console.error('❌ Error logging criteria evaluation:', err);
    }
  }

  /**
   * Create execution context (start of analysis)
   * Returns context ID for linking subsequent events
   */
  async createExecutionContext(input: ExecutionContextInput): Promise<string> {
    try {
      const executionId = input.executionId || this.generateRequestId();

      const { data, error } = await supabase
        .from(this.tableMappings.executionContext)
        .insert({
          execution_id: executionId,
          region: input.region,
          climate_zone: input.climateZone,
          project_type: input.projectType,
          work_types: input.workTypes || [],
          address: input.address,
          coordinates: input.coordinates,
          commune_code: input.communeCode,
          contractor_siret: input.contractorSiret,
          contractor_name: input.contractorName,
          contractor_solvency_score: input.contractorSolvencyScore,
          analysis_config: input.analysisConfig || {},
          kb_chunks_used: input.kbChunksUsed || [],
          ai_model: input.aiModel,
          ai_temperature: input.aiTemperature,
          ai_max_tokens: input.aiMaxTokens,
          ccf_id: input.ccfId,
          user_id: input.userId,
          started_at: new Date().toISOString(),
          status: 'started',
        })
        .select('id')
        .single();

      if (error) {
        console.error('❌ Failed to create execution context:', error);
        return executionId;
      }

      log(`✅ Execution context created: ${executionId}`);
      return executionId;
    } catch (err) {
      console.error('❌ Error creating execution context:', err);
      return input.executionId || '';
    }
  }

  /**
   * Update execution context status
   */
  async updateExecutionContext(
    executionId: string,
    updates: Partial<ExecutionContextInput> & { status?: string }
  ): Promise<void> {
    try {
      const updatePayload: Record<string, any> = {};

      if (updates.region) updatePayload.region = updates.region;
      if (updates.climateZone) updatePayload.climate_zone = updates.climateZone;
      if (updates.projectType) updatePayload.project_type = updates.projectType;
      if (updates.workTypes) updatePayload.work_types = updates.workTypes;
      if (updates.contractorSolvencyScore) updatePayload.contractor_solvency_score = updates.contractorSolvencyScore;
      if (updates.status) updatePayload.status = updates.status;

      const { error } = await supabase
        .from(this.tableMappings.executionContext)
        .update(updatePayload)
        .eq('execution_id', executionId);

      if (error) {
        console.error('❌ Failed to update execution context:', error);
      } else {
        log(`✅ Execution context updated: ${executionId}`);
      }
    } catch (err) {
      console.error('❌ Error updating execution context:', err);
    }
  }

  /**
   * Close execution context (end of analysis)
   */
  async closeExecutionContext(executionId: string, totalDurationMs: number): Promise<void> {
    try {
      const { error } = await supabase
        .from(this.tableMappings.executionContext)
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          total_duration_ms: totalDurationMs,
        })
        .eq('execution_id', executionId);

      if (error) {
        console.error('❌ Failed to close execution context:', error);
      } else {
        log(`✅ Execution context closed: ${executionId} (${totalDurationMs}ms)`);
      }
    } catch (err) {
      console.error('❌ Error closing execution context:', err);
    }
  }

  /**
   * Mark execution as failed
   */
  async markExecutionFailed(executionId: string, errorMessage: string): Promise<void> {
    try {
      const { error } = await supabase
        .from(this.tableMappings.executionContext)
        .update({
          status: 'failed',
          completed_at: new Date().toISOString(),
        })
        .eq('execution_id', executionId);

      if (error) {
        console.error('❌ Failed to mark execution as failed:', error);
      } else {
        log(`⚠️ Execution marked as failed: ${executionId}`);
      }
    } catch (err) {
      console.error('❌ Error marking execution as failed:', err);
    }
  }

  /**
   * Create score snapshot (save scores at point in time)
   */
  async createScoreSnapshot(
    executionContextId: string,
    input: ScoreSnapshotInput
  ): Promise<string> {
    try {
      const { data, error } = await supabase
        .from(this.tableMappings.scoreSnapshots)
        .insert({
          execution_context_id: executionContextId,
          global_score: input.globalScore,
          grade: input.grade,
          percentage: input.percentage,
          scores_by_room: input.scoresByRoom,
          scores_by_criterion: input.scoresByCriterion,
          scores_by_axis: input.scoresByAxis,
          strengths: input.strengths || [],
          weaknesses: input.weaknesses || [],
          recommendations: input.recommendations || [],
          kb_references: input.kbReferences,
          ccf_id: input.ccfId,
          created_at: new Date().toISOString(),
        })
        .select('id')
        .single();

      if (error) {
        console.error('❌ Failed to create score snapshot:', error);
        return '';
      }

      log(`✅ Score snapshot created: ${input.globalScore}/1000 (${input.grade})`);
      return data?.id || '';
    } catch (err) {
      console.error('❌ Error creating score snapshot:', err);
      return '';
    }
  }

  /**
   * Get complete execution trace (all data for an analysis)
   */
  async getExecutionTrace(executionId: string): Promise<ExecutionTrace | null> {
    try {
      const { data, error } = await supabase
        .rpc('get_execution_trace', {
          execution_uuid: executionId,
        });

      if (error) {
        console.error('❌ Failed to get execution trace:', error);
        return null;
      }

      return data as ExecutionTrace;
    } catch (err) {
      console.error('❌ Error getting execution trace:', err);
      return null;
    }
  }

  /**
   * Get execution summary
   */
  async getExecutionSummary(executionId: string): Promise<ExecutionSummary | null> {
    try {
      const { data, error } = await supabase
        .rpc('get_execution_summary', {
          execution_uuid: executionId,
        });

      if (error) {
        console.error('❌ Failed to get execution summary:', error);
        return null;
      }

      return data as ExecutionSummary;
    } catch (err) {
      console.error('❌ Error getting execution summary:', err);
      return null;
    }
  }

  /**
   * Get analysis history for a CCF
   */
  async getAnalysisHistory(
    ccfId: string,
    filters?: AnalysisHistoryFilter
  ): Promise<AnalysisRecord[]> {
    try {
      const limit = filters?.limit || 10;
      const offset = filters?.offset || 0;

      const { data, error } = await supabase
        .rpc('get_ccf_analysis_history', {
          ccf_uuid: ccfId,
          limit_count: limit,
        });

      if (error) {
        console.error('❌ Failed to get analysis history:', error);
        return [];
      }

      return data as AnalysisRecord[];
    } catch (err) {
      console.error('❌ Error getting analysis history:', err);
      return [];
    }
  }

  /**
   * Get API calls for an analysis
   */
  async getAnalysisApiCalls(apiRequestId: string) {
    try {
      const { data, error } = await supabase
        .rpc('get_analysis_api_calls', {
          api_request_uuid: apiRequestId,
        });

      if (error) {
        console.error('❌ Failed to get API calls:', error);
        return [];
      }

      return data || [];
    } catch (err) {
      console.error('❌ Error getting API calls:', err);
      return [];
    }
  }

  /**
   * Get criteria breakdown for an analysis
   */
  async getAnalysisCriteriaBreakdown(apiRequestId: string) {
    try {
      const { data, error } = await supabase
        .rpc('get_analysis_criteria_breakdown', {
          api_request_uuid: apiRequestId,
        });

      if (error) {
        console.error('❌ Failed to get criteria breakdown:', error);
        return [];
      }

      return data || [];
    } catch (err) {
      console.error('❌ Error getting criteria breakdown:', err);
      return [];
    }
  }

  /**
   * Helper: Infer request type from endpoint
   */
  private inferRequestType(endpoint: string): string {
    if (endpoint.includes('upload')) return 'upload';
    if (endpoint.includes('analyze')) return 'analyze';
    if (endpoint.includes('export')) return 'export';
    return 'other';
  }

  /**
   * Helper: Sanitize headers (remove sensitive data)
   */
  private sanitizeHeaders(headers?: Record<string, string>): Record<string, string> | undefined {
    if (!headers) return undefined;

    const sanitized = { ...headers };
    const sensitiveKeys = ['authorization', 'x-api-key', 'cookie', 'x-auth-token'];

    sensitiveKeys.forEach(key => {
      if (sanitized[key]) {
        sanitized[key] = '***REDACTED***';
      }
    });

    return sanitized;
  }

  /**
   * Export audit trail as JSON
   */
  async exportAuditTrail(executionId: string): Promise<string> {
    try {
      const trace = await this.getExecutionTrace(executionId);
      return JSON.stringify(trace, null, 2);
    } catch (err) {
      console.error('❌ Error exporting audit trail:', err);
      return '';
    }
  }

  /**
   * Delete old audit logs (cleanup)
   * Default: Keep 12 months, delete older
   */
  async cleanupOldLogs(daysToKeep: number = 365): Promise<void> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

      const { error } = await supabase
        .from(this.tableMappings.apiRequests)
        .delete()
        .lt('requested_at', cutoffDate.toISOString());

      if (error) {
        console.error('❌ Failed to cleanup logs:', error);
      } else {
        log(`✅ Audit logs cleaned up (older than ${daysToKeep} days)`);
      }
    } catch (err) {
      console.error('❌ Error cleaning up logs:', err);
    }
  }
}

// Export singleton instance
export const auditService = new AuditService();
export default AuditService;
