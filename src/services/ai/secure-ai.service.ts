import { supabase } from '@/lib/supabase';
import { log, warn, error, time, timeEnd } from '@/lib/logger';

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

  private initialized = false;
  private initializing: Promise<void> | null = null;
  private accessToken: string | null = null;

  /**
   * Deterministic token resolution — no auth flow, no polling.
   *
   * Priority:
   *   1. Existing Supabase user session (browser — user already logged in)
   *   2. SUPABASE_SERVICE_ROLE_KEY env var (CLI / server — static admin JWT)
   *   3. VITE_SUPABASE_ANON_KEY env var (fallback — public anon key)
   *
   * Anonymous sign-in is intentionally absent: it creates throwaway users,
   * burns Supabase rate limits, and is unnecessary when a static key exists.
   */
  private async init(): Promise<void> {
    // 1. Browser context: reuse the authenticated user's JWT
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.access_token) {
      this.accessToken = session.access_token;
      this.initialized = true;
      return;
    }

    // 2. CLI / server context: use the static key that supabase.ts already resolved.
    //    Mirror the same resolution order as supabase.ts lines 74-78 so both always
    //    agree on which credential is in use.
    const _metaEnv = (typeof import.meta !== 'undefined' && import.meta.env)
      ? import.meta.env as Record<string, string | undefined>
      : {} as Record<string, string | undefined>;

    const staticKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY ??
      _metaEnv.VITE_SUPABASE_ANON_KEY ??
      process.env.VITE_SUPABASE_ANON_KEY ??
      null;

    if (staticKey) {
      this.accessToken = staticKey;
      this.initialized = true;
      return;
    }

    throw new Error(
      'SECURE_AI_NO_AUTH: No user session and no static Supabase key found.\n' +
      'CLI: set SUPABASE_SERVICE_ROLE_KEY in .env.local\n' +
      'Browser: ensure the user is logged in before calling generateEmbedding()'
    );
  }

  /**
   * Ensures init() runs exactly once, even under concurrent callers.
   */
  async ensureInitialized(): Promise<void> {
    if (this.initialized) return;
    if (!this.initializing) {
      this.initializing = this.init();
    }
    await this.initializing;
  }

  /**
   * ✅ EMBEDDING — VERSION NUCLEAR STABLE
   */
  async generateEmbedding(
    text: string,
    model: string = 'text-embedding-3-small'
  ): Promise<number[]> {

    await this.ensureInitialized();

    if (!text || text.trim().length === 0) {
      throw new Error('EMPTY_TEXT');
    }

    const truncatedText =
      text.length > 8000 ? text.substring(0, 8000) : text;

    const token = this.accessToken;
    if (!token) {
      throw new Error('SECURE_AI_NOT_INITIALIZED');
    }

    // EDGE DEBUG — BEFORE INVOKE
    const projectUrl = supabase.supabaseUrl;
    const payloadSize = JSON.stringify({ text: truncatedText, model }).length;

    log('[EDGE DEBUG] invoking generate-embedding', {
      projectUrl,
      hasSession: true,
      payloadSize,
      textLength: truncatedText.length,
      model,
      timestamp: new Date().toISOString(),
    });

    // CRITICAL: Verify supabase client URL (fixes edge invoke origin mismatch)
    log('[EDGE CALL] projectUrl:', projectUrl);
    log('[EDGE INVOKE FINAL]', supabase.supabaseUrl);

    log('EDGE INVOKING VIA SDK');
    const invokeStart = Date.now();
    const { data, error } = await supabase.functions.invoke(
      'generate-embedding',
      {
        headers: {
          Authorization: `Bearer ${token}`
        },
        body: {
          text: truncatedText,
          model
        }
      }
    );
    const invokeDuration = Date.now() - invokeStart;

    // EDGE DEBUG — AFTER INVOKE
    log('[EDGE DEBUG] response received', {
      error: error ? { message: error.message, context: error.context } : null,
      hasData: !!data,
      dataKeys: data ? Object.keys(data) : [],
      embeddingLength: data?.embedding?.length || null,
      invokeDuration,
      timestamp: new Date().toISOString(),
    });

    if (error) {
      console.error('[EDGE CALL FAILED]', {
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

    log('[EDGE DEBUG] embedding generated successfully', {
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

    await this.ensureInitialized();

    const token = this.accessToken;
    if (!token) {
      throw new Error('SECURE_AI_NOT_INITIALIZED');
    }

    // EDGE DEBUG — BEFORE INVOKE
    const payloadSize = JSON.stringify(params).length;

    log('[EDGE DEBUG] invoking llm-completion', {
      hasSession: true,
      payloadSize,
      model: params.model,
      messagesCount: params.messages?.length,
      timestamp: new Date().toISOString(),
    });

    // CRITICAL: Verify supabase client URL (fixes edge invoke origin mismatch)
    log('[EDGE DEBUG URL]', supabase.supabaseUrl);
    log('[EDGE INVOKE FINAL]', supabase.supabaseUrl);

    const invokeStart = Date.now();
    const { data, error } = await supabase.functions.invoke(
      'llm-completion',
      {
        headers: {
          Authorization: `Bearer ${token}`
        },
        body: params
      }
    );
    const invokeDuration = Date.now() - invokeStart;

    // EDGE DEBUG — AFTER INVOKE
    log('[EDGE DEBUG] llm-completion response received', {
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
