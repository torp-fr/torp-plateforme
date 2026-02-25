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

    // EDGE DEBUG — BEFORE INVOKE
    const projectUrl = session?.user?.id ? 'authenticated' : 'guest';
    const hasSession = !!session?.access_token;
    const payloadSize = JSON.stringify({ text: truncatedText, model }).length;

    console.log('[EDGE DEBUG] invoking generate-embedding', {
      projectUrl,
      hasSession,
      payloadSize,
      textLength: truncatedText.length,
      model,
      timestamp: new Date().toISOString(),
      sessionExpiresAt: session?.expires_at,
    });

    // CRITICAL: Verify supabase client URL (fixes edge invoke origin mismatch)
    console.log('[EDGE DEBUG URL]', supabase.supabaseUrl);
    console.log('[EDGE INVOKE FINAL]', supabase.supabaseUrl);

    const invokeStart = Date.now();
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
    const invokeDuration = Date.now() - invokeStart;

    // EDGE DEBUG — AFTER INVOKE
    console.log('[EDGE DEBUG] response received', {
      error: error ? { message: error.message, context: error.context } : null,
      hasData: !!data,
      dataKeys: data ? Object.keys(data) : [],
      embeddingLength: data?.embedding?.length || null,
      invokeDuration,
      timestamp: new Date().toISOString(),
    });

    if (error) {
      console.error('[SECURE AI] EDGE ERROR', {
        message: error.message,
        context: error.context,
        statusCode: error.status || 'unknown',
      });
      throw new Error(error.message);
    }

    if (!data?.embedding) {
      console.error('[SECURE AI] INVALID RESPONSE', {
        data,
        keys: data ? Object.keys(data) : [],
        hasEmbedding: !!data?.embedding,
      });
      throw new Error('INVALID_EMBEDDING_RESPONSE');
    }

    console.log('[EDGE DEBUG] embedding generated successfully', {
      embeddingDimension: data.embedding.length,
      totalDuration: invokeDuration,
      source: 'secure-ai.service',
    });

    return data.embedding;
  }

  /**
   * ✅ LLM COMPLETION
   */
  async complete(params: CompletionParams): Promise<string> {

    const session = await this.waitForSession();

    // EDGE DEBUG — BEFORE INVOKE
    const hasSession = !!session?.access_token;
    const payloadSize = JSON.stringify(params).length;

    console.log('[EDGE DEBUG] invoking llm-completion', {
      hasSession,
      payloadSize,
      model: params.model,
      messagesCount: params.messages?.length,
      timestamp: new Date().toISOString(),
    });

    // CRITICAL: Verify supabase client URL (fixes edge invoke origin mismatch)
    console.log('[EDGE DEBUG URL]', supabase.supabaseUrl);
    console.log('[EDGE INVOKE FINAL]', supabase.supabaseUrl);

    const invokeStart = Date.now();
    const { data, error } = await supabase.functions.invoke(
      'llm-completion',
      {
        headers: {
          Authorization: `Bearer ${session.access_token}`
        },
        body: params
      }
    );
    const invokeDuration = Date.now() - invokeStart;

    // EDGE DEBUG — AFTER INVOKE
    console.log('[EDGE DEBUG] llm-completion response received', {
      error: error ? { message: error.message, context: error.context } : null,
      hasData: !!data,
      contentLength: data?.content?.length || null,
      invokeDuration,
      timestamp: new Date().toISOString(),
    });

    if (error) {
      console.error('[SECURE AI] LLM ERROR', {
        message: error.message,
        context: error.context,
        statusCode: error.status || 'unknown',
      });
      throw new Error(error.message);
    }

    return data?.content || '';
  }
}

export const secureAI = new SecureAIService();
