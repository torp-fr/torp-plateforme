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

  /**
   * 🔥 WAIT SESSION — HARD STABLE
   */
  private async waitForSession(): Promise<any> {
    for (let i = 0; i < 20; i++) {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.access_token) return session;
      await new Promise(r => setTimeout(r, 150));
    }
    throw new Error('SESSION_TIMEOUT');
  }

  /**
   * ✅ EMBEDDING — VERSION NUCLEAR STABLE
   */
  async generateEmbedding(
    text: string,
    model: string = 'text-embedding-3-small'
  ): Promise<number[]> {

    if (!text || text.trim().length === 0) {
      throw new Error('EMPTY_TEXT');
    }

    const truncatedText =
      text.length > 8000 ? text.substring(0, 8000) : text;

    const session = await this.waitForSession();

    console.log('[SECURE AI] invoking EDGE generate-embedding');

    const { data, error } = await supabase.functions.invoke(
      'generate-embedding',
      {
        headers: {
          Authorization: `Bearer ${session.access_token}`
        },
        body: {
          text: truncatedText,
          model
        }
      }
    );

    if (error) {
      console.error('[SECURE AI] EDGE ERROR', error);
      throw new Error(error.message);
    }

    if (!data?.embedding) {
      console.error('[SECURE AI] INVALID RESPONSE', data);
      throw new Error('INVALID_EMBEDDING_RESPONSE');
    }

    return data.embedding;
  }

  /**
   * ✅ LLM COMPLETION
   */
  async complete(params: CompletionParams): Promise<string> {

    const session = await this.waitForSession();

    const { data, error } = await supabase.functions.invoke(
      'llm-completion',
      {
        headers: {
          Authorization: `Bearer ${session.access_token}`
        },
        body: params
      }
    );

    if (error) {
      console.error('[SECURE AI] LLM ERROR', error);
      throw new Error(error.message);
    }

    return data?.content || '';
  }
}

export const secureAI = new SecureAIService();
