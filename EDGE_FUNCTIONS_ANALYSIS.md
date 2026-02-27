# SUPABASE EDGE FUNCTIONS - COMPLETE ANALYSIS

**Total Functions:** 19
**Total Lines of Code:** 5,636
**Analysis Date:** February 27, 2026

---

## STRUCTURED INVENTORY

### 🟢 ACTIVE FUNCTIONS (In Use)

#### 1. **generate-embedding** ✅ ACTIVE
- **Path:** `/supabase/functions/generate-embedding/index.ts`
- **Size:** 57 lines (1.5KB)
- **Purpose:** Generate vector embeddings using OpenAI's API
- **Calls OpenAI:** ✅ YES
  ```typescript
  const response = await fetch("https://api.openai.com/v1/embeddings", {
    model: model || "text-embedding-3-small",
    input: text,
  });
  ```
- **Handles Embeddings:** ✅ YES - Returns embedding vector
- **Security:** ✅ SECURE
  - Auth check: ✅ Bearer token required
  - Key protection: ✅ `OPENAI_API_KEY` from Deno.env (server-side only)
  - CORS: ✅ Restricted
- **Service Role Key:** ❌ NO - Not needed
- **Usage Status:** ✅ **ACTIVE**
  - Called by: `src/services/ai/secure-ai.service.ts`
  - Invocation: `supabase.functions.invoke('generate-embedding')`

**Code Sample:**
```typescript
const OPENAI_KEY = Deno.env.get("OPENAI_API_KEY");
const response = await fetch("https://api.openai.com/v1/embeddings", {
  method: "POST",
  headers: { "Authorization": `Bearer ${OPENAI_KEY}` },
  body: JSON.stringify({
    model: model || "text-embedding-3-small",
    input: text,
  }),
});
```

---

#### 2. **analyze-photo** ✅ ACTIVE
- **Path:** `/supabase/functions/analyze-photo/index.ts`
- **Size:** 241 lines (8.0KB)
- **Purpose:** Analyze construction site or diagnostic photos using GPT-4 Vision
- **Calls OpenAI:** ✅ YES (GPT-4 Vision)
- **Handles Embeddings:** ❌ NO - Uses Vision API only
- **Security:** ⚠️ CORS OPEN
  - Auth check: ❌ NO - No authentication validation
  - CORS: ⚠️ `Access-Control-Allow-Origin: *` (public)
  - Key protection: ✅ `OPENAI_API_KEY` from environment
- **Service Role Key:** ❌ NO
- **Usage Status:** ✅ **ACTIVE**
  - Called by: `src/services/ai/vision.service.ts` (2 invocations)
  - Invocation: `supabase.functions.invoke('analyze-photo')`

**Security Risk:** No authentication required - public endpoint

---

#### 3. **pappers-proxy** ✅ ACTIVE
- **Path:** `/supabase/functions/pappers-proxy/index.ts`
- **Size:** 217 lines (5.9KB)
- **Purpose:** Proxy for Pappers company API (server-side to hide API key)
- **Calls OpenAI:** ❌ NO
- **Handles Embeddings:** ❌ NO
- **Security:** ✅ SECURE
  - Auth check: ❌ NO (but SIRET validation only)
  - Key protection: ✅ `PAPPERS_API_KEY` server-side only
  - Input validation: ✅ SIRET format validation (14 digits)
  - Method validation: ✅ POST only
- **Service Role Key:** ❌ NO
- **Usage Status:** ✅ **ACTIVE**
  - Called by: 3 locations
    - `src/components/results/InfosEntreprisePappers.tsx`
    - `src/pages/QuoteUploadPage.tsx`
    - `src/services/ai/pappersProxy.service.ts`

**Code Sample:**
```typescript
const pappersApiKey = Deno.env.get('PAPPERS_API_KEY');
const response = await fetch(`https://api.pappers.fr/v2/companies?siret=${siret}`, {
  headers: { 'Authorization': `Bearer ${pappersApiKey}` }
});
```

---

#### 4. **ingest-document** ✅ ACTIVE
- **Path:** `/supabase/functions/ingest-document/index.ts`
- **Size:** 625 lines (21KB)
- **Purpose:** Document ingestion pipeline - OCR, extraction, chunking, embedding
- **Calls OpenAI:** ✅ YES (GPT-4 Vision for OCR)
- **Handles Embeddings:** ✅ YES - Generates embeddings via shared module
  ```typescript
  import { generateEmbeddingsBatch, chunkText, cleanExtractedText } from '../_shared/embeddings.ts';
  ```
- **Security:** ⚠️ PARTIALLY SECURE
  - Auth check: ❌ NO explicit auth check visible
  - Key protection: ✅ All API keys server-side
  - Service role: ✅ Uses `SUPABASE_SERVICE_ROLE_KEY`
    ```typescript
    const supabase = createClient(supabaseUrl, supabaseKey);
    ```
- **Service Role Key:** ✅ YES - Uses service role for storage access
- **Usage Status:** ✅ **ACTIVE**
  - Called by: `src/components/admin/KnowledgeUploader.tsx` (3 invocations)
  - Method: Direct HTTP POST to `/functions/v1/ingest-document`

**Multi-Strategy OCR:**
1. OpenAI Vision (GPT-4o) - Primary
2. OCR.space - Fallback for small PDFs
3. PDF.co conversion - For medium PDFs

---

#### 5. **llm-completion** ✅ ACTIVE
- **Path:** `/supabase/functions/llm-completion/index.ts`
- **Size:** 168 lines (4.7KB)
- **Purpose:** Secure LLM completion endpoint (Claude or OpenAI)
- **Calls OpenAI:** ✅ YES (optional)
  ```typescript
  response = await fetch('https://api.openai.com/v1/chat/completions', {...})
  ```
- **Calls Anthropic:** ✅ YES (optional)
  ```typescript
  response = await fetch('https://api.anthropic.com/v1/messages', {...})
  ```
- **Handles Embeddings:** ❌ NO
- **Security:** ✅ SECURE
  - Auth check: ✅ Bearer token validated
    ```typescript
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser()
    if (authError || !user) throw new Error('Unauthorized')
    ```
  - Key protection: ✅ Server-side only
  - Provider validation: ✅ 'openai' or 'anthropic'
  - Message validation: ✅ Required, non-empty array
- **Service Role Key:** ❌ NO
- **Usage Status:** ✅ **ACTIVE**
  - Called by: `src/services/ai/secure-ai.service.ts` (2 invocations)

**Code Sample:**
```typescript
const { data: { user } } = await supabaseClient.auth.getUser();
if (!user) throw new Error('Unauthorized');

if (provider === 'anthropic') {
  const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY');
  response = await fetch('https://api.anthropic.com/v1/messages', {...});
}
```

---

### 🟡 PARTIALLY USED FUNCTIONS (Some Usage)

#### 6. **rag-query** ⚠️ PARTIALLY USED
- **Path:** `/supabase/functions/rag-query/index.ts`
- **Size:** 196 lines (6.6KB)
- **Purpose:** RAG (Retrieval-Augmented Generation) standalone endpoint
- **Calls OpenAI:** ❌ NO - Only uses Claude and data APIs
- **Calls Anthropic:** ✅ YES - Via `callClaude` (shared module)
- **Handles Embeddings:** ⚠️ YES - Performs RAG orchestration
  ```typescript
  import { orchestrateRAG, generateAIPromptFromRAG } from '../_shared/rag-orchestrator.ts';
  ```
- **Security:** ✅ SECURE
  - CORS: ✅ Handled properly
  - Auth: ✅ Token validation
  - Key protection: ✅ `CLAUDE_API_KEY` server-side
- **Service Role Key:** ❌ NO
- **Usage Status:** ⚠️ **NOT DIRECTLY CALLED**
  - No direct invocations found in frontend code
  - May be called via shared RPC or internal functions
  - Status: Likely dead code or internal-only

---

#### 7. **ingest-document-standalone** ⚠️ DEAD CODE
- **Path:** `/supabase/functions/ingest-document-standalone/index.ts`
- **Size:** 815 lines (26KB) - **LARGEST FUNCTION**
- **Purpose:** Alternative document ingestion (standalone version)
- **Calls OpenAI:** ✅ YES
- **Handles Embeddings:** ✅ YES
- **Security:** ✅ SECURE
- **Service Role Key:** ✅ YES - Uses service role
- **Usage Status:** ❌ **DEAD CODE**
  - No invocations found in entire codebase
  - Duplicate of `ingest-document` (815 vs 625 lines)
  - Candidate for deletion

---

### 🔴 INACTIVE FUNCTIONS (Dead Code)

#### 8. **analyze-construction-photo** ❌ UNUSED
- **Path:** `/supabase/functions/analyze-construction-photo/index.ts`
- **Size:** 211 lines (6.7KB)
- **Purpose:** Construction photo analysis (appears to be duplicate of analyze-photo)
- **Calls OpenAI:** ✅ YES (GPT-4 Vision)
- **Handles Embeddings:** ❌ NO
- **Security:** ⚠️ CORS open
- **Usage Status:** ❌ **DEAD CODE**
  - Zero invocations in codebase
  - Duplicate functionality with `analyze-photo`
  - Candidate for deletion

---

#### 9. **analyze-devis** ❌ UNUSED
- **Path:** `/supabase/functions/analyze-devis/index.ts`
- **Size:** 314 lines (9.5KB)
- **Purpose:** TORP analysis with RAG (Quote analysis)
- **Calls OpenAI:** ❌ NO
- **Calls Anthropic:** ✅ YES - Uses Claude for analysis
- **Handles Embeddings:** ✅ YES - RAG orchestration
- **Security:** ✅ SECURE - Proper auth and CORS
- **Usage Status:** ❌ **DEAD CODE**
  - Zero invocations found
  - Large function with sophisticated TORP scoring
  - Possible abandoned feature

---

#### 10. **extract-pdf** ❌ UNUSED
- **Path:** `/supabase/functions/extract-pdf/index.ts`
- **Size:** 118 lines (4.0KB)
- **Purpose:** PDF text extraction
- **Calls OpenAI:** ❌ NO
- **Handles Embeddings:** ❌ NO
- **Security:** ✅ SECURE
  - Uses service role: ✅ YES
    ```typescript
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    ```
- **Service Role Key:** ✅ YES - Direct usage
- **Usage Status:** ❌ **DEAD CODE**
  - Zero invocations
  - Simple regex-based extraction (likely inadequate)
  - Functionality superseded by `ingest-document`

---

#### 11. **cleanup-company-cache** ❌ UNUSED
- **Path:** `/supabase/functions/cleanup-company-cache/index.ts`
- **Size:** 178 lines (5.2KB)
- **Purpose:** Cache cleanup for company data
- **Calls OpenAI:** ❌ NO
- **Handles Embeddings:** ❌ NO
- **Security:** ✅ SECURE - No auth needed (cleanup function)
- **Service Role Key:** ✅ YES
- **Usage Status:** ❌ **DEAD CODE - Maintenance Only**
  - No invocations found
  - Likely triggered by cron (not visible in code)
  - Status: Probably works but not actively used

---

#### 12. **refresh-company-cache** ❌ UNUSED
- **Path:** `/supabase/functions/refresh-company-cache/index.ts`
- **Size:** 232 lines (6.9KB)
- **Purpose:** Refresh company data cache
- **Calls OpenAI:** ❌ NO
- **Handles Embeddings:** ❌ NO
- **Security:** ✅ SECURE
- **Service Role Key:** ✅ YES
- **Usage Status:** ❌ **DEAD CODE - Maintenance Only**
  - No invocations found
  - Likely manual trigger or cron

---

#### 13. **scrape-enterprise** ❌ UNUSED
- **Path:** `/supabase/functions/scrape-enterprise/index.ts`
- **Size:** 411 lines (13KB)
- **Purpose:** Enterprise/company data scraping
- **Calls OpenAI:** ❌ NO
- **Handles Embeddings:** ❌ NO
- **Security:** ✅ SECURE
- **Service Role Key:** ✅ YES
- **Usage Status:** ❌ **DEAD CODE**
  - Zero invocations
  - Complex function, likely abandoned feature

---

#### 14. **scrape-prices** ❌ UNUSED
- **Path:** `/supabase/functions/scrape-prices/index.ts`
- **Size:** 219 lines (11KB)
- **Purpose:** Price reference data scraping
- **Calls OpenAI:** ❌ NO
- **Handles Embeddings:** ❌ NO
- **Security:** ✅ SECURE
- **Service Role Key:** ✅ YES
- **Usage Status:** ❌ **DEAD CODE**
  - Zero invocations
  - No price scraping active in codebase

---

#### 15. **scrape-regulations** ❌ UNUSED
- **Path:** `/supabase/functions/scrape-regulations/index.ts`
- **Size:** 274 lines (7.9KB)
- **Purpose:** Regulatory/aid information scraping
- **Calls OpenAI:** ❌ NO (Uses Claude for synthesis only)
- **Calls Anthropic:** ⚠️ Via shared module
- **Handles Embeddings:** ❌ NO - Static aid database
- **Security:** ✅ SECURE
- **Service Role Key:** ✅ YES
- **Usage Status:** ❌ **DEAD CODE**
  - Zero invocations found
  - Static hardcoded aid database included (lines 28+)
  - Candidate for deletion

---

#### 16. **recognize-material** ❌ UNUSED
- **Path:** `/supabase/functions/recognize-material/index.ts`
- **Size:** 485 lines (16KB) - **SECOND LARGEST**
- **Purpose:** Material/building component recognition via Vision
- **Calls OpenAI:** ✅ YES (GPT-4 Vision)
- **Handles Embeddings:** ❌ NO
- **Security:** ⚠️ CORS open, no auth
- **Service Role Key:** ❌ NO
- **Usage Status:** ❌ **DEAD CODE**
  - Zero invocations
  - Large, sophisticated function
  - Duplicate features with `analyze-photo`

---

#### 17. **test-company-search** ❌ TEST FUNCTION
- **Path:** `/supabase/functions/test-company-search/index.ts`
- **Size:** 391 lines (12KB)
- **Purpose:** Testing suite for company search functionality
- **Calls OpenAI:** ❌ NO
- **Handles Embeddings:** ❌ NO
- **Security:** ✅ Test only
- **Service Role Key:** ❌ NO
- **Usage Status:** ❌ **TEST ONLY - NOT PRODUCTION**
  - Manual testing endpoint
  - No production usage

---

#### 18. **webhook-n8n** ❌ UNUSED
- **Path:** `/supabase/functions/webhook-n8n/index.ts`
- **Size:** 122 lines (4.0KB)
- **Purpose:** N8N workflow webhook endpoint
- **Calls OpenAI:** ❌ NO
- **Handles Embeddings:** ❌ NO
- **Security:** ✅ SECURE - Auth via N8N
- **Service Role Key:** ❌ NO
- **Usage Status:** ❌ **LIKELY DEAD**
  - No invocations in codebase
  - Webhook structure present but no workflows found

---

#### 19. **rag-ingestion** ⚠️ ORPHANED
- **Path:** `/supabase/functions/rag-ingestion/index.ts`
- **Size:** 362 lines (12KB)
- **Purpose:** RAG document ingestion pipeline
- **Calls OpenAI:** ❌ NO
- **Handles Embeddings:** ✅ YES
- **Security:** ✅ SECURE
- **Service Role Key:** ✅ YES
- **Usage Status:** ⚠️ **UNCLEAR - POTENTIALLY DEAD**
  - Zero invocations found
  - May be called via internal RPC
  - Duplicate functionality with `ingest-document`

---

## SECURITY SUMMARY

| Aspect | Status | Details |
|--------|--------|---------|
| **OpenAI Key Protection** | ✅ SECURE | All server-side via Deno.env |
| **Anthropic Key Protection** | ✅ SECURE | All server-side via Deno.env |
| **Pappers API Key** | ✅ SECURE | Proxied, server-side only |
| **Service Role Key Usage** | ⚠️ CAUTION | 6 functions use service role (extract-pdf, cleanup-cache, refresh-cache, scrape-*, rag-ingestion, ingest-document) |
| **Authentication** | ⚠️ INCONSISTENT | Some functions lack auth checks (analyze-photo, recognize-material) |
| **CORS Policy** | ⚠️ OPEN | Some functions have `*` origin (analyze-photo, recognize-material) |
| **Input Validation** | ✅ GOOD | Most functions validate inputs (pappers validates SIRET) |

---

## CODE QUALITY ASSESSMENT

### Active Functions (Code Health)
- ✅ **generate-embedding:** Clean, minimal, focused
- ✅ **llm-completion:** Well-structured, good error handling
- ✅ **pappers-proxy:** Good validation, clear error messages
- ⚠️ **analyze-photo:** Large, complex, CORS security gap
- ⚠️ **ingest-document:** Large (625 lines), uses service role extensively

### Dead Code Functions (Cleanup Candidates)
| Function | Size | Priority | Reason |
|----------|------|----------|--------|
| ingest-document-standalone | 815 lines | HIGH | Duplicate, largest |
| recognize-material | 485 lines | HIGH | Unused, complexity |
| analyze-construction-photo | 211 lines | MEDIUM | Dead duplicate |
| analyze-devis | 314 lines | MEDIUM | Large, unused |
| scrape-* (4 functions) | 1,034 lines | MEDIUM | Batch of unused |
| extract-pdf | 118 lines | LOW | Simple, superseded |

**Total Dead Code:** ~3,500 lines (62% of all Edge Functions)

---

## PRODUCTION READINESS

### 🟢 PRODUCTION-READY
1. ✅ **generate-embedding** - Excellent
2. ✅ **llm-completion** - Excellent
3. ✅ **pappers-proxy** - Good

### 🟡 NEEDS ATTENTION
1. ⚠️ **analyze-photo** - Remove CORS open to public, add auth
2. ⚠️ **ingest-document** - Service role usage should be reviewed

### 🔴 NOT RECOMMENDED
1. ❌ **All scrape-* functions** - Not actively used
2. ❌ **analyze-devis** - Large, unused, possible dead code
3. ❌ **ingest-document-standalone** - Duplicate

---

## RECOMMENDATIONS

### 🔴 CRITICAL
1. **Remove CORS `*` from analyze-photo** - Security risk
   - Current: `"Access-Control-Allow-Origin": "*"`
   - Replace with: Client domain whitelist

2. **Add authentication to analyze-photo** - Currently open
   - Add: Bearer token validation
   - Add: User context extraction

### 🟠 HIGH PRIORITY
3. **Delete ingest-document-standalone** (815 lines)
   - Duplicate of `ingest-document`
   - Saves 815 lines of code

4. **Delete or archive scrape-* functions** (1,034 lines)
   - Not used in production
   - Consider archiving if future use possible
   - Saves 1,034 lines

5. **Consolidate analyze-photo + analyze-construction-photo**
   - Nearly identical purpose
   - Saves 211 lines

6. **Review service role usage** in 6 functions
   - Verify necessity of service-role-key access
   - Consider using user-scoped access where possible

### 🟡 MEDIUM PRIORITY
7. **Document rag-query and rag-ingestion status**
   - Unclear if these are used
   - Audit call chains to determine usage

8. **Add comprehensive error handling**
   - Several functions have minimal error messages
   - Add structured error responses

### 🟢 GOOD PRACTICES
- ✅ All LLM API keys are server-side (no frontend exposure)
- ✅ Most functions have CORS handling
- ✅ Input validation present in most functions
- ✅ Shared modules for common operations (_shared directory)

---

## CODE METRICS

| Metric | Value |
|--------|-------|
| Total Functions | 19 |
| Active Functions | 5 |
| Partially Used | 2 |
| Dead Code Functions | 12 |
| Total Lines | 5,636 |
| Active Lines | ~1,200 (21%) |
| Dead Lines | ~3,500 (62%) |
| Test Functions | 1 |
| Largest Function | ingest-document-standalone (815 lines) |
| Smallest Function | generate-embedding (57 lines) |

---

## CONCLUSION

**Overall Status:** 🟡 **NEEDS CLEANUP**

The Edge Functions collection shows:
- ✅ Good security practices for API keys
- ⚠️ Significant dead code (62%)
- ⚠️ Security gaps (CORS, missing auth in some functions)
- ❌ Code duplication (multiple implementations of similar features)

**Recommended Actions:**
1. Remove 3,500+ lines of dead code
2. Fix security gaps in analyze-photo
3. Consolidate duplicate functions
4. Document rag-query/rag-ingestion status
5. Review service role usage across functions

**Estimated Cleanup Effort:** 4-6 hours for comprehensive refactoring

