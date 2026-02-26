/**
 * PHASE 39: Knowledge Step Runner Trigger
 *
 * Lightweight API endpoint to progressively integrate Step Runner
 * without breaking existing knowledge ingestion pipeline.
 *
 * Triggered after document processing completes.
 * Transitions state to EXTRACTING and runs next step non-blocking.
 */

import { ingestionStateMachineService } from '@/services/knowledge/ingestionStateMachine.service';
import { KnowledgeStepRunnerService } from '@/services/knowledge/knowledgeStepRunner.service';
import { DocumentIngestionState } from '@/services/knowledge/ingestionStates';
import { log, warn, error, time, timeEnd } from '@/lib/logger';

export interface TrigerStepRunnerRequest {
  documentId: string;
}

export interface TriggerStepRunnerResponse {
  success: boolean;
  message: string;
  canProceed?: boolean;
  error?: string;
}

/**
 * Trigger Step Runner for a document
 *
 * IMPORTANT: This is FIRE-AND-SAFE
 * - Transitions state to EXTRACTING
 * - Launches runNextStep() non-blocking
 * - Does NOT wait for completion
 * - Existing pipeline continues unaffected
 */
export async function triggerStepRunner(
  documentId: string
): Promise<TriggerStepRunnerResponse> {
  try {
    log(`[STEP TRIGGER] 🚀 Triggering step runner for document ${documentId}`);

    // ÉTAPE 2 - SAFETY GUARD: Check if document can proceed
    const canProceed = await KnowledgeStepRunnerService.canProceed(documentId);
    if (!canProceed) {
      return {
        success: false,
        canProceed: false,
        message: 'Document cannot proceed to next step',
        error: 'Document is in terminal state or has issues',
      };
    }

    log(`[STEP TRIGGER] ✅ canProceed=${canProceed} - proceeding to trigger`);

    // Transition to EXTRACTING state
    await ingestionStateMachineService.transitionTo(
      documentId,
      DocumentIngestionState.EXTRACTING,
      'extraction_initiated_by_trigger'
    );

    log(`[STEP TRIGGER] 📝 State transitioned to EXTRACTING`);

    // ÉTAPE 1 - FIRE-AND-SAFE: Launch runNextStep non-blocking
    // This runs in the background without awaiting
    // Existing pipeline continues immediately
    KnowledgeStepRunnerService.runNextStep(documentId)
      .then(() => {
        log(`[STEP TRIGGER] ✅ Step runner completed for ${documentId}`);
      })
      .catch((error) => {
        console.error(`[STEP TRIGGER] ❌ Step runner failed for ${documentId}:`, error);
      });

    return {
      success: true,
      canProceed: true,
      message: 'Step runner triggered successfully',
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[STEP TRIGGER] ❌ Error triggering step runner:`, errorMessage);

    return {
      success: false,
      message: 'Failed to trigger step runner',
      error: errorMessage,
    };
  }
}
