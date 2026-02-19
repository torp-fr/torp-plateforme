/**
 * Hybrid AI Service
 * Orchestrates OpenAI and Claude with intelligent fallback
 */

import { env } from '@/config/env';
import { openAIService } from './openai.service';
import { claudeService } from './claude.service';

export type AIProvider = 'openai' | 'claude';

export interface AIGenerationOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  systemPrompt?: string;
  preferredProvider?: AIProvider;
  allowFallback?: boolean;
}

export class HybridAIService {
  /**
   * Get the primary provider based on configuration
   */
  private getPrimaryProvider(): AIProvider {
    return env.ai.primaryProvider;
  }

  /**
   * Get the fallback provider
   */
  private getFallbackProvider(primary: AIProvider): AIProvider {
    return primary === 'openai' ? 'claude' : 'openai';
  }

  /**
   * Check if a provider is configured
   */
  private isProviderConfigured(provider: AIProvider): boolean {
    return provider === 'openai'
      ? openAIService.isConfigured()
      : claudeService.isConfigured();
  }

  /**
   * Select the best available provider
   */
  private selectProvider(preferredProvider?: AIProvider): AIProvider {
    // Use preferred provider if specified and available
    if (preferredProvider && this.isProviderConfigured(preferredProvider)) {
      return preferredProvider;
    }

    // Use primary provider from config if available
    const primary = this.getPrimaryProvider();
    if (this.isProviderConfigured(primary)) {
      return primary;
    }

    // Fall back to alternative provider
    const fallback = this.getFallbackProvider(primary);
    if (this.isProviderConfigured(fallback)) {
      return fallback;
    }

    throw new Error('No AI provider is configured. Please add OpenAI or Anthropic API keys.');
  }

  /**
   * Generate text completion with automatic fallback
   */
  async generateCompletion(
    prompt: string,
    options?: AIGenerationOptions
  ): Promise<{ content: string; provider: AIProvider }> {
    const { allowFallback = env.ai.fallbackEnabled, ...generationOptions } = options || {};

    const primaryProvider = this.selectProvider(options?.preferredProvider);

    try {
      if (env.app.debugMode) {
        console.log(`[HybridAI] Using ${primaryProvider} for text generation`);
      }

      const content = primaryProvider === 'openai'
        ? await openAIService.generateCompletion(prompt, generationOptions)
        : await claudeService.generateCompletion(prompt, generationOptions);

      return { content, provider: primaryProvider };
    } catch (error) {
      if (!allowFallback) {
        throw error;
      }

      const fallbackProvider = this.getFallbackProvider(primaryProvider);

      if (!this.isProviderConfigured(fallbackProvider)) {
        throw error;
      }

      console.warn(`[HybridAI] ${primaryProvider} failed, falling back to ${fallbackProvider}`);

      try {
        const content = fallbackProvider === 'openai'
          ? await openAIService.generateCompletion(prompt, generationOptions)
          : await claudeService.generateCompletion(prompt, generationOptions);

        return { content, provider: fallbackProvider };
      } catch (fallbackError) {
        console.error('[HybridAI] Both providers failed');
        throw new Error(
          `AI generation failed: ${error instanceof Error ? error.message : 'Unknown error'}` +
          `\nFallback also failed: ${fallbackError instanceof Error ? fallbackError.message : 'Unknown error'}`
        );
      }
    }
  }

  /**
   * Generate structured JSON with automatic fallback
   */
  async generateJSON<T>(
    prompt: string,
    options?: AIGenerationOptions
  ): Promise<{ data: T; provider: AIProvider }> {
    const { allowFallback = env.ai.fallbackEnabled, ...generationOptions } = options || {};

    const primaryProvider = this.selectProvider(options?.preferredProvider);

    try {
      if (env.app.debugMode) {
        console.log(`[HybridAI] Using ${primaryProvider} for JSON generation`);
      }

      const data = primaryProvider === 'openai'
        ? await openAIService.generateJSON<T>(prompt, generationOptions)
        : await claudeService.generateJSON<T>(prompt, generationOptions);

      return { data, provider: primaryProvider };
    } catch (error) {
      if (!allowFallback) {
        throw error;
      }

      const fallbackProvider = this.getFallbackProvider(primaryProvider);

      if (!this.isProviderConfigured(fallbackProvider)) {
        throw error;
      }

      console.warn(`[HybridAI] ${primaryProvider} JSON generation failed, falling back to ${fallbackProvider}`);

      try {
        const data = fallbackProvider === 'openai'
          ? await openAIService.generateJSON<T>(prompt, generationOptions)
          : await claudeService.generateJSON<T>(prompt, generationOptions);

        return { data, provider: fallbackProvider };
      } catch (fallbackError) {
        console.error('[HybridAI] Both providers failed for JSON generation');
        throw new Error(
          `AI JSON generation failed: ${error instanceof Error ? error.message : 'Unknown error'}` +
          `\nFallback also failed: ${fallbackError instanceof Error ? fallbackError.message : 'Unknown error'}`
        );
      }
    }
  }

  /**
   * Get provider status information
   */
  getStatus() {
    return {
      primary: env.ai.primaryProvider,
      fallbackEnabled: env.ai.fallbackEnabled,
      providers: {
        openai: {
          configured: openAIService.isConfigured(),
          available: openAIService.isConfigured(),
        },
        claude: {
          configured: claudeService.isConfigured(),
          available: claudeService.isConfigured(),
        },
      },
    };
  }

  /**
   * Generate embedding via OpenAI (embeddings are not available from Claude)
   */
  async generateEmbedding(text: string): Promise<{ data: number[] | null; error?: Error | null }> {
    try {
      if (env.app.debugMode) {
        console.log('[HybridAI] Generating embedding via OpenAI');
      }

      return await openAIService.generateEmbedding(text);
    } catch (error) {
      console.error('[HybridAI] Embedding generation failed:', error);
      return {
        data: null,
        error: error instanceof Error ? error : new Error(String(error))
      };
    }
  }
}

export const hybridAIService = new HybridAIService();
export default hybridAIService;
