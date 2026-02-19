import { supabase } from '@/lib/supabase';

export interface CompletionParams {
  messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>;
  model?: string;
  provider?: 'openai' | 'anthropic';
  max_tokens?: number;
  temperature?: number;
  system?: string;
  response_format?: { type: 'json_object' } | { type: 'text' };
}

class SecureAIService {

  private async waitForSession(): Promise<any> {
    for (let i = 0; i < 10; i++) {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.access_token) return session;
      await new Promise(r => setTimeout(r, 200));
    }
    throw new Error('SESSION_TIMEOUT');
  }

  /**
   * ✅ VERSION NUCLEAR STABLE
   */
  async generateEmbedding(text: string, model: string = 'text-embedding-3-small'): Promise<number[]> {

    if (!text || text.trim().length === 0) {
      throw new Error('Text is required');
    }

    const truncatedText = text.length > 8000 ? text.substring(0, 8000) : text;

    console.log('[NUCLEAR TRACE] embedding call about to happen');

    const session = await this.waitForSession();

    if (!session?.access_token) {
      throw new Error('AUTH_NOT_READY');
    }

    console.log('[NUCLEAR FIX] calling EDGE FUNCTION generate-embedding');

    const { data, error } = await supabase.functions.invoke('generate-embedding', {
      headers: {
        Authorization: `Bearer ${session.access_token}`
      },
      body: {
        text: truncatedText,
        model
      }
    });

    if (error) {
      console.error('[NUCLEAR FIX] EDGE FUNCTION ERROR', error);
      throw new Error(error.message);
    }

    if (!data?.embedding) {
      throw new Error('Invalid embedding response');
    }

    return data.embedding;
  }

}

export const secureAI = new SecureAIService();
