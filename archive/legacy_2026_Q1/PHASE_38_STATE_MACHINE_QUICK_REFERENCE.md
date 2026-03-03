# PHASE 38: State Machine Quick Reference

**Quick lookup for state transitions and usage**

---

## 🗺️ STATE DIAGRAM

```
┌──────────┐
│ UPLOADED │ (5%)
└─────┬────┘
      │
      ▼
┌──────────────┐
│  EXTRACTING  │ (20%)
└──────┬───────┘
       │
       ▼
┌──────────────┐
│  CHUNKING    │ (40%)
└──────┬───────┘
       │
       ▼
┌──────────────┐
│  EMBEDDING   │ (75%)
└──────┬───────┘
       │
       ▼
┌──────────────┐
│ FINALIZING   │ (95%)
└──────┬───────┘
       │
       ▼
┌──────────────┐
│  COMPLETED   │ (100%) ✅
└──────────────┘


       Any State
         ▲   │
         │   ▼
      ┌──────────┐
      │  FAILED  │ (0%) ❌
      └──────────┘
```

---

## 📋 TRANSITIONS TABLE

| From | To | Valid | Use When |
|------|----|----|----------|
| UPLOADED | EXTRACTING | ✅ | Ready to extract |
| UPLOADED | FAILED | ✅ | Pre-flight check failed |
| EXTRACTING | CHUNKING | ✅ | Text extraction complete |
| EXTRACTING | FAILED | ✅ | PDF parse error, timeout, OOM |
| CHUNKING | EMBEDDING | ✅ | Chunks validated and inserted |
| CHUNKING | FAILED | ✅ | Chunking error, validation failed |
| EMBEDDING | FINALIZING | ✅ | All chunks embedded |
| EMBEDDING | FAILED | ✅ | Token overflow, API error, partial failure |
| FINALIZING | COMPLETED | ✅ | Integrity check passed |
| FINALIZING | FAILED | ✅ | Missing embeddings, DB error |
| ❌ Others | - | ❌ | Invalid |

---

## 🔧 API USAGE

### Basic Transition

```typescript
import { ingestionStateMachineService, DocumentIngestionState } from '@/services/knowledge';

// Transition document to next state
const success = await ingestionStateMachineService.transitionTo(
  documentId,
  DocumentIngestionState.CHUNKING,
  'chunking_started'
);

if (!success) {
  console.error('Invalid transition');
}
```

### Mark as Failed

```typescript
import { IngestionFailureReason } from '@/services/knowledge';

await ingestionStateMachineService.markFailed(
  documentId,
  IngestionFailureReason.EMBEDDING_TOKEN_OVERFLOW,
  'Chunk 50 exceeded 8192 tokens',
  error.stack
);
```

### Get State Context

```typescript
const context = await ingestionStateMachineService.getStateContext(documentId);

console.log(context.current_state);        // 'embedding'
console.log(context.progress_percent);     // 75
console.log(context.failure_reason);       // null (only if FAILED)
console.log(context.error_message);        // null (only if FAILED)
```

### Get Next Step

```typescript
const nextState = ingestionStateMachineService.getNextStep(
  DocumentIngestionState.EXTRACTING
);
console.log(nextState); // DocumentIngestionState.CHUNKING
```

### Validate Transition

```typescript
const isValid = ingestionStateMachineService.isValidTransition(
  DocumentIngestionState.EXTRACTING,
  DocumentIngestionState.CHUNKING
);
console.log(isValid); // true
```

---

## 🎯 STATES & PROGRESS %

| State | Progress | Meaning |
|-------|----------|---------|
| UPLOADED | 5% | Just uploaded, awaiting processing |
| EXTRACTING | 20% | PDF text extraction in progress |
| CHUNKING | 40% | Text chunking in progress |
| EMBEDDING | 75% | Embedding generation in progress |
| FINALIZING | 95% | Final checks in progress |
| COMPLETED | 100% | ✅ Done, ready for search |
| FAILED | 0% | ❌ Processing failed |

---

## ❌ FAILURE REASONS (15 TYPES)

### Extraction Failures

```typescript
IngestionFailureReason.PDF_PARSE_ERROR        // PDF structure invalid
IngestionFailureReason.EXTRACTION_TIMEOUT     // Extraction > 60s
IngestionFailureReason.EXTRACTION_EMPTY       // No text in PDF
IngestionFailureReason.EXTRACTION_OOM         // Out of memory
```

### Chunking Failures

```typescript
IngestionFailureReason.CHUNKING_ERROR         // Algorithm error
IngestionFailureReason.CHUNK_VALIDATION_FAILED // Validation failed
```

### Batch Insert Failures

```typescript
IngestionFailureReason.CHUNK_INSERT_FAILED    // INSERT query failed
IngestionFailureReason.BATCH_INSERT_TIMEOUT   // INSERT > 30s
```

### Embedding Failures

```typescript
IngestionFailureReason.EMBEDDING_TOKEN_OVERFLOW   // >8192 tokens
IngestionFailureReason.EMBEDDING_API_ERROR        // OpenAI/Claude error
IngestionFailureReason.EMBEDDING_TIMEOUT          // >30s
IngestionFailureReason.EMBEDDING_PARTIAL_FAILURE  // Some chunks failed
```

### System Failures

```typescript
IngestionFailureReason.INTEGRITY_CHECK_FAILED // Missing embeddings
IngestionFailureReason.STATE_UPDATE_FAILED    // State update failed
IngestionFailureReason.DATABASE_ERROR         // General DB error
IngestionFailureReason.UNKNOWN_ERROR          // Unclassified
```

---

## 🔄 COMMON PATTERNS

### Processing Loop (in background job)

```typescript
// Extract
if (!await ingestionStateMachineService.transitionTo(
  docId,
  DocumentIngestionState.EXTRACTING,
  'extraction_started'
)) {
  console.error('Could not start extraction');
  return;
}

try {
  const text = await extractDocumentText(file);

  // Chunk
  if (!await ingestionStateMachineService.transitionTo(
    docId,
    DocumentIngestionState.CHUNKING,
    'chunking_started'
  )) {
    throw new Error('Could not transition to CHUNKING');
  }

  const chunks = chunkText(text);

  // Embed
  if (!await ingestionStateMachineService.transitionTo(
    docId,
    DocumentIngestionState.EMBEDDING,
    'embedding_started'
  )) {
    throw new Error('Could not transition to EMBEDDING');
  }

  // ... embedding logic ...

  // Finalize
  if (!await ingestionStateMachineService.transitionTo(
    docId,
    DocumentIngestionState.FINALIZING,
    'checking_integrity'
  )) {
    throw new Error('Could not transition to FINALIZING');
  }

  // ... integrity check ...

  // Complete
  await ingestionStateMachineService.transitionTo(
    docId,
    DocumentIngestionState.COMPLETED,
    'complete'
  );

} catch (error) {
  await ingestionStateMachineService.markFailed(
    docId,
    IngestionFailureReason.UNKNOWN_ERROR,
    error.message,
    error.stack
  );
}
```

### Error Handling with Specific Reasons

```typescript
try {
  const embedding = await aiOrchestrator.generateEmbedding({
    text: chunkContent,
    model: 'text-embedding-3-small',
  });
} catch (error) {
  if (error.message.includes('context_length_exceeded')) {
    await ingestionStateMachineService.markFailed(
      docId,
      IngestionFailureReason.EMBEDDING_TOKEN_OVERFLOW,
      `Chunk exceeded model token limit: ${error.message}`,
      error.stack
    );
  } else if (error.message.includes('timeout')) {
    await ingestionStateMachineService.markFailed(
      docId,
      IngestionFailureReason.EMBEDDING_TIMEOUT,
      `Embedding API timeout: ${error.message}`,
      error.stack
    );
  } else {
    await ingestionStateMachineService.markFailed(
      docId,
      IngestionFailureReason.EMBEDDING_API_ERROR,
      `Embedding API error: ${error.message}`,
      error.stack
    );
  }
}
```

### UI Progress Display

```typescript
const context = await ingestionStateMachineService.getStateContext(docId);

if (context.current_state === DocumentIngestionState.FAILED) {
  const reason = ingestionStateMachineService.getFailureReasonName(
    context.failure_reason
  );
  return <div>Failed: {reason}</div>;
}

const stateName = ingestionStateMachineService.getStateName(
  context.current_state
);
const progress = context.progress_percent;

return (
  <div>
    <p>{stateName}</p>
    <ProgressBar value={progress} max={100} />
  </div>
);
```

---

## 📊 STATE HELPERS

```typescript
// Get all allowed next states
const nextStates = ingestionStateMachineService.getAllowedTransitions(
  DocumentIngestionState.EMBEDDING
);
// Returns: [DocumentIngestionState.FINALIZING, DocumentIngestionState.FAILED]

// Check if terminal state
const isTerminal = ingestionStateMachineService.isTerminalState(
  DocumentIngestionState.COMPLETED
);
// Returns: true

// Check if retryable
const canRetry = ingestionStateMachineService.isRetryable(
  DocumentIngestionState.FAILED
);
// Returns: true

// Get progress %
const progress = ingestionStateMachineService.getProgressPercent(
  DocumentIngestionState.EMBEDDING
);
// Returns: 75

// Get human-readable state name
const name = ingestionStateMachineService.getStateName(
  DocumentIngestionState.EXTRACTING
);
// Returns: "Extracting text..."

// Get human-readable failure reason
const reason = ingestionStateMachineService.getFailureReasonName(
  IngestionFailureReason.EXTRACTION_OOM
);
// Returns: "Out of memory during extraction"
```

---

## 🎯 INTEGRATION CHECKLIST

### For Backend Developers (PHASE 39)

- [ ] Replace `updateDocumentState()` with `transitionTo()` in processChunksAsync()
- [ ] Replace generic error handling with `markFailed()` with specific reasons
- [ ] Add token overflow detection before embedding API calls
- [ ] Add retry endpoint: `POST /knowledge/:documentId/retry`
- [ ] Test state transitions with unit tests
- [ ] Test failure paths with specific reasons

### For Frontend Developers (PHASE 39)

- [ ] Query document state for progress display
- [ ] Show state name + progress bar
- [ ] Show failure reason if FAILED
- [ ] Add retry button if document is FAILED
- [ ] Call retry endpoint on user request

### For DevOps/DBA (PHASE 39)

- [ ] Add new columns to knowledge_documents table
- [ ] Create database migration
- [ ] Update RLS policies if needed
- [ ] Add indices on ingestion_status for queries

---

## ✅ USAGE SUMMARY

### 3-Line Integration

```typescript
// Transition to next state
await ingestionStateMachineService.transitionTo(docId, nextState, stepName);

// Mark as failed with specific reason
await ingestionStateMachineService.markFailed(docId, reason, message, stack);

// Get state for UI/debugging
const context = await ingestionStateMachineService.getStateContext(docId);
```

---

**Version**: PHASE 38
**Status**: ✅ Ready for implementation
**Next**: PHASE 39 - Integration with knowledge-brain.service
