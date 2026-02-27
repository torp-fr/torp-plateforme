/**
 * Anthropic Claude Service
 * Wrapper for Anthropic Claude API calls (Client-side)
 *
 * ⚠️ IMPORTANT: This is the ONLY acceptable direct SDK import location.
 * All server-side/Edge Function calls MUST use ai-client.ts instead.
 *
 * This client-side service uses the Anthropic SDK directly because:
 * 1. Client-side browser context cannot import Edge Function code
 * 2. Requires dangerouslyAllowBrowser flag for browser usage
 * 3. API keys are already exposed to client (no additional security concern)
 *
 * For better tracking and security, consider routing through Edge Function wrapper.
 *
 * Modèles disponibles et stables:
 * - claude-sonnet-4-20250514 (Claude 4 Sonnet - rapide, efficace)
 * - claude-3-5-sonnet-20241022 (Claude 3.5 Sonnet - stable, performant)
 * - claude-3-5-haiku-20241022 (Claude 3.5 Haiku - économique)
 *
 * Fallback automatique en cas d'erreur 404 sur un modèle
 */

// ✅ EXCEPTION: This is permitted as the only direct SDK import
// All other files must use ai-client.ts for centralized tracking
import Anthropic from '@anthropic-ai/sdk';
import { env } from '@/config/env';
import { log, warn, error, time, timeEnd } from '@/lib/logger';

// Modèles Claude valides avec ordre de priorité
export const CLAUDE_MODELS = {
  // Modèle principal recommandé (stable et performant)
  SONNET_4: 'claude-sonnet-4-20250514',
  // Modèle de fallback (très stable)
  SONNET_35: 'claude-3-5-sonnet-20241022',
  // Modèle économique
  HAIKU_35: 'claude-3-5-haiku-20241022',
} as const;

// Ordre de fallback des modèles
const MODEL_FALLBACK_ORDER = [
  CLAUDE_MODELS.SONNET_4,
  CLAUDE_MODELS.SONNET_35,
  CLAUDE_MODELS.HAIKU_35,
];

// Modèle par défaut (le plus stable)
const DEFAULT_MODEL = CLAUDE_MODELS.SONNET_35;

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
   * Generate completion with Claude (with automatic model fallback)
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

    // Build list of models to try (requested model first, then fallbacks)
    const modelsToTry = [model, ...MODEL_FALLBACK_ORDER.filter(m => m !== model)];

    let lastError: Error | null = null;

    for (const currentModel of modelsToTry) {
      try {
        if (env.app.debugMode) {
          log(`[Claude] Trying model: ${currentModel}`);
        }

        const message = await this.client.messages.create({
          model: currentModel,
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
        lastError = error instanceof Error ? error : new Error(String(error));
        const errorMessage = lastError.message.toLowerCase();

        // If it's a model not found error (404), try next model
        if (errorMessage.includes('404') || errorMessage.includes('model') || errorMessage.includes('not found')) {
          warn(`[Claude] Model ${currentModel} not available, trying fallback...`);
          continue;
        }

        // For other errors, throw immediately
        throw lastError;
      }
    }

    // All models failed
    console.error('Claude API Error: All models failed');
    throw new Error(`Claude API call failed: ${lastError?.message || 'All models unavailable'}`);
  }

  /**
   * Generate structured JSON output (with automatic model fallback)
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

    // Build list of models to try (requested model first, then fallbacks)
    const modelsToTry = [model, ...MODEL_FALLBACK_ORDER.filter(m => m !== model)];

    let lastError: Error | null = null;

    for (const currentModel of modelsToTry) {
      try {
        if (env.app.debugMode) {
          log(`[Claude] Trying model for JSON: ${currentModel}`);
        }

        const message = await this.client.messages.create({
          model: currentModel,
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
          warn('[Claude] Initial JSON parse failed, attempting cleanup...', parseError);

          // Remove trailing commas (common issue)
          cleanedContent = cleanedContent.replace(/,(\s*[}\]])/g, '$1');

          // Try parsing again
          return JSON.parse(cleanedContent) as T;
        }
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        const errorMessage = lastError.message.toLowerCase();

        // If it's a model not found error (404), try next model
        if (errorMessage.includes('404') || errorMessage.includes('model') || errorMessage.includes('not found')) {
          warn(`[Claude] Model ${currentModel} not available for JSON, trying fallback...`);
          continue;
        }

        // For other errors, throw immediately
        throw lastError;
      }
    }

    // All models failed
    console.error('Claude JSON Generation Error: All models failed');
    throw new Error(`Claude JSON generation failed: ${lastError?.message || 'All models unavailable'}`);
  }
}

export const claudeService = new ClaudeService();
export default claudeService;
