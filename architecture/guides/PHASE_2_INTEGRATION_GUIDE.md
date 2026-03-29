# Phase 2 Integration Guide
**For:** Developers extending Phase 2 (Phase 3+)
**Status:** Active
**Last Updated:** 2026-03-27
**Decision:** [DECISION_011](../decisions/DECISION_011_phase2_coverage_analysis.md)

---

## Quick Reference — Service Location Map

```
src/core/reasoning/
├── contextDeduction.service.ts          ← projectType → impliedDomains
├── ruleKeywordExtractor.service.ts      ← text → keywords + coverageScore
├── coverageAnalyzer.service.ts          ← devisLines + rules → CoverageReport
├── recommendationGenerator.service.ts   ← CoverageGap[] → Recommendation[]
├── auditReportGenerator.service.ts      ← CoverageReport + Recs → AuditReport
└── __tests__/
    └── contextDeduction.test.ts         ← 21 tests (all PASSING)

scripts/
└── test-full-audit.ts                   ← 27 E2E tests (all PASSING)
```

---

## Integration Points

### Point 1 — Orchestrator (before Moteur 2: Lot Engine)

```typescript
// src/core/platform/engineOrchestrator.ts
import { enrichWithImpliedDomains } from '@/core/reasoning/contextDeduction.service';

// Called BEFORE runLotEngine():
const enriched = enrichWithImpliedDomains(executionContext.projectData ?? {});
executionContext.impliedDomains = enriched.impliedDomains;
// e.g. projectData.projectType = "piscine"
// → impliedDomains = ['structure', 'hydraulique', 'électrique', 'sécurité', 'thermique']
```

### Point 2 — Rule Engine (Moteur 3)

```typescript
// src/core/engines/rule.engine.ts
const lotDomains = normalizedLots
  .map((lot) => lot.domain)
  .filter((d): d is string => !!d);

const impliedDomains: string[] = executionContext.impliedDomains ?? [];
const domains = [...new Set<string>([...lotDomains, ...impliedDomains])];
// UNION ensures rules load even if lot.engine misses some domains
```

### Point 3 — Audit Engine (Moteur 6, v1.1)

```typescript
// src/core/engines/audit.engine.ts
import { analyzeCoverage } from '@/core/reasoning/coverageAnalyzer.service';
import { generateRecommendations } from '@/core/reasoning/recommendationGenerator.service';
import { generateAuditReport } from '@/core/reasoning/auditReportGenerator.service';

// coverageAudit activates when projectData.devisLines (or .lines / .items) is present:
const rawLines = executionContext.projectData?.devisLines
  ?? executionContext.projectData?.lines
  ?? executionContext.projectData?.items
  ?? [];

if (rawLines.length > 0 && applicableRules.length > 0) {
  const coverageReport = analyzeCoverage(devisLines, applicableRules);
  const recommendations = generateRecommendations(coverageReport.top_gaps);
  coverageAudit = generateAuditReport(projectName, projectType, coverageReport, recommendations);
}
```

---

## Data Flow Examples

### Example 1 — Piscine 8×4m (Expected: good coverage)

```
INPUT:
  projectType: "piscine"
  devisLines: [
    "Terrassement et fouilles bassin",
    "Structure béton armé ferraillage HA20",
    "Plomberie réseau filtration pompe 12m³/h",
    "Installation électrique NF C 15-100",
    "Revêtement carrelage anti-dérapant"
  ]

STEP 1 — ContextDeductionEngine:
  "piscine" → ['structure', 'hydraulique', 'électrique', 'sécurité', 'thermique']
  confidence: 'high'

STEP 2 — Lot Engine:
  "Terrassement" → structure  (domain: 'structure')
  "Plomberie"    → plomberie  (domain: 'hydraulique')
  "électrique"   → electricite (domain: 'électrique')
  lotDomains: ['structure', 'hydraulique', 'électrique']
  UNION impliedDomains → ['structure', 'hydraulique', 'électrique', 'sécurité', 'thermique']

STEP 3 — Rule Engine:
  Fetches 74,796 rules WHERE domain IN (...)

STEP 4 — CoverageAnalyzer:
  coverage_pct: ~65% (structure + hydraulique + électrique well covered)
  gaps: sécurité (barrière NF P90-306, alarme) + thermique (calcul déperditions)
  risk_domains: ['sécurité']

STEP 5 — RecommendationGenerator:
  [critical] sécurité — "Mentionner les dispositifs de sécurité (barrières, NF P90-306)"
  [low]      thermique — "Justifier la performance thermique (RT2020)"

STEP 6 — AuditReportGenerator:
  coverage_pct: 65% → risk_level: 'high' → verdict: 'non_conforme'
  key_finding: "2 règles à risque élevé non couvertes (sécurité)"

OUTPUT AuditReport:
  { risk_level: 'high', verdict: 'non_conforme', coverage: 65%, recommendations: [2] }
```

### Example 2 — Électricité seule (Expected: narrower scope)

```
INPUT:
  projectType: "electricite_seule"
  devisLines: [
    "Tableau électrique général TGBT",
    "Câblage circuits spécialisés",
    "Prises et interrupteurs"
  ]

STEP 1 — ContextDeductionEngine:
  "electricite_seule" → ['électrique', 'sécurité']

STEP 2 — Rule Engine:
  domains: ['électrique', 'sécurité'] (UNION of lot.domain + impliedDomains)
  Fetches 4,266 rules

STEP 4 — CoverageAnalyzer:
  explicit: tableau ✅, câblage ✅, circuit ✅
  gaps: NF C 15-100 mention missing, CONSUEL certification not mentioned

STEP 6 — AuditReportGenerator:
  coverage_pct: 60% → risk_level: 'high' → verdict: 'non_conforme'
```

---

## Risk Level Mapping

| `coverage_pct` | `risk_level` | `compliance_verdict` | `risk_label` |
|---------------|-------------|----------------------|-------------|
| < 50% | `critical` | `critique` | Risque critique |
| 50–69% | `high` | `non_conforme` | Risque élevé |
| 70–84% | `medium` | `attention` | Risque modéré |
| ≥ 85% | `low` | `conforme` | Risque faible |

---

## Extending Phase 2 (Phase 3+)

### Enhancement 1 — Semantic Coverage (replace keyword matching)

```typescript
// Current (keyword substring):
const score = coverageScore(ruleKeywords, devisNormalized);
// score = matched_keywords / total_keywords

// Future (semantic embeddings via pgvector):
// NEW file: src/core/reasoning/semanticCoverage.service.ts
import { getEmbedding } from '@/core/rag/embeddings/embedding.service';
const ruleVec = await getEmbedding(rule.description);
const devisVec = await getEmbedding(devisLine.description);
const similarity = cosineSimilarity(ruleVec, devisVec);
const isExplicit = similarity >= 0.75;
```

### Enhancement 2 — Coverage factor in Global Scoring

```typescript
// src/core/engines/globalScoring.engine.ts
// Current: compliance score independent of coverage
const complianceWeighted = complianceScore * 0.35;

// Future: penalize if coverage low
const coveragePct = context.auditReport?.coverageAudit?.coverage?.coverage_pct ?? 100;
const coveragePenalty = coveragePct < 70 ? (70 - coveragePct) / 100 : 0;
const complianceWeighted = complianceScore * 0.35 * (1 - coveragePenalty);
```

### Enhancement 3 — Dynamic projectType from Devis

```typescript
// Current (hard-coded mapping):
const PROJECT_TYPE_TAXONOMY: Record<string, ...> = { piscine: [...], ... };

// Future (ML detection):
// src/core/project/projectDetection.service.ts already exists
import { detectProjectType } from '@/core/project/projectDetection.service';
const projectType = await detectProjectType(devisLines);
// Train model on accumulated real devis → better accuracy over time
```

### Enhancement 4 — New projectType entry

```typescript
// src/core/reasoning/contextDeduction.service.ts
// Add to PROJECT_TYPE_TAXONOMY:
  veranda: {
    domains: ['structure', 'thermique', 'accessibilité'],
    confidence: 'medium',
    description: 'Véranda / extension vitrée',
    aliases: ['vérandah', 'extension vitrée', 'jardin d\'hiver'],
  },
```

---

## Testing

### Run Phase 2 tests

```bash
# Unit tests (vitest)
npx vitest run src/core/reasoning/__tests__/
npx vitest run src/core/engines/__tests__/lot.engine.test.ts

# E2E test (pure in-process, no Supabase needed)
npx tsx scripts/test-full-audit.ts

# All Phase 2 tests at once
npx vitest run src/core/engines/__tests__/ src/core/reasoning/__tests__/ src/core/rules/__tests__/
```

### Adding a new projectType test

```typescript
// src/core/reasoning/__tests__/contextDeduction.test.ts
test('veranda → structure + thermique', () => {
  const result = deduceImpliedDomains('veranda');
  expect(result).toContain('structure');
  expect(result).toContain('thermique');
});
```

### Adding a coverage scenario test

```typescript
// scripts/test-full-audit.ts — add a new section:
section('6. Scénario — Véranda (thermique + structure)');
const VERANDA_DEVIS: DevisLine[] = [
  { description: 'Structure aluminium verrière double vitrage', category: 'structure' },
  { description: 'Isolation thermique RT2020 plancher', category: 'thermique' },
];
const VERANDA_RULES: RuleInput[] = [ /* ... */ ];
const report = analyzeCoverage(VERANDA_DEVIS, VERANDA_RULES);
ok(`Coverage > 50% — ${report.coverage_pct}%`, report.coverage_pct > 50);
```

---

## Debugging

### 1. Check impliedDomains

```typescript
import { enrichWithImpliedDomains } from '@/core/reasoning/contextDeduction.service';
const result = enrichWithImpliedDomains({ projectType: 'piscine' });
console.log('impliedDomains:', result.impliedDomains);
// Expected: ['structure', 'hydraulique', 'électrique', 'sécurité', 'thermique']
console.log('confidence:', result.contextDeductionConfidence);
```

### 2. Check coverage calculation

```typescript
import { analyzeCoverage } from '@/core/reasoning/coverageAnalyzer.service';
const report = analyzeCoverage(myDevisLines, myRules);
console.log(`coverage_pct: ${report.coverage_pct}%`);
console.log(`explicit: ${report.explicit_coverage}, implicit: ${report.implicit_coverage}, gaps: ${report.gaps}`);
console.log('top_gaps:', report.top_gaps.map(g => g.rule.description?.slice(0, 60)));
```

### 3. Check recommendation priority

```typescript
import { generateRecommendations } from '@/core/reasoning/recommendationGenerator.service';
const recs = generateRecommendations(report.top_gaps);
recs.forEach(r => console.log(`[${r.priority}] ${r.domain}: ${r.action.slice(0, 60)}`));
```

### 4. coverageAudit is undefined in AuditEngineResult

**Cause:** `projectData.devisLines` (or `.lines` / `.items`) is empty or not set.

```typescript
// Check what's in projectData:
console.log('devisLines:', executionContext.projectData?.devisLines?.length ?? 0);
// Must be > 0 for coverageAudit to run
```

---

## Known Limitations

| Limitation | Severity | Workaround | Fix (Phase 3) |
|-----------|---------|-----------|--------------|
| Keyword matching (not semantic) | Medium | impliedDomains catches domain-level coverage | Semantic embeddings |
| Lot detection ~80% accuracy | Medium | impliedDomains UNION ensures all domains covered | Better regex / ML classifier |
| 26 projectTypes hard-coded | Low | Fallback to `['structure']` for unknown types | Dynamic detection |
| Threshold 0.25 not tuned on real data | Low | Conservative (explicit requires ≥25% keyword match) | Tune after Phase 3 frontend |
| coverageAudit requires devisLines | High (UX) | Not blocking — field is optional | Phase 3 frontend form |

---

## Future ADRs (Phase 3+)

| Decision | Topic | Status |
|----------|-------|--------|
| DECISION 012 | Semantic Coverage Analysis (embeddings) | PROPOSED |
| DECISION 013 | Coverage Score in Global Scoring (formula) | PROPOSED |
| DECISION 014 | Frontend Coverage Report UI | PROPOSED |
| DECISION 015 | Dynamic projectType Learning (ML) | BACKLOG |
| DECISION 016 | Cron Auto-Audit for new devis | BACKLOG |

---

*References:*
- *Code: `src/core/reasoning/`*
- *ADR: `architecture/decisions/DECISION_011_phase2_coverage_analysis.md`*
- *E2E: `scripts/test-full-audit.ts`*
