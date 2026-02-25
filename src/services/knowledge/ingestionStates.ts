/**
 * PHASE 38: Knowledge Brain State-Driven Architecture
 *
 * Document Ingestion State Machine
 * Defines all possible states and transitions for document processing
 */

/**
 * Document Ingestion States
 *
 * State transitions follow this flow:
 * UPLOADED → EXTRACTING → CHUNKING → EMBEDDING → FINALIZING → COMPLETED
 *            (any state can fail → FAILED)
 */
export enum DocumentIngestionState {
  // Initial state: Document uploaded, awaiting processing
  UPLOADED = 'uploaded',

  // Stage 1: PDF text extraction in progress
  EXTRACTING = 'extracting',

  // Stage 2: Text chunking in progress (intelligence chunking by semantic boundaries)
  CHUNKING = 'chunking',

  // Stage 3: Embedding generation in progress (sequential per chunk)
  EMBEDDING = 'embedding',

  // Stage 4: Final integrity checks and cleanup
  FINALIZING = 'finalizing',

  // Terminal state: Document fully processed and ready for search
  COMPLETED = 'completed',

  // Terminal state: Processing failed at some stage
  FAILED = 'failed',
}

/**
 * Failure reasons - provides context for FAILED state
 */
export enum IngestionFailureReason {
  // Extraction stage failures
  PDF_PARSE_ERROR = 'pdf_parse_error',
  EXTRACTION_TIMEOUT = 'extraction_timeout',
  EXTRACTION_EMPTY = 'extraction_empty',
  EXTRACTION_OOM = 'extraction_oom',

  // Chunking stage failures
  CHUNKING_ERROR = 'chunking_error',
  CHUNK_VALIDATION_FAILED = 'chunk_validation_failed',

  // Batch insert failures
  CHUNK_INSERT_FAILED = 'chunk_insert_failed',
  BATCH_INSERT_TIMEOUT = 'batch_insert_timeout',

  // Embedding stage failures
  EMBEDDING_TOKEN_OVERFLOW = 'embedding_token_overflow',
  EMBEDDING_API_ERROR = 'embedding_api_error',
  EMBEDDING_TIMEOUT = 'embedding_timeout',
  EMBEDDING_PARTIAL_FAILURE = 'embedding_partial_failure',

  // Finalization failures
  INTEGRITY_CHECK_FAILED = 'integrity_check_failed',
  STATE_UPDATE_FAILED = 'state_update_failed',

  // System failures
  DATABASE_ERROR = 'database_error',
  UNKNOWN_ERROR = 'unknown_error',
}

/**
 * State transition metadata
 */
export interface StateTransition {
  from: DocumentIngestionState;
  to: DocumentIngestionState;
  reason?: string;
}

/**
 * Ingestion state context for persistence
 */
export interface IngestionStateContext {
  document_id: string;
  current_state: DocumentIngestionState;
  previous_state?: DocumentIngestionState;

  // Timing
  started_at: string;
  transitioned_at: string;
  updated_at: string;

  // Progress tracking
  progress_percent: number;
  current_step: string;

  // Metrics
  extraction_duration_ms?: number;
  chunking_duration_ms?: number;
  embedding_duration_ms?: number;
  finalization_duration_ms?: number;
  total_duration_ms?: number;

  // Failure tracking
  failure_reason?: IngestionFailureReason;
  error_message?: string;
  error_stack?: string;
  retry_count: number;
  last_retry_at?: string;

  // Statistics
  chunks_created?: number;
  chunks_embedded?: number;
  chunks_failed?: number;
  embedding_integrity_checked?: boolean;
}

/**
 * Valid state transitions
 * Maps from state → list of allowed next states
 */
export const VALID_TRANSITIONS: Record<DocumentIngestionState, DocumentIngestionState[]> = {
  [DocumentIngestionState.UPLOADED]: [
    DocumentIngestionState.EXTRACTING,
    DocumentIngestionState.FAILED,
  ],

  [DocumentIngestionState.EXTRACTING]: [
    DocumentIngestionState.CHUNKING,
    DocumentIngestionState.FAILED,
  ],

  [DocumentIngestionState.CHUNKING]: [
    DocumentIngestionState.EMBEDDING,
    DocumentIngestionState.FAILED,
  ],

  [DocumentIngestionState.EMBEDDING]: [
    DocumentIngestionState.FINALIZING,
    DocumentIngestionState.FAILED,
  ],

  [DocumentIngestionState.FINALIZING]: [
    DocumentIngestionState.COMPLETED,
    DocumentIngestionState.FAILED,
  ],

  // Terminal states: no further transitions
  [DocumentIngestionState.COMPLETED]: [],
  [DocumentIngestionState.FAILED]: [],
};

/**
 * Progress percentages for each state
 * Used for UI progress indicators
 */
export const STATE_PROGRESS_MAP: Record<DocumentIngestionState, number> = {
  [DocumentIngestionState.UPLOADED]: 5,
  [DocumentIngestionState.EXTRACTING]: 20,
  [DocumentIngestionState.CHUNKING]: 40,
  [DocumentIngestionState.EMBEDDING]: 75,
  [DocumentIngestionState.FINALIZING]: 95,
  [DocumentIngestionState.COMPLETED]: 100,
  [DocumentIngestionState.FAILED]: 0,
};
