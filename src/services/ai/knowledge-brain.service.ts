/**
 * PHASE 35: Knowledge Brain Service
 * Manages knowledge documents, embeddings, and semantic search
 * Integrates with TORP for context-aware analysis
 */

import { supabase } from '@/lib/supabase';
import { hybridAIService } from './hybrid-ai.service';

export interface KnowledgeDocument {
  id: string;
  source: string; // 'market_survey', 'regulatory', 'user_feedback'
  category: string; // 'pricing', 'regulations', 'best_practices'
  region?: string;
  content: string;
  reliability_score: number;
  created_at: string;
  updated_at: string;
}

export interface MarketPriceReference {
  id: string;
  type_travaux: string;
  region: string;
  min_price: number;
  avg_price: number;
  max_price: number;
  source: string;
  reliability_score: number;
  data_count: number;
}

export interface SearchResult extends KnowledgeDocument {
  relevance_score: number;
  embedding_similarity: number;
}

class KnowledgeBrainService {
  private readonly ENABLE_VECTOR_SEARCH = true;
  private readonly EMBEDDING_DIMENSION = 1536;
  private readonly SIMILARITY_THRESHOLD = 0.5;

  /**
   * Add a knowledge document to the brain
   */
  async addKnowledgeDocument(
    source: string,
    category: string,
    content: string,
    options?: {
      region?: string;
      reliability_score?: number;
      metadata?: any;
    }
  ): Promise<KnowledgeDocument | null> {
    try {
      console.log('[KNOWLEDGE BRAIN] 🧠 Starting document addition...', {
        source,
        category,
        length: content.length,
        region: options?.region,
      });

      // PHASE 35.1: Explicit insert step with error throwing
      console.log('[KNOWLEDGE BRAIN] 📝 Inserting document to knowledge_documents table...');
      const { data: doc, error: docError } = await supabase
        .from('knowledge_documents')
        .insert({
          source,
          category,
          region: options?.region,
          content,
          reliability_score: options?.reliability_score || 50,
          metadata: options?.metadata || {},
        })
        .select()
        .single();

      if (docError) {
        const errorMsg = docError.message || 'Unknown error';
        console.error('[KNOWLEDGE BRAIN] ❌ Insert failed:', { error: errorMsg, code: docError.code });
        throw new Error(`Insert failed: ${errorMsg}`);
      }

      if (!doc) {
        console.error('[KNOWLEDGE BRAIN] ❌ No document returned after insert');
        throw new Error('No document returned after insert');
      }

      console.log('[KNOWLEDGE BRAIN] ✅ Document inserted successfully:', doc.id);

      // Generate and store embedding
      console.log('[KNOWLEDGE BRAIN] 🔢 Generating embedding...');
      const embedding = await this.generateEmbedding(content);
      if (embedding) {
        console.log('[KNOWLEDGE BRAIN] 💾 Storing embedding...');
        const { error: embError } = await supabase
          .from('knowledge_embeddings')
          .insert({
            document_id: doc.id,
            embedding,
            chunk_index: 0,
          });

        if (embError) {
          console.warn('[KNOWLEDGE BRAIN] ⚠️ Failed to store embedding:', embError.message);
          // Don't fail - document still useful without embedding
        } else {
          console.log('[KNOWLEDGE BRAIN] ✅ Embedding stored successfully');
        }
      } else {
        console.log('[KNOWLEDGE BRAIN] ⏭️ Skipping embedding (vector search disabled or generation failed)');
      }

      console.log('[KNOWLEDGE BRAIN] 🎉 Document added completely:', doc.id);
      return doc;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      console.error('[KNOWLEDGE BRAIN] 💥 Fatal error:', errorMsg, error);
      throw error; // PHASE 35.1: Throw instead of returning null for better error handling
    }
  }

  /**
   * Generate embedding for content using AI
   */
  async generateEmbedding(content: string): Promise<number[] | null> {
    try {
      if (!this.ENABLE_VECTOR_SEARCH) {
        console.log('[KNOWLEDGE BRAIN] Vector search disabled - skipping embedding');
        return null;
      }

      console.log('[KNOWLEDGE BRAIN] Generating embedding for content...');

      // Use OpenAI embedding via hybrid AI service
      const { data: embedding, error } = await hybridAIService.generateEmbedding(content);

      if (error || !embedding) {
        console.warn('[KNOWLEDGE BRAIN] Embedding generation failed:', error);
        return null;
      }

      console.log('[KNOWLEDGE BRAIN] Embedding generated successfully');
      return embedding;
    } catch (error) {
      console.error('[KNOWLEDGE BRAIN] Error generating embedding:', error);
      return null;
    }
  }

  /**
   * Search relevant knowledge using semantic similarity
   */
  async searchRelevantKnowledge(
    query: string,
    options?: {
      category?: string;
      region?: string;
      limit?: number;
      min_reliability?: number;
    }
  ): Promise<SearchResult[]> {
    try {
      const limit = options?.limit || 5;
      const minReliability = options?.min_reliability || 0;

      console.log('[KNOWLEDGE BRAIN] Searching knowledge:', { query: query.substring(0, 50) + '...', limit });

      // Try vector search if enabled
      if (this.ENABLE_VECTOR_SEARCH) {
        const vectorResults = await this.vectorSearch(query, limit, options);
        if (vectorResults.length > 0) {
          console.log('[KNOWLEDGE BRAIN] Vector search returned', vectorResults.length, 'results');
          return vectorResults;
        }
      }

      // Fallback to keyword search
      console.log('[KNOWLEDGE BRAIN] Vector search unavailable - using keyword search');
      return await this.keywordSearch(query, limit, options);
    } catch (error) {
      console.error('[KNOWLEDGE BRAIN] Search error:', error);
      return [];
    }
  }

  /**
   * Vector similarity search
   */
  private async vectorSearch(
    query: string,
    limit: number,
    options?: {
      category?: string;
      region?: string;
      min_reliability?: number;
    }
  ): Promise<SearchResult[]> {
    try {
      // Generate query embedding
      const queryEmbedding = await this.generateEmbedding(query);
      if (!queryEmbedding) {
        return [];
      }

      // Search with RPC or direct query
      const { data, error } = await supabase.rpc('search_knowledge_by_embedding', {
        query_embedding: queryEmbedding,
        match_threshold: this.SIMILARITY_THRESHOLD,
        match_count: limit,
        p_category: options?.category || null,
        p_region: options?.region || null,
        p_min_reliability: options?.min_reliability || 0,
      });

      if (error) {
        console.warn('[KNOWLEDGE BRAIN] RPC search failed:', error);
        return [];
      }

      return (data || []).map((item: any) => ({
        ...item,
        relevance_score: item.embedding_similarity,
      }));
    } catch (error) {
      console.error('[KNOWLEDGE BRAIN] Vector search error:', error);
      return [];
    }
  }

  /**
   * Keyword/text search fallback
   */
  private async keywordSearch(
    query: string,
    limit: number,
    options?: {
      category?: string;
      region?: string;
      min_reliability?: number;
    }
  ): Promise<SearchResult[]> {
    try {
      let baseQuery = supabase
        .from('knowledge_documents')
        .select('*')
        .eq('is_active', true)
        .gte('reliability_score', options?.min_reliability || 0)
        .order('reliability_score', { ascending: false })
        .limit(limit);

      if (options?.category) {
        baseQuery = baseQuery.eq('category', options.category);
      }

      if (options?.region) {
        baseQuery = baseQuery.or(`region.eq.${options.region},region.is.null`);
      }

      const { data, error } = await baseQuery;

      if (error) {
        console.error('[KNOWLEDGE BRAIN] Keyword search error:', error);
        return [];
      }

      return (data || []).map((doc: any) => ({
        ...doc,
        relevance_score: 1.0,
        embedding_similarity: 0,
      }));
    } catch (error) {
      console.error('[KNOWLEDGE BRAIN] Keyword search error:', error);
      return [];
    }
  }

  /**
   * Inject knowledge context into analysis prompt
   * PHASE 35.1: Enhanced logging, graceful fallback, safe mode
   */
  async injectKnowledgeContext(
    prompt: string,
    options?: {
      category?: string;
      region?: string;
      type_travaux?: string;
    }
  ): Promise<string> {
    try {
      console.log('[KNOWLEDGE BRAIN] 🔍 Searching for relevant knowledge...', {
        category: options?.category,
        region: options?.region,
        type_travaux: options?.type_travaux,
      });

      // Search for relevant knowledge
      const knowledge = await this.searchRelevantKnowledge(prompt, {
        category: options?.category,
        region: options?.region,
        limit: 5,
      });

      if (knowledge.length === 0) {
        console.warn('[KNOWLEDGE BRAIN] ⚠️ No relevant knowledge found - fallback mode (brain empty or no matches)');
        // PHASE 35.1: Safe mode - continue without knowledge
        return prompt;
      }

      console.log('[KNOWLEDGE BRAIN] ✅ Found', knowledge.length, 'relevant documents');

      // Get market price reference
      let priceContext = '';
      if (options?.type_travaux && options?.region) {
        console.log('[KNOWLEDGE BRAIN] 💰 Fetching market pricing...', { type_travaux: options.type_travaux, region: options.region });
        const pricing = await this.getMarketPricing(options.type_travaux, options.region);
        if (pricing) {
          priceContext = `\n\nMARKET CONTEXT:\nWork Type: ${options.type_travaux}\nRegion: ${options.region}\nMarket Price Range: €${pricing.min_price} - €${pricing.max_price}\nAverage: €${pricing.avg_price}\nReliability: ${pricing.reliability_score}%`;
          console.log('[KNOWLEDGE BRAIN] ✅ Market context added');
        } else {
          console.log('[KNOWLEDGE BRAIN] ℹ️ No market pricing available - continuing without price context');
        }
      }

      // Build context section
      const contextSection = `\n\nRELEVANT KNOWLEDGE BASE (${knowledge.length} documents):\n${knowledge
        .map((k, i) => `[${i + 1}] [${k.source}] ${k.category.toUpperCase()}: ${k.content.substring(0, 200)}...`)
        .join('\n')}`;

      const enrichedPrompt = prompt + contextSection + priceContext;

      console.log('[KNOWLEDGE BRAIN] 🎉 Context injected successfully - Enhanced prompt ready');
      return enrichedPrompt;
    } catch (error) {
      // PHASE 35.1: Never crash - always return usable prompt
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      console.error('[KNOWLEDGE BRAIN] 💥 Context injection error (safe mode active):', errorMsg);
      return prompt; // Return original prompt - analysis continues
    }
  }

  /**
   * Get market pricing for work type and region
   */
  async getMarketPricing(type_travaux: string, region: string): Promise<MarketPriceReference | null> {
    try {
      const { data, error } = await supabase
        .from('market_price_references')
        .select('*')
        .eq('type_travaux', type_travaux)
        .eq('region', region)
        .eq('is_active', true)
        .order('reliability_score', { ascending: false })
        .limit(1)
        .single();

      if (error) {
        console.log('[KNOWLEDGE BRAIN] No market pricing found:', { type_travaux, region });
        return null;
      }

      return data;
    } catch (error) {
      console.error('[KNOWLEDGE BRAIN] Market pricing lookup error:', error);
      return null;
    }
  }

  /**
   * Store learning feedback from analysis
   */
  async storeLearningFeedback(
    devis_id: string,
    user_id: string,
    feedback_type: string,
    user_feedback: string,
    correction_data?: any
  ): Promise<boolean> {
    try {
      console.log('[KNOWLEDGE BRAIN] Storing learning feedback:', feedback_type);

      const { error } = await supabase.from('analysis_learning_feedback').insert({
        devis_id,
        user_id,
        feedback_type,
        user_feedback,
        correction_data: correction_data || {},
        confidence_score: 50,
      });

      if (error) {
        console.error('[KNOWLEDGE BRAIN] Failed to store feedback:', error);
        return false;
      }

      console.log('[KNOWLEDGE BRAIN] Feedback stored successfully');
      return true;
    } catch (error) {
      console.error('[KNOWLEDGE BRAIN] Feedback storage error:', error);
      return false;
    }
  }

  /**
   * Get knowledge statistics for analytics
   */
  async getKnowledgeStats(): Promise<{
    total_documents: number;
    by_category: Record<string, number>;
    by_source: Record<string, number>;
    avg_reliability: number;
  } | null> {
    try {
      const { data: documents, error: docError } = await supabase
        .from('knowledge_documents')
        .select('*')
        .eq('is_active', true);

      if (docError || !documents) {
        console.error('[KNOWLEDGE BRAIN] Failed to get stats:', docError);
        return null;
      }

      const by_category: Record<string, number> = {};
      const by_source: Record<string, number> = {};
      let total_reliability = 0;

      documents.forEach((doc: KnowledgeDocument) => {
        by_category[doc.category] = (by_category[doc.category] || 0) + 1;
        by_source[doc.source] = (by_source[doc.source] || 0) + 1;
        total_reliability += doc.reliability_score;
      });

      return {
        total_documents: documents.length,
        by_category,
        by_source,
        avg_reliability: documents.length > 0 ? total_reliability / documents.length : 0,
      };
    } catch (error) {
      console.error('[KNOWLEDGE BRAIN] Stats error:', error);
      return null;
    }
  }
}

export const knowledgeBrainService = new KnowledgeBrainService();
