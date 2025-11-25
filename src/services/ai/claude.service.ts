/**
 * Anthropic Claude Service
 * Wrapper for Anthropic Claude API calls
 */

import Anthropic from '@anthropic-ai/sdk';
import { env } from '@/config/env';

export class ClaudeService {
  private client: Anthropic | null = null;

  constructor() {
    if (env.ai.anthropic?.apiKey) {
      this.client = new Anthropic({
        apiKey: env.ai.anthropic.apiKey,
        dangerouslyAllowBrowser: true, // Required for client-side usage
      });
    }
  }

  /**
   * Check if Claude is configured
   */
  isConfigured(): boolean {
    return this.client !== null;
  }

  /**
   * Generate completion with Claude
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
      throw new Error('Claude is not configured');
    }

    const {
      model = 'claude-3-5-sonnet-20241022',
      temperature = 0.7,
      maxTokens = 4000,
      systemPrompt = 'You are a helpful assistant specialized in construction and renovation project analysis.',
    } = options || {};

    try {
      const message = await this.client.messages.create({
        model,
        max_tokens: maxTokens,
        temperature,
        system: systemPrompt,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
      });

      const textBlock = message.content.find((block) => block.type === 'text');
      return textBlock && textBlock.type === 'text' ? textBlock.text : '';
    } catch (error) {
      console.error('Claude API Error:', error);
      throw new Error(`Claude API call failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
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
      throw new Error('Claude is not configured');
    }

    const {
      model = 'claude-3-5-sonnet-20241022',
      temperature = 0.3, // Lower temperature for more consistent JSON
      systemPrompt = 'You are a JSON-generating assistant. Always respond with valid JSON only.',
    } = options || {};

    try {
      const message = await this.client.messages.create({
        model,
        max_tokens: 4000,
        temperature,
        system: systemPrompt + ' Return only valid JSON, no markdown or explanations.',
        messages: [
          {
            role: 'user',
            content: prompt + '\n\nIMPORTANT: Return ONLY valid JSON without any markdown formatting, code blocks, or explanations.',
          },
        ],
      });

      const textBlock = message.content.find((block) => block.type === 'text');
      const content = textBlock && textBlock.type === 'text' ? textBlock.text : '{}';

      // Remove markdown code blocks if present
      const cleanedContent = content
        .replace(/```json\n?/g, '')
        .replace(/```\n?/g, '')
        .trim();

      return JSON.parse(cleanedContent) as T;
    } catch (error) {
      console.error('Claude JSON Generation Error:', error);
      throw new Error(`Claude JSON generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

export const claudeService = new ClaudeService();
export default claudeService;
