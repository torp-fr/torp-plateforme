# PHASE 38C: Step-Based Orchestration for Knowledge Ingestion

**Date**: 2026-02-25
**Status**: ✅ Complete
**Focus**: Decouple ingestion steps using state machine

---

## 🎯 Objective

Transform the monolithic `processChunksAsync()` flow into **independent, testable steps** orchestrated via the state machine. This enables:

- ✅ Resumable processing from any checkpoint
- ✅ Better error isolation per step
- ✅ Independent testing of each step
- ✅ Foundation for distributed/async job processing
- ✅ Clearer visibility into which step is failing

---

## 🔄 BEFORE: Monolithic Flow

```
addKnowledgeDocumentWithTimeout():
  └─ setTimeout(..., 0):
     └─ processChunksAsync(documentId):
        ├─ tryClaimDocumentForProcessing()
        ├─ STEP 1: extractDocumentText()
        │  └─ UPDATE status = 'extracting'
        ├─ STEP 2: chunkText()
        │  └─ UPDATE status = 'chunking'
        ├─ STEP 3: Batch insert chunks
        ├─ STEP 4: generateChunkEmbeddingsAsync()
        │  └─ UPDATE status = 'embedding'
        │  └─ For each chunk: generateEmbedding()
        ├─ STEP 5: verifyEmbeddingIntegrity()
        ├─ STEP 6: UPDATE status = 'complete'
        └─ End: Success or catch() block

Problem:
- All steps in one function (hard to restart)
- Errors bubble up to outer catch
- Cannot resume from CHUNKING if EMBEDDING fails
- Difficult to test individual steps
```

---

## 🔄 AFTER: Step-Based Orchestration

```
addKnowledgeDocumentWithTimeout():
  └─ setTimeout(..., 0):
     └─ STEP RUNNER LOOP:
        ├─ ITERATION 1:
        │  └─ runNextStep(documentId):
        │     ├─ getStateContext() → UPLOADED
        │     └─ Return: waiting for extraction trigger
        │
        ├─ ITERATION 2 (triggered manually or via scheduler):
        │  └─ runNextStep(documentId):
        │     ├─ getStateContext() → UPLOADED
        │     ├─ transitionTo(EXTRACTING)
        │     ├─ runExtractionStep():
        │     │  ├─ Extract text from document
        │     │  ├─ Validate extraction
        │     │  └─ transitionTo(CHUNKING)
        │     └─ Return: {success: true, nextState: CHUNKING, duration}
        │
        ├─ ITERATION 3:
        │  └─ runNextStep(documentId):
        │     ├─ getStateContext() → CHUNKING
        │     ├─ runChunkingStep():
        │     │  ├─ Get content and chunk
        │     │  ├─ Store chunks count
        │     │  └─ transitionTo(EMBEDDING)
        │     └─ Return: {success: true, nextState: EMBEDDING, duration}
        │
        ├─ ITERATION 4:
        │  └─ runNextStep(documentId):
        │     ├─ getStateContext() → EMBEDDING
        │     ├─ runEmbeddingStep():
        │     │  ├─ For each chunk:
        │     │  │  ├─ generateEmbedding()
        │     │  │  └─ Store embedding
        │     │  ├─ If token overflow error:
        │     │  │  └─ markFailed(TOKEN_OVERFLOW)
        │     │  └─ transitionTo(FINALIZING)
        │     └─ Return: {success: true, nextState: FINALIZING, duration}
        │
        ├─ ITERATION 5:
        │  └─ runNextStep(documentId):
        │     ├─ getStateContext() → FINALIZING
        │     ├─ runFinalizingStep():
        │     │  ├─ Verify all chunks embedded
        │     │  ├─ If missing embeddings:
        │     │  │  └─ markFailed(INTEGRITY_CHECK_FAILED)
        │     │  └─ transitionTo(COMPLETED)
        │     └─ Return: {success: true, nextState: COMPLETED, duration}
        │
        └─ ITERATION 6:
           └─ runNextStep(documentId):
              ├─ getStateContext() → COMPLETED
              └─ Return: {success: true, terminal state reached}

Benefits:
- Each step independent and testable
- Can resume from any state
- Error on embedding doesn't lose extracted/chunked data
- Can call runNextStep() again after fixing issue
- Foundation for job queue/async processing
```

---

## 📊 STEP DEFINITIONS

### Step Mapping to State Machine

| Step | From State | Action | To State | Error Handling |
|------|-----------|--------|----------|----------------|
| **Extract** | EXTRACTED | Extract text, validate | CHUNKING | markFailed(EXTRACTION_*) |
| **Chunk** | CHUNKING | Split text, store chunks | EMBEDDING | markFailed(CHUNKING_*) |
| **Embed** | EMBEDDING | Generate embeddings per chunk | FINALIZING | markFailed(EMBEDDING_*) |
| **Finalize** | FINALIZING | Verify integrity | COMPLETED | markFailed(INTEGRITY_*) |

---

## 🔧 IMPLEMENTATION DETAILS

### runNextStep(documentId): StepResult

**Main Orchestrator Function**:

```typescript
async runNextStep(documentId): Promise<StepResult> {
  1. Get state context via state machine
  2. Switch on current_state:

     case EXTRACTING:
       result = await runExtractionStep(documentId)

     case CHUNKING:
       result = await runChunkingStep(documentId)

     case EMBEDDING:
       result = await runEmbeddingStep(documentId)

     case FINALIZING:
       result = await runFinalizingStep(documentId)

     case COMPLETED:
       return {success: true, terminal state}

     case FAILED:
       return {success: false, already failed}

  3. Return StepResult:
     {
       success: boolean,
       nextState: DocumentIngestionState,
       error?: string,
       duration: number
     }
}
```

**Return Type**:
```typescript
interface StepResult {
  success: boolean;           // Step succeeded?
  nextState?: DocumentIngestionState;  // What's next?
  error?: string;             // Error message if failed
  duration: number;           // Execution time in ms
}
```

---

### Step 1: Extraction

```typescript
private async runExtractionStep(documentId): Promise<StepResult>
  Logic:
    1. Fetch document original_content
    2. Validate not empty
    3. If error: markFailed(EXTRACTION_EMPTY)
    4. If success: transitionTo(CHUNKING)
    5. Return StepResult with nextState

  Error Handling:
    - Empty content → EXTRACTION_EMPTY
    - Fetch error → EXTRACTION_ERROR
    - All errors → markFailed() with reason
```

---

### Step 2: Chunking

```typescript
private async runChunkingStep(documentId): Promise<StepResult>
  Logic:
    1. Fetch original_content
    2. Call chunkText() utility
    3. Validate chunks not empty
    4. Store chunks_created count in DB
    5. If error: markFailed(CHUNKING_ERROR)
    6. If success: transitionTo(EMBEDDING)
    7. Return StepResult with nextState

  Error Handling:
    - No chunks → CHUNKING_ERROR
    - All errors → markFailed() with reason
```

---

### Step 3: Embedding

```typescript
private async runEmbeddingStep(documentId): Promise<StepResult>
  Logic:
    1. Fetch all chunks for document
    2. For each chunk:
       a. Call knowledgeBrainService.generateEmbedding()
       b. If token overflow: markFailed(TOKEN_OVERFLOW) + return FAILED
       c. If success: store embedding in DB
       d. Track success/failure count
    3. If all failed: markFailed(EMBEDDING_API_ERROR)
    4. If success: transitionTo(FINALIZING)
    5. Return StepResult with nextState

  Error Handling:
    - Token overflow → EMBEDDING_TOKEN_OVERFLOW
    - API error → EMBEDDING_API_ERROR
    - Partial failure → Continue, but fail finalization later
```

---

### Step 4: Finalizing

```typescript
private async runFinalizingStep(documentId): Promise<StepResult>
  Logic:
    1. Fetch all chunks with embeddings
    2. Count total chunks vs embedded chunks
    3. If missing embeddings: markFailed(INTEGRITY_CHECK_FAILED)
    4. Update chunks_embedded count in DB
    5. If success: transitionTo(COMPLETED)
    6. Return StepResult with nextState

  Error Handling:
    - Missing embeddings → INTEGRITY_CHECK_FAILED
    - All errors → markFailed() with reason
```

---

## 📋 PUBLIC API

### Main Function

```typescript
// Run the next step for a document
async runNextStep(documentId: string): Promise<StepResult>

// Example usage:
const result = await knowledgeStepRunnerService.runNextStep('doc-123');
if (result.success) {
  console.log(`Next state: ${result.nextState}`);
  console.log(`Took: ${result.duration}ms`);
} else {
  console.error(`Failed: ${result.error}`);
}
```

### Helper Functions

```typescript
// Get the next state without running it
async getNextState(documentId: string): Promise<DocumentIngestionState | null>

// Check if document can proceed
async canProceed(documentId: string): Promise<boolean>
```

---

## 🔄 USAGE FLOW

### Automatic Flow (Current)

```
1. Document uploaded
2. setTimeout(..., 0) calls processChunksAsync()
3. All steps run sequentially
4. End result: COMPLETED or FAILED
```

### New Explicit Flow

```
1. Document uploaded
2. Manual trigger: await runNextStep(docId)  // EXTRACTING
3. Manual trigger: await runNextStep(docId)  // CHUNKING
4. Manual trigger: await runNextStep(docId)  // EMBEDDING
5. Manual trigger: await runNextStep(docId)  // FINALIZING
6. Result: COMPLETED or FAILED
```

### Resumable Flow

```
1. Document in EMBEDDING state (halfway through)
2. Network error, server crashes
3. On recovery: await runNextStep(docId)
4. Continues from EMBEDDING step (not UPLOADED)
5. Embeddings already generated: only do FINALIZING
```

---

## 🔍 ERROR ISOLATION EXAMPLE

### Old Approach (Monolithic)

```
processChunksAsync():
  ├─ Extract: OK
  ├─ Chunk: OK
  ├─ Embed chunk 1: OK
  ├─ Embed chunk 50: TOKEN_OVERFLOW ❌
  └─ catch() block:
     └─ Mark entire document FAILED
     └─ Extracted & chunked data lost in flow
```

### New Approach (Step-Based)

```
runNextStep() → EMBEDDING step:
  ├─ Embed chunk 1-49: OK
  ├─ Embed chunk 50: TOKEN_OVERFLOW ❌
  └─ markFailed(EMBEDDING_TOKEN_OVERFLOW)
     └─ Document state: FAILED
     └─ Extracted & chunked data preserved in DB
     └─ Can retry with smaller chunks
```

---

## ✅ BREAKING CHANGES VERIFICATION

### Zero Breaking Changes

✅ **API Contract**:
- ❌ No changes to `knowledge-brain.service`
- ❌ No changes to `aiOrchestrator`
- ❌ No changes to existing functions
- ✅ New service alongside existing code

✅ **Public Interface**:
- ✅ New service: `knowledgeStepRunnerService`
- ✅ New function: `runNextStep(documentId)`
- ✅ New type: `StepResult`
- ✅ No renames or removals

✅ **Data Model**:
- ✅ Uses existing state machine
- ✅ No new database columns
- ✅ No schema modifications
- ✅ Backward compatible

✅ **Integration**:
- ✅ Can be integrated gradually
- ✅ Old `processChunksAsync()` still works
- ✅ New step runner works alongside
- ✅ No migration path required

---

## 🚀 INTEGRATION TIMELINE

### PHASE 38C (Now)
- ✅ Create step runner service
- ✅ Define public API
- ✅ Document flow
- ✅ Zero breaking changes

### PHASE 39 (Next)
- [ ] Test step runner with knowledge-brain
- [ ] Optional: Integrate with knowledge-brain
- [ ] Keep old flow as fallback
- [ ] Gradual migration path

### PHASE 40+ (Future)
- [ ] Add job queue (Bull/BullMQ)
- [ ] Distribute steps across workers
- [ ] Implement retry logic
- [ ] Add scheduling

---

## 📈 BENEFITS SUMMARY

| Aspect | Before | After |
|--------|--------|-------|
| **Monolithic** | Single function | Independent steps |
| **Resumable** | No | Yes (from any state) |
| **Testable** | Hard | Easy (mock per step) |
| **Error Isolation** | Bubble up | Per-step handling |
| **Visibility** | One big block | Clear steps |
| **Parallelizable** | No | Yes (future) |
| **Job Queue Ready** | No | Yes (foundation) |

---

## 🎯 PHASE 38C SUMMARY

| Item | Status | Notes |
|------|--------|-------|
| **Step Runner Service** | ✅ Created | knowledgeStepRunner.service.ts |
| **Main Function** | ✅ Implemented | runNextStep(documentId) |
| **Step Handlers** | ✅ Implemented | Extract, Chunk, Embed, Finalize |
| **Error Handling** | ✅ Integrated | Uses state machine markFailed() |
| **Documentation** | ✅ Complete | Before/after flow, API reference |
| **Breaking Changes** | ❌ Zero | Fully backward compatible |
| **Integration** | ✅ Ready | Alongside existing code |

---

## 📁 FILES CREATED

1. **src/services/knowledge/knowledgeStepRunner.service.ts** (450+ lines)
   - KnowledgeStepRunnerService class
   - runNextStep() main orchestrator
   - 4 step handlers (Extract, Chunk, Embed, Finalize)
   - Helper functions (getNextState, canProceed)
   - StepResult interface

2. **PHASE_38C_STEP_RUNNER.md** (this file)
   - Architecture documentation
   - Before/after flow diagrams
   - Step definitions
   - Implementation details
   - Usage examples

---

**Status**: ✅ PHASE 38C Complete
**Breaking Changes**: ❌ ZERO
**Integration Path**: Gradual (alongside existing code)
**Next**: PHASE 39 - Optional integration with knowledge-brain.service
