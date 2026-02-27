/**
 * Token counting utility for Edge Functions
 * Supports multiple models and providers (OpenAI, Anthropic, etc.)
 *
 * Uses approximate token counting formulas based on model architecture
 * For exact counts, APIs provide usage statistics
 */

// Model context windows and token estimates
const MODEL_CONFIG: Record<string, {
  contextWindow: number;
  tokensPerChar: number;
  provider: 'openai' | 'anthropic' | 'google';
}> = {
  // OpenAI Models
  'gpt-4o': {
    contextWindow: 128000,
    tokensPerChar: 0.25, // Average ~4 chars per token
    provider: 'openai'
  },
  'gpt-4-turbo': {
    contextWindow: 128000,
    tokensPerChar: 0.25,
    provider: 'openai'
  },
  'gpt-4': {
    contextWindow: 8192,
    tokensPerChar: 0.25,
    provider: 'openai'
  },
  'gpt-3.5-turbo': {
    contextWindow: 4096,
    tokensPerChar: 0.25,
    provider: 'openai'
  },

  // OpenAI Embedding Models
  'text-embedding-3-small': {
    contextWindow: 8191,
    tokensPerChar: 0.25,
    provider: 'openai'
  },
  'text-embedding-3-large': {
    contextWindow: 8191,
    tokensPerChar: 0.25,
    provider: 'openai'
  },
  'text-embedding-ada-002': {
    contextWindow: 8191,
    tokensPerChar: 0.25,
    provider: 'openai'
  },

  // Claude Models (Anthropic)
  'claude-opus-4-1': {
    contextWindow: 200000,
    tokensPerChar: 0.33, // Claude uses ~3 chars per token average
    provider: 'anthropic'
  },
  'claude-sonnet-4-20250514': {
    contextWindow: 200000,
    tokensPerChar: 0.33,
    provider: 'anthropic'
  },
  'claude-3-opus-20250219': {
    contextWindow: 200000,
    tokensPerChar: 0.33,
    provider: 'anthropic'
  },
  'claude-3-sonnet-20240229': {
    contextWindow: 200000,
    tokensPerChar: 0.33,
    provider: 'anthropic'
  },
  'claude-3-haiku-20240307': {
    contextWindow: 200000,
    tokensPerChar: 0.33,
    provider: 'anthropic'
  },
  'claude-3-5-sonnet-20241022': {
    contextWindow: 200000,
    tokensPerChar: 0.33,
    provider: 'anthropic'
  },
  'claude-3-5-haiku-20241022': {
    contextWindow: 200000,
    tokensPerChar: 0.33,
    provider: 'anthropic'
  },
};

export interface TokenCountResult {
  inputTokens: number;
  outputTokens: number;
  estimatedTotal: number;
  contextWindow: number;
  safeLimit: number;
  isWithinLimit: boolean;
}

export interface TokenCountError {
  error: 'context_limit_exceeded' | 'invalid_model' | 'unknown';
  inputTokens: number;
  outputTokens: number;
  maxAllowed: number;
  message: string;
}

/**
 * Estimate token count for text
 * Uses approximate formula: length * tokensPerChar
 *
 * More accurate than simple character count, but less accurate than API tokenizers
 */
function estimateTokenCount(text: string, model: string): number {
  const config = MODEL_CONFIG[model];
  if (!config) {
    // Default estimate if model not found
    return Math.ceil(text.length * 0.25);
  }
  return Math.ceil(text.length * config.tokensPerChar);
}

/**
 * Count tokens in a message or text
 *
 * @param text - The text to count tokens for
 * @param model - The model being used (determines token formula)
 * @returns Token count estimate
 */
export function countTokens(text: string, model: string): number {
  if (!text) return 0;
  return estimateTokenCount(text, model);
}

/**
 * Count tokens in messages array (for chat APIs)
 *
 * @param messages - Array of messages with role and content
 * @param model - The model being used
 * @param includeSystemPrompt - Whether to include system prompt in calculation
 * @returns Total token count
 */
export function countMessagesTokens(
  messages: Array<{ role: string; content: string }>,
  model: string,
  includeSystemPrompt = true
): number {
  if (!messages || messages.length === 0) return 0;

  // Count tokens in all messages
  let totalTokens = 0;
  for (const msg of messages) {
    // Skip system prompts if requested
    if (!includeSystemPrompt && msg.role === 'system') continue;
    totalTokens += estimateTokenCount(msg.content, model);
  }

  // Add overhead: ~4 tokens per message for role, formatting, etc.
  totalTokens += messages.length * 4;

  return totalTokens;
}

/**
 * Estimate output tokens based on input and max_tokens parameter
 *
 * @param maxTokens - The max_tokens parameter passed to API
 * @param requestedTokens - Optional explicitly requested output tokens
 * @returns Estimated output token count
 */
export function estimateOutputTokens(
  maxTokens?: number,
  requestedTokens?: number
): number {
  if (requestedTokens) return requestedTokens;
  if (maxTokens) return maxTokens;

  // Default estimate: assume 500 tokens if not specified
  return 500;
}

/**
 * Check if total tokens exceed safe threshold
 * Safe threshold is 80% of context window (reserve 20% for buffer)
 *
 * @param inputTokens - Number of input tokens
 * @param outputTokens - Number of output tokens
 * @param model - The model being used
 * @param safetyMarginPercent - Percentage of context to reserve (default 20%)
 * @returns Result object with token counts and limit checks
 */
export function checkTokenLimit(
  inputTokens: number,
  outputTokens: number,
  model: string,
  safetyMarginPercent = 20
): TokenCountResult | TokenCountError {
  const config = MODEL_CONFIG[model];

  if (!config) {
    return {
      error: 'invalid_model',
      inputTokens,
      outputTokens,
      maxAllowed: 0,
      message: `Unknown model: ${model}`
    };
  }

  const contextWindow = config.contextWindow;
  const safeLimit = Math.floor(contextWindow * ((100 - safetyMarginPercent) / 100));
  const totalTokens = inputTokens + outputTokens;

  if (totalTokens > safeLimit) {
    return {
      error: 'context_limit_exceeded',
      inputTokens,
      outputTokens,
      maxAllowed: safeLimit,
      message: `Token limit exceeded: ${totalTokens} > ${safeLimit} (context window: ${contextWindow})`
    };
  }

  return {
    inputTokens,
    outputTokens,
    estimatedTotal: totalTokens,
    contextWindow,
    safeLimit,
    isWithinLimit: true
  };
}

/**
 * Validate request before calling LLM
 * Counts tokens and checks if within safe limits
 *
 * @param messages - Request messages (for chat-based APIs)
 * @param model - The model being used
 * @param maxTokens - max_tokens parameter
 * @param systemPrompt - Optional system prompt (counted separately)
 * @returns Either valid token counts or error object
 */
export function validateTokens(
  messages: Array<{ role: string; content: string }> | string,
  model: string,
  maxTokens?: number,
  systemPrompt?: string
): TokenCountResult | TokenCountError {
  try {
    // Count input tokens
    let inputTokens = 0;

    if (Array.isArray(messages)) {
      inputTokens = countMessagesTokens(messages, model, false);
    } else {
      inputTokens = countTokens(messages, model);
    }

    // Add system prompt if provided
    if (systemPrompt) {
      inputTokens += countTokens(systemPrompt, model);
    }

    // Estimate output tokens
    const outputTokens = estimateOutputTokens(maxTokens);

    // Check limits
    return checkTokenLimit(inputTokens, outputTokens, model);
  } catch (error) {
    return {
      error: 'unknown',
      inputTokens: 0,
      outputTokens: 0,
      maxAllowed: 0,
      message: `Token validation error: ${error}`
    };
  }
}

/**
 * Format token count error for API response
 *
 * @param errorResult - Error result from checkTokenLimit or validateTokens
 * @returns Formatted error object for API response
 */
export function formatTokenError(errorResult: TokenCountError): object {
  return {
    error: errorResult.error,
    message: errorResult.message,
    details: {
      inputTokens: errorResult.inputTokens,
      outputTokens: errorResult.outputTokens,
      totalTokens: errorResult.inputTokens + errorResult.outputTokens,
      maxAllowed: errorResult.maxAllowed
    }
  };
}

/**
 * Get context window for a model
 *
 * @param model - The model name
 * @returns Context window size in tokens, or null if unknown
 */
export function getContextWindow(model: string): number | null {
  return MODEL_CONFIG[model]?.contextWindow || null;
}

/**
 * Get all supported models
 */
export function getSupportedModels(): string[] {
  return Object.keys(MODEL_CONFIG);
}
