# PROJECT CONTEXT - TORP Regulatory Intelligence Platform
**Version:** 1.0
**Last Updated:** 28 février 2026
**Status:** Strategic Vision Document

---

## PRODUCT VISION

### Mission
TORP is a B2B SaaS platform delivering regulatory intelligence and compliance automation for construction and renovation companies in France.

The platform transforms raw regulatory knowledge (DTU norms, building codes, technical standards) into actionable compliance insights, reducing project risk and accelerating decision-making in the construction industry.

### Target Market
**Primary:** SMEs and mid-market construction firms (5-500 employees)
- Contractors (maçonnerie, électricité, plomberie, etc.)
- Project managers
- Quality assurance teams
- Compliance officers

**Secondary:** Large general contractors (clients of primary market)

**Geographic:** France-first (EU expansion Year 2)

---

## LONG-TERM PRODUCT AMBITION

### Three Pillar Strategy: Detect → Score → Certify

#### Pillar 1: Regulatory Detection (Current / Q1-Q2 2026)
**Capability:** Automated extraction of regulatory obligations from construction documents.

**Features:**
- Document ingestion (PDF, DOCX, XLSX, images via OCR)
- Obligation extraction using LLM (GPT-4o-mini, Claude)
- Semantic structuring (article reference, obligation type, severity, applicable phase)
- Multi-language support (FR → EN → DE, future)

**KPI:** Extraction accuracy >95%, processing latency <5s per chunk

---

#### Pillar 2: Regulatory Scoring (Q2-Q3 2026)
**Capability:** Intelligent assessment of project/quote regulatory compliance and risk.

**Features:**
- Multi-dimensional scoring (safety, quality, delays, budget, HR, environment)
- Contextual analysis (project phase, métier, geographic constraints)
- Weighted obligation matching (severity × applicability × project context)
- Risk exposure calculation
- Benchmarking against industry standards

**Output:** Compliance score (A+ to F scale), detailed risk breakdown, remediation recommendations

**KPI:** Scoring consistency >90%, user-driven remediation rate >40%

---

#### Pillar 3: Regulatory Certification (Q4 2026 - Q2 2027)
**Capability:** Formal certification of regulatory compliance for completed projects.

**Features:**
- Audit trail-based certification (immutable record of compliance decisions)
- Post-completion verification (site photos, test results, contractor certifications)
- Legal defensibility (compliant with RGPD, ISO 9001, construction industry standards)
- Integration with insurance partners
- Certificate generation (digital + printed)

**Output:** Official compliance certificate, risk mitigation proof for insurance/lenders

**KPI:** Certification adoption >60% of projects, insurance partner integration (3+ partnerships)

---

## REGULATORY INTELLIGENCE ENGINE

### Core Function
Transform unstructured regulatory knowledge into machine-readable compliance rules indexed by project context.

```
Regulatory Knowledge (DTU, codes, standards)
        ↓
    [LLM Extraction]
        ↓
Structured Obligations (article, type, severity, phase, métier)
        ↓
    [Vector Embeddings]
        ↓
Semantic Index (searchable by project context)
        ↓
    [Scoring Engine]
        ↓
Compliance Assessment (score, risks, recommendations)
```

### Components

#### 1. **Obligation Extraction**
- Parses regulatory documents
- Identifies discrete obligations
- Classifies by type (exigence, interdiction, recommandation, tolérance)
- Assigns severity (1-5 scale)
- Tags applicable phases (conception, execution, controle)
- Identifies target métier domain

#### 2. **Semantic Indexing**
- Vector embeddings for semantic search
- Context-aware retrieval (phase, métier, risk type)
- Performance: <100ms for top-10 relevant obligations

#### 3. **Scoring & Assessment**
- Multi-dimensional analysis:
  - Safety compliance
  - Quality standards
  - Schedule feasibility
  - Budget impact
  - Staffing requirements
  - Environmental constraints
- Cross-obligation risk modeling (conflicts, cascading failures)
- Remediation pathway scoring

#### 4. **Audit Trail & Certification**
- Immutable decision log
- Regulatory reasoning (which rules applied, why)
- Evidence binding (photos, test results, certifications)
- Compliance proof for insurance/lenders

---

## GEOGRAPHIC CONTEXT SUBSYSTEM

### Purpose
Provide location-specific regulatory overlays beyond national DTU/standards.

### Scope
- Regional building codes variations
- Local urban planning constraints (PLU, PLUI)
- Utility network availability (water, sewer, electricity, telecom)
- Environmental hazards (flood zones, seismic risk, soil contamination)
- Tax/subsidy eligibility (MaPrimeRénov', CEE, etc.)
- Workforce availability & cost (regional labor market data)

### Design
**Independent microservice** with:
- Lightweight API (lat/lon → constraints)
- Caching strategy (district-level, not per-address for privacy)
- Integration point: Analysis scoring pipeline
- Non-blocking (fail gracefully if unavailable)

### Status
**Phase 2 component** (after core scoring stable)

---

## MULTI-TENANT ORGANIZATION MODEL

### Principle
TORP serves organizations (construction firms), not individual users.

**Each organization:**
- Controls own project portfolio
- Sets compliance thresholds & risk tolerance
- Owns analysis history & audit trail
- Can invite team members (project managers, QA, compliance officers)
- Receives organization-level analytics & benchmarking

### Data Scoping
- `profiles.organization_id` → user's home organization
- `projects.organization_id` → scoped query enforcement via RLS
- `devis.organization_id` → quote ownership
- `analysis_jobs.organization_id` → job visibility
- `analysis_results.organization_id` → result ownership

### Implications
- No data leakage between organizations (RLS strict)
- Bulk operations scoped by organization
- Reporting/analytics organization-level
- Compliance certifications organization-owned

---

## PUBLIC AUDIT ACCESS PATTERN

### Requirement
Regulatory authorities (inspectors, auditors) must validate compliance claims without full system access.

### Solution: Token-Based Public Audit
**Mechanism:**
1. Organization generates audit token (limited-time, specific project)
2. Token grants read-only access to audit trail + evidence
3. No access to: other projects, financials, team data
4. Token revocable anytime

**Implementation:**
- Supabase: `audit_tokens` table (project_id, token_hash, expiry, scope)
- API: `GET /audit/projects/{token}/compliance` → immutable proof
- RLS: Token-based access control

**Use Cases:**
- Insurance verification (token sent to insurer)
- Building authority inspection (token for inspector)
- Lender due diligence (token for financial institution)
- Dispute resolution (evidence to mediator)

---

## ASYNCHRONOUS ANALYSIS PARADIGM

### Why Async?
Regulatory analysis is **compute-intensive:**
- LLM calls (variable latency 2-10s)
- Vector search (semantic matching across 10k+ obligations)
- Multi-dimensional scoring (cross-obligation analysis)
- Risk modeling (constraint satisfaction)

**Sync response would timeout** → async is mandatory.

### Model: Job Queue + Event Callbacks

```
User submits project for analysis
        ↓
    [API creates analysis_job]
        ↓
    [Job queued (Bull/RabbitMQ)]
        ↓
Analysis Worker picks up job
    ├─ Extract obligations from chunks
    ├─ Score against project context
    ├─ Generate risk report
    └─ Store analysis_results
        ↓
Webhook/SSE notifies client
        ↓
User retrieves analysis_results
```

### Implications
- **UI Pattern:** Polling or WebSocket for result availability
- **Data Durability:** All analysis_jobs & results persisted
- **Retry Logic:** Failed jobs retried exponentially (configurable)
- **SLA:** 95% of analyses complete within 60s
- **User Feedback:** Real-time progress indication (20%, 50%, 80%, complete)

---

## EXTRACTION VS. ANALYSIS: Dual Pipeline

### Extraction Pipeline (Continuous)
**Goal:** Keep regulatory knowledge base current.

**Process:**
1. Ingest new regulatory documents (user upload, feed subscription)
2. Chunk into manageable units (2500 char hard limit)
3. Extract obligations via LLM
4. Index embeddings
5. Store in `knowledge_base_documents` + `knowledge_base_chunks` + `regulatory_obligations_v2`

**Cadence:** On-demand (user upload) + nightly (regulatory feeds)

**Owner:** RAG Worker (rag-worker/worker.js)

### Analysis Pipeline (On-Demand)
**Goal:** Score specific projects against extracted obligations.

**Process:**
1. User submits project for analysis
2. Analysis job created with project context
3. Worker:
   a. Retrieve project data (scope, métier, phase, risk tolerance)
   b. Search relevant obligations (semantic search)
   c. Score against project constraints
   d. Generate compliance report
   e. Store analysis_results
4. Notify user (webhook/SSE)
5. User retrieves detailed findings

**Owner:** Analysis Worker (scheduled async)

### Separation Benefits
- **Independence:** Extraction doesn't block user submissions
- **Scalability:** Can scale workers independently
- **Replay:** Can re-analyze projects without re-extracting obligations
- **Testing:** Extraction & analysis tested separately

---

## TRACEABILITY & AUDIT REQUIREMENTS

### Legal Constraints
- RGPD: Must audit all data access (Article 32)
- CNIL: Construction industry mandatory compliance documentation
- Insurance: Audit trail required for claim validation
- Building Code: Compliance proof mandatory

### Implementation Strategy

**Audit Trail Capture:**
- All user actions logged (who, what, when, why)
- LLM call tracing (prompt, model, decision impact)
- Obligation matching tracing (rule ID, score, override reason)
- Evidence binding (attachment IDs, test results, certifications)

**Data Structure:**
```sql
audit_log (user_id, organization_id, action, resource_id, change_detail, timestamp)
analysis_tracing (analysis_id, step, input, output, llm_model, duration, cost)
evidence_binding (analysis_id, evidence_type, file_id, validated_at)
```

**Retention:**
- Audit logs: 3 years (RGPD minimum)
- Analysis details: 5 years (statute of limitations)
- Certified projects: Indefinite (legal proof)

---

## ROADMAP PHASES

### Phase 1: MVP Extraction (Current - Q1 2026)
- ✅ Document ingestion (PDF, DOCX, XLSX, OCR)
- ✅ Obligation extraction (LLM-based)
- ✅ Semantic indexing (embeddings)
- ✅ Basic obligation exploration UI

### Phase 2: Intelligent Scoring (Q2-Q3 2026)
- Analysis job infrastructure (async queuing)
- Multi-dimensional scoring engine
- Project context modeling
- Compliance reporting

### Phase 3: Regulatory Certification (Q4 2026 - Q2 2027)
- Audit trail hardening (immutable logs)
- Evidence binding system
- Certification workflow
- Insurance partner integration

### Phase 4: Geographic Context (Q2-Q3 2027)
- Regional constraint lookup
- Urban planning data integration
- Environmental hazard mapping
- Workforce availability analysis

### Phase 5: Continuous Learning (Q4 2027+)
- User feedback loop → obligation validation
- Court decision tracking (regulatory evolution)
- Automatic obligation updates
- Predictive compliance risk modeling

---

## SUCCESS METRICS

### Product
- **Extraction Accuracy:** >95% for regulatory obligations
- **Analysis Latency:** p95 < 60 seconds
- **User Engagement:** >50% repeat analysis rate
- **Scoring Alignment:** >85% user agreement with risk assessment

### Business
- **Customer Acquisition:** 10 organizations/month (Year 1)
- **Retention:** >80% annual churn rate
- **NPS:** >40 (target)
- **ARPU:** €500-2000/month per organization

### Compliance
- **Audit Trail Completeness:** 100% (no dropped events)
- **RGPD Compliance:** Zero findings in external audit
- **Data Lineage:** Traceable from regulation → obligation → score
- **Certification Acceptance:** >80% insurance partner recognition

---

## ARCHITECTURAL PRINCIPLES

1. **Multi-Tenant First** - Not an afterthought; core design principle
2. **Async by Default** - Sync only for <100ms operations
3. **Regulatory Data as State** - Obligations are single source of truth
4. **Immutable Audit Trail** - Compliance decisions are permanent
5. **Fail Graceful** - System degradation preferred to failures
6. **Context-Aware** - All analysis considers geographic, temporal, organizational context
7. **Open Audit** - Compliance proof accessible via token to authorized third parties

---

## NEXT SESSION DEVELOPMENT FOCUS

See SYSTEM_ARCHITECTURE_V1.md for detailed service specifications.

See DECISIONS_LOG.md for architectural decisions and rationale.
