# ARCHITECTURE DECISIONS LOG - TORP
**Version:** 1.0
**Last Updated:** 28 février 2026
**Format:** ADR (Architecture Decision Records)

---

## DECISION 1: Organization-Centric Multi-Tenancy

**Status:** ADOPTED (Feb 2026)
**Date:** 2026-02-28

### Context
Initial TORP design modeled access by individual users. As product evolved toward B2B SaaS, organizational context became critical:
- Construction firms are the economic unit (not individual users)
- Projects are owned by organizations
- Compliance is organizational responsibility
- Audit/certification is organization-level proof

### Decision
Restructure data model from user-centric to **organization-centric**:
- All core entities scoped by `organization_id`
- Users belong to organizations (not vice versa)
- Access control enforced via RLS at organization boundary
- No data leakage between organizations

### Implementation
```sql
ALTER TABLE profiles ADD COLUMN organization_id UUID REFERENCES organizations(id);
ALTER TABLE projects ADD COLUMN organization_id UUID REFERENCES organizations(id);
ALTER TABLE devis ADD COLUMN organization_id UUID REFERENCES organizations(id);
ALTER TABLE analysis_jobs ADD COLUMN organization_id UUID REFERENCES organizations(id);
ALTER TABLE analysis_results ADD COLUMN organization_id UUID REFERENCES organizations(id);
ALTER TABLE quote_uploads ADD COLUMN organization_id UUID REFERENCES organizations(id);

-- Add RLS enforcing organization boundaries
CREATE POLICY "users_see_org_data" ON projects
  FOR SELECT
  USING (
    organization_id = (SELECT organization_id FROM profiles WHERE user_id = auth.uid())
  );
```

### Consequences
**Positive:**
- Clean data isolation (no cross-org visibility)
- Audit trail is organization-owned (compliant)
- Billing/licensing by organization (B2B model)
- Team collaboration within org (multiple users same org)

**Negative:**
- Migration cost (update all tables, backfill org_id)
- Query complexity increased (all queries filter by org_id)
- Testing complexity (need multi-org test scenarios)

### Alternatives Considered
1. **User-centric with organization lookup:** Coupling model to user identity; organization becomes attribute, not partition
2. **Hybrid (both user + org):** Redundant; adds complexity without benefit

### Related Decisions
- DECISION 2: Public Audit Access (requires org-level scoping)
- DECISION 4: Asynchronous Analysis (jobs belong to organizations)

---

## DECISION 2: Token-Based Public Audit Access

**Status:** ADOPTED (Feb 2026)
**Date:** 2026-02-28

### Context
Regulatory compliance requires proof accessible to external parties:
- Building inspectors need to validate compliance claims
- Insurance companies need to verify coverage justification
- Lenders need audit trail for due diligence
- Currently: No mechanism to share proof without exposing full system access

### Decision
Implement **limited-scope audit tokens**:
- Organization generates time-limited token for specific project
- Token grants read-only access to analysis + evidence
- No access to other projects, financials, team data
- Token revocable at any time

### Implementation
```sql
CREATE TABLE audit_tokens (
  id UUID PRIMARY KEY,
  organization_id UUID NOT NULL,
  project_id UUID NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,  -- hashed for security
  scope TEXT CHECK (scope IN ('read_analysis', 'read_evidence', 'full_audit')),
  expires_at TIMESTAMP,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMP,
  revoked_at TIMESTAMP
);

-- Public endpoint (no auth required)
GET /api/audit/{token}/compliance
Response: {
  analysis: {...},
  auditTrail: [...],
  evidence: [...]
}
```

### Security Model
- **Token is secret:** Must be transmitted securely (HTTPS, not URLs in logs)
- **Hash stored:** Even if database breached, token value unknown
- **Time-limited:** Defaults to 7 days; can be configured
- **Scope-limited:** Configurable granularity (just score vs. full audit trail)
- **Revocation:** Organization can revoke anytime

### Consequences
**Positive:**
- Regulatory compliance (proof accessible)
- Insurance/lending integration point
- User privacy (limited exposure)
- Auditable (token generation logged)

**Negative:**
- Token management overhead (generation, expiration, revocation)
- Secret management (users must keep token secure)
- Potential for token leaks (requires education)

### Alternatives Considered
1. **Password-protected access:** Less convenient for 3rd parties; requires account creation
2. **Public projects:** All-or-nothing visibility; no fine-grained control
3. **API keys:** Same as tokens but typically longer-lived; audit tokens are intentionally short-lived

### Related Decisions
- DECISION 1: Organization-centric (token scoped to org + project)
- DECISION 6: Immutable audit trail (token provides access to trail)

---

## DECISION 3: Asynchronous Analysis Pipeline

**Status:** ADOPTED (Feb 2026)
**Date:** 2026-02-28

### Context
Regulatory analysis is compute-intensive:
- LLM API calls: 2-10 seconds per call
- Vector search across 10k+ obligations: 100-500ms
- Multi-dimensional scoring: 1-5 seconds
- Total: 5-30 seconds per analysis
- User expects response within 2-3 seconds

**Synchronous approach would fail:** API timeout, poor UX, cascading failures.

### Decision
Implement **asynchronous job queue pattern**:
- User submits analysis → immediate 202 Accepted (job created)
- Job enqueued (Bull/Redis-backed queue)
- Dedicated worker processes jobs
- Real-time progress via WebSocket
- Results retrieved when complete

### Implementation
```
POST /api/projects/{id}/analysis → 202 Accepted {jobId}
         ↓
Bull Queue (Redis)
         ↓
Analysis Worker (1+ instances)
  - Consume job from queue
  - Process (5-30 seconds)
  - Emit progress events (WebSocket)
  - Persist results
  - Emit completion
         ↓
Client receives completion → Fetch results
GET /api/analysis/{jobId} → 200 OK {results}
```

### Configuration
- **Queue:** Bull (Redis-backed, reliable)
- **Retry:** Exponential backoff (1s, 10s, 60s, 5min)
- **Max retries:** 3 attempts, then permanently failed
- **SLA:** 95% of analyses complete within 60 seconds
- **Scalability:** 2-5 worker instances, auto-scale by queue depth

### Consequences
**Positive:**
- Resilient (failures don't crash API)
- Scalable (multiple workers)
- Monitorable (queue depth, worker utilization)
- User feedback (real-time progress)

**Negative:**
- More complex (requires queue infrastructure)
- Eventual consistency (results available after delay)
- Polling/WebSocket required (not request-response pattern)
- Redis dependency (additional infrastructure)

### Alternatives Considered
1. **Synchronous with timeouts:** User blocks; bad UX; cascading failures if LLM slow
2. **Server-sent events (SSE):** Simpler than WebSocket; same concept
3. **Webhook callbacks:** Push results to external endpoint; harder to implement, fewer guarantees

### Related Decisions
- DECISION 4: Separation of extraction and analysis (different queues)
- DECISION 5: Geographic context non-blocking (async calls timeout gracefully)

---

## DECISION 4: Dual Pipeline - Extraction vs. Analysis

**Status:** ADOPTED (Feb 2026)
**Date:** 2026-02-28

### Context
Two distinct operations on different cadences:
- **Extraction:** Regulatory document → obligations (continuous, on-demand, 1-5 minutes)
- **Analysis:** Project + obligations → compliance score (on-demand, 5-30 seconds)

Initial design had single pipeline → unnecessary coupling.

### Decision
Implement **two independent pipelines**:

**Extraction Pipeline:**
- Runs continuously (scheduled polling + event-triggered)
- Produces: `knowledge_chunks`, `regulatory_obligations_v2`, vector embeddings
- Worker: `rag-worker/worker.js` (single instance)
- Queue: Supabase polling (simple)

**Analysis Pipeline:**
- Runs on-demand (user submits analysis)
- Consumes: Extracted obligations (semantic search)
- Produces: `analysis_results`
- Worker: Analysis worker (multiple instances)
- Queue: Bull queue (scalable)

### Benefits
```
Extraction Pipeline          Analysis Pipeline
├─ Independent scaling       ├─ User-triggered
├─ Knowledge base currency   ├─ Per-project context
├─ Continuous operation      ├─ Async job queue
├─ 1 instance needed         ├─ 2-5 instances
├─ Longer latency OK         ├─ <60s SLA
└─ Can retry failed docs     └─ Idempotent scoring
```

### Implementation Isolation
- **Data:** Extraction writes to `knowledge_*`, Analysis reads from `knowledge_*` (unidirectional)
- **Orchestration:** Separate workers, separate queues
- **Monitoring:** Separate metrics (extraction success rate vs. analysis SLA)
- **Testing:** Can test independently

### Consequences
**Positive:**
- **Decoupled:** Can improve extraction without affecting analysis
- **Scalable:** Extraction doesn't block analysis
- **Testable:** Can mock obligations for analysis testing
- **Resilient:** Extraction failure doesn't prevent analysis on cached data

**Negative:**
- **Complexity:** Two separate worker processes
- **Synchronization:** Must ensure obligations fresh before analysis
- **Data redundancy:** Obligations stored separately from analysis

### Alternatives Considered
1. **Monolithic pipeline:** Single worker does extraction + analysis; simpler but tightly coupled
2. **On-demand extraction:** Extract only when needed for analysis; slower analysis, no pre-indexed knowledge

### Related Decisions
- DECISION 3: Asynchronous analysis (Analysis pipeline is async)
- DECISION 5: Geographic context (non-blocking enhancement to analysis)

---

## DECISION 5: Geographic Context as Independent Microservice

**Status:** ADOPTED (Feb 2026)
**Date:** 2026-02-28

### Context
Location-specific regulatory data is supplementary to core compliance analysis:
- Nice-to-have, not essential
- Sourced from external data providers (PLU, utilities, environmental databases)
- Different update cadence (nightly, not real-time)
- Variable data quality/availability by region
- Could cause analysis latency if not carefully designed

### Decision
Implement **Geographic Context as independent microservice**:
- Separate process, separate deployment
- Non-blocking integration (Analysis Worker continues if unavailable)
- Independent caching layer (district-level caching for privacy)
- Public API contract (separate service)

### Implementation
```
Analysis Worker:
  try {
    context = await geographicService.getContext(lat, lon);
    scoring = scoring.apply(context.constraints);
  } catch (error) {
    logger.warn('geographic_service_unavailable', error);
    scoring = scoring.apply(DEFAULT_CONSTRAINTS);  // Continue without
  }
```

### Architecture Benefits
```
API Gateway
    ↓
┌─────────────────────┬────────────────────┐
│ Analysis Worker     │ Geographic Service │
│ (core analysis)     │ (optional overlay)  │
└─────────────────────┴────────────────────┘
         ↓                      ↓
    Supabase            External APIs
   Obligations          (PLU, BRGM, etc)
                        + Redis cache
```

### Deployment Independence
- **API Gateway:** Vite + React SPA (client)
- **Analysis Workers:** Node.js (core processing)
- **Geographic Service:** Node.js or Python (data-heavy)
- **Shared:** Supabase database, Redis cache

### Consequences
**Positive:**
- **Non-blocking:** Geographic unavailability doesn't degrade core analysis
- **Independent scaling:** Can scale separately based on demand
- **Testable:** Can mock for analysis testing
- **Future-proof:** Easy to add/remove geographic features

**Negative:**
- **Network latency:** Inter-service call adds 50-200ms
- **Operational complexity:** Another service to deploy/monitor
- **Fallback logic:** Must handle unavailability gracefully

### Alternatives Considered
1. **Integrated into Analysis Worker:** Simpler; less operational burden; but couples to analysis
2. **Batch lookup (nightly):** Precompute geographic constraints for all regions; less fresh data
3. **Async (separate job):** Geographic data appended after analysis; awkward UX

### Related Decisions
- DECISION 3: Asynchronous analysis (geographic calls don't block)
- DECISION 4: Dual pipeline (geographic is separate from extraction)

---

## DECISION 6: Immutable Audit Trail

**Status:** ADOPTED (Feb 2026)
**Date:** 2026-02-28

### Context
Regulatory compliance and legal defensibility require proof of decision history:
- Must prove what was analyzed, when, and by whom
- Cannot be retroactively modified (legal liability)
- Must satisfy RGPD article 32 (audit capability)
- Insurance/lender verification requires audit trail

### Decision
Implement **immutable audit log**:
- All actions logged to `audit_log` table (read-only insert)
- No updates, no deletes (PostgreSQL constraints)
- Timestamps are server-generated (not user-provided)
- Cryptographic hashing optional (future enhancement)

### Implementation
```sql
CREATE TABLE audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  user_id UUID REFERENCES profiles(id),
  action TEXT NOT NULL,  -- 'analysis_created', 'analysis_completed', etc.
  resource_type TEXT,    -- 'analysis', 'project', 'evidence'
  resource_id TEXT,
  old_values JSONB,
  new_values JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT now(),
  -- NO UPDATE/DELETE PERMISSIONS
);

-- Immutability constraint
ALTER TABLE audit_log DISABLE TRIGGER ALL;
-- Only INSERT allowed; no UPDATE/DELETE

-- Retention policy (5 years default)
SELECT pg_partman.create_parent(
  'public.audit_log',
  'created_at',
  'native',
  '1 year'
);
```

### Logged Events
```
User actions:
- project_created
- analysis_submitted
- analysis_completed
- evidence_uploaded
- evidence_verified
- audit_token_generated
- audit_token_revoked
- compliance_score_confirmed

System actions:
- obligation_extracted
- obligation_indexed
- geographic_lookup
- regulatory_feed_updated
```

### Access Control
- **Read:** Organization members can audit log for own organization
- **Write:** System only (application layer inserts, no direct API)
- **Delete:** Never (compliance requirement)

### Consequences
**Positive:**
- **Legal proof:** Immutable record of compliance decisions
- **RGPD compliant:** Audit trail as required (Article 32)
- **Forensics:** Can investigate disputes/errors
- **Insurance:** Can prove compliance history to third parties

**Negative:**
- **Storage cost:** Audit log grows unbounded (mitigation: archival/retention policy)
- **Query performance:** Large table requires indexing strategy
- **No error correction:** Cannot fix logged mistakes (must append correction as new entry)

### Retention Strategy
- **Active (0-1 year):** Indexed, fast queries
- **Archive (1-5 years):** Cold storage, slower queries
- **Delete (>5 years):** Legal minimum met; data destruction

### Alternatives Considered
1. **Mutable audit log:** Simpler; violates compliance requirements
2. **Off-chain (external audit service):** External provider; expensive
3. **Append-only (event sourcing):** More complex; similar result to immutable table

### Related Decisions
- DECISION 2: Public audit access (token grants audit trail access)
- DECISION 1: Organization-centric (audit log scoped by org)

---

## DECISION 7: LLM Provider Flexibility

**Status:** ADOPTED (Feb 2026)
**Date:** 2026-02-28

### Context
Two LLM providers: OpenAI (GPT-4o-mini) and Anthropic (Claude).
- Both suitable for obligation extraction
- Different pricing, performance characteristics, compliance profiles
- Future: Possible need to switch/add providers
- Initial choice: OpenAI (established, cheaper)

### Decision
Build **provider abstraction layer**:
- Define extraction interface (input → obligations)
- Implement OpenAI adapter (current)
- Implement Anthropic adapter (fallback/alternative)
- Configuration to switch at runtime

### Implementation
```typescript
interface LLMProvider {
  extractObligations(
    systemPrompt: string,
    userPrompt: string
  ): Promise<ExtractedObligations>;
}

class OpenAIProvider implements LLMProvider {
  async extractObligations(...) {
    return await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      response_format: { type: 'json_object' },
      ...
    });
  }
}

class AnthropicProvider implements LLMProvider {
  async extractObligations(...) {
    return await anthropic.messages.create({
      model: 'claude-3.5-sonnet',
      ...
    });
  }
}

// Usage
const provider = process.env.LLM_PROVIDER === 'anthropic'
  ? new AnthropicProvider()
  : new OpenAIProvider();

const result = await provider.extractObligations(prompt);
```

### Consequences
**Positive:**
- **Vendor independence:** Not locked into single provider
- **Cost optimization:** Can compare pricing over time
- **Compliance flexibility:** Some orgs may require specific providers
- **Fallback:** Can switch if primary provider has issues

**Negative:**
- **Output variance:** Different models produce slightly different results
- **Validation overhead:** Must validate both providers' outputs
- **Operational complexity:** Must monitor both providers

### Alternatives Considered
1. **Single provider (OpenAI only):** Simpler; vendor lock-in risk
2. **Automatic failover:** Complexity without clear benefit (switching mid-job is bad)
3. **Multiple calls (ensemble):** Expensive; marginal quality improvement

### Related Decisions
- DECISION 4: Dual pipeline (extraction uses LLM provider)
- Policy: Monitor extraction accuracy; may switch providers if quality degrades

---

## DECISION 8: Multi-Dimensional Compliance Scoring

**Status:** ADOPTED (Feb 2026)
**Date:** 2026-02-28

### Context
Compliance has multiple dimensions:
- Safety (non-negotiable)
- Quality (variable tolerance)
- Schedule (project-dependent)
- Budget (constraint-dependent)
- HR (staffing availability)
- Environmental (regulatory + project goals)

Single score (A-F) insufficient for decision-making.

### Decision
Implement **multi-dimensional scoring**:
- Score each dimension independently (1-10 scale)
- Weight by project context (safety always high-weight)
- Aggregate to overall score (A-F)
- Return breakdown (user sees scores + scores)

### Algorithm (Pseudo-code)
```
complianceScore = weightedAverage(
  safetyScore * WEIGHT.safety,        // Always high (0.4)
  qualityScore * WEIGHT.quality,      // Project-dependent (0.2)
  scheduleScore * project.schedule_flexibility * 0.2,
  budgetScore * project.budget_tolerance * 0.1,
  hrScore * project.available_resources * 0.05,
  environmentScore * 0.05
);

letterGrade = toLetterGrade(complianceScore);
// A (90-100), B (80-89), C (70-79), D (60-69), F (<60)

risks = [
  {dimension: 'safety', score: safetyScore, severity: risk.severity},
  {dimension: 'quality', score: qualityScore, severity: risk.severity},
  ...
];

Rank risks by (1 - score) * severity → user sees critical risks first
```

### Output Format
```json
{
  "complianceScore": "A",
  "dimensions": {
    "safety": 95,
    "quality": 82,
    "schedule": 78,
    "budget": 60,
    "hr": 85,
    "environment": 90
  },
  "weights": {
    "safety": 0.4,
    "quality": 0.2,
    ...
  },
  "risks": [
    {
      "dimension": "budget",
      "severity": "HIGH",
      "score": 60,
      "description": "Budget constraint conflicts with 3 quality standards",
      "relatedObligations": ["article-5", "article-12", "article-18"]
    }
  ],
  "recommendations": [...]
}
```

### Consequences
**Positive:**
- **Nuanced:** Users understand trade-offs (budget vs. quality)
- **Actionable:** Specific dimension feedback drives remediation
- **Transparent:** Scoring methodology visible (trust)

**Negative:**
- **Complexity:** Multiple scores harder to communicate than single score
- **Aggregation bias:** Overall score sensitive to weighting (can be gamed)
- **User education:** Requires explanation of methodology

### Alternatives Considered
1. **Single score:** Simpler; insufficient context
2. **Pass/Fail:** Too binary; ignores trade-offs
3. **Weighted by organization risk tolerance:** Can be good; adds config complexity

---

## DECISION 9: Context-Aware Analysis (Geographic, Temporal, Organizational)

**Status:** ADOPTED (Feb 2026)
**Date:** 2026-02-28

### Context
Regulatory compliance varies by:
- **Geographic:** Region-specific building codes, utility availability, environmental hazards
- **Temporal:** Different regulations effective at different times (effective_date, expiration_date in obligations)
- **Organizational:** Different risk tolerance, industry focus, service capabilities

Generic compliance score ignores these factors.

### Decision
Implement **context-aware scoring**:
- Geographic: Region-specific constraints (Decision 5)
- Temporal: Obligation effective dates compared to project timeline
- Organizational: Risk tolerance & capabilities from org profile

### Implementation
```typescript
interface AnalysisContext {
  geographic: {
    latitude: number;
    longitude: number;
    // Loaded from geographic service
    constraints: GeographicConstraints;
  };
  temporal: {
    analysisDate: Date;
    projectStart: Date;
    projectEnd: Date;
  };
  organizational: {
    riskTolerance: 'low' | 'medium' | 'high';
    capabilities: string[];  // List of competencies
    experience: number;  // Years
  };
}

function scoreObligation(
  obligation: Obligation,
  context: AnalysisContext
): Score {
  // Obligation applies to this region? (geographic)
  if (!obligation.applicableRegions.includes(context.geographic.region)) {
    return 100;  // Not applicable
  }

  // Obligation effective during project timeline? (temporal)
  if (context.temporal.projectEnd < obligation.effective_date) {
    return 100;  // Not yet effective
  }

  if (context.temporal.projectStart > obligation.expiration_date) {
    return 100;  // Expired
  }

  // Organization has capability? (organizational)
  if (!context.organizational.capabilities.includes(obligation.required_capability)) {
    return MAX_RISK;  // Critical gap
  }

  // Score based on context
  return computeScore(obligation, context);
}
```

### Consequences
**Positive:**
- **Accurate:** Scores reflect actual project reality
- **Actionable:** Geographic/temporal/org factors visible
- **Transparent:** Scoring logic auditable

**Negative:**
- **Data intensive:** Requires rich context (careful validation)
- **More complex:** More variables = more test cases
- **User experience:** Requires UI to show context filters

---

## DECISION 10: Regulatory Feed Subscription (Future)

**Status:** PLANNED (Q3 2026)
**Date:** 2026-02-28

### Context
Regulatory documents are continuously updated:
- New DTU standards published
- Building codes amended
- Court decisions affect interpretation
- Legal updates require extraction

Manual document upload is not scalable.

### Decision (Future)
Implement **regulatory feed subscriptions**:
- Organizations subscribe to feeds (DTU updates, regional codes, etc.)
- Nightly import of updated docs (API integration or file drop)
- Automatic extraction + indexing
- Notification if existing projects affected by changes

### Architecture (Placeholder)
```
Regulatory Feed Service
  ├─ DTU updates (official)
  ├─ Regional code changes (regional sources)
  ├─ Court decisions (legal tracking)
  └─ Industry standards (ISO, Eurocodes)
         ↓
  Extract obligations (same extraction pipeline)
         ↓
  Notify organizations (if applicable to projects)
         ↓
  Invalidate cached analysis (trigger re-analysis if needed)
```

### Status
**Not yet implemented** - Placeholder for roadmap.

---

## ARCHITECTURAL PRINCIPLES (Summary)

1. **Multi-Tenant by Design:** All data scoped by organization; no defaults
2. **Asynchronous by Default:** Long operations use job queues; <100ms for sync responses
3. **Non-Blocking Components:** Geographic service, LLM APIs don't block core analysis
4. **Immutable Audit Trail:** Compliance proof requires unchangeable records
5. **Provider Flexibility:** Avoid vendor lock-in; abstract LLM implementations
6. **Context-Aware:** Geographic, temporal, organizational context in all decisions
7. **Fail Graceful:** System degradation preferred to failures; fallbacks for non-critical features
8. **Observable:** Metrics, logging, tracing for operational visibility
9. **Testable:** Clear interfaces, dependency injection, mockable services
10. **Privacy by Default:** Audit tokens for limited access; organization boundaries strict

---

## NEXT STEPS

**Before Implementation:**
- [ ] Review decisions with team
- [ ] Identify conflicting assumptions
- [ ] Validate against compliance requirements
- [ ] Update technical roadmap

**Implementation Order:**
1. Organization-centric RLS (DECISION 1)
2. Asynchronous analysis (DECISION 3)
3. Dual pipeline separation (DECISION 4)
4. Immutable audit trail (DECISION 6)
5. LLM provider abstraction (DECISION 7)
6. Multi-dimensional scoring (DECISION 8)
7. Geographic microservice (DECISION 5)
8. Public audit tokens (DECISION 2)
9. Context-aware analysis (DECISION 9)

---

## REVIEW HISTORY

| Date | Reviewer | Status | Notes |
|------|----------|--------|-------|
| 2026-02-28 | Architecture | APPROVED | Initial decisions documented |

---

## APPENDIX: Decision Template

Use this template for future decisions:

```markdown
## DECISION N: [Title]

**Status:** PROPOSED | ADOPTED | DEPRECATED
**Date:** YYYY-MM-DD

### Context
[Why is this decision needed? What problem does it solve?]

### Decision
[What is being decided?]

### Implementation
[How will it be implemented?]

### Consequences
**Positive:**
- [Benefits]

**Negative:**
- [Trade-offs]

### Alternatives Considered
1. [Alternative 1]: [Why not chosen]
2. [Alternative 2]: [Why not chosen]

### Related Decisions
- DECISION X: [Related]
```
