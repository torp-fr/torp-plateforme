const CLAUDE_API_URL = 'https://api.anthropic.com/v1/messages';

export interface AIResponse {
  success: boolean;
  data?: any;
  error?: string;
}

export async function callClaude(
  prompt: string,
  systemPrompt: string,
  apiKey: string
): Promise<AIResponse> {
  try {
    const response = await fetch(CLAUDE_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-3-opus-20240229',
        max_tokens: 4096,
        system: systemPrompt,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      return { success: false, error: `Claude API error: ${error}` };
    }

    const result = await response.json();
    const content = result.content[0]?.text || '';

    // Try to parse JSON from response
    try {
      const jsonMatch = content.match(/```json\n?([\s\S]*?)\n?```/) ||
                        content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const jsonStr = jsonMatch[1] || jsonMatch[0];
        return { success: true, data: JSON.parse(jsonStr) };
      }
      return { success: true, data: content };
    } catch {
      return { success: true, data: content };
    }
  } catch (error) {
    return { success: false, error: String(error) };
  }
}
