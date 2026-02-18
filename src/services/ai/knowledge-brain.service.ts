/**
 * PHASE 35: Knowledge Brain Service
 * Manages knowledge documents, embeddings, and semantic search
 * Integrates with TORP for context-aware analysis
 */

import { supabase } from '@/lib/supabase';
import { hybridAIService } from './hybrid-ai.service';
import { pricingExtractionService } from './pricing-extraction.service';
// PHASE 36.6: Unicode sanitizer for safe database insertion
import { sanitizeText, getSanitizationStats } from '@/utils/text-sanitizer';
// PHASE 36.8: Intelligent chunking for scalable ingestion
import { chunkText, getChunkingStats, validateChunks } from '@/utils/chunking';

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
   * PHASE 36.8: Add a knowledge document with intelligent chunking
   * New pipeline: sanitize → chunk → insert document + chunks → async embeddings
   * Guarantees: title, category, source are always provided (NOT NULL)
   */
  async addKnowledgeDocument(
    source: string,
    category: string,
    content: string,
    options?: {
      title?: string;
      region?: string;
    }
  ): Promise<KnowledgeDocument | null> {
    return this.addKnowledgeDocumentWithTimeout(source, category, content, options);
  }

  /**
   * PHASE 36.8: Add knowledge document with intelligent chunking pipeline
   * New flow:
   * 1. Validate & sanitize full content
   * 2. Chunk text intelligently
   * 3. Insert document with preview (max 10KB)
   * 4. Batch insert chunks to knowledge_chunks
   * 5. Launch async embedding generation per chunk
   * 6. Extract pricing data if applicable
   */
  async addKnowledgeDocumentWithTimeout(
    source: string,
    category: string,
    content: string,
    options?: {
      title?: string;
      region?: string;
    }
  ): Promise<KnowledgeDocument | null> {
    const startTime = Date.now();

    try {
      // PHASE 36.8 SAFETY: Check document size
      const contentBytes = new TextEncoder().encode(content).length;
      if (contentBytes > 50 * 1024 * 1024) {
        // 50MB hard limit
        const errorMsg = `[KNOWLEDGE BRAIN] 🚫 Document exceeds 50MB hard limit: ${(contentBytes / 1024 / 1024).toFixed(2)}MB`;
        console.error(errorMsg);
        throw new Error(errorMsg);
      }
      if (contentBytes > 20 * 1024 * 1024) {
        // 20MB warning - would need confirmation
        console.warn(
          `[KNOWLEDGE BRAIN] ⚠️ Large document: ${(contentBytes / 1024 / 1024).toFixed(2)}MB (>20MB threshold)`
        );
      }

      console.log('[KNOWLEDGE BRAIN] 🧠 START PHASE 36.8 CHUNKED INSERT', {
        source,
        category,
        content_length: content.length,
        content_bytes: `${(contentBytes / 1024).toFixed(2)}KB`,
        hasTitle: !!options?.title,
        region: options?.region,
      });

      // PHASE 36.8 STEP 1: Generate safe title
      const safeTitle =
        options?.title && options.title.trim().length > 0
          ? options.title.trim()
          : `Document ${category || 'Unknown'} - ${new Date().toISOString().split('T')[0]}`;

      // PHASE 36.8 STEP 2: Sanitize full content
      console.log('[KNOWLEDGE BRAIN] 🧹 STEP 2: Sanitizing content (Unicode + control chars)...');
      const sanitized = sanitizeText(content);
      const sanitizationStats = getSanitizationStats(content, sanitized);
      console.log('[KNOWLEDGE BRAIN] 📊 Sanitization complete:', {
        original_bytes: sanitizationStats.original_bytes,
        sanitized_bytes: sanitizationStats.sanitized_bytes,
        removed_bytes: sanitizationStats.removed_bytes,
      });

      // PHASE 36.8 STEP 3: Chunk text intelligently
      console.log('[KNOWLEDGE BRAIN] ✂️ STEP 3: Chunking sanitized content...');
      const chunks = chunkText(sanitized, 1000); // 1000 tokens per chunk ≈ 4000 chars
      const chunkingStats = getChunkingStats(sanitized, chunks);

      // Validate chunks
      const validation = validateChunks(chunks);
      if (!validation.valid) {
        throw new Error(`Invalid chunks: ${validation.errors.join(', ')}`);
      }

      console.log('[CHUNKING] 📊 Chunking complete:', {
        total_chunks: chunkingStats.total_chunks,
        total_tokens: chunkingStats.total_tokens,
        largest_chunk_tokens: chunkingStats.largest_chunk_tokens,
        average_chunk_tokens: chunkingStats.average_chunk_tokens,
      });

      // PHASE 36.8 STEP 4: Create preview (max 10KB)
      const preview = sanitized.slice(0, 10000);
      console.log('[KNOWLEDGE BRAIN] 📄 STEP 4: Created preview:', `${preview.length} chars (${(new TextEncoder().encode(preview).length / 1024).toFixed(2)}KB)`);

      // PHASE 36.8 STEP 5: Insert document with preview
      console.log('[KNOWLEDGE BRAIN] 📝 STEP 5: Inserting document to knowledge_documents...');
      const insertPayload = {
        title: safeTitle,
        category,
        source,
        content: preview, // ✅ PHASE 36.8: Store only preview (max 10KB)
        is_active: true,
      };

      const { data: doc, error: docError } = await supabase
        .from('knowledge_documents')
        .insert(insertPayload)
        .select()
        .single();

      if (docError) {
        const errorMsg = docError.message || 'Unknown error';
        console.error('[KNOWLEDGE BRAIN] ❌ Document insert failed:', { error: errorMsg, code: docError.code });
        throw new Error(`Document insert failed: ${errorMsg}`);
      }

      if (!doc) {
        console.error('[KNOWLEDGE BRAIN] ❌ No document returned after insert');
        throw new Error('No document returned after insert');
      }

      console.log('[KNOWLEDGE BRAIN] ✅ Document inserted:', doc.id);

      // PHASE 36.8 STEP 6: Batch insert chunks
      console.log('[KNOWLEDGE BRAIN] 📚 STEP 6: Inserting chunks to knowledge_chunks table...');
      const chunkPayloads = chunks.map((chunk, index) => ({
        document_id: doc.id,
        chunk_index: index,
        content: chunk,
        token_count: Math.ceil(chunk.length / 4),
      }));

      const chunkInsertStart = Date.now();
      const { error: chunksError } = await supabase.from('knowledge_chunks').insert(chunkPayloads);

      if (chunksError) {
        console.error('[KNOWLEDGE BRAIN] ❌ Chunks insert failed:', chunksError.message);
        throw new Error(`Chunks insert failed: ${chunksError.message}`);
      }

      const chunkInsertTime = Date.now() - chunkInsertStart;
      console.log('[KNOWLEDGE BRAIN] ✅ All chunks inserted:', {
        count: chunks.length,
        insert_time_ms: chunkInsertTime,
        avg_time_per_chunk_ms: (chunkInsertTime / chunks.length).toFixed(2),
      });

      // PHASE 36.8 STEP 7: Extract pricing if applicable
      if (category === 'PRICING_REFERENCE' && options?.region) {
        console.log('[KNOWLEDGE BRAIN] 💰 STEP 7: Extracting pricing data...');
        try {
          const pricingData = pricingExtractionService.extractPricingData(content, category, options.region);
          if (pricingData) {
            const pricingStored = await pricingExtractionService.storePricingReference(doc.id, pricingData, options.region);
            if (pricingStored) {
              console.log('[KNOWLEDGE BRAIN] ✅ Pricing data extracted and stored');
            }
          } else {
            console.log('[KNOWLEDGE BRAIN] ℹ️ No pricing data found to extract');
          }
        } catch (pricingErr) {
          console.warn('[KNOWLEDGE BRAIN] ⚠️ Pricing extraction error (non-blocking):', pricingErr);
        }
      }

      // PHASE 36.8 STEP 8: Launch async embedding generation for each chunk
      console.log('[EMBEDDING] 🚀 STEP 8: Starting async embedding generation for chunks...');
      this.generateChunkEmbeddingsAsync(doc.id, chunks).catch((err) =>
        console.warn('[EMBEDDING] ⚠️ Async embedding error (non-blocking):', err)
      );

      const totalTime = Date.now() - startTime;
      console.log('[KNOWLEDGE BRAIN] 🎉 Document added successfully (embeddings async):', {
        document_id: doc.id,
        chunks_count: chunks.length,
        total_time_ms: totalTime,
      });

      return doc;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      console.error('[KNOWLEDGE BRAIN] 💥 Fatal error:', errorMsg);
      throw error;
    }
  }

  /**
   * PHASE 36.8: Generate embeddings for all chunks asynchronously (non-blocking)
   * Each chunk gets its own embedding in the knowledge_chunks table
   */
  private async generateChunkEmbeddingsAsync(document_id: string, chunks: string[]): Promise<void> {
    try {
      console.log('[EMBEDDING] 🔢 Starting chunk embedding generation async...', {
        document_id,
        total_chunks: chunks.length,
      });

      if (!this.ENABLE_VECTOR_SEARCH) {
        console.log('[EMBEDDING] ⏭️ Vector search disabled - skipping embedding generation');
        return;
      }

      // Process embeddings sequentially to avoid rate limiting
      for (let i = 0; i < chunks.length; i++) {
        try {
          const chunk = chunks[i];
          const chunkTokens = Math.ceil(chunk.length / 4);

          console.log('[EMBEDDING] 📝 Generating embedding for chunk:', {
            index: i,
            chunk_tokens: chunkTokens,
          });

          const embedding = await this.generateEmbedding(chunk);
          if (!embedding) {
            console.warn(`[EMBEDDING] ⏭️ Embedding generation skipped for chunk ${i}`);
            continue;
          }

          // Update the chunk with its embedding and timestamp
          console.log('[EMBEDDING] 💾 Storing embedding for chunk', i);
          const { error: embError } = await supabase
            .from('knowledge_chunks')
            .update({
              embedding,
              embedding_generated_at: new Date().toISOString(),
            })
            .eq('document_id', document_id)
            .eq('chunk_index', i);

          if (embError) {
            console.warn(`[EMBEDDING] ⚠️ Failed to store embedding for chunk ${i}:`, embError.message);
          } else {
            console.log(`[EMBEDDING] ✅ Embedding stored for chunk ${i}`);
          }
        } catch (chunkErr) {
          console.warn(`[EMBEDDING] ⚠️ Error processing chunk ${i}:`, chunkErr);
          // Continue with next chunk on error
        }
      }

      console.log('[EMBEDDING] 🎉 Chunk embedding generation complete', {
        document_id,
        chunks_processed: chunks.length,
      });
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      console.warn('[EMBEDDING] 💥 Async embedding batch error (non-blocking):', errorMsg);
    }
  }
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
