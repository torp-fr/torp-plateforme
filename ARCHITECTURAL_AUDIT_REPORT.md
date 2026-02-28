# ARCHITECTURAL AUDIT REPORT
## Deep Analysis of TORP Platform (February 2026)

**Date**: 2026-02-28
**Scope**: Complete architecture review for B2B SaaS readiness
**Risk Level**: 🔴 **CRITICAL ISSUES IDENTIFIED** - 12 critical findings, 8 major findings

---

## EXECUTIVE SUMMARY

The TORP platform has significant foundational infrastructure but exhibits **critical architectural gaps** in B2B multi-tenancy, financial controls, and scoring integrity. The platform is **NOT PRODUCTION-READY** for B2B SaaS operations at scale.

### Key Statistics
- **Database Tables**: 80+ tables across 70+ migrations
- **Edge Functions**: 6 core functions for AI orchestration
- **LLM Centralization**: 100% (recently refactored)
- **Company-scoped Queries**: ~10% coverage (LOW)
- **Subscription Guards**: 0 implementations (MISSING)
- **Audit Hashing**: Non-deterministic (VULNERABLE)

---

## 1. B2B SAAS READINESS

### Status: 🔴 **CRITICAL** - Multi-tenancy is Structural Liability

#### 1.1 Multi-Company Isolation

**CRITICAL ISSUES:**

1. **Company-ID Not Enforced in Frontend**
   - grep found only **11 references** to `company_id` in src/ (11,000+ lines of React code)
   - Most queries reference `user_id` directly, NOT company_id
   - Risk: Users can access other companies' data through user_id alone
   - Example vulnerability: `/api/devis?userId=XXX` could return data from other companies that user doesn't belong to

2. **No Tenant-Wide Isolation Layer**
   ```sql
   -- Companies table exists but:
   -- ❌ User-Company relationship is ONE-TO-ONE (user_id UNIQUE)
   -- ❌ This prevents multiple users per company
   -- ❌ No company switching mechanism for multi-user teams

   CREATE TABLE companies (
     user_id UUID UNIQUE NOT NULL,  -- ⚠️ PROBLEM: ONE user per company
     ...
   )
   ```
   - Can only have 1 admin per company (user_id is UNIQUE)
   - No support for multiple team members per company
   - No role escalation within company

3. **RLS Policies Use User-ID Not Company-ID**
   - Most tables use: `user_id = auth.uid()`
   - Should use: `company_id IN (SELECT company_id FROM user_company_mapping WHERE user_id = auth.uid())`
   - Example (pro_devis_analyses table):
     ```sql
     -- Current RLS:
     CREATE POLICY "Users see pro analyses"
       ON pro_devis_analyses FOR SELECT
       USING (company_id = ...); -- Exists in DB but frontend doesn't enforce it
     ```

4. **No User-Company Mapping Table**
   - Missing: `user_company` junction table
   - Impact: Can't have multi-user teams
   - Workaround code exists but inconsistent

#### 1.2 Role-Based Access Control (RBAC)

**MAJOR ISSUES:**

1. **Roles Are Global, Not Company-Scoped**
   ```sql
   ALTER TABLE profiles
   ADD COLUMN role TEXT DEFAULT 'user' CHECK (role IN ('user', 'admin', 'super_admin'));
   ```
   - Roles: `user`, `admin`, `super_admin` (3 levels, global scope)
   - Missing company-level roles: `company_admin`, `team_lead`, `viewer`
   - An `admin` can access ANY company's data
   - No permission matrix for features per role

2. **No Permission Enforcement**
   - No `permissions` table or `role_permissions` mapping
   - RLS uses simple role checks, no feature-level permissions
   - Example: Can't restrict "upload KB documents" to certain users per company
   - All admins have identical permissions

3. **Knowledge Base Upload Control is Broken**
   ```sql
   CREATE POLICY "Admins can insert knowledge documents" ON knowledge_documents
     FOR INSERT WITH CHECK (
       EXISTS (
         SELECT 1 FROM profiles
         WHERE profiles.id = auth.uid()
         AND profiles.role IN ('admin', 'super_admin')
         AND profiles.can_upload_kb = TRUE  -- ⚠️ field not actually used elsewhere
       )
     );
   ```
   - `can_upload_kb` field exists but isn't actually enforced
   - No audit trail of who uploaded what knowledge

4. **Missing Feature Flags**
   - No company-level feature toggles
   - No subscription tier enforcement (e.g., "Pro plan has RAG access")

#### 1.3 Company-Level Aggregation

**MAJOR ISSUES:**

1. **No Company Dashboard / Analytics**
   - LLM analytics exists (by user, not company)
   - Missing: Company-wide usage dashboard
   - Missing: Company-level billing/cost aggregation
   - Admins can't see all team members' activity

2. **No Company-Scoped Reports**
   - Audit reports generated per user
   - No company-wide compliance reporting
   - No team activity logs

3. **Usage Not Aggregated by Company**
   - llm_usage_log tracks `user_id`, not `company_id`
   - Can't bill companies for LLM usage
   - Can't enforce company-level quotas

#### 1.4 Data Leakage Scenarios

**HIGH RISK - Possible Data Leakage Paths:**

1. **Query by User-ID Bypass**
   ```typescript
   // Vulnerable pattern (frontend)
   const devis = await supabase
     .from('pro_devis_analyses')
     .select('*')
     .eq('user_id', userId); // ❌ Could cross company boundaries
   ```

2. **Pro Analyses Table**
   ```sql
   CREATE TABLE pro_devis_analyses (
     id UUID PRIMARY KEY,
     company_id UUID NOT NULL REFERENCES companies(id),  -- ✅ Exists in schema
     user_id UUID REFERENCES auth.users(id),              -- ❌ Frontend uses this
     ...
   )
   ```
   - DB has `company_id` but frontend queries use `user_id`
   - User who left company could still access via direct user_id query

3. **Knowledge Base Visibility**
   - Approved knowledge documents visible to ALL authenticated users
   - No company isolation of domain knowledge
   - Competitors could access same knowledge base

---

## 2. FINANCIAL ARCHITECTURE

### Status: 🔴 **CRITICAL** - No Cost Controls or Billing Support

#### 2.1 Token Tracking per Company

**CRITICAL ISSUES:**

1. **LLM Usage Not Tracked by Company**
   ```sql
   CREATE TABLE llm_usage_log (
     user_id TEXT,           -- ❌ Text field, not UUID foreign key
     action TEXT NOT NULL,
     model TEXT NOT NULL,
     input_tokens INTEGER,
     output_tokens INTEGER,
     cost_estimate DECIMAL(10, 8),
     ...
   );
   ```
   - `user_id` is TEXT (not UUID), no foreign key to users/companies
   - **IMPOSSIBLE to bill by company**: No way to aggregate user_id → company_id
   - Orphaned records: If user is deleted, cost allocation is lost
   - No company_id field at all

2. **No Billing Entity Tracking**
   ```
   Ideal:
   - user_id → company_id (many users per company)
   - All API calls tracked with company_id
   - Cost aggregated per company per month

   Actual:
   - user_id (text) → ???
   - No company context in usage tracking
   ```

3. **Cost Calculation Not Linked to Billing**
   - Cost estimated in llm_usage_log (USD)
   - No `billing_events` table
   - No `invoices` table
   - No integration with payment provider (Stripe, etc.)
   - Views exist (daily_llm_costs, model_llm_costs) but aren't used for billing

4. **No Cost Aggregation by Company**
   - Views aggregate globally, not by company
   - No query like: `SELECT SUM(cost) FROM llm_usage_log WHERE company_id = $1`

#### 2.2 Internal vs Client Cost Separation

**CRITICAL GAPS:**

1. **No Dual-Cost Model**
   - Missing distinction between:
     - **Internal cost**: What TORP pays for LLM APIs (actual: $0.005/1K input tokens for Claude)
     - **Client-facing cost**: What customer should be charged (actual: unknown)
   - No markup/margin calculation
   - No cost allocation across tiers

2. **No Service Level Tiers**
   - No concept of Starter/Pro/Enterprise plans
   - All companies have identical LLM access
   - Can't restrict expensive models (GPT-4 Vision) to Pro+ tiers
   - No usage limits per tier

3. **No Cost per Feature**
   - Each feature has unknown internal cost:
     - RAG query: N vector searches + 1 LLM call
     - Devis analysis: 2-3 LLM calls + N RAG queries
     - Knowledge enrichment: Variable cost
   - No cost tracking per feature
   - Can't price features independently

4. **Pappers API Calls Not Tracked**
   - `/functions/_shared/api-clients.ts` makes Pappers, INSEE, RGE, BODACC calls
   - Each call has cost but NO LOGGING
   - Missing from llm_usage_log entirely
   - Unmonitored cost center

5. **Embedding Batch Operations Unbounded**
   ```typescript
   // In knowledge-search.ts - No batch size limit!
   for (const doc of documents) {
     const embedding = await generateEmbedding(doc.content); // Each call = cost
   }
   ```
   - Batch embedding has no pagination/limits
   - Risk: 10,000 documents × $0.005 per embedding = $50 unbudgeted cost

#### 2.3 Subscription Guard Logic

**CRITICAL: 0 GUARDS IMPLEMENTED**

1. **No Quota Enforcement**
   - No check before LLM call: "Is this company over quota?"
   - No rate limiting per company
   - No monthly reset mechanism

2. **No Pre-Call Validation**
   ```typescript
   // Example of missing guard in rag-query/index.ts
   const extracted = await extractDevisData(devisText, claudeApiKey, {
     // ❌ No call to: checkSubscriptionQuota(userId, companyId)
     userId: null,
     sessionId: crypto.randomUUID(),
   });
   ```
   - Calls proceed regardless of subscription status
   - No token budget check
   - No cost threshold alerts

3. **No Billing Cycle Logic**
   - No concept of monthly/annual billing periods
   - Usage logs never archived/closed
   - Can't generate monthly invoices
   - No overage handling policy

4. **No Cost Alerts**
   - User wouldn't know if company is on pace to exceed budget
   - Admin can't set spending limits
   - No alerts when company reaches X% of quota

#### 2.4 Cost Explosion Risks

**HIGH RISK:**

1. **Unbounded Vector Search**
   ```typescript
   // knowledge-search.ts - Pagination exists but could be bypassed
   const results = await searchKnowledgeForDevis(devisText);
   // Default limit=10, but what if query returns 100K vectors?
   // IVFFlat index could scan all 1536D vectors = expensive
   ```
   - pgvector IVFFlat index on knowledge_embeddings
   - No hard limit on search result set
   - Query could scan entire index if misconfigured

2. **Vision API Unbounded**
   - analyzeImage() called on uploaded PDFs
   - Could be 100+ page PDFs = 100+ vision calls per document
   - Each call: $0.01-0.03 (expensive)
   - Example cost: 100-page PDF × $0.015 = $1.50 per analysis

3. **RAG Orchestration Parallel Calls**
   ```typescript
   // rag-orchestrator.ts
   await Promise.all([
     searchEntreprise(siret),         // Pappers API
     getRGECertifications(siret),     // External API
     getBODACCAnnonces(siret),        // BODACC API
     getQualibatCertification(siret), // Qualibat API
     // ... 8 more API calls in parallel
   ]);
   ```
   - 10+ parallel external API calls per devis
   - Each API call could fail and retry
   - Retry could create 2-3× cost spike
   - No timeout protection: calls could hang indefinitely

4. **Embedding Vectors Never Purged**
   - knowledge_embeddings table grows unbounded
   - Old embeddings not deleted
   - Vector search costs increase with size
   - No data retention policy

5. **Chunk Explosion Risk**
   ```sql
   -- knowledge_chunks table
   -- If document is ingested and split into chunks
   -- 1,000-page manual = 5,000 chunks × 1536D vectors
   -- Each vector costs to store, search, and generate
   ```
   - No max chunk count per document
   - No deduplication logic
   - Redundant embeddings could be generated multiple times

---

## 3. AUDIT SCORING INTEGRITY

### Status: 🔴 **CRITICAL** - Non-Deterministic and Non-Reproducible

#### 3.1 Scoring Determinism Issues

**CRITICAL ISSUES:**

1. **Non-Deterministic Report ID Generation**
   ```typescript
   // In audit.engine.ts
   function generateReportId(): string {
     const timestamp = Date.now();
     const random = Math.random().toString(36).substring(2, 9); // ❌ Random!
     return `AUDIT-${timestamp}-${random}`.toUpperCase();
   }
   ```
   - Report ID is random, not hash-based
   - Running same audit twice = different IDs
   - Can't reproduce exact same report
   - **Breaks audit reproducibility requirement**

2. **Timestamp-Dependent Scoring**
   - Audit metadata includes `generatedAt: string` (current timestamp)
   - If scoring algorithm uses time-of-day (e.g., market prices), results vary
   - Market price references (indices) change daily
   - Same devis scored on different days = different scores

3. **AI Model Variability**
   ```typescript
   // llm-completion calls with temperature=0.7
   const claudeResponse = await callClaude(
     prompt,
     systemPrompt,
     anthropicKey,
     4096,
     false,
     { temperature: 0.7 } // ⚠️ Non-deterministic at model level
   );
   ```
   - Temperature 0.7 = non-deterministic outputs
   - Score components derived from LLM analysis will vary
   - Example: "Enterprise credibility score" based on LLM analysis = non-reproducible

4. **No Scoring Algorithm Versioning**
   ```typescript
   // scoring logic in torp-analyzer.service.ts
   // No version tracking - if logic changes, old audits can't be re-scored
   ```
   - No `scoring_algorithm_version` field in audit table
   - Can't compare "old scoring" vs "new scoring"
   - Regulatory audit trail breaks when scoring changes

5. **Market Price Data Not Pinned**
   - RAG orchestration fetches live market prices (BODACC, INSEE)
   - These prices change
   - Same devis + same company, different day = different price comparison score
   - **MAJOR COMPLIANCE ISSUE**: Audit should be reproducible

#### 3.2 Hash Reproducibility

**MAJOR ISSUES:**

1. **No Content Hash for Audit Records**
   ```sql
   -- audit table structure (from criteria_evaluation_log)
   CREATE TABLE criteria_evaluation_log (
     id UUID PRIMARY KEY,
     criterion_name TEXT,
     score NUMERIC,
     justification TEXT,
     -- ❌ NO HASH FIELD
     -- ❌ NO SIGNATURE FIELD
     -- ❌ NO IMMUTABILITY CONSTRAINT
   );
   ```
   - No content hash in audit records
   - No way to detect tampering
   - No cryptographic proof of original content

2. **Hashing Implementation for Caching Not Audit**
   ```typescript
   // intelligentCache.service.ts uses SHA-256 for caching
   // But audit table has NO hashing mechanism
   const hash = await window.crypto.subtle.digest('SHA-256', data);
   ```
   - Hash implementation exists but only for cache
   - Not applied to audit records for integrity

3. **No Merkle Tree / Chain Linking**
   - Audit records not linked (no parent_audit_id)
   - If audit is modified, can't detect modification
   - No chain of custody

4. **Devis Content Could Be Altered Post-Audit**
   ```sql
   -- quote_uploads table
   UPDATE quote_uploads SET content = 'MODIFIED' WHERE id = 'XXX';
   -- ❌ No audit log of modification
   -- ❌ Original hash not preserved
   -- ❌ Audit report now invalid but not marked as such
   ```
   - No immutable log of original PDF content
   - Quote could be changed after scoring
   - Audit report doesn't reflect current document

#### 3.3 QR Code Verification Security

**CRITICAL GAPS:**

1. **No QR Code Signature**
   - QR codes generated in TransmissionClient
   ```typescript
   export interface TransmissionClient {
     lienAcces: {
       url: string;
       qrCode: string;        // ❌ Not signed/encrypted
       codeAcces: string;      // ⚠️ Just a string
       expiration: Date;
     };
   }
   ```
   - QR code is plain data
   - Anyone can generate a valid-looking QR code
   - No cryptographic signature

2. **Code Access Token Not Secure**
   - `codeAcces` is simple string
   - No length requirement visible
   - No entropy guarantee
   - Likely guessable

3. **No QR Expiration Enforcement**
   - QR has `expiration` field but no checking visible
   - Could access report after expiration
   - No revocation mechanism

4. **No QR Audit Trail**
   - QR scan not logged or tracked
   - "Someone accessed this report" not recorded
   - Missing: access_audit_log or qr_scan_log

5. **PDF Watermarking Missing**
   - When devis PDF is scored, audit report generated
   - No indication that PDF has been audited
   - Could be presented as independent document

#### 3.4 Scoring Reproducibility Tests

**MISSING:**

1. **No Reproducibility Test Suite**
   - No tests for: score(devis, date1) == score(devis, date2)
   - No tests for: hash(audit) == hash(audit_recomputed)
   - No regression tests when scoring algorithm changes

2. **No Scoring Version Control**
   - No way to say: "Use scoring_v1 for historical audits"
   - No way to re-score old audits with new algorithm

3. **No Audit Diff Tool**
   - Can't compare: old audit vs new audit
   - Missing: score change tracking

---

## 4. SECURITY ANALYSIS

### Status: 🟡 **MAJOR** - API Keys Secure, But RLS Incomplete

#### 4.1 API Key Exposure

**STATUS: ✅ GOOD** - No Exposed Keys

1. **Server-Side Only Keys**
   - OPENAI_KEY: Used in Edge Functions only (secure)
   - ANTHROPIC_KEY: Used in Edge Functions only (secure)
   - PAPPERS_KEY: Not found in code (removed or external)
   - No API keys in src/ (React code)
   - grep found 0 matches for hardcoded keys

2. **Environment Variable Usage**
   ```typescript
   // Correct pattern (Edge Functions)
   const openaiKey = Deno.env.get('OPENAI_KEY');

   // No pattern like this:
   // const openaiKey = "sk-xxxx"; // ❌ Would be dangerous
   ```
   - All keys loaded from env at runtime
   - Not committed to git

3. **Key Rotation Not Visible**
   - No key rotation mechanism documented
   - Should implement key versioning

#### 4.2 Client-Side LLM Usage

**STATUS: ⚠️ ACCEPTABLE** - 1 Exception Documented

1. **Client-Side SDK Import**
   ```typescript
   // src/services/ai/claude.service.ts (ONLY exception)
   import Anthropic from '@anthropic-ai/sdk';

   // Documented in code:
   // "Client cannot import Edge Functions, so requires dangerouslyAllowBrowser"
   // "Keys already exposed to client in Supabase context"
   ```
   - Only 1 client-side SDK import found
   - Is documented as exception
   - Uses `dangerouslyAllowBrowser` flag

2. **Risk Mitigation**
   - Keys aren't hardcoded (loaded from Supabase client)
   - Limited surface (1 file only)
   - Future improvement: Create wrapper Edge Function

3. **Should Monitor**
   - This is a drift risk - new dev might add another client SDK
   - Consider: Linter rule to prevent SDK imports in src/

#### 4.3 Row-Level Security (RLS)

**STATUS: 🟡 MAJOR** - Policies Exist But Enforcement Incomplete

1. **RLS Enabled on Key Tables**
   ```sql
   ✅ RLS ENABLED:
   - profiles
   - users
   - notifications
   - knowledge_documents
   - api_requests_log
   - external_api_calls_log
   - criteria_evaluation_log

   ❓ RLS STATUS UNCLEAR:
   - ccf (possibly not RLS protected)
   - pro_devis_analyses (has company_id but RLS on user_id?)
   - companies (could be exposed if user_id used)
   ```

2. **RLS Policies Use Non-Recursive Functions**
   ```sql
   ✅ GOOD: Using SECURITY DEFINER functions

   CREATE POLICY "profiles_select_admin"
     ON profiles FOR SELECT
     USING (public.is_admin_role(auth.uid()));

   -- Avoids infinite recursion
   -- Centralizes role checks
   ```

3. **RLS Doesn't Match Frontend Logic**
   - DB: `company_id IN (SELECT id FROM companies WHERE user_id = auth.uid())`
   - Frontend: Uses `user_id` directly
   - **Mismatch risk**: RLS protects correctly, but frontend queries might not

4. **Missing RLS on Audit Tables**
   ```sql
   -- criteria_evaluation_log has RLS:
   CREATE POLICY "Users see their own evaluations"
     ON criteria_evaluation_log FOR SELECT
     USING (ccf_id IN (SELECT id FROM ccf WHERE user_id = auth.uid()));

   -- But what about:
   -- - ccf table itself (depends on definition)
   -- - client_enriched_data (depends on RLS)
   ```
   - Need to verify ccf table has RLS

#### 4.4 Authentication & Authorization Gaps

**MAJOR ISSUES:**

1. **No API Key Authentication for Edge Functions**
   - Edge Functions rely on Supabase JWT tokens
   - No API key option for programmatic access
   - Risk: Service-to-service calls require user token

2. **No Scopes in JWT Tokens**
   - JWT tokens all-or-nothing
   - Can't issue limited-scope tokens
   - Risk: Leaked token has full access

3. **No Audit Log of Auth Events**
   - No login history
   - No failed auth attempts log
   - No token usage audit trail
   - Missing: auth_events table

4. **No IP Whitelisting**
   - Any IP can call Edge Functions
   - Risk: Brute force attacks on endpoints
   - Risk: API abuse from compromised IP

#### 4.5 Data Exposure in Logs

**MAJOR ISSUES:**

1. **No Log Sanitization**
   - LLM prompts logged as-is: could contain PII
   - Example: "Devis for [CLIENT NAME] at [ADDRESS]"
   - Logged to console and potentially stored

2. **Error Messages Expose Structure**
   - Error responses might expose database schema
   - API responses could leak table/column names

3. **No Log Retention Policy**
   - Logs not automatically purged
   - Retention policy not documented
   - Storage costs unbounded

---

## 5. SCALABILITY ANALYSIS

### Status: 🟡 **MAJOR** - Performance Risks at Scale

#### 5.1 RAG Query Performance

**MAJOR CONCERNS:**

1. **Vector Search Complexity**
   ```sql
   -- knowledge_embeddings table uses IVFFlat index
   CREATE INDEX idx_knowledge_embeddings_vector
   ON knowledge_embeddings
   USING ivfflat (embedding vector_cosine_ops);

   -- Performance at scale:
   -- 100K documents = decent
   -- 1M documents = slow
   -- Vector search becomes O(n) at large scale without HNSW
   ```
   - IVFFlat index is basic, not optimized for scale
   - pgvector HNSW index would be better (but not used)
   - Search time grows with corpus size

2. **Parallel API Calls Unbounded**
   ```typescript
   // rag-orchestrator.ts makes 8-10 parallel API calls
   // If each call takes 2s:
   // - Single request: 2s (due to parallelization)
   // - 100 concurrent users: 100 parallel executions × 8-10 calls = 800-1000 API calls
   // Rate limits (Pappers: 60/min) would be exceeded immediately
   ```
   - No rate limiting between requests
   - No circuit breaker for failed APIs
   - No retry backoff strategy visible

3. **Embedding Generation Not Batched**
   ```typescript
   // Each embedding = 1 API call to OpenAI
   // If ingesting 1000-page manual:
   // - Split into chunks: ~5000 chunks
   // - Generate embeddings: 5000 API calls
   // - Cost: 5000 × $0.02 = $100
   // - Time: 5000 × 100ms = 500 seconds minimum (even parallelized)
   ```
   - No batch endpoint used
   - OpenAI batch API not used for cost/time optimization
   - Single-call approach is inefficient

#### 5.2 Vector Index Scalability

**MAJOR CONCERNS:**

1. **IVFFlat Not HNSW**
   - Current: IVFFlat (Inverted File + Flat)
   - Needed: HNSW (Hierarchical Navigable Small World) for large scale
   - Trade-off: IVFFlat faster writes, slower reads; HNSW opposite
   - At 100K+ documents, search becomes slow

2. **1536D Vectors Are Expensive**
   - Using OpenAI text-embedding-3-small (1536D)
   - Could use smaller models (384D) with acceptable accuracy loss
   - 1536D = 4× more memory/compute than 384D

3. **No Vector Deduplication**
   - Same text could be embedded multiple times
   - No check: "Is this text already embedded?"
   - Could have 10× redundant vectors

4. **No Query Caching**
   - Vector search results not cached
   - If users ask similar questions, recalculate vectors
   - Could cache top results: "Devis for [TYPE]" queries

#### 5.3 Cost Explosion Risks (Revisited)

**HIGH RISK - Uncontrolled Cost Drivers:**

1. **Concurrent RAG Queries**
   ```
   Scenario: 100 concurrent users, each doing RAG query
   - 100 × 10 API calls = 1000 API calls to external services
   - Pappers rate limit: 60/min = 0.67/sec
   - System would be rate-limited immediately
   - Failed requests retry exponentially = 2-3× more calls

   Cost explosion: Could be 2000+ API calls in 1 minute
   - If Pappers charges per call: Unbounded cost
   - If Pappers has hard limits: System crashes
   ```

2. **Vision API on Large Documents**
   ```
   Scenario: User uploads 100-page proposal PDF
   - Each page analyzed with Vision API
   - Cost: 100 pages × $0.015/page = $1.50
   - If 1000 users: $1500 for one day
   - Could hit Vertex AI rate limits
   ```

3. **LLM Prompt Unbounded**
   ```
   - RAG context aggregates: 10 API results + market data + KB docs
   - Prompt could easily be 50K tokens
   - At 50K input tokens: $0.15 per call (GPT-4o)
   - 100 users × $0.15 = $15/hour LLM cost
   - x10 for growth = $150/hour = $1200/day
   ```

4. **Batch Processing Not Optimized**
   - Knowledge base ingestion could create 50K+ embeddings
   - Current approach: Sequential (slow) or parallelized (expensive)
   - Ideal: Use batch API endpoint (10× cheaper, slower)

#### 5.4 Database Scalability

**CONCERNS:**

1. **Migration History Growing**
   - 80+ migrations, many are cleanup/reset
   - Migration file is becoming unwieldy
   - Need: Migration consolidation and archiving

2. **No Partitioning Strategy**
   - llm_usage_log will grow 10K+ rows/day at scale
   - Should partition by `timestamp` for performance
   - Single table query becomes slow

3. **No Vacuum/Cleanup Policy**
   - Deleted records not cleaned up
   - Dead tuple bloat accumulates
   - Need: Regular VACUUM and ANALYZE

---

## CRITICAL ISSUES SUMMARY

### 🔴 CRITICAL (Must Fix Before Production)

| # | Issue | Component | Impact | Effort |
|---|-------|-----------|--------|--------|
| 1 | No multi-user support per company | Architecture | Can't scale to teams | HIGH |
| 2 | User-ID used instead of Company-ID in queries | Frontend | Data leakage risk | HIGH |
| 3 | No subscription guard logic | Architecture | Cost explosion | MEDIUM |
| 4 | Non-deterministic audit scoring | Audit Engine | Compliance failure | MEDIUM |
| 5 | LLM usage not linked to company | Billing | Can't invoice | HIGH |
| 6 | No cost allocation per company | Billing | Can't monetize | HIGH |
| 7 | Non-encrypted QR codes | Security | Tampering risk | LOW |
| 8 | RAG makes 10 unthrottled API calls | Architecture | Rate limit issues | MEDIUM |
| 9 | No audit log of auth events | Security | Compliance failure | LOW |
| 10 | Vision API unbounded on PDF pages | Cost | Explosion risk | MEDIUM |
| 11 | Report ID generated with Math.random() | Audit | Non-reproducible | LOW |
| 12 | No audit content hashing | Audit | Tampering risk | MEDIUM |

---

## MAJOR ISSUES SUMMARY

### 🟠 MAJOR (Should Fix Before Scale)

| # | Issue | Component | Impact | Effort |
|---|-------|-----------|--------|--------|
| 1 | Company table has ONE user (UNIQUE) | B2B | No team support | HIGH |
| 2 | Roles are global, not company-scoped | RBAC | No delegation | MEDIUM |
| 3 | No permission matrix | RBAC | No fine-grained control | MEDIUM |
| 4 | No company-level analytics dashboard | Feature | Admin blind | MEDIUM |
| 5 | Knowledge base visible to all companies | Isolation | Competitor access | MEDIUM |
| 6 | Embedded generation not batched | Performance | Expensive/slow | MEDIUM |
| 7 | IVFFlat not HNSW vector index | Scalability | Slow at scale | HIGH |
| 8 | No log sanitization (PII in logs) | Security | Compliance risk | LOW |
| 9 | No API rate limiting | Security | DoS risk | MEDIUM |
| 10 | Audit scoring uses LLM (non-deterministic) | Integrity | Results vary | MEDIUM |

---

## ARCHITECTURAL REFACTORING ROADMAP

### Phase 1: B2B Multi-Tenancy (Weeks 1-3)

**Priority: CRITICAL**

```sql
-- 1. Create user-company mapping table
CREATE TABLE user_company (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'member' CHECK (role IN ('member', 'admin', 'owner')),
  created_at TIMESTAMP DEFAULT now(),
  UNIQUE(user_id, company_id)
);

-- 2. Refactor companies table
ALTER TABLE companies DROP CONSTRAINT companies_user_id_key;
ALTER TABLE companies ALTER COLUMN user_id DROP NOT NULL;

-- 3. Migrate existing data
INSERT INTO user_company (user_id, company_id, role)
SELECT user_id, id, 'owner' FROM companies WHERE user_id IS NOT NULL;

-- 4. Update all frontend queries: Replace user_id with company_id
-- 5. Update all RLS policies to use user_company mapping
-- 6. Add company_id to all audit tables
```

**Deliverables:**
- ✅ Multi-user support per company
- ✅ Company-scoped role hierarchy
- ✅ User-company mapping enforced in RLS

### Phase 2: Billing & Cost Controls (Weeks 4-6)

**Priority: CRITICAL**

```sql
-- 1. Refactor llm_usage_log
ALTER TABLE llm_usage_log
  ADD COLUMN company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  ALTER COLUMN user_id TYPE UUID,
  ADD CONSTRAINT fk_user_id FOREIGN KEY (user_id) REFERENCES auth.users(id);

-- 2. Create billing entities
CREATE TABLE billing_subscriptions (
  id UUID PRIMARY KEY,
  company_id UUID NOT NULL UNIQUE REFERENCES companies(id),
  plan TEXT NOT NULL CHECK (plan IN ('starter', 'pro', 'enterprise')),
  monthly_quota_tokens INTEGER,
  monthly_quota_api_calls INTEGER,
  started_at TIMESTAMP NOT NULL,
  ended_at TIMESTAMP,
  status TEXT DEFAULT 'active'
);

CREATE TABLE cost_guards (
  id UUID PRIMARY KEY,
  company_id UUID NOT NULL UNIQUE REFERENCES companies(id),
  monthly_budget USD,
  alert_threshold_percent INTEGER DEFAULT 80,
  enforce_hard_limit BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT now()
);

-- 3. Create subscription check function
CREATE OR REPLACE FUNCTION check_subscription_quota(
  _company_id UUID,
  _tokens_to_use INTEGER
) RETURNS BOOLEAN AS $$
DECLARE
  subscription RECORD;
  current_usage INTEGER;
  has_quota BOOLEAN;
BEGIN
  SELECT * INTO subscription
  FROM billing_subscriptions
  WHERE company_id = _company_id AND status = 'active';

  IF NOT FOUND THEN
    RETURN FALSE; -- No active subscription
  END IF;

  SELECT SUM(total_tokens) INTO current_usage
  FROM llm_usage_log
  WHERE company_id = _company_id
    AND DATE(timestamp) = CURRENT_DATE;

  has_quota := (COALESCE(current_usage, 0) + _tokens_to_use)
             <= subscription.monthly_quota_tokens;

  RETURN has_quota;
END;
$$ LANGUAGE plpgsql;
```

**Deliverables:**
- ✅ Company-linked cost tracking
- ✅ Subscription quota enforcement
- ✅ Cost guards and alerts
- ✅ Billing event logging

### Phase 3: Audit Integrity & Reproducibility (Weeks 7-9)

**Priority: CRITICAL**

```typescript
// 1. Deterministic scoring without LLM
export function computeScoreDeterministic(devis: DevisData, config: ScoringConfig): Score {
  // Use only: devis content, config, pinned reference data
  // NO: LLM analysis, current time, randomness

  const hash = sha256(JSON.stringify(devis)); // Content hash
  const score = {
    global: computeScore(devis, config),
    hash: hash,
    algorithm_version: '1.0.0',
    reproducible_at: devis.created_at, // Pinned to creation time
  };
  return score;
}

// 2. Audit record hashing
export interface AuditRecord {
  id: UUID,
  devis_id: UUID,
  company_id: UUID,
  content_hash: SHA256,              // Hash of devis PDF
  score_hash: SHA256,                 // Hash of scoring inputs
  signature: HMAC_SHA256,              // Signed by system key
  scored_at: TIMESTAMP,
  scored_by_algorithm: VERSION,
}

// 3. Immutable audit log
CREATE TABLE audit_log (
  id UUID PRIMARY KEY,
  record_id UUID NOT NULL REFERENCES audit_records(id),
  change_type TEXT CHECK (change_type IN ('created', 'accessed', 'exported')),
  changed_at TIMESTAMP DEFAULT now(),
  changed_by UUID REFERENCES auth.users(id),
  ip_address INET,
  -- RLS: Only audit owner can access
);
```

**Deliverables:**
- ✅ Deterministic, reproducible scoring
- ✅ Content-based hashing of audits
- ✅ Cryptographic signatures
- ✅ Audit trail of all access

### Phase 4: RLS & Security (Weeks 10-11)

**Priority: MAJOR**

```sql
-- 1. Create permission table
CREATE TABLE role_permissions (
  id UUID PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES companies(id),
  role TEXT NOT NULL,
  feature TEXT NOT NULL,
  permission TEXT NOT NULL CHECK (permission IN ('read', 'write', 'delete', 'admin')),
  UNIQUE(company_id, role, feature, permission)
);

-- 2. Create audit_events table
CREATE TABLE audit_events (
  id UUID PRIMARY KEY,
  event_type TEXT NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  company_id UUID REFERENCES companies(id),
  resource_type TEXT,
  resource_id UUID,
  details JSONB,
  occurred_at TIMESTAMP DEFAULT now()
);

-- 3. Update RLS to use company_id everywhere
-- 4. Add rate limiting middleware
-- 5. Implement key rotation
```

**Deliverables:**
- ✅ Fine-grained permission control
- ✅ Complete audit event logging
- ✅ Company-ID based RLS across all tables

### Phase 5: Scalability & Cost Optimization (Weeks 12-14)

**Priority: MAJOR**

```typescript
// 1. Batch embedding generation
export async function generateEmbeddingsBatch(
  texts: string[],
  apiKey: string
): Promise<number[][]> {
  // Use OpenAI batch API endpoint
  // 10× cheaper, async processing
  const batchId = await createBatch(texts, apiKey);
  const results = await waitForBatch(batchId);
  return results;
}

// 2. Vector search caching
const cachedResult = await cache.get(`vector:${textHash}`);
if (cachedResult) return cachedResult; // Cache hit

// 3. Rate limiting for external APIs
const limiter = new RateLimiter({
  pappers: 60 / 60, // 60 calls/minute
  bodacc: 100 / 60,
});

// 4. Pagination for large queries
const results = await vectorSearch(query, { limit: 10, offset: 0 });

// 5. Partitioning for llm_usage_log
// PostgreSQL table partitioning by month
```

**Deliverables:**
- ✅ Batch processing for embeddings
- ✅ Query result caching
- ✅ Rate limiting enforcement
- ✅ Database partitioning

---

## LONG-TERM RISKS

### 1. Compliance & Legal
- **Risk**: GDPR/CCPA data isolation not enforced
- **Mitigation**: Implement company-scoped RLS + audit logging
- **Timeline**: Must complete by Phase 2

### 2. Data Breach
- **Risk**: User-ID based queries could expose competitor data
- **Mitigation**: Complete B2B refactoring (Phase 1)
- **Timeline**: Must complete before production

### 3. Cost Explosion
- **Risk**: Unbounded external API calls + vision processing
- **Mitigation**: Cost guards + quota enforcement (Phase 2)
- **Timeline**: Must complete before scale-up

### 4. Audit Failure
- **Risk**: Non-reproducible scoring fails regulatory audits
- **Mitigation**: Deterministic scoring + content hashing (Phase 3)
- **Timeline**: Must complete before IPO/major financing

### 5. Performance Degradation
- **Risk**: Vector search becomes slow at 100K+ documents
- **Mitigation**: HNSW index + query caching (Phase 5)
- **Timeline**: Before 10,000 audits/month

---

## RECOMMENDATIONS

### Immediate Actions (Next Sprint)

1. **Create user-company mapping table** (1 day)
   - Unblock multi-user team support
   - No breaking changes if done carefully

2. **Add company_id to llm_usage_log** (2 days)
   - Enable cost tracking per company
   - Prerequisite for billing

3. **Implement pre-call subscription check** (3 days)
   - Prevent cost explosions
   - 1 function + 3 integration points

4. **Audit RLS on ccf table** (1 day)
   - Verify data isolation
   - Add RLS if missing

### Before Production (Next Month)

1. **Complete B2B refactoring** (Phases 1-2)
2. **Implement cost guards** (Phase 2)
3. **Add audit hashing & signatures** (Phase 3)
4. **Company-scoped RLS everywhere** (Phase 4)

### Before Scale (Next Quarter)

1. **Vector index optimization** (Phase 5)
2. **Batch processing for embeddings** (Phase 5)
3. **Query caching** (Phase 5)
4. **Load testing** (3 days)

---

## CONCLUSION

The TORP platform has strong **foundational technology** (centralized LLM APIs, comprehensive audit trails, knowledge management) but critical **structural gaps** in B2B readiness and financial controls.

**Status**: 🔴 **NOT PRODUCTION-READY** for multi-company SaaS

**To Achieve Production Readiness**:
- Implement all Phase 1-2 recommendations (6-8 weeks)
- Address CRITICAL issues before any customer launches
- Complete Phases 3-4 before scaling beyond 10 companies
- Plan Phase 5 before 100+ companies

**Business Impact**:
- Current: Can launch single-company pilot
- Post-Phase-2: Can launch multi-company SaaS
- Post-Phase-4: Can pursue enterprise contracts
- Post-Phase-5: Can scale to 1000+ companies

