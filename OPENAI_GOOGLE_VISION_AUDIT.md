# OpenAI + Google Vision Audit
> Generated 2026-03-28 — pre-PROMPT H2 baseline

---

## Summary

| Metric | Count |
|--------|-------|
| Files with OpenAI usage | 10 |
| Files with Google Vision usage | 2 |
| Integration flows | 8 |
| Cost tracking: wired | 0 / 12 |
| Caching: embedding only | 1 (LRU, in-memory, no TTL) |
| Fallback cascade | None for OpenAI, None for Google Vision |

---

## 1. OpenAI Integration Points

### 1.1 Text Completions + JSON Generation

**Flow**: `Client → openai.service → secureAI.service → Edge Function llm-completion → api.openai.com`

| File | Role | Model | Cost Tracked | Cache |
|------|------|-------|-------------|-------|
| `src/services/ai/openai.service.ts` | Gateway: `generateCompletion()`, `generateJSON()` | `gpt-4o` (default) | ❌ | ❌ |
| `src/services/ai/hybrid-ai.service.ts` | Provider selector (OpenAI ↔ Claude fallback) | `gpt-4o` / `claude-sonnet-4-20250514` | ❌ | ❌ |
| `src/services/ai/secure-ai.service.ts` | Auth + Edge Function invoker | `gpt-4o` | ❌ | ❌ |
| `supabase/functions/llm-completion/index.ts` | Edge Function — proxies to OpenAI OR Anthropic | `gpt-4o` (default) | ❌ | ❌ |

**What `llm-completion` returns:**
```json
{
  "content": "response text",
  "model": "gpt-4o",
  "usage": { "prompt_tokens": 120, "completion_tokens": 80, "total_tokens": 200 },
  "provider": "openai"
}
```
The `usage` object is returned to the caller but **never persisted** in `api_costs`.

---

### 1.2 Embeddings

**Flow**: `RAG service / knowledgeEmbedding → embedding.service → aiOrchestrator → secureAI → Edge Function generate-embedding → api.openai.com/v1/embeddings`

| File | Role | Model | Cost Tracked | Cache |
|------|------|-------|-------------|-------|
| `src/core/rag/embeddings/embedding.service.ts` | Single + batch embeddings (wraps LRU cache) | `text-embedding-3-small` | ❌ | ✅ in-memory LRU |
| `src/core/rag/embeddings/embeddingCache.service.ts` | LRU cache (1000 entries, no TTL) | — | — | ✅ (source) |
| `src/core/knowledge/ingestion/knowledgeEmbedding.service.ts` | Batch embedding for document ingestion (100/batch) | `text-embedding-3-small` | ❌ | ❌ |
| `src/services/ai/aiOrchestrator.service.ts` | Retry wrapper (max 2 retries, exponential backoff) | `text-embedding-3-small` | ❌ | ❌ |
| `supabase/functions/generate-embedding/index.ts` | Edge Function — calls OpenAI, returns `{ embeddings: number[][] }` | `text-embedding-3-small` | ❌ | ❌ |

**Embedding dimensions:**
- Database column: `knowledge_chunks.embedding_vector VECTOR(384)`
- Code constant: `EMBEDDING_DIMENSIONS = 384` (`knowledgeEmbedding.service.ts:25`)
- All requests use `dimensions: 384` parameter in Edge Function call
- Max batch: 100 inputs (hardcoded Edge Function limit; OpenAI supports 2048)

**Cost formula**: `(tokens / 1000) × $0.00002` (`text-embedding-3-small` at 384 dims)
- Average chunk: ~500 tokens → ~$0.00001 per chunk
- Large document (100 chunks): ~$0.001 per document

---

### 1.3 Photo Analysis (Vision)

**Flow**: `visionService → Edge Function analyze-photo or analyze-construction-photo → api.openai.com/v1/chat/completions`

| File | Role | Model | Cost Tracked | Cache |
|------|------|-------|-------------|-------|
| `src/services/ai/vision.service.ts` | `analyzeConstructionPhoto()`, `analyzeDiagnosticPhoto()`, `analyzePhotosBatch()` | `gpt-4o` (vision) | ❌ | ❌ |
| `supabase/functions/analyze-photo/index.ts` | General photo analysis (construction + diagnostic) | `gpt-4o` (hardcoded) | ❌ | ❌ |
| `supabase/functions/analyze-construction-photo/index.ts` | BTP site photo analysis — saves to `photo_analyses` table | `gpt-4o` (hardcoded, JSON mode) | ❌ | ❌ |

**Request format (both Edge Functions):**
```json
{
  "model": "gpt-4o",
  "messages": [
    { "role": "system", "content": "Expert prompt..." },
    { "role": "user", "content": [
      { "type": "image_url", "image_url": { "url": "https://...", "detail": "high" } },
      { "type": "text", "text": "Context message" }
    ]}
  ],
  "max_tokens": 3000,
  "temperature": 0.2
}
```

**Cost formula**: `gpt-4o` vision = ~$0.005 per image (1K tokens input + image tile)
- `detail: "high"` = multiple tiles → can reach $0.01–0.05 per image

---

## 2. Google Vision Integration Points

### 2.1 OCR (Document Text Extraction)

**Flow**: `documentExtractor → google-vision-ocr.service → Edge Function google-vision-ocr → vision.googleapis.com`

| File | Role | Feature | Cost Tracked | Cache |
|------|------|---------|-------------|-------|
| `src/services/ai/google-vision-ocr.service.ts` | Invokes Edge Function; triggers when pdfjs returns empty text | `DOCUMENT_TEXT_DETECTION` | ❌ | ❌ |
| `supabase/functions/google-vision-ocr/index.ts` | Edge Function — calls Google Vision REST API | `DOCUMENT_TEXT_DETECTION` | ❌ | ❌ |

**Google Vision API request:**
```json
{
  "requests": [{
    "image": { "content": "base64_pdf_or_image" },
    "features": [{ "type": "DOCUMENT_TEXT_DETECTION", "maxResults": 1 }],
    "imageContext": { "languageHints": ["fr", "en"] }
  }]
}
```

**Cost formula**: `DOCUMENT_TEXT_DETECTION` = $1.50 per 1000 pages
- Typical insurance PDF (3 pages) → ~$0.0045 per document

**Security note**: API key passed in URL query string (`?key=AIzaSy...`). Should be migrated to service account JSON + OAuth2.

---

## 3. Environment Variables

| Variable | Location | Used by | Present in .env.example |
|----------|----------|---------|------------------------|
| `OPENAI_API_KEY` | Supabase Edge Function secrets | `generate-embedding`, `llm-completion`, `analyze-photo`, `analyze-construction-photo` | ✅ |
| `ANTHROPIC_API_KEY` | Supabase Edge Function secrets | `llm-completion` | ✅ |
| `CLAUDE_API_KEY` | Supabase Edge Function secrets | `llm-completion` (alias) | ✅ |
| `GOOGLE_CLOUD_PROJECT_ID` | Supabase Edge Function secrets | `google-vision-ocr` | ✅ |
| `GOOGLE_CLOUD_API_KEY` | Supabase Edge Function secrets | `google-vision-ocr` | ✅ |
| `VITE_AI_PRIMARY_PROVIDER` | Frontend `.env` | `hybrid-ai.service.ts` | ✅ (`claude` default) |
| `VITE_AI_FALLBACK_ENABLED` | Frontend `.env` | `hybrid-ai.service.ts` | ✅ (`true` default) |

**VITE_ variables**: No API keys exposed via VITE_ prefix. ✅ Secure.

---

## 4. Cost Tracking — Current State

### Where `usage` data is available but not saved

| Flow | Token data available | Saved to `api_costs`? |
|------|---------------------|----------------------|
| `llm-completion` Edge Fn | ✅ `usage.input_tokens + output_tokens` in response | ❌ |
| `generate-embedding` Edge Fn | ❌ not extracted from OpenAI response | ❌ |
| `analyze-photo` Edge Fn | ❌ not extracted | ❌ |
| `analyze-construction-photo` Edge Fn | ❌ not extracted | ❌ |
| `google-vision-ocr` Edge Fn | ❌ Google Vision doesn't return token counts | ❌ |

### Where to hook `CostTracker.recordAPICall()`

| Location | API | Metrics to pass |
|----------|-----|----------------|
| `llm-completion/index.ts` (before return) | Claude / GPT-4o | `{ tokens_used: usage.input_tokens + usage.output_tokens }` |
| `generate-embedding/index.ts` (after OpenAI call) | OpenAI Embeddings | `{ tokens_used: openaiResp.usage.total_tokens }` |
| `analyze-photo/index.ts` (before return) | GPT-4o Vision | `{ requests_count: 1, tokens_used: usage?.total_tokens }` |
| `analyze-construction-photo/index.ts` (before return) | GPT-4o Vision | `{ requests_count: 1 }` |
| `google-vision-ocr.service.ts` (after Edge Fn returns) | Google Vision | `{ images_processed: 1, requests_count: 1 }` |

**Pricing config to seed** (add to `api_pricing_config` table):
```sql
INSERT INTO api_pricing_config VALUES
  ('gpt-4o-completion',     NULL, NULL, 0.005,   'USD'),  -- $5/1M tokens avg
  ('gpt-4o-vision',         NULL, 0.01, NULL,    'USD'),  -- $10/1k images (est.)
  ('text-embedding-3-small', 0.00002, NULL, NULL, 'USD'), -- $0.02/1M tokens
  ('google-vision-ocr',     NULL, 1.50/1000, NULL, 'USD') -- $1.50/1k requests
ON CONFLICT DO NOTHING;
```

---

## 5. Caching — Current State

| API / Flow | Cached? | Cache Type | TTL | Scope |
|-----------|---------|-----------|-----|-------|
| Embeddings (RAG queries) | ✅ | In-memory LRU (1000 entries) | None (process lifetime) | Per Node process |
| Embeddings (document ingestion) | ❌ | — | — | — |
| LLM completions | ❌ | — | — | — |
| Photo analysis results | ❌ | — | — | — |
| OCR results (Google Vision) | ❌ | — | — | — |

**Cache hit log pattern**: `"⚡ Cache hit for query:"` in `embedding.service.ts`

**Opportunities for PROMPT H2**:

| Flow | Cache key | Recommended TTL | Storage |
|------|-----------|----------------|---------|
| OCR results | `hash(imageBuffer)` | 30 days | `insurance_documents.parsed_text` |
| Photo analysis | `hash(imageUrl)` | 7 days | `photo_analyses` table (already exists) |
| LLM completions | `hash(prompt + model)` | 1 hour | In-memory LRU |
| SIRET enrichment | `siret` | 24 hours | `client_enriched_data` (already exists) |

---

## 6. Fallback Cascade — Current State

| API | Has fallback? | Notes |
|-----|--------------|-------|
| OpenAI completions | ✅ Partial | `hybrid-ai.service` switches to Claude if OpenAI fails |
| OpenAI embeddings | ❌ | Embeddings locked to OpenAI — no fallback if down |
| OpenAI Vision (gpt-4o) | ❌ | No fallback; analysis fails silently |
| Google Vision OCR | ❌ | If Edge Function fails, document extraction fails |

**Critical gap**: If `api.openai.com` is down, document ingestion (embedding step) fails completely. No retry circuit at the pipeline level.

---

## 7. Integration with PROMPT G Monitoring

| API | In `APIHealthMonitor`? | In `CostTracker`? | In `FallbackCascade`? |
|-----|----------------------|-----------------|----------------------|
| OpenAI (completions) | ❌ | ❌ | ❌ |
| OpenAI (embeddings) | ❌ | ❌ | ❌ |
| OpenAI (Vision gpt-4o) | ❌ | ❌ | ❌ |
| Google Vision OCR | ❌ | ❌ | ❌ |
| Anthropic (Claude) | ❌ | ❌ | ❌ |

All PROMPT G infrastructure (APIHealthMonitor, CostTracker, FallbackCascade) is fully implemented but **not yet wired** to any live API calls.

---

## 8. Architecture Map — All 8 Integration Flows

```
Flow 1 — Text Completion
  Client
    → openai.service.generateCompletion() / claudeService.generateCompletion()
    → hybrid-ai.service (provider selector + fallback)
    → secure-ai.service (auth)
    → Edge Function: llm-completion
    → api.openai.com/v1/chat/completions  OR  api.anthropic.com/v1/messages
    ← usage object (not saved)

Flow 2 — JSON Generation
  (identical to Flow 1, adds response_format: json_object)

Flow 3 — Embedding (Single, RAG queries)
  RAG pipeline
    → embedding.service.generateEmbedding()   [checks LRU cache first]
    → aiOrchestrator.generateEmbedding()       [retry wrapper]
    → secure-ai.service.generateEmbedding()    [auth]
    → Edge Function: generate-embedding
    → api.openai.com/v1/embeddings (text-embedding-3-small, dim=384)
    ← number[] (cached on return)

Flow 4 — Embedding (Batch, document ingestion)
  knowledgeStepRunner
    → knowledgeEmbedding.generateEmbeddingsForChunks()
    → invokeBatchEmbedding() [100 chunks/call]
    → Edge Function: generate-embedding
    → api.openai.com/v1/embeddings
    ← number[][] (NOT cached)

Flow 5 — OCR (Google Vision)
  documentExtractor / InsuranceValidator
    → google-vision-ocr.service.runGoogleVisionOCR()   [triggers if pdfjs empty]
    → Edge Function: google-vision-ocr
    → vision.googleapis.com/v1/images:annotate (DOCUMENT_TEXT_DETECTION)
    ← { text, confidence, pages_processed } (NOT cached)

Flow 6 — Construction Photo Analysis
  visionService.analyzeConstructionPhoto()
    → Edge Function: analyze-photo (analysisType=construction)
    → api.openai.com/v1/chat/completions (gpt-4o, vision, detail=high)
    ← structured JSON (NOT cached)

Flow 7 — Diagnostic Photo Analysis
  visionService.analyzeDiagnosticPhoto()
    → Edge Function: analyze-photo (analysisType=diagnostic)
    → api.openai.com/v1/chat/completions (gpt-4o, vision, detail=high)
    ← structured JSON (NOT cached)

Flow 8 — BTP Site Photo (with DB save)
  visionService.analyzeConstructionPhoto() [with projetId]
    → Edge Function: analyze-construction-photo
    → api.openai.com/v1/chat/completions (gpt-4o, JSON mode)
    → INSERT photo_analyses (if projetId provided)
    ← structured JSON (NOT cached, but saved to DB)
```

---

## 9. Recommendations for PROMPT H2

### Priority 1 — Wire Cost Tracking (zero cost, high value)
1. In `llm-completion/index.ts`: extract `usage.input_tokens + output_tokens` → POST to `/api/v1/admin/record-cost`
2. In `generate-embedding/index.ts`: extract `data.usage.total_tokens` from OpenAI response → record
3. In `analyze-photo/index.ts` and `analyze-construction-photo/index.ts`: record `requests_count: 1`
4. In `google-vision-ocr.service.ts`: after Edge Function returns → call `CostTracker.recordAPICall('google-vision-ocr', { requests_count: 1 })`

### Priority 2 — Wire APIHealthMonitor
1. Register: `OpenAI-completions`, `OpenAI-embeddings`, `OpenAI-vision`, `Google-Vision-OCR`, `Anthropic-Claude`
2. Health check functions: lightweight HEAD or minimal API call per service
3. Run health checks every 60s (low frequency — we pay per call)

### Priority 3 — Implement OCR Result Caching
1. Hash incoming `imageBuffer` (SHA-256) as cache key
2. Before calling Edge Function: check `insurance_documents` for existing `parsed_text` by file hash
3. After successful OCR: store `parsed_text` + `file_hash` in DB
4. Estimated savings: 100% cost reduction for duplicate uploads of same document

### Priority 4 — Fallback Cascade for Embeddings
1. If OpenAI embeddings fail: try calling with reduced `dimensions: 256`
2. If still fails: use a local lightweight embedding approximation (TF-IDF or bag-of-words) with `is_synthetic: true`
3. Never block document ingestion entirely — synthetic embedding allows partial search

### Priority 5 — Upgrade Google Vision Auth
1. Replace `?key=API_KEY` in URL with service account JSON (base64 in `GOOGLE_CLOUD_CREDENTIALS`)
2. `google-vision-ocr/index.ts` already has the code path for `GOOGLE_CLOUD_CREDENTIALS` — just needs secret set

---

## Files to Modify in PROMPT H2

| File | Change | Impact |
|------|--------|--------|
| `supabase/functions/llm-completion/index.ts` | Record `usage` to `api_costs` before returning | Cost tracking for all LLM calls |
| `supabase/functions/generate-embedding/index.ts` | Record `usage.total_tokens` to `api_costs` | Cost tracking for embeddings |
| `supabase/functions/analyze-photo/index.ts` | Record 1 request to `api_costs` | Cost tracking for Vision |
| `supabase/functions/analyze-construction-photo/index.ts` | Record 1 request to `api_costs` | Cost tracking for Vision |
| `src/services/ai/google-vision-ocr.service.ts` | Add OCR result caching + cost recording | Cache + cost |
| `src/core/monitoring/APIHealthMonitor.ts` | Register all 5 AI APIs | Health monitoring |
| `supabase/migrations/` | New migration: add `file_hash` to `insurance_documents`, seed `api_pricing_config` | Schema |

---

*Audit complete. 12 files documented. 8 integration flows mapped. 0/12 cost-tracked. 1/8 cached.*
