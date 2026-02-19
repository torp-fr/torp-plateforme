import { supabase } from '@/lib/supabase';

class SecureAIService {

  private async waitForSession(): Promise<any> {
    for (let i = 0; i < 10; i++) {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.access_token) return session;
      await new Promise(r => setTimeout(r, 200));
    }
    throw new Error('SESSION_TIMEOUT');
  }

  async generateEmbedding(
    text: string,
    model: string = 'text-embedding-3-small'
  ): Promise<number[]> {

    console.log('[ULTRA TRACE] generateEmbedding START');

    const session = await this.waitForSession();

    console.log('[ULTRA TRACE] session ready');

    const { data, error } = await supabase.functions.invoke(
      'generate-embedding',
      {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
        body: { text, model }
      }
    );

    if (error) {
      console.error('[ULTRA TRACE] EDGE ERROR', error);
      throw error;
    }

    console.log('[ULTRA TRACE] EDGE RESPONSE', data);

    if (!data?.embedding) {
      throw new Error('Invalid embedding response');
    }

    return data.embedding;
  }
}

export const secureAI = new SecureAIService();
