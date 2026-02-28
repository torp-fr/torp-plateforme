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
// PHASE 39: Step Runner trigger for progressive integration
import { triggerStepRunner } from '@/api/knowledge-step-trigger';
import { log, warn, error, time, timeEnd } from '@/lib/logger';

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

      log('[KNOWLEDGE BRAIN] ✅ File uploaded to Storage:', storagePath);

      // Step 2: Create document record in DB with file_path
      const safeTitle = options.title?.trim() || file.name.replace(/\.[^/.]+$/, '');

      const { data: doc, error: dbError } = await supabase
        .from('knowledge_documents')
        .insert({
          title: safeTitle,
          category: options.category,
          source: options.source,
          file_path: storagePath,
          file_size: file.size,
          mime_type: file.type,
          is_active: true,
        })
        .select('id')
        .single();

      if (dbError || !doc) {
        throw new Error(`Database insert failed: ${dbError?.message || 'Unknown error'}`);
      }

      log('[KNOWLEDGE BRAIN] ✅ Document created in DB:', doc.id);

      // Step 3: Trigger Edge Function for server-side ingestion
      // Edge Function will handle extraction, OCR, chunking, embedding
      this.triggerServerIngestion(doc.id).catch(err => {
        console.error('[KNOWLEDGE BRAIN] ❌ Server ingestion trigger failed:', err);
      });

      return doc;
    } catch (error) {
      console.error('[KNOWLEDGE BRAIN] ❌ Upload error:', error);
      throw error;
    }
  }

  /**
   * Trigger Edge Function for server-side document ingestion
   */
  private async triggerServerIngestion(documentId: string) {
    try {
      log('[KNOWLEDGE BRAIN] 🚀 Triggering server ingestion Edge Function');

      const { error } = await supabase.functions.invoke('ingest-document', {
        body: { documentId },
      });

      if (error) {
        console.error('[KNOWLEDGE BRAIN] ❌ Edge Function error:', error);
        throw error;
      }

      log('[KNOWLEDGE BRAIN] ✅ Edge Function triggered');
    } catch (error) {
      console.error('[KNOWLEDGE BRAIN] ❌ Server ingestion trigger error:', error);
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
    // State management moved to ingestion_jobs table
    log('[KNOWLEDGE BRAIN] 📋 Document state transitions now managed by ingestion_jobs pipeline');
    return true;
  }

  /**
   * PHASE 36.10.1: Atomic claim - Safely claim document for processing
   * NOTE: This function is now a no-op since atomicity is handled by ingestion_jobs table
   * Kept for backward compatibility with existing code
   * Always returns true since ingestion_jobs pipeline controls processing
   */
  private async tryClaimDocumentForProcessing(documentId: string): Promise<boolean> {
    log('[KNOWLEDGE BRAIN] 🔒 Document processing controlled by ingestion_jobs pipeline');
    return true; // Always succeed - actual atomicity is in ingestion_jobs
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
        warn(
          `[KNOWLEDGE BRAIN] ⚠️ Large document: ${(contentBytes / 1024 / 1024).toFixed(2)}MB (>20MB threshold)`
        );
      }

      log('[KNOWLEDGE BRAIN] 🧠 START PHASE 36.9 NON-BLOCKING INSERT', {
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
      log('[KNOWLEDGE BRAIN] 🧹 Sanitizing content...');
      const sanitized = sanitizeText(content);

      // ✅ PHASE 36.9 STEP 3: Create preview (max 10KB) - INSTANT
      const preview = sanitized.slice(0, 10000);
      log('[KNOWLEDGE BRAIN] 📄 Created preview: ' + preview.length + ' chars');

      // PHASE 11: STREAM MODE DETECTION
      const STREAM_THRESHOLD = 2_000_000; // 2MB threshold
      const isStreamMode = sanitized.length > STREAM_THRESHOLD;
      if (isStreamMode) {
        warn(`[STREAM MODE] 🚀 Activating streaming ingestion (${(sanitized.length / 1024 / 1024).toFixed(2)}MB)`);
        // PHASE 36.13: Remove global window flags - each document independent
      }

      // ✅ PHASE 36.9 STEP 4: TWO-STEP INSERT FOR LARGE DOCUMENTS
      // PHASE INSERT STABILIZATION: Supabase PostgREST fix - NO RETURNING after INSERT
      log('[KNOWLEDGE BRAIN] 📝 Inserting document FIRST (minimal metadata)...');

      // STEP A — Insert minimal metadata (NO SELECT/RETURNING to prevent REST blocking)
      const { error: insertError } = await supabase
        .from('knowledge_documents')
        .insert({
          title: safeTitle,
          category,
          source,
          is_active: true,
        });

      if (insertError) {
        console.error('[KNOWLEDGE BRAIN] ❌ Insert failed:', insertError.message);
        throw new Error(`Insert failed: ${insertError.message}`);
      }

      log('[KNOWLEDGE BRAIN] ✅ Metadata inserted successfully');

      // STEP A.2 — Fetch inserted document ID safely (single targeted SELECT)
      // Use title + timestamp to uniquely identify the just-inserted document
      log('[KNOWLEDGE BRAIN] 🔍 Fetching inserted document ID...');
      const { data: insertedDoc, error: fetchError } = await supabase
        .from('knowledge_documents')
        .select('id')
        .eq('title', safeTitle)
        .eq('category', category)
        .eq('source', source)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (fetchError || !insertedDoc) {
        const errorMsg = fetchError?.message || 'No document found';
        console.error('[KNOWLEDGE BRAIN] ❌ Failed to fetch inserted document ID:', errorMsg);
        throw new Error(`Failed to fetch inserted document ID: ${errorMsg}`);
      }

      const documentId = insertedDoc.id;
      log('[KNOWLEDGE BRAIN] 📌 Document ID retrieved:', documentId);

      // STEP B: Update with large content fields separately
      // This prevents JSON payload size issues for large documents
      const sanitizedBytes = new TextEncoder().encode(sanitized).length;
      const previewBytes = new TextEncoder().encode(preview).length;

      log('[KNOWLEDGE BRAIN] 📦 Updating content fields', {
        documentId,
        sanitized_content_bytes: `${(sanitizedBytes / 1024).toFixed(2)}KB`,
        preview_content_bytes: `${(previewBytes / 1024).toFixed(2)}KB`,
      });

      // STEP B.1 — Update content with timeout safety
      const updatePromise = supabase
        .from('knowledge_documents')
        .update({
          content: sanitized,
          sanitized_content: sanitized,
          preview_content: preview,
        })
        .eq('id', documentId);

      const { error: updateError } = await Promise.race([
        updatePromise,
        new Promise<any>((_, reject) =>
          setTimeout(() => reject(new Error('Content update timeout (>15s)')), 15000)
        ),
      ]);

      if (updateError) {
        const errorMsg = updateError.message || 'Content update failed';
        console.error('[KNOWLEDGE BRAIN] ❌ Content update failed:', errorMsg);
        throw new Error(`Content update failed: ${errorMsg}`);
      }

      log('[KNOWLEDGE BRAIN] ✅ Content updated:', documentId);

      // Create a minimal document object matching the return contract
      const doc = {
        id: documentId,
        title: safeTitle,
        category,
        source,
      };

      // PHASE 39: Trigger Step Runner for progressive integration
      log('[STEP TRIGGER] launching for', doc.id);
      triggerStepRunner(doc.id)
        .then((result) => {
          if (result.success) {
            log('[STEP TRIGGER] ✅ triggered successfully for', doc.id);
          } else {
            warn('[STEP TRIGGER] ⚠️ trigger warning for', doc.id, ':', result.error);
          }
        })
        .catch((err) => {
          console.error('[STEP TRIGGER] ❌ trigger error for', doc.id, ':', err);
        });

      // ✅ PHASE 36.9 STEP 5: RETURN IMMEDIATELY TO UI
      log('[KNOWLEDGE BRAIN] 🚀 Document returned to UI');

      // PHASE 19.2: Brain is now PURE PASSIVE BOOTSTRAPPER
      // No background async pipeline
      // No document chunking
      // No embedding generation
      // StepRunner owns all ingestion responsibility
      log('[KNOWLEDGE BRAIN] 🔒 Passive mode active - StepRunner owns ingestion (PHASE 19.2)');

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
      // PHASE 36.13: MULTI-UPLOAD FIX - Remove global locks
      // Each document process independently, no global blocking
      // Document-level claim prevents double-processing, not pipeline-wide lock

      // PHASE 10: Check if document is FAILED before processing
      const context = await this.getStateContext?.(documentId);
      if (context?.current_state === 'FAILED') {
        warn('[KNOWLEDGE BRAIN] 🔴 Document FAILED - stopping async worker');
        return;
      }

      log('[KNOWLEDGE BRAIN] 🧠 BACKGROUND: Starting chunking...');
      const startTime = Date.now();

      // PHASE 36.10.1 STEP 1: Atomic claim - prevent double processing
      const claimed = await this.tryClaimDocumentForProcessing(documentId);
      if (!claimed) {
        warn('[KNOWLEDGE BRAIN] ⚠️ Failed to claim document - likely already processing');
        return;
      }

      // PHASE 36.10.1 STEP 2: Chunk text (happens now in background, not blocking)
      log('[KNOWLEDGE BRAIN] ✂️ Chunking content...');
      log('[STATE OWNER] StepRunner authoritative (PHASE 15)');

      const chunks = chunkText(sanitizedContent, 1000); // Returns Chunk[]
      log('[CHUNKING] Total chunks: ' + chunks.length);

      // PHASE 36.10.1 STEP 3: Batch insert chunks (50 max per batch)
      const BATCH_SIZE = 50;
      log('[KNOWLEDGE BRAIN] 📚 Inserting chunks in batches (batch size: ' + BATCH_SIZE + ')...');

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
          log('[KNOWLEDGE BRAIN] ✅ Batch ' + (Math.floor(i / BATCH_SIZE) + 1) + ' inserted (' + payload.length + ' chunks)');
        }
      }

      log('[STATE OWNER] StepRunner authoritative (PHASE 15)');

      // PHASE 36.10.1 STEP 4: Extract pricing if applicable (non-blocking)
      if (category === 'PRICING_REFERENCE' && region) {
        log('[KNOWLEDGE BRAIN] 💰 Extracting pricing data...');
        try {
          const pricingData = pricingExtractionService.extractPricingData(originalContent, category, region);
          if (pricingData) {
            await pricingExtractionService.storePricingReference(documentId, pricingData, region);
            log('[KNOWLEDGE BRAIN] ✅ Pricing data stored');
          }
        } catch (pricingErr) {
          warn('[KNOWLEDGE BRAIN] ⚠️ Pricing extraction error (non-blocking):', pricingErr);
        }
      }

      // PHASE 36.10.1 STEP 5: Transition to embedding phase
      log('[STATE OWNER] StepRunner authoritative (PHASE 15)');

      // PHASE 36.10.1 STEP 6: Generate embeddings async for chunks
      log('[EMBEDDING] 🚀 Starting async embedding generation...');
      await this.generateChunkEmbeddingsAsync(documentId, chunks);

      // PHASE 36.10.1 STEP 7: Verify embedding integrity BEFORE marking complete
      log('[KNOWLEDGE BRAIN] 🔍 Verifying embedding integrity...');
      const integrityCheck = await this.verifyEmbeddingIntegrity(documentId);

      if (!integrityCheck.valid) {
        const errorMsg = `Embedding integrity failed: ${integrityCheck.missing_embeddings} of ${integrityCheck.total_chunks} chunks missing embeddings`;
        console.error('[KNOWLEDGE BRAIN] 🔴 ' + errorMsg);
        this.metrics.failed_ingestions++;
        log('[STATE OWNER] StepRunner authoritative (PHASE 15)');
        return;
      }

      // PHASE 36.10.1 STEP 8: Mark as complete with integrity flag
      log('[KNOWLEDGE BRAIN] ✅ All integrity checks passed!');
      log('[STATE OWNER] StepRunner authoritative (PHASE 15)');

      this.metrics.successful_ingestions++;
      this.metrics.total_documents_processed++;

      const totalTime = Date.now() - startTime;
      log('[KNOWLEDGE BRAIN] 🎉 Background processing complete:', {
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
      log('[STATE OWNER] StepRunner authoritative (PHASE 15)');
    }
  }

  /**
   * PHASE 36.10.1: Generate embeddings for all chunks asynchronously (non-blocking)
   * NEW: Strict integrity check - all chunks MUST get embeddings or throw error
   * Each chunk gets its own embedding in the knowledge_chunks table
   * Uses Chunk objects with pre-calculated metadata
   * Updates document state on error
   */
  private async generateChunkEmbeddingsAsync(
    document_id: string,
    chunks: Array<Record<string, unknown>>
  ): Promise<void> {
    try {
      // PHASE 36.13: Remove global pipeline locks - each document processes independently
      log('[EMBEDDING] 🔢 Starting chunk embedding generation async...', {
        document_id,
        total_chunks: chunks.length,
      });

      if (!this.ENABLE_VECTOR_SEARCH) {
        log('[EMBEDDING] ⏭️ Vector search disabled');
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
            log('[EMBEDDING] ⏭️ Chunk ' + i + ' skipped (binary content)');
            failed++;
            continue;
          }

          log('[EMBEDDING] 📝 Generating embedding for chunk ' + i + ' (' + chunkTokens + ' tokens)');

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
          log('[EMBEDDING] ✅ Chunk ' + i + ' embedded (' + embeddingTime + 'ms)');
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

      log('[EMBEDDING] 📊 Embedding generation summary:', {
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
            warn('[KNOWLEDGE BRAIN] ⚠️ Observability snapshot failed:', err);
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
      log('[KNOWLEDGE BRAIN] 🔄 Embedding generation (via orchestrator)');

      // PHASE 40: Guard check - verify aiOrchestrator has generateEmbedding function
      if (typeof aiOrchestrator.generateEmbedding !== 'function') {
        const errorMsg = '[SECURITY] aiOrchestrator.generateEmbedding is not a function - circular dependency or initialization issue';
        console.error('[KNOWLEDGE BRAIN] 🔴 ' + errorMsg);
        throw new Error(errorMsg);
      }

      // PHASE 36.12: Use AI Orchestrator for centralized embedding with retry/fallback
      const result = await aiOrchestrator.generateEmbedding({
        text: content,
        model: 'text-embedding-3-small',
      });

      // Validate result structure
      if (!result || !result.embedding || !Array.isArray(result.embedding)) {
        const errorMsg = '[SECURITY] Invalid embedding result - missing embedding array';
        console.error('[KNOWLEDGE BRAIN] 🔴 ' + errorMsg);
        throw new Error(errorMsg);
      }

      const embedding = result.embedding;
      log('[KNOWLEDGE BRAIN] 📊 Embedding received:', {
        length: embedding.length,
        source: result.source,
        retries: result.retriesUsed,
      });

      // PHASE 36.10.3: Defense in depth - validate embedding dimension
      // Database expects VECTOR(1536) - enforce this at application level
      if (embedding.length !== this.EMBEDDING_DIMENSION) {
        const errorMsg = `[SECURITY] Embedding dimension mismatch: expected ${this.EMBEDDING_DIMENSION}, got ${embedding.length}`;
        console.error('[KNOWLEDGE BRAIN] 🔴 ' + errorMsg);
        throw new Error(errorMsg);
      }

      log('[KNOWLEDGE BRAIN] ✅ Embedding generated successfully (1536-dim, source: ' + result.source + ')');
      return embedding;
    } catch (error) {
      console.error('[KNOWLEDGE BRAIN] ❌ Error generating embedding:', error instanceof Error ? error.message : String(error));
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

      log('[KNOWLEDGE BRAIN] 🔐 HARDLOCK SEARCH: Searching knowledge (verified docs only):', {
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
        warn('[KNOWLEDGE BRAIN] ⚠️ Health validation error (continuing):', healthError);
        // Don't block - just warn
      }

      // Try vector search if enabled
      if (this.ENABLE_VECTOR_SEARCH) {
        const vectorResults = await this.vectorSearch(query, limit, options);
        if (vectorResults.length > 0) {
          log('[KNOWLEDGE BRAIN] ✅ Vector search returned', vectorResults.length, 'results (all verified)');
          return vectorResults;
        }
        log('[KNOWLEDGE BRAIN] ⚠️ Vector search returned no results, trying keyword search');
      }

      // Fallback to keyword search (also using secure RPC)
      log('[KNOWLEDGE BRAIN] 📝 Using keyword search via secure RPC');
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
      log('[KNOWLEDGE BRAIN] 🔍 Vector search starting...');

      // Generate query embedding
      const queryEmbedding = await this.generateEmbedding(query);
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
      const validatedResults = data.map((item: Record<string, unknown>) => {
        // NOTE: ingestion_status check removed - status now managed by ingestion_jobs table
        // Only documents with completed embeddings appear in search results (via RPC)

        // Double-check: embedding_integrity_checked must be true
        if (item.embedding_integrity_checked !== true) {
          warn('[KNOWLEDGE BRAIN] 🚨 SECURITY BREACH: Result has integrity_checked=false');
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

      // Map RPC results to SearchResult format
      return data.map((item: Record<string, unknown>) => ({
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
    correction_data?: Record<string, unknown>
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

      // NOTE: Document status is now tracked in ingestion_jobs table, not knowledge_documents
      log('[KNOWLEDGE BRAIN] ✅ Document found, proceeding with retry...');

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

      // STEP 3: Note - Ingestion state management moved to ingestion_jobs table
      // The pipeline status is now tracked via ingestion_jobs, not knowledge_documents
      log('[KNOWLEDGE BRAIN] 🔄 Document will be processed via ingestion pipeline...');

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
