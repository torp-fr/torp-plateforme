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
import { runKnowledgeIngestion } from '@/services/knowledge/knowledgeStepRunner.service';
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

    // PHASE 40: Use new DB-driven API
    // Launch runKnowledgeIngestion non-blocking
    // This automatically handles: claim, timeout check, state validation, all steps
    runKnowledgeIngestion(documentId)
      .then(() => {
        log(`[STEP TRIGGER] ✅ Knowledge ingestion completed for ${documentId}`);
      })
      .catch((err: any) => {
        console.error(`[STEP TRIGGER] ❌ Knowledge ingestion failed for ${documentId}:`, err);
      });

    return {
      success: true,
      canProceed: true,
      message: 'Knowledge ingestion triggered successfully',
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
