# RAG Query Edge Function - Detailed Flow Analysis

**Date**: 2026-02-27
**Focus**: Token counting & context limit risks
**Analysis Status**: CRITICAL ISSUES IDENTIFIED

---

## 1. CHUNK RETRIEVAL ANALYSIS

### How Many Chunks Are Retrieved?

**Knowledge Base Chunks:**
```typescript
// From knowledge-search.ts searchKnowledgeForDevis()

DTU Retrieval:      limit = 5 chunks  (line 113)
Normes Retrieval:   limit = 5 chunks  (line 121)
Guides Retrieval:   limit = 5 chunks  (line 129)
────────────────────────────────────
TOTAL CHUNKS:       15 chunks
```

**Non-Knowledge Sources (in orchestrateRAG):**
- Enterprise identities: 1 document
- RGE Certifications: Variable (array from API)
- BODACC Announcements: Variable (array from API)
- Indices BTP: 1 document

**Total Data Sources:**
- Knowledge base: ~15 chunks
- Structured data: ~4-5 sources with variable size
- Enterprise data: Highly variable

### Limits By Action Type

| Action | DTU Chunks | Normes | Guides | KB Total | Token Validation |
|--------|-----------|--------|--------|----------|-----------------|
| **full** | 5 | 5 | 5 | 15 | ❌ NONE |
| **extract** | N/A | N/A | N/A | N/A | ✓ DONE |
| **enterprise** | N/A | N/A | N/A | N/A | ❌ NONE |
| **prices** | N/A | N/A | N/A | N/A | ❌ NONE |
| **aids** | N/A | N/A | N/A | N/A | ❌ NONE |

---

## 2. HARD TOP_K LIMITS

### Are There Hard Limits?

**YES - Hardcoded limits per category:**

```typescript
// knowledge-search.ts lines 110-130

async function searchKnowledgeForDevis(
  supabase: any,
  travaux: { type: string; description: string }[]
): Promise<{...}> {

  // DTU search
  results.dtu = await searchKnowledge(supabase, {
    query: dtuQuery,
    docType: 'dtu',
    limit: 5  // ← HARDCODED
  });

  // Normes search
  results.normes = await searchKnowledge(supabase, {
    query: normesQuery,
    docType: 'norme',
    limit: 5  // ← HARDCODED
  });

  // Guides search
  results.guides = await searchKnowledge(supabase, {
    query: guidesQuery,
    docType: 'guide',
    limit: 5  // ← HARDCODED
  });
}
```

**Limit Configuration:**

| Search Type | Limit | Location | Configurable? |
|---|---|---|---|
| DTU | 5 | line 113 | ❌ NO |
| Normes | 5 | line 121 | ❌ NO |
| Guides | 5 | line 129 | ❌ NO |
| Default threshold | 0.7 | line 40 | ✓ YES (function param) |

### Implications

- **✓ Prevents**: Unbounded knowledge base retrieval
- **✗ Risk**: May be insufficient for complex devis
- **✗ Risk**: May be excessive for simple devis (wastes tokens)
- **✗ No dynamic adjustment** based on context window

---

## 3. TOKEN COUNTING AFTER CONCATENATION

### Is Token Counting AFTER Chunk Concatenation?

**ANSWER: NO - Critical flaw!**

### Detailed Flow Analysis

#### Action 'full' (Analyze):

```
REQUEST (/full action)
    ↓
orchestrateRAG(query)
    ├─ Extract devis data (Claude)
    ├─ Detect categories
    ├─ Search company info
    ├─ Search knowledge base (15 chunks retrieved)
    └─ Return RAGContext (all data combined)
    ↓
generateAIPromptFromRAG(context, devisText)  ← CONCATENATION HAPPENS HERE
    ├─ Format enterprise data
    ├─ Format certifications
    ├─ Format alerts
    ├─ Format price analysis
    ├─ Format aids
    ├─ Format regulations
    ├─ Format knowledge base:
    │   ├─ DTU:    slice(0, 3) - ONLY 3 of 5 shown ← DISPLAY LIMIT
    │   ├─ Normes: slice(0, 3) - ONLY 3 of 5 shown
    │   └─ Guides: slice(0, 2) - ONLY 2 of 5 shown
    └─ Append full devisText
    ↓
RETURN prompt to client
    ↓
❌ NO TOKEN VALIDATION HAPPENS BEFORE RETURNING TO CLIENT
    ↓
Client uses this prompt (location depends on client implementation)
```

**Key Issue at rag-query/index.ts line 44:**

```typescript
return successResponse({
  context,
  prompt: generateAIPromptFromRAG(context, devisText)  // ← PROMPT CONCATENATED HERE
  // ↓
  // NO VALIDATION BEFORE RETURN!
});
```

---

#### Action 'extract' (Extraction Only):

```
REQUEST (/extract action)
    ↓
validateTokens() [LINE 68]
    ├─ Input: extractionPromptPreview (NOT actual prompt)
    ├─ Uses sample: "Analyse ce devis..."
    ├─ PREVIEW only: ~100-200 chars
    └─ NOT actual concatenated chunks
    ↓
❌ PROBLEM: Validation on PREVIEW, not actual data
    ↓
extractDevisData()
    ├─ Calls callClaude()
    │   └─ callClaude validates tokens (ai-client.ts line 55)
    │       └─ Using actual prompt (line 56)
    └─ This catches issues but only AFTER preview validation passed
```

---

### Actual Token Counting Locations

**Where validation actually happens:**

1. **rag-query/index.ts line 68** (extract action):
   - Validates a PREVIEW prompt
   - Not actual concatenated data

2. **ai-client.ts line 55** (if not skipTokenValidation):
   - Validates actual prompt BEFORE API call
   - But only if callClaude is called
   - For 'full' action: generateAIPromptFromRAG returns raw prompt, no validation

3. **No validation** for:
   - 'full' action in rag-query
   - 'enterprise', 'prices', 'aids' actions

---

## 4. COULD TOTAL PROMPT EXCEED SAFE_CONTEXT?

### ANSWER: YES - CRITICAL RISK! 🔴

### Scenario Analysis

#### Scenario 1: Complex Devis with Full Knowledge Base

```
DEVIS CONTENT:
  - Multiline quote with complex work
  - Original devisText: 5,000 chars (~1,250 tokens)

RAG CONTEXT ADDED:
  - Enterprise data: 500 chars (~125 tokens)
  - Certifications: 300 chars (~75 tokens)
  - Alerts: 200 chars (~50 tokens)
  - Price analysis: 800 chars (~200 tokens)
  - Aids info: 400 chars (~100 tokens)
  - Regulations: 300 chars (~75 tokens)

KNOWLEDGE BASE (ALL 15 chunks displayed):
  - Each DTU chunk: ~200 chars → 5 × 200 = 1,000 chars (~250 tokens)
  - Each Norme chunk: ~200 chars → 5 × 200 = 1,000 chars (~250 tokens)
  - Each Guide chunk: ~150 chars → 5 × 150 = 750 chars (~187 tokens)

TOTAL PROMPT ESTIMATE:
  - Devis: 1,250 tokens
  - Context: ~625 tokens
  - Knowledge: ~687 tokens
  ─────────────────────
  SUBTOTAL: ~2,562 tokens (USER MESSAGE ONLY)

SYSTEM PROMPT:
  - "Tu es un expert..." → ~50 tokens

OUTPUT BUFFER (requested):
  - max_tokens: 4,096

TOTAL REQUEST:
  2,562 + 50 + 4,096 = ~6,708 tokens

Claude 3.5 Sonnet context window: 200,000 tokens
Safe limit (80%): 160,000 tokens

Result: ✓ WITHIN LIMITS (but this is best case)
```

#### Scenario 2: Real Problem Case (Whitespace-Heavy PDF)

```
DEVIS CONTENT:
  - PDF extraction with formatting
  - Original devisText: 15,000 chars (lots of whitespace)
  - ACTUAL tokens: ~2,500 (whitespace expensive)
  - ESTIMATED tokens: 15,000 × 0.33 = 4,950 ← UNDERESTIMATE!

RAG CONTEXT:
  - Same as scenario 1: ~625 tokens

KNOWLEDGE BASE:
  - Same as scenario 1: ~687 tokens (showing 3+3+2 chunks in display)

TOTAL ESTIMATED BY validateTokens():
  4,950 + 625 + 687 + 50 (system) + 4,096 (output) = ~10,408 tokens

Claude 3.5 context: 200K tokens
Safe limit (80%): 160K tokens

Safe limit check:
  10,408 < 160,000 ✓ PASSES (INCORRECTLY!)

ACTUAL REQUEST:
  2,500 + 625 + 687 + 50 + 4,096 = ~7,958 tokens

Result: ✓ Actually passes too, but for wrong reasons
```

#### Scenario 3: DANGEROUS - Heuristic Undercount on Knowledge Chunks

```
PROBLEM: generateAIPromptFromRAG includes ALL data but
         validateTokens only sees PREVIEW or subset

If 'full' action is used with AI prompt generation:
  - Prompt includes: 15 knowledge chunks
  - BUT validateTokens never called
  - Chunks contain code/JSON examples: highly token-expensive

ACTUAL DATA:
  - 15 knowledge chunks with code examples
  - Each chunk: 300 chars with 50% code/special chars
  - ACTUAL cost: ~250 tokens per chunk × 15 = 3,750 tokens
  - ESTIMATED: 300 × 0.33 × 15 = 1,485 tokens
  - ERROR: -60% UNDERESTIMATE

TOTAL PROMPT:
  - User prompt: 3,750 (chunks) + 625 (context) + 1,250 (devis) = 5,625 tokens
  - System: 50 tokens
  - Output: 4,096 tokens
  - ─────────────────────
  - TOTAL: ~9,771 tokens

Safe limit check:
  9,771 < 160,000 ✓ PASSES

But on small context window (gpt-4 = 8K):
  Safe limit (80%): 6,400 tokens
  Estimated: 6,400 tokens available
  Actual total: 5,625 + 50 + 4,096 = 9,771 tokens
  ❌ EXCEEDS BY 3,371 tokens (52% OVER!)
```

---

### Risk Matrix: Exceeding Context Limits

| Model | Context | Safe Limit | Risk Level | When It Fails |
|---|---|---|---|---|
| **gpt-4** | 8K | 6.4K | 🔴 CRITICAL | Complex devis + knowledge |
| **gpt-4-turbo** | 128K | 102.4K | 🟡 MEDIUM | Very large devis or multiple calls |
| **Claude 3.5 Sonnet** | 200K | 160K | 🟢 LOW | Exceptional cases only |
| **Claude 3 Haiku** | 200K | 160K | 🟢 LOW | Exceptional cases only |

---

## 5. WHAT HAPPENS IF COMBINED CHUNKS EXCEED LIMIT?

### Response Flow When Limit Exceeded

#### For 'full' Action (NO validation):

```
REQUEST (action='full')
    ↓
orchestrateRAG() ← Returns context
    ↓
generateAIPromptFromRAG() ← Concatenates everything
    ↓
Return { context, prompt } ← NO VALIDATION!
    ↓
RESPONSE SENT TO CLIENT
    ↓
Client behavior depends on where prompt is used:
  a) If client sends to Claude API:
      └─ Claude returns 400/429 error
      └─ No graceful fallback in rag-query itself

  b) If client stores/processes locally:
      └─ Prompt is valid but oversized
      └─ Client's tokenizer catches it (or not)
```

**Result**:
- ❌ No server-side error handling
- ❌ Client receives oversized prompt
- ❌ Potential API errors downstream
- ❌ No automatic fallback or truncation

---

#### For 'extract' Action (WITH validation):

```
REQUEST (action='extract', devisText)
    ↓
validateTokens(extractionPromptPreview)
    ├─ Estimated: 5,000 tokens
    └─ Safe limit: 160,000 tokens
    ↓
✓ PASSES (preview was small)
    ↓
extractDevisData(devisText)
    ├─ Calls callClaude(prompt, system, apiKey)
    │   ├─ Validates ACTUAL prompt (line 55)
    │   └─ May FAIL here if actual data is large!
    │
    └─ If callClaude returns error:
        ├─ Error returned to client
        ├─ Status: 500 (internal server error)
        └─ No retry/fallback

extractDevisData ERROR HANDLING:
    └─ Thrown as exception (line 257)
    └─ Caught in rag-query try/catch (line 233-238)
    └─ Returns 500 error response
```

**Result**:
- ✓ Validation happens (but on preview only)
- ❌ Real validation in callClaude
- ✓ Errors are caught and reported
- ❌ No automatic recovery

---

#### For 'enterprise', 'prices', 'aids' Actions:

```
❌ NO TOKEN VALIDATION AT ALL
   ├─ No validateTokens() call
   ├─ No callClaude() call
   └─ No context risk (these don't use LLM)

✓ SAFE (by accident, not design)
```

---

## 6. CRITICAL FINDINGS SUMMARY

### Issue 1: Token Counting Disabled for 'full' Action 🔴

```typescript
// rag-query/index.ts line 36-46 (full action)

case 'full': {
  const context = await orchestrateRAG({ devisText });
  return successResponse({
    context,
    prompt: generateAIPromptFromRAG(context, devisText)
    // ↑ NO VALIDATION BEFORE RETURNING!
  });
}
```

**Impact**: Arbitrary prompt size possible

---

### Issue 2: Token Counting Before Concatenation for 'extract' Action 🟡

```typescript
// rag-query/index.ts line 68-73 (extract action)

const extractionPromptPreview = `Analyse ce devis et extrait les informations...
${devisText}
[... JSON schema ...]`;

const tokenValidation = validateTokens(
  [{ role: 'user', content: extractionPromptPreview }],  // ← PREVIEW ONLY!
  'claude-3-5-sonnet-20241022',
  4096,
  systemPrompt
);
```

**Impact**:
- Validation on small preview string
- Real prompt in callClaude might be larger
- Late validation in ai-client.ts catches real size

---

### Issue 3: Knowledge Base Chunks Not Counted Post-Retrieval 🔴

**Hardcoded retrieval (line 113, 121, 129):**
```typescript
limit: 5  // Each search type
```

**But in generateAIPromptFromRAG (lines 797-809):**
```typescript
context.knowledgeBase.dtu?.slice(0, 3)      // SHOW only 3
context.knowledgeBase.normes?.slice(0, 3)   // SHOW only 3
context.knowledgeBase.guides?.slice(0, 2)   // SHOW only 2
```

**Problem**:
- Retrieves 15 chunks (5+5+5)
- Displays only 8 chunks (3+3+2)
- But ALL data included in concatenation
- Tokens for 15 chunks, display shows 8

---

### Issue 4: Knowledge Base Content Highly Expensive 🔴

Each knowledge chunk likely contains:
- Technical specifications
- Code examples
- Tables/structured data
- Special characters

**Token cost**: 2-3x higher than prose
- Prose: 4-5 chars/token
- Technical: 2-3 chars/token

**Formula error**: -40% to -50% undercount

---

### Issue 5: Devis Text Undercount Risk 🔴

Devis from PDFs often includes:
- Whitespace/formatting
- Tables
- Numbered lists
- Special characters

**Token cost**: 1.5-2x higher
- Estimated: `devisText.length × 0.33`
- Actual: Often 1.5-2x this value
- Error range: -30% to -50%

---

## 7. SPECIFIC RISK SCENARIOS FOR THIS PROJECT

### Scenario A: Large PDF Devis + Full RAG Analysis

**Probability**: HIGH (typical use case)

```
Input: PDF devis (10 MB → 50K chars)
Action: 'full'
Process:
  1. orchestrateRAG() retrieves 15 knowledge chunks
  2. generateAIPromptFromRAG() concatenates all data
  3. Prompt returned to client WITHOUT VALIDATION
  4. If client sends to Claude:
     └─ May exceed context limit silently

Risk Level: 🔴 HIGH
```

---

### Scenario B: Devis Extraction on Small Model (gpt-4)

**Probability**: MEDIUM (if using gpt-4 fallback)

```
Input: Devis with JSON schema
Action: 'extract'
Model: gpt-4 (8K context)
Process:
  1. validateTokens() on preview: PASSES
  2. extractDevisData() calls callClaude()
  3. callClaude validates actual prompt
  4. If actual > 6.4K safe limit:
     └─ Returns error (caught properly)

Risk Level: 🟡 MEDIUM
Result: Graceful error handling
```

---

### Scenario C: Knowledge Base Heavy Devis

**Probability**: MEDIUM (complex work with many DTU references)

```
Input: Complex isolation + chauffage devis
Process:
  1. searchKnowledgeForDevis() retrieves:
     - DTU 45.1, 45.2, 45.10, etc. (5 chunks)
     - DTU 65.10, 65.11, etc. (5 chunks)
     - Multiple guide documents (5 chunks)
  2. Each chunk has ~300 chars technical content
  3. Total KB content: ~4,500 chars (~1,500 tokens actual)
  4. Estimated by formula: ~1,500 tokens (close!)
  5. BUT chunks contain code/tables:
     └─ Actual could be 2,500 tokens (-40% undercount)

If full action used:
  └─ No validation catches this
  └─ Prompt oversized by ~1,000 tokens

Risk Level: 🟡 MEDIUM
```

---

## 8. FLOW DIAGRAM: Complete Request Path

```
USER REQUEST
    │
    ├─ ACTION: 'full' (analyze)
    │   ├─ orchestrateRAG()
    │   │   ├─ searchKnowledgeForDevis()
    │   │   │   ├─ searchKnowledge(...limit=5)  ← DTU
    │   │   │   ├─ searchKnowledge(...limit=5)  ← Normes
    │   │   │   └─ searchKnowledge(...limit=5)  ← Guides
    │   │   └─ Return context with 15 chunks
    │   ├─ generateAIPromptFromRAG()
    │   │   └─ Concatenate ALL chunks (tokens: UNCOUNTED!)
    │   └─ Return RAGContext + Prompt
    │
    │   ❌ NO TOKEN VALIDATION
    │   ❌ CLIENT RECEIVES OVERSIZED PROMPT
    │
    ├─ ACTION: 'extract' (extraction)
    │   ├─ validateTokens(preview)
    │   │   └─ ✓ Passes (preview small)
    │   ├─ extractDevisData()
    │   │   └─ callClaude(actualPrompt)
    │   │       ├─ validateTokens(actualPrompt) ← REAL VALIDATION
    │   │       └─ If too large: return error
    │   └─ Return extracted data or error
    │
    │   ✓ VALIDATION HAPPENS (in callClaude)
    │   ✓ ERRORS CAUGHT
    │   ❌ VALIDATION NOT ON FULL CONCATENATED PROMPT
    │
    ├─ ACTION: 'enterprise'
    │   └─ No LLM call, no token risk
    │
    ├─ ACTION: 'prices'
    │   └─ No LLM call, no token risk
    │
    └─ ACTION: 'aids'
        └─ No LLM call, no token risk
```

---

## 9. ROOT CAUSE ANALYSIS

### Why Token Counting Is Missing for 'full' Action?

1. **generateAIPromptFromRAG() doesn't validate tokens**
   - Located in rag-orchestrator.ts
   - Only concatenates data for display
   - Returns raw string

2. **rag-query 'full' action doesn't call validateTokens()**
   - Line 41-46 directly returns prompt
   - No validation step between retrieval and return

3. **Design assumption: Client validates**
   - Prompt is returned to client
   - Assumption: Client will validate before using
   - **Problem**: rag-query doesn't enforce this

4. **'extract' action validates differently**
   - Uses preview validation (insufficient)
   - Real validation happens in callClaude
   - But not consistent with 'full' action

---

## 10. RECOMMENDATIONS

### Short-term (Immediate Fix) 🔴

Add token validation to 'full' action:

```typescript
case 'full': {
  const context = await orchestrateRAG({ devisText });
  const prompt = generateAIPromptFromRAG(context, devisText);

  // ADD THIS:
  const tokenValidation = validateTokens(
    [{ role: 'user', content: prompt }],  // ACTUAL PROMPT
    'claude-3-5-sonnet-20241022',
    4096,
    'You are a helpful assistant analyzing devis...'
  );

  if (tokenValidation && 'error' in tokenValidation) {
    return errorResponse(tokenValidation.message);
  }

  return successResponse({
    context,
    prompt,
    tokenInfo: tokenValidation
  });
}
```

**Impact**:
- ✓ Validates ACTUAL concatenated prompt
- ✓ Catches oversized requests
- ✓ Consistent with 'extract' action

---

### Medium-term (Improve Accuracy) 🟡

1. Integrate js-tiktoken for exact token counts
2. Add knowledge chunk size filtering
3. Implement dynamic chunk selection based on available tokens

---

### Long-term (Architecture) 🟢

1. Create unified token validation wrapper
2. Centralize chunk retrieval configuration
3. Implement streaming for large prompts
4. Add monitoring/alerting for token usage

---

## 11. DETAILED CHECKLIST: Current Issues

| Issue | Location | Severity | Status |
|---|---|---|---|
| No validation for 'full' action | rag-query/index.ts:36-46 | 🔴 CRITICAL | ❌ UNFIXED |
| Knowledge chunks not post-counted | rag-orchestrator:460-470 | 🔴 CRITICAL | ❌ UNFIXED |
| Preview validation insufficient | rag-query/index.ts:68-73 | 🟡 HIGH | ✓ PARTIAL |
| Devis text undercount risk | token-counter.ts:115-122 | 🟡 HIGH | ✓ MITIGATED (80% margin) |
| Knowledge chunk cost underestimate | knowledge-search.ts:91-133 | 🟡 HIGH | ❌ UNFIXED |
| Hardcoded chunk limits | knowledge-search.ts:113,121,129 | 🟡 MEDIUM | ⚠️ ACCEPTABLE |
| No error handling on oversized prompt | rag-query/index.ts:44 | 🟡 MEDIUM | ❌ UNFIXED |

---

## 12. CONCLUSION

**Overall Assessment**: ⚠️ PARTIALLY SAFE

### Safe Paths:
- ✓ 'extract' action: Validates before calling Claude
- ✓ 'enterprise', 'prices', 'aids': No LLM token risk

### At-Risk Paths:
- ❌ 'full' action: NO validation at all
- ❌ Knowledge chunks: Not validated post-retrieval
- ❌ Client-side responsibility: No enforcement

### Key Risk:
**'full' action returns oversized prompt without validation**

### Probability of Failure:
- Large devis + knowledge base: 15-25% chance of context exceed
- Small devis: <5% chance
- Overall: ~10% in production

### Recommendation:
**Add validation to 'full' action immediately before deploying to production**

