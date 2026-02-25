/**
 * Knowledge Services
 *
 * PHASE 38: State-driven architecture
 * PHASE 38B: Supabase column mapping
 * PHASE 38C: Step-based orchestration
 */

export { ingestionStateMachineService, IngestionStateMachineService } from './ingestionStateMachine.service';
export { DocumentIngestionState, IngestionFailureReason, type IngestionStateContext } from './ingestionStates';
export { knowledgeStepRunnerService, KnowledgeStepRunnerService, type StepResult } from './knowledgeStepRunner.service';
