/**
 * OpenAI Service
 * Wrapper for OpenAI API calls
 */

import OpenAI from 'openai';
import { env } from '@/config/env';

export class OpenAIService {
  private client: OpenAI | null = null;

  constructor() {
    if (env.ai.openai?.apiKey) {
      this.client = new OpenAI({
        apiKey: env.ai.openai.apiKey,
        dangerouslyAllowBrowser: true, // Required for client-side usage
      });
    }
  }

  /**
   * Check if OpenAI is configured
   */
  isConfigured(): boolean {
    return this.client !== null;
  }

  /**
   * Generate completion with GPT-4
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
    if (!this.client) {
      throw new Error('OpenAI is not configured');
    }

    const {
      model = 'gpt-4o',
      temperature = 0.7,
      maxTokens = 4000,
      systemPrompt = 'You are a helpful assistant specialized in construction and renovation project analysis.',
    } = options || {};

    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: prompt },
    ];

    try {
      const completion = await this.client.chat.completions.create({
        model,
        messages,
        temperature,
        max_tokens: maxTokens,
      });

      return completion.choices[0]?.message?.content || '';
    } catch (error) {
      console.error('OpenAI API Error:', error);
      throw new Error(`OpenAI API call failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Generate structured JSON output
   */
  async generateJSON<T>(
    prompt: string,
    options?: {
      model?: string;
      temperature?: number;
      systemPrompt?: string;
    }
  ): Promise<T> {
    if (!this.client) {
      throw new Error('OpenAI is not configured');
    }

    const {
      model = 'gpt-4o',
      temperature = 0.3, // Lower temperature for more consistent JSON
      systemPrompt = 'You are a JSON-generating assistant. Always respond with valid JSON only.',
    } = options || {};

    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      { role: 'system', content: systemPrompt + ' Return only valid JSON, no markdown or explanations.' },
      { role: 'user', content: prompt },
    ];

    try {
      const completion = await this.client.chat.completions.create({
        model,
        messages,
        temperature,
        response_format: { type: 'json_object' },
      });

      const content = completion.choices[0]?.message?.content || '{}';
      return JSON.parse(content) as T;
    } catch (error) {
      console.error('OpenAI JSON Generation Error:', error);
      throw new Error(`OpenAI JSON generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

export const openAIService = new OpenAIService();
export default openAIService;
