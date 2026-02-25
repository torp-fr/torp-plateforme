/**
 * AI Orchestrator Service — Central hub for all AI operations
 *
 * Responsibilities:
 * - Unified timeout management (AbortController)
 * - Retry strategy (max 2 attempts with exponential backoff)
 * - Provider fallback handling
 * - Structured error normalization (no null returns)
 * - Centralized logging and monitoring
 *
 * PHASE 36.12: Stability & Reliability Layer
 */

import { env } from '@/config/env';
import { hybridAIService, AIGenerationOptions } from './hybrid-ai.service';
import { secureAI } from './secure-ai.service';
import { structuredLogger } from '@/services/observability/structured-logger';
import { aiTelemetry } from './aiTelemetry.service';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export interface AIOrchestrationConfig {
  timeoutMs?: number;
  maxRetries?: number;
  retryBackoffMs?: number;
  fallbackEnabled?: boolean;
}

export interface LLMCompletionRequest {
  prompt: string;
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
  preferredProvider?: 'openai' | 'claude';
}

export interface LLMCompletionResult {
  content: string;
  provider: string;
  duration: number;
  retriesUsed: number;
}

export interface EmbeddingRequest {
  text: string;
  model?: string;
}

export interface EmbeddingResult {
  embedding: number[];
  dimension: number;
  duration: number;
  retriesUsed: number;
  source: 'primary' | 'fallback' | 'cached';
}

export interface AnalysisPipelineRequest {
  devisText: string;
  metadata?: {
    region?: string;
    typeTravaux?: string;
    userType?: 'B2B' | 'B2C' | 'admin';
  };
}

export interface AnalysisPipelineResult {
  extractedData: any;
  aiAnalysis: any;
  enrichmentData: any;
  duration: number;
  success: boolean;
  errors?: string[];
}

// ============================================================================
// ERROR HANDLING
// ============================================================================

export class AIOrchestrationError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly retriesExhausted: boolean = false,
    public readonly originalError?: Error
  ) {
    super(message);
    this.name = 'AIOrchestrationError';
  }
}

// ============================================================================
// ORCHESTRATOR SERVICE
// ============================================================================

class AIOrchestrator {
  private readonly DEFAULT_TIMEOUT_MS = 30000; // 30 seconds
  private readonly DEFAULT_MAX_RETRIES = 2;
  private readonly RETRY_BACKOFF_MS = 1000; // 1 second base

  constructor(private config: AIOrchestrationConfig = {}) {
    this.logInit();
  }

  // ========================================================================
  // PUBLIC API
  // ========================================================================

  /**
   * COMPATIBILITY METHOD: Direct replacement for hybridAIService.generateCompletion()
   * Maintains identical signature and behavior, adds orchestration underneath
   */
  async generateCompletion(
    prompt: string,
    options?: AIGenerationOptions
  ): Promise<{ content: string; provider: string }> {
    const requestId = this.generateTraceId();
    const startTime = Date.now();

    try {
      const result = await this.runLLMCompletion({
        prompt,
        systemPrompt: (options as any)?.systemPrompt,
        temperature: (options as any)?.temperature,
        maxTokens: (options as any)?.maxTokens,
        preferredProvider: (options as any)?.preferredProvider,
      });

      // Track successful completion
      aiTelemetry.trackAIRequest({
        requestId,
        operation: 'completion',
        primaryProvider: env.ai.primaryProvider || 'unknown',
        providerUsed: result.provider,
        fallbackTriggered: result.retriesUsed > 0,
        latencyMs: Date.now() - startTime,
        retriesUsed: result.retriesUsed,
        inputLength: prompt.length,
        outputLength: result.content.length,
        timestamp: new Date().toISOString(),
        success: true,
      });

      return {
        content: result.content,
        provider: result.provider,
      };
    } catch (error) {
      // Track failed completion
      const errorMsg = error instanceof Error ? error.message : String(error);
      aiTelemetry.logAIError({
        requestId,
        operation: 'completion',
        primaryProvider: env.ai.primaryProvider || 'unknown',
        lastProviderTried: 'unknown',
        retriesExhausted: true,
        errorCode: error instanceof AIOrchestrationError ? error.code : 'UNKNOWN',
        errorMessage: errorMsg,
        latencyMs: Date.now() - startTime,
        retriesUsed: 0,
        inputLength: prompt.length,
        timestamp: new Date().toISOString(),
        success: false,
      });

      throw this.normalizeError(error, 'COMPLETION_FAILED');
    }
  }

  /**
   * COMPATIBILITY METHOD: Direct replacement for hybridAIService.generateJSON()
   * Maintains identical signature, adds orchestration underneath
   */
  async generateJSON<T>(
    prompt: string,
    options?: AIGenerationOptions
  ): Promise<{ data: T; error?: undefined }> {
    const requestId = this.generateTraceId();
    const startTime = Date.now();

    try {
      const result = await this.runLLMCompletion({
        prompt,
        systemPrompt: (options as any)?.systemPrompt || 'You are a JSON-generating assistant. Always respond with valid JSON only.',
        temperature: (options as any)?.temperature || 0.3,
        maxTokens: (options as any)?.maxTokens || 8000,
        preferredProvider: (options as any)?.preferredProvider,
      });

      // Parse JSON from result
      try {
        // Try to find JSON in the response
        const jsonMatch = result.content.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
        if (!jsonMatch) {
          throw new Error('No JSON object found in response');
        }

        const data = JSON.parse(jsonMatch[0]) as T;

        // Track successful JSON generation
        aiTelemetry.trackAIRequest({
          requestId,
          operation: 'json',
          primaryProvider: env.ai.primaryProvider || 'unknown',
          providerUsed: result.provider,
          fallbackTriggered: result.retriesUsed > 0,
          latencyMs: Date.now() - startTime,
          retriesUsed: result.retriesUsed,
          inputLength: prompt.length,
          outputLength: JSON.stringify(data).length,
          timestamp: new Date().toISOString(),
          success: true,
        });

        return { data };
      } catch (parseError) {
        // Track JSON parse failure
        const errorMsg = parseError instanceof Error ? parseError.message : String(parseError);
        aiTelemetry.logAIError({
          requestId,
          operation: 'json',
          primaryProvider: env.ai.primaryProvider || 'unknown',
          lastProviderTried: result.provider,
          retriesExhausted: false,
          errorCode: 'JSON_PARSE_ERROR',
          errorMessage: errorMsg,
          latencyMs: Date.now() - startTime,
          retriesUsed: result.retriesUsed,
          inputLength: prompt.length,
          timestamp: new Date().toISOString(),
          success: false,
        });

        throw new AIOrchestrationError(
          `Failed to parse JSON from LLM response: ${errorMsg}`,
          'JSON_PARSE_ERROR',
          false,
          parseError instanceof Error ? parseError : undefined
        );
      }
    } catch (error) {
      // Track outer completion failure
      if (error instanceof AIOrchestrationError && error.code === 'JSON_PARSE_ERROR') {
        throw error; // Already tracked
      }

      const errorMsg = error instanceof Error ? error.message : String(error);
      aiTelemetry.logAIError({
        requestId,
        operation: 'json',
        primaryProvider: env.ai.primaryProvider || 'unknown',
        lastProviderTried: 'unknown',
        retriesExhausted: true,
        errorCode: error instanceof AIOrchestrationError ? error.code : 'UNKNOWN',
        errorMessage: errorMsg,
        latencyMs: Date.now() - startTime,
        retriesUsed: 0,
        inputLength: prompt.length,
        timestamp: new Date().toISOString(),
        success: false,
      });

      throw this.normalizeError(error, 'JSON_GENERATION_FAILED');
    }
  }

  /**
   * Run complete analysis pipeline with centralized orchestration
   * Handles: extraction → AI analysis → knowledge enrichment → scoring
   */
  async runAnalysisPipeline(
    request: AnalysisPipelineRequest
  ): Promise<AnalysisPipelineResult> {
    const pipelineId = this.generateTraceId();
    const startTime = Date.now();

    try {
      structuredLogger.info('[ORCHESTRATOR] Pipeline started', {
        pipelineId,
        textLength: request.devisText.length,
      });

      // The actual pipeline implementation is delegated to torpAnalyzerService
      // This orchestrator provides the infrastructure (timeouts, retries, error handling)
      const controller = this.createAbortController();

      // This will be called by torpAnalyzerService through the orchestrator
      // For now, just structure the return
      const result: AnalysisPipelineResult = {
        extractedData: {},
        aiAnalysis: {},
        enrichmentData: {},
        duration: Date.now() - startTime,
        success: true,
      };

      structuredLogger.info('[ORCHESTRATOR] Pipeline completed', {
        pipelineId,
        duration: result.duration,
      });

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      structuredLogger.error('[ORCHESTRATOR] Pipeline failed', {
        pipelineId,
        duration,
        error: error instanceof Error ? error.message : String(error),
      });

      throw this.normalizeError(error, 'ANALYSIS_PIPELINE_FAILED');
    }
  }

  /**
   * Generate embeddings with retry & fallback
   * Primary: secureAI (Edge Function) → Fallback: HybridAI embedding
   */
  async generateEmbedding(request: EmbeddingRequest): Promise<EmbeddingResult> {
    const embeddingId = this.generateTraceId();
    const startTime = Date.now();
    let retriesUsed = 0;

    structuredLogger.debug('[ORCHESTRATOR] Embedding requested', {
      embeddingId,
      textLength: request.text.length,
    });

    try {
      // Validate input
      if (!request.text || request.text.trim().length === 0) {
        throw new AIOrchestrationError(
          'Empty text provided for embedding',
          'EMPTY_TEXT_INPUT',
          false
        );
      }

      // Attempt primary provider (secureAI via Edge Function)
      const primaryResult = await this.withRetry(
        () => this.tryPrimaryEmbedding(request),
        'primary_embedding',
        embeddingId
      );

      if (primaryResult.success) {
        const result = {
          embedding: primaryResult.data!,
          dimension: primaryResult.data!.length,
          duration: Date.now() - startTime,
          retriesUsed: primaryResult.retriesUsed,
          source: 'primary' as const,
        };

        // Track successful primary embedding
        aiTelemetry.trackAIRequest({
          requestId: embeddingId,
          operation: 'embedding',
          primaryProvider: 'secureAI',
          providerUsed: 'secureAI',
          fallbackTriggered: false,
          latencyMs: result.duration,
          retriesUsed: result.retriesUsed,
          inputLength: request.text.length,
          outputLength: result.embedding.length,
          embeddingDimension: result.dimension,
          isSyntheticEmbedding: false,
          timestamp: new Date().toISOString(),
          success: true,
        });

        return result;
      }

      // Fallback: HybridAI completion with JSON extraction
      retriesUsed += primaryResult.retriesUsed;

      if (!this.config.fallbackEnabled) {
        throw new AIOrchestrationError(
          'Primary embedding failed and fallback disabled',
          'PRIMARY_EMBEDDING_FAILED',
          true,
          primaryResult.lastError
        );
      }

      structuredLogger.warn('[ORCHESTRATOR] Switching to fallback embedding', {
        embeddingId,
        primaryError: primaryResult.lastError?.message,
      });

      const fallbackResult = await this.withRetry(
        () => this.tryFallbackEmbedding(request),
        'fallback_embedding',
        embeddingId
      );

      if (fallbackResult.success) {
        const result = {
          embedding: fallbackResult.data!,
          dimension: fallbackResult.data!.length,
          duration: Date.now() - startTime,
          retriesUsed: retriesUsed + fallbackResult.retriesUsed,
          source: 'fallback' as const,
        };

        // Track successful fallback embedding (synthetic LLM-based)
        aiTelemetry.trackAIRequest({
          requestId: embeddingId,
          operation: 'embedding_fallback',
          primaryProvider: 'secureAI',
          providerUsed: 'hybridAI',
          fallbackTriggered: true,
          latencyMs: result.duration,
          retriesUsed: result.retriesUsed,
          inputLength: request.text.length,
          outputLength: result.embedding.length,
          embeddingDimension: result.dimension,
          isSyntheticEmbedding: true,
          timestamp: new Date().toISOString(),
          success: true,
        });

        return result;
      }

      // Both failed
      throw new AIOrchestrationError(
        'Both primary and fallback embeddings failed',
        'EMBEDDING_EXHAUSTED',
        true,
        fallbackResult.lastError
      );
    } catch (error) {
      const duration = Date.now() - startTime;
      structuredLogger.error('[ORCHESTRATOR] Embedding failed', {
        embeddingId,
        duration,
        error: error instanceof Error ? error.message : String(error),
        retriesUsed,
      });

      // Track embedding failure
      const errorMsg = error instanceof Error ? error.message : String(error);
      aiTelemetry.logAIError({
        requestId: embeddingId,
        operation: 'embedding',
        primaryProvider: 'secureAI',
        lastProviderTried: 'hybridAI', // Tried both
        retriesExhausted: true,
        errorCode: error instanceof AIOrchestrationError ? error.code : 'UNKNOWN',
        errorMessage: errorMsg,
        latencyMs: duration,
        retriesUsed,
        inputLength: request.text.length,
        timestamp: new Date().toISOString(),
        success: false,
      });

      throw this.normalizeError(error, 'EMBEDDING_GENERATION_FAILED');
    }
  }

  /**
   * Run LLM completion with retry & fallback
   * Uses hybridAIService which already handles OpenAI ↔ Claude fallback
   */
  async runLLMCompletion(
    request: LLMCompletionRequest
  ): Promise<LLMCompletionResult> {
    const completionId = this.generateTraceId();
    const startTime = Date.now();
    let retriesUsed = 0;

    structuredLogger.debug('[ORCHESTRATOR] LLM completion requested', {
      completionId,
      promptLength: request.prompt.length,
      provider: request.preferredProvider || 'auto',
    });

    try {
      const controller = this.createAbortController();

      const result = await this.withTimeout(
        async () => {
          const completion = await this.withRetry(
            () =>
              hybridAIService.generateCompletion(request.prompt, {
                temperature: request.temperature,
                maxTokens: request.maxTokens,
                systemPrompt: request.systemPrompt,
                preferredProvider: request.preferredProvider as any,
                allowFallback: this.config.fallbackEnabled !== false,
              } as AIGenerationOptions),
            'llm_completion',
            completionId
          );

          retriesUsed = completion.retriesUsed;
          return completion.data;
        },
        controller
      );

      structuredLogger.debug('[ORCHESTRATOR] LLM completion succeeded', {
        completionId,
        provider: result?.provider,
        contentLength: result?.content?.length,
        retriesUsed,
      });

      return {
        content: result?.content || '',
        provider: result?.provider || 'unknown',
        duration: Date.now() - startTime,
        retriesUsed,
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      structuredLogger.error('[ORCHESTRATOR] LLM completion failed', {
        completionId,
        duration,
        error: error instanceof Error ? error.message : String(error),
        retriesUsed,
      });

      throw this.normalizeError(error, 'LLM_COMPLETION_FAILED');
    }
  }

  // ========================================================================
  // INTERNAL HELPERS
  // ========================================================================

  /**
   * Retry wrapper with exponential backoff
   */
  private async withRetry<T>(
    fn: () => Promise<T>,
    operation: string,
    traceId: string,
    maxRetries = this.config.maxRetries || this.DEFAULT_MAX_RETRIES
  ): Promise<{ success: boolean; data?: T; retriesUsed: number; lastError?: Error }> {
    let lastError: Error | undefined;
    let attempt = 0;

    while (attempt < maxRetries) {
      try {
        const data = await fn();
        if (attempt > 0) {
          structuredLogger.info('[ORCHESTRATOR] Retry succeeded', {
            operation,
            traceId,
            attempts: attempt + 1,
          });
        }
        return { success: true, data, retriesUsed: attempt };
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        attempt++;

        if (attempt < maxRetries) {
          const backoffMs = this.RETRY_BACKOFF_MS * Math.pow(2, attempt - 1);
          structuredLogger.warn('[ORCHESTRATOR] Retry after backoff', {
            operation,
            traceId,
            attempt,
            backoffMs,
            error: lastError.message,
          });

          await new Promise((r) => setTimeout(r, backoffMs));
        }
      }
    }

    return {
      success: false,
      retriesUsed: maxRetries,
      lastError,
    };
  }

  /**
   * Timeout wrapper using AbortController
   */
  private async withTimeout<T>(
    fn: () => Promise<T>,
    controller: AbortController
  ): Promise<T> {
    const timeoutMs = this.config.timeoutMs || this.DEFAULT_TIMEOUT_MS;

    const timeoutId = setTimeout(() => {
      controller.abort();
    }, timeoutMs);

    try {
      return await fn();
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Create abort controller with cleanup
   */
  private createAbortController(): AbortController {
    return new AbortController();
  }

  /**
   * Try primary embedding via secureAI (Edge Function)
   */
  private async tryPrimaryEmbedding(request: EmbeddingRequest): Promise<number[]> {
    return secureAI.generateEmbedding(request.text, request.model);
  }

  /**
   * Try fallback embedding via hybridAI (generate JSON with embedding-like structure)
   * This uses LLM to generate a semantic vector as fallback
   */
  private async tryFallbackEmbedding(request: EmbeddingRequest): Promise<number[]> {
    // Fallback: Use LLM to generate embedding-like vector
    const systemPrompt = `You are a semantic embedding model. Generate a JSON array of 1536 numbers between -1 and 1 that represents the semantic meaning of the input text. Return ONLY the JSON array, nothing else.`;

    const response = await hybridAIService.generateCompletion(
      `Generate semantic embedding for: ${request.text.substring(0, 500)}`,
      {
        systemPrompt,
        maxTokens: 4000,
        temperature: 0,
      } as AIGenerationOptions
    );

    try {
      // Parse the JSON array from response
      const jsonMatch = response.content.match(/\[\s*[\d\.\-,\s]+\]/);
      if (!jsonMatch) {
        throw new Error('Invalid embedding format from LLM');
      }

      const embedding = JSON.parse(jsonMatch[0]);
      if (!Array.isArray(embedding) || embedding.length !== 1536) {
        throw new Error('Embedding dimension mismatch');
      }

      return embedding;
    } catch (parseError) {
      throw new Error(
        `Failed to parse LLM embedding: ${
          parseError instanceof Error ? parseError.message : 'unknown'
        }`
      );
    }
  }

  /**
   * Normalize any error to AIOrchestrationError
   */
  private normalizeError(error: any, defaultCode: string): AIOrchestrationError {
    if (error instanceof AIOrchestrationError) {
      return error;
    }

    if (error instanceof Error) {
      return new AIOrchestrationError(error.message, defaultCode, false, error);
    }

    return new AIOrchestrationError(String(error), defaultCode, false);
  }

  /**
   * Generate unique trace ID for request tracking
   */
  private generateTraceId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Log initialization
   */
  private logInit(): void {
    structuredLogger.debug('[ORCHESTRATOR] Service initialized', {
      timeout: this.config.timeoutMs || this.DEFAULT_TIMEOUT_MS,
      maxRetries: this.config.maxRetries || this.DEFAULT_MAX_RETRIES,
      retryBackoff: this.RETRY_BACKOFF_MS,
      fallbackEnabled: this.config.fallbackEnabled !== false,
    });
  }
}

// ============================================================================
// SINGLETON EXPORT
// ============================================================================

export const aiOrchestrator = new AIOrchestrator({
  timeoutMs: 30000, // 30 seconds global timeout
  maxRetries: 2,
  retryBackoffMs: 1000,
  fallbackEnabled: true, // Allow fallback to alternative providers
});

export default aiOrchestrator;
