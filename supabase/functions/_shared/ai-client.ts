/**
 * AI Client for Supabase Edge Functions
 * Supports Claude API with automatic model fallback
 */

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
}

export async function callClaude(
  prompt: string,
  systemPrompt: string,
  apiKey: string
): Promise<AIResponse> {
  let lastError: string | null = null;

  // Try each model in order
  for (const model of CLAUDE_MODELS) {
    try {
      console.log(`[AI Client] Trying model: ${model}`);

      const response = await fetch(CLAUDE_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model,
          max_tokens: 4096,
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
        return { success: false, error: `Claude API error: ${errorText}` };
      }

      const result = await response.json();
      const content = result.content[0]?.text || '';

      // Try to parse JSON from response
      try {
        const jsonMatch = content.match(/```json\n?([\s\S]*?)\n?```/) ||
                          content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const jsonStr = jsonMatch[1] || jsonMatch[0];
          return { success: true, data: JSON.parse(jsonStr), model };
        }
        return { success: true, data: content, model };
      } catch {
        return { success: true, data: content, model };
      }
    } catch (error) {
      lastError = String(error);
      console.error(`[AI Client] Error with model ${model}:`, error);

      // If it looks like a network error, try next model
      if (String(error).includes('network') || String(error).includes('fetch')) {
        continue;
      }

      // For other errors, return
      return { success: false, error: lastError };
    }
  }

  // All models failed
  return { success: false, error: `All Claude models failed. Last error: ${lastError}` };
}
