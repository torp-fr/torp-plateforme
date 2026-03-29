// ─────────────────────────────────────────────────────────────────────────────
// anthropic.service.ts — Server-side Anthropic Claude wrapper
//
// Uses the official @anthropic-ai/sdk (server-side only — no browser flag).
// Tracks per-call costs in Supabase api_costs table.
//
// Default model: claude-sonnet-4-6 (balanced speed/quality for TORP analysis)
// ─────────────────────────────────────────────────────────────────────────────

import Anthropic from '@anthropic-ai/sdk';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { structuredLogger } from '@/services/observability/structured-logger.js';

// ── Pricing (USD per 1K tokens, approximate) ──────────────────────────────────

const MODEL_PRICING: Record<string, number> = {
  'claude-haiku-4-5-20251001':   0.00025,
  'claude-haiku-4-5':            0.00025,
  'claude-sonnet-4-6':           0.003,
  'claude-opus-4-6':             0.015,
  // Legacy names for fallback
  'claude-3-haiku-20240307':     0.00025,
  'claude-3-5-sonnet-20241022':  0.003,
  'claude-3-opus-20240229':      0.015,
};

const DEFAULT_MODEL  = 'claude-sonnet-4-6';
const DEFAULT_MAX_TOKENS = 4096;

// ── Types ─────────────────────────────────────────────────────────────────────

export interface AnthropicMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface AnthropicCompletionOptions {
  model?:      string;
  maxTokens?:  number;
  system?:     string;
  temperature?: number;
}

export interface AnthropicCompletionResult {
  content:       string;
  model:         string;
  input_tokens:  number;
  output_tokens: number;
  cost_usd:      number;
  stop_reason:   string | null;
}

// ── Service ───────────────────────────────────────────────────────────────────

export class AnthropicService {
  private readonly client: Anthropic;
  private readonly supabase: SupabaseClient | null;

  constructor() {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error('ANTHROPIC_API_KEY not configured');

    // No dangerouslyAllowBrowser — this is server-side only
    this.client = new Anthropic({ apiKey });

    const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
    this.supabase = url && key ? createClient(url, key) : null;
  }

  /**
   * Send a completion request to Claude.
   * Returns the full response with token usage and cost.
   */
  async complete(
    messages: AnthropicMessage[],
    options: AnthropicCompletionOptions = {}
  ): Promise<AnthropicCompletionResult> {
    const model    = options.model     ?? DEFAULT_MODEL;
    const maxTokens = options.maxTokens ?? DEFAULT_MAX_TOKENS;

    try {
      const response = await this.client.messages.create({
        model,
        max_tokens: maxTokens,
        system:     options.system,
        temperature: options.temperature,
        messages:   messages.map(m => ({ role: m.role, content: m.content })),
      });

      const inputTokens  = response.usage.input_tokens;
      const outputTokens = response.usage.output_tokens;
      const totalTokens  = inputTokens + outputTokens;
      const pricePerK    = MODEL_PRICING[model] ?? 0.003;
      const costUsd      = (totalTokens / 1_000) * pricePerK;

      const textBlock = response.content.find(b => b.type === 'text');
      const content   = textBlock?.type === 'text' ? textBlock.text : '';

      this.trackCost(model, inputTokens, outputTokens, costUsd);

      return {
        content,
        model:         response.model,
        input_tokens:  inputTokens,
        output_tokens: outputTokens,
        cost_usd:      costUsd,
        stop_reason:   response.stop_reason ?? null,
      };
    } catch (err) {
      structuredLogger.warn({ message: 'Anthropic completion failed', model, error: String(err) });
      throw err;
    }
  }

  /**
   * Convenience: send a single user message with an optional system prompt.
   */
  async ask(
    prompt: string,
    systemPrompt?: string,
    options: AnthropicCompletionOptions = {}
  ): Promise<AnthropicCompletionResult> {
    return this.complete(
      [{ role: 'user', content: prompt }],
      { ...options, system: systemPrompt }
    );
  }

  /**
   * Analyze a document with a structured prompt.
   * Returns the raw text response (caller is responsible for parsing).
   */
  async analyzeDocument(
    documentText: string,
    analysisPrompt: string,
    options: AnthropicCompletionOptions = {}
  ): Promise<AnthropicCompletionResult> {
    const messages: AnthropicMessage[] = [
      {
        role: 'user',
        content: `${analysisPrompt}\n\n<document>\n${documentText}\n</document>`,
      },
    ];
    return this.complete(messages, options);
  }

  // ── Private ──────────────────────────────────────────────────────────────

  /** Fire-and-forget cost tracking to Supabase api_costs table. */
  private trackCost(
    model: string,
    inputTokens: number,
    outputTokens: number,
    costUsd: number
  ): void {
    if (!this.supabase) return;

    this.supabase.from('api_costs').insert({
      api_name:    `anthropic-${model}`,
      cost_usd:    costUsd,
      metrics:     {
        tokens_used:   inputTokens + outputTokens,
        input_tokens:  inputTokens,
        output_tokens: outputTokens,
        model,
      },
      recorded_at: new Date().toISOString(),
    }).then(() => void 0).catch(() => void 0);
  }
}
