/**
 * LLM Pricing Configuration
 * Current prices as of 2026-02-27
 * Prices in USD per 1M tokens
 */

export interface ModelPrice {
  model: string;
  provider: 'openai' | 'anthropic';
  inputPrice: number;      // USD per 1M input tokens
  outputPrice: number;     // USD per 1M output tokens
  costPer1kTokens: (type: 'input' | 'output') => number;
}

/**
 * OpenAI Pricing Table
 * Updated: 2026-02-27
 */
export const OPENAI_PRICING: Record<string, ModelPrice> = {
  'gpt-4o': {
    model: 'gpt-4o',
    provider: 'openai',
    inputPrice: 2.50,        // $2.50 per 1M input tokens
    outputPrice: 10.00,      // $10.00 per 1M output tokens
    costPer1kTokens: (type) => type === 'input' ? 0.0000025 : 0.000010
  },
  'gpt-4-turbo': {
    model: 'gpt-4-turbo',
    provider: 'openai',
    inputPrice: 10.00,       // $10.00 per 1M input tokens
    outputPrice: 30.00,      // $30.00 per 1M output tokens
    costPer1kTokens: (type) => type === 'input' ? 0.000010 : 0.000030
  },
  'gpt-4': {
    model: 'gpt-4',
    provider: 'openai',
    inputPrice: 30.00,       // $30.00 per 1M input tokens
    outputPrice: 60.00,      // $60.00 per 1M output tokens
    costPer1kTokens: (type) => type === 'input' ? 0.000030 : 0.000060
  },
  'gpt-3.5-turbo': {
    model: 'gpt-3.5-turbo',
    provider: 'openai',
    inputPrice: 0.50,        // $0.50 per 1M input tokens
    outputPrice: 1.50,       // $1.50 per 1M output tokens
    costPer1kTokens: (type) => type === 'input' ? 0.0000005 : 0.0000015
  },
  'text-embedding-3-small': {
    model: 'text-embedding-3-small',
    provider: 'openai',
    inputPrice: 0.02,        // $0.02 per 1M input tokens
    outputPrice: 0,          // No output tokens for embeddings
    costPer1kTokens: (type) => type === 'input' ? 0.00000002 : 0
  },
  'text-embedding-3-large': {
    model: 'text-embedding-3-large',
    provider: 'openai',
    inputPrice: 0.13,        // $0.13 per 1M input tokens
    outputPrice: 0,
    costPer1kTokens: (type) => type === 'input' ? 0.00000013 : 0
  }
};

/**
 * Anthropic Claude Pricing Table
 * Updated: 2026-02-27
 */
export const ANTHROPIC_PRICING: Record<string, ModelPrice> = {
  'claude-opus-4-1': {
    model: 'claude-opus-4-1',
    provider: 'anthropic',
    inputPrice: 15.00,       // $15.00 per 1M input tokens
    outputPrice: 75.00,      // $75.00 per 1M output tokens
    costPer1kTokens: (type) => type === 'input' ? 0.000015 : 0.000075
  },
  'claude-sonnet-4-20250514': {
    model: 'claude-sonnet-4-20250514',
    provider: 'anthropic',
    inputPrice: 3.00,        // $3.00 per 1M input tokens
    outputPrice: 15.00,      // $15.00 per 1M output tokens
    costPer1kTokens: (type) => type === 'input' ? 0.000003 : 0.000015
  },
  'claude-3-opus-20250219': {
    model: 'claude-3-opus-20250219',
    provider: 'anthropic',
    inputPrice: 15.00,
    outputPrice: 75.00,
    costPer1kTokens: (type) => type === 'input' ? 0.000015 : 0.000075
  },
  'claude-3-sonnet-20240229': {
    model: 'claude-3-sonnet-20240229',
    provider: 'anthropic',
    inputPrice: 3.00,
    outputPrice: 15.00,
    costPer1kTokens: (type) => type === 'input' ? 0.000003 : 0.000015
  },
  'claude-3-5-sonnet-20241022': {
    model: 'claude-3-5-sonnet-20241022',
    provider: 'anthropic',
    inputPrice: 3.00,
    outputPrice: 15.00,
    costPer1kTokens: (type) => type === 'input' ? 0.000003 : 0.000015
  },
  'claude-3-haiku-20240307': {
    model: 'claude-3-haiku-20240307',
    provider: 'anthropic',
    inputPrice: 0.80,        // $0.80 per 1M input tokens
    outputPrice: 4.00,       // $4.00 per 1M output tokens
    costPer1kTokens: (type) => type === 'input' ? 0.0000008 : 0.000004
  },
  'claude-3-5-haiku-20241022': {
    model: 'claude-3-5-haiku-20241022',
    provider: 'anthropic',
    inputPrice: 0.80,
    outputPrice: 4.00,
    costPer1kTokens: (type) => type === 'input' ? 0.0000008 : 0.000004
  }
};

/**
 * Get pricing for a model
 */
export function getModelPrice(model: string): ModelPrice | null {
  return OPENAI_PRICING[model] || ANTHROPIC_PRICING[model] || null;
}

/**
 * Calculate cost for API usage
 * @param model Model name
 * @param inputTokens Number of input tokens
 * @param outputTokens Number of output tokens
 * @returns Cost in USD
 */
export function calculateCost(
  model: string,
  inputTokens: number,
  outputTokens: number
): number {
  const pricing = getModelPrice(model);
  if (!pricing) {
    console.warn(`Unknown model for pricing: ${model}`);
    return 0;
  }

  const inputCost = (inputTokens / 1_000_000) * pricing.inputPrice;
  const outputCost = (outputTokens / 1_000_000) * pricing.outputPrice;

  return parseFloat((inputCost + outputCost).toFixed(6));
}

/**
 * Format cost as currency
 */
export function formatCost(costUsd: number): string {
  return `$${costUsd.toFixed(6)}`;
}

/**
 * Get pricing summary for a model
 */
export function getPricingSummary(model: string): {
  model: string;
  provider: string;
  inputPrice: string;
  outputPrice: string;
} | null {
  const pricing = getModelPrice(model);
  if (!pricing) return null;

  return {
    model: pricing.model,
    provider: pricing.provider,
    inputPrice: `$${pricing.inputPrice}/1M tokens`,
    outputPrice: `$${pricing.outputPrice}/1M tokens`
  };
}
