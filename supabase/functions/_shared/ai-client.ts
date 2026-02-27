/**
 * AI Client for Supabase Edge Functions
 * Supports Claude API with automatic model fallback
 * Includes token counting & validation
 * Tracks LLM usage and costs
 */

import { validateTokens, type TokenCountResult, type TokenCountError } from './token-counter.ts';
import { trackLLMUsage, type LogRequest } from './llm-usage-logger.ts';

const CLAUDE_API_URL = 'https://api.anthropic.com/v1/messages';

// Models with fallback order (most stable first)
const CLAUDE_MODELS = [
  'claude-3-5-sonnet-20241022', // Primary - most stable
  'claude-sonnet-4-20250514',   // Secondary - newer
  'claude-3-5-haiku-20241022',  // Fallback - economical
];

export interface AIResponse {
  success: boolean;
  data?: any;
  error?: string;
  model?: string;
  tokens?: {
    estimated: number;
    actual?: number;
    input?: number;
    output?: number;
  };
  tokenValidation?: {
    inputTokens: number;
    outputTokens: number;
    estimatedTotal: number;
    safeLimit: number;
  };
  usage?: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    cost: number;
    latencyMs: number;
  };
}

export async function callClaude(
  prompt: string,
  systemPrompt: string,
  apiKey: string,
  maxTokens: number = 4096,
  skipTokenValidation: boolean = false,
  options?: {
    userId?: string;
    action?: string;
    sessionId?: string;
    supabaseClient?: any;
  }
): Promise<AIResponse> {
  let lastError: string | null = null;
  const startTime = Date.now();

  // Try each model in order
  for (const model of CLAUDE_MODELS) {
    try {
      console.log(`[AI Client] Trying model: ${model}`);

      // ============================================
      // TOKEN COUNTING & VALIDATION (unless skipped)
      // ============================================
      let tokenValidation: TokenCountResult | TokenCountError | null = null;

      if (!skipTokenValidation) {
        tokenValidation = validateTokens(
          [{ role: 'user', content: prompt }],
          model,
          maxTokens,
          systemPrompt
        );

        // Check if validation returned an error
        if (tokenValidation && 'error' in tokenValidation && tokenValidation.error !== undefined) {
          const errorData = tokenValidation as TokenCountError;
          console.warn('[AI Client] Token limit exceeded:', {
            model,
            inputTokens: errorData.inputTokens,
            outputTokens: errorData.outputTokens,
            maxAllowed: errorData.maxAllowed
          });

          return {
            success: false,
            error: `Context limit exceeded: ${errorData.message}`,
            model,
            tokenValidation: {
              inputTokens: errorData.inputTokens,
              outputTokens: errorData.outputTokens,
              estimatedTotal: errorData.inputTokens + errorData.outputTokens,
              safeLimit: errorData.maxAllowed
            }
          };
        }

        const validTokens = tokenValidation as TokenCountResult;
        console.log('[AI Client] Token validation passed:', {
          model,
          inputTokens: validTokens.inputTokens,
          outputTokens: validTokens.outputTokens,
          estimatedTotal: validTokens.estimatedTotal,
          safeLimit: validTokens.safeLimit
        });
      }

      const response = await fetch(CLAUDE_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model,
          max_tokens: maxTokens,
          system: systemPrompt,
          messages: [{ role: 'user', content: prompt }],
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();

        // If 404 (model not found), try next model
        if (response.status === 404 || errorText.toLowerCase().includes('model')) {
          console.warn(`[AI Client] Model ${model} not available, trying fallback...`);
          lastError = `Model ${model}: ${errorText}`;
          continue;
        }

        // For other errors, return immediately
        return { success: false, error: `Claude API error: ${errorText}`, model };
      }

      const result = await response.json();
      const content = result.content[0]?.text || '';
      const latencyMs = Date.now() - startTime;

      // Extract actual token usage from API response
      const actualInputTokens = result.usage?.input_tokens || 0;
      const actualOutputTokens = result.usage?.output_tokens || 0;
      const actualTotalTokens = actualInputTokens + actualOutputTokens;

      // Parse token usage from response
      const tokens = {
        estimated: tokenValidation && !('error' in tokenValidation) ? (tokenValidation as TokenCountResult).estimatedTotal : 0,
        actual: actualTotalTokens,
        input: actualInputTokens,
        output: actualOutputTokens
      };

      // ============================================
      // TRACK LLM USAGE & COST
      // ============================================
      if (options?.supabaseClient && options?.action) {
        const { calculateCost } = await import('./llm-pricing.ts');
        const costEstimate = calculateCost(model, actualInputTokens, actualOutputTokens);

        // Log usage asynchronously (don't block response)
        trackLLMUsage(options.supabaseClient, {
          userId: options.userId,
          action: options.action,
          model,
          inputTokens: actualInputTokens,
          outputTokens: actualOutputTokens,
          latencyMs,
          sessionId: options.sessionId
        }).catch(err => {
          console.error('[AI Client] Failed to track usage:', err);
        });

        console.log('[AI Client] Usage tracked:', {
          model,
          tokens: actualTotalTokens,
          cost: costEstimate.toFixed(6),
          latency: latencyMs
        });
      }

      // Calculate cost if we have token information
      const { calculateCost } = await import('./llm-pricing.ts');
      const costEstimate = calculateCost(model, actualInputTokens, actualOutputTokens);

      const usageInfo = {
        inputTokens: actualInputTokens,
        outputTokens: actualOutputTokens,
        totalTokens: actualTotalTokens,
        cost: costEstimate,
        latencyMs
      };

      // Try to parse JSON from response
      try {
        const jsonMatch = content.match(/```json\n?([\s\S]*?)\n?```/) ||
                          content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const jsonStr = jsonMatch[1] || jsonMatch[0];
          return {
            success: true,
            data: JSON.parse(jsonStr),
            model,
            tokens,
            usage: usageInfo,
            tokenValidation: tokenValidation && !('error' in tokenValidation)
              ? {
                  inputTokens: (tokenValidation as TokenCountResult).inputTokens,
                  outputTokens: (tokenValidation as TokenCountResult).outputTokens,
                  estimatedTotal: (tokenValidation as TokenCountResult).estimatedTotal,
                  safeLimit: (tokenValidation as TokenCountResult).safeLimit
                }
              : undefined
          };
        }
        return {
          success: true,
          data: content,
          model,
          tokens,
          usage: usageInfo,
          tokenValidation: tokenValidation && !('error' in tokenValidation)
            ? {
                inputTokens: (tokenValidation as TokenCountResult).inputTokens,
                outputTokens: (tokenValidation as TokenCountResult).outputTokens,
                estimatedTotal: (tokenValidation as TokenCountResult).estimatedTotal,
                safeLimit: (tokenValidation as TokenCountResult).safeLimit
              }
            : undefined
        };
      } catch {
        const { calculateCost: calcCost } = await import('./llm-pricing.ts');
        const fallbackCost = calcCost(model, actualInputTokens, actualOutputTokens);

        return {
          success: true,
          data: content,
          model,
          tokens,
          usage: {
            inputTokens: actualInputTokens,
            outputTokens: actualOutputTokens,
            totalTokens: actualTotalTokens,
            cost: fallbackCost,
            latencyMs
          },
          tokenValidation: tokenValidation && !('error' in tokenValidation)
            ? {
                inputTokens: (tokenValidation as TokenCountResult).inputTokens,
                outputTokens: (tokenValidation as TokenCountResult).outputTokens,
                estimatedTotal: (tokenValidation as TokenCountResult).estimatedTotal,
                safeLimit: (tokenValidation as TokenCountResult).safeLimit
              }
            : undefined
        };
      }
    } catch (error) {
      lastError = String(error);
      console.error(`[AI Client] Error with model ${model}:`, error);

      // If it looks like a network error, try next model
      if (String(error).includes('network') || String(error).includes('fetch')) {
        continue;
      }

      // For other errors, return
      return { success: false, error: lastError, model };
    }
  }

  // All models failed
  return { success: false, error: `All Claude models failed. Last error: ${lastError}` };
}

/**
 * Generate embeddings with OpenAI
 * Centralizes all embedding requests through this function
 * Automatically tracks usage and costs
 */
export async function generateEmbedding(
  text: string,
  apiKey: string,
  model: string = 'text-embedding-3-small',
  options?: {
    userId?: string;
    sessionId?: string;
    supabaseClient?: any;
  }
): Promise<{
  embedding: number[];
  usage?: {
    prompt_tokens: number;
  };
}> {
  const startTime = Date.now();

  const response = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ model, input: text }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Embedding API error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  const latencyMs = Date.now() - startTime;
  const inputTokens = data.usage?.prompt_tokens || 0;

  // Track usage
  if (options?.supabaseClient && options?.sessionId) {
    const { calculateCost } = await import('./llm-pricing.ts');
    const cost = calculateCost(model, inputTokens, 0);

    trackLLMUsage(options.supabaseClient, {
      action: 'embedding',
      model,
      inputTokens,
      outputTokens: 0,
      latencyMs,
      userId: options?.userId,
      sessionId: options?.sessionId
    }).catch(err => console.error('[Embedding] Tracking failed:', err));

    console.log('[Embedding] Usage tracked:', {
      model,
      tokens: inputTokens,
      cost: cost.toFixed(6),
      latency: latencyMs
    });
  }

  return {
    embedding: data.data[0].embedding,
    usage: data.usage
  };
}

/**
 * Analyze images with GPT-4 Vision
 * Centralizes all vision API requests
 * Automatically tracks usage and costs
 */
export async function analyzeImage(
  imageBase64: string,
  mediaType: string,
  apiKey: string,
  options?: {
    analysisType?: string;
    systemPrompt?: string;
    userId?: string;
    sessionId?: string;
    supabaseClient?: any;
  }
): Promise<{
  analysis: string;
  usage?: { input_tokens: number; output_tokens: number };
}> {
  const startTime = Date.now();

  const systemPrompt = options?.systemPrompt ||
    'You are an expert in analyzing construction and renovation project photos.';

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: [
            {
              type: 'image_url',
              image_url: {
                url: `data:${mediaType};base64,${imageBase64}`,
                detail: 'high'
              }
            }
          ]
        }
      ],
      max_tokens: 2000
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Vision API error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  const latencyMs = Date.now() - startTime;
  const inputTokens = data.usage?.prompt_tokens || 0;
  const outputTokens = data.usage?.completion_tokens || 0;

  // Track usage
  if (options?.supabaseClient && options?.sessionId) {
    const { calculateCost } = await import('./llm-pricing.ts');
    const cost = calculateCost('gpt-4o', inputTokens, outputTokens);

    trackLLMUsage(options.supabaseClient, {
      action: options?.analysisType || 'analyze-image',
      model: 'gpt-4o',
      inputTokens,
      outputTokens,
      latencyMs,
      userId: options?.userId,
      sessionId: options?.sessionId
    }).catch(err => console.error('[Vision] Tracking failed:', err));

    console.log('[Vision] Usage tracked:', {
      model: 'gpt-4o',
      tokens: inputTokens + outputTokens,
      cost: cost.toFixed(6),
      latency: latencyMs
    });
  }

  return {
    analysis: data.choices[0]?.message?.content || '',
    usage: data.usage
  };
}

/**
 * Call OpenAI API for chat completions
 * Centralizes all OpenAI completion requests
 * Automatically tracks usage and costs
 */
export async function callOpenAI(
  userPrompt: string,
  systemPrompt: string,
  apiKey: string,
  options?: {
    model?: string;
    maxTokens?: number;
    temperature?: number;
    userId?: string;
    sessionId?: string;
    supabaseClient?: any;
  }
): Promise<AIResponse> {
  const startTime = Date.now();
  const model = options?.model || 'gpt-4o';
  const maxTokens = options?.maxTokens || 2000;
  const temperature = options?.temperature || 0.7;

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      max_tokens: maxTokens,
      temperature
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenAI API error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  const latencyMs = Date.now() - startTime;
  const inputTokens = data.usage?.prompt_tokens || 0;
  const outputTokens = data.usage?.completion_tokens || 0;

  // Track usage
  if (options?.supabaseClient && options?.sessionId) {
    const { calculateCost } = await import('./llm-pricing.ts');
    const cost = calculateCost(model, inputTokens, outputTokens);

    trackLLMUsage(options.supabaseClient, {
      action: 'completion',
      model,
      inputTokens,
      outputTokens,
      latencyMs,
      userId: options?.userId,
      sessionId: options?.sessionId
    }).catch(err => console.error('[OpenAI] Tracking failed:', err));

    console.log('[OpenAI] Usage tracked:', {
      model,
      tokens: inputTokens + outputTokens,
      cost: cost.toFixed(6),
      latency: latencyMs
    });
  }

  const content = data.choices[0]?.message?.content || '';

  return {
    success: true,
    data: content,
    model,
    tokens: {
      estimated: inputTokens + outputTokens,
      actual: inputTokens + outputTokens,
      input: inputTokens,
      output: outputTokens
    },
    usage: {
      inputTokens,
      outputTokens,
      totalTokens: inputTokens + outputTokens,
      cost: (await import('./llm-pricing.ts')).calculateCost(model, inputTokens, outputTokens),
      latencyMs
    }
  };
}
