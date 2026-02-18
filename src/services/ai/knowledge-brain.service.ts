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
   * PHASE 36.9: Add knowledge document with NON-BLOCKING pipeline
   * New flow for 0-freeze UI:
   * 1. Sanitize + create preview (FAST)
   * 2. INSERT document immediately (RETURN to UI)
   * 3. Background async: chunk → batch insert → embeddings
   * 4. NO chunking before insert - eliminates freeze!
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
    try {
      // PHASE 36.9 SAFETY: Check document size EARLY
      const contentBytes = new TextEncoder().encode(content).length;
      if (contentBytes > 50 * 1024 * 1024) {
        // 50MB hard limit
        const errorMsg = `[KNOWLEDGE BRAIN] 🚫 Document exceeds 50MB hard limit: ${(contentBytes / 1024 / 1024).toFixed(2)}MB`;
        console.error(errorMsg);
        throw new Error(errorMsg);
      }
      if (contentBytes > 20 * 1024 * 1024) {
        // 20MB warning
        console.warn(
          `[KNOWLEDGE BRAIN] ⚠️ Large document: ${(contentBytes / 1024 / 1024).toFixed(2)}MB (>20MB threshold)`
        );
      }

      console.log('[KNOWLEDGE BRAIN] 🧠 START PHASE 36.9 NON-BLOCKING INSERT', {
        source,
        category,
        content_bytes: `${(contentBytes / 1024).toFixed(2)}KB`,
      });

      // ✅ PHASE 36.9 STEP 1: Generate safe title
      const safeTitle =
        options?.title && options.title.trim().length > 0
          ? options.title.trim()
          : `Document ${category || 'Unknown'} - ${new Date().toISOString().split('T')[0]}`;

      // ✅ PHASE 36.9 STEP 2: Sanitize content (FAST - Unicode cleanup only)
      console.log('[KNOWLEDGE BRAIN] 🧹 Sanitizing content...');
      const sanitized = sanitizeText(content);

      // ✅ PHASE 36.9 STEP 3: Create preview (max 10KB) - INSTANT
      const preview = sanitized.slice(0, 10000);
      console.log('[KNOWLEDGE BRAIN] 📄 Created preview: ' + preview.length + ' chars');

      // ✅ PHASE 36.9 STEP 4: INSERT DOCUMENT IMMEDIATELY (NON-BLOCKING)
      console.log('[KNOWLEDGE BRAIN] 📝 Inserting document FIRST...');
      const { data: doc, error: docError } = await supabase
        .from('knowledge_documents')
        .insert({
          title: safeTitle,
          category,
          source,
          content: preview, // ✅ Only 10KB preview
          is_active: true,
        })
        .select()
        .single();

      if (docError || !doc) {
        const errorMsg = docError?.message || 'No document returned';
        console.error('[KNOWLEDGE BRAIN] ❌ Insert failed:', errorMsg);
        throw new Error(`Insert failed: ${errorMsg}`);
      }

      console.log('[KNOWLEDGE BRAIN] ✅ Document inserted:', doc.id);

      // ✅ PHASE 36.10 STEP 5: Update state to 'processing'
      await this.updateDocumentState(doc.id, {
        ingestion_status: 'processing',
        ingestion_started_at: new Date(),
        ingestion_progress: 5,
        last_ingestion_step: 'document_inserted',
      });

      // ✅ PHASE 36.9 STEP 5: RETURN IMMEDIATELY TO UI
      // All heavy lifting happens in background via setTimeout(..., 0)
      console.log('[KNOWLEDGE BRAIN] 🚀 Document returned to UI - background processing started');

      // ✅ PHASE 36.9 STEP 6: Schedule background processing (non-blocking)
      // This yields control back to browser immediately
      setTimeout(() => {
        this.processChunksAsync(doc.id, sanitized, category, options?.region, content).catch((err) =>
          console.warn('[KNOWLEDGE BRAIN] ⚠️ Background processing error:', err)
        );
      }, 0);

      return doc;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      console.error('[KNOWLEDGE BRAIN] 💥 Fatal error:', errorMsg);
      throw error;
    }
  }

  /**
   * PHASE 36.10: Background processing with state machine
   * Tracks progress through: chunking → embedding → complete/failed
   * Runs AFTER document insert, non-blocking
   */
  private async processChunksAsync(
    documentId: string,
    sanitizedContent: string,
    category: string,
    region: string | undefined,
    originalContent: string
  ): Promise<void> {
    try {
      console.log('[KNOWLEDGE BRAIN] 🧠 BACKGROUND: Starting chunking...');
      const startTime = Date.now();

      // ✅ PHASE 36.10 STEP 1: Update state to 'chunking'
      await this.updateDocumentState(documentId, {
        ingestion_status: 'chunking',
        ingestion_progress: 20,
        last_ingestion_step: 'chunking_started',
      });

      // ✅ STEP 1: Chunk text (happens now in background, not blocking)
      console.log('[KNOWLEDGE BRAIN] ✂️ Chunking content...');
      const chunks = chunkText(sanitizedContent, 1000); // Returns Chunk[]
      console.log('[CHUNKING] Total chunks: ' + chunks.length);

      // ✅ PHASE 36.10 STEP 2: Update state after chunking
      await this.updateDocumentState(documentId, {
        ingestion_progress: 50,
        last_ingestion_step: 'chunking_complete',
      });

      // ✅ STEP 2: Batch insert chunks (50 max per batch)
      const BATCH_SIZE = 50;
      console.log('[KNOWLEDGE BRAIN] 📚 Inserting chunks in batches (batch size: ' + BATCH_SIZE + ')...');

      let insertedChunks = 0;
      for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
        const batch = chunks.slice(i, i + BATCH_SIZE);
        const payload = batch.map((chunk, batchIndex) => ({
          document_id: documentId,
          chunk_index: i + batchIndex,
          content: chunk.content,
          token_count: chunk.tokenCount,
        }));

        const { error } = await supabase.from('knowledge_chunks').insert(payload);

        if (error) {
          console.error('[KNOWLEDGE BRAIN] ❌ Batch insert failed at index ' + i + ':', error);
          await this.updateDocumentState(documentId, {
            ingestion_status: 'failed',
            last_ingestion_error: 'Batch insert failed: ' + error.message,
            last_ingestion_step: 'chunk_batch_' + Math.floor(i / BATCH_SIZE),
          });
          return;
        } else {
          insertedChunks += payload.length;
          console.log('[KNOWLEDGE BRAIN] ✅ Batch ' + (Math.floor(i / BATCH_SIZE) + 1) + ' inserted (' + payload.length + ' chunks)');
        }
      }

      // ✅ STEP 3: Extract pricing if applicable (non-blocking)
      if (category === 'PRICING_REFERENCE' && region) {
        console.log('[KNOWLEDGE BRAIN] 💰 Extracting pricing data...');
        try {
          const pricingData = pricingExtractionService.extractPricingData(originalContent, category, region);
          if (pricingData) {
            await pricingExtractionService.storePricingReference(documentId, pricingData, region);
            console.log('[KNOWLEDGE BRAIN] ✅ Pricing data stored');
          }
        } catch (pricingErr) {
          console.warn('[KNOWLEDGE BRAIN] ⚠️ Pricing extraction error (non-blocking):', pricingErr);
        }
      }

      // ✅ PHASE 36.10 STEP 3: Update state to 'embedding'
      await this.updateDocumentState(documentId, {
        ingestion_status: 'embedding',
        ingestion_progress: 60,
        last_ingestion_step: 'embedding_started',
      });

      // ✅ STEP 4: Generate embeddings async for chunks
      console.log('[EMBEDDING] 🚀 Starting async embedding generation...');
      await this.generateChunkEmbeddingsAsync(documentId, chunks);

      // ✅ PHASE 36.10 STEP 4: Update state to 'complete'
      await this.updateDocumentState(documentId, {
        ingestion_status: 'complete',
        ingestion_progress: 100,
        ingestion_completed_at: new Date(),
        last_ingestion_step: 'complete',
      });

      const totalTime = Date.now() - startTime;
      console.log('[KNOWLEDGE BRAIN] 🎉 Background processing complete:', {
        document_id: documentId,
        chunks: chunks.length,
        inserted_chunks: insertedChunks,
        time_ms: totalTime,
      });
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      console.error('[KNOWLEDGE BRAIN] 💥 Background processing failed:', errorMsg);

      // ✅ PHASE 36.10: Update state to 'failed' with error details
      await this.updateDocumentState(documentId, {
        ingestion_status: 'failed',
        last_ingestion_error: errorMsg,
        last_ingestion_step: 'background_process_error',
      });
    }
  }

  /**
   * PHASE 36.10: Generate embeddings for all chunks (with state tracking)
   * Each chunk gets its own embedding in the knowledge_chunks table
   * Uses Chunk objects with pre-calculated metadata
   * Updates document state on error
   */
  private async generateChunkEmbeddingsAsync(document_id: string, chunks: any[]): Promise<void> {
    try {
      console.log('[EMBEDDING] 🔢 Starting chunk embedding generation async...', {
        document_id,
        total_chunks: chunks.length,
      });

      if (!this.ENABLE_VECTOR_SEARCH) {
        console.log('[EMBEDDING] ⏭️ Vector search disabled');
        return;
      }

      let successCount = 0;
      let failCount = 0;

      // Process embeddings sequentially to avoid rate limiting
      for (let i = 0; i < chunks.length; i++) {
        try {
          // Handle both Chunk objects and strings for backward compatibility
          const chunk = chunks[i];
          const chunkContent = typeof chunk === 'string' ? chunk : chunk.content;
          const chunkTokens = typeof chunk === 'string' ? Math.ceil(chunk.length / 4) : chunk.tokenCount;

          console.log('[EMBEDDING] 📝 Generating embedding for chunk ' + i + ' (' + chunkTokens + ' tokens)');

          const embedding = await this.generateEmbedding(chunkContent);
          if (!embedding) {
            console.warn('[EMBEDDING] ⏭️ Skipped chunk ' + i);
            failCount++;
            continue;
          }

          // Store embedding
          const { error: embError } = await supabase
            .from('knowledge_chunks')
            .update({
              embedding,
              embedding_generated_at: new Date().toISOString(),
            })
            .eq('document_id', document_id)
            .eq('chunk_index', i);

          if (embError) {
            console.warn('[EMBEDDING] ⚠️ Chunk ' + i + ' failed:', embError.message);
            failCount++;
            // Update state on critical embedding error
            if (i === 0) {
              await this.updateDocumentState(document_id, {
                ingestion_status: 'failed',
                last_ingestion_error: 'Embedding generation failed: ' + embError.message,
                last_ingestion_step: 'embedding_chunk_0',
              });
            }
          } else {
            successCount++;
            console.log('[EMBEDDING] ✅ Chunk ' + i + ' embedded');
          }
        } catch (chunkErr) {
          failCount++;
          console.warn('[EMBEDDING] ⚠️ Chunk ' + i + ' error:', chunkErr);
        }
      }

      console.log('[EMBEDDING] 🎉 Embedding generation complete:', {
        total: chunks.length,
        success: successCount,
        failed: failCount,
      });
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      console.warn('[EMBEDDING] 💥 Embedding batch failed:', errorMsg);
      await this.updateDocumentState(document_id, {
        ingestion_status: 'failed',
        last_ingestion_error: 'Embedding batch error: ' + errorMsg,
        last_ingestion_step: 'embedding_batch_error',
      });
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

  /**
   * PHASE 36.10: Update document ingestion state
   * Tracks pipeline progress and enables recovery
   */
  private async updateDocumentState(
    documentId: string,
    state: {
      ingestion_status?: string;
      ingestion_progress?: number;
      ingestion_started_at?: Date;
      ingestion_completed_at?: Date;
      last_ingestion_error?: string | null;
      last_ingestion_step?: string;
    }
  ): Promise<boolean> {
    try {
      const payload: any = {};

      if (state.ingestion_status !== undefined) payload.ingestion_status = state.ingestion_status;
      if (state.ingestion_progress !== undefined) payload.ingestion_progress = state.ingestion_progress;
      if (state.ingestion_started_at !== undefined)
        payload.ingestion_started_at = state.ingestion_started_at.toISOString();
      if (state.ingestion_completed_at !== undefined)
        payload.ingestion_completed_at = state.ingestion_completed_at.toISOString();
      if (state.last_ingestion_error !== undefined) payload.last_ingestion_error = state.last_ingestion_error;
      if (state.last_ingestion_step !== undefined) payload.last_ingestion_step = state.last_ingestion_step;

      const { error } = await supabase
        .from('knowledge_documents')
        .update(payload)
        .eq('id', documentId);

      if (error) {
        console.warn('[KNOWLEDGE BRAIN] ⚠️ State update failed:', error.message);
        return false;
      }

      return true;
    } catch (err) {
      console.warn('[KNOWLEDGE BRAIN] ⚠️ State update error:', err);
      return false;
    }
  }

  /**
   * PHASE 36.10: Retry ingestion for a failed document
   * Resets state and relaunches processing
   */
  async retryIngestion(documentId: string): Promise<boolean> {
    try {
      console.log('[KNOWLEDGE BRAIN] 🔄 Retrying ingestion for document:', documentId);

      // Fetch document
      const { data: doc, error: fetchError } = await supabase
        .from('knowledge_documents')
        .select('*')
        .eq('id', documentId)
        .single();

      if (fetchError || !doc) {
        console.error('[KNOWLEDGE BRAIN] ❌ Document not found:', documentId);
        return false;
      }

      if (doc.ingestion_status === 'complete') {
        console.log('[KNOWLEDGE BRAIN] ℹ️ Document already complete, skipping retry');
        return true;
      }

      // Delete existing chunks
      console.log('[KNOWLEDGE BRAIN] 🗑️ Deleting existing chunks...');
      const { error: deleteError } = await supabase
        .from('knowledge_chunks')
        .delete()
        .eq('document_id', documentId);

      if (deleteError) {
        console.warn('[KNOWLEDGE BRAIN] ⚠️ Chunk deletion warning:', deleteError.message);
      }

      // Reset document state
      console.log('[KNOWLEDGE BRAIN] 🔄 Resetting document state...');
      await this.updateDocumentState(documentId, {
        ingestion_status: 'pending',
        ingestion_progress: 0,
        last_ingestion_error: null,
        last_ingestion_step: 'retry_initiated',
      });

      // Get full content from preview (this is a limitation - we only have 10KB preview)
      // For real retry, we'd need to store original content somewhere or re-upload
      console.log('[KNOWLEDGE BRAIN] ⚠️ Note: Retrying with existing preview only (10KB)');
      console.log('[KNOWLEDGE BRAIN] 🚀 Relaunching ingestion pipeline...');

      // Relaunch pipeline with preview
      setTimeout(() => {
        this.processChunksAsync(documentId, doc.content, doc.category, doc.region, doc.content).catch((err) =>
          console.warn('[KNOWLEDGE BRAIN] ⚠️ Retry processing error:', err)
        );
      }, 0);

      return true;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      console.error('[KNOWLEDGE BRAIN] ❌ Retry failed:', errorMsg);
      return false;
    }
  }

  /**
   * PHASE 36.10: Get ingestion status for a document
   */
  async getIngestionStatus(documentId: string): Promise<{
    status: string;
    progress: number;
    started_at: string | null;
    completed_at: string | null;
    error: string | null;
    step: string | null;
  } | null> {
    try {
      const { data, error } = await supabase
        .from('knowledge_documents')
        .select(
          'ingestion_status, ingestion_progress, ingestion_started_at, ingestion_completed_at, last_ingestion_error, last_ingestion_step'
        )
        .eq('id', documentId)
        .single();

      if (error || !data) {
        return null;
      }

      return {
        status: data.ingestion_status,
        progress: data.ingestion_progress,
        started_at: data.ingestion_started_at,
        completed_at: data.ingestion_completed_at,
        error: data.last_ingestion_error,
        step: data.last_ingestion_step,
      };
    } catch (error) {
      console.error('[KNOWLEDGE BRAIN] Status fetch error:', error);
      return null;
    }
  }
}

export const knowledgeBrainService = new KnowledgeBrainService();
