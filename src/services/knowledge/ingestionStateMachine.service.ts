/**
 * PHASE 38: Ingestion State Machine Service
 *
 * Manages state transitions for document ingestion
 * Provides:
 * - Deterministic state management
 * - Validation of transitions
 * - Failure tracking and recovery
 * - Progress monitoring
 * - Restart capability from any state
 */

import { supabase } from '@/lib/supabase';
import {
  DocumentIngestionState,
  IngestionFailureReason,
  VALID_TRANSITIONS,
  STATE_PROGRESS_MAP,
  IngestionStateContext,
} from './ingestionStates';

export class IngestionStateMachineService {
  /**
   * Validate if transition is allowed
   * @param from Current state
   * @param to Target state
   * @returns true if transition valid
   */
  isValidTransition(
    from: DocumentIngestionState,
    to: DocumentIngestionState
  ): boolean {
    const allowedTransitions = VALID_TRANSITIONS[from] || [];
    return allowedTransitions.includes(to);
  }

  /**
   * Get allowed next states from current state
   */
  getAllowedTransitions(from: DocumentIngestionState): DocumentIngestionState[] {
    return VALID_TRANSITIONS[from] || [];
  }

  /**
   * Get the next logical step for a document
   * Used to determine what to do when restarting from a checkpoint
   */
  getNextStep(
    currentState: DocumentIngestionState
  ): DocumentIngestionState | null {
    const allowedTransitions = VALID_TRANSITIONS[currentState];
    if (!allowedTransitions || allowedTransitions.length === 0) {
      return null; // Terminal state
    }

    // For normal flow, return first non-FAILED transition
    return allowedTransitions.find((state) => state !== DocumentIngestionState.FAILED) || null;
  }

  /**
   * Get progress percentage for UI indicators
   */
  getProgressPercent(state: DocumentIngestionState): number {
    return STATE_PROGRESS_MAP[state] || 0;
  }

  /**
   * Transition document to new state in database
   * Performs atomic update with validation
   *
   * Maps to existing Supabase columns:
   * - DocumentIngestionState → ingestion_status
   * - progress → ingestion_progress
   * - stepName → last_ingestion_step
   * - ingestion_started_at (set when transitioning to EXTRACTING)
   * - ingestion_completed_at (set when transitioning to COMPLETED)
   *
   * @param documentId Document ID
   * @param toState Target state
   * @param stepName Current step description
   * @returns true if transition successful, false if invalid
   */
  async transitionTo(
    documentId: string,
    toState: DocumentIngestionState,
    stepName: string
  ): Promise<boolean> {
    try {
      console.log(`[STATE MACHINE] 🔄 Transitioning document ${documentId} to ${toState}`);

      // Get current state first
      const { data: doc, error: fetchError } = await supabase
        .from('knowledge_documents')
        .select('ingestion_status')
        .eq('id', documentId)
        .single();

      if (fetchError || !doc) {
        console.error(`[STATE MACHINE] 🔴 Failed to fetch document state:`, fetchError);
        return false;
      }

      const currentState = doc.ingestion_status as DocumentIngestionState;

      // PATCH 1-2: FAILED state lock - prevent any transitions FROM FAILED
      if (currentState === DocumentIngestionState.FAILED) {
        console.warn(`[STATE LOCK] ⚠️ Ignoring transition from FAILED state (immutable)`);
        return false;
      }

      // Validate transition
      if (!this.isValidTransition(currentState, toState)) {
        console.error(
          `[STATE MACHINE] 🔴 Invalid transition: ${currentState} → ${toState}`
        );
        return false;
      }

      // Build update object with existing Supabase columns
      const updateData: any = {
        ingestion_status: toState,
        last_ingestion_step: stepName,
        ingestion_progress: this.getProgressPercent(toState),
        updated_at: new Date().toISOString(),
      };

      // Set ingestion_started_at when transitioning to EXTRACTING
      if (toState === DocumentIngestionState.EXTRACTING) {
        updateData.ingestion_started_at = new Date().toISOString();
        console.log(`[STATE MACHINE] ⏱️ Ingestion started at ${updateData.ingestion_started_at}`);
      }

      // Set ingestion_completed_at when transitioning to COMPLETED
      if (toState === DocumentIngestionState.COMPLETED) {
        updateData.ingestion_completed_at = new Date().toISOString();
        console.log(`[STATE MACHINE] ⏱️ Ingestion completed at ${updateData.ingestion_completed_at}`);
      }

      // Update state in database
      const { error: updateError } = await supabase
        .from('knowledge_documents')
        .update(updateData)
        .eq('id', documentId);

      if (updateError) {
        console.error(`[STATE MACHINE] 🔴 State update failed:`, updateError);
        return false;
      }

      console.log(`[STATE MACHINE] ✅ Transitioned: ${currentState} → ${toState}`);
      return true;
    } catch (error) {
      console.error(`[STATE MACHINE] 💥 Transition error:`, error);
      return false;
    }
  }

  /**
   * Mark document as FAILED with reason and error details
   *
   * Stores error information in existing Supabase column:
   * - last_ingestion_error: JSON string with reason, message, and stack
   *
   * @param documentId Document ID
   * @param reason Failure reason enum
   * @param errorMessage Human-readable error message
   * @param errorStack Optional stack trace
   */
  async markFailed(
    documentId: string,
    reason: IngestionFailureReason,
    errorMessage: string,
    errorStack?: string
  ): Promise<boolean> {
    try {
      console.log(
        `[STATE MACHINE] 🔴 Marking document ${documentId} as FAILED`
      );
      console.log(`[STATE MACHINE] Reason: ${reason}`);
      console.log(`[STATE MACHINE] Error: ${errorMessage}`);

      // Build error details as JSON string for storage in last_ingestion_error
      const errorDetails = {
        reason,
        reasonName: this.getFailureReasonName(reason),
        message: errorMessage,
        stack: errorStack || null,
        timestamp: new Date().toISOString(),
      };

      const { error: updateError } = await supabase
        .from('knowledge_documents')
        .update({
          ingestion_status: DocumentIngestionState.FAILED,
          last_ingestion_error: JSON.stringify(errorDetails),
          ingestion_progress: 0,
          updated_at: new Date().toISOString(),
        })
        .eq('id', documentId);

      if (updateError) {
        console.error(`[STATE MACHINE] Failed to mark document as failed:`, updateError);
        return false;
      }

      console.log(`[STATE MACHINE] ✅ Document marked as FAILED`);
      return true;
    } catch (error) {
      console.error(`[STATE MACHINE] 💥 Error marking as failed:`, error);
      return false;
    }
  }

  /**
   * Get current state and context for a document
   * Used for resuming interrupted ingestions
   *
   * Reads from existing Supabase columns:
   * - ingestion_status, ingestion_progress, last_ingestion_step
   * - ingestion_started_at, ingestion_completed_at, last_ingestion_error
   */
  async getStateContext(documentId: string): Promise<IngestionStateContext | null> {
    try {
      // Select only existing Supabase columns (minimal fetch)
      const { data: doc, error } = await supabase
        .from('knowledge_documents')
        .select(
          'id, ingestion_status, ingestion_progress, last_ingestion_step, last_ingestion_error, ingestion_started_at, ingestion_completed_at, updated_at'
        )
        .eq('id', documentId)
        .single();

      if (error || !doc) {
        console.error(`[STATE MACHINE] Failed to fetch state context:`, error);
        return null;
      }

      // Parse error details from JSON if present and document is FAILED
      let failureReason: IngestionFailureReason | undefined;
      let errorMessage: string | undefined;
      let errorStack: string | null | undefined;

      if (doc.last_ingestion_error) {
        try {
          const errorDetails = JSON.parse(doc.last_ingestion_error);
          failureReason = errorDetails.reason;
          errorMessage = errorDetails.message;
          errorStack = errorDetails.stack;
        } catch {
          // If not JSON, treat as plain error message (backward compatibility)
          errorMessage = doc.last_ingestion_error;
        }
      }

      const context: IngestionStateContext = {
        document_id: documentId,
        current_state: doc.ingestion_status as DocumentIngestionState,
        started_at: doc.ingestion_started_at || new Date().toISOString(),
        transitioned_at: doc.updated_at || new Date().toISOString(),
        updated_at: new Date().toISOString(),
        progress_percent: doc.ingestion_progress || STATE_PROGRESS_MAP[doc.ingestion_status] || 0,
        current_step: doc.last_ingestion_step || 'unknown',
        failure_reason: failureReason,
        error_message: errorMessage,
        error_stack: errorStack,
        retry_count: 0, // Always 0 until retry infrastructure added
      };

      return context;
    } catch (error) {
      console.error(`[STATE MACHINE] 💥 Error getting state context:`, error);
      return null;
    }
  }

  /**
   * Check if document is in terminal state (COMPLETED or FAILED)
   */
  isTerminalState(state: DocumentIngestionState): boolean {
    return (
      state === DocumentIngestionState.COMPLETED || state === DocumentIngestionState.FAILED
    );
  }

  /**
   * Check if document is retryable (in FAILED state)
   */
  isRetryable(state: DocumentIngestionState): boolean {
    return state === DocumentIngestionState.FAILED;
  }

  /**
   * Get human-readable state name
   */
  getStateName(state: DocumentIngestionState): string {
    const names: Record<DocumentIngestionState, string> = {
      [DocumentIngestionState.UPLOADED]: 'Uploaded',
      [DocumentIngestionState.EXTRACTING]: 'Extracting text...',
      [DocumentIngestionState.CHUNKING]: 'Chunking content...',
      [DocumentIngestionState.EMBEDDING]: 'Generating embeddings...',
      [DocumentIngestionState.FINALIZING]: 'Finalizing...',
      [DocumentIngestionState.COMPLETED]: 'Completed ✅',
      [DocumentIngestionState.FAILED]: 'Failed ❌',
    };
    return names[state] || 'Unknown';
  }

  /**
   * Get human-readable failure reason
   */
  getFailureReasonName(reason: IngestionFailureReason): string {
    const names: Record<IngestionFailureReason, string> = {
      [IngestionFailureReason.PDF_PARSE_ERROR]: 'PDF parsing error',
      [IngestionFailureReason.EXTRACTION_TIMEOUT]: 'Extraction timed out',
      [IngestionFailureReason.EXTRACTION_EMPTY]: 'No text extracted from PDF',
      [IngestionFailureReason.EXTRACTION_OOM]: 'Out of memory during extraction',
      [IngestionFailureReason.CHUNKING_ERROR]: 'Chunking error',
      [IngestionFailureReason.CHUNK_VALIDATION_FAILED]: 'Chunk validation failed',
      [IngestionFailureReason.CHUNK_INSERT_FAILED]: 'Failed to insert chunks',
      [IngestionFailureReason.BATCH_INSERT_TIMEOUT]: 'Batch insert timeout',
      [IngestionFailureReason.EMBEDDING_TOKEN_OVERFLOW]: 'Token limit exceeded',
      [IngestionFailureReason.EMBEDDING_API_ERROR]: 'Embedding API error',
      [IngestionFailureReason.EMBEDDING_TIMEOUT]: 'Embedding generation timeout',
      [IngestionFailureReason.EMBEDDING_PARTIAL_FAILURE]: 'Partial embedding failure',
      [IngestionFailureReason.INTEGRITY_CHECK_FAILED]: 'Integrity check failed',
      [IngestionFailureReason.STATE_UPDATE_FAILED]: 'State update failed',
      [IngestionFailureReason.DATABASE_ERROR]: 'Database error',
      [IngestionFailureReason.UNKNOWN_ERROR]: 'Unknown error',
    };
    return names[reason] || 'Unknown error';
  }
}

export const ingestionStateMachineService = new IngestionStateMachineService();
