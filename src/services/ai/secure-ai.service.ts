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

    const traceId = crypto.randomUUID();

    console.log(`[TRACE][${traceId}] CLIENT START`);

    const session = await this.waitForSession();

    console.log(`[TRACE][${traceId}] SESSION OK`);

    const { data, error } = await supabase.functions.invoke(
      'generate-embedding',
      {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "x-trace-id": traceId
        },
        body: { text, model }
      }
    );

    if (error) {
      console.error(`[TRACE][${traceId}] EDGE ERROR`, error);
      throw error;
    }

    console.log(`[TRACE][${traceId}] EDGE RESPONSE RECEIVED`, data?.traceId);

    if (!data?.embedding) {
      console.error(`[TRACE][${traceId}] INVALID DATA`, data);
      throw new Error('Invalid embedding response');
    }

    console.log(`[TRACE][${traceId}] SUCCESS`);

    return data.embedding;
  }
}

export const secureAI = new SecureAIService();
