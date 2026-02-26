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
  }

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

    console.log(`[LATENCY PREDICTOR] trend: ${predictor.trend} → risk: ${predictor.predictedRisk}`);
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
      console.log(`[LATENCY PREDICTOR] 🔮 High risk detected → pre-slowdown (${predictor.trend})`);
    }
    // CRITICAL: 3 consecutive errors
    else if (controller.consecutiveErrors >= 3) {
      newLevel = 'CRITICAL';
      if (!(window as any).__RAG_EMBEDDING_PAUSED__) {
        console.warn('[STREAM CTRL] 🔴 CRITICAL: 3 consecutive errors → pausing embedding');
        (window as any).__RAG_EMBEDDING_PAUSED__ = true;
        window.dispatchEvent(new Event('RAG_EMBEDDING_PAUSED'));
      }
    }
    // SAFE: latency > 2500ms OR errorRate > 20%
    else if (controller.latencyAvg > 2500 || controller.errorRate > 20) {
      newLevel = 'SAFE';
      newBatchSize = Math.max((controller.batchSize || 50) - 10, 20);
      newThrottleMs = Math.min((controller.throttleMs || 80) + 30, 200);
      console.log(`[STREAM CTRL] 🟠 SAFE: latencyAvg ${controller.latencyAvg.toFixed(0)}ms (${controller.errorRate.toFixed(1)}% errors) → batch ${newBatchSize}, throttle ${newThrottleMs}ms`);
    }
    // FAST: latency < 900ms AND errorRate < 5%
    else if (controller.latencyAvg < 900 && controller.errorRate < 5) {
      newLevel = 'FAST';
      newBatchSize = Math.min((controller.batchSize || 50) + 10, 80);
      newThrottleMs = Math.max((controller.throttleMs || 80) - 10, 20);
      console.log(`[STREAM CTRL] 🟢 FAST: latencyAvg ${controller.latencyAvg.toFixed(0)}ms (${controller.errorRate.toFixed(1)}% errors) → batch ${newBatchSize}, throttle ${newThrottleMs}ms`);
    }
    // NORMAL: default
    else {
      newLevel = 'NORMAL';
      newBatchSize = 50;
      newThrottleMs = 80;
      console.log(`[STREAM CTRL] 🟡 NORMAL: latencyAvg ${controller.latencyAvg.toFixed(0)}ms (${controller.errorRate.toFixed(1)}% errors)`);
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
      console.log('[LOAD SAFETY] 📊 Active pipeline counter initialized');
    }

    // PHASE 18.1: Generate unique runtime instance ID (once per browser tab/window)
    if (!(window as any).__RAG_RUNNER_INSTANCE_ID__) {
      const timestamp = Date.now().toString(36);
      const randomPart = Math.random().toString(36).substring(2, 9);
      (window as any).__RAG_RUNNER_INSTANCE_ID__ = `steprunner_${timestamp}_${randomPart}`;
      console.log(`[STEP RUNNER] 🆔 Phase 18.1 - Instance ID assigned: ${(window as any).__RAG_RUNNER_INSTANCE_ID__}`);
    }

    const currentInstanceId = (window as any).__RAG_RUNNER_INSTANCE_ID__;

    // PHASE 18: Ownership guard - prevent concurrent runner instances from different tabs/contexts
    const ownerInstanceId = (window as any).__RAG_RUNNER_OWNER_ID__;

    if (ownerInstanceId && ownerInstanceId !== currentInstanceId) {
      console.warn(`[STEP RUNNER] 🚫 Ownership conflict: pipeline owned by different instance (${ownerInstanceId})`);
      return {
        success: false,
        error: `Pipeline already owned by different instance: ${ownerInstanceId}`,
        duration: Date.now() - startTime,
      };
    }

    try {
      // PHASE 15 FIX: Set ownership flag (lazy initialization)
      if (!(window as any).__RAG_RUNNER_OWNER__) {
        (window as any).__RAG_RUNNER_OWNER__ = true;
        (window as any).__RAG_RUNNER_OWNER_ID__ = currentInstanceId;
        console.log('[STEP RUNNER] 🏆 Ownership claimed - runner is authoritative ingestion engine');
        console.log(`[STEP RUNNER] 📋 Instance: ${currentInstanceId}`);
        console.log('[STEP RUNNER] 📋 All ingestion pipelines now delegated to StepRunner');
      }

      // PHASE 17: Check for document-level lock
      if ((window as any).__RAG_DOC_LOCKS__?.[documentId]) {
        console.warn(`[UNIFIED KERNEL] 🔒 Document locked — skipping ${documentId}`);
        return {
          success: false,
          error: 'Document is locked - worker skipping this doc',
          duration: Date.now() - startTime,
        };
      }

      // PHASE 18.2: REMOVED __RAG_PIPELINE_RUNNING__ global lock
      // Keep ONLY document-level locking (PHASE 17)
      // Allows multiple documents to be processed in parallel

      // Set flag to prevent concurrent pipelines ON THIS DOCUMENT
      (window as any).__RAG_DOC_LOCKS__ = (window as any).__RAG_DOC_LOCKS__ || {};
      (window as any).__RAG_DOC_LOCKS__[documentId] = true;
      console.log(`[STEP RUNNER] 🚀 Running next step for document ${documentId}`);

      // Get current state
      const context = await ingestionStateMachineService.getStateContext(documentId);
      if (!context) {
        delete (window as any).__RAG_DOC_LOCKS__[documentId];
        return {
          success: false,
          error: 'Failed to fetch document state',
          duration: Date.now() - startTime,
        };
      }

      // PHASE 19.1: MOVED INCREMENT HERE - only after all guards pass
      // Prevents counter drift from failed validation attempts
      (window as any).__RAG_ACTIVE_PIPELINES__++;
      const activeCount = (window as any).__RAG_ACTIVE_PIPELINES__;
      console.log(`[LOAD SAFETY] 📈 Pipeline active: ${activeCount} total (document: ${documentId})`);

      const currentState = context.current_state;
      console.log(`[STEP RUNNER] Current state: ${currentState}`);

      // PHASE 19: Adaptive concurrency limit (load safety)
      const isBigDocMode = Boolean((window as any).__RAG_BIG_DOC_MODE__);
      const CONCURRENCY_LIMIT = 3;

      if (activeCount > CONCURRENCY_LIMIT && !isBigDocMode) {
        console.warn(`[LOAD SAFETY] 🛑 Throttling: ${activeCount} active pipelines (limit: ${CONCURRENCY_LIMIT})`);
        return {
          success: false,
          error: 'Load safety throttle: concurrency limit exceeded',
          throttled: true,
          duration: Date.now() - startTime,
        };
      }

      // PHASE 19: Latency-aware backoff
      const predictor = (window as any).__RAG_LATENCY_PREDICTOR__;
      if (predictor && predictor.predictedRisk === 'HIGH') {
        const backoffDelay = 500 + Math.random() * 500;
        console.warn(`[LOAD SAFETY] ⏳ Latency backoff applied: ${backoffDelay.toFixed(0)}ms (predicted risk: ${predictor.predictedRisk})`);
        await new Promise(resolve => setTimeout(resolve, backoffDelay));
      }

      // Determine next step and run it
      let result: StepResult;

      switch (currentState) {
        case DocumentIngestionState.UPLOADED:
          console.log(`[STEP RUNNER] ℹ️ Document UPLOADED - waiting for extraction trigger`);
          return {
            success: true,
            nextState: DocumentIngestionState.UPLOADED,
            duration: Date.now() - startTime,
          };

        case DocumentIngestionState.EXTRACTING:
          result = await this.runExtractionStep(documentId);
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
          console.log(`[STEP RUNNER] ✅ Document already COMPLETED`);
          return {
            success: true,
            nextState: DocumentIngestionState.COMPLETED,
            duration: Date.now() - startTime,
          };

        case DocumentIngestionState.FAILED:
          console.log(`[STEP RUNNER] ❌ Document in FAILED state`);
          return {
            success: false,
            error: context.error_message || 'Document processing failed',
            duration: Date.now() - startTime,
          };

        default:
          return {
            success: false,
            error: `Unknown state: ${currentState}`,
            duration: Date.now() - startTime,
          };
      }

      return result;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      console.error(`[STEP RUNNER] 💥 Step runner error:`, errorMsg);
      return {
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
      console.log(`[LOAD SAFETY] 📉 Pipeline inactive: ${(window as any).__RAG_ACTIVE_PIPELINES__} remaining`);
    }
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
      console.log(`[STEP RUNNER] 📄 EXTRACTION STEP: Extracting text from PDF...`);

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
      console.log(`[STEP RUNNER] ✅ Text extracted (${content.length} chars)`);

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

      console.log(`[STEP RUNNER] 🎉 EXTRACTION complete → CHUNKING`);
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
      console.log(`[STEP RUNNER] ✂️ CHUNKING STEP: Splitting text into chunks...`);

      // PHASE 9: Check if chunks already exist (prevent double-chunking)
      const { data: existingChunks } = await supabase
        .from('knowledge_chunks')
        .select('id', { count: 'exact', head: true })
        .eq('document_id', documentId);

      if (existingChunks && existingChunks.length > 0) {
        console.log(`[STEP RUNNER] ℹ️ Chunks already exist (${existingChunks.length}) - skipping rechunking`);
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

      // PHASE 15 FIX: Fetch content with fallback to preview_content
      const { data: doc, error: fetchError } = await supabase
        .from('knowledge_documents')
        .select('id, original_content, preview_content')
        .eq('id', documentId)
        .single();

      if (fetchError || !doc) {
        throw new Error('Failed to fetch document');
      }

      const sourceContent =
        doc?.original_content ??
        doc?.preview_content ??
        '';

      if (!sourceContent) {
        throw new Error('No content available for chunking');
      }

      const contentLength = sourceContent.length;
      const isBigDoc = contentLength > 1_000_000; // 1MB threshold
      const isStreamMode = Boolean((window as any).__RAG_STREAM_MODE__);

      // PHASE 9: Detect big document mode
      if (isBigDoc) {
        console.warn(`[STEP RUNNER] 📚 BIG DOCUMENT DETECTED: ${contentLength} chars - activating throttled mode`);
        (window as any).__RAG_BIG_DOC_MODE__ = true;
        window.dispatchEvent(new Event('RAG_BIG_DOC_MODE_ACTIVATED'));
      }

      // Use knowledge-brain service chunking function
      const { chunkText } = await import('@/utils/chunking');

      // PHASE 11: STREAMING CHUNKING ENGINE
      let chunks: any[] = [];
      let globalChunkIndex = 0; // PHASE 12: Global chunk index for entire document
      if (isStreamMode) {
        console.log(`[STEP RUNNER] 🌊 STREAM MODE: Chunking ${(contentLength / 1024 / 1024).toFixed(2)}MB with micro-batching`);
        const STREAM_SLICE_SIZE = 60000; // 60KB slices
        const STREAM_BATCH_SIZE = 40;

        for (let offset = 0; offset < sourceContent.length; offset += STREAM_SLICE_SIZE) {
          // PHASE 17: Check document-level lock during streaming
          if ((window as any).__RAG_DOC_LOCKS__?.[documentId]) {
            console.warn(`[STREAM CHUNKING] 🔒 Document locked mid-stream`);
            throw new Error('Document locked during streaming ingestion');
          }

          const slice = sourceContent.slice(offset, offset + STREAM_SLICE_SIZE);
          const partialChunks = chunkText(slice, 1000);

          if (partialChunks && partialChunks.length > 0) {
            chunks.push(...partialChunks);

            // Insert batch every STREAM_BATCH_SIZE chunks
            if (chunks.length >= STREAM_BATCH_SIZE) {
              console.log(`[STEP RUNNER] 💾 Stream batch: inserting ${chunks.length} chunks...`);
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
                console.warn(`[STEP RUNNER] ⚠️ Batch insert warning:`, insertError.message);
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
        console.log(`[STEP RUNNER] 💾 Stream final batch: inserting ${chunks.length} chunks...`);
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
          console.warn(`[STEP RUNNER] ⚠️ Final batch insert warning:`, insertError.message);
        }
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

      // PHASE 9: Chunk limit safety - max 600 chunks
      const MAX_CHUNKS_PER_DOC = 600;
      if (chunks.length > MAX_CHUNKS_PER_DOC) {
        console.error(`[STEP RUNNER] 🚫 CHUNK LIMIT EXCEEDED: ${chunks.length} chunks > ${MAX_CHUNKS_PER_DOC} max`);
        await ingestionStateMachineService.markFailed(
          documentId,
          IngestionFailureReason.CHUNKING_ERROR,
          `Document too large: ${chunks.length} chunks exceeds limit of ${MAX_CHUNKS_PER_DOC}`,
          undefined
        );
        return {
          success: false,
          nextState: DocumentIngestionState.FAILED,
          error: `Document too large (${chunks.length} chunks)`,
          duration: Date.now() - startTime,
        };
      }

      console.log(`[STEP RUNNER] ✅ Created ${chunks.length} chunks`);

      // Store chunks count metadata (for later reference)
      await supabase
        .from('knowledge_documents')
        .update({
          chunks_created: chunks.length,
        })
        .eq('id', documentId);

      // Transition to EMBEDDING
      const transitioned = await ingestionStateMachineService.transitionTo(
        documentId,
        DocumentIngestionState.EMBEDDING,
        'chunking_complete'
      );

      if (!transitioned) {
        throw new Error('Failed to transition to EMBEDDING state');
      }

      console.log(`[STEP RUNNER] 🎉 CHUNKING complete → EMBEDDING`);
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
        console.warn(`[STEP RUNNER] 🔴 EMBEDDING PAUSED: Stopping embedding for document ${documentId}`);
        return {
          success: false,
          error: 'Embedding pipeline paused globally',
          duration: Date.now() - startTime,
        };
      }

      // PHASE 17: Check document-level lock before embedding
      if ((window as any).__RAG_DOC_LOCKS__?.[documentId]) {
        console.warn(`[STEP RUNNER] 🔒 Document locked - abort embedding`);
        return {
          success: false,
          error: 'Document is locked',
          duration: Date.now() - startTime,
        };
      }

      console.log(`[STEP RUNNER] 🔢 EMBEDDING STEP: Generating embeddings for chunks...`);

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
        console.warn(`[STEP RUNNER] ⚡ BIG DOC MODE: Throttling embeddings (${throttleDelay}ms between chunks)`);
      }

      let successCount = 0;
      let failureCount = 0;

      // PHASE 11: STREAMING EMBEDDING ENGINE with PHASE 12 adaptive control
      if (isStreamMode) {
        console.log(`[STEP RUNNER] 🌊 STREAM MODE: Embedding chunks with adaptive batching...`);
        let cursor = 0;
        let preloadBuffer: any[] = []; // PHASE 13: Smart queue preload buffer
        let preloadPromise: Promise<any> | null = null; // PHASE 13: Preload promise

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
            console.warn('[STREAM CTRL] 🔒 Document locked mid-stream');
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
              console.log(`[LOAD SAFETY] 📉 Embedding batch reduced: ${originalBatchSize} → ${batchSize} (${activeCount} active pipelines)`);
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
            console.log(`[STEP RUNNER] 🌊 Stream embedding complete (${cursor} chunks processed) - Adaptive Level: ${config.adaptiveLevel}`);
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
                console.warn('[STREAM PRELOAD] Preload error:', err);
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
                console.warn(`[STEP RUNNER] ⚠️ Chunk ${chunkNum} embedding returned null`);
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
        const { data: chunks, error: fetchError } = await supabase
          .from('knowledge_chunks')
          .select('id, content')
          .eq('document_id', documentId)
          .order('chunk_index', { ascending: true });

        if (fetchError || !chunks || chunks.length === 0) {
          throw new Error('No chunks found to embed');
        }

        console.log(`[STEP RUNNER] Processing ${chunks.length} chunks...`);

        // Generate embeddings for each chunk sequentially
        for (let i = 0; i < chunks.length; i++) {
          try {
            const chunk = chunks[i];
            console.log(`[STEP RUNNER] Embedding chunk ${i + 1}/${chunks.length}...`);

            // Call knowledge-brain service embedding function
            const embedding = await knowledgeBrainService.generateEmbedding(chunk.content);

            if (!embedding) {
              console.warn(`[STEP RUNNER] ⚠️ Chunk ${i} embedding returned null`);
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

      console.log(
        `[STEP RUNNER] ✅ Embedding complete: ${successCount}/${chunks.length} successful`
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

      console.log(`[STEP RUNNER] 🎉 EMBEDDING complete → FINALIZING`);
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
      console.log(`[STEP RUNNER] 🔍 FINALIZING STEP: Verifying integrity...`);

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

      console.log(
        `[STEP RUNNER] 📊 Integrity check: ${embeddedChunks}/${totalChunks} chunks have embeddings`
      );

      if (missingEmbeddings > 0) {
        throw new Error(
          `Integrity check failed: ${missingEmbeddings} chunks missing embeddings`
        );
      }

      // Update document metadata
      await supabase
        .from('knowledge_documents')
        .update({
          chunks_embedded: embeddedChunks,
          embedding_integrity_checked: true,
        })
        .eq('id', documentId);

      // Transition to COMPLETED
      const transitioned = await ingestionStateMachineService.transitionTo(
        documentId,
        DocumentIngestionState.COMPLETED,
        'finalization_complete'
      );

      if (!transitioned) {
        throw new Error('Failed to transition to COMPLETED state');
      }

      console.log(`[STEP RUNNER] 🎉 FINALIZING complete → COMPLETED ✅`);
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
