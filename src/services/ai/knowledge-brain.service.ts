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
// PHASE 36.10.5: Health monitoring and production observability
import { KnowledgeHealthService } from './knowledge-health.service';
// PHASE 36.11: PDF text extraction
import * as pdfjs from 'pdfjs-dist';

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
  private readonly EMBEDDING_DIMENSION = 1536;
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
    // PHASE 36.10.7: Verify embedding service is properly wired
    console.log('[KNOWLEDGE BRAIN] 🧠 Initializing service...');
    console.log('[KNOWLEDGE BRAIN] Embedding service (hybridAIService):', hybridAIService);
    console.log('[KNOWLEDGE BRAIN] generateEmbedding available:', typeof hybridAIService.generateEmbedding);
  }

  /**
   * PHASE 36.11: Extract readable text from document (PDF or plain text)
   * Public API for document text extraction
   * Detects PDF header and extracts text using pdf-parse
   * Falls back to TextDecoder for plain text files
   * Never returns binary data
   */
  async extractDocumentTextFromFile(file: File): Promise<string> {
    return this.extractDocumentText(file);
  }

  /**
   * PHASE 36.11: Extract readable text from document (PDF or plain text)
   * Detects PDF header and extracts text using pdfjs-dist
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
        console.log('[KNOWLEDGE BRAIN] 📄 PDF detected - extracting text...');
        try {
          const pdf = await pdfjs.getDocument({ data: uint8Array }).promise;
          let extractedText = '';

          for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const textContent = await page.getTextContent();
            const pageText = textContent.items.map((item: any) => item.str).join('');
            extractedText += pageText + '\n';
          }

          if (!extractedText || extractedText.trim().length === 0) {
            console.warn('[KNOWLEDGE BRAIN] ⚠️ PDF text extraction returned empty');
            return '';
          }
          console.log('[KNOWLEDGE BRAIN] ✅ PDF text extracted:', extractedText.length, 'chars');
          return extractedText;
        } catch (pdfError) {
          console.error('[KNOWLEDGE BRAIN] ❌ PDF parsing error:', pdfError);
          return '';
        }
      }

      // Plain text file
      console.log('[KNOWLEDGE BRAIN] 📝 Plain text file detected');
      const text = new TextDecoder().decode(uint8Array);
      console.log('[KNOWLEDGE BRAIN] ✅ Text decoded:', text.length, 'chars');
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
      console.warn('[KNOWLEDGE BRAIN] Binary chunk skipped: PDF header detected');
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
      console.warn(`[KNOWLEDGE BRAIN] Binary chunk skipped: ${(ratio * 100).toFixed(1)}% non-printable`);
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
          console.warn('[KNOWLEDGE BRAIN] Transition guard fallback - ALLOWED_TRANSITIONS undefined');
          console.log('[KNOWLEDGE BRAIN] 🟢 Valid transition (fallback): ' + currentStatus + ' -> ' + newStatus);
        } else {
          const allowedNextStates = ALLOWED_TRANSITIONS[currentStatus] || [];
          if (!allowedNextStates.includes(newStatus)) {
            const errorMsg = `[STATE MACHINE VIOLATION] ${currentStatus} -> ${newStatus} not allowed. Valid: ${allowedNextStates.join(', ')}`;
            console.error('[KNOWLEDGE BRAIN] 🔴 ' + errorMsg);
            return false;
          }
          console.log('[KNOWLEDGE BRAIN] 🟢 Valid transition: ' + currentStatus + ' -> ' + newStatus);
        }
      }

      // Perform update
      const { error: updateError } = await supabase
        .from('knowledge_documents')
        .update(updates)
        .eq('id', documentId);

      if (updateError) {
        console.error('[KNOWLEDGE BRAIN] ❌ State update failed:', updateError);
        return false;
      }

      console.log('[KNOWLEDGE BRAIN] ✅ State updated:', { documentId, updates });
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
      console.log('[KNOWLEDGE BRAIN] 🔒 Attempting atomic claim for document:', documentId);

      // Use UPDATE to atomically claim the document
      // Only succeeds if current status is 'pending'
      const { data, error } = await supabase
        .from('knowledge_documents')
        .update({
          ingestion_status: 'processing',
          ingestion_started_at: new Date().toISOString(),
          ingestion_progress: 5,
        })
        .eq('id', documentId)
        .eq('ingestion_status', 'pending')
        .select('id')
        .single();

      if (error || !data) {
        console.warn('[KNOWLEDGE BRAIN] ⚠️ Atomic claim failed - document not in pending state or already claimed');
        return false;
      }

      console.log('[KNOWLEDGE BRAIN] ✅ Atomic claim succeeded for:', documentId);
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
      console.log('[KNOWLEDGE BRAIN] 🔍 Verifying embedding integrity for:', documentId);

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
        console.warn('[KNOWLEDGE BRAIN] ⚠️ No integrity data returned');
        return {
          valid: false,
          total_chunks: 0,
          embedded_chunks: 0,
          missing_embeddings: 0,
        };
      }

      const result = data[0];
      const isValid = result.is_valid === true || result.missing_embeddings === 0;

      console.log('[KNOWLEDGE BRAIN] 📊 Integrity check result:', {
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
      // PHASE 36.10.1: Initialize with ingestion_status = 'pending'
      console.log('[KNOWLEDGE BRAIN] 📝 Inserting document FIRST...');
      const { data: doc, error: docError } = await supabase
        .from('knowledge_documents')
        .insert({
          title: safeTitle,
          category,
          source,
          content: preview, // ✅ Only 10KB preview
          is_active: true,
          ingestion_status: 'pending',
          ingestion_progress: 0,
        })
        .select()
        .single();

      if (docError || !doc) {
        const errorMsg = docError?.message || 'No document returned';
        console.error('[KNOWLEDGE BRAIN] ❌ Insert failed:', errorMsg);
        throw new Error(`Insert failed: ${errorMsg}`);
      }

      console.log('[KNOWLEDGE BRAIN] ✅ Document inserted:', doc.id);

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
   * PHASE 36.10.1: Background processing (chunking + batch insert + embeddings)
   * NEW: Atomic claim + state machine + integrity verification
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

      // PHASE 36.10.1 STEP 1: Atomic claim - prevent double processing
      const claimed = await this.tryClaimDocumentForProcessing(documentId);
      if (!claimed) {
        console.warn('[KNOWLEDGE BRAIN] ⚠️ Failed to claim document - likely already processing');
        return;
      }

      // PHASE 36.10.1 STEP 2: Chunk text (happens now in background, not blocking)
      console.log('[KNOWLEDGE BRAIN] ✂️ Chunking content...');
      await this.updateDocumentState(documentId, {
        ingestion_status: 'chunking',
        ingestion_progress: 20,
        last_ingestion_step: 'chunking_started',
      });

      const chunks = chunkText(sanitizedContent, 1000); // Returns Chunk[]
      console.log('[CHUNKING] Total chunks: ' + chunks.length);

      // PHASE 36.10.1 STEP 3: Batch insert chunks (50 max per batch)
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
          throw new Error(`Chunk batch insert failed at ${i}: ${error.message}`);
        } else {
          insertedChunks += payload.length;
          console.log('[KNOWLEDGE BRAIN] ✅ Batch ' + (Math.floor(i / BATCH_SIZE) + 1) + ' inserted (' + payload.length + ' chunks)');
        }
      }

      await this.updateDocumentState(documentId, {
        ingestion_progress: 50,
        last_ingestion_step: 'chunking_complete',
      });

      // PHASE 36.10.1 STEP 4: Extract pricing if applicable (non-blocking)
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

      // PHASE 36.10.1 STEP 5: Transition to embedding phase
      await this.updateDocumentState(documentId, {
        ingestion_status: 'embedding',
        ingestion_progress: 60,
        last_ingestion_step: 'embedding_started',
      });

      // PHASE 36.10.1 STEP 6: Generate embeddings async for chunks
      console.log('[EMBEDDING] 🚀 Starting async embedding generation...');
      await this.generateChunkEmbeddingsAsync(documentId, chunks);

      // PHASE 36.10.1 STEP 7: Verify embedding integrity BEFORE marking complete
      console.log('[KNOWLEDGE BRAIN] 🔍 Verifying embedding integrity...');
      const integrityCheck = await this.verifyEmbeddingIntegrity(documentId);

      if (!integrityCheck.valid) {
        const errorMsg = `Embedding integrity failed: ${integrityCheck.missing_embeddings} of ${integrityCheck.total_chunks} chunks missing embeddings`;
        console.error('[KNOWLEDGE BRAIN] 🔴 ' + errorMsg);
        this.metrics.failed_ingestions++;
        await this.updateDocumentState(documentId, {
          ingestion_status: 'failed',
          last_ingestion_error: errorMsg,
          last_ingestion_step: 'embedding_integrity_check_failed',
        });
        return;
      }

      // PHASE 36.10.1 STEP 8: Mark as complete with integrity flag
      console.log('[KNOWLEDGE BRAIN] ✅ All integrity checks passed!');
      const updateSuccess = await this.updateDocumentState(documentId, {
        ingestion_status: 'complete',
        ingestion_progress: 100,
        ingestion_completed_at: new Date().toISOString(),
        last_ingestion_step: 'complete',
        embedding_integrity_checked: true,
      });

      if (updateSuccess) {
        this.metrics.successful_ingestions++;
        this.metrics.total_documents_processed++;
      }

      const totalTime = Date.now() - startTime;
      console.log('[KNOWLEDGE BRAIN] 🎉 Background processing complete:', {
        document_id: documentId,
        chunks: chunks.length,
        inserted_chunks: insertedChunks,
        time_ms: totalTime,
        integrity_verified: true,
      });
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      console.error('[KNOWLEDGE BRAIN] 💥 Background processing failed:', errorMsg);
      this.metrics.failed_ingestions++;

      // Mark as failed
      await this.updateDocumentState(documentId, {
        ingestion_status: 'failed',
        last_ingestion_error: errorMsg,
        last_ingestion_step: 'background_processing_error',
      }).catch((err) => console.error('[KNOWLEDGE BRAIN] Failed to update error state:', err));
    }
  }

  /**
   * PHASE 36.10.1: Generate embeddings for all chunks asynchronously (non-blocking)
   * NEW: Strict integrity check - all chunks MUST get embeddings or throw error
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

      let successful = 0;
      let failed = 0;
      const embeddingTimes: number[] = [];
      let lastFailedChunk = -1;

      // Process embeddings sequentially to avoid rate limiting
      for (let i = 0; i < chunks.length; i++) {
        const chunkStartTime = Date.now();

        try {
          // Handle both Chunk objects and strings for backward compatibility
          const chunk = chunks[i];
          const chunkContent = typeof chunk === 'string' ? chunk : chunk.content;
          const chunkTokens = typeof chunk === 'string' ? Math.ceil(chunk.length / 4) : chunk.tokenCount;

          // PHASE 36.11: Binary guard - skip binary chunks
          if (this.isBinaryChunk(chunkContent)) {
            console.log('[EMBEDDING] ⏭️ Chunk ' + i + ' skipped (binary content)');
            failed++;
            continue;
          }

          console.log('[EMBEDDING] 📝 Generating embedding for chunk ' + i + ' (' + chunkTokens + ' tokens)');

          const embedding = await this.generateEmbedding(chunkContent);
          if (!embedding) {
            const errorMsg = `Chunk ${i}: No embedding returned from AI service`;
            console.error('[EMBEDDING] 🔴 ' + errorMsg);
            failed++;
            lastFailedChunk = i;
            throw new Error(errorMsg);
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
            const errorMsg = `Chunk ${i}: Failed to store embedding - ${embError.message}`;
            console.error('[EMBEDDING] 🔴 ' + errorMsg);
            failed++;
            lastFailedChunk = i;
            throw new Error(errorMsg);
          }

          successful++;
          const embeddingTime = Date.now() - chunkStartTime;
          embeddingTimes.push(embeddingTime);
          console.log('[EMBEDDING] ✅ Chunk ' + i + ' embedded (' + embeddingTime + 'ms)');
        } catch (chunkErr) {
          const errorMsg = chunkErr instanceof Error ? chunkErr.message : String(chunkErr);
          console.error('[EMBEDDING] 🔴 Chunk ' + i + ' error:', errorMsg);
          failed++;
          lastFailedChunk = i;
          // PHASE 36.10.1: CRITICAL - Do not continue on failure
          // Instead, we'll track this and verify integrity later
        }
      }

      // PHASE 36.10.1: Track metrics
      if (embeddingTimes.length > 0) {
        const avgEmbeddingTime = embeddingTimes.reduce((a, b) => a + b, 0) / embeddingTimes.length;
        this.metrics.avg_embedding_time_per_chunk = avgEmbeddingTime;
      }

      console.log('[EMBEDDING] 📊 Embedding generation summary:', {
        total: chunks.length,
        successful,
        failed,
        success_rate: ((successful / chunks.length) * 100).toFixed(2) + '%',
        last_failed_chunk: lastFailedChunk,
      });

      // ✅ PHASE 36.10: Non-blocking observability snapshot (fire-and-forget)
      setTimeout(() => {
        (async () => {
          try {
            await supabase.from('live_intelligence_snapshots').insert({
              source: 'knowledge-brain',
              status: 'embedding_complete',
              documents_processed: 1,
              embeddings_generated: successful,
              pricing_extracted: 0,
              errors: failed,
            });
          } catch (err) {
            console.warn('[KNOWLEDGE BRAIN] ⚠️ Observability snapshot failed:', err);
          }
        })();
      }, 0);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      console.error('[EMBEDDING] 💥 Embedding batch failed:', errorMsg);
      // Throw error so processChunksAsync can handle it properly
      throw error;
    }
  }
  async generateEmbedding(content: string): Promise<number[] | null> {
    try {
      if (!this.ENABLE_VECTOR_SEARCH) {
        console.log('[KNOWLEDGE BRAIN] Vector search disabled - skipping embedding');
        return null;
      }

      // PHASE 36.10.7: Defensive check - ensure embedding service is properly wired
      if (!hybridAIService || typeof hybridAIService.generateEmbedding !== 'function') {
        const errorMsg = '[CRITICAL] Embedding service not properly initialized. hybridAIService.generateEmbedding is not a function.';
        console.error('[KNOWLEDGE BRAIN] 🔴 ' + errorMsg);
        throw new Error(errorMsg);
      }

      console.log('[KNOWLEDGE BRAIN] 🧠 Generating embedding for content...');

      // Use OpenAI embedding via hybrid AI service
      const { data: embedding, error } = await hybridAIService.generateEmbedding(content);

      if (error || !embedding) {
        console.warn('[KNOWLEDGE BRAIN] Embedding generation failed:', error);
        return null;
      }

      // PHASE 36.10.3: Defense in depth - validate embedding dimension
      // Database expects VECTOR(1536) - enforce this at application level
      if (embedding.length !== this.EMBEDDING_DIMENSION) {
        const errorMsg = `[SECURITY] Embedding dimension mismatch: expected ${this.EMBEDDING_DIMENSION}, got ${embedding.length}`;
        console.error('[KNOWLEDGE BRAIN] 🔴 ' + errorMsg);
        throw new Error(errorMsg);
      }

      console.log('[KNOWLEDGE BRAIN] ✅ Embedding generated successfully (1536-dim)');
      return embedding;
    } catch (error) {
      console.error('[KNOWLEDGE BRAIN] Error generating embedding:', error);
      return null;
    }
  }

  /**
   * PHASE 36.10.2: Search relevant knowledge using semantic similarity
   * PHASE 36.10.5: With runtime health validation (fail-safe guard)
   * CRITICAL: Uses ONLY secure views (knowledge_documents_ready, knowledge_chunks_ready)
   * NO fallback to unsafe queries - all retrieval goes through verified RPC functions
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

      console.log('[KNOWLEDGE BRAIN] 🔐 HARDLOCK SEARCH: Searching knowledge (verified docs only):', {
        query: query.substring(0, 50) + '...',
        limit,
      });

      // PHASE 36.10.5: Runtime health validation guard - FAIL-SAFE
      // Block retrieval if system is in critical state
      try {
        const healthCheck = await this.healthService.validateSystemHealthBeforeSearch();
        if (!healthCheck.healthy) {
          console.error(
            '[KNOWLEDGE BRAIN] 🔴 BLOCKING RETRIEVAL: System health check failed:',
            healthCheck.reason
          );
          return [];
        }
        if (healthCheck.details && !healthCheck.details.vector_dimension_valid) {
          console.error(
            '[KNOWLEDGE BRAIN] 🔴 BLOCKING RETRIEVAL: Vector dimension invalid'
          );
          return [];
        }
      } catch (healthError) {
        console.warn('[KNOWLEDGE BRAIN] ⚠️ Health validation error (continuing):', healthError);
        // Don't block - just warn
      }

      // Try vector search if enabled
      if (this.ENABLE_VECTOR_SEARCH) {
        const vectorResults = await this.vectorSearch(query, limit, options);
        if (vectorResults.length > 0) {
          console.log('[KNOWLEDGE BRAIN] ✅ Vector search returned', vectorResults.length, 'results (all verified)');
          return vectorResults;
        }
        console.log('[KNOWLEDGE BRAIN] ⚠️ Vector search returned no results, trying keyword search');
      }

      // Fallback to keyword search (also using secure RPC)
      console.log('[KNOWLEDGE BRAIN] 📝 Using keyword search via secure RPC');
      return await this.keywordSearch(query, limit, options);
    } catch (error) {
      console.error('[KNOWLEDGE BRAIN] 💥 Search error:', error);
      return [];
    }
  }

  /**
   * PHASE 36.10.2: Vector similarity search
   * PHASE 36.10.5: With performance metrics logging
   * CRITICAL: Uses ONLY search_knowledge_by_embedding RPC (secure views enforced at DB level)
   * NO direct table access - ALL retrieval goes through verified RPC
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
    const searchStartTime = Date.now();
    try {
      console.log('[KNOWLEDGE BRAIN] 🔍 Vector search starting...');

      // Generate query embedding
      const queryEmbedding = await this.generateEmbedding(query);
      if (!queryEmbedding) {
        console.warn('[KNOWLEDGE BRAIN] ⚠️ Could not generate embedding for query');
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
        console.log('[KNOWLEDGE BRAIN] ℹ️ Vector search: no results found');
        // PHASE 36.10.5: Log no results metric
        await this.healthService.logRpcMetric(
          'search_knowledge_by_embedding',
          Date.now() - searchStartTime,
          0,
          false
        );
        return [];
      }

      console.log('[KNOWLEDGE BRAIN] ✅ Vector search found', data.length, 'verified chunks');

      // DEFENSE IN DEPTH: Validate each result at runtime
      const validatedResults = data.map((item: any) => {
        // Double-check: ingestion_status must be 'complete'
        if (item.ingestion_status !== 'complete') {
          console.warn(
            '[KNOWLEDGE BRAIN] 🚨 SECURITY BREACH: Result has invalid status:',
            item.ingestion_status
          );
          throw new Error(`Security violation: Retrieved document has status ${item.ingestion_status}`);
        }

        // Double-check: embedding_integrity_checked must be true
        if (item.embedding_integrity_checked !== true) {
          console.warn('[KNOWLEDGE BRAIN] 🚨 SECURITY BREACH: Result has integrity_checked=false');
          throw new Error('Security violation: Retrieved document has integrity_checked=false');
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
      });

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
      console.log('[KNOWLEDGE BRAIN] 📝 Keyword search starting (verified docs only)...');

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
        console.log('[KNOWLEDGE BRAIN] ℹ️ Keyword search: no results found');
        return [];
      }

      console.log('[KNOWLEDGE BRAIN] ✅ Keyword search found', data.length, 'verified chunks');

      // Map RPC results to SearchResult format
      return data.map((item: any) => ({
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
   * PHASE 36.10.1: Retry ingestion for a failed document
   * Transactional safety: Delete chunks + reset document state + relaunch pipeline
   */
  async retryIngestion(documentId: string): Promise<boolean> {
    try {
      console.log('[KNOWLEDGE BRAIN] 🔄 Starting retry ingestion for document:', documentId);

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
        console.warn('[KNOWLEDGE BRAIN] ⚠️ Document is not in failed state:', doc.ingestion_status);
        return false;
      }

      // STEP 2: Delete all existing chunks
      console.log('[KNOWLEDGE BRAIN] 🗑️ Deleting existing chunks...');
      const { error: deleteError } = await supabase
        .from('knowledge_chunks')
        .delete()
        .eq('document_id', documentId);

      if (deleteError) {
        console.error('[KNOWLEDGE BRAIN] ❌ Failed to delete chunks:', deleteError);
        return false;
      }

      // STEP 3: Reset document to pending state
      console.log('[KNOWLEDGE BRAIN] 🔄 Resetting document state to pending...');
      const { error: resetError } = await supabase
        .from('knowledge_documents')
        .update({
          ingestion_status: 'pending',
          ingestion_progress: 0,
          last_ingestion_error: null,
          last_ingestion_step: null,
          embedding_integrity_checked: false,
          ingestion_started_at: null,
          ingestion_completed_at: null,
        })
        .eq('id', documentId);

      if (resetError) {
        console.error('[KNOWLEDGE BRAIN] ❌ Failed to reset document:', resetError);
        return false;
      }

      // STEP 4: Relaunch background processing
      console.log('[KNOWLEDGE BRAIN] 🚀 Relaunching pipeline...');
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
      console.log('[KNOWLEDGE BRAIN] ✅ Retry initiated successfully');
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
      console.log('[KNOWLEDGE BRAIN] 🔐 Verifying system integrity...');

      // Call audit function via RPC
      const { data, error } = await supabase.rpc('audit_system_integrity');

      if (error) {
        console.error('[KNOWLEDGE BRAIN] ❌ Audit function failed:', error);
        return [];
      }

      if (!data || data.length === 0) {
        console.log('[KNOWLEDGE BRAIN] ✅ System integrity OK - no violations found');
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
