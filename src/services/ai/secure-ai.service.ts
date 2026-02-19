/**
 * 🔥 SecureAIService — NUCLEAR STABLE VERSION
 * Edge Function Safe Gateway
 */

import { supabase } from '@/lib/supabase'

export interface CompletionParams {
  messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>
  model?: string
  provider?: 'openai' | 'anthropic'
  max_tokens?: number
  temperature?: number
  system?: string
  response_format?: { type: 'json_object' } | { type: 'text' }
}

export interface RAGSearchResult {
  id: string
  content: string
  metadata: Record<string, unknown>
  similarity: number
}

class SecureAIService {

  /**
   * 🧠 WAIT SESSION (NUCLEAR SAFE)
   */
  private async waitForSession() {
    for (let i = 0; i < 20; i++) {
      const { data } = await supabase.auth.getSession()
      if (data?.session?.access_token) {
        return data.session
      }
      await new Promise(r => setTimeout(r, 150))
    }
    throw new Error('SESSION_TIMEOUT')
  }

  /**
   * 🔁 NUCLEAR INVOKE WRAPPER (Retry + Auth Safe)
   */
  private async invokeWithRetry(
    fn: string,
    body: any,
    retries = 3
  ): Promise<any> {

    const session = await this.waitForSession()

    for (let attempt = 0; attempt < retries; attempt++) {
      try {

        console.log('[NUCLEAR INVOKE] calling', fn, 'attempt', attempt + 1)

        const { data, error } = await supabase.functions.invoke(fn, {
          headers: {
            Authorization: `Bearer ${session.access_token}`
          },
          body
        })

        if (error) {
          throw error
        }

        return data

      } catch (err) {
        console.warn('[NUCLEAR INVOKE RETRY]', attempt + 1, err)

        if (attempt === retries - 1) {
          throw err
        }

        await new Promise(r => setTimeout(r, 400))
      }
    }
  }

  /**
   * ✅ EMBEDDING SAFE CALL
   */
  async generateEmbedding(
    text: string,
    model: string = 'text-embedding-3-small'
  ): Promise<number[]> {

    if (!text || !text.trim()) {
      throw new Error('Text required')
    }

    const truncatedText =
      text.length > 8000 ? text.substring(0, 8000) : text

    const data = await this.invokeWithRetry(
      'generate-embedding',
      {
        text: truncatedText,
        model
      }
    )

    if (!data?.embedding || !Array.isArray(data.embedding)) {
      console.error('[NUCLEAR EMBEDDING] invalid response', data)
      throw new Error('Invalid embedding response')
    }

    return data.embedding
  }

  /**
   * 🧠 LLM COMPLETION SAFE CALL
   */
  async complete(params: CompletionParams): Promise<string> {

    const {
      messages,
      model,
      provider = 'openai',
      max_tokens = 4000,
      temperature = 0.7,
      system,
      response_format
    } = params

    if (!messages?.length) {
      throw new Error('Messages required')
    }

    const data = await this.invokeWithRetry(
      'llm-completion',
      {
        messages,
        model,
        provider,
        max_tokens,
        temperature,
        system,
        response_format
      }
    )

    return data?.content || ''
  }

  /**
   * 🧠 JSON COMPLETION SAFE
   */
  async completeJSON<T = unknown>(
    params: Omit<CompletionParams, 'response_format'>
  ): Promise<T> {

    const response = await this.complete({
      ...params,
      response_format: { type: 'json_object' },
      temperature: params.temperature ?? 0.3
    })

    try {
      return JSON.parse(response) as T
    } catch {
      const match = response.match(/\{[\s\S]*\}/)
      if (match) {
        return JSON.parse(match[0]) as T
      }
      throw new Error('JSON_PARSE_FAILED')
    }
  }

  /**
   * 🔎 RAG SEARCH SAFE
   */
  async ragSearch(
    query: string,
    collection: string,
    topK = 5,
    threshold = 0.7
  ): Promise<RAGSearchResult[]> {

    const embedding = await this.generateEmbedding(query)

    const { data, error } = await supabase.rpc('match_documents', {
      query_embedding: embedding,
      match_threshold: threshold,
      match_count: topK,
      filter_collection: collection
    })

    if (error) {
      console.error('[RAG ERROR]', error)
      return []
    }

    return (data || []).map((item: any) => ({
      id: item.id,
      content: item.content,
      metadata: item.metadata || {},
      similarity: item.similarity
    }))
  }

  /**
   * ❤️ HEALTH CHECK
   */
  async healthCheck(): Promise<boolean> {
    try {
      await this.generateEmbedding('test')
      return true
    } catch {
      return false
    }
  }
}

export const secureAI = new SecureAIService()
export { SecureAIService }
