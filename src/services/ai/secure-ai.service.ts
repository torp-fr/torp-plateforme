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

    if (!text) throw new Error('Text required');

    const session = await this.waitForSession();

    console.log('[NUCLEAR FINAL] invoking generate-embedding');

    const { data, error } = await supabase.functions.invoke(
      'generate-embedding',
      {
        headers: {
          Authorization: `Bearer ${session.access_token}`
        },
        body: { text, model }
      }
    );

    if (error) {
      console.error('[NUCLEAR FINAL] invoke error', error);
      throw error;
    }

    if (!data?.embedding) {
      console.error('[NUCLEAR FINAL] invalid response', data);
      throw new Error('Invalid embedding response');
    }

    return data.embedding;
  }
}

export const secureAI = new SecureAIService();
