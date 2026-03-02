# SYSTEM ARCHITECTURE V1 - TORP Regulatory Platform
**Version:** 1.0
**Last Updated:** 28 février 2026
**Status:** Reference Architecture

---

## ARCHITECTURE OVERVIEW

```
┌─────────────────────────────────────────────────────────────────┐
│                     CLIENT LAYER (Browser)                       │
│                    React SPA (Vite + TypeScript)                 │
└────────────────────────┬──────────────────────────────────────┘
                         │
                         │ HTTPS
                         ↓
┌─────────────────────────────────────────────────────────────────┐
│                      API GATEWAY LAYER                           │
│                  Express.js + Supabase Auth                      │
├─────────────────────────────────────────────────────────────────┤
│  Routes:                                                         │
│  - POST /projects/{id}/analysis → Create analysis job           │
│  - GET /analysis/{id} → Retrieve analysis result                │
│  - POST /devis/{id}/validate → Validate quote compliance        │
│  - GET /audit/{token}/compliance → Public audit access         │
│  - WebSocket /analysis/{id}/progress → Real-time updates       │
└────────────────────────┬──────────────────────────────────────┘
                         │
          ┌──────────────┼──────────────┐
          ↓              ↓              ↓
    ┌──────────┐  ┌──────────────┐  ┌─────────────┐
    │ Supabase │  │ Bull Queue   │  │ Supabase    │
    │Database  │  │(Redis-backed)│  │Realtime     │
    │(Auth,RLS)│  │              │  │(WebSocket)  │
    └──────────┘  └──────────────┘  └─────────────┘
         │              │
         └──────────────┼──────────────┐
                        ↓              │
        ┌───────────────────────────┐  │
        │  WORKER SERVICES LAYER    │  │
        ├───────────────────────────┤  │
        │                           │  │
        │ 1. Extraction Worker      │  │
        │    (rag-worker/worker.js) │  │
        │    └─ Chunk documents     │  │
        │    └─ Extract obligations │  │
        │    └─ Generate embeddings │  │
        │    └─ Index in Supabase   │  │
        │                           │  │
        │ 2. Analysis Worker        │  │
        │    (scheduled async)      │  │
        │    └─ Consume job queue   │  │
        │    └─ Score regulations   │  │
        │    └─ Generate report     │  │
        │    └─ Emit completion     │  │
        │                           │  │
        │ 3. Geographic Context     │  │
        │    Service (microservice) │  │
        │    └─ Lookup constraints  │  │
        │    └─ Cache district data │  │
        │                           │  │
        └───────────────────────────┘  │
                        ↓              │
              ┌───────────────────────┐│
              │  DATA LAYER           ││
              ├───────────────────────┤│
              │ Supabase PostgreSQL:  ││
              │ - knowledge_documents ││
              │ - knowledge_chunks    ││
              │ - regulatory_oblig... ││
              │ - projects            ││
              │ - analysis_jobs       ││
              │ - analysis_results    ││
              │ - audit_log           ││
              │ - audit_tokens        ││
              │ - organizations       ││
              │ - profiles            ││
              └───────────────────────┘│
                                       │
              ┌────────────────────────┘
              │
        ┌─────▼──────┐
        │ LLM APIs   │
        ├────────────┤
        │- OpenAI    │
        │- Anthropic │
        └────────────┘
```

---

## SERVICE SPECIFICATIONS

### 1. API GATEWAY SERVICE (Express.js)

#### Purpose
Central entry point for all client requests. Handles authentication, request routing, response formatting, and real-time updates.

#### Responsibilities
- Request authentication (JWT validation via Supabase)
- Authorization (RLS enforcement via `organization_id`)
- Route handling
- Response formatting (JSON + error codes)
- Job submission to queue
- Real-time progress notifications (WebSocket)

#### Key Endpoints

**Analysis Submission:**
```
POST /api/projects/{projectId}/analysis
Authorization: Bearer {jwt_token}
Content-Type: application/json

{
  "scope": "full" | "quick",
  "context": {
    "budget": 50000,
    "phase": "conception" | "execution" | "controle",
    "metiers": ["maçonnerie", "électricité"],
    "timeline": "2026-06-01"
  },
  "riskTolerance": "low" | "medium" | "high"
}

Response 202 Accepted:
{
  "jobId": "job-xxx",
  "status": "queued",
  "createdAt": "2026-02-28T10:00:00Z"
}
```

**Analysis Result Retrieval:**
```
GET /api/analysis/{jobId}
Authorization: Bearer {jwt_token}

Response 200 OK (if complete):
{
  "jobId": "job-xxx",
  "status": "completed",
  "complianceScore": "A",
  "risks": [
    {
      "severity": "high",
      "category": "safety",
      "description": "...",
      "relatedObligations": ["article-5", "article-12"]
    }
  ],
  "recommendations": [...],
  "completedAt": "2026-02-28T10:05:00Z"
}

Response 202 Accepted (if in progress):
{
  "jobId": "job-xxx",
  "status": "processing",
  "progress": 65
}

Response 404 Not Found:
{
  "error": "job_not_found"
}
```

**Public Audit Access:**
```
GET /api/audit/{auditToken}/compliance
(No authorization required; token authenticates)

Response 200 OK:
{
  "projectId": "proj-xxx",
  "organization": "Acme Construction",
  "analysisDate": "2026-02-28T10:00:00Z",
  "complianceScore": "A",
  "auditTrail": [
    {
      "timestamp": "2026-02-28T10:00:00Z",
      "action": "analysis_started",
      "actor": "system"
    },
    {
      "timestamp": "2026-02-28T10:05:00Z",
      "action": "analysis_completed",
      "actor": "system",
      "result": "A"
    }
  ],
  "evidence": [
    {
      "type": "document",
      "fileName": "budget-breakdown.pdf",
      "uploadedAt": "2026-02-20T00:00:00Z"
    }
  ],
  "expiresAt": "2026-03-07T10:00:00Z"
}
```

**Real-time Progress (WebSocket):**
```
GET /api/analysis/{jobId}/subscribe
Upgrade: websocket

Incoming messages:
{
  "type": "progress",
  "stage": "scoring",
  "percent": 65,
  "message": "Evaluating safety compliance..."
}

{
  "type": "completed",
  "result": {...}
}

{
  "type": "error",
  "message": "Analysis failed: ..."
}
```

#### Technology Stack
- **Framework:** Express.js 4.18+
- **Authentication:** Supabase Auth (JWT)
- **Real-time:** Socket.io or Supabase Realtime
- **Queue Integration:** Bull/BullMQ
- **Validation:** Zod schemas

#### Deployment
- Docker container (Railway)
- Horizontal scalable (stateless)
- Environment: Production, Staging, Development

---

### 2. EXTRACTION WORKER (Node.js)

#### Purpose
Continuous worker that processes regulatory documents, extracts obligations, generates embeddings, and maintains searchable knowledge base.

#### Responsibilities
- Poll for pending document ingestions
- Download documents from Supabase Storage
- Extract text (PDF, DOCX, XLSX, OCR images)
- Clean and normalize text
- Chunk intelligently (2500 char hard limit with context overlap)
- Call LLM for obligation extraction
- Generate vector embeddings (OpenAI API)
- Persist obligations and embeddings to database
- Update ingestion status and progress

#### Key Process
```
1. Poll knowledge_documents WHERE status = 'pending'
2. Lock document (atomic update) → status = 'processing'
3. Download from storage (knowledge-files bucket)
4. Extract text (detectSourceType + appropriate extractor)
5. Clean text (normalize line endings, remove headers)
6. Structure sections (h1, h2 detection)
7. Smart chunk (preserving semantic boundaries)
8. For each chunk:
   a. Call LLM → extractObligationsFromChunk()
   b. Validate obligations (JSON schema)
   c. Call OpenAI Embeddings API
   d. INSERT into knowledge_chunks + embeddings
9. Update document status → 'completed'
10. Handle failures → status = 'failed', log error
```

#### Configuration
```javascript
const CHUNK_SIZE = 2500;           // Hard-coded, runtime verified
const BATCH_SIZE = 50;             // Insert chunks in batches
const POLL_INTERVAL = 10000;       // 10 seconds
const EMBEDDING_DIMENSION = 1536;  // OpenAI embeddings
const BUILD_ID = "NUCLEAR_VERIFY_2500_V1";  // Immutable verification
```

#### Critical Properties
- **Exactly-once semantics:** Atomic document locking prevents duplicate processing
- **Hard chunk size enforcement:** Runtime verifications ensure 2500 char limit never violated
- **Resumable failures:** Failed documents can be reprocessed
- **Progress tracking:** Database updates track ingestion_progress (10%, 30%, 50%, 100%)

#### Technology Stack
- **Framework:** Node.js 18+
- **Supabase Client:** @supabase/supabase-js
- **Text Extraction:**
  - PDF: pdfjs or pdfparse
  - DOCX: docx library
  - XLSX: xlsx library
  - Images: Google Vision API
- **Embeddings:** OpenAI API (gpt-4o-mini for extraction, text-embedding-3-small for embeddings)
- **Storage:** Supabase Storage
- **Database:** Supabase PostgreSQL

#### Deployment
- Standalone Node.js process (Railway)
- Single instance (no horizontal scaling, queuing via Supabase status)
- Runs continuously (background service)
- Restarts on crash (Docker restart policy: always)

#### Monitoring
- Health check: Process alive check every 30s
- Metrics: Documents processed/hour, average latency, error rate
- Logging: Structured JSON logs (timestamp, step, status, metrics)

---

### 3. ANALYSIS WORKER (Async Job Processor)

#### Purpose
On-demand worker that scores projects against regulatory obligations, generates compliance reports, and stores results.

#### Responsibilities
- Consume jobs from analysis_jobs queue
- Load project context (metadata, constraints, risk tolerance)
- Query relevant obligations (semantic search)
- Multi-dimensional scoring:
  - Safety compliance
  - Quality standards
  - Schedule feasibility
  - Budget impact
  - HR requirements
  - Environmental constraints
- Risk identification and ranking
- Remediation recommendations
- Persist analysis_results
- Emit completion event (webhook/SSE)

#### Key Process
```
1. Dequeue analysis_job
2. Load project context
3. Search relevant obligations (semantic query)
4. For each obligation:
   a. Score against project constraints
   b. Assess risk if violated
   c. Identify remediation steps
5. Aggregate scores → weighted compliance score (A-F)
6. Rank risks by impact
7. Generate recommendations
8. Store analysis_results
9. Emit completion event
10. Mark job as 'completed'
```

#### Scoring Algorithm (Pseudo-code)
```
complianceScore = calculateWeightedScore(
  safetyScore: score(obligations.safety, project.safety_tolerance),
  qualityScore: score(obligations.quality, project.quality_requirements),
  scheduleScore: score(obligations.timeline, project.schedule),
  budgetScore: score(obligations.cost, project.budget),
  hrScore: score(obligations.staffing, project.available_resources),
  environmentScore: score(obligations.environmental, project.location)
)

For each dimension:
  riskLevel = 1 - complianceScore_dimension
  riskSeverity = max(obligation.severity) in dimension
  riskImpact = riskLevel * riskSeverity

risks.add(
  category: dimension,
  severity: CRITICAL | HIGH | MEDIUM | LOW,
  description: generate_text(obligation, gap),
  relatedObligations: [obligation.id...]
)

Sort risks by impact DESC
```

#### Technology Stack
- **Queue:** Bull (Redis-backed job queue)
- **Scheduling:** node-schedule or Cron
- **LLM:** OpenAI or Anthropic (for remediation text generation)
- **Vector Search:** Supabase pgvector
- **Database:** Supabase PostgreSQL
- **Events:** WebSocket or Webhook

#### Deployment
- Containerized Node.js worker
- Horizontally scalable (multiple instances consuming same queue)
- Auto-scaling based on queue depth
- Health check: Job processing latency <60s p95

---

### 4. GEOGRAPHIC CONTEXT SERVICE (Microservice)

#### Purpose
Provide location-specific regulatory overlays and constraint data.

#### Responsibilities
- District/region constraint lookup
- Urban planning data retrieval (PLU, PLUI)
- Utility network availability checks
- Environmental hazard mapping
- Tax/subsidy eligibility assessment
- Labor market data (regional costs, availability)
- Caching strategy (minimize external API calls)

#### API Contract
```
GET /api/geographic-context/{latitude}/{longitude}
Authorization: Bearer {service-token}

Response 200 OK:
{
  "commune": "Paris 5",
  "department": "75",
  "region": "Île-de-France",
  "constraints": {
    "urbanPlanning": {
      "zoneType": "UB",
      "maxHeightMeters": 31,
      "constructionDensity": 0.6,
      "regulations": ["PLU-2023-rev1"]
    },
    "utilities": {
      "waterAvailable": true,
      "sewerAvailable": true,
      "electricityDistance": 50,  // meters
      "telecombAvailable": true
    },
    "environmental": {
      "floodRisk": "low",
      "seismicZone": 2,
      "soilContamination": "none",
      "historicalLandmarks": false
    },
    "subsidies": [
      "MaPrimeRenov",
      "CEE",
      "EcoPTZ"
    ],
    "laborMarket": {
      "avgConstructionWageEUR": 2500,
      "availability": 0.85  // 85% availability
    }
  },
  "expiresAt": "2027-02-28T00:00:00Z"  // Cache TTL
}
```

#### Data Sources
- **Urban Planning:** OpenDataFrance (communes)
- **Utilities:** Network operators, IGN databases
- **Environmental:** BRGM (geological), flood databases
- **Subsidies:** ADEME databases
- **Labor:** INSEE, regional economic data

#### Caching Strategy
- **Level 1:** In-memory cache (500 districts, 12-hour TTL)
- **Level 2:** Redis (full dataset, 24-hour TTL)
- **Level 3:** Database (reference data, updated nightly)
- **Invalidation:** On new regulation effective date

#### Technology Stack
- **Framework:** Express.js or Fastify
- **Caching:** Redis + in-memory LRU
- **Database:** PostgreSQL (reference tables) or MongoDB
- **External APIs:** OpenDataFrance, BRGM, etc.
- **Async:** Bull for nightly data updates

#### Deployment
- Separate container (microservice pattern)
- Load balanced (stateless)
- Non-blocking failure (Analysis Worker uses fallback if unavailable)
- Status page: Uptime >99.5%

#### Integration Point
Analysis Worker makes RPC call during scoring:
```javascript
const context = await geographicService.getContext(project.latitude, project.longitude);
// Use context.constraints in scoring algorithm
// If unavailable, continue with default constraints
```

---

## MULTI-TENANT DATA MODEL

### Principle
All data is scoped by `organization_id`. No cross-organization visibility.

### Core Tables

```sql
-- Organizations (top-level tenant)
CREATE TABLE organizations (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP,
  -- metadata...
);

-- Profiles (users belong to organization)
CREATE TABLE profiles (
  id UUID PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES organizations(id),
  user_id UUID NOT NULL (from auth.users),
  role TEXT CHECK (role IN ('admin', 'manager', 'analyst', 'viewer')),
  -- scoped to organization
);

-- Projects (organization owns projects)
CREATE TABLE projects (
  id UUID PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES organizations(id),
  name TEXT NOT NULL,
  -- project metadata (budget, timeline, phase, métier)
);

-- Analysis Jobs (scoped by organization)
CREATE TABLE analysis_jobs (
  id UUID PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES organizations(id),
  project_id UUID NOT NULL REFERENCES projects(id),
  status TEXT CHECK (status IN ('queued', 'processing', 'completed', 'failed')),
  created_by UUID REFERENCES profiles(id),
  -- job metadata
);

-- Analysis Results (scoped by organization)
CREATE TABLE analysis_results (
  id UUID PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES organizations(id),
  job_id UUID NOT NULL REFERENCES analysis_jobs(id),
  compliance_score TEXT,
  risks JSONB,  -- structured risk array
  recommendations JSONB,
  created_at TIMESTAMP,
);

-- Audit Log (scoped by organization, immutable)
CREATE TABLE audit_log (
  id UUID PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES organizations(id),
  user_id UUID REFERENCES profiles(id),
  action TEXT,
  resource_type TEXT,
  resource_id TEXT,
  old_values JSONB,
  new_values JSONB,
  created_at TIMESTAMP,
  -- IMMUTABLE: no updates/deletes after creation
);

-- Audit Tokens (time-limited, scoped)
CREATE TABLE audit_tokens (
  id UUID PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES organizations(id),
  project_id UUID NOT NULL REFERENCES projects(id),
  token_hash TEXT NOT NULL UNIQUE,  -- hashed token
  created_by UUID REFERENCES profiles(id),
  expires_at TIMESTAMP,
  scope TEXT CHECK (scope IN ('read_analysis', 'read_evidence', 'full_audit')),
  created_at TIMESTAMP,
  revoked_at TIMESTAMP,
);
```

### RLS Policy Example
```sql
-- projects: Users see only their organization's projects
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_see_org_projects" ON projects
  FOR SELECT
  USING (
    organization_id = (
      SELECT organization_id FROM profiles
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "users_modify_org_projects" ON projects
  FOR UPDATE
  USING (
    organization_id = (
      SELECT organization_id FROM profiles
      WHERE user_id = auth.uid()
    )
    AND (SELECT role FROM profiles WHERE user_id = auth.uid()) IN ('admin', 'manager')
  );
```

---

## ASYNCHRONOUS ANALYSIS FLOW

### User Submits Analysis Request

```
User clicks "Analyze Project"
        ↓
Frontend: POST /api/projects/{projectId}/analysis
        ↓
API Gateway:
  1. Validate JWT (authentication)
  2. Check organization_id matches (authorization)
  3. Validate request body (Zod schema)
  4. Create analysis_job record (status='queued')
  5. Enqueue job to Bull queue
  6. Return 202 Accepted {jobId}
        ↓
Frontend: Subscribe to progress (WebSocket)
  WebSocket: /api/analysis/{jobId}/subscribe
        ↓
Bull Queue:
  Job waits (with exponential backoff retry on failure)
        ↓
Analysis Worker picks up job
  1. Load project context
  2. Update job status → 'processing'
  3. Emit progress: 0% (via WebSocket)
  4. Query relevant obligations (semantic search)
  5. Emit progress: 30%
  6. Score across dimensions
  7. Emit progress: 70%
  8. Generate recommendations
  9. Emit progress: 90%
  10. INSERT analysis_results
  11. Emit completion + full result
  12. Mark job → 'completed'
        ↓
Frontend receives completion event
  Show results to user
```

### Error Handling
```
If Analysis Worker crashes/times out:
  1. Job marked as failed
  2. Error logged with stack trace
  3. Retry scheduled (exponential backoff: 1s, 10s, 60s, 5min)
  4. After 3 failed retries, mark job as permanently failed
  5. Frontend notified of failure

If LLM API timeout:
  1. Caught in worker
  2. Partial result saved (what completed)
  3. Retry queued
  4. User can view partial analysis if desired
```

---

## PUBLIC AUDIT ACCESS PROTOCOL

### Compliance Officer Scenario
```
1. Organization generates audit token
   POST /api/audit-tokens
   {
     "projectId": "proj-xxx",
     "scope": "read_analysis",
     "expiresIn": "7d"
   }
   → Response: {token: "atk_xxxx"}

2. Token shared with auditor (email/PDF/link)

3. Auditor accesses via public endpoint
   GET /api/audit/{token}/compliance
   (No auth header needed; token authenticates)
   → Response: Analysis results + audit trail + evidence list

4. Auditor can download evidence
   GET /api/audit/{token}/evidence/{evidenceId}
   → Download document

5. Token expires automatically after 7 days
   (or organization revokes manually)
```

### Technical Implementation
```javascript
// API route: /api/audit/{token}/compliance
export async function getAuditCompliancePublic(req, res) {
  const token = req.params.token;

  // Look up token hash
  const auditToken = await db.auditTokens.findOne({
    token_hash: hash(token),
    expires_at: {$gt: new Date()},
    revoked_at: null
  });

  if (!auditToken) {
    return res.status(404).json({error: 'invalid_token'});
  }

  // Verify scope
  if (!auditToken.scope.includes('read_analysis')) {
    return res.status(403).json({error: 'insufficient_scope'});
  }

  // Retrieve analysis result
  const analysis = await db.analysisResults.findOne({
    project_id: auditToken.project_id,
    organization_id: auditToken.organization_id
  });

  // Retrieve audit trail
  const auditTrail = await db.auditLog.find({
    organization_id: auditToken.organization_id,
    resource_id: auditToken.project_id
  });

  // Return public view
  return res.json({
    analysis: {
      complianceScore: analysis.compliance_score,
      risks: analysis.risks,
      completedAt: analysis.created_at
    },
    auditTrail: auditTrail.map(log => ({
      timestamp: log.created_at,
      action: log.action,
      actor: log.action_source
    })),
    expiresAt: auditToken.expires_at
  });
}
```

---

## DEPLOYMENT TOPOLOGY

```
Production Environment:
├─ API Gateway (Express)
│  ├─ 2-3 instances (load balanced)
│  ├─ Horizontal scaling based on RPS
│  └─ CDN for static assets
├─ Extraction Worker
│  ├─ 1 instance (sequential processing)
│  └─ Scheduled restarts for updates
├─ Analysis Workers
│  ├─ 2-5 instances (auto-scale by queue depth)
│  └─ Bull queue (Redis-backed)
├─ Geographic Context Service
│  ├─ 1-2 instances (fault tolerant)
│  └─ Redis cache layer
├─ Supabase (managed)
│  ├─ PostgreSQL (primary + read replicas)
│  ├─ Storage (PDF, evidence files)
│  ├─ Auth (JWT tokens)
│  └─ Realtime (WebSocket)
└─ LLM APIs
   ├─ OpenAI (gpt-4o-mini, embeddings)
   └─ Anthropic (fallback/batch)
```

---

## REFERENCE DOCUMENTATION

See PROJECT_CONTEXT.md for product vision and roadmap.

See DECISIONS_LOG.md for architectural decisions and trade-offs.
