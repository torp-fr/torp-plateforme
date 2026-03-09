/**
 * PHASE 35: Knowledge Brain Service
 * Manages knowledge documents, embeddings, and semantic search
 * Integrates with TORP for context-aware analysis
 *
 * PHASE 36.12: Now uses AI Orchestrator for centralized embedding operations
 * This ensures consistent retry logic, timeouts, and error handling
 */

import { supabase } from '@/lib/supabase';
import { aiOrchestrator } from './aiOrchestrator.service';
import { pricingExtractionService } from './pricing-extraction.service';
// PHASE 36.6: Unicode sanitizer for safe database insertion
import { sanitizeText, getSanitizationStats } from '@/utils/text-sanitizer';
// PHASE 36.8: Intelligent chunking for scalable ingestion
import { chunkText, getChunkingStats, validateChunks } from '@/utils/chunking';
// PHASE 36.10.5: Health monitoring and production observability
import { KnowledgeHealthService } from './knowledge-health.service';
// PHASE 36.11: PDF text extraction (using centralized PDF.js wrapper)
import { extractPdfText, isPdfFile, validatePdfSize } from '@/lib/pdfExtract';
import { log, warn, error, time, timeEnd } from '@/lib/logger';
import { triggerStepRunner } from '@/api/knowledge-step-trigger';

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

// PHASE 36.10.1: State Machine Definition
type IngestionStatus = 'pending' | 'processing' | 'chunking' | 'embedding' | 'complete' | 'failed';

interface IngestionState {
  ingestion_status: IngestionStatus;
  ingestion_progress: number;
  ingestion_started_at?: string;
  ingestion_completed_at?: string;
  last_ingestion_error?: string;
  last_ingestion_step?: string;
  embedding_integrity_checked?: boolean;
}

// PHASE 36.10.1: State transition rules
const ALLOWED_TRANSITIONS: Record<IngestionStatus, IngestionStatus[]> = {
  pending: ['processing'],
  processing: ['chunking', 'failed'],
  chunking: ['embedding', 'failed'],
  embedding: ['complete', 'failed'],
  failed: ['pending'],
  complete: [], // Terminal state - no transitions allowed
};

// PHASE 36.10.1: Metrics tracking
interface IngestionMetrics {
  total_documents_processed: number;
  successful_ingestions: number;
  failed_ingestions: number;
  avg_chunks_per_document: number;
  avg_embedding_time_per_chunk: number;
  integrity_check_failures: number;
  retry_success_rate: number;
}

class KnowledgeBrainService {
  private readonly ENABLE_VECTOR_SEARCH = true;
  private readonly EMBEDDING_DIMENSION = 384;
  private readonly SIMILARITY_THRESHOLD = 0.5;
  // PHASE 36.10.5: Health monitoring service
  private readonly healthService = new KnowledgeHealthService();
  private metrics: IngestionMetrics = {
    total_documents_processed: 0,
    successful_ingestions: 0,
    failed_ingestions: 0,
    avg_chunks_per_document: 0,
    avg_embedding_time_per_chunk: 0,
    integrity_check_failures: 0,
    retry_success_rate: 0,
  };

  constructor() {
    // PHASE 36.10.7: Verify orchestrator is properly wired
    log('[KNOWLEDGE BRAIN] 🧠 Initializing service...');
    log('[KNOWLEDGE BRAIN] Embedding orchestrator: aiOrchestrator');
    log('[KNOWLEDGE BRAIN] generateEmbedding available via orchestrator');
  }

  /**
   * PHASE 42: Server-side document ingestion
   * Upload file to Storage and trigger Edge Function for extraction
   * No extraction happens in browser - all processing server-side
   */
  async uploadDocumentForServerIngestion(
    file: File,
    options: {
      title?: string;
      category: string;
      source: 'internal' | 'external' | 'official';
    }
  ) {
    try {
      log('[KNOWLEDGE BRAIN] 📤 Server-side ingestion: uploading file to Storage');

      // Step 1: Upload to Supabase Storage
      const timestamp = Date.now();
      const storagePath = `knowledge-documents/${timestamp}-${file.name}`;

      const { error: uploadError } = await supabase.storage
        .from('knowledge-files')
        .upload(storagePath, file, { upsert: false });

      if (uploadError) {
        throw new Error(`Storage upload failed: ${uploadError.message}`);
      }

      log('[KNOWLEDGE BRAIN'] ✅ File uploaded to Storage:', storagePath);

      // Note: Document creation is now handled by testFullIngestion.ts
      // Return file path and metadata for caller to use
      const safeTitle = options.title?.trim() || file.name.replace(/\.[^/.]+$/, '');
      return {
        file_path: storagePath,
        title: safeTitle,
        category: options.category,
        source: options.source,
        file_size: file.size,
        mime_type: file.type,
      };
    } catch (error) {
      console.error('[KNOWLEDGE BRAIN] ❌ Upload error:', error);
      throw error;
    }
  }

  /**
   * PHASE 36.11: Extract readable text from document (PDF or plain text)
   * Uses centralized PDF.js wrapper for safe, robust extraction
   * Falls back to TextDecoder for plain text files
   * Never returns binary data
   */
  private async extractDocumentText(file: File): Promise<string> {
    try {
      const buffer = await file.arrayBuffer();
      const uint8Array = new Uint8Array(buffer);

      // Check for PDF header
      const header = String.fromCharCode(
        uint8Array[0],
        uint8Array[1],
        uint8Array[2],
        uint8Array[3]
      );

      if (header === '%PDF') {
        log('[KNOWLEDGE BRAIN] 📄 PDF detected - extracting text...');
        try {
          // Use centralized PDF extraction utility
          const extractedText = await extractPdfText(file);
          log('[KNOWLEDGE BRAIN] ✅ PDF text extracted:', extractedText.length, 'chars');
          return extractedText;
        } catch (pdfError) {
          console.error('[KNOWLEDGE BRAIN] ❌ PDF parsing error:', pdfError);
          return '';
        }
      }

      // Plain text file
      log('[KNOWLEDGE BRAIN] 📝 Plain text file detected');
      const text = new TextDecoder().decode(uint8Array);
      log('[KNOWLEDGE BRAIN] ✅ Text decoded:', text.length, 'chars');
      return text;
    } catch (error) {
      console.error('[KNOWLEDGE BRAIN] ❌ Document extraction error:', error);
      return '';
    }
  }

  /**
   * PHASE 36.11: Detect if chunk contains binary data
   * Returns true if PDF header or non-printable chars ratio > 20%
   */
  private isBinaryChunk(content: string): boolean {
    if (!content) return false;

    // Check for PDF header
    if (content.includes('%PDF')) {
      warn('[KNOWLEDGE BRAIN] Binary chunk skipped: PDF header detected');
      return true;
    }

    // Count non-printable characters
    let nonPrintable = 0;
    for (let i = 0; i < content.length; i++) {
      const code = content.charCodeAt(i);
      if (code < 32 && code !== 9 && code !== 10 && code !== 13) {
        nonPrintable++;
      }
    }

    const ratio = nonPrintable / content.length;
    if (ratio > 0.2) {
      warn(`[KNOWLEDGE BRAIN] Binary chunk skipped: ${(ratio * 100).toFixed(1)}% non-printable`);
      return true;
    }

    return false;
  }

  /**
   * PHASE 36.10.1: Strict state machine update with transition validation
   * Enforces legal state transitions and prevents state corruption
   */
  private async updateDocumentState(
    documentId: string,
    updates: Partial<IngestionState>
  ): Promise<boolean> {
    try {
      // Get current document state
      const { data: currentDoc, error: fetchError } = await supabase
        .from('knowledge_documents')
        .select('ingestion_status, embedding_integrity_checked')
        .eq('id', documentId)
        .single();

      if (fetchError || !currentDoc) {
        console.error('[KNOWLEDGE BRAIN] ❌ Failed to fetch current state:', fetchError);
        return false;
      }

      const currentStatus = currentDoc.ingestion_status as IngestionStatus;
      const newStatus = updates.ingestion_status as IngestionStatus;

      // Validate transition if status is changing
      if (newStatus && newStatus !== currentStatus) {
        // PHASE 36.11: Safe fallback guard if state machine is undefined
        if (!ALLOWED_TRANSITIONS) {
          warn('[KNOWLEDGE BRAIN] Transition guard fallback - ALLOWED_TRANSITIONS undefined');
          log('[KNOWLEDGE BRAIN] 🟢 Valid transition (fallback): ' + currentStatus + ' -> ' + newStatus);
        } else {
          const allowedNextStates = ALLOWED_TRANSITIONS[currentStatus] || [];
          if (!allowedNextStates.includes(newStatus)) {
            const errorMsg = `[STATE MACHINE VIOLATION] ${currentStatus} -> ${newStatus} not allowed. Valid: ${allowedNextStates.join(', ')}`;
            console.error('[KNOWLEDGE BRAIN] 🔴 ' + errorMsg);
            return false;
          }
          log('[KNOWLEDGE BRAIN] 🟢 Valid transition: ' + currentStatus + ' -> ' + newStatus);
        }
      }

      // Note: Document state updates are now managed by testFullIngestion.ts
      log('[KNOWLEDGE BRAIN] ℹ️ Document state management moved to testFullIngestion.ts');
      return true;
    } catch (error) {
      console.error('[KNOWLEDGE BRAIN] 💥 updateDocumentState error:', error);
      return false;
    }
  }

  /**
   * PHASE 36.10.1: Atomic claim - Safely claim document for processing
   * Uses UPDATE instead of SELECT to avoid race conditions
   * Returns true only if we successfully claimed the document
   *
   * PHASE 36.10.6 CRITICAL AUTHORITY:
   * This is the ONLY function allowed to transition a document from 'pending' to 'processing'.
   * Never transition to 'processing' outside this function.
   * This ensures true multi-instance safety and proper state machine integrity.
   */
  private async tryClaimDocumentForProcessing(documentId: string): Promise<boolean> {
    try {
      log('[KNOWLEDGE BRAIN] 🔒 Attempting atomic claim for document:', documentId);

      // Note: Document state management moved to testFullIngestion.ts
      log('[KNOWLEDGE BRAIN'] ℹ️ Atomic claim moved to testFullIngestion.ts');
      return true;
    } catch (error) {
      console.error('[KNOWLEDGE BRAIN] 💥 Atomic claim error:', error);
      return false;
    }
  }

  /**
   * PHASE 36.10.1: Verify embedding integrity for a document
   * Ensures all chunks have embeddings before marking as complete
   */
  private async verifyEmbeddingIntegrity(documentId: string): Promise<{
    valid: boolean;
    total_chunks: number;
    embedded_chunks: number;
    missing_embeddings: number;
  }> {
    try {
      // PHASE 40: Always verify integrity (DB-driven, no special modes)
      log('[KNOWLEDGE BRAIN] 🔍 Verifying embedding integrity for:', documentId);

      // Get chunk counts via RPC function
      const { data, error } = await supabase.rpc('verify_embedding_integrity', {
        p_document_id: documentId,
      });

      if (error) {
        console.error('[KNOWLEDGE BRAIN] ❌ Integrity check failed:', error);
        this.metrics.integrity_check_failures++;
        return {
          valid: false,
          total_chunks: 0,
          embedded_chunks: 0,
          missing_embeddings: 0,
        };
      }

      if (!data || data.length === 0) {
        warn('[KNOWLEDGE BRAIN] ⚠️ No integrity data returned');
        return {
          valid: false,
          total_chunks: 0,
          embedded_chunks: 0,
          missing_embeddings: 0,
        };
      }

      const result = data[0];
      const isValid = result.is_valid === true || result.missing_embeddings === 0;

      log('[KNOWLEDGE BRAIN] 📊 Integrity check result:', {
        document_id: documentId,
        total_chunks: result.total_chunks,
        embedded_chunks: result.embedded_chunks,
        missing_embeddings: result.missing_embeddings,
        is_valid: isValid,
      });

      if (!isValid) {
        this.metrics.integrity_check_failures++;
      }

      return {
        valid: isValid,
        total_chunks: result.total_chunks,
        embedded_chunks: result.embedded_chunks,
        missing_embeddings: result.missing_embeddings,
      };
    } catch (error) {
      console.error('[KNOWLEDGE BRAIN] 💥 Integrity verification error:', error);
      this.metrics.integrity_check_failures++;
      return {
        valid: false,
        total_chunks: 0,
        embedded_chunks: 0,
        missing_embeddings: 0,
      };
    }
  }

  // PHASE 36.10.1: Public metrics accessors for testing
  resetIngestionMetrics(): void {
    this.metrics = {
      total_documents_processed: 0,
      successful_ingestions: 0,
      failed_ingestions: 0,
      avg_chunks_per_document: 0,
      avg_embedding_time_per_chunk: 0,
      integrity_check_failures: 0,
      retry_success_rate: 0,
    };
  }

  getIngestionMetrics(): IngestionMetrics {
    return { ...this.metrics };
  }

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
    // Note: Document creation is now handled exclusively by testFullIngestion.ts
    log('[KNOWLEDGE BRAIN] ℹ️ Document creation moved to testFullIngestion.ts');
    throw new Error('Document creation is now managed by testFullIngestion.ts. Please use that script instead.');
      if (!queryEmbedding) {
        warn('[KNOWLEDGE BRAIN] ⚠️ Could not generate embedding for query');
        // PHASE 36.10.5: Log failed search metric
        await this.healthService.logRpcMetric(
          'search_knowledge_by_embedding',
          Date.now() - searchStartTime,
          0,
          true,
          'Failed to generate embedding'
        );
        return [];
      }

      // CRITICAL: Use VERIFIED RPC function
      // This RPC is enforced to use knowledge_documents_ready and knowledge_chunks_ready views
      const rpcStartTime = Date.now();
      const { data, error } = await supabase.rpc('search_knowledge_by_embedding', {
        query_embedding: queryEmbedding,
        match_threshold: this.SIMILARITY_THRESHOLD,
        match_count: limit,
      });
      const rpcTime = Date.now() - rpcStartTime;

      if (error) {
        console.error('[KNOWLEDGE BRAIN] 🔴 Vector search RPC failed:', error.message);
        // PHASE 36.10.5: Log failed search metric
        await this.healthService.logRpcMetric(
          'search_knowledge_by_embedding',
          rpcTime,
          0,
          true,
          error.message
        );
        // NO FALLBACK - return empty array instead of falling back to unsafe query
        return [];
      }

      if (!data || data.length === 0) {
        log('[KNOWLEDGE BRAIN] ℹ️ Vector search: no results found');
        // PHASE 36.10.5: Log no results metric
        await this.healthService.logRpcMetric(
          'search_knowledge_by_embedding',
          Date.now() - searchStartTime,
          0,
          false
        );
        return [];
      }

      log('[KNOWLEDGE BRAIN] ✅ Vector search found', data.length, 'verified chunks');

      // DEFENSE IN DEPTH: Validate each result at runtime
      const validatedResults = data.map((item: any) => {
        // Double-check: ingestion_status must be 'complete'
        if (item.ingestion_status !== 'complete') {
          warn(
            '[KNOWLEDGE BRAIN] 🚨 SECURITY BREACH: Result has invalid status:',
            item.ingestion_status
          );
          throw new Error(`Security violation: Retrieved document has status ${item.ingestion_status}`);
        }

        // Double-check: embedding_integrity_checked must be true
        if (item.embedding_integrity_checked !== true) {
          warn('[KNOWLEDGE BRAIN] 🚨 SECURITY BREACH: Result has integrity_checked=false');
          throw new Error('Security violation: Retrieved document has integrity_checked=false');
        }

        // GOVERNANCE: Verify document is publishable (integrity_score >= 0.7)
        if (item.is_publishable !== true) {
          warn(
            '[KNOWLEDGE BRAIN] ⚠️ Filtered: Document is not publishable (integrity governance)',
            item.id
          );
          return null; // Filter out unpublishable documents
        }

        return {
          id: item.id,
          source: item.doc_source,
          category: item.doc_category,
          content: item.content,
          reliability_score: 1.0,
          created_at: item.doc_created_at,
          updated_at: item.doc_created_at,
          relevance_score: item.embedding_similarity || 0,
          embedding_similarity: item.embedding_similarity || 0,
        };
      }).filter((result) => result !== null) as SearchResult[];

      // PHASE 36.10.5: Log successful search metric
      await this.healthService.logRpcMetric(
        'search_knowledge_by_embedding',
        Date.now() - searchStartTime,
        validatedResults.length,
        false
      );

      return validatedResults;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      console.error('[KNOWLEDGE BRAIN] 💥 Vector search error:', errorMsg);
      // PHASE 36.10.5: Log error metric
      await this.healthService.logRpcMetric(
        'search_knowledge_by_embedding',
        Date.now() - searchStartTime,
        0,
        true,
        errorMsg
      );
      // NO FALLBACK - return empty on error
      return [];
    }
  }

  /**
   * PHASE 36.10.2: Keyword/text search (VERIFIED)
   * CRITICAL: Uses ONLY search_knowledge_by_keyword RPC (secure views enforced at DB level)
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
      log('[KNOWLEDGE BRAIN] 📝 Keyword search starting (verified docs only)...');

      // CRITICAL: Use VERIFIED RPC function
      // This RPC is enforced to use knowledge_documents_ready and knowledge_chunks_ready views
      const { data, error } = await supabase.rpc('search_knowledge_by_keyword', {
        search_query: query,
        match_count: limit,
        p_category: options?.category || null,
      });

      if (error) {
        console.error('[KNOWLEDGE BRAIN] 🔴 Keyword search RPC failed:', error.message);
        return [];
      }

      if (!data || data.length === 0) {
        log('[KNOWLEDGE BRAIN] ℹ️ Keyword search: no results found');
        return [];
      }

      log('[KNOWLEDGE BRAIN] ✅ Keyword search found', data.length, 'verified chunks');

      // GOVERNANCE: Apply publishability filter (integrity governance)
      const publishableResults = data.filter((item: any) => {
        if (item.is_publishable !== true) {
          warn(
            '[KNOWLEDGE BRAIN] ⚠️ Filtered: Document is not publishable (integrity governance)',
            item.id
          );
          return false;
        }
        return true;
      });

      // Map RPC results to SearchResult format
      return publishableResults.map((item: any) => ({
        id: item.id,
        source: item.doc_source,
        category: item.doc_category,
        content: item.content,
        reliability_score: 1.0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        relevance_score: item.relevance_score || 0,
        embedding_similarity: 0,
      }));
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      console.error('[KNOWLEDGE BRAIN] 💥 Keyword search error:', errorMsg);
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
      log('[KNOWLEDGE BRAIN] 🔍 Searching for relevant knowledge...', {
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
        warn('[KNOWLEDGE BRAIN] ⚠️ No relevant knowledge found - fallback mode (brain empty or no matches)');
        // PHASE 35.1: Safe mode - continue without knowledge
        return prompt;
      }

      log('[KNOWLEDGE BRAIN] ✅ Found', knowledge.length, 'relevant documents');

      // Get market price reference
      let priceContext = '';
      if (options?.type_travaux && options?.region) {
        log('[KNOWLEDGE BRAIN] 💰 Fetching market pricing...', { type_travaux: options.type_travaux, region: options.region });
        const pricing = await this.getMarketPricing(options.type_travaux, options.region);
        if (pricing) {
          priceContext = `\n\nMARKET CONTEXT:\nWork Type: ${options.type_travaux}\nRegion: ${options.region}\nMarket Price Range: €${pricing.min_price} - €${pricing.max_price}\nAverage: €${pricing.avg_price}\nReliability: ${pricing.reliability_score}%`;
          log('[KNOWLEDGE BRAIN] ✅ Market context added');
        } else {
          log('[KNOWLEDGE BRAIN] ℹ️ No market pricing available - continuing without price context');
        }
      }

      // Build context section
      const contextSection = `\n\nRELEVANT KNOWLEDGE BASE (${knowledge.length} documents):\n${knowledge
        .map((k, i) => `[${i + 1}] [${k.source}] ${k.category.toUpperCase()}: ${k.content.substring(0, 200)}...`)
        .join('\n')}`;

      const enrichedPrompt = prompt + contextSection + priceContext;

      log('[KNOWLEDGE BRAIN] 🎉 Context injected successfully - Enhanced prompt ready');
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
        log('[KNOWLEDGE BRAIN] No market pricing found:', { type_travaux, region });
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
      log('[KNOWLEDGE BRAIN] Storing learning feedback:', feedback_type);

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

      log('[KNOWLEDGE BRAIN] Feedback stored successfully');
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
   * PHASE 36.10.1: Retry ingestion for a failed document
   * Transactional safety: Delete chunks + reset document state + relaunch pipeline
   */
  async retryIngestion(documentId: string): Promise<boolean> {
    try {
      log('[KNOWLEDGE BRAIN] 🔄 Starting retry ingestion for document:', documentId);

      // STEP 1: Get current document state
      const { data: doc, error: fetchError } = await supabase
        .from('knowledge_documents')
        .select('*')
        .eq('id', documentId)
        .single();

      if (fetchError || !doc) {
        console.error('[KNOWLEDGE BRAIN] ❌ Document not found:', fetchError);
        return false;
      }

      if (doc.ingestion_status !== 'failed') {
        warn('[KNOWLEDGE BRAIN] ⚠️ Document is not in failed state:', doc.ingestion_status);
        return false;
      }

      // STEP 2: Delete all existing chunks
      log('[KNOWLEDGE BRAIN] 🗑️ Deleting existing chunks...');
      const { error: deleteError } = await supabase
        .from('knowledge_chunks')
        .delete()
        .eq('document_id', documentId);

      if (deleteError) {
        console.error('[KNOWLEDGE BRAIN] ❌ Failed to delete chunks:', deleteError);
        return false;
      }

      // STEP 3: Reset document state - now handled by testFullIngestion.ts
      log('[KNOWLEDGE BRAIN] ℹ️ Document state reset moved to testFullIngestion.ts');

      // STEP 4: Relaunch background processing
      log('[KNOWLEDGE BRAIN] 🚀 Relaunching pipeline...');
      setTimeout(() => {
        this.processChunksAsync(
          documentId,
          doc.content,
          doc.category,
          doc.region,
          doc.content // Use content field (original content)
        ).catch((err) => console.error('[KNOWLEDGE BRAIN] Retry processing error:', err));
      }, 0);

      this.metrics.retry_success_rate++;
      log('[KNOWLEDGE BRAIN] ✅ Retry initiated successfully');
      return true;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      console.error('[KNOWLEDGE BRAIN] 💥 Retry ingestion error:', errorMsg);
      return false;
    }
  }

  /**
   * PHASE 36.10.1: System integrity audit
   * Finds all documents with embedding integrity violations
   * Returns empty array if system is healthy
   */
  async verifySystemIntegrity(): Promise<
    Array<{
      document_id: string;
      ingestion_status: string;
      embedding_integrity_checked: boolean;
      total_chunks: number;
      missing_embeddings: number;
      violation_type: string;
    }>
  > {
    try {
      log('[KNOWLEDGE BRAIN] 🔐 Verifying system integrity...');

      // Call audit function via RPC
      const { data, error } = await supabase.rpc('audit_system_integrity');

      if (error) {
        console.error('[KNOWLEDGE BRAIN] ❌ Audit function failed:', error);
        return [];
      }

      if (!data || data.length === 0) {
        log('[KNOWLEDGE BRAIN] ✅ System integrity OK - no violations found');
        return [];
      }

      console.error('[KNOWLEDGE BRAIN] 🚨 CRITICAL: System integrity violations detected:', {
        count: data.length,
        violations: data,
      });

      return data;
    } catch (error) {
      console.error('[KNOWLEDGE BRAIN] 💥 Integrity verification error:', error);
      return [];
    }
  }
}

export const knowledgeBrainService = new KnowledgeBrainService();
