# DATA MODEL TARGET - TORP Regulatory Engine
**Version:** 1.0
**Date:** 28 février 2026
**Status:** Strategic Target Architecture
**Classification:** Core Infrastructure Design

---

## PURPOSE

This document defines the **target data model** for TORP's regulatory intelligence engine. It represents the long-term structure required for:
- **Auditability:** Complete traceability of analysis decisions
- **Reproducibility:** Exact reconstruction of past analyses
- **Certification:** Legal defensibility of compliance claims
- **Compliance:** RGPD/CNIL regulatory requirements
- **Scalability:** Multi-tenant organization-centric architecture

**NOT a current-state description.** This is the architecture TORP must achieve.

---

## ARCHITECTURAL PRINCIPLES

### Principle 1: Organization-Centric Scoping
All primary entities scoped by `organization_id`. No cross-organization visibility.

### Principle 2: Immutability of Analysis Results
`analysis_results` records are **write-once**. Corrections create new versions, never updates.

### Principle 3: Complete Input Capture
Every external input to analysis engine must be captured and versioned:
- LLM model + parameters
- Extraction prompts
- Regulatory knowledge version
- Geographic context snapshot
- Scoring profile configuration

### Principle 4: Temporal Freezing
All context at analysis moment is captured and frozen:
- Geographic constraints as of analysis date
- Regulatory obligations as they existed
- LLM capabilities as they were
- Scoring logic version applied

### Principle 5: Chain of Provenance
Every result must trace back to:
- Input regulatory documents
- Extraction decisions
- Scoring logic applied
- Geographic context used
- User actions that triggered analysis

---

## CORE ENTITIES

### 1. ORGANIZATIONS

**Role:** Top-level tenant boundary. Legal entity responsible for compliance claims.

**Relationships:**
- 1:N → profiles (team members)
- 1:N → projects
- 1:N → devis
- 1:N → analysis_jobs
- 1:N → audit_public_access_tokens
- 1:N → scoring_profiles (custom scoring rules)

**Critical Fields:**
```
organization_id          UUID PRIMARY KEY
name                     TEXT (legal name)
slug                     TEXT UNIQUE (URL-friendly identifier)
industry_focus           TEXT[] (list of métiers: maçonnerie, électricité, etc.)
risk_tolerance           TEXT (low | medium | high) - default scoring bias
regulatory_scope         JSONB {
  regions: TEXT[],
  frameworks: TEXT[] (DTU, Eurocodes, etc.)
}
created_at               TIMESTAMP (immutable)
metadata                 JSONB (logo, legal form, SIRET, etc.)
```

**Auditability Fields:**
```
subscription_tier        TEXT (basic | professional | enterprise)
created_by               UUID REFERENCES profiles(id)
billing_contact          TEXT (email)
```

**Status:** Currently implemented. Target: Expand `industry_focus`, add `risk_tolerance` defaults.

---

### 2. PROFILES

**Role:** Users within organizations. Team members with roles.

**Relationships:**
- N:1 → organizations
- 1:N → analysis_jobs (created_by)
- 1:N → audit_log (action_by)

**Critical Fields:**
```
profile_id               UUID PRIMARY KEY
organization_id          UUID NOT NULL (tenant boundary)
auth_user_id             UUID (from auth.users)
email                    TEXT UNIQUE
name                     TEXT
role                     TEXT (admin | manager | analyst | viewer)
permissions              TEXT[] (scoped by role)
created_at               TIMESTAMP (immutable)
```

**Status:** Partially implemented. Target: Add fine-grained permissions model.

---

### 3. PROJECTS

**Role:** Construction/renovation projects being analyzed. Owned by organization.

**Relationships:**
- N:1 → organizations
- 1:N → devis
- 1:N → analysis_jobs
- N:M → geographic_context_snapshots (current + historical)

**Critical Fields:**
```
project_id               UUID PRIMARY KEY
organization_id          UUID NOT NULL (tenant boundary, RLS)
name                     TEXT NOT NULL
description              LONGTEXT
scope                    JSONB {
  type: TEXT (new_build | renovation | maintenance),
  budget_eur: NUMERIC,
  timeline: {
    start: DATE,
    end: DATE
  },
  metiers: TEXT[] (maçonnerie, électricité, plomberie),
  phase: TEXT (conception | execution | controle)
}
geographic_context       JSONB (snapshot captured at project creation)
  ├─ latitude: FLOAT
  ├─ longitude: FLOAT
  ├─ commune: TEXT
  └─ snapshot_id: UUID → geographic_context_snapshots

risk_tolerance          TEXT (low | medium | high)
scoring_profile_id      UUID REFERENCES scoring_profiles(id) (org's custom rules)

created_at              TIMESTAMP (immutable)
updated_at              TIMESTAMP (when scope changes)
created_by              UUID REFERENCES profiles(id)
```

**Auditability Fields:**
```
last_analyzed_at        TIMESTAMP (latest analysis_job)
last_analysis_version   UUID REFERENCES engine_versions(id)
compliance_status       TEXT (pending | compliant | at_risk | non_compliant)
```

**Status:** Partially implemented. Target: Add geographic snapshot, scoring profile reference.

---

### 4. DEVIS (Quotes)

**Role:** Construction quotes/proposals. Analyzed for compliance and quality.

**Relationships:**
- N:1 → organizations
- N:1 → projects
- 1:N → analysis_jobs
- N:1 → analysis_results

**Critical Fields:**
```
devis_id                UUID PRIMARY KEY
organization_id         UUID NOT NULL (tenant boundary, RLS)
project_id              UUID NOT NULL (parent project)
supplier_name           TEXT
supplier_siret          TEXT (SIRET number for verification)
title                   TEXT
description             LONGTEXT
amount_eur              NUMERIC
line_items              JSONB[] {
  description: TEXT,
  quantity: NUMERIC,
  unit_price: NUMERIC,
  metier: TEXT
}
created_at              TIMESTAMP (immutable)
```

**Auditability Fields:**
```
source_file_id          UUID REFERENCES quote_uploads(id) (original PDF/document)
extracted_text_version  TEXT (hash of extraction)
analysis_status         TEXT (pending | analyzed | archived)
```

**Status:** Implemented. Target: Add traceability to extraction version.

---

### 5. ANALYSIS_JOBS

**Role:** Asynchronous job tracking. Decouples user request from execution.

**Relationships:**
- N:1 → organizations
- N:1 → projects
- N:1 → devis (optional, if quote-based analysis)
- 1:1 → analysis_results

**Critical Fields:**
```
job_id                  UUID PRIMARY KEY
organization_id         UUID NOT NULL (tenant boundary, RLS)
project_id              UUID NOT NULL
devis_id                UUID (optional - quote analysis)
status                  TEXT (queued | processing | completed | failed)

submitted_at            TIMESTAMP (immutable - when user clicked "Analyze")
started_at              TIMESTAMP (when worker picked up job)
completed_at            TIMESTAMP (when analysis finished)

submitted_by            UUID REFERENCES profiles(id)
requested_scope         TEXT (full | quick | custom)

# Engine configuration at submission time
engine_version_id       UUID REFERENCES engine_versions(id) (which engine?)
scoring_profile_id      UUID REFERENCES scoring_profiles(id) (which rules?)

# Target outputs
target_analysis_result  UUID REFERENCES analysis_results(id)
error_message           TEXT (if failed)
retry_count             INTEGER (0-3)
```

**Status:** Implemented. Target: Add engine_version_id, scoring_profile_id capture.

---

### 6. ANALYSIS_RESULTS

**Role:** Immutable record of completed analysis. The source of truth for compliance claims.

**CRITICAL:** Write-once. No updates. Corrections = new analysis job.

**Relationships:**
- N:1 → organizations
- N:1 → analysis_jobs
- N:1 → projects
- N:1 → devis (optional)
- N:1 → engine_versions (which engine ran)
- N:1 → regulatory_obligations_versions (which regulations)
- N:1 → geographic_context_snapshots (which geographic context)
- N:1 → llm_executions (detailed LLM call log)
- N:M → audit_log (audit trail)

**Critical Fields - IMMUTABLE:**
```
result_id               UUID PRIMARY KEY
organization_id         UUID NOT NULL (tenant boundary, RLS)
job_id                  UUID NOT NULL REFERENCES analysis_jobs(id)
project_id              UUID NOT NULL
devis_id                UUID (optional)

# EXECUTION CONTEXT (frozen at analysis time)
engine_version_id       UUID NOT NULL → engine_versions
  ├─ Which engine ran
  ├─ Version number
  └─ Algorithm parameters

regulatory_version_id   UUID NOT NULL → regulatory_obligations_versions
  ├─ Which regulations corpus
  ├─ Effective date
  └─ Source (DTU 2023 Q1, etc.)

scoring_profile_id      UUID NOT NULL → scoring_profiles
  ├─ Which scoring rules applied
  ├─ Weights
  └─ Organization-specific thresholds

geographic_context_snapshot_id  UUID NOT NULL → geographic_context_snapshots
  ├─ Frozen geographic constraints
  ├─ Environmental hazards
  └─ Utility availability

# PROMPT & LLM EXECUTION
prompt_version          TEXT (hash of extraction prompt at analysis time)
llm_model_id            UUID → llm_models (gpt-4o-mini, claude-3.5, etc.)
llm_temperature         FLOAT (0.0-1.0)
llm_top_p               FLOAT (sampling parameter)
llm_max_tokens          INTEGER
llm_execution_id        UUID → llm_executions (detailed call log)

# SCORING RESULTS
compliance_score        TEXT (A | B | C | D | F)
compliance_score_numeric  INTEGER (0-100)
dimensions              JSONB {
  safety: {score: INT, rank: INT},
  quality: {score: INT, rank: INT},
  schedule: {score: INT, rank: INT},
  budget: {score: INT, rank: INT},
  hr: {score: INT, rank: INT},
  environment: {score: INT, rank: INT}
}

# IDENTIFIED RISKS
risks                   JSONB[] {
  id: UUID,
  dimension: TEXT,
  severity: TEXT (CRITICAL | HIGH | MEDIUM | LOW),
  category: TEXT (safety_gap | quality_gap | schedule_conflict, etc.),
  description: TEXT,
  related_obligations: UUID[] → regulatory_obligations_v2,
  recommended_action: TEXT
}

# RECOMMENDATIONS
recommendations         JSONB[] {
  id: UUID,
  category: TEXT,
  priority: INT,
  description: TEXT,
  estimated_cost_eur: NUMERIC,
  estimated_days: INT,
  related_obligations: UUID[]
}

# METADATA
duration_ms             INTEGER (analysis execution time)
calculated_at           TIMESTAMP NOT NULL (immutable - when analysis completed)
```

**Auditability Fields:**
```
analyzed_by             UUID (system or user_id) - who triggered
validation_status       TEXT (validated | draft | superseded)
certification_status    TEXT (eligible | certified | revoked)
audit_token_generated   BOOLEAN (has public audit access been granted?)
```

**Status:** Partially implemented. Target: Add all versioning references (engine, regulatory, geographic, LLM).

---

### 7. REGULATORY_OBLIGATIONS_V2

**Role:** Extracted obligations from regulatory documents. Versioned, queryable, indexed.

**Relationships:**
- N:1 → knowledge_base_documents
- N:1 → regulatory_versions
- N:M → analysis_results (referenced in analysis)
- N:1 → organizations (extracted for org or global)

**Critical Fields:**
```
obligation_id           UUID PRIMARY KEY
organization_id         UUID (NULL = global; NOT NULL = org-specific)
regulatory_version_id   UUID NOT NULL → regulatory_versions
source_document_id      UUID (parent document)
article_reference       TEXT (e.g., "DTU 20.1 Article 5.2")

# OBLIGATION CONTENT
obligation_type         TEXT (exigence | interdiction | recommandation | tolérance)
obligation_text         TEXT (normalized text)
severity_level          INTEGER (1-5: 5=critical, 1=minor)
applicable_phases       TEXT[] (conception | execution | controle)
applicable_metiers      TEXT[] (maçonnerie | électricité | plomberie | all)

# SEMANTIC
embedding               VECTOR(1536) (OpenAI embeddings)
embedding_model         TEXT (text-embedding-3-small)
keywords                TEXT[] (for search)
related_obligations     UUID[] (cross-references)

# COMPLIANCE CONTEXT
sanction_risk          TEXT (faible | moyen | eleve)
legal_basis            TEXT (url or reference)
interpretation_notes   TEXT (judicial notes, if any)

extracted_at           TIMESTAMP (when extracted from document)
```

**Status:** Partially implemented. Target: Add `regulatory_version_id`, strict versioning.

---

### 8. ENGINE_VERSIONS (NEW TABLE)

**Role:** Tracks regulatory engine versions. Each version = fixed algorithm + parameters.

**CRITICAL:** Version is immutable reference point. Allows reproducibility.

**Relationships:**
- 1:N → analysis_results (which analyses used this version)
- 1:N → llm_prompts (prompts for this version)

**Critical Fields:**
```
engine_version_id       UUID PRIMARY KEY
organization_id         UUID (NULL = global; NOT NULL = org-specific)

# VERSIONING
semantic_version        TEXT (e.g., "1.2.3")
  ├─ MAJOR: Algorithm fundamentally changes (rescoring all past analyses?)
  ├─ MINOR: New scoring dimension, improved heuristic
  └─ PATCH: Bug fix, performance optimization

version_name            TEXT (e.g., "v1.2.3-regulatory-extraction-enhanced")
released_at             TIMESTAMP (when version deployed)

# ENGINE SPECIFICATION
algorithm_description   LONGTEXT (high-level algorithm)
algorithm_hash          TEXT (content hash of algorithm code)

dimensions              JSONB {
  safety: {weight: 0.4, description: TEXT},
  quality: {weight: 0.2, description: TEXT},
  schedule: {weight: 0.2, description: TEXT},
  budget: {weight: 0.1, description: TEXT},
  hr: {weight: 0.05, description: TEXT},
  environment: {weight: 0.05, description: TEXT}
}

scoring_logic           TEXT (or URL to algorithm doc)

# STATUS
status                  TEXT (draft | active | deprecated)
active_from             TIMESTAMP (when made active)
active_until            TIMESTAMP (when replaced)

# CHANGELOG
changelog_from_previous UUID REFERENCES engine_versions(id) (what changed)
breaking_changes        BOOLEAN (affects reproducibility?)
```

**Status:** Does not exist. MUST be created.

---

### 9. GEOGRAPHIC_CONTEXT_SNAPSHOTS (NEW TABLE)

**Role:** Frozen geographic constraints at analysis moment. Prevents retro-calculations.

**CRITICAL:** Immutable. No recalculation. What was true at analysis time stays true.

**Relationships:**
- 1:N → analysis_results (frozen context for that analysis)
- N:1 → organizations (if org-specific caching)

**Critical Fields:**
```
snapshot_id             UUID PRIMARY KEY
organization_id         UUID (optional - may be shared)

# LOCATION
latitude                FLOAT NOT NULL
longitude               FLOAT NOT NULL
commune                 TEXT (e.g., "Paris 5ème")
department              TEXT
region                  TEXT

# SNAPSHOT CONTENT (frozen at analysis time)
captured_at             TIMESTAMP NOT NULL (immutable)
valid_from              TIMESTAMP (effective date of this data)
valid_until             TIMESTAMP (expiration date of this data)

# CONSTRAINTS (all frozen)
constraints             JSONB {
  urbanPlanning: {
    zoneType: TEXT,
    maxHeightMeters: INT,
    constructionDensity: FLOAT,
    regulations: TEXT[]
  },
  utilities: {
    waterAvailable: BOOLEAN,
    sewerAvailable: BOOLEAN,
    electricityDistance: INT,
    telecombAvailable: BOOLEAN
  },
  environmental: {
    floodRisk: TEXT (low | medium | high),
    seismicZone: INT,
    soilContamination: TEXT,
    historicalLandmarks: BOOLEAN
  },
  subsidies: TEXT[] (MaPrimeRenov, CEE, etc.),
  laborMarket: {
    avgConstructionWageEUR: NUMERIC,
    availability: FLOAT
  }
}

# DATA LINEAGE
source                  TEXT (geographic_context_service API)
source_version          TEXT (API version that returned this)
data_hash               TEXT (integrity check)
```

**Status:** Does not exist. MUST be created.

---

### 10. REGULATORY_OBLIGATIONS_VERSIONS

**Role:** Tracks regulatory corpus versions. Which regulations applied when.

**Relationships:**
- 1:N → regulatory_obligations_v2
- 1:N → analysis_results (which regulations were in effect)

**Critical Fields:**
```
regulatory_version_id   UUID PRIMARY KEY
organization_id         UUID (NULL = global; NOT NULL = org-specific)

# VERSIONING
version_name            TEXT (e.g., "DTU-2023-Q2-v1.2")
semantic_version        TEXT (e.g., "1.2.0")
effective_date          DATE (when this version became active)
obsolete_date           DATE (when replaced)

# SOURCE
sources                 JSONB[] {
  standard: TEXT (DTU, Eurocodes, etc.),
  version: TEXT,
  published_date: DATE,
  url: TEXT (official reference)
}

# CONTENT HASH
content_hash            TEXT (hash of all obligations in this version)
obligation_count        INTEGER (total obligations in version)

# STATUS
status                  TEXT (draft | active | archived)

# CHANGELOG
changelog_from_previous UUID REFERENCES regulatory_obligations_versions(id)
added_obligation_ids    UUID[] (new obligations)
removed_obligation_ids  UUID[] (obsolete obligations)
modified_obligation_ids UUID[] (changed obligations)
```

**Status:** Does not exist. MUST be created.

---

### 11. SCORING_PROFILES

**Role:** Configurable scoring logic per organization. Allows custom thresholds.

**Relationships:**
- N:1 → organizations
- 1:N → projects (projects can reference custom profile)
- 1:N → analysis_results (which profile was applied)

**Critical Fields:**
```
profile_id              UUID PRIMARY KEY
organization_id         UUID NOT NULL
name                    TEXT (e.g., "Conservative Safety Focus")
description             TEXT

# WEIGHTS (customizable per org)
dimension_weights       JSONB {
  safety: FLOAT (0.0-1.0),
  quality: FLOAT,
  schedule: FLOAT,
  budget: FLOAT,
  hr: FLOAT,
  environment: FLOAT
}
  # Must sum to 1.0

# THRESHOLDS
passing_score_threshold INTEGER (e.g., 70 = needs >= 70 to pass)
risk_severity_mapping   JSONB {
  critical: {min_score: 0, max_score: 25},
  high: {min_score: 25, max_score: 50},
  medium: {min_score: 50, max_score: 75},
  low: {min_score: 75, max_score: 100}
}

# METADATA
is_default              BOOLEAN (default for org)
created_at              TIMESTAMP
created_by              UUID REFERENCES profiles(id)
```

**Status:** Does not exist. MUST be created.

---

### 12. LLM_MODELS

**Role:** Catalog of LLM models used. Tracks capabilities, pricing, parameters.

**Relationships:**
- 1:N → analysis_results (which model was used)
- 1:N → llm_executions (execution details)

**Critical Fields:**
```
model_id                UUID PRIMARY KEY
provider                TEXT (openai | anthropic | other)
model_name              TEXT (gpt-4o-mini | claude-3.5-sonnet)

# CAPABILITIES
max_tokens              INTEGER
context_window          INTEGER
capabilities            JSONB {
  json_mode: BOOLEAN,
  vision: BOOLEAN,
  function_calling: BOOLEAN
}

# PARAMETERS (default)
temperature_default     FLOAT (0.0-1.0)
top_p_default           FLOAT
frequency_penalty       FLOAT
presence_penalty        FLOAT

# AVAILABILITY
available_from          TIMESTAMP
available_until         TIMESTAMP (NULL = ongoing)
status                  TEXT (available | deprecated | experimental)

# PRICING (for audit trail)
cost_per_1k_input       NUMERIC (USD)
cost_per_1k_output      NUMERIC (USD)

# VERSION TRACKING
release_date            DATE
release_notes           TEXT
```

**Status:** Does not exist. MUST be created.

---

### 13. LLM_EXECUTIONS

**Role:** Detailed log of LLM calls. Complete input/output for reproducibility.

**CRITICAL:** Write-once. Every LLM call logged for audit.

**Relationships:**
- N:1 → analysis_results (which analysis triggered this call)
- N:1 → llm_models (which model used)

**Critical Fields:**
```
execution_id            UUID PRIMARY KEY
analysis_result_id      UUID NOT NULL REFERENCES analysis_results(id)
model_id                UUID NOT NULL REFERENCES llm_models(id)

# REQUEST
prompt_text             TEXT (full prompt sent to LLM)
prompt_hash             TEXT (for deduplication)
system_message          TEXT (if different from default)
temperature             FLOAT
top_p                   FLOAT
max_tokens_requested    INTEGER

# RESPONSE
response_text           TEXT (full response from LLM)
response_hash           TEXT
tokens_input            INTEGER
tokens_output           INTEGER
finish_reason           TEXT (stop | length | content_filter)

# TIMING & COST
requested_at            TIMESTAMP NOT NULL
responded_at            TIMESTAMP
duration_ms             INTEGER
cost_usd                NUMERIC

# STATUS
success                 BOOLEAN
error_message           TEXT (if failed)

# REPRODUCIBILITY
seed                    INTEGER (if reproducible mode)
top_logprobs            JSONB (token probabilities for debugging)
```

**Status:** Does not exist. MUST be created.

---

### 14. AUDIT_PUBLIC_ACCESS

**Role:** Token-based public audit access. Limited-scope, time-bound.

**Relationships:**
- N:1 → organizations
- N:1 → analysis_results (specific result accessible)
- N:1 → projects

**Critical Fields:**
```
token_id                UUID PRIMARY KEY
organization_id         UUID NOT NULL
project_id              UUID NOT NULL
analysis_result_id      UUID NOT NULL (optional - specific result)

# TOKEN
token_hash              TEXT NOT NULL UNIQUE (hashed for security)
created_at              TIMESTAMP NOT NULL (immutable)
expires_at              TIMESTAMP NOT NULL
revoked_at              TIMESTAMP (NULL = active)

# ACCESS CONTROL
scope                   TEXT (read_score | read_risks | full_audit)
  ├─ read_score: Only compliance score
  ├─ read_risks: Score + risks + recommendations
  └─ full_audit: Everything + audit trail

max_accesses            INTEGER (NULL = unlimited)
accesses_used           INTEGER

# AUDIT
created_by              UUID REFERENCES profiles(id)
created_for             TEXT (description: "Insurance verification", etc.)
accessed_by             TEXT[] (IP addresses or identifiers)
```

**Status:** Does not exist. MUST be created.

---

## SCHEMA INTEGRITY CONSTRAINTS

### 1. Organization Boundary
```
Every primary entity must have organization_id.
RLS enforces: user can only see data for their organization.
Violation = security breach.
```

### 2. Immutability of Results
```
analysis_results table:
- No UPDATE permissions
- No DELETE permissions
- Only INSERT

Corrections = new analysis_jobs → new analysis_results
```

### 3. Temporal Integrity
```
- created_at, submitted_at, calculated_at: SET once, immutable
- No retroactive changes to analysis context
- Geographic snapshot frozen at analysis moment
- Regulatory version frozen at analysis moment
```

### 4. Referential Integrity
```
analysis_results must have:
- engine_version_id (NOT NULL)
- regulatory_version_id (NOT NULL)
- geographic_context_snapshot_id (NOT NULL)
- llm_model_id (NOT NULL)
- scoring_profile_id (NOT NULL)

If any is NULL → analysis is incomplete/invalid.
```

### 5. Versioning Chain
```
analysis_results → engine_version → algorithm (reproducible)
analysis_results → regulatory_version → obligations (reproducible)
analysis_results → geographic_snapshot → constraints (immutable)
analysis_results → llm_execution → prompt + response (auditable)
```

---

## MIGRATION PATH

### Phase 1: Core Tables (Q1 2026)
- ✅ organizations, profiles, projects (exist)
- ⚠️ Enhance: Add geo snapshot references, scoring profile references

### Phase 2: Versioning Infrastructure (Q2 2026)
- 📋 CREATE engine_versions
- 📋 CREATE regulatory_obligations_versions
- 📋 CREATE scoring_profiles
- 📋 CREATE geographic_context_snapshots
- ⚠️ ALTER analysis_results ADD version references

### Phase 3: LLM Audit Trail (Q2-Q3 2026)
- 📋 CREATE llm_models
- 📋 CREATE llm_executions
- ⚠️ ALTER analysis_results ADD llm_execution_id

### Phase 4: Public Access & Certification (Q3-Q4 2026)
- 📋 CREATE audit_public_access
- 📋 Implement token generation + revocation
- ✅ Implement public audit endpoints

---

## KEY REQUIREMENTS FOR CERTIFICATION

For TORP to achieve regulatory certification (liability insurance, government audit compliance):

1. **Complete Traceability**
   - Every analysis traces to all inputs
   - No missing version information
   - Audit trail unbroken

2. **Immutability**
   - analysis_results never modified
   - Corrections = new analysis (with audit trail)
   - Timestamps immutable

3. **Reproducibility**
   - Given same inputs + same engine version → same output
   - LLM calls logged (prompt + response)
   - Geographic context frozen
   - Regulatory version frozen

4. **Auditability**
   - Who performed analysis (created_by)
   - When (calculated_at)
   - With what rules (engine_version, regulatory_version, scoring_profile)
   - With what context (geographic_context_snapshot)
   - Using what LLM (llm_model, llm_execution)

5. **Public Verifiability**
   - Third parties (insurers, inspectors) can verify claims
   - Token-based access (no system access needed)
   - Tamper-evident (cryptographic hashing)

---

## SUCCESS METRICS FOR TARGET MODEL

| Metric | Target | Rationale |
|--------|--------|-----------|
| Analysis reproducibility | 100% | Same inputs → same output |
| Audit trail completeness | 100% | Zero missing versions |
| Data integrity violations | 0 | No constraint breaches |
| Cross-org data leaks | 0 | RLS enforcement |
| Certification readiness | Yes | Legal defensibility |

---

## APPENDIX: Field Type Reference

**UUID:** Unique identifier, immutable
**TEXT:** String, variable length
**LONGTEXT:** Large text (documents, descriptions)
**NUMERIC:** Decimal number (for money, precise calculations)
**INTEGER:** Whole number
**FLOAT:** Decimal for percentages/ratios
**BOOLEAN:** True/false
**TIMESTAMP:** Date + time with timezone
**DATE:** Date only
**JSONB:** Flexible nested structure (indexed, queryable)
**VECTOR(1536):** Embedding vector (pgvector extension)
**TEXT[]:** Array of strings
**UUID[]:** Array of identifiers

---

**Next:** See VERSIONING_POLICY.md for how these versions are managed.
