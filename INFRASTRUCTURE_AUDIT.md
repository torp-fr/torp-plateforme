# DEEP INFRASTRUCTURE AUDIT - TORP RAG PLATFORM
**Status:** Factual Analysis from Codebase Only
**Date:** February 27, 2026

---

## 1️⃣ FRAMEWORK DETECTION

### ✅ CONFIRMED: Vite + React

**Evidence:**
- `package.json` type: `"module"` ✓
- Build script: `"vite build"` ✓
- Config file: `/vite.config.ts` exists ✓
- React dependency: `@vitejs/plugin-react-swc@^3.11.0` ✓

**Build Configuration:**
```typescript
// vite.config.ts
export default defineConfig(({ mode }) => ({
  server: { host: "::", port: 8080 },
  plugins: [react(), componentTagger()],
  resolve: { alias: { "@": path.resolve(__dirname, "./src") } },
  build: { chunkSizeWarningLimit: 5000 },
  base: '/',
}));
```

**NOT Next.js** - No next.config.js found

---

## 2️⃣ SUPABASE / PGVECTOR USAGE

### ✅ CONFIRMED: pgvector IS being used

**Vector Extension Enabled:**
```sql
-- File: supabase/migrations/001_init_schema.sql (line 1)
CREATE EXTENSION IF NOT EXISTS vector;

-- File: supabase/migrations/060_knowledge_documents.sql
CREATE EXTENSION IF NOT EXISTS vector;

-- File: supabase/migrations/20260216000000_phase29_knowledge_ingestion.sql
CREATE EXTENSION IF NOT EXISTS vector;
```

**Vector Columns in Database:**
1. **client_enriched_data** table:
   ```sql
   embedding vector(1536)  -- OpenAI embedding
   CREATE INDEX idx_enriched_embedding ON client_enriched_data USING ivfflat (embedding vector_cosine_ops);
   ```

2. **rag_context_cache** table:
   ```sql
   embedding vector(1536)
   CREATE INDEX idx_rag_embedding ON rag_context_cache USING ivfflat (embedding vector_cosine_ops);
   ```

3. **knowledge_vectors** table:
   ```sql
   embedding vector(1536)
   CREATE INDEX idx_vectors_embedding ON knowledge_vectors USING ivfflat (embedding vector_cosine_ops);
   ```

4. **knowledge_embeddings** table:
   ```sql
   embedding vector(1536)
   CREATE INDEX idx_knowledge_embeddings_vector ON knowledge_embeddings
     USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
   ```

**Vector Index Strategy:** ✓ Uses `ivfflat` (Inverted File with Flat) for cosine similarity

---

## 3️⃣ EDGE FUNCTIONS

### ✅ CONFIRMED: 18 Edge Functions Implemented

**Complete List (from `/supabase/functions/`):**

| Function Name | Purpose | Status |
|---|---|---|
| 1. `analyze-construction-photo` | Photo analysis | Implemented |
| 2. `analyze-devis` | Quote PDF analysis | Implemented |
| 3. `analyze-photo` | Photo analysis | Implemented |
| 4. `cleanup-company-cache` | Cache cleanup | Implemented |
| 5. `extract-pdf` | PDF text extraction | Implemented |
| 6. `generate-embedding` | Vector embeddings | **Calls OpenAI** ✓ |
| 7. `ingest-document` | Document ingestion | Implemented |
| 8. `ingest-document-standalone` | Alternative ingestion | Implemented |
| 9. `llm-completion` | LLM completion | Implemented |
| 10. `pappers-proxy` | Company API proxy | Implemented |
| 11. `rag-query` | RAG similarity search | **Calls Claude** ✓ |
| 12. `recognize-material` | Material recognition | Implemented |
| 13. `refresh-company-cache` | Cache refresh | Implemented |
| 14. `scrape-enterprise` | Enterprise scraping | Implemented |
| 15. `scrape-prices` | Price scraping | Implemented |
| 16. `scrape-regulations` | Regulation scraping | Implemented |
| 17. `test-company-search` | Testing | Testing only |
| 18. `webhook-n8n` | N8N webhook | Implemented |

### Edge Functions Calling LLM APIs:

**generate-embedding/index.ts (PRODUCTION)**
```typescript
const OPENAI_KEY = Deno.env.get("OPENAI_API_KEY");  // ← Server-side only
const response = await fetch("https://api.openai.com/v1/embeddings", {
  method: "POST",
  headers: { "Authorization": `Bearer ${OPENAI_KEY}` },
  body: JSON.stringify({
    model: model || "text-embedding-3-small",
    input: text,
  }),
});
```
**Status:** ✅ Server-side only (NOT exposed to frontend)

**rag-query/index.ts (PRODUCTION)**
```typescript
const claudeApiKey = Deno.env.get('CLAUDE_API_KEY');  // ← Server-side only
// Uses shared rag-orchestrator.ts for Claude calls
```
**Status:** ✅ Server-side only (NOT exposed to frontend)

---

## 4️⃣ OPENAI / ANTHROPIC USAGE

### API Key Exposure Analysis

**Frontend - EXPOSED KEYS:**
```typescript
// File: src/config/env.ts (lines 153-157)
ai: {
  openai: getEnv('VITE_OPENAI_API_KEY') ? {
    apiKey: getEnv('VITE_OPENAI_API_KEY'),  // ❌ EXPOSED TO FRONTEND
  } : undefined,
  anthropic: getEnv('VITE_ANTHROPIC_API_KEY') ? {
    apiKey: getEnv('VITE_ANTHROPIC_API_KEY'),  // ❌ EXPOSED TO FRONTEND
  } : undefined,
}
```

**Frontend Direct API Calls:**
```typescript
// File: src/services/enrichmentService.ts (line 24)
const apiKey = import.meta.env.VITE_OPENAI_API_KEY;

// File: src/services/enrichmentService.ts (lines ~380-400, estimated)
const response = await fetch('https://api.openai.com/v1/embeddings', {
  // Direct call to OpenAI from browser
});
```

**Backend - PROTECTED KEYS:**
- ✅ `OPENAI_API_KEY` - Used in Edge Function (server-side)
- ✅ `CLAUDE_API_KEY` - Used in Edge Function (server-side)

### Embedding Implementation Analysis

**CONFIRMED: Mock Embeddings in Frontend**
```typescript
// File: src/services/knowledge-base/RAGService.ts (lines 275-291)
private async getQueryEmbedding(text: string): Promise<number[]> {
  try {
    // Comment: "En production, utiliser Claude embeddings API"
    // Comment: "Pour MVP, simuler avec hash comme dans VectorizationService"
    const hash = this.hashString(text);
    const embedding = Array(1536)
      .fill(0)
      .map((_, i) => {
        const seed = (hash + i) % 1000;
        return (Math.sin(seed) + Math.sin(seed * 2) + Math.sin(seed * 3)) / 3;
      });
    return embedding;  // ← NOT REAL EMBEDDINGS
  } catch (error) {
    return Array(1536).fill(0);
  }
}

private hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return Math.abs(hash);
}
```

**RAG Similarity Query - Mock Embeddings:**
```typescript
// File: src/services/knowledge-base/RAGService.ts
// Query embedding uses hash-based mock
// Database chunks also use mock embeddings
// Result: Vector similarity search is DETERMINISTIC, NOT SEMANTIC
```

**Real Embedding Endpoint:** ✅ Server-side
```typescript
// supabase/functions/generate-embedding/index.ts
// Uses: OpenAI embeddings API (text-embedding-3-small)
// API Call: https://api.openai.com/v1/embeddings
```

---

## 5️⃣ AUTH ARCHITECTURE

### Session Loading Flow

**Location:** `src/context/AppContext.tsx` (React Context)

```typescript
useEffect(() => {
  // 1. Load initial user
  const loadUser = async () => {
    const currentUser = await authService.getCurrentUser();
    setUser(currentUser);
  };

  // 2. Setup auth state listener
  const setupAuthListener = () => {
    const { data } = authService.onAuthStateChange((sessionUser) => {
      setUser(sessionUser);
    });
    subscription = data?.subscription;
  };

  // Execute both
  loadUser();
  setupAuthListener();
});
```

### Single Auth Provider: ✅ YES

**Primary Provider:** Supabase Auth
- Location: `src/services/api/supabase/auth.service.ts`
- Uses: Supabase's built-in email/password auth
- Session Storage: `window.localStorage`

**Alternative Provider:** Mock Auth
- Location: `src/services/api/mock/auth.service.ts`
- Used for: Development/testing only
- Uses: `VITE_AUTH_PROVIDER` environment variable

### Multiple Subscriptions: ⚠️ YES - Two Independent Subscriptions

**Subscription #1:** Auth state changes
```typescript
// AppContext.tsx
authService.onAuthStateChange((sessionUser) => {
  setUser(sessionUser);
});
```

**Subscription #2:** Role loading
```typescript
// useUserRole.ts (line 120-145)
// Independent hook that fetches role from profiles table
// Triggered on user.id change
// Result: Two separate async operations on every auth state change
```

### Role Loading Strategy: Multiple Sources

**Priority Order:**
1. **Supabase Profiles Table** ✅
   ```typescript
   // File: src/hooks/useUserRole.ts (lines 26-50)
   const { data, error } = await supabase
     .from('profiles')
     .select('role')
     .eq('id', userId)
     .single();
   ```

2. **JWT Custom Claims** ✅ (Alternative)
   ```typescript
   // File: src/hooks/useUserRole.ts (lines 55-78)
   const { data: { user } } = await supabase.auth.getUser();
   const role = (user.user_metadata?.role || 'user') as UserRole;
   ```

3. **Hardcoded Email List** ⚠️ (Deprecated)
   ```typescript
   // File: src/hooks/useUserRole.ts (lines 84-93)
   const adminEmails = ['admin@admin.com', 'admin@torp.fr', 'super@torp.fr'];
   ```

---

## 6️⃣ DATABASE STRUCTURE EXTRACTION

### All Tables (from migrations)

**Core Auth & Profiles:**
1. `auth.users` - Supabase built-in
2. `profiles` - User profiles with role
3. `user_roles` - User role assignments

**Document Management:**
4. `devis` - Quotes/quotations (core entity)
5. `quote_uploads` - PDF uploads
6. `quote_analysis` - Analysis results
7. `ccf` - Client information forms
8. `devis_photos` - Devis photos
9. `company_documents` - Company docs

**Knowledge Base & RAG:**
10. `knowledge_base_documents` - Documents metadata
11. `knowledge_base_chunks` - Document chunks
12. `knowledge_vectors` - Vector embeddings (legacy)
13. `knowledge_embeddings` - Vector embeddings (current)
14. `knowledge_documents` - New ingestion pipeline documents
15. `rag_context_cache` - Cached RAG contexts

**Company & Enrichment:**
16. `client_enriched_data` - Enriched company data with embeddings
17. `company_data_cache` - Company search cache
18. `company_search_history` - Search history
19. `companies` - Company records

**Analytics & Audit:**
20. `analytics_events` - User analytics
21. `audit_log` - General audit log
22. `audit_trail` - Audit trail (duplicate?)
23. `api_requests_log` - API request logging
24. `external_api_calls_log` - External API calls

**Features & Configuration:**
25. `notifications` - User notifications
26. `feature_flags` - Feature flags
27. `api_rate_limits` - Rate limiting

**Other:**
28. `user_feedback` - User feedback
29. `devis_analysis_metrics` - Analysis metrics
30. `comparisons` - Comparisons
31. `pro_devis_analyses` - Professional analyses
32. `tickets` - Support tickets
33. `search_history` - Search history
34. `torp_tickets` - TORP tickets
35. `projects` - Projects

### Vector Columns & Indexes

**Vector Columns:**
- `client_enriched_data.embedding` (vector(1536))
- `rag_context_cache.embedding` (vector(1536))
- `knowledge_vectors.embedding` (vector(1536))
- `knowledge_embeddings.embedding` (vector(1536))

**Vector Indexes (ivfflat - Inverted File Flat):**
```sql
-- 4 vector indexes exist
CREATE INDEX idx_enriched_embedding ON client_enriched_data
  USING ivfflat (embedding vector_cosine_ops);

CREATE INDEX idx_rag_embedding ON rag_context_cache
  USING ivfflat (embedding vector_cosine_ops);

CREATE INDEX idx_vectors_embedding ON knowledge_vectors
  USING ivfflat (embedding vector_cosine_ops);

CREATE INDEX idx_knowledge_embeddings_vector ON knowledge_embeddings
  USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
```

**Index Strategy:** ✅ Production-ready IVFFlat with cosine similarity

### RLS Policies

**Total Count:** 170 RLS policies across all migrations

**Status:** Complex policies with multiple role types:
- `user` (default)
- `admin`
- `super_admin`
- `technicien` (technician)

---

## 7️⃣ FILE STRUCTURE SANITY CHECK

### RAG Implementations - MULTIPLE

**Count: 3 independent RAG implementations**

1. **`/src/services/ragService.ts`** (Old)
   - 430 lines
   - Legacy implementation

2. **`/src/services/knowledge-base/RAGService.ts`** (Current)
   - Main RAG service with mock embeddings
   - Handles retrieval, filtering, formatting

3. **`/src/services/knowledge/`** (Newer)
   - State machine-based ingestion
   - knowledgeStepRunner.service.ts (1321 lines before refactor)

**Result:** ⚠️ 3 implementations need consolidation

### Embedding Services - MULTIPLE

**Count: 3+ embedding implementations**

1. **`/src/services/knowledge-base/RAGService.ts`**
   - Mock hash-based embeddings

2. **`/src/services/knowledge-base/VectorizationService.ts`**
   - 9754 lines, handles vectorization

3. **`/src/services/ai/embeddings/`**
   - `/devis-proposal.embeddings.ts`
   - `/project-context.embeddings.ts`
   - Index file with orchestration

4. **`/src/services/ai/openai.service.ts`**
   - OpenAI-specific implementation

5. **`/supabase/functions/generate-embedding/index.ts`**
   - Server-side real embeddings

**Result:** ⚠️ 5+ implementations for similar functionality

### PDF Extractors - MULTIPLE

**Count: 6 PDF processing implementations**

1. **`/src/lib/pdf.ts`**
   - Low-level PDF.js initialization

2. **`/src/lib/pdfExtract.ts`**
   - Main production wrapper for text extraction

3. **`/src/services/document/smart-pdf-processor.ts`**
   - Smart processing logic

4. **`/src/services/pdf/pdf-extractor.service.ts`**
   - Another implementation

5. **`/src/utils/pdfGenerator.ts`**
   - PDF generation utility

6. **`/supabase/functions/extract-pdf/index.ts`**
   - Server-side extraction

**Result:** ⚠️ 6 implementations across client/server

### Supabase Client Instantiations - SINGLE ✅

**Count: 1 centralized Supabase client**

**Location:** `/src/lib/supabase.ts` (212 lines)

```typescript
let _supabase: ReturnType<typeof createClient<Database>> | null = null;

export function getSupabase() {
  if (!_supabase) {
    _supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
      auth: { autoRefreshToken: true, persistSession: true, ... },
    });
  }
  return _supabase;
}

export const supabase = getSupabase();
```

**Enforcement:** ✅ Architecture lock
- Comment: "ARCHITECTURE LOCKDOWN (PHASE 31.6)"
- Comment: "Do NOT create another createClient() anywhere else"
- ESLint rule blocks: `@supabase/supabase-js`
- Pre-commit hook to verify no duplicates

**Result:** ✅ Single source of truth enforced

---

## 8️⃣ MEMORY & FILE HANDLING

### PDF Processing - Entirely in Memory

**Flow:**
```typescript
// File: src/lib/pdfExtract.ts (lines 40-59)
const arrayBuffer = await file.arrayBuffer();  // ← ENTIRE FILE IN MEMORY

const pdf = await Promise.race([
  loadingTask.promise,  // Sequential loading
  timeoutPromise,
]);

// Sequential page extraction (NOT parallel)
for (let i = 1; i <= pageCount; i++) {
  const page = await pdf.getPage(i);           // Sequential
  const content = await page.getTextContent();  // Sequential
  // ...
}
```

**Issues:**
- ❌ Full file loaded to memory: `file.arrayBuffer()`
- ❌ No streaming/chunked processing
- ❌ Sequential page extraction (100 pages = 100 await calls)
- ❌ No parallel processing

**Maximum file size:** 100MB (from env.ts line 135)
- For 100MB file: ~100MB in browser heap
- Timeout: 30 seconds (from pdfExtract.ts line 27)
- Edge Function timeout: 10 seconds (Supabase default)

**Result:** ⚠️ Production risk for files >20MB

### Parallel Processing - NOT USED

**PDF extraction:** Sequential (NOT parallel)
```typescript
for (let i = 1; i <= pageCount; i++) {  // ← for-loop, not Promise.all()
  const page = await pdf.getPage(i);
}
```

**Chunk embedding:** Batch processing (lines 130-180 in knowledgeStepRunner.ts)
```typescript
async function processEmbeddingsInBatches(docId: string, chunks: string[]) {
  // Processes chunks in batches, not parallel across all
}
```

**Result:** ⚠️ Suboptimal performance on large PDFs

---

## 9️⃣ TOKEN MANAGEMENT

### Token Counting - PARTIALLY IMPLEMENTED

**Token Estimation Locations:**

1. **`/src/core/knowledge/ingestion/knowledgeChunker.service.ts`**
   - `estimateTokenCount(text: string): number`
   - Uses: Rough approximation (1 token ≈ 4 characters)

2. **`/src/utils/chunking.ts`**
   - `estimateTokenCount(text: string): number`
   - Implementation:
   ```typescript
   function estimateTokenCount(text: string): number {
     // Estimate: 1 token ≈ 4 characters
     return Math.ceil(text.length / 4);
   }
   ```

3. **`/src/services/knowledge-base/VectorizationService.ts`**
   - `estimateTokens(text: string): number`

4. **`/src/services/knowledge/knowledgeStepRunner.service.ts`**
   - Token count: `Math.ceil(r.chunk.length / 4)`

### Context Size Control

**Configuration NOT found:**
- ❌ No max context size limit
- ❌ No token counting before API call
- ❌ No graceful degradation if context > model limit
- ❌ No chunk priority ordering

**Risk:** Claude API calls could exceed token limits

### Chunk Size - FIXED

**Chunk size configurations found:**

1. **Fixed-size:** 3000 characters
   ```typescript
   // knowledgeStepRunner.service.ts (line 145)
   function chunkText(text: string, size = 3000)
   ```

2. **VectorizationService:** Configurable
   - CHUNK_SIZE property (varies)

3. **Token-based:**
   - `maxTokensPerChunk` property in chunker services
   - Token count tracked: `tokenCount: number` field

**Result:** ⚠️ Mixed chunking strategies (inconsistent)

---

## 🔟 BUILD & DEPLOYMENT

### Deployment Platform: ✅ Vercel

**Config File:** `/vercel.json` (50 lines)

```json
{
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "devCommand": "npm run dev",
  "installCommand": "npm install",
  "framework": "vite",
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }],
  "headers": [
    // Security headers
    { "key": "X-Content-Type-Options", "value": "nosniff" },
    { "key": "X-Frame-Options", "value": "DENY" },
    { "key": "X-XSS-Protection", "value": "1; mode=block" },
    { "key": "Referrer-Policy", "value": "strict-origin-when-cross-origin" }
  ],
  "env": {
    "VITE_APP_NAME": "TORP",
    "VITE_APP_ENV": "production"
  }
}
```

**Security Headers:** ✅ Present
- X-Content-Type-Options: nosniff
- X-Frame-Options: DENY
- X-XSS-Protection: enabled
- Referrer-Policy: strict-origin-when-cross-origin
- Cache headers for assets: max-age=31536000, immutable

### Environment Separation: ✅ Implemented

**Configuration:** `/src/config/env.ts` (245 lines)

```typescript
export const env: EnvConfig = {
  app: {
    env: (getEnv('VITE_APP_ENV', 'development') as EnvConfig['app']['env']),
  },
  auth: {
    provider: (getEnv('VITE_AUTH_PROVIDER', 'mock') as ...), // Different per env
  },
  api: { useMock: getBoolEnv('VITE_MOCK_API', true) },
  // ... more config
};

// Production validation (line 241)
if (env.app.env === 'production') {
  validateEnv();
}
```

**Environment Examples:**

Production (`.env.production.example`):
```env
VITE_APP_ENV=production
VITE_AUTH_PROVIDER=supabase
VITE_MOCK_API=false
VITE_DEBUG_MODE=false
```

Development (`.env`):
```env
VITE_APP_ENV=development
VITE_AUTH_PROVIDER=mock
VITE_MOCK_API=true
VITE_DEBUG_MODE=true
```

**Result:** ✅ Proper environment separation

### Build Configuration

**Vite Config:** `/vite.config.ts` (28 lines)
- Chunk size warning: 5000 KB
- Port: 8080
- Base path: '/'
- React plugin: SWC compiler
- Component tagger in dev mode

**Build Validation:** ✅ Yes
```typescript
// src/config/env.ts
if (env.app.env === 'production' && env.api.useMock === true) {
  throw new Error('Mock data forbidden in production');
}
```

---

## SUMMARY TABLE

| Question | Answer | Status | Evidence |
|----------|--------|--------|----------|
| **Framework** | Vite + React | ✅ Confirmed | vite.config.ts, package.json |
| **pgvector** | Yes | ✅ Confirmed | CREATE EXTENSION vector in 3 migrations |
| **Vector Indexes** | Yes (IVFFlat) | ✅ Confirmed | 4 vector indexes with cosine_ops |
| **Edge Functions** | 18 functions | ✅ Confirmed | /supabase/functions/ directory |
| **OpenAI API Calls** | Server-side ✅ + Frontend ❌ | ⚠️ Exposed | generate-embedding (server) + enrichmentService (frontend) |
| **Embeddings Mock** | Yes in frontend | ✅ Confirmed | Hash-based in RAGService.ts |
| **Embeddings Real** | Yes on server | ✅ Confirmed | OpenAI API in Edge Function |
| **Auth Provider** | Single (Supabase) | ✅ Confirmed | supabase/auth.service.ts |
| **Role Sources** | Profiles + JWT + Email | ✅ Confirmed | useUserRole.ts has 3 sources |
| **Multiple Subscriptions** | Yes (2) | ⚠️ Risk | AppContext + useUserRole hook |
| **RAG Implementations** | 3 versions | ⚠️ Duplication | ragService, RAGService, knowledge/ |
| **Embedding Services** | 5+ | ⚠️ Duplication | Multiple embedding implementations |
| **PDF Extractors** | 6 | ⚠️ Duplication | lib/, services/pdf/, supabase/functions/ |
| **Supabase Clients** | 1 centralized | ✅ Enforced | lib/supabase.ts with lockdown |
| **PDF Memory Handling** | Entirely in memory | ⚠️ Risk | arrayBuffer() in pdfExtract.ts |
| **Parallel Processing** | No | ❌ Missing | Sequential for-loop in PDF extraction |
| **Token Counting** | Partial (estimate only) | ⚠️ Incomplete | estimateTokenCount (1 token = 4 chars) |
| **Context Size Limit** | No | ❌ Missing | No max limit found |
| **Deployment** | Vercel | ✅ Configured | vercel.json present |
| **Security Headers** | Present | ✅ Configured | X-Frame-Options, CSP headers |
| **Environment Separation** | Yes | ✅ Implemented | Validated in env.ts |

---

## CRITICAL FINDINGS

### 🔴 SECURITY ISSUES
1. **OpenAI API key exposed in frontend** - `VITE_OPENAI_API_KEY` in bundle
2. **Anthropic API key exposed in frontend** - `VITE_ANTHROPIC_API_KEY` in bundle

### 🟠 ARCHITECTURE ISSUES
1. **3 RAG implementations** - Need consolidation
2. **5+ embedding services** - Need consolidation
3. **6 PDF extractors** - Need consolidation
4. **2 independent auth subscriptions** - Race condition risk

### 🟡 PERFORMANCE ISSUES
1. **Full PDFs in memory** - 100MB files cause memory pressure
2. **Sequential page extraction** - No parallel processing
3. **Mock embeddings in frontend** - RAG ineffective (hash-based)
4. **No token counting before API calls** - Risk of exceeding model limits

---

## DEPLOYMENT-READY STATUS

| Component | Status | Notes |
|-----------|--------|-------|
| Framework | ✅ Ready | Vite production build optimized |
| Database | ✅ Ready | Vector indexes present, RLS configured |
| Auth | ⚠️ Caution | Multiple subscriptions may cause race conditions |
| RAG | ❌ Not Ready | Mock embeddings make retrieval ineffective |
| File Handling | ⚠️ Risky | Memory issues with large PDFs |
| Security | ⚠️ Issue | Frontend API keys exposed |
| Deployment | ✅ Ready | Vercel config correct, env separation working |

