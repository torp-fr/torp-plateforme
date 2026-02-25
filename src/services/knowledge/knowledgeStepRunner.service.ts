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
import { DocumentIngestionState, IngestionFailureReason } from './ingestionStates';
import { supabase } from '@/lib/supabase';

export interface StepResult {
  success: boolean;
  nextState?: DocumentIngestionState;
  error?: string;
  duration: number;
}

/**
 * PHASE 38C: Lazy load ingestionStateMachineService to break circular dependency
 * Static imports create hidden circular references during module evaluation.
 * Lazy import defers resolution until runtime, after all modules are loaded.
 */
async function getStateMachine() {
  const mod = await import('./ingestionStateMachine.service');
  return mod.ingestionStateMachineService;
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
      console.log(`[STEP RUNNER] 🚀 Running next step for document ${documentId}`);

      // Lazy load state machine (breaks circular dependency)
      const sm = await getStateMachine();

      // Get current state
      const context = await sm.getStateContext(documentId);
      if (!context) {
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
          result = await this.runExtractionStep(documentId, sm);
          break;

        case DocumentIngestionState.CHUNKING:
          result = await this.runChunkingStep(documentId, sm);
          break;

        case DocumentIngestionState.EMBEDDING:
          result = await this.runEmbeddingStep(documentId, sm);
          break;

        case DocumentIngestionState.FINALIZING:
          result = await this.runFinalizingStep(documentId, sm);
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
  private static async runExtractionStep(documentId: string, sm: any): Promise<StepResult> {
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
        await sm.markFailed(
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
      const transitioned = await sm.transitionTo(
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

      await sm.markFailed(
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
   * STEP 2: Chunking (CHUNKING state)
   * Splits extracted text into semantic chunks
   *
   * Calls knowledge-brain.service internal function
   * On success: transitions to EMBEDDING
   * On failure: marks FAILED with CHUNKING error
   */
  private static async runChunkingStep(documentId: string, sm: any): Promise<StepResult> {
    const startTime = Date.now();

    try {
      console.log(`[STEP RUNNER] ✂️ CHUNKING STEP: Splitting text into chunks...`);

      // Fetch content to chunk
      const { data: doc, error: fetchError } = await supabase
        .from('knowledge_documents')
        .select('original_content')
        .eq('id', documentId)
        .single();

      if (fetchError || !doc || !doc.original_content) {
        throw new Error('No content available for chunking');
      }

      // Use knowledge-brain service chunking function
      // (In PHASE 39, this would delegate to knowledge-brain.service.chunkAndStore())
      const { chunkText } = await import('@/utils/chunking');
      const chunks = chunkText(doc.original_content, 1000);

      if (!chunks || chunks.length === 0) {
        throw new Error('No chunks created from content');
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
      const transitioned = await sm.transitionTo(
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

      await sm.markFailed(
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
   * Calls knowledge-brain.service embedding function
   * On success: transitions to FINALIZING
   * On failure: marks FAILED with EMBEDDING error
   */
  private static async runEmbeddingStep(documentId: string, sm: any): Promise<StepResult> {
    const startTime = Date.now();

    try {
      console.log(`[STEP RUNNER] 🔢 EMBEDDING STEP: Generating embeddings for chunks...`);

      // Fetch chunks to embed
      const { data: chunks, error: fetchError } = await supabase
        .from('knowledge_chunks')
        .select('id, content')
        .eq('document_id', documentId)
        .order('chunk_index', { ascending: true });

      if (fetchError || !chunks || chunks.length === 0) {
        throw new Error('No chunks found to embed');
      }

      console.log(`[STEP RUNNER] Processing ${chunks.length} chunks...`);

      let successCount = 0;
      let failureCount = 0;

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
        } catch (chunkError) {
          console.error(`[STEP RUNNER] Error embedding chunk ${i}:`, chunkError);
          failureCount++;
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
      const transitioned = await sm.transitionTo(
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

      await sm.markFailed(
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
  private static async runFinalizingStep(documentId: string, sm: any): Promise<StepResult> {
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
      const transitioned = await sm.transitionTo(
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

      await sm.markFailed(
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
    const sm = await getStateMachine();
    const context = await sm.getStateContext(documentId);
    if (!context) return null;

    return sm.getNextStep(context.current_state);
  }

  /**
   * Check if document can proceed to next step
   */
  static async canProceed(documentId: string): Promise<boolean> {
    const sm = await getStateMachine();
    const context = await sm.getStateContext(documentId);
    if (!context) return false;

    // Terminal states cannot proceed
    if (sm.isTerminalState(context.current_state)) {
      return false;
    }

    // Non-terminal states can proceed
    return true;
  }
}

export const knowledgeStepRunnerService = new KnowledgeStepRunnerService();
