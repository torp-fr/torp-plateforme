/**
 * PHASE 38C: Knowledge Ingestion Step Runner
 *
 * Orchestrates document ingestion by stepping through each stage independently.
 * Decouples ingestion steps using the state machine, enabling:
 * - Resumable processing from any checkpoint
 * - Better error isolation per step
 * - Independent testing of each step
 * - Foundation for distributed processing
 *
 * IMPORTANT: This is an ORCHESTRATION layer only.
 * All actual logic remains in knowledge-brain.service.
 * This service coordinates the flow via state machine.
 */

import { knowledgeBrainService } from '@/services/ai/knowledge-brain.service';
import { ingestionStateMachineService } from './ingestionStateMachine.service';
import { DocumentIngestionState, IngestionFailureReason } from './ingestionStates';
import { supabase } from '@/lib/supabase';
import { log, warn, error, time, timeEnd } from '@/lib/logger';

export interface StepResult {
  success: boolean;
  nextState?: DocumentIngestionState;
  error?: string;
  duration: number;
}

export class KnowledgeStepRunnerService {
  /**
   * PHASE 17: Document-level lock registry
   * Replaces global __RAG_PIPELINE_LOCKED__ with per-document isolation
   */
  static {
    if (!(window as any).__RAG_DOC_LOCKS__) {
      (window as any).__RAG_DOC_LOCKS__ = {};
    }
    // PHASE 40: Initialize retry tracking per document
    if (!(window as any).__RAG_RETRY_COUNTS__) {
      (window as any).__RAG_RETRY_COUNTS__ = {};
    }
  }

  /**
   * PHASE 40: Maximum retry attempts per document to prevent infinite loops
   */
  private static readonly MAX_RETRIES_PER_DOCUMENT = 3;

  /**
   * PHASE 12: Adaptive Stream Controller Configuration
   */
  private static getAdaptiveStreamConfig() {
    const controller = (window as any).__RAG_STREAM_CONTROLLER__ || {};
    return {
      batchSize: controller.batchSize ?? 50,
      throttleMs: controller.throttleMs ?? 80,
      latencyAvg: controller.latencyAvg ?? 0,
      errorRate: controller.errorRate ?? 0,
      adaptiveLevel: controller.adaptiveLevel ?? 'NORMAL',
    };
  }

  private static updateLatencyTrend(predictor: any) {
    if (predictor.samples.length < 6) return;

    const last = predictor.samples.slice(-3);
    const prev = predictor.samples.slice(-6, -3);

    const avgLast = last.reduce((a: number, b: number) => a + b, 0) / last.length;
    const avgPrev = prev.reduce((a: number, b: number) => a + b, 0) / prev.length;

    // PHASE 13: Detect trend
    if (avgLast > avgPrev * 1.35) {
      predictor.trend = 'RISING';
    } else if (avgLast < avgPrev * 0.7) {
      predictor.trend = 'FALLING';
    } else {
      predictor.trend = 'STABLE';
    }

    // PHASE 13: Predict risk based on trend and latency
    if (predictor.trend === 'RISING') {
      const latencyAvg = predictor.samples.reduce((a: number, b: number) => a + b, 0) / predictor.samples.length;
      if (latencyAvg > 2000) {
        predictor.predictedRisk = 'HIGH';
      } else if (latencyAvg > 1200) {
        predictor.predictedRisk = 'MEDIUM';
      } else {
        predictor.predictedRisk = 'LOW';
      }
    } else {
      predictor.predictedRisk = 'LOW';
    }

    log(`[LATENCY PREDICTOR] trend: ${predictor.trend} → risk: ${predictor.predictedRisk}`);
  }

  private static updateAdaptiveMetrics(latency: number, error: boolean = false) {
    const controller = (window as any).__RAG_STREAM_CONTROLLER__ || {
      batchSize: 50,
      throttleMs: 80,
      latencySum: 0,
      latencyCount: 0,
      errorCount: 0,
      consecutiveErrors: 0,
      errorRate: 0,
      adaptiveLevel: 'NORMAL',
    };

    // PHASE 13: Collect latency samples for prediction
    const predictor = (window as any).__RAG_LATENCY_PREDICTOR__ ?? {
      samples: [],
      trend: 'STABLE',
      predictedRisk: 'LOW',
    };
    predictor.samples.push(latency);
    if (predictor.samples.length > 12) {
      predictor.samples.shift();
    }

    controller.latencySum = (controller.latencySum || 0) + latency;
    controller.latencyCount = (controller.latencyCount || 0) + 1;
    controller.latencyAvg = controller.latencySum / controller.latencyCount;

    if (error) {
      controller.errorCount = (controller.errorCount || 0) + 1;
      controller.consecutiveErrors = (controller.consecutiveErrors || 0) + 1;
    } else {
      controller.consecutiveErrors = 0;
    }

    controller.errorRate = controller.latencyCount > 0 ? (controller.errorCount / controller.latencyCount) * 100 : 0;

    // PHASE 13: Update latency trend
    this.updateLatencyTrend(predictor);

    // PHASE 12: Adaptive algorithm
    let newLevel = 'NORMAL';
    let newBatchSize = controller.batchSize || 50;
    let newThrottleMs = controller.throttleMs || 80;

    // PHASE 13: Pre-slowdown based on predicted risk
    if (predictor.predictedRisk === 'HIGH') {
      newLevel = 'SAFE';
      newBatchSize = Math.max(newBatchSize - 5, 30);
      newThrottleMs = newThrottleMs + 20;
      log(`[LATENCY PREDICTOR] 🔮 High risk detected → pre-slowdown (${predictor.trend})`);
    }
    // CRITICAL: 3 consecutive errors
    else if (controller.consecutiveErrors >= 3) {
      newLevel = 'CRITICAL';
      if (!(window as any).__RAG_EMBEDDING_PAUSED__) {
        warn('[STREAM CTRL] 🔴 CRITICAL: 3 consecutive errors → pausing embedding');
        (window as any).__RAG_EMBEDDING_PAUSED__ = true;
        window.dispatchEvent(new Event('RAG_EMBEDDING_PAUSED'));
      }
    }
    // SAFE: latency > 2500ms OR errorRate > 20%
    else if (controller.latencyAvg > 2500 || controller.errorRate > 20) {
      newLevel = 'SAFE';
      newBatchSize = Math.max((controller.batchSize || 50) - 10, 20);
      newThrottleMs = Math.min((controller.throttleMs || 80) + 30, 200);
      log(`[STREAM CTRL] 🟠 SAFE: latencyAvg ${controller.latencyAvg.toFixed(0)}ms (${controller.errorRate.toFixed(1)}% errors) → batch ${newBatchSize}, throttle ${newThrottleMs}ms`);
    }
    // FAST: latency < 900ms AND errorRate < 5%
    else if (controller.latencyAvg < 900 && controller.errorRate < 5) {
      newLevel = 'FAST';
      newBatchSize = Math.min((controller.batchSize || 50) + 10, 80);
      newThrottleMs = Math.max((controller.throttleMs || 80) - 10, 20);
      log(`[STREAM CTRL] 🟢 FAST: latencyAvg ${controller.latencyAvg.toFixed(0)}ms (${controller.errorRate.toFixed(1)}% errors) → batch ${newBatchSize}, throttle ${newThrottleMs}ms`);
    }
    // NORMAL: default
    else {
      newLevel = 'NORMAL';
      newBatchSize = 50;
      newThrottleMs = 80;
      log(`[STREAM CTRL] 🟡 NORMAL: latencyAvg ${controller.latencyAvg.toFixed(0)}ms (${controller.errorRate.toFixed(1)}% errors)`);
    }

    controller.batchSize = newBatchSize;
    controller.throttleMs = newThrottleMs;
    controller.adaptiveLevel = newLevel;

    (window as any).__RAG_STREAM_CONTROLLER__ = controller;
    (window as any).__RAG_LATENCY_PREDICTOR__ = predictor;
    window.dispatchEvent(new Event('RAG_STREAM_CONTROLLER_UPDATED'));
  }

  /**
   * Run the next step for a document based on its current ingestion_status
   *
   * Flow:
   * UPLOADED: → EXTRACTING (on demand, not automatic)
   * EXTRACTING: → CHUNKING
   * CHUNKING: → EMBEDDING
   * EMBEDDING: → FINALIZING
   * FINALIZING: → COMPLETED
   * COMPLETED/FAILED: terminal (nothing to run)
   *
   * @param documentId Document ID
   * @returns StepResult with success status and next state
   */
  static async runNextStep(documentId: string): Promise<StepResult> {
    const startTime = Date.now();

    // PHASE 19: Initialize active pipeline counter (safe global tracking)
    if ((window as any).__RAG_ACTIVE_PIPELINES__ === undefined) {
      (window as any).__RAG_ACTIVE_PIPELINES__ = 0;
      log('[LOAD SAFETY] 📊 Active pipeline counter initialized');
    }

    // PHASE 18.1: Generate unique runtime instance ID (once per browser tab/window)
    if (!(window as any).__RAG_RUNNER_INSTANCE_ID__) {
      const timestamp = Date.now().toString(36);
      const randomPart = Math.random().toString(36).substring(2, 9);
      (window as any).__RAG_RUNNER_INSTANCE_ID__ = `steprunner_${timestamp}_${randomPart}`;
      log(`[STEP RUNNER] 🆔 Phase 18.1 - Instance ID assigned: ${(window as any).__RAG_RUNNER_INSTANCE_ID__}`);
    }

    const currentInstanceId = (window as any).__RAG_RUNNER_INSTANCE_ID__;

    // PHASE 18: Ownership guard - prevent concurrent runner instances from different tabs/contexts
    const ownerInstanceId = (window as any).__RAG_RUNNER_OWNER_ID__;

    if (ownerInstanceId && ownerInstanceId !== currentInstanceId) {
      warn(`[STEP RUNNER] 🚫 Ownership conflict: pipeline owned by different instance (${ownerInstanceId})`);
      return {
        success: false,
        error: `Pipeline already owned by different instance: ${ownerInstanceId}`,
        duration: Date.now() - startTime,
      };
    }

    // PHASE 19.9: Declare result variable for unified return handling
    let result: StepResult;

    try {
      // PHASE 15 FIX: Set ownership flag (lazy initialization)
      if (!(window as any).__RAG_RUNNER_OWNER__) {
        (window as any).__RAG_RUNNER_OWNER__ = true;
        (window as any).__RAG_RUNNER_OWNER_ID__ = currentInstanceId;
        log('[STEP RUNNER] 🏆 Ownership claimed - runner is authoritative ingestion engine');
        log(`[STEP RUNNER] 📋 Instance: ${currentInstanceId}`);
        log('[STEP RUNNER] 📋 All ingestion pipelines now delegated to StepRunner');
      }

      // PHASE 17: Check for document-level lock
      if ((window as any).__RAG_DOC_LOCKS__?.[documentId]) {
        warn(`[UNIFIED KERNEL] 🔒 Document locked — skipping ${documentId}`);
        result = {
          success: false,
          error: 'Document is locked - worker skipping this doc',
          duration: Date.now() - startTime,
        };
      } else {
        // PHASE 18.2: REMOVED __RAG_PIPELINE_RUNNING__ global lock
        // Keep ONLY document-level locking (PHASE 17)
        // Allows multiple documents to be processed in parallel

        // Set flag to prevent concurrent pipelines ON THIS DOCUMENT
        (window as any).__RAG_DOC_LOCKS__ = (window as any).__RAG_DOC_LOCKS__ || {};
        // PHASE 19.10: Store lock with ownership information
        (window as any).__RAG_DOC_LOCKS__[documentId] = {
          owner: currentInstanceId,
          acquiredAt: Date.now(),
        };
        log(`[STEP RUNNER] 🚀 Running next step for document ${documentId}`);

        // Get current state
        const context = await ingestionStateMachineService.getStateContext(documentId);
        if (!context) {
          delete (window as any).__RAG_DOC_LOCKS__[documentId];
          result = {
            success: false,
            error: 'Failed to fetch document state',
            duration: Date.now() - startTime,
          };
        } else {
          // PHASE 19.1: MOVED INCREMENT HERE - only after all guards pass
          // Prevents counter drift from failed validation attempts
          (window as any).__RAG_ACTIVE_PIPELINES__++;
          const activeCount = (window as any).__RAG_ACTIVE_PIPELINES__;
          log(`[LOAD SAFETY] 📈 Pipeline active: ${activeCount} total (document: ${documentId})`);

          const currentState = context.current_state;
          log(`[STEP RUNNER] Current state: ${currentState}`);

          // PHASE 19: Adaptive concurrency limit (load safety)
          const isBigDocMode = Boolean((window as any).__RAG_BIG_DOC_MODE__);
          const CONCURRENCY_LIMIT = 3;

          if (activeCount > CONCURRENCY_LIMIT && !isBigDocMode) {
            warn(`[LOAD SAFETY] 🛑 Throttling: ${activeCount} active pipelines (limit: ${CONCURRENCY_LIMIT})`);
            result = {
              success: false,
              error: 'Load safety throttle: concurrency limit exceeded',
              throttled: true,
              duration: Date.now() - startTime,
            };
          } else {
            // PHASE 19: Latency-aware backoff
            const predictor = (window as any).__RAG_LATENCY_PREDICTOR__;
            if (predictor && predictor.predictedRisk === 'HIGH') {
              const backoffDelay = 500 + Math.random() * 500;
              warn(`[LOAD SAFETY] ⏳ Latency backoff applied: ${backoffDelay.toFixed(0)}ms (predicted risk: ${predictor.predictedRisk})`);
              await new Promise(resolve => setTimeout(resolve, backoffDelay));
            }

            // Determine next step and run it
            switch (currentState) {
              case DocumentIngestionState.PENDING:
                // PHASE 19.6: Document in PENDING state (inserted by passive Brain)
                // Transition to EXTRACTING to start pipeline
                log(`[STEP RUNNER] 🔄 Document PENDING - claiming and starting extraction`);
                await ingestionStateMachineService.transitionTo(
                  documentId,
                  DocumentIngestionState.EXTRACTING,
                  'extraction_starting'
                );
                result = {
                  success: true,
                  nextState: DocumentIngestionState.EXTRACTING,
                  duration: Date.now() - startTime,
                };
                break;

              case DocumentIngestionState.UPLOADED:
                log(`[STEP RUNNER] ℹ️ Document UPLOADED - waiting for extraction trigger`);
                result = {
                  success: true,
                  nextState: DocumentIngestionState.UPLOADED,
                  duration: Date.now() - startTime,
                };
                break;

              case DocumentIngestionState.EXTRACTING:
                // PHASE 19.6: Extraction step bypass (text-first architecture)
                // Brain already extracted text during document insert
                // StepRunner bypasses extraction and proceeds to chunking
                log('[STEP RUNNER] ⏩ Extraction bypassed (PHASE 19.6 - text already available)');

                await ingestionStateMachineService.transitionTo(
                  documentId,
                  DocumentIngestionState.CHUNKING,
                  'extraction_bypassed'
                );

                result = {
                  success: true,
                  nextState: DocumentIngestionState.CHUNKING,
                  bypassed: true,
                  duration: Date.now() - startTime,
                };
                break;

              case DocumentIngestionState.CHUNKING:
                result = await this.runChunkingStep(documentId);
                break;

              case DocumentIngestionState.EMBEDDING:
                result = await this.runEmbeddingStep(documentId);
                break;

              case DocumentIngestionState.FINALIZING:
                result = await this.runFinalizingStep(documentId);
                break;

              case DocumentIngestionState.COMPLETED:
                log(`[STEP RUNNER] ✅ Document already COMPLETED`);
                result = {
                  success: true,
                  // No nextState - COMPLETED is terminal
                  duration: Date.now() - startTime,
                };
                break;

              case DocumentIngestionState.FAILED:
                log(`[STEP RUNNER] ❌ Document in FAILED state`);
                result = {
                  success: false,
                  error: context.error_message || 'Document processing failed',
                  // No nextState - FAILED is terminal
                  duration: Date.now() - startTime,
                };
                break;

              default:
                result = {
                  success: false,
                  error: `Unknown state: ${currentState}`,
                  duration: Date.now() - startTime,
                };
                break;
            }
          }
        }
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      console.error(`[STEP RUNNER] 💥 Step runner error:`, errorMsg);
      result = {
        success: false,
        error: errorMsg,
        duration: Date.now() - startTime,
      };
    } finally {
      // PHASE 18.2: Remove document-level lock
      if ((window as any).__RAG_DOC_LOCKS__) {
        delete (window as any).__RAG_DOC_LOCKS__[documentId];
      }

      // PHASE 19: Decrement active pipeline count
      (window as any).__RAG_ACTIVE_PIPELINES__--;
      log(`[LOAD SAFETY] 📉 Pipeline inactive: ${(window as any).__RAG_ACTIVE_PIPELINES__} remaining`);
    }

    // PHASE 19.9: CRITICAL FIX - Auto-chain AFTER finally (lock is released)
    // This code executes AFTER the finally block completes
    // Ensures document lock is released before scheduling next step
    // PHASE 40: Added retry bounds to prevent infinite loops
    if (result?.success && result?.nextState) {
      const retryCount = (window as any).__RAG_RETRY_COUNTS__[documentId] ?? 0;

      // Check if we've exceeded max retries
      if (retryCount >= this.MAX_RETRIES_PER_DOCUMENT) {
        console.error(
          `[STEP RUNNER] 🚫 FATAL: Document ${documentId} exceeded max retries (${this.MAX_RETRIES_PER_DOCUMENT}). ` +
          `State: ${result.nextState}. Marking FAILED to prevent infinite loop.`
        );
        await ingestionStateMachineService.markFailed(
          documentId,
          IngestionFailureReason.UNKNOWN_ERROR,
          `Exceeded maximum retries (${this.MAX_RETRIES_PER_DOCUMENT}). Possible infinite loop detected.`,
          undefined
        );
      } else {
        // Increment retry count for this document
        (window as any).__RAG_RETRY_COUNTS__[documentId] = retryCount + 1;

        log('[STEP RUNNER] 🔁 Auto-chain next step:', result.nextState, `(attempt ${retryCount + 1}/${this.MAX_RETRIES_PER_DOCUMENT})`);

        // PHASE 40: Add exponential backoff to prevent tight loops
        const delayMs = Math.min(100 * Math.pow(2, retryCount), 2000);
        setTimeout(() => {
          KnowledgeStepRunnerService.runNextStep(documentId).catch((err) =>
            warn('[STEP RUNNER] ⚠️ Auto-chain error:', err)
          );
        }, delayMs);
      }
    } else if (result?.success) {
      // Terminal state reached - reset retry counter
      delete (window as any).__RAG_RETRY_COUNTS__[documentId];
    }

    return result;
  }

  /**
   * STEP 1: Extraction (EXTRACTING state)
   * Extracts text from PDF document
   *
   * Calls knowledge-brain.service internal function
   * On success: transitions to CHUNKING
   * On failure: marks FAILED with EXTRACTION error
   */
  private static async runExtractionStep(documentId: string): Promise<StepResult> {
    const startTime = Date.now();

    try {
      log(`[STEP RUNNER] 📄 EXTRACTION STEP: Extracting text from PDF...`);

      // Fetch document to get file path
      const { data: doc, error: fetchError } = await supabase
        .from('knowledge_documents')
        .select('file_path, original_content')
        .eq('id', documentId)
        .single();

      if (fetchError || !doc) {
        throw new Error(`Failed to fetch document: ${fetchError?.message || 'Not found'}`);
      }

      // Get the content (either from original_content or would need to fetch from storage)
      // This assumes the document has original_content stored
      if (!doc.original_content) {
        throw new Error('No content available for extraction');
      }

      const content = doc.original_content;
      log(`[STEP RUNNER] ✅ Text extracted (${content.length} chars)`);

      // Validate extraction
      if (!content || content.trim().length === 0) {
        await ingestionStateMachineService.markFailed(
          documentId,
          IngestionFailureReason.EXTRACTION_EMPTY,
          'No text content extracted from document',
          undefined
        );
        return {
          success: false,
          nextState: DocumentIngestionState.FAILED,
          error: 'Extraction returned empty content',
          duration: Date.now() - startTime,
        };
      }

      // Transition to CHUNKING
      const transitioned = await ingestionStateMachineService.transitionTo(
        documentId,
        DocumentIngestionState.CHUNKING,
        'extraction_complete'
      );

      if (!transitioned) {
        throw new Error('Failed to transition to CHUNKING state');
      }

      log(`[STEP RUNNER] 🎉 EXTRACTION complete → CHUNKING`);
      return {
        success: true,
        nextState: DocumentIngestionState.CHUNKING,
        duration: Date.now() - startTime,
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown extraction error';
      console.error(`[STEP RUNNER] ❌ Extraction failed:`, errorMsg);

      await ingestionStateMachineService.markFailed(
        documentId,
        IngestionFailureReason.EXTRACTION_ERROR || IngestionFailureReason.UNKNOWN_ERROR,
        errorMsg,
        error instanceof Error ? error.stack : undefined
      );

      return {
        success: false,
        nextState: DocumentIngestionState.FAILED,
        error: errorMsg,
        duration: Date.now() - startTime,
      };
    }
  }

  /**
   * PHASE 9: STEP 2 - Chunking (CHUNKING state)
   * Splits extracted text into semantic chunks
   *
   * CRITICAL: Single source of truth for chunking
   * - knowledgeStepRunner orchestrates ONLY
   * - knowledgeBrainService must NOT re-chunk
   * - Verify chunks aren't already inserted (anti-double-pipeline)
   * - Support massive documents with throttling
   *
   * On success: transitions to EMBEDDING
   * On failure: marks FAILED with CHUNKING error
   */
  private static async runChunkingStep(documentId: string): Promise<StepResult> {
    const startTime = Date.now();

    try {
      log(`[STEP RUNNER] ✂️ CHUNKING STEP: Splitting text into chunks...`);

      // PHASE 9: Check if chunks already exist (prevent double-chunking)
      const { data: existingChunks } = await supabase
        .from('knowledge_chunks')
        .select('id', { count: 'exact', head: true })
        .eq('document_id', documentId);

      if (existingChunks && existingChunks.length > 0) {
        log(`[STEP RUNNER] ℹ️ Chunks already exist (${existingChunks.length}) - skipping rechunking`);
        // Transition directly to EMBEDDING
        const transitioned = await ingestionStateMachineService.transitionTo(
          documentId,
          DocumentIngestionState.EMBEDDING,
          'chunks_already_created'
        );
        if (!transitioned) {
          throw new Error('Failed to transition to EMBEDDING state');
        }
        return {
          success: true,
          nextState: DocumentIngestionState.EMBEDDING,
          duration: Date.now() - startTime,
        };
      }

      // PHASE 19.8: TEXT-FIRST ARCHITECTURE
      // Fetch content directly from database (inserted by Brain)
      log(`[STEP RUNNER] 📚 Chunking: Fetching document ${documentId} from database`);

      const { data: doc, error: fetchError } = await supabase
        .from('knowledge_documents')
        .select('id, content, sanitized_content, preview_content')
        .eq('id', documentId)
        .single();

      if (fetchError) {
        console.error('[STEP RUNNER] 🔴 Fetch error details:', {
          message: fetchError.message,
          code: (fetchError as any).code,
          details: (fetchError as any).details,
        });
        throw new Error(`Failed to fetch document: ${fetchError.message}`);
      }

      if (!doc) {
        console.error('[STEP RUNNER] 🔴 Document not found in database');
        throw new Error('Document not found in database');
      }

      log(`[STEP RUNNER] ✅ Document fetched. Available columns:`, {
        has_content: !!doc.content,
        has_sanitized_content: !!doc.sanitized_content,
        has_preview_content: !!doc.preview_content,
      });

      // Priority: sanitized_content > content > preview_content
      const sourceContent =
        doc?.sanitized_content ??
        doc?.content ??
        doc?.preview_content ??
        '';

      if (!sourceContent || sourceContent.length === 0) {
        console.error('[STEP RUNNER] 🔴 No text content available in any column:', {
          doc_id: doc.id,
          has_sanitized_content: !!doc.sanitized_content,
          has_content: !!doc.content,
          has_preview_content: !!doc.preview_content,
        });
        throw new Error('Missing text content for chunking');
      }

      log(`[STEP RUNNER] 📝 Using text content (${sourceContent.length} chars) for chunking`);

      const contentLength = sourceContent.length;
      const isBigDoc = contentLength > 1_000_000; // 1MB threshold
      const isStreamMode = Boolean((window as any).__RAG_STREAM_MODE__);

      // PHASE STABILIZATION: PRE-CHECK chunk limit BEFORE chunking
      // This prevents persisting chunks we'll later have to fail on
      const TARGET_CHUNK_SIZE = 3000;
      const MAX_CHUNKS = 1200; // Configurable limit
      const estimatedChunks = Math.ceil(contentLength / TARGET_CHUNK_SIZE);

      if (estimatedChunks > MAX_CHUNKS) {
        const errorMsg = `Document too large: estimated ${estimatedChunks} chunks (max ${MAX_CHUNKS})`;
        console.error(`[STEP RUNNER] 🚫 PRE-CHECK FAILED: ${errorMsg}`);

        // Mark as failed WITHOUT creating chunks
        await ingestionStateMachineService.markFailed(
          documentId,
          IngestionFailureReason.CHUNKING_ERROR,
          errorMsg,
          undefined
        );

        return {
          success: false,
          nextState: DocumentIngestionState.FAILED,
          error: errorMsg,
          duration: Date.now() - startTime,
        };
      }

      // PHASE 9: Detect big document mode
      if (isBigDoc) {
        warn(`[STEP RUNNER] 📚 BIG DOCUMENT DETECTED: ${contentLength} chars - activating throttled mode`);
        (window as any).__RAG_BIG_DOC_MODE__ = true;
        window.dispatchEvent(new Event('RAG_BIG_DOC_MODE_ACTIVATED'));
      }

      // Use knowledge-brain service chunking function
      const { chunkText } = await import('@/utils/chunking');

      // PHASE 11: STREAMING CHUNKING ENGINE
      let chunks: any[] = [];
      let globalChunkIndex = 0; // PHASE 12: Global chunk index for entire document
      if (isStreamMode) {
        log(`[STEP RUNNER] 🌊 STREAM MODE: Chunking ${(contentLength / 1024 / 1024).toFixed(2)}MB with micro-batching`);
        const STREAM_SLICE_SIZE = 60000; // 60KB slices
        const STREAM_BATCH_SIZE = 40;

        for (let offset = 0; offset < sourceContent.length; offset += STREAM_SLICE_SIZE) {
          // PHASE 17: Check document-level lock during streaming
          if ((window as any).__RAG_DOC_LOCKS__?.[documentId]) {
            warn(`[STREAM CHUNKING] 🔒 Document locked mid-stream`);
            throw new Error('Document locked during streaming ingestion');
          }

          const slice = sourceContent.slice(offset, offset + STREAM_SLICE_SIZE);
          const partialChunks = chunkText(slice, 1000);

          if (partialChunks && partialChunks.length > 0) {
            chunks.push(...partialChunks);

            // Insert batch every STREAM_BATCH_SIZE chunks
            if (chunks.length >= STREAM_BATCH_SIZE) {
              log(`[STEP RUNNER] 💾 Stream batch: inserting ${chunks.length} chunks...`);
              const { error: insertError } = await supabase
                .from('knowledge_chunks')
                .insert(
                  chunks.map((chunk) => ({
                    document_id: documentId,
                    content: chunk.content,
                    chunk_index: globalChunkIndex++, // PHASE 12: Use global index
                  }))
                );

              if (insertError) {
                warn(`[STEP RUNNER] ⚠️ Batch insert warning:`, insertError.message);
              }

              chunks = []; // Reset for next batch
            }
          }

          // Yield thread back to browser
          await new Promise(resolve => setTimeout(resolve, 0));
        }
      } else {
        // Standard chunking for normal documents
        chunks = chunkText(sourceContent, 1000);
      }

      // Insert remaining chunks from stream
      if (isStreamMode && chunks.length > 0) {
        log(`[STEP RUNNER] 💾 Stream final batch: inserting ${chunks.length} chunks...`);
        const { error: insertError } = await supabase
          .from('knowledge_chunks')
          .insert(
            chunks.map((chunk) => ({
              document_id: documentId,
              content: chunk.content,
              chunk_index: globalChunkIndex++, // PHASE 12: Use global index
            }))
          );

        if (insertError) {
          warn(`[STEP RUNNER] ⚠️ Final batch insert warning:`, insertError.message);
        }
      }

      // PHASE 19.11C: REAL CHUNK PERSISTENCE (SCHEMA-COMPATIBLE)
      // PHASE 19.13: Normalize chunk shape (text or content field)
      // Insert non-stream chunks with content_length for integrity checks
      if (!isStreamMode && chunks.length > 0) {
        const rows = chunks
          .map((chunk, index) => {
            const text = chunk?.text ?? chunk?.content ?? null;
            if (!text) {
              warn('[STEP RUNNER] ⚠️ Skipping empty chunk at index', index);
              return null;
            }
            return {
              document_id: documentId,
              content: text,
              chunk_index: index,
              content_length: text.length,
            };
          })
          .filter(Boolean);

        log('[STEP RUNNER] 🧩 Normalized chunks:', rows.length);
        log('[STEP RUNNER] 💾 Persisting chunks:', rows.length);
        const { error } = await supabase
          .from('knowledge_chunks')
          .insert(rows);
        if (error) {
          console.error('[STEP RUNNER] 🔴 Chunk insert error:', error);
          throw new Error(`Chunk persistence failed: ${error.message}`);
        }
        log('[STEP RUNNER] ✅ Chunks persisted successfully');
      }

      // PATCH 3: HARD STOP if chunking returns empty
      if (!chunks || chunks.length === 0) {
        console.error(`[STEP RUNNER] 🚫 CHUNKING FAILED: No chunks created - marking FAILED and STOPPING`);
        await ingestionStateMachineService.markFailed(
          documentId,
          IngestionFailureReason.CHUNKING_ERROR,
          'No chunks created from content',
          undefined
        );
        return {
          success: false,
          nextState: DocumentIngestionState.FAILED,
          error: 'No chunks created from content',
          duration: Date.now() - startTime,
        };
      }

      // PHASE STABILIZATION: Chunk limit check moved BEFORE persistence (line 605-632)
      // This line is no longer needed - limit is enforced pre-emptively
      log(`[STEP RUNNER] ✅ Created ${chunks.length} chunks`);

      // PHASE STABILIZATION: Store chunks count comment (removed unsafe DB update)
      log(`[STEP RUNNER] 💾 Chunk count metadata: ${chunks.length} chunks created`);

      // Transition to EMBEDDING
      const transitioned = await ingestionStateMachineService.transitionTo(
        documentId,
        DocumentIngestionState.EMBEDDING,
        'chunking_complete'
      );

      if (!transitioned) {
        throw new Error('Failed to transition to EMBEDDING state');
      }

      log(`[STEP RUNNER] 🎉 CHUNKING complete → EMBEDDING`);
      return {
        success: true,
        nextState: DocumentIngestionState.EMBEDDING,
        duration: Date.now() - startTime,
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown chunking error';
      console.error(`[STEP RUNNER] ❌ Chunking failed:`, errorMsg);

      await ingestionStateMachineService.markFailed(
        documentId,
        IngestionFailureReason.CHUNKING_ERROR,
        errorMsg,
        error instanceof Error ? error.stack : undefined
      );

      return {
        success: false,
        nextState: DocumentIngestionState.FAILED,
        error: errorMsg,
        duration: Date.now() - startTime,
      };
    }
  }

  /**
   * STEP 3: Embedding (EMBEDDING state)
   * Generates embeddings for each chunk
   *
   * PHASE 8: GLOBAL PAUSE CHECK - if embedding paused, stop immediately
   *
   * Calls knowledge-brain.service embedding function
   * On success: transitions to FINALIZING
   * On failure: marks FAILED with EMBEDDING error
   */
  private static async runEmbeddingStep(documentId: string): Promise<StepResult> {
    const startTime = Date.now();

    try {
      // PHASE 8: EMBEDDING PAUSE GUARD - stop if global pause active
      if ((window as any).__RAG_EMBEDDING_PAUSED__) {
        warn(`[STEP RUNNER] 🔴 EMBEDDING PAUSED: Stopping embedding for document ${documentId}`);
        return {
          success: false,
          error: 'Embedding pipeline paused globally',
          duration: Date.now() - startTime,
        };
      }

      // PHASE 17: Check document-level lock before embedding
      // PHASE 19.10: Verify lock ownership (allow self-owned locks)
      const lockInfo = (window as any).__RAG_DOC_LOCKS__?.[documentId];
      const currentInstanceId = (window as any).__RAG_RUNNER_INSTANCE_ID__;

      if (lockInfo && lockInfo.owner && lockInfo.owner !== currentInstanceId) {
        warn(`[STEP RUNNER] 🔒 Document locked by another runner - abort embedding`);
        return {
          success: false,
          error: 'Document is locked by another runner',
          duration: Date.now() - startTime,
        };
      }

      if (lockInfo && lockInfo.owner === currentInstanceId) {
        log(`[STEP RUNNER] 🔓 Lock owned by this runner — continuing`);
      }

      log(`[STEP RUNNER] 🔢 EMBEDDING STEP: Generating embeddings for chunks...`);

      // PHASE 9: Check if document is in FAILED state before embedding
      const context = await ingestionStateMachineService.getStateContext(documentId);
      if (context && context.current_state === DocumentIngestionState.FAILED) {
        console.error(`[STEP RUNNER] 🔴 HARD LOCK: Document is FAILED - stopping embedding immediately`);
        return {
          success: false,
          error: 'Document is in FAILED state',
          duration: Date.now() - startTime,
        };
      }

      // PHASE 9: Check if big doc mode is active
      const isBigDocMode = Boolean((window as any).__RAG_BIG_DOC_MODE__);
      const isStreamMode = Boolean((window as any).__RAG_STREAM_MODE__);
      const throttleDelay = isBigDocMode ? 80 : 0; // 80ms throttle for big docs

      if (isBigDocMode) {
        warn(`[STEP RUNNER] ⚡ BIG DOC MODE: Throttling embeddings (${throttleDelay}ms between chunks)`);
      }

      let successCount = 0;
      let failureCount = 0;
      let chunks: any[] = []; // PHASE 19.14: Declare at higher scope for both stream/non-stream paths
      let totalChunksForLogging = 0; // PHASE 19.14: Track total chunks for final logging

      // PHASE 11: STREAMING EMBEDDING ENGINE with PHASE 12 adaptive control
      if (isStreamMode) {
        log(`[STEP RUNNER] 🌊 STREAM MODE: Embedding chunks with adaptive batching...`);
        let cursor = 0;
        let preloadBuffer: any[] = []; // PHASE 13: Smart queue preload buffer
        let preloadPromise: Promise<any> | null = null; // PHASE 13: Preload promise

        // PHASE 19.14: Fetch total chunk count for logging
        const { count: totalChunkCount } = await supabase
          .from('knowledge_chunks')
          .select('id', { count: 'exact', head: true })
          .eq('document_id', documentId);

        if (!totalChunkCount || totalChunkCount === 0) {
          warn('[STEP RUNNER] ⚠️ No chunks to embed');
          return { success: false };
        }

        totalChunksForLogging = totalChunkCount;

        // PHASE 12: Initialize stream controller if needed
        if (!(window as any).__RAG_STREAM_CONTROLLER__) {
          (window as any).__RAG_STREAM_CONTROLLER__ = {
            batchSize: 50,
            throttleMs: 80,
            latencySum: 0,
            latencyCount: 0,
            errorCount: 0,
            consecutiveErrors: 0,
            errorRate: 0,
            adaptiveLevel: 'NORMAL',
          };
        }

        while (true) {
          // PHASE 17: Check document-level lock during streaming embedding
          if ((window as any).__RAG_DOC_LOCKS__?.[documentId]) {
            warn('[STREAM CTRL] 🔒 Document locked mid-stream');
            break;
          }

          // PHASE 12: Get adaptive configuration
          const config = this.getAdaptiveStreamConfig();
          let batchSize = config.batchSize;
          let batchThrottleMs = config.throttleMs;

          // PHASE 19: Embedding burst protection - reduce batch size under high load
          const activeCount = (window as any).__RAG_ACTIVE_PIPELINES__ || 0;
          if (activeCount >= 2) {
            const originalBatchSize = batchSize;
            batchSize = Math.max(Math.floor(batchSize * 0.75), 20);
            if (batchSize < originalBatchSize) {
              log(`[LOAD SAFETY] 📉 Embedding batch reduced: ${originalBatchSize} → ${batchSize} (${activeCount} active pipelines)`);
            }
          }

          // PHASE 13: Use preloaded buffer if available, else fetch from DB
          let batch: any[] | null = null;
          let fetchError = null;

          if (preloadBuffer.length > 0) {
            batch = preloadBuffer;
            preloadBuffer = [];
          } else {
            // Fetch batch of chunks from DB using adaptive batch size
            const response = await supabase
              .from('knowledge_chunks')
              .select('id, content, chunk_index')
              .eq('document_id', documentId)
              .order('chunk_index', { ascending: true })
              .range(cursor, cursor + batchSize - 1);
            batch = response.data;
            fetchError = response.error;
          }

          if (fetchError) {
            console.error(`[STEP RUNNER] Batch fetch error at offset ${cursor}:`, fetchError);
            throw fetchError;
          }

          if (!batch || batch.length === 0) {
            log(`[STEP RUNNER] 🌊 Stream embedding complete (${cursor} chunks processed) - Adaptive Level: ${config.adaptiveLevel}`);
            break;
          }

          // PHASE 13: Smart queue preload - start fetching next batch while processing current
          if (batchSize > 40 && !preloadPromise) {
            preloadPromise = supabase
              .from('knowledge_chunks')
              .select('id, content, chunk_index')
              .eq('document_id', documentId)
              .order('chunk_index', { ascending: true })
              .range(cursor + batchSize, cursor + batchSize * 2 - 1)
              .then(response => response.data || [])
              .catch(err => {
                warn('[STREAM PRELOAD] Preload error:', err);
                return [];
              });
          }

          // Embed batch sequentially
          for (let i = 0; i < batch.length; i++) {
            try {
              const chunk = batch[i];
              const chunkNum = cursor + i + 1;

              // PHASE 12: Measure embedding latency
              const latencyStart = performance.now();
              const embedding = await knowledgeBrainService.generateEmbedding(chunk.content);
              const latency = performance.now() - latencyStart;

              if (!embedding) {
                warn(`[STEP RUNNER] ⚠️ Chunk ${chunkNum} embedding returned null`);
                failureCount++;
                KnowledgeStepRunnerService.updateAdaptiveMetrics(latency, true);
              } else {
                // Store embedding
                const { error: updateError } = await supabase
                  .from('knowledge_chunks')
                  .update({
                    embedding,
                    embedding_generated_at: new Date().toISOString(),
                  })
                  .eq('id', chunk.id);

                if (updateError) {
                  console.error(`[STEP RUNNER] Failed to store embedding for chunk ${chunkNum}:`, updateError);
                  failureCount++;
                  KnowledgeStepRunnerService.updateAdaptiveMetrics(latency, true);
                } else {
                  successCount++;
                  KnowledgeStepRunnerService.updateAdaptiveMetrics(latency, false);
                }
              }

              // Use adaptive or big doc throttle
              const finalThrottleMs = isBigDocMode ? Math.max(throttleDelay, batchThrottleMs) : batchThrottleMs;
              if (finalThrottleMs > 0) {
                await new Promise(resolve => setTimeout(resolve, finalThrottleMs));
              }
            } catch (chunkError) {
              console.error(`[STEP RUNNER] Error embedding chunk ${cursor + i}:`, chunkError);
              failureCount++;
              KnowledgeStepRunnerService.updateAdaptiveMetrics(0, true);
            }
          }

          cursor += batchSize;

          // PHASE 13: Resolve preload promise if available
          if (preloadPromise) {
            preloadBuffer = await preloadPromise;
            preloadPromise = null;
          }

          // Micro-throttle between batches
          await new Promise(resolve => setTimeout(resolve, 30));
        }
      } else {
        // Standard embedding for normal documents
        // PHASE 19.12: Simplified query to fetch ALL chunks (no additional filters)
        const { data: fetchedChunks, error: fetchError } = await supabase
          .from('knowledge_chunks')
          .select('*')
          .eq('document_id', documentId)
          .order('chunk_index', { ascending: true });

        // PHASE 19.14: Normalize chunk structure and add safety guard
        chunks = fetchedChunks ?? [];
        totalChunksForLogging = chunks.length;

        log('[STEP RUNNER] 📦 EMBEDDING fetched chunks:', chunks.length);

        if (!chunks.length) {
          warn('[STEP RUNNER] ⚠️ No chunks to embed');
          return { success: false };
        }

        if (fetchError) {
          throw new Error('Chunk fetch error: ' + fetchError.message);
        }

        log(`[STEP RUNNER] Processing ${chunks.length} chunks...`);

        // Generate embeddings for each chunk sequentially
        for (let i = 0; i < chunks.length; i++) {
          try {
            const chunk = chunks[i];
            log(`[STEP RUNNER] Embedding chunk ${i + 1}/${chunks.length}...`);

            // Call knowledge-brain service embedding function
            const embedding = await knowledgeBrainService.generateEmbedding(chunk.content);

            if (!embedding) {
              warn(`[STEP RUNNER] ⚠️ Chunk ${i} embedding returned null`);
              failureCount++;
              // PHASE 9: Still throttle even on failure
              if (throttleDelay > 0) {
                await new Promise(resolve => setTimeout(resolve, throttleDelay));
              }
              continue;
            }

            // Store embedding
            const { error: updateError } = await supabase
              .from('knowledge_chunks')
              .update({
                embedding,
                embedding_generated_at: new Date().toISOString(),
              })
              .eq('id', chunk.id);

            if (updateError) {
              console.error(`[STEP RUNNER] Failed to store embedding for chunk ${i}:`, updateError);
              failureCount++;
            } else {
              successCount++;
            }

            // PHASE 9: Throttle between chunks if big document
            if (throttleDelay > 0 && i < chunks.length - 1) {
              await new Promise(resolve => setTimeout(resolve, throttleDelay));
            }
          } catch (chunkError) {
            console.error(`[STEP RUNNER] Error embedding chunk ${i}:`, chunkError);
            failureCount++;
          }
        }
      }

      log(
        `[STEP RUNNER] ✅ Embedding complete: ${successCount}/${totalChunksForLogging} successful`
      );

      // Check if all chunks were embedded
      if (failureCount > 0 && successCount === 0) {
        throw new Error(`All ${failureCount} chunks failed to embed`);
      }

      // Transition to FINALIZING
      const transitioned = await ingestionStateMachineService.transitionTo(
        documentId,
        DocumentIngestionState.FINALIZING,
        'embedding_complete'
      );

      if (!transitioned) {
        throw new Error('Failed to transition to FINALIZING state');
      }

      log(`[STEP RUNNER] 🎉 EMBEDDING complete → FINALIZING`);
      return {
        success: true,
        nextState: DocumentIngestionState.FINALIZING,
        duration: Date.now() - startTime,
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown embedding error';
      console.error(`[STEP RUNNER] ❌ Embedding failed:`, errorMsg);

      await ingestionStateMachineService.markFailed(
        documentId,
        IngestionFailureReason.EMBEDDING_API_ERROR,
        errorMsg,
        error instanceof Error ? error.stack : undefined
      );

      return {
        success: false,
        nextState: DocumentIngestionState.FAILED,
        error: errorMsg,
        duration: Date.now() - startTime,
      };
    }
  }

  /**
   * STEP 4: Finalizing (FINALIZING state)
   * Performs integrity checks and cleanup
   *
   * Verifies all embeddings present and correct
   * On success: transitions to COMPLETED
   * On failure: marks FAILED with INTEGRITY error
   */
  private static async runFinalizingStep(documentId: string): Promise<StepResult> {
    const startTime = Date.now();

    try {
      log(`[STEP RUNNER] 🔍 FINALIZING STEP: Verifying integrity...`);

      // Check chunk count
      const { data: chunks, error: fetchError } = await supabase
        .from('knowledge_chunks')
        .select('id, embedding')
        .eq('document_id', documentId);

      if (fetchError || !chunks) {
        throw new Error('Failed to fetch chunks for verification');
      }

      const totalChunks = chunks.length;
      const embeddedChunks = chunks.filter((c) => c.embedding).length;
      const missingEmbeddings = totalChunks - embeddedChunks;

      log(
        `[STEP RUNNER] 📊 Integrity check: ${embeddedChunks}/${totalChunks} chunks have embeddings`
      );

      if (missingEmbeddings > 0) {
        throw new Error(
          `Integrity check failed: ${missingEmbeddings} chunks missing embeddings`
        );
      }

      // PHASE STABILIZATION: Document metadata comment (removed unsafe DB update)
      log(`[STEP RUNNER] 📊 Embedding integrity check: ${embeddedChunks} chunks embedded successfully`);

      // Transition to COMPLETED
      const transitioned = await ingestionStateMachineService.transitionTo(
        documentId,
        DocumentIngestionState.COMPLETED,
        'finalization_complete'
      );

      if (!transitioned) {
        throw new Error('Failed to transition to COMPLETED state');
      }

      // PHASE 40: Clean up state for successful completion
      delete (window as any).__RAG_RETRY_COUNTS__[documentId];
      delete (window as any).__RAG_DOC_LOCKS__[documentId];

      log(`[STEP RUNNER] 🎉 FINALIZING complete → COMPLETED ✅`);
      return {
        success: true,
        nextState: DocumentIngestionState.COMPLETED,
        duration: Date.now() - startTime,
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown finalization error';
      console.error(`[STEP RUNNER] ❌ Finalization failed:`, errorMsg);

      await ingestionStateMachineService.markFailed(
        documentId,
        IngestionFailureReason.INTEGRITY_CHECK_FAILED,
        errorMsg,
        error instanceof Error ? error.stack : undefined
      );

      return {
        success: false,
        nextState: DocumentIngestionState.FAILED,
        error: errorMsg,
        duration: Date.now() - startTime,
      };
    }
  }

  /**
   * Get the next state for a document
   * Useful for UI to show what happens next
   */
  static async getNextState(documentId: string): Promise<DocumentIngestionState | null> {
    const context = await ingestionStateMachineService.getStateContext(documentId);
    if (!context) return null;

    return ingestionStateMachineService.getNextStep(context.current_state);
  }

  /**
   * Check if document can proceed to next step
   */
  static async canProceed(documentId: string): Promise<boolean> {
    const context = await ingestionStateMachineService.getStateContext(documentId);
    if (!context) return false;

    // Terminal states cannot proceed
    if (ingestionStateMachineService.isTerminalState(context.current_state)) {
      return false;
    }

    // Non-terminal states can proceed
    return true;
  }
}

export const knowledgeStepRunnerService = new KnowledgeStepRunnerService();
