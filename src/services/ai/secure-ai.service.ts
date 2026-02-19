/**
 * SecureAIService - Service IA s??curis?? via Supabase Edge Functions
 *
 * Ce service route tous les appels LLM et embeddings via des Edge Functions
 * pour ??viter d'exposer les cl??s API c??t?? client.
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

  /**
   * G??n??re un embedding via Edge Function (cl?? API s??curis??e c??t?? serveur)
   * @param text - Texte ?? convertir en embedding
   * @param model - Mod??le d'embedding (default: text-embedding-3-small)
   */
  async generateEmbedding(text: string, model: string = 'text-embedding-3-small'): Promise<number[]> {
    if (!text || text.trim().length === 0) {
      throw new Error('Text is required for embedding generation');
    }

    // Tronquer si trop long
    const truncatedText = text.length > 8000 ? text.substring(0, 8000) : text;

    // DEBUG: Log environment and session before invoking
    console.log('[SecureAI] === EMBEDDING INVOCATION DEBUG ===');
    console.log('[SecureAI] Supabase URL:', import.meta.env.VITE_SUPABASE_URL);
    console.log('[SecureAI] Supabase Anon Key exists:', !!import.meta.env.VITE_SUPABASE_ANON_KEY);
    console.log('[SecureAI] Supabase Anon Key length:', import.meta.env.VITE_SUPABASE_ANON_KEY?.length);

    // Get and log session
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    console.log('[SecureAI] Session Error:', sessionError?.message || 'None');
    console.log('[SecureAI] Session exists:', !!session);
    console.log('[SecureAI] Session user:', session?.user?.id);
    console.log('[SecureAI] Session access_token exists:', !!session?.access_token);
    console.log('[SecureAI] Session access_token length:', session?.access_token?.length);
    console.log('[SecureAI] Session expires_at:', session?.expires_at);
    console.log('[SecureAI] Request payload:', { text: truncatedText.substring(0, 50) + '...', model });
    console.log('[SecureAI] =====================================');

    const { data, error } = await supabase.functions.invoke('generate-embedding', {
      headers: {
        Authorization: `Bearer ${session?.access_token}`
      },
      body: { text: truncatedText, model }
    });

    if (error) {
      console.error('[SecureAI] ERROR EMBEDDING INVOCATION FAILED', error);
      throw new Error(error.message);
    }
    if (!data || !Array.isArray(data.embedding)) {
      console.error('[SecureAI] Invalid embedding response:', data);
      return null;
    }
    return data.embedding;
  }

  /**
   * Appelle un LLM via Edge Function (cl?? API s??curis??e c??t?? serveur)
   * @param params - Param??tres de la requ??te
   */
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

    // DEBUG: Log before invoking
    console.log('[SecureAI] === LLM COMPLETION DEBUG ===');
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    console.log('[SecureAI] Session exists:', !!session);
    console.log('[SecureAI] Session access_token exists:', !!session?.access_token);
    console.log('[SecureAI] LLM Provider:', provider);
    console.log('[SecureAI] LLM Model:', model);
    console.log('[SecureAI] =================================');

    const { data, error } = await supabase.functions.invoke('llm-completion', {
      headers: {
        Authorization: `Bearer ${session?.access_token}`
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
      console.error('[SecureAI] ERROR LLM COMPLETION FAILED');
      console.error('[SecureAI] Error.message:', error?.message);
      console.error('[SecureAI] Error.status:', (error as any)?.status);
      console.error('[SecureAI] Full error:', JSON.stringify(error, null, 2));
      throw new Error(`Failed to complete: ${error.message}`);
    }

    return data?.content || '';
  }

  /**
   * Appelle un LLM et parse la r??ponse JSON
   * @param params - Param??tres de la requ??te
   */
  async completeJSON<T = unknown>(params: Omit<CompletionParams, 'response_format'>): Promise<T> {
    const response = await this.complete({
      ...params,
      response_format: { type: 'json_object' },
      temperature: params.temperature ?? 0.3, // Plus d??terministe pour JSON
    });

    try {
      return JSON.parse(response) as T;
    } catch (parseError) {
      console.error('[SecureAI] JSON parse error:', parseError);
      // Tenter d'extraire le JSON du texte
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]) as T;
      }
      throw new Error('Failed to parse JSON response from LLM');
    }
  }

  /**
   * Recherche RAG avec embedding s??curis??
   * @param query - Requ??te de recherche
   * @param collection - Collection ?? rechercher
   * @param topK - Nombre de r??sultats
   * @param threshold - Seuil de similarit??
   */
  async ragSearch(
    query: string,
    collection: string,
    topK: number = 5,
    threshold: number = 0.7
  ): Promise<RAGSearchResult[]> {
    // G??n??rer l'embedding de la requ??te
    const embedding = await this.generateEmbedding(query);

    // Rechercher dans Supabase via RPC
    const { data, error } = await supabase.rpc('match_documents', {
      query_embedding: embedding,
      match_threshold: threshold,
      match_count: topK,
      filter_collection: collection
    });

    if (error) {
      console.error('[SecureAI] RAG search error:', error);
      // Retourner un tableau vide plut??t que de planter
      return [];
    }

    return (data || []).map((item: any) => ({
      id: item.id,
      content: item.content,
      metadata: item.metadata || {},
      similarity: item.similarity,
    }));
  }

  /**
   * Analyse un texte avec enrichissement RAG
   * @param text - Texte ?? analyser
   * @param systemPrompt - Prompt syst??me
   * @param ragCollections - Collections RAG ?? utiliser pour l'enrichissement
   */
  async analyzeWithRAG(
    text: string,
    systemPrompt: string,
    ragCollections: string[] = []
  ): Promise<string> {
    // Rechercher du contexte pertinent dans les collections RAG
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

    // Construire le prompt enrichi
    const enrichedSystem = systemPrompt + ragContext;

    return this.complete({
      messages: [{ role: 'user', content: text }],
      system: enrichedSystem,
      provider: 'anthropic', // Claude pour analyse complexe
      max_tokens: 8000,
      temperature: 0.5,
    });
  }

  /**
   * V??rifie si le service est disponible
   */
  async healthCheck(): Promise<boolean> {
    try {
      // Tester avec un embedding minimal
      await this.generateEmbedding('test');
      return true;
    } catch {
      return false;
    }
  }
}

// Export singleton
export const secureAI = new SecureAIService();

// Export de la classe pour les tests
export { SecureAIService };
