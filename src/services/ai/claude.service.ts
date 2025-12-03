/**
 * Anthropic Claude Service
 * Wrapper for Anthropic Claude API calls
 *
 * Modèles disponibles (2025):
 * - claude-sonnet-4-20250514 (recommandé - bon rapport qualité/coût)
 * - claude-opus-4-20250514 (premium - meilleure qualité)
 * - claude-3-5-sonnet-20241022 (legacy - compatible)
 */

import Anthropic from '@anthropic-ai/sdk';
import { env } from '@/config/env';

// Modèles Claude valides
export const CLAUDE_MODELS = {
  // Nouveaux modèles 2025
  SONNET_4: 'claude-sonnet-4-20250514',
  OPUS_4: 'claude-opus-4-20250514',
  // Modèle legacy compatible
  SONNET_35: 'claude-3-5-sonnet-20241022',
} as const;

// Modèle par défaut (bon rapport qualité/coût)
const DEFAULT_MODEL = CLAUDE_MODELS.SONNET_4;

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
    return !!this.client && !!env.ai.anthropic?.apiKey;
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
      model = DEFAULT_MODEL,
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
      maxTokens?: number;
      systemPrompt?: string;
    }
  ): Promise<T> {
    if (!this.client) {
      throw new Error('Claude is not configured');
    }

    const {
      model = DEFAULT_MODEL,
      temperature = 0.3, // Lower temperature for more consistent JSON
      maxTokens = 8000, // Augmenté pour éviter troncature JSON (était 4000)
      systemPrompt = 'You are a JSON-generating assistant. Always respond with valid JSON only.',
    } = options || {};

    try {
      const message = await this.client.messages.create({
        model,
        max_tokens: maxTokens,
        temperature,
        system: systemPrompt + ' Return only valid JSON, no markdown or explanations. IMPORTANT: Complete the entire JSON structure - do not truncate.',
        messages: [
          {
            role: 'user',
            content: prompt + '\n\nIMPORTANT: Return ONLY valid JSON without any markdown formatting, code blocks, or explanations. Ensure the JSON is COMPLETE.',
          },
        ],
      });

      const textBlock = message.content.find((block) => block.type === 'text');
      const content = textBlock && textBlock.type === 'text' ? textBlock.text : '{}';

      // Enhanced JSON cleaning - remove ALL markdown formatting
      let cleanedContent = content
        // Remove markdown code blocks
        .replace(/```json\n?/gi, '')
        .replace(/```javascript\n?/gi, '')
        .replace(/```\n?/g, '')
        // Remove any leading/trailing text before/after JSON
        .trim();

      // Try to extract JSON if surrounded by text
      const jsonMatch = cleanedContent.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        cleanedContent = jsonMatch[0];
      }

      // Attempt to parse with error recovery
      try {
        return JSON.parse(cleanedContent) as T;
      } catch (parseError) {
        // Try to fix common JSON errors
        console.warn('[Claude] Initial JSON parse failed, attempting cleanup...', parseError);

        // Remove trailing commas (common issue)
        cleanedContent = cleanedContent.replace(/,(\s*[}\]])/g, '$1');

        // Try parsing again
        try {
          return JSON.parse(cleanedContent) as T;
        } catch (secondError) {
          console.error('[Claude] JSON parse failed after cleanup. Content:', cleanedContent);
          throw new Error(`Failed to parse Claude JSON response: ${secondError instanceof Error ? secondError.message : 'Invalid JSON'}`);
        }
      }
    } catch (error) {
      console.error('Claude JSON Generation Error:', error);
      throw new Error(`Claude JSON generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

export const claudeService = new ClaudeService();
export default claudeService;
