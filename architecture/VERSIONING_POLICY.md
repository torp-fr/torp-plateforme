# VERSIONING POLICY - TORP Regulatory Engine
**Version:** 1.0
**Date:** 28 février 2026
**Status:** Strategic Framework
**Classification:** Core Compliance Policy

---

## PURPOSE

This document establishes the **versioning framework** for TORP's regulatory intelligence engine. It ensures:
- **Reproducibility:** Any past analysis can be exactly recreated
- **Auditability:** Complete traceability of decision logic
- **Compliance:** RGPD audit trail + legal defensibility
- **Certification:** Insurance/government audit readiness
- **Evolution:** Engine can improve without invalidating past analyses

**This is not implementation guidance. This is the policy framework.**

---

## VERSIONING PRINCIPLES

### Principle 1: Immutable History
Past analyses remain unchanged forever. No retroactive recalculation.

### Principle 2: Complete Input Capture
Every external input to analysis is versioned and captured:
- Engine algorithm
- LLM model + parameters
- Extraction prompts
- Regulatory corpus
- Geographic context
- Scoring rules

### Principle 3: Semantic Versioning
Versions follow MAJOR.MINOR.PATCH scheme with clear semantics for breaking changes.

### Principle 4: Chain of Provenance
Every result traces to input versions. Audit trail unbroken.

### Principle 5: Never Delete
Deprecated versions remain in database for historical queries. No data destruction for compliance.

---

## 1. ENGINE VERSIONING

### 1.1 Version Format

**Semantic Versioning:** MAJOR.MINOR.PATCH

```
MAJOR (Breaking Change)
  └─ Algorithm fundamentally changed
  └─ Results likely differ from previous version
  └─ Past analyses may need review
  └─ Example: 1.0.0 → 2.0.0 (new scoring dimension added)

MINOR (Feature Addition)
  └─ New dimension or improved heuristic
  └─ Results may improve slightly
  └─ Past analyses still valid
  └─ Example: 1.2.0 → 1.3.0 (added environmental score)

PATCH (Bug Fix)
  └─ Logic corrected, no conceptual change
  └─ Results may change slightly (fixing error)
  └─ Past analyses valid but may have been incorrect
  └─ Example: 1.2.3 → 1.2.4 (fixed safety weight calculation)
```

### 1.2 Version Lifecycle

```
Development (draft)
    ↓
    Staging (tested against historical data)
    ↓
    Release (version released)
    ↓
    Active (in production, new analyses use this)
    ↓
    Deprecated (new analyses use newer version)
    ↓
    Archived (still accessible for historical queries, not used for new analyses)
```

### 1.3 Version Specification

Every engine version must document:

```
Semantic Version:       v1.2.3
Release Date:           2026-Q2
Status:                 active | deprecated | archived
Algorithm:              [link to algorithm documentation]
Release Notes:          [what changed from previous version]

# Scoring Dimensions
dimensions:
  - safety (weight: 0.40)
    └─ Criteria: [list of specific safety checks]
  - quality (weight: 0.20)
    └─ Criteria: [specific quality checks]
  - schedule (weight: 0.20)
    └─ Criteria: [timeline/feasibility checks]
  - budget (weight: 0.10)
    └─ Criteria: [cost constraint checks]
  - hr (weight: 0.05)
    └─ Criteria: [staffing/capability checks]
  - environment (weight: 0.05)
    └─ Criteria: [environmental impact checks]

Breaking Changes:       [if MAJOR version]
  └─ Incompatibilities with v1.1.x
  └─ Required migration steps (if any)

Active From:            [effective date for new analyses]
Active Until:           [date when replaced by newer version]

Algorithm Hash:         [SHA256 of algorithm code/spec]
```

### 1.4 Algorithm Change Protocol

**MAJOR Version Required If:**
1. Scoring dimension added or removed
2. Dimension weights rebalanced (>10% change)
3. Algorithm logic fundamentally changed
4. New input parameters required

**MINOR Version For:**
1. New optional scoring criteria
2. Improved heuristic within dimension
3. New risk category added
4. Better geographic context integration

**PATCH Version For:**
1. Bug fix (incorrect formula corrected)
2. Performance optimization
3. Typo/documentation fix
4. Non-functional refactor

### 1.5 Backward Compatibility

```
PATCH versions:  Fully backward-compatible
                 Same inputs → Same outputs (except bug fix)

MINOR versions:  Results may improve (scores typically +/- 5%)
                 No re-analysis required
                 Past analyses remain valid

MAJOR versions:  Results may differ significantly
                 May require re-analysis of critical projects
                 Past analyses still auditable (not deleted)
                 Transition period before mandatory upgrade
```

---

## 2. PROMPT VERSIONING

### 2.1 Prompt Hash Strategy

Every prompt sent to LLM is versioned via content hash:

```
prompt_hash = SHA256(system_prompt + user_prompt_template)
```

### 2.2 Prompt Evolution

```
Prompt v1 (Engine v1.0.0)
  System: "You are an expert in French building regulations..."
  User: "Extract obligations from: {text}"

Prompt v1.1 (Engine v1.1.0)
  System: [same]
  User: "Extract obligations from: {text}. Focus on safety-critical only."

Prompt v2 (Engine v2.0.0)
  System: "You are a regulatory compliance expert..."
  User: "Extract {obligation_type} from: {text}. Return JSON."
```

### 2.3 Prompt Immutability

Once a prompt version is released:
- No modification
- Bug fixes require new version (v1 → v1.1)
- Use new version going forward
- Old prompts accessible for historical queries

### 2.4 Prompt Audit Trail

```
analysis_results stores:
├─ prompt_version (hash)
├─ prompt_text (full prompt sent)
├─ llm_model_id (which model)
└─ llm_execution_id (complete input/output log)

If audit required:
  Retrieve llm_execution → See exact prompt + response
  Can verify: Same prompt → Same response (LLM determinism)
```

### 2.5 Prompt Change Impact

| Type | Impact | Version |
|------|--------|---------|
| Prompt clarification | +5% to accuracy | MINOR |
| Prompt format change | +10% impact | MAJOR |
| New prompt variable | Major change | MAJOR |
| Grammar fix | <1% impact | PATCH |
| New extraction goal | Fundamental change | MAJOR |

---

## 3. LLM VERSION MANAGEMENT

### 3.1 LLM Model Selection

```
analysis_results captures:
├─ model_id (which LLM)
│  └─ provider (openai | anthropic | other)
│  └─ model_name (gpt-4o-mini | claude-3.5-sonnet)
├─ model_version (API version if available)
├─ parameters:
│  ├─ temperature
│  ├─ top_p
│  ├─ max_tokens
│  └─ other settings
└─ llm_execution_id (complete call log)
```

### 3.2 Model Lifecycle

```
Experimental
  ├─ Testing against regulatory corpus
  └─ Not used for production analyses

Approved
  ├─ Performance metrics validated
  ├─ Cost acceptable
  └─ Ready for production

Active
  ├─ New analyses use this model
  ├─ Results captured with model_id
  └─ May be primary or fallback

Deprecated
  ├─ Newer model available
  ├─ No new analyses
  ├─ Existing analyses still reference this model

Archived
  ├─ Old model, no longer available from provider
  ├─ Historical data still references it
  └─ Reproducibility limited (provider may not support anymore)
```

### 3.3 Model Fallback

If primary LLM unavailable:

```
analysis_result = {
  primary_model_id: gpt-4o-mini,
  actual_model_id: claude-3.5-sonnet,
  fallback_reason: "openai_api_timeout",
  results: {...},
  warning: "Analyzed with fallback model"
}
```

**Important:** Result still valid. Audit trail shows fallback occurred.

### 3.4 LLM Provider Swap

If switching providers (e.g., OpenAI → Anthropic):

```
1. Run parallel testing (both models on historical data)
2. Compare accuracy metrics
3. Document differences
4. Create MINOR version of engine (with new LLM)
5. Deploy new version
6. Gradually shift new analyses to new version
7. Keep old version available for 6 months
8. Then mark as deprecated
```

**Result:** Audit trail shows which model was used. Both versions reproducible.

---

## 4. REGULATORY CORPUS VERSIONING

### 4.1 Regulatory Version Format

```
Regulatory Corpus Version: DTU-2026-Q1-v1.0

Components:
├─ DTU 20.1 (updated 2026-01-15)
├─ DTU 21 (updated 2025-06-01)
├─ Eurocodes (updated 2024-01-01)
├─ French Building Code (updated 2026-01-01)
└─ Local Regulations (PLU updates per région)
```

### 4.2 Obligation Versioning

```
Each obligation_id is immutable.
If regulation changes:
  ├─ Obligation retired (obsolete_date set)
  ├─ New obligation created (new obligation_id)
  └─ Cross-reference documented (old_id → new_id mapping)

Example:
  Obligation v1: "DTU 20.1 §5.2 - Max slope 30°"
  [Regulation changes in 2026]
  Obligation v1: [marked obsolete]
  Obligation v2: "DTU 20.1 §5.2 - Max slope 25° (effective 2026-Q1)"
```

### 4.3 Version Effective Date

```
regulatory_version record includes:
├─ effective_date (when regulations take effect)
├─ obsolete_date (when replaced)
└─ for analysis dating:
   If analysis submitted before effective_date:
     ├─ Use older regulatory version (what was in effect)
   If analysis submitted after effective_date:
     ├─ Use new regulatory version
```

### 4.4 Regulatory Update Process

```
New DTU published
  ↓
1. Extract obligations (same extraction engine)
2. Create new regulatory_version record
3. Mark previous version as obsolete
4. For future analyses: Use new version
5. For past analyses: Reference version from analysis date
  ↓
analysis_results.regulatory_version_id → immutable reference
  ├─ Can always look up: "What rules applied?"
  └─ Can always answer: "What should have been checked?"
```

### 4.5 Regulatory Corpus Snapshots

```
At analysis moment, capture:
├─ Which regulations were in effect
├─ Which obligations extracted from them
├─ Which obligation versions active
└─ Store regulatory_version_id in analysis_result

Future query:
  SELECT obligations, regulations
  WHERE analysis_result.regulatory_version_id = regulatory_version.id
  → Get exact regulations that applied
```

---

## 5. GEOGRAPHIC CONTEXT VERSIONING

### 5.1 Snapshot Principle

Geographic context is **captured and frozen** at analysis moment. Never recalculated.

```
analysis_job submitted (user clicks "Analyze")
  ↓
API creates: analysis_job
  ├─ project_id
  ├─ submitted_at (timestamp)
  └─ geographic_context_snapshot_id (NULL initially)
  ↓
Worker picks up job
  ├─ Load project geographic context
  ├─ Query geographic_context_service
  ├─ Create geographic_context_snapshots record
  │  ├─ Latitude, longitude
  │  ├─ District/region
  │  ├─ Constraints (flood risk, utilities, etc.)
  │  └─ captured_at = NOW
  ├─ Update analysis_job with snapshot_id
  └─ Proceed with analysis
  ↓
analysis_results stores geographic_context_snapshot_id
  → Audit trail shows: "This analysis used this geographic context"
  → If geographic data updates later: Past analyses unaffected
```

### 5.2 Geographic Version Lifecycle

```
Geographic Context Changes
  (New flood zone mapping released, utilities updated, etc.)

1. Update geographic_context_service (new data available)
2. New analyses query new data → get new snapshots
3. Old snapshots remain unchanged
4. Past analyses still reference old snapshots
   └─ Historical analysis unchanged
   └─ Can see: "This was analysis context at that time"

Example:
  Analysis A (2026-02-28): Used flood zone v1.2
  Analysis B (2026-04-15): Uses flood zone v2.0 (new data available)

  Both valid. Geographic context frozen at analysis moment.
```

### 5.3 Geographic Data Audit Trail

```
geographic_context_snapshots records:
├─ snapshot_id (immutable)
├─ captured_at (timestamp, immutable)
├─ constraints (frozen JSONB)
│  ├─ floodRisk: low (as of capture time)
│  ├─ utilities.sewerAvailable: true
│  └─ [etc.]
├─ source_version (which geographic_context_service returned this)
├─ data_hash (integrity check)
└─ valid_from / valid_until (data effective dates)

Reproducibility:
  Given same lat/lon + same snapshot_id → Same geographic context
```

---

## 6. SCORING PROFILE VERSIONING

### 6.1 Scoring Profile Structure

```
scoring_profile record:
├─ profile_id (UUID)
├─ organization_id (owner)
├─ name ("Conservative Safety Focus", etc.)
├─ dimension_weights:
│  ├─ safety: 0.40
│  ├─ quality: 0.20
│  ├─ schedule: 0.20
│  ├─ budget: 0.10
│  ├─ hr: 0.05
│  └─ environment: 0.05
├─ passing_threshold: 70
└─ created_at (immutable)
```

### 6.2 Profile Evolution

```
Organization customizes scoring (e.g., wants higher safety weight)

Scenario 1: Create new profile
  ├─ New profile_id
  ├─ Same organization_id
  ├─ New name ("Safety-Critical Focus v2")
  ├─ Different weights (safety: 0.50 instead of 0.40)
  └─ Old profile still exists (past analyses reference it)

Scenario 2: No change to profile
  ├─ Reuse existing profile_id
  ├─ analyses_results.scoring_profile_id → same profile

Outcome:
  analysis_results.scoring_profile_id immutably records which weights were used
  → Can always answer: "What scoring rules were applied?"
```

### 6.3 Profile Audit Trail

```
If organization changes scoring weights:
  1. Old profile archived (marked inactive)
  2. New profile created with new weights
  3. Future analyses use new profile
  4. Past analyses still reference old profile_id

result = {
  scoring_profile_id: profile_v1,  // Old weights (safety: 0.40)
  compliance_score: "A"
}

result2 = {
  scoring_profile_id: profile_v2,  // New weights (safety: 0.50)
  compliance_score: "A"
}

Both valid. Audit trail shows which profile applied.
```

---

## 7. COMPLETE ANALYSIS REPRODUCIBILITY

### 7.1 Recreating a Past Analysis

**Scenario:** Insurance company needs to audit analysis from 6 months ago.

**Steps:**

```
1. Retrieve analysis_result from database
   analysis_id = "result-xyz"

2. Get all version references:
   ├─ engine_version_id → Get algorithm spec
   ├─ regulatory_version_id → Get obligations in effect
   ├─ geographic_context_snapshot_id → Get frozen constraints
   ├─ scoring_profile_id → Get scoring weights
   ├─ llm_model_id → Get LLM model
   ├─ prompt_version → Get exact prompt
   └─ llm_execution_id → Get exact request/response

3. Inputs fully specified:
   ├─ Algorithm (engine_version → algorithm code)
   ├─ Regulations (regulatory_version → obligations)
   ├─ Geography (snapshot → constraints)
   ├─ Scoring rules (profile → weights)
   ├─ LLM call (execution → prompt + response)

4. Re-run with same inputs:
   ├─ Same engine version
   ├─ Same prompts to LLM
   ├─ Same geographic constraints
   ├─ Same scoring rules
   └─ → Should get ~same results (LLM determinism caveat)

5. Conclusion:
   "Analysis from Feb 28 used:
    - Engine v1.2.3
    - DTU-2026-Q1
    - Geographic snapshot from Feb 28
    - Safety weight 0.40
    - GPT-4o-mini with temperature 0.2
    Therefore analysis is reproducible and auditable."
```

### 7.2 What If LLM Model No Longer Available?

```
analysis_result references:
├─ llm_model_id = gpt-4-turbo (model now deprecated)
├─ llm_execution_id = exec-abc (has complete prompt + response)

Cannot re-run:
  ├─ gpt-4-turbo no longer available from OpenAI
  └─ Parameters may have been platform-specific

But CAN verify:
  ├─ Retrieve llm_execution record
  ├─ See exact prompt that was sent
  ├─ See exact response that came back
  ├─ Verify response matches stored result
  └─ Conclude: "Result is legitimate, came from this LLM call"

Immutable proof of LLM execution → Legal defensibility
```

---

## 8. IMMUTABILITY ENFORCEMENT

### 8.1 analysis_results Table Rules

```
CREATE TABLE analysis_results (
  ...
  result_id UUID PRIMARY KEY,
  ...
  calculated_at TIMESTAMP NOT NULL,
  ...
);

-- ENFORCE IMMUTABILITY
ALTER TABLE analysis_results DISABLE TRIGGER ALL;

-- Only INSERT allowed (via application)
-- No UPDATE permitted
-- No DELETE permitted

-- Set triggers to prevent updates
CREATE TRIGGER analysis_results_immutable_update
BEFORE UPDATE ON analysis_results
FOR EACH ROW EXECUTE FUNCTION prevent_update();

CREATE TRIGGER analysis_results_immutable_delete
BEFORE DELETE ON analysis_results
FOR EACH ROW EXECUTE FUNCTION prevent_delete();

-- Application attempts to correct error:
UPDATE analysis_results SET compliance_score = 'B' WHERE result_id = 'xyz'
  → DENIED (trigger blocks)

-- Correct process:
INSERT INTO analysis_jobs (project_id, type='correction', ...) → new job
  → New analysis_results record created
  → Old record remains unchanged
  → Audit trail shows both versions
```

### 8.2 Version Table Immutability

```
engine_versions, regulatory_obligations_versions, geographic_context_snapshots:
  → Once created, versions are immutable
  → Can mark as deprecated/obsolete
  → But historical data unchanged
  → Enables historical queries
```

---

## 9. AUDIT TRAIL PROTOCOL

### 9.1 Complete Event Logging

```
Every action logged to audit_log (immutable):

Event: User submits analysis
  ├─ timestamp: 2026-02-28 10:00:00
  ├─ user_id: user-xyz
  ├─ organization_id: org-abc
  ├─ action: analysis_submitted
  ├─ resource_type: project
  ├─ resource_id: project-123
  ├─ details: {scope: "full", engine_version: "v1.2.3"}

Event: Analysis job processing started
  ├─ timestamp: 2026-02-28 10:00:05
  ├─ system action (no user_id)
  ├─ action: job_processing_started
  ├─ details: {job_id: "job-456"}

Event: Analysis completed
  ├─ timestamp: 2026-02-28 10:00:30
  ├─ action: analysis_completed
  ├─ details: {
  │   result_id: "result-xyz",
  │   score: "A",
  │   duration_ms: 25000,
  │   engine_version_id: "v1.2.3",
  │   regulatory_version_id: "DTU-2026-Q1-v1.0"
  │ }

Audit response: Complete timeline of analysis from submission to completion.
```

### 9.2 Public Audit Token Protocol

```
Organization generates audit token:
  POST /api/audit-tokens
  {
    "result_id": "result-xyz",
    "scope": "full_audit",
    "expires_in": "7d"
  }

Token allows external auditor to access:
  GET /api/audit/{token}/analysis
  Response includes:
  ├─ Compliance score + dimensions
  ├─ Risks + recommendations
  ├─ Engine version used
  ├─ Regulatory version used
  ├─ LLM model + execution details
  ├─ Geographic context snapshot
  ├─ Scoring profile
  ├─ Audit trail (all events)
  └─ Evidence (uploaded documents)

Auditor can:
  ├─ Verify: "This analysis was legitimate"
  ├─ Understand: "This is how the score was calculated"
  ├─ Check: "Were all regulations considered?"
  └─ Conclude: "Result is defensible"
```

---

## 10. VERSION LIFECYCLE POLICIES

### 10.1 Active Version Duration

```
Engine Version Lifecycle:
├─ Draft: 1-2 weeks (testing)
├─ Active (released): 3-6 months (new analyses use this)
├─ Overlapping Transition: 1-2 months (both versions active)
├─ Deprecated: 6+ months (old analyses reference, no new uses)
└─ Archived: Forever (historical access only)

Regulatory Version Lifecycle:
├─ Active: Until new regulations published
├─ Obsolete: After new version active (30 day grace period)
├─ Archived: 5 years (legal retention minimum)

LLM Model Lifecycle:
├─ Active: While available from provider + in use
├─ Deprecated: When newer model used
├─ Archived: When provider discontinues
```

### 10.2 Backward Compatibility Window

```
PATCH versions:     Fully compatible (3+ years support)
MINOR versions:     ~2 years active + 1 year deprecated
MAJOR versions:     1 year active + 6 month transition

Guarantee:
  Any analysis from past 3+ years remains auditable.
  No data destruction for compliance reasons.
```

---

## 11. CERTIFICATION REQUIREMENTS

### 11.1 Audit-Ready Analysis

For analysis to be audit-ready (certifiable):

```
analysis_result MUST have:
├─ engine_version_id NOT NULL
├─ regulatory_version_id NOT NULL
├─ geographic_context_snapshot_id NOT NULL
├─ scoring_profile_id NOT NULL
├─ llm_model_id NOT NULL
├─ prompt_version NOT NULL
├─ llm_execution_id NOT NULL
├─ calculated_at NOT NULL (immutable)
├─ created_by NOT NULL
├─ audit_log entries (full trail)

If ANY is NULL:
  → Analysis is incomplete
  → Cannot be certified
  → Must be re-analyzed
```

### 11.2 Certification Checklist

```
For TORP to certify an analysis:

□ Engine version documented and available
□ Regulatory version documented (obligations in effect)
□ Geographic context captured (frozen)
□ Scoring profile captured (rules applied)
□ LLM execution logged (prompt + response)
□ Audit trail complete (all events)
□ Result immutable (no modifications)
□ User identity captured (who requested)
□ Timestamp immutable (when executed)
□ No retroactive changes
□ All dependencies versioned

Certification then means:
  "This analysis is legally defensible.
   All inputs documented. Process reproducible.
   Results can be audited by third parties.
   System integrity verified."
```

---

## 12. IMPLEMENTATION ROADMAP

### Phase 1 (Q1 2026): Core Versioning
- [ ] CREATE engine_versions table
- [ ] CREATE regulatory_obligations_versions table
- [ ] CREATE scoring_profiles table
- [ ] ALTER analysis_results ADD version foreign keys
- [ ] Implement immutability triggers

### Phase 2 (Q2 2026): LLM Audit Trail
- [ ] CREATE llm_models table
- [ ] CREATE llm_executions table
- [ ] Log all LLM calls to llm_executions
- [ ] Implement prompt versioning

### Phase 3 (Q2-Q3 2026): Geographic Snapshots
- [ ] CREATE geographic_context_snapshots table
- [ ] Capture snapshot at analysis moment
- [ ] Reference snapshot in analysis_results
- [ ] Remove retroactive geographic calculations

### Phase 4 (Q3-Q4 2026): Certification
- [ ] Implement audit token generation
- [ ] Create public audit API endpoints
- [ ] Implement certification workflow
- [ ] Insurance partner integration

---

## 13. COMPLIANCE ALIGNMENT

### RGPD Compliance
```
Article 32 (Audit Capability):
  ✓ TORP captures all user actions
  ✓ Audit trail immutable
  ✓ Retention policy documented
  → Auditable by CNIL

Article 25 (Privacy by Design):
  ✓ Versioning designed for auditability
  ✓ Immutability prevents tampering
  ✓ Public tokens prevent data leakage
  → Privacy-respecting architecture
```

### ISO 9001 Compliance
```
Quality Management:
  ✓ Version control (traceability)
  ✓ Change management (MAJOR/MINOR/PATCH)
  ✓ Configuration management (frozen inputs)
  → Quality assurance verifiable
```

### Building Code Compliance
```
Legal Defensibility:
  ✓ Regulations versioned (what applied)
  ✓ Analysis reproducible (can verify)
  ✓ Audit trail complete (proof)
  → Inspectors can audit analyses
```

---

## 14. SUCCESS METRICS

| Metric | Target | Rationale |
|--------|--------|-----------|
| Version completeness | 100% | No analyses missing version info |
| Immutability violations | 0 | No unauthorized modifications |
| Reproducibility rate | 95%+ | Same inputs → same output |
| Audit trail completeness | 100% | Zero missing events |
| Certification readiness | 100% | All analyses audit-ready |
| Third-party audit success | 100% | Inspectors can verify claims |

---

## APPENDIX: Version Record Template

```
Engine Version Record:

Version:                v1.2.3-regulatory-extraction-enhanced
Released:               2026-03-15
Status:                 active
Semantic Version:       1.2.3 (MINOR release)

Changed From:           v1.2.2
Breaking Changes:       None
New Features:           Added environmental compliance scoring
Bug Fixes:              Fixed safety weight calculation

Algorithm:              https://github.com/torp/engines/blob/v1.2.3/engine.md
Scoring Dimensions:
  - Safety (40%):       Check electrical, structural, fallback safety
  - Quality (20%):      Material standards, workmanship
  - Schedule (20%):     Timeline feasibility vs. building permits
  - Budget (10%):       Cost constraints vs. specification
  - HR (5%):            Staffing requirements
  - Environment (5%):   Environmental impact + certifications

Active Period:          2026-03-15 to [TBD - typically 6 months]
Compatibility:          1.2.2 compatible (MINOR upgrade)
```

---

**Next Steps:**

See DATA_MODEL_TARGET.md for schema requirements.

See DECISIONS_LOG.md for versioning decision rationale (DECISION 6, 7, 8, 9).

Implement according to roadmap (Phase 1-4).

---

**Document Status:** Strategic Policy Framework - Ready for Architecture Review
