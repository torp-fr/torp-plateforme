/**
 * OpenAI Service
 * Wrapper for OpenAI API calls via Edge Functions sécurisées
 * SÉCURISÉ: Utilise les Edge Functions Supabase (pas de clé API côté client)
 */

import { secureAI } from './secure-ai.service';

export class OpenAIService {
  /**
   * Check if OpenAI is configured (via Edge Function)
   */
  isConfigured(): boolean {
    // Toujours configuré via Edge Function si l'utilisateur est authentifié
    return true;
  }

  /**
   * Generate completion with GPT-4 via Edge Function
   */
  async generateCompletion(
    prompt: string,
    options?: {
      model?: string;
      temperature?: number;
      maxTokens?: number;
      systemPrompt?: string;
    }
  ): Promise<string> {
    const {
      model = 'gpt-4o',
      temperature = 0.7,
      maxTokens = 4000,
      systemPrompt = 'You are a helpful assistant specialized in construction and renovation project analysis.',
    } = options || {};

    return secureAI.complete({
      messages: [{ role: 'user', content: prompt }],
      model,
      provider: 'openai',
      temperature,
      max_tokens: maxTokens,
      system: systemPrompt,
    });
  }

  /**
   * Generate structured JSON output via Edge Function
   */
  async generateJSON<T>(
    prompt: string,
    options?: {
      model?: string;
      temperature?: number;
      systemPrompt?: string;
    }
  ): Promise<T> {
    const {
      model = 'gpt-4o',
      temperature = 0.3,
      systemPrompt = 'You are a JSON-generating assistant. Always respond with valid JSON only.',
    } = options || {};

    return secureAI.completeJSON<T>({
      messages: [{ role: 'user', content: prompt }],
      model,
      provider: 'openai',
      temperature,
      system: systemPrompt + ' Return only valid JSON, no markdown or explanations.',
    });
  }

  /**
   * Generate embedding via secure Edge Function
   * Returns the embedding vector (1536 dimensions for text-embedding-3-small)
   */
  async generateEmbedding(text: string): Promise<{ data: number[] | null; error?: Error | null }> {
    try {
      const embedding = await secureAI.generateEmbedding(text, 'text-embedding-3-small');
      return { data: embedding };
    } catch (error) {
      console.error('[OpenAIService] Embedding generation failed:', error);
      return {
        data: null,
        error: error instanceof Error ? error : new Error(String(error))
      };
    }
  }
}

export const openAIService = new OpenAIService();
export default openAIService;
