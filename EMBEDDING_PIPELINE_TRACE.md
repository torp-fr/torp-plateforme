# Embedding Pipeline Execution Trace

## Problem Statement
- ✅ Chunks are created in database (45 rows)
- ✅ Embedding generation should be triggered
- ❌ Edge Function shows 0 invocations
- ❌ `embedding_vector` remains NULL

---

## Call Chain

### 1. Upload Entry Point
**File**: `src/core/rag/rag.service.ts` (Lines 86-122)
```
uploadDocumentForServerIngestion()
  └─ uploadDocumentToStorage() [creates document record]
  └─ processChunksAsync() [TRIGGERS PIPELINE]
```

### 2. Pipeline Trigger
**File**: `src/core/rag/ingestion/ingestionPipeline.service.ts` (Lines 14-28)
```
processChunksAsync()
  └─ triggerStepRunner() [non-blocking, returns immediately]
```

### 3. Step Runner
**File**: `src/api/knowledge-step-trigger.ts` (Lines 36-68)
```
triggerStepRunner()
  └─ runKnowledgeIngestion(documentId) [fire-and-forget, no await]
```

### 4. Knowledge Ingestion Entry
**File**: `src/services/knowledge/knowledgeStepRunner.service.ts` (Lines 31-53)
```
runKnowledgeIngestion(documentId)
  ├─ claimDocument() [atomic lock, returns null if already processing]
  └─ processDocument(claimed) [IF claimed is NOT null]
```

### 5. Document Processing
**File**: `src/services/knowledge/knowledgeStepRunner.service.ts` (Lines 116-270)
```
processDocument(doc)
  ├─ Step 0: extractDocumentContent() [extract text from file]
  ├─ Step 1: validateContent() [ensure not empty]
  ├─ Step 2: chunkSmart() [split into chunks]
  └─ Step 3: processEmbeddingsInBatches() [GENERATE EMBEDDINGS] ⭐
```

### 6. Embedding Pipeline
**File**: `src/services/knowledge/knowledgeStepRunner.service.ts` (Lines 369-477)
```
processEmbeddingsInBatches(documentId, chunks)
  ├─ FOR LOOP: i = 0 to chunks.length, step EMBEDDING_BATCH_SIZE
  │   ├─ batch = chunks.slice(i, i + EMBEDDING_BATCH_SIZE)
  │   ├─ texts = batch.map(c => c.content)
  │   └─ generateEmbeddingBatch(texts) [CALL EDGE FUNCTION] ⭐
  │       ├─ supabase.functions.invoke('generate-embedding') ⭐
  │       └─ return embeddings array
  └─ FOR LOOP: Insert chunks into database with embeddings
```

### 7. Edge Function Invocation
**File**: `src/services/knowledge/knowledgeStepRunner.service.ts` (Lines 311-320)
```typescript
const result = await supabase.functions.invoke(
  'generate-embedding',
  {
    body: { inputs: texts, model: 'text-embedding-3-small', dimensions: 384 },
  }
);
```

---

## Critical Logging Points

### Point 1: processDocument Entry
**Line 117**
```
[PROCESS] Starting ingestion for document {documentId}
```
✅ **IF YOU SEE THIS**: Text extraction, chunking phases will execute

---

### Point 2: BEFORE Embedding Phase
**Line 262** (NEW CRITICAL LOG ADDED)
```
⚠️  [CRITICAL] About to call processEmbeddingsInBatches()
⚠️  [CRITICAL] documentId: {id}
⚠️  [CRITICAL] chunks.length: {count}
```
✅ **MUST SEE THIS**: If chunks.length > 0, embedded generation should start

---

### Point 3: ENTERING processEmbeddingsInBatches
**Line 371** (NEW CRITICAL LOG ADDED)
```
🔴🔴🔴 [CRITICAL] ENTERED processEmbeddingsInBatches() 🔴🔴🔴
```
✅ **MUST SEE THIS**: Function is actually called

---

### Point 4: FOR LOOP Execution Check
**Line 377** (NEW CRITICAL LOG ADDED)
```
🔴 [CRITICAL] FOR LOOP CHECK: chunks.length={count}, EMBEDDING_BATCH_SIZE={size}
🔴 [CRITICAL] FOR LOOP will iterate: {numBatches} times
```
✅ **IF chunks.length=0**: FOR loop never executes → embeddings never generated
❌ **IF chunks.length>0**: FOR loop should iterate

---

### Point 5: Inside FOR Loop
**Line 381** (NEW CRITICAL LOG ADDED)
```
🔴 [CRITICAL] INSIDE FOR LOOP at iteration i={i}
```
✅ **SEE THIS**: Confirms FOR loop is executing

---

### Point 6: About to Call Edge Function
**Line 383** (NEW CRITICAL LOG ADDED)
```
🔴 [CRITICAL] About to call generateEmbeddingBatch with {count} texts
```
✅ **MUST SEE THIS**: Edge Function call is imminent

---

### Point 7: Edge Function Logging
**Lines 310-315 in generateEmbeddingBatch**
```
[EMBEDDING:BATCH] Calling supabase.functions.invoke() ...
```
✅ **MUST SEE THIS**: The actual invoke() call

---

## Diagnostic Decision Tree

Based on which logs appear, you can diagnose the issue:

```
Do you see "[PROCESS] Starting ingestion for document"?
├─ NO
│  └─ Pipeline not started
│     → Check if runKnowledgeIngestion is called
│     → Check if document was claimed (claimDocument failed?)
│     → Check for errors in processDocument try-catch
│
└─ YES
   Do you see "⚠️  [CRITICAL] About to call processEmbeddingsInBatches()"?
   ├─ NO
   │  └─ Error occurred before embedding phase
   │     → Check logs for errors in extraction/chunking
   │     → Check processDocument catch block (Line 266)
   │
   └─ YES
      Do you see "🔴🔴🔴 [CRITICAL] ENTERED processEmbeddingsInBatches()"?
      ├─ NO
      │  └─ Function not reached
      │     → Check for errors in processChunks call
      │     → Check for async exception
      │
      └─ YES
         Do you see "🔴 [CRITICAL] FOR LOOP CHECK: chunks.length"?
         ├─ chunks.length=0
         │  └─ ❌ CRITICAL ISSUE: Chunks created but empty array passed!
         │     → Check chunkSmart() return value
         │     → Check if chunks are lost between chunking and embedding
         │
         └─ chunks.length>0
            Do you see "🔴 [CRITICAL] INSIDE FOR LOOP at iteration i=0"?
            ├─ NO
            │  └─ FOR loop condition false
            │     → chunks.length > 0 but loop doesn't run
            │     → Check EMBEDDING_BATCH_SIZE value
            │
            └─ YES
               Do you see "🔴 [CRITICAL] About to call generateEmbeddingBatch"?
               ├─ NO
               │  └─ Error between loop start and function call
               │     → Check ensureStillProcessing() (Line 373)
               │     → Check batch/texts preparation (Lines 375-376)
               │
               └─ YES
                  Do you see "[EMBEDDING:BATCH] Calling supabase.functions.invoke()"?
                  ├─ NO
                  │  └─ Error in generateEmbeddingBatch before invoke
                  │     → Check auth token availability (Line 297-299)
                  │     → Check Supabase client initialization
                  │
                  └─ YES
                     ✅ INVOKE CALLED
                     → Check response logs at Lines 323-345
                     → Check for Edge Function errors (Lines 334-339)
                     → Check response format (Lines 347-351)
```

---

## Summary of Execution Path

**File**: `src/services/knowledge/knowledgeStepRunner.service.ts`

| Step | Line | Function | Status |
|------|------|----------|--------|
| 1 | 31-53 | `runKnowledgeIngestion()` | Entry point |
| 2 | 36 | Check if document claimed | `if (!claimed) return` |
| 3 | 43 | Call processDocument | Main pipeline |
| 4 | 117-118 | Start processing log | First confirmation |
| 5 | 130-227 | Extract text (if needed) | Step 0 |
| 6 | 230-232 | Validate content | Step 1 |
| 7 | 237-252 | Chunk document | Step 2 |
| 8 | 260-264 | Call embedding phase | 🟢 Step 3 starts |
| 9 | 371 | Enter processEmbeddingsInBatches | 🟢 Function entry |
| 10 | 377 | Check chunks.length | 🟢 FOR loop condition |
| 11 | 381 | Enter FOR loop | 🟢 Batch processing |
| 12 | 390 | Call generateEmbeddingBatch | 🟢 Embedding function |
| 13 | 311 | Call supabase.functions.invoke | 🟢 EDGE FUNCTION CALL |

---

## Next Steps

1. **Upload a test document** and watch the logs
2. **Check which CRITICAL logs appear**
3. **Use the decision tree above** to pinpoint the failure point
4. **Report findings** with the last critical log message seen

---

## Expected Behavior

After all fixes, you should see this sequence:
```
[PROCESS] Starting ingestion for document 12345
[INGESTION] generating embeddings
⚠️  [CRITICAL] About to call processEmbeddingsInBatches()
🔴🔴🔴 [CRITICAL] ENTERED processEmbeddingsInBatches()
🔴 [CRITICAL] FOR LOOP CHECK: chunks.length=45
🔴 [CRITICAL] INSIDE FOR LOOP at iteration i=0
🔴 [CRITICAL] About to call generateEmbeddingBatch with 10 texts
[EMBEDDING:BATCH] ========== STARTING BATCH EMBEDDING GENERATION ==========
[EMBEDDING:BATCH] Calling supabase.functions.invoke() ...
[EMBEDDING:BATCH] Invoke returned. Error present: NO
[EMBEDDING:BATCH] Edge Function returned successfully
[EMBEDDING] batch 1 received 10 embeddings from OpenAI
SUPABASE INSERT TABLE: knowledge_chunks
[PROCESS] Ingestion complete for document 12345
```

If you don't see this, the last log message will tell you exactly where the pipeline breaks.
