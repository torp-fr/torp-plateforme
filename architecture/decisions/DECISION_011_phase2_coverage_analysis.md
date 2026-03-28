# DECISION 011: Phase 2 — Coverage Analysis & Recommendations Engine

**Status:** ADOPTED (implemented in production)
**Date:** 2026-03-27
**Deciders:** Tech Lead
**Affected Parties:** Audit Engine, Reasoning Layer, Frontend (Phase 3)

---

## Context

Phase 1 built the regulatory knowledge base (258 documents, 78,857 rules, 12,641 chunks).
The gap was: *given a devis and a project type, which rules apply — and which are missing?*

### Problem Statement

Before Phase 2:
- Devis completeness check: manual and unreliable
- Rule coverage: impossible to compute (lot→domain mapping broken → 0 rules loaded)
- Recommendations: ad-hoc, domain-agnostic, not prioritized
- Risk assessment: heuristic (severity counts), not coverage-driven

### Root Cause: Broken Domain Mapping

The lot.engine categories (`electricite`, `plomberie`) did not match the DB domain names
(`électrique`, `hydraulique`), causing rule.engine to load 0 rules for every analysis.
Fix: added `LOT_TO_DOMAIN` map + `domain` field on `NormalizedLot`.

### Requirements

1. **Coverage Analysis:** Devis lines vs. applicable rules → explicit/implicit/gap
2. **Intelligent Domain Deduction:** projectType → impliedDomains (fallback if lot detection weak)
3. **Recommendation Priority:** Gaps → actionable tasks with critical/high/medium/low priority
4. **Audit Report:** Structured JSON output with `risk_level` + `compliance_verdict`

---

## Decision

Implement Phase 2 as a 4-service reasoning pipeline in `src/core/reasoning/`:

```
projectData { type, devisLines }
       ↓ [ContextDeductionEngine]
impliedDomains: ['structure', 'hydraulique', 'électrique', ...]
       ↓ [lot.engine (improved) + rule.engine (UNION)]
applicableRules: RuleInput[]   (up to 78,857 filtered by domain)
       ↓ [CoverageAnalyzer]
CoverageReport { coverage_pct, explicit, implicit, gaps, strengths, risk_domains }
       ↓ [RecommendationGenerator]
Recommendation[] { priority, domain, action, rationale, effort, gap_count }
       ↓ [AuditReportGenerator]
AuditReport { executive_summary, coverage, recommendations, compliance_verdict }
```

### Components

#### 1. ContextDeductionEngine
**File:** `src/core/reasoning/contextDeduction.service.ts`

- Maps `projectType` → `impliedDomains` (valid DB domain names)
- 26 project types defined: piscine, maison_neuve, renovation, erp, etc.
- Confidence level: high/medium/low per type
- Fallback: `['structure']` if type unknown or null
- Integration: called by orchestrator before `runLotEngine()`

#### 2. RuleKeywordExtractor
**File:** `src/core/reasoning/ruleKeywordExtractor.service.ts`

- Input: `rule.description` + `rule.property_key` (snake_case)
- Output: deduplicated keyword set, normalized (accents removed, lowercased)
- Bonus: `property_key` terms rank first (stronger signal than description)
- Extras: `coverageScore()`, `normalizeDevisText()`, `levenshteinDistance()`, `fuzzyKeywordMatch()`
- Pure TypeScript — zero external dependencies

#### 3. CoverageAnalyzer
**File:** `src/core/reasoning/coverageAnalyzer.service.ts`

- Tiered analysis per rule:
  - **explicit** (score ≥ 0.25): rule keywords found in devis text
  - **implicit** (domain match): devis works in rule's domain but no specific terms
  - **gap** (neither): true lacuna — reported as `CoverageGap`
- Produces: `CoverageReport` with `top_gaps` (sorted by severity), `strengths`, `risk_domains`
- Threshold configurable via `options.thresholdExplicit` (default: 0.25)

#### 4. RecommendationGenerator
**File:** `src/core/reasoning/recommendationGenerator.service.ts`

- Groups gaps by `(domain × severity)` — one recommendation per group
- Priority: `high` severity → `critical`; `medium` with ≥3 gaps → `high`; etc.
- Domain templates (`DOMAIN_ACTIONS`): 9 domains with specific actions + regulatory references
- Default action for unknown domains
- Output: sorted by priority, limited to `maxRecs` (default: 10)

#### 5. AuditReportGenerator
**File:** `src/core/reasoning/auditReportGenerator.service.ts`

- Risk level from `coverage_pct`:
  ```
  < 50%    → critical  → verdict: critique
  50–69%   → high      → verdict: non_conforme
  70–84%   → medium    → verdict: attention
  ≥ 85%    → low       → verdict: conforme
  ```
- Key findings: 2–4 sentences built from coverage stats, high-severity gaps, risk domains, strengths
- Audit version: `1.0`

---

## Integration Points

### Point 1 — Orchestrator (before Moteur 2)
```typescript
// src/core/platform/engineOrchestrator.ts
import { enrichWithImpliedDomains } from '@/core/reasoning/contextDeduction.service';
const enriched = enrichWithImpliedDomains(executionContext.projectData ?? {});
executionContext.impliedDomains = enriched.impliedDomains;
```

### Point 2 — Rule Engine (Moteur 3)
```typescript
// src/core/engines/rule.engine.ts
const lotDomains = normalizedLots.map((l) => l.domain).filter(Boolean);
const impliedDomains = executionContext.impliedDomains ?? [];
const domains = [...new Set([...lotDomains, ...impliedDomains])];
// UNION prevents gaps when lot.engine is weak
```

### Point 3 — Audit Engine (Moteur 6)
```typescript
// src/core/engines/audit.engine.ts (v1.1)
interface AuditEngineResult {
  report: AuditReport;
  coverageAudit?: CoverageAuditReport;  // ← NEW in Phase 2
  status: 'completed' | 'partial' | 'error';
  warnings: string[];
}
// coverageAudit populated if projectData.devisLines present
```

---

## Consequences

### Positive
- **Visibility:** `coverage_pct` tells users exactly how complete their devis is
- **Actionable:** Recommendations grouped by domain with regulatory references
- **Resilient:** `impliedDomains` fallback ensures rules load even when lot detection fails
- **Backward-compatible:** `coverageAudit` is optional — existing pipeline unaffected
- **Extensible:** Keyword → semantic similarity upgrade path is clear (see Mitigations)
- **Test coverage:** 27/27 E2E tests passing, 0 TypeScript errors

### Negative / Trade-offs
- **Keyword matching:** substring-based, not semantic → false positives/negatives possible
- **Hard-coded taxonomy:** 26 project types — not ML-adaptive
- **Lot detection ceiling:** ~80% accuracy on real devis (regex-based structural limit)
- **Threshold fragility:** 0.25 explicit threshold tuned on few examples
- **Activation condition:** `coverageAudit` only runs if `projectData.devisLines` populated (requires frontend integration in Phase 3)

### Mitigations
| Trade-off | Mitigation | When |
|-----------|-----------|------|
| Keyword matching | Semantic embeddings (pgvector cosine) | Phase 3 backlog |
| Hard-coded taxonomy | Learn from real project data | Phase 4+ |
| Threshold fragility | Tune with real client devis | After Phase 3 frontend |
| Lot detection ceiling | impliedDomains covers 100% of domains | Already implemented |

---

## Implementation Notes

```
Files created (new):
  src/core/reasoning/contextDeduction.service.ts
  src/core/reasoning/ruleKeywordExtractor.service.ts
  src/core/reasoning/coverageAnalyzer.service.ts
  src/core/reasoning/recommendationGenerator.service.ts
  src/core/reasoning/auditReportGenerator.service.ts
  src/core/reasoning/__tests__/contextDeduction.test.ts
  scripts/test-full-audit.ts

Files modified:
  src/core/engines/lot.engine.ts      (LOT_TO_DOMAIN + domain field + 5 categories)
  src/core/engines/rule.engine.ts     (UNION lotDomains + impliedDomains)
  src/core/engines/audit.engine.ts    (v1.1: coverageAudit field + reasoning imports)
  src/core/platform/engineExecutionContext.ts  (+impliedDomains field)
  src/core/platform/engineOrchestrator.ts     (+enrichWithImpliedDomains call)

Test results:
  lot.engine tests:          54/54 PASSED
  contextDeduction tests:    21/21 PASSED
  test-full-audit E2E:       27/27 PASSED
  TypeScript errors:         0
  Commit:                    da6b392
```

---

## Alternatives Considered

1. **LLM-based coverage analysis:** Call Claude/GPT to evaluate devis vs. rules.
   *Rejected:* Latency (2-5s per call), cost ($), non-deterministic. Keyword extraction is instant and reproducible.

2. **Semantic similarity only (embeddings):** Use pgvector cosine similarity.
   *Deferred to Phase 3:* Requires embedding each devis line at query time (latency). Keyword matching is a fast, viable v1 that can be upgraded incrementally.

3. **Rule-by-rule display (no grouping):** Show every gap individually.
   *Rejected:* With 78k rules, this produces thousands of gaps. Grouping by domain reduces noise to 5-15 actionable recommendations.

4. **Static compliance checklist:** Hardcode what every devis must mention.
   *Rejected:* Not scalable across 9 domains + 78k rules. Would require constant manual maintenance.

---

## Related Decisions

- DECISION 4: Dual Pipeline (extraction vs. analysis) — Phase 2 is on the analysis side
- DECISION 8: Multi-Dimensional Compliance Scoring — Phase 2 adds a 5th dimension: coverage
- DECISION 9: Context-Aware Analysis — Phase 2 implements projectType → domain deduction
- (Future) DECISION 012: Semantic Coverage Analysis (Phase 3)
- (Future) DECISION 013: Coverage Score in Global Scoring (Phase 3)
- (Future) DECISION 014: Frontend Coverage Report UI (Phase 3)

---

## References

- Code: `src/core/reasoning/*.service.ts`
- Tests: `src/core/reasoning/__tests__/`, `scripts/test-full-audit.ts`
- Architecture analysis: `ARCHITECTURE_ANALYSIS_SESSION_2.md`
- Integration: `src/core/engines/audit.engine.ts` (v1.1)
- Transition doc: `DOSSIER_TRANSITION_SESSION_2.md`
