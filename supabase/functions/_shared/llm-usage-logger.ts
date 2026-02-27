/**
 * LLM Usage Logger
 * Tracks and logs all LLM API calls with cost calculations
 */

import { calculateCost, getModelPrice } from './llm-pricing.ts';

export interface UsageLogEntry {
  user_id: string | null;
  action: string;
  model: string;
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
  latency_ms: number;
  cost_estimate: number;
  cost_currency: 'USD';
  timestamp: string;
  session_id?: string;
  error?: boolean;
  error_message?: string;
}

export interface LogRequest {
  userId?: string | null;
  action: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
  sessionId?: string;
  error?: boolean;
  errorMessage?: string;
}

/**
 * Create a usage log entry
 */
export function createUsageLog(request: LogRequest): UsageLogEntry {
  const totalTokens = request.inputTokens + request.outputTokens;
  const costEstimate = calculateCost(request.model, request.inputTokens, request.outputTokens);

  return {
    user_id: request.userId || null,
    action: request.action,
    model: request.model,
    input_tokens: request.inputTokens,
    output_tokens: request.outputTokens,
    total_tokens: totalTokens,
    latency_ms: request.latencyMs,
    cost_estimate: costEstimate,
    cost_currency: 'USD',
    timestamp: new Date().toISOString(),
    session_id: request.sessionId,
    error: request.error || false,
    error_message: request.errorMessage
  };
}

/**
 * Insert usage log into database
 */
export async function logUsage(
  supabase: any,
  entry: UsageLogEntry
): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('llm_usage_log')
      .insert([entry]);

    if (error) {
      console.error('[LLM Logger] Database insert error:', {
        error: error.message,
        code: error.code,
        hint: error.hint,
        entry
      });
      return false;
    }

    console.log('[LLM Logger] Usage logged:', {
      action: entry.action,
      model: entry.model,
      tokens: entry.total_tokens,
      cost: `$${entry.cost_estimate.toFixed(6)}`
    });

    return true;
  } catch (err) {
    console.error('[LLM Logger] Unexpected error:', err);
    return false;
  }
}

/**
 * Log usage with error handling
 * This is the main function to call from API endpoints
 */
export async function trackLLMUsage(
  supabase: any,
  request: LogRequest
): Promise<void> {
  const entry = createUsageLog(request);

  const success = await logUsage(supabase, entry);

  // Log metrics for monitoring
  console.log('[LLM Metrics]', {
    action: entry.action,
    model: entry.model,
    tokens: {
      input: entry.input_tokens,
      output: entry.output_tokens,
      total: entry.total_tokens
    },
    performance: {
      latency_ms: entry.latency_ms
    },
    cost: {
      estimate: entry.cost_estimate,
      formatted: `$${entry.cost_estimate.toFixed(6)}`
    },
    status: success ? 'logged' : 'log_failed'
  });
}

/**
 * Generate usage summary for reporting
 */
export function generateUsageSummary(entries: UsageLogEntry[]): {
  totalRequests: number;
  totalTokens: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCost: number;
  averageLatencyMs: number;
  modelBreakdown: Record<string, {
    count: number;
    totalTokens: number;
    totalCost: number;
  }>;
  actionBreakdown: Record<string, {
    count: number;
    totalTokens: number;
    totalCost: number;
  }>;
} {
  const summary = {
    totalRequests: entries.length,
    totalTokens: 0,
    totalInputTokens: 0,
    totalOutputTokens: 0,
    totalCost: 0,
    averageLatencyMs: 0,
    modelBreakdown: {} as Record<string, { count: number; totalTokens: number; totalCost: number }>,
    actionBreakdown: {} as Record<string, { count: number; totalTokens: number; totalCost: number }>
  };

  let totalLatency = 0;

  entries.forEach(entry => {
    if (entry.error) return; // Skip error entries

    summary.totalTokens += entry.total_tokens;
    summary.totalInputTokens += entry.input_tokens;
    summary.totalOutputTokens += entry.output_tokens;
    summary.totalCost += entry.cost_estimate;
    totalLatency += entry.latency_ms;

    // Model breakdown
    if (!summary.modelBreakdown[entry.model]) {
      summary.modelBreakdown[entry.model] = {
        count: 0,
        totalTokens: 0,
        totalCost: 0
      };
    }
    summary.modelBreakdown[entry.model].count += 1;
    summary.modelBreakdown[entry.model].totalTokens += entry.total_tokens;
    summary.modelBreakdown[entry.model].totalCost += entry.cost_estimate;

    // Action breakdown
    if (!summary.actionBreakdown[entry.action]) {
      summary.actionBreakdown[entry.action] = {
        count: 0,
        totalTokens: 0,
        totalCost: 0
      };
    }
    summary.actionBreakdown[entry.action].count += 1;
    summary.actionBreakdown[entry.action].totalTokens += entry.total_tokens;
    summary.actionBreakdown[entry.action].totalCost += entry.cost_estimate;
  });

  summary.averageLatencyMs = entries.length > 0 ? Math.round(totalLatency / entries.length) : 0;

  return summary;
}

/**
 * Format usage summary for logging
 */
export function formatUsageSummary(summary: ReturnType<typeof generateUsageSummary>): string {
  const lines = [
    '═══ LLM USAGE SUMMARY ═══',
    `Total Requests: ${summary.totalRequests}`,
    `Total Tokens: ${summary.totalTokens.toLocaleString()}`,
    `  Input:  ${summary.totalInputTokens.toLocaleString()}`,
    `  Output: ${summary.totalOutputTokens.toLocaleString()}`,
    `Total Cost: $${summary.totalCost.toFixed(6)}`,
    `Avg Latency: ${summary.averageLatencyMs}ms`,
    '',
    '--- By Model ---'
  ];

  Object.entries(summary.modelBreakdown).forEach(([model, data]) => {
    lines.push(`${model}:`);
    lines.push(`  Requests: ${data.count}, Tokens: ${data.totalTokens.toLocaleString()}, Cost: $${data.totalCost.toFixed(6)}`);
  });

  lines.push('');
  lines.push('--- By Action ---');

  Object.entries(summary.actionBreakdown).forEach(([action, data]) => {
    lines.push(`${action}:`);
    lines.push(`  Requests: ${data.count}, Tokens: ${data.totalTokens.toLocaleString()}, Cost: $${data.totalCost.toFixed(6)}`);
  });

  return lines.join('\n');
}
