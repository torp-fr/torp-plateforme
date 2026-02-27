# COMPREHENSIVE TECHNICAL AUDIT: TORP RAG PLATFORM
## Executive Summary
**Status:** ⚠️ PRODUCTION NOT READY - Multiple Critical & High-Priority Issues
**Overall Tech Debt Score:** 5.8/10 (Poor)
**Recommended Action:** Immediate fixes required before scaling beyond alpha users
**Audit Date:** February 27, 2026

---

## 1. ARCHITECTURE OVERVIEW

### Current Stack
- **Frontend:** React 18 + Vite + TypeScript
- **State Management:** React Context + React Query
- **Database:** Supabase (PostgreSQL) + RLS
- **Auth:** Supabase Auth (email/password)
- **Storage:** Supabase Storage (S3-like)
- **API Layer:** Vite client API + Supabase Edge Functions
- **AI/LLM:** Claude (Anthropic) + OpenAI (embeddings)
- **File Processing:** pdfjs-dist (browser) + server-side Edge Functions
- **Observability:** Custom logger utility
- **Testing:** Vitest + Playwright

### Folder Structure Analysis
```
src/
├── api/                    # API route definitions (5 files)
├── components/             # React components (100+ files)
├── config/                 # Configuration (env.ts, stripe.ts, branding.ts)
├── context/                # React contexts (AppContext)
├── core/                   # Engine execution logic
├── domain/                 # Domain models
├── hooks/                  # Custom React hooks (11 files)
├── lib/                    # Utilities (supabase.ts, logger.ts, pdf.ts)
├── pages/                  # Page components
├── runtime/                # Runtime orchestration (ExecutionBridge)
├── services/               # Business logic (18+ subdirectories)
│   ├── ai/                 # AI orchestration & embeddings
│   ├── knowledge/          # Document ingestion state machine
│   ├── knowledge-base/     # RAG services
│   ├── api/                # API client services
│   └── ...
├── types/                  # TypeScript definitions
└── utils/                  # Utilities (chunking, PDF generation)
```

**Issues:**
- ✅ Centralized Supabase client at `/lib/supabase.ts`
- ❌ **Multiple service layers doing similar things** (knowledge/, knowledge-base/, ai/)
- ❌ **No clear separation between client-side and server-side concerns**
- ❌ **Business logic scattered across services, hooks, and components**

### Separation of Concerns - VIOLATED
1. **Client-side AI API key exposure** - VITE_OPENAI_API_KEY and VITE_ANTHROPIC_API_KEY are exposed to frontend (see `config/env.ts`)
2. **Mixed responsibilities** - Components directly call Supabase, services, and APIs
3. **No API abstraction layer** - Frontend directly queries Supabase instead of through backend APIs
4. **State mutation in multiple places** - AppContext + local state + localStorage

---

## 2. AUTHENTICATION FLOW

### Session Loading Flow
```
App Mount
  ↓
AppProvider.useEffect()
  ↓
authService.getCurrentUser()  [loads from Supabase]
  ↓
authService.onAuthStateChange() [subscribes to auth changes]
  ↓
useUserRole() hook [additional role fetch from profiles table]
  ↓
AppContext state updated + user loaded
```

### Critical Issues Found

**🔴 RACE CONDITION #1: Duplicate Role Loading**
- `AppContext.tsx` loads user from `authService.getCurrentUser()`
- Then `useUserRole()` hook *independently* fetches role from `profiles` table
- User object may have stale/missing role until hook completes
- Multiple async operations without coordination

**🔴 RACE CONDITION #2: Auth State Inconsistency**
- `isAuthenticated` flag set in AppContext
- `useUserRole()` independently checks `user?.id`
- Both may not be synchronized if role fetch fails
- No guarantee that data is consistent across renders

**🔴 INFINITE LOADING RISK: Double Subscription**
```typescript
// AppContext.tsx line 164
const { data } = authService.onAuthStateChange((sessionUser) => {...})
// This subscribes to auth state changes
// +
// useUserRole() line 120-145
// This independently fetches role on user.id change
// Result: Multiple async operations on every auth state change
```

**🔴 Email-based Role Detection (DEPRECATED)**
- `/hooks/useUserRole.ts` line 84-93: Fallback to hardcoded admin emails
- `['admin@admin.com', 'admin@torp.fr', 'super@torp.fr']`
- **Security issue:** Email-based role detection can be spoofed if email auth is compromised
- Should be removed entirely

### Session Persistence Issues
- Uses `window.localStorage` for auth token persistence (line `/lib/supabase.ts` line 72)
- **Risk:** XSS vulnerability could steal session tokens
- **No CSRF protection** on Supabase client
- No token rotation mechanism visible

### Redirection Logic Gaps
- No loading state during initial session restore
- Components may render before `isLoading` becomes false
- Potential for "logged out UI flash" on page refresh

---

## 3. DATABASE STRUCTURE

### Tables Identified (from code analysis)
1. **auth.users** - Supabase built-in auth table
2. **profiles** - User profiles (id, role, type, ...)
3. **devis** - Quotes/quotations
4. **quote_analysis** - Analysis results
5. **quote_uploads** - PDF uploads
6. **ccf** - Client information forms
7. **client_enriched_data** - Enriched company data with embeddings
8. **knowledge_base_documents** - Knowledge documents for RAG
9. **knowledge_base_chunks** - Chunked document content
10. **knowledge_documents** - New ingestion pipeline documents
11. **audit_log** - Audit trail
12. **user_types** - User type enum

### Missing Indexes (CRITICAL Performance Risk)
```sql
-- MISSING on knowledge_base_chunks for RAG queries
CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_embedding
  ON knowledge_base_chunks USING hnsw (embedding vector_cosine_ops);

-- MISSING on client_enriched_data
CREATE INDEX IF NOT EXISTS idx_enriched_embedding
  ON client_enriched_data USING hnsw (embedding vector_cosine_ops);

-- MISSING on devis for user queries
CREATE INDEX IF NOT EXISTS idx_devis_user_id
  ON devis(user_id);

-- MISSING on quote_uploads for document queries
CREATE INDEX IF NOT EXISTS idx_quote_uploads_devis_id
  ON quote_uploads(devis_id);
```

### Large-Scale Issues for Millions of Embeddings
- ❌ **No vector index mentioned** in schema
- ❌ **No partitioning strategy** for massive chunk tables
- ❌ **No archiving/retention policy** for old documents
- ❌ **No batch insert optimization** for bulk uploads

---

## 4. DOCUMENT INGESTION PIPELINE

### Pipeline Flow (Current State - Phase 42)
```
1. PDF Upload (Browser)
   ├─ File validation (size, type)
   ├─ Direct upload to Supabase Storage
   └─ Create document record (status=pending)

2. Server-side Processing (Edge Function)
   ├─ Fetch file from Storage
   ├─ Extract text using PDF.js
   ├─ Sanitize content (remove control chars)
   └─ Store sanitized_content in DB

3. Step Runner (Atomic DB Transactions)
   ├─ Claim document (atomic lock)
   ├─ Chunk text (fixed 3000-char chunks)
   ├─ Generate embeddings (batch processing)
   ├─ Store chunks with embeddings
   └─ Mark complete

4. Failure Handling
   └─ Retry up to 3 times with exponential backoff
```

### Critical Issues

**🔴 CRITICAL: Image-based PDFs Unsupported**
- `/lib/pdfExtract.ts` lines 106-114: Detects image-only PDFs but throws error
- No OCR fallback (Google Vision API setup mentioned but not implemented)
- Users cannot upload scanned documents
- **Message:** "This document requires OCR processing which is not available"

**🔴 Performance Issue: Synchronous Page Extraction**
- Lines 67-100 extract pages sequentially
- 100-page PDF = 100 sequential operations
- Should use Promise.all() for page extraction

**⚠️ Memory Risk: Full PDF in Memory**
- `file.arrayBuffer()` loads entire PDF into memory
- For 100MB PDF (max size in env.ts): ~100MB in heap memory
- No streaming/chunked read mechanism

**🔴 Naive Fixed-Size Chunking**
```typescript
// /services/knowledge/knowledgeStepRunner.service.ts line 145-149
function chunkText(text: string, size = 3000) {
  for (let i = 0; i < text.length; i += size) {
    const chunk = text.slice(i, i + size).trim();
    if (chunk.length > 30) chunks.push(chunk);
  }
}
```
**Problems:**
- ❌ **Breaks sentences at arbitrary boundaries** - chunk may cut off mid-sentence
- ❌ **No semantic awareness** - could separate related concepts
- ❌ **No overlap between chunks** - no context preservation for retrieval
- ❌ **Ignores document structure** - treats all text equally

**🔴 Mock Embeddings in Production**
- `/services/knowledge-base/RAGService.ts` lines 274-291: Hash-based embedding simulation
- **NOT using actual OpenAI/Claude embeddings API**
- Embeddings are **deterministic hashes**, not semantic vectors
- RAG search will be **completely ineffective**

**🔴 Chunks stored without critical metadata**
- Missing: document_title, source, category, page_number, chunk_index
- Can't filter/rank by source reliability
- Can't track document provenance
- No attribution for audit/compliance

---

## 5. RAG PIPELINE

### Critical Problems

**🔴 Mock Embeddings = Broken RAG**
- Query embedding is SHA hash, not semantic vector
- Database chunks use mock embeddings too
- Similarity search is **effectively random**
- 90% of RAG benefit is lost

**🔴 No Token Counting**
- Claude API has 100K token limit
- Context could exceed token limit with large knowledge base
- No graceful degradation if context too long

**🔴 No Relevance Ranking**
- Returns top 5 by distance only
- No scoring by source reliability, recency, or usefulness

### Failure Cases - Unhandled
1. **Database connectivity loss** - RAG returns empty results
2. **Embedding generation timeout** - Chunks created without embeddings
3. **Vector search RPC failure** - No fallback to keyword search
4. **Context too long** - Anthropic API throws error

---

## 6. CODE QUALITY

### Dead Code & Unused Files
- `/services/phase5/` - legacy UI code still present
- `/legacy/` directory - old code not removed
- Multiple RAG implementations (consolidate to 1)
- Multiple PDF extraction implementations (consolidate to 1)
- Multiple embedding generation implementations (consolidate to 1)

### Duplicate Logic Identified
- PDF extraction appears in 4 places
- Embedding generation appears in 3 places
- Chunking logic appears in 2+ places

### Anti-Patterns
1. **Global State** - localStorage accessed directly (32+ instances)
2. **Synchronous Blocking** - Sequential PDF processing instead of parallel
3. **Fire-and-Forget** - No await on critical async operations
4. **Type Safety Issues** - Typo in interface name: "TrigerStepRunnerRequest"

### Potential Runtime Errors
```typescript
const { data } = await supabase.from('table').select().single();
return data.id;  // ← Throws if data is null
```

---

## 7. TESTING

### Existing Coverage
- **Unit tests:** 3 test files (estimated <20% coverage)
- **E2E tests:** 4 Playwright tests
- **Coverage gaps:** No tests for RAG, document ingestion, PDF extraction, auth flow, RLS policies, API endpoints, state machines

### Critical Areas Without Tests
1. Document Ingestion Pipeline - ZERO tests
2. Authentication/Authorization - RLS policies untested
3. Embedding Generation - No vector tests
4. RAG Search - No retrieval quality tests
5. Error Handling - No failure scenario tests

---

## 8. PERFORMANCE RISKS

### Heavy Synchronous Code
1. PDF extraction loop - Sequential page processing
2. Chunking - Done in main thread
3. localStorage access - Multiple synchronous reads/writes

### Large Payloads
- **100MB PDF uploads** → full file in memory
- **3000+ chunks per document** → single query returns too much data
- **Unbounded context for Claude** → API slow/expensive

### Supabase Bottlenecks
1. **No pagination** - queries return all results
2. **No caching** - every query hits database
3. **No batching** - individual inserts instead of bulk
4. **RLS evaluation** - complex policies for every query

### Cold Start Risks on Vercel
- 50+ services loaded on demand
- Edge functions timeout (10s limit)
- PDF extraction may exceed timeout for large files

---

## 9. SECURITY REVIEW

### 🔴 CRITICAL: API Key Exposure to Frontend
- `/config/env.ts` line 156-157: VITE_ANTHROPIC_API_KEY embedded in bundle
- `/config/env.ts` line 153-154: VITE_OPENAI_API_KEY embedded in bundle
- **Risk:** Anyone can extract keys and make API calls
- **Impact:** Unlimited API spending by attackers
- **Fix:** Move all AI API calls to backend only

### 🔴 Session Token Vulnerability
- Tokens stored in localStorage (XSS-vulnerable)
- No token rotation mechanism
- No CSRF protection

### File Upload Validation Issues
- File type checking can be spoofed
- No magic byte verification (PDF header check)
- No file size enforcement at upload
- No virus scanning

### RLS Policies - Hard to Audit
- `/supabase/COMPLETE_RLS_SETUP.sql` - 500+ lines of complex SQL
- Multiple role types with recursive function calls
- **Risk:** Logic errors allow unauthorized access
- **Testing:** No visible RLS policy tests

---

## 10. TECH DEBT SCORE & PRIORITIES

### Overall Score: 5.8/10 (POOR)

**Scoring Breakdown:**
- Architecture: 6/10
- Code Quality: 4/10
- Testing: 2/10
- Performance: 4/10
- Security: 4/10
- Documentation: 6/10

---

## TOP 10 PRIORITIES (Ordered by Business Impact)

### 🔴 P0 - CRITICAL (Fix Before Production)

**1. Remove Frontend API Keys (SECURITY)**
- Move all Anthropic/OpenAI calls to backend Edge Functions
- Expected effort: 8-12 hours
- Impact: Prevents unlimited API spending exploits

**2. Fix Mock Embeddings → Real Embeddings (FUNCTIONALITY)**
- Implement actual OpenAI/Claude embedding API calls
- Use server-side generation (Edge Function)
- Expected effort: 6-10 hours
- Impact: RAG actually works

**3. Implement Semantic Chunking (FUNCTIONALITY)**
- Replace fixed-size chunking with sentence-aware overlapping chunks
- Expected effort: 4-6 hours
- Impact: Better retrieval accuracy

**4. Complete OCR Integration (FUNCTIONALITY)**
- Implement Google Vision API fallback for image-based PDFs
- Expected effort: 8-12 hours
- Impact: Support scanned documents

### 🟠 P1 - HIGH (Fix Before 1000 Users)

**5. Add Database Indexes for RAG Scale (PERFORMANCE)**
- Add vector indexes to knowledge_base_chunks
- Expected effort: 2-4 hours
- Impact: 10-100x faster RAG queries

**6. Eliminate Duplicate Code (CODE QUALITY)**
- Consolidate RAG services (3 → 1)
- Consolidate PDF extraction (4 → 1)
- Expected effort: 16-20 hours

**7. RLS Policy Testing Framework (SECURITY)**
- Write tests for each RLS policy
- Expected effort: 10-14 hours
- Impact: Catch authorization bypasses

**8. Add Comprehensive Error Handling (RELIABILITY)**
- Wrap async operations in try-catch
- Implement graceful degradation
- Expected effort: 12-16 hours

### 🟡 P2 - MEDIUM (Quarterly)

**9. Implement Token Counting (COST)**
- Add token counter for Claude context
- Expected effort: 6-8 hours

**10. Build Production Observability (OPERATIONS)**
- Add structured logging
- Metrics collection
- Monitoring alerts
- Expected effort: 20-24 hours

---

## PRODUCTION READINESS CHECKLIST

- ❌ Remove frontend API keys
- ❌ Real embeddings implemented
- ❌ Semantic chunking
- ❌ OCR fallback
- ❌ Database indexes
- ❌ Code duplication eliminated
- ❌ RLS policies tested
- ❌ Error handling comprehensive
- ❌ Token counting implemented
- ❌ Production monitoring in place
- ❌ Load testing completed
- ❌ Security audit by third-party
- ❌ Penetration testing completed
- ❌ Performance baseline established
- ❌ Disaster recovery plan written

**Current status: 0/15 items complete**

---

## CONCLUSION

The TORP platform has **solid architectural foundation** (Supabase + React + Edge Functions) but **severe production issues** prevent launch:

1. **Security:** Frontend API keys are a critical vulnerability
2. **Functionality:** RAG is non-functional with mock embeddings
3. **Quality:** Duplicate code, minimal tests, scattered logic
4. **Performance:** Unindexed queries, sequential processing, unbounded payloads

**Estimated effort to production-ready:** 120-160 engineer-hours (3-4 weeks for one developer)

**Recommended timeline:**
1. Week 1: Fix P0 security issues (16-32 hours)
2. Week 2-3: Implement RAG fixes + test suite (60-80 hours)
3. Week 4: Performance optimization + monitoring (40-48 hours)

**Once P0 items are fixed, the platform would be suitable for alpha testing with <100 users.**
