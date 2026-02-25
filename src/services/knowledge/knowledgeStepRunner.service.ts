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

    try {
      // PATCH 7: PREVENT DOUBLE PIPELINE - check if one is already running
      if ((window as any).__RAG_PIPELINE_RUNNING__) {
        console.warn(`[STEP RUNNER] ⚠️ PIPELINE ALREADY RUNNING - ignoring duplicate request for ${documentId}`);
        return {
          success: false,
          error: 'Pipeline already running for another document',
          duration: Date.now() - startTime,
        };
      }

      // Set flag to prevent concurrent pipelines
      (window as any).__RAG_PIPELINE_RUNNING__ = true;
      console.log(`[STEP RUNNER] 🚀 Running next step for document ${documentId}`);

      // Get current state
      const context = await ingestionStateMachineService.getStateContext(documentId);
      if (!context) {
        (window as any).__RAG_PIPELINE_RUNNING__ = false;
        return {
          success: false,
          error: 'Failed to fetch document state',
          duration: Date.now() - startTime,
        };
      }

      const currentState = context.current_state;
      console.log(`[STEP RUNNER] Current state: ${currentState}`);

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
      // PATCH 7: CLEANUP - release pipeline lock
      (window as any).__RAG_PIPELINE_RUNNING__ = false;
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

      // Fetch content to chunk
      const { data: doc, error: fetchError } = await supabase
        .from('knowledge_documents')
        .select('original_content')
        .eq('id', documentId)
        .single();

      if (fetchError || !doc || !doc.original_content) {
        throw new Error('No content available for chunking');
      }

      const contentLength = doc.original_content.length;
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
      if (isStreamMode) {
        console.log(`[STEP RUNNER] 🌊 STREAM MODE: Chunking ${(contentLength / 1024 / 1024).toFixed(2)}MB with micro-batching`);
        const STREAM_SLICE_SIZE = 60000; // 60KB slices
        const STREAM_BATCH_SIZE = 40;

        for (let offset = 0; offset < doc.original_content.length; offset += STREAM_SLICE_SIZE) {
          // Check pipeline lock
          if ((window as any).__RAG_PIPELINE_LOCKED__) {
            console.warn(`[STEP RUNNER] 🔒 Pipeline locked during streaming - aborting`);
            throw new Error('Pipeline locked during streaming ingestion');
          }

          const slice = doc.original_content.slice(offset, offset + STREAM_SLICE_SIZE);
          const partialChunks = chunkText(slice, 1000);

          if (partialChunks && partialChunks.length > 0) {
            chunks.push(...partialChunks);

            // Insert batch every STREAM_BATCH_SIZE chunks
            if (chunks.length >= STREAM_BATCH_SIZE) {
              console.log(`[STEP RUNNER] 💾 Stream batch: inserting ${chunks.length} chunks...`);
              const { error: insertError } = await supabase
                .from('knowledge_chunks')
                .insert(
                  chunks.map((chunk, idx) => ({
                    document_id: documentId,
                    content: chunk.content,
                    chunk_index: offset / STREAM_SLICE_SIZE * STREAM_BATCH_SIZE + idx,
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
        chunks = chunkText(doc.original_content, 1000);
      }

      // Insert remaining chunks from stream
      if (isStreamMode && chunks.length > 0) {
        console.log(`[STEP RUNNER] 💾 Stream final batch: inserting ${chunks.length} chunks...`);
        const { error: insertError } = await supabase
          .from('knowledge_chunks')
          .insert(
            chunks.map((chunk, idx) => ({
              document_id: documentId,
              content: chunk.content,
              chunk_index: idx,
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

      // PHASE 10: GLOBAL PIPELINE LOCK GUARD - stop if pipeline locked
      if ((window as any).__RAG_PIPELINE_LOCKED__) {
        console.warn(`[STEP RUNNER] 🔒 Global pipeline locked - abort embedding`);
        return {
          success: false,
          error: 'Pipeline locked globally',
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

      // PHASE 11: STREAMING EMBEDDING ENGINE
      if (isStreamMode) {
        console.log(`[STEP RUNNER] 🌊 STREAM MODE: Embedding chunks in micro-batches of 50...`);
        const STREAM_BATCH_SIZE = 50;
        let cursor = 0;

        while (true) {
          // Check pipeline lock
          if ((window as any).__RAG_PIPELINE_LOCKED__) {
            console.warn(`[STEP RUNNER] 🔒 Pipeline locked during streaming embedding - aborting`);
            throw new Error('Pipeline locked during streaming embedding');
          }

          // Fetch batch of chunks from DB
          const { data: batch, error: fetchError } = await supabase
            .from('knowledge_chunks')
            .select('id, content, chunk_index')
            .eq('document_id', documentId)
            .order('chunk_index', { ascending: true })
            .range(cursor, cursor + STREAM_BATCH_SIZE - 1);

          if (fetchError) {
            console.error(`[STEP RUNNER] Batch fetch error at offset ${cursor}:`, fetchError);
            throw fetchError;
          }

          if (!batch || batch.length === 0) {
            console.log(`[STEP RUNNER] 🌊 Stream embedding complete (${cursor} chunks processed)`);
            break;
          }

          // Embed batch sequentially
          for (let i = 0; i < batch.length; i++) {
            try {
              const chunk = batch[i];
              const chunkNum = cursor + i + 1;

              // Call knowledge-brain service embedding function
              const embedding = await knowledgeBrainService.generateEmbedding(chunk.content);

              if (!embedding) {
                console.warn(`[STEP RUNNER] ⚠️ Chunk ${chunkNum} embedding returned null`);
                failureCount++;
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
                } else {
                  successCount++;
                }
              }

              // Throttle if needed
              if (throttleDelay > 0) {
                await new Promise(resolve => setTimeout(resolve, throttleDelay));
              }
            } catch (chunkError) {
              console.error(`[STEP RUNNER] Error embedding chunk ${cursor + i}:`, chunkError);
              failureCount++;
            }
          }

          cursor += STREAM_BATCH_SIZE;
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
