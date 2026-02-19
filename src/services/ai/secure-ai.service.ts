/**
 * SecureAIService - Service IA sécurisé via Supabase Edge Functions
 *
 * Ce service route tous les appels LLM et embeddings via des Edge Functions
 * pour éviter d'exposer les clés API côté client.
 */

import { supabase } from '@/lib/supabase';

export interface EmbeddingResult {
  embedding: number[];
  model: string;
  usage: {
    prompt_tokens: number;
    total_tokens: number;
  };
}

export interface CompletionResult {
  content: string;
  model: string;
  provider: 'openai' | 'anthropic';
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export interface CompletionParams {
  messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>;
  model?: string;
  provider?: 'openai' | 'anthropic';
  max_tokens?: number;
  temperature?: number;
  system?: string;
  response_format?: { type: 'json_object' } | { type: 'text' };
}

export interface RAGSearchResult {
  id: string;
  content: string;
  metadata: Record<string, unknown>;
  similarity: number;
}

class SecureAIService {
  private isConfigured: boolean = false;

  constructor() {
    this.checkConfiguration();
  }

  private async checkConfiguration(): Promise<void> {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      this.isConfigured = !!session;
    } catch {
      this.isConfigured = false;
    }
  }

  private async waitForSession(): Promise<any> {
    for (let i = 0; i < 20; i++) {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.access_token) return session;
      await new Promise(r => setTimeout(r, 150));
    }
    throw new Error('SESSION_TIMEOUT');
  }

  async generateEmbedding(text: string, model: string = 'text-embedding-3-small'): Promise<number[]> {
    if (!text || text.trim().length === 0) {
      throw new Error('Text is required for embedding generation');
    }

    const truncatedText = text.length > 8000 ? text.substring(0, 8000) : text;
    const session = await this.waitForSession();

    if (!session?.access_token) {
      console.error('[SECURE AUTH GUARD] No access_token — aborting embedding call');
      throw new Error('AUTH_NOT_READY');
    }

    console.log('[SECURE AI] invoking EDGE generate-embedding');

    const { data, error } = await supabase.functions.invoke('generate-embedding', {
      headers: {
        Authorization: `Bearer ${session.access_token}`
      },
      body: { text: truncatedText, model }
    });

    if (error) {
      console.error('[SECURE AI] EDGE ERROR', error);
      throw new Error(error.message);
    }

    if (!data?.embedding || !Array.isArray(data.embedding)) {
      console.error('[SECURE AI] INVALID RESPONSE', data);
      throw new Error('INVALID_EMBEDDING_RESPONSE');
    }

    return data.embedding;
  }

  async complete(params: CompletionParams): Promise<string> {
    const {
      messages,
      model,
      provider = 'openai',
      max_tokens = 4000,
      temperature = 0.7,
      system,
      response_format,
    } = params;

    if (!messages || messages.length === 0) {
      throw new Error('Messages are required for completion');
    }

    const session = await this.waitForSession();

    if (!session?.access_token) {
      console.error('[SECURE AUTH GUARD] No access_token — aborting completion call');
      throw new Error('AUTH_NOT_READY');
    }

    console.log('[SECURE AI] invoking EDGE llm-completion');

    const { data, error } = await supabase.functions.invoke('llm-completion', {
      headers: {
        Authorization: `Bearer ${session.access_token}`
      },
      body: {
        messages,
        model,
        provider,
        max_tokens,
        temperature,
        system,
        response_format,
      }
    });

    if (error) {
      console.error('[SECURE AI] LLM ERROR', error);
      throw new Error(error.message);
    }

    return data?.content || '';
  }

  async completeJSON<T = unknown>(params: Omit<CompletionParams, 'response_format'>): Promise<T> {
    const response = await this.complete({
      ...params,
      response_format: { type: 'json_object' },
      temperature: params.temperature ?? 0.3,
    });

    try {
      return JSON.parse(response) as T;
    } catch (parseError) {
      console.error('[SecureAI] JSON parse error:', parseError);
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]) as T;
      }
      throw new Error('Failed to parse JSON response from LLM');
    }
  }

  async ragSearch(
    query: string,
    collection: string,
    topK: number = 5,
    threshold: number = 0.7
  ): Promise<RAGSearchResult[]> {
    const embedding = await this.generateEmbedding(query);

    const { data, error } = await supabase.rpc('match_documents', {
      query_embedding: embedding,
      match_threshold: threshold,
      match_count: topK,
      filter_collection: collection
    });

    if (error) {
      console.error('[SecureAI] RAG search error:', error);
      return [];
    }

    return (data || []).map((item: any) => ({
      id: item.id,
      content: item.content,
      metadata: item.metadata || {},
      similarity: item.similarity,
    }));
  }

  async analyzeWithRAG(
    text: string,
    systemPrompt: string,
    ragCollections: string[] = []
  ): Promise<string> {
    let ragContext = '';

    if (ragCollections.length > 0) {
      const contextPromises = ragCollections.map(collection =>
        this.ragSearch(text.substring(0, 500), collection, 3, 0.6)
      );

      const results = await Promise.all(contextPromises);
      const allResults = results.flat();

      if (allResults.length > 0) {
        ragContext = '\n\nContexte documentaire pertinent:\n' +
          allResults
            .sort((a, b) => b.similarity - a.similarity)
            .slice(0, 5)
            .map(r => `- ${r.content}`)
            .join('\n');
      }
    }

    const enrichedSystem = systemPrompt + ragContext;

    return this.complete({
      messages: [{ role: 'user', content: text }],
      system: enrichedSystem,
      provider: 'anthropic',
      max_tokens: 8000,
      temperature: 0.5,
    });
  }

  async healthCheck(): Promise<boolean> {
    try {
      await this.generateEmbedding('test');
      return true;
    } catch {
      return false;
    }
  }
}

export const secureAI = new SecureAIService();

export { SecureAIService };
