# Scoring Framework V1 — Pluggable Multi-Dimensional Engine
**Version:** 1.0
**Date:** 2026-03-27
**Status:** Design

---

## Overview

The scoring framework evaluates a devis across 5 independent dimensions, then combines them into a final A–E trust score using a configurable weighted average.

```
DevisItem[] + Context + Rules
    ↓
[Dimension Evaluators — run in parallel]
    ├─ conformite    → 0–100  (weight: 0.30)
    ├─ exhaustivite  → 0–100  (weight: 0.25)
    ├─ clarte        → 0–100  (weight: 0.20)
    ├─ competitivite → 0–100  (weight: 0.15)
    └─ risques       → 0–100  (weight: 0.10)
    ↓
final_score = Σ(dimension_score × weight)
    ↓
scoreToGrade(final_score) → A | B | C | D | E
```

---

## Core Interfaces

```typescript
// A single scoring dimension
interface ScoringDimension {
  key: 'conformite' | 'exhaustivite' | 'clarte' | 'competitivite' | 'risques';
  name: string;              // Human-readable label
  score: number;             // 0–100
  weight: number;            // 0–1 (must sum to 1.0 across all dimensions)
  reasoning: string;         // Explanation of how score was computed
  sub_scores?: Record<string, number>;  // Optional breakdown
  evidence?: string[];       // Specific items or rules that informed score
  penalty_applied?: boolean; // True if a hard cap reduced this score
}

// Full scoring result
interface ScoringResult {
  dimensions: ScoringDimension[];
  final_score: number;        // 0–100 (weighted average)
  grade: 'A' | 'B' | 'C' | 'D' | 'E';
  potential_score?: number;   // Score if top recommendations were applied
  potential_grade?: 'A' | 'B' | 'C' | 'D' | 'E';
  scoring_version: string;    // '1.0', '1.1', '2.0' — for delta tracking
  computed_at: Date;
}

// Input for evaluators
interface ScoringContext {
  devisItems: DevisItem[];
  projectType: ProjectType;
  impliedDomains: string[];   // Deduced from projectType
  coverageReport?: CoverageReport;  // Phase 2 output (if available)
  marketPrices?: Record<string, number>;  // For competitivite evaluator
  projectBudget?: number;     // Declared total HT
}
```

---

## Grade Mapping

```typescript
type Grade = 'A' | 'B' | 'C' | 'D' | 'E';

function scoreToGrade(score: number): Grade {
  if (score >= 85) return 'A';  // Excellent — trusted, complete, compliant
  if (score >= 70) return 'B';  // Good — minor gaps only
  if (score >= 55) return 'C';  // Acceptable — notable gaps, attention required
  if (score >= 40) return 'D';  // Poor — significant issues
  return 'E';                   // Critical — unsafe or non-compliant
}

const GRADE_LABELS: Record<Grade, { fr: string; risk: string; color: string }> = {
  A: { fr: 'Excellent',    risk: 'Très faible',   color: '#22c55e' },
  B: { fr: 'Bon',          risk: 'Faible',         color: '#84cc16' },
  C: { fr: 'Passable',     risk: 'Modéré',         color: '#eab308' },
  D: { fr: 'Insuffisant',  risk: 'Élevé',          color: '#f97316' },
  E: { fr: 'Critique',     risk: 'Très élevé',     color: '#ef4444' },
};
```

---

## Weighted Scoring Formula

```typescript
const DIMENSION_WEIGHTS: Record<string, number> = {
  conformite:    0.30,   // Regulatory compliance — highest impact
  exhaustivite:  0.25,   // Coverage of required items
  clarte:        0.20,   // Clarity and precision of description
  competitivite: 0.15,   // Pricing vs market benchmarks
  risques:       0.10,   // Red flags and structural anomalies
};

function calculateDevisScore(dimensions: ScoringDimension[]): ScoringResult {
  // Validate weights sum to 1.0
  const totalWeight = dimensions.reduce((s, d) => s + d.weight, 0);
  if (Math.abs(totalWeight - 1.0) > 0.001) {
    throw new Error(`Weights must sum to 1.0 — got ${totalWeight}`);
  }

  // Weighted average
  const final_score = dimensions.reduce((s, d) => s + d.score * d.weight, 0);
  const grade = scoreToGrade(final_score);

  // Potential score: assume top-priority recommendations add +15 pts per dimension
  const potential_score = Math.min(100, final_score + estimatePotentialGain(dimensions));
  const potential_grade = scoreToGrade(potential_score);

  return {
    dimensions,
    final_score: Math.round(final_score * 10) / 10,
    grade,
    potential_score: Math.round(potential_score * 10) / 10,
    potential_grade,
    scoring_version: '1.0',
    computed_at: new Date(),
  };
}

function estimatePotentialGain(dimensions: ScoringDimension[]): number {
  // Each dimension below 70 can improve by up to 20 pts with recommendations
  return dimensions
    .filter(d => d.score < 70)
    .reduce((s, d) => s + Math.min(20, (70 - d.score) * 0.5) * d.weight, 0);
}
```

---

## Dimension Evaluators

### 1. Conformité (Regulatory Compliance)

```typescript
// Weight: 0.30 — Does the devis mention all legally required elements?
// Input: DevisItem[] + CoverageReport (Phase 2)
// Output: ScoringDimension

function evaluateConformite(ctx: ScoringContext): ScoringDimension {
  const coverage = ctx.coverageReport;

  if (!coverage) {
    // Fallback: no rules data available
    return {
      key: 'conformite',
      name: 'Conformité réglementaire',
      score: 50,  // Neutral — cannot assess without rules
      weight: DIMENSION_WEIGHTS.conformite,
      reasoning: 'Analyse réglementaire non disponible — score neutre appliqué.',
    };
  }

  // Base: coverage_pct maps linearly to score
  // 100% coverage = 100, 0% coverage = 0
  let score = coverage.coverage_pct;

  // Bonus: explicit coverage counts more than domain-only
  const explicitBonus = (coverage.explicit_pct / 100) * 10;
  score = Math.min(100, score + explicitBonus);

  // Penalty: critical rules explicitly missing → -10 per critical gap
  const criticalGaps = coverage.top_gaps?.filter(g => g.severity === 'high') ?? [];
  score = Math.max(0, score - criticalGaps.length * 10);

  const sub_scores: Record<string, number> = {
    coverage_base: coverage.coverage_pct,
    explicit_bonus: explicitBonus,
    critical_gap_penalty: criticalGaps.length * 10,
  };

  return {
    key: 'conformite',
    name: 'Conformité réglementaire',
    score: Math.round(score),
    weight: DIMENSION_WEIGHTS.conformite,
    reasoning: `Couverture réglementaire: ${coverage.coverage_pct.toFixed(1)}% (explicite: ${coverage.explicit_pct.toFixed(1)}%). ${criticalGaps.length} lacune(s) critique(s) identifiée(s).`,
    sub_scores,
    evidence: criticalGaps.map(g => g.rule_description),
    penalty_applied: criticalGaps.length > 0,
  };
}
```

### 2. Exhaustivité (Coverage Completeness)

```typescript
// Weight: 0.25 — Are all expected work items present for this project type?
// Input: DevisItem[] + impliedDomains

function evaluateExhaustivite(ctx: ScoringContext): ScoringDimension {
  const { devisItems, impliedDomains } = ctx;

  // Check which implied domains have at least one devis item
  const coveredDomains = new Set<string>();
  for (const item of devisItems) {
    if (item.domain) coveredDomains.add(item.domain);
    if (item.category) {
      const domain = CATEGORY_TO_DOMAIN[item.category];
      if (domain) coveredDomains.add(domain);
    }
  }

  const missingDomains = impliedDomains.filter(d => !coveredDomains.has(d));
  const domainCoverage = impliedDomains.length > 0
    ? (coveredDomains.size / impliedDomains.length) * 100
    : 100;

  // Item density: too few items for the project scope → deduct
  const itemCount = devisItems.length;
  let densityScore = 100;
  if (itemCount < 3)  densityScore = 20;
  else if (itemCount < 7)  densityScore = 60;
  else if (itemCount < 15) densityScore = 85;

  const score = (domainCoverage * 0.7) + (densityScore * 0.3);

  return {
    key: 'exhaustivite',
    name: 'Exhaustivité des prestations',
    score: Math.round(score),
    weight: DIMENSION_WEIGHTS.exhaustivite,
    reasoning: `${coveredDomains.size}/${impliedDomains.length} domaine(s) couverts. ${itemCount} postes identifiés.`,
    sub_scores: { domain_coverage: domainCoverage, item_density: densityScore },
    evidence: missingDomains.map(d => `Domaine absent: ${d}`),
  };
}

const CATEGORY_TO_DOMAIN: Record<string, string> = {
  electricite: 'électrique',
  plomberie: 'hydraulique',
  toiture: 'structure',
  structure: 'structure',
  chauffage: 'thermique',
  isolation: 'thermique',
};
```

### 3. Clarté (Precision and Readability)

```typescript
// Weight: 0.20 — Are items described precisely with all required fields?

function evaluateClarte(ctx: ScoringContext): ScoringDimension {
  const { devisItems } = ctx;

  if (devisItems.length === 0) {
    return {
      key: 'clarte',
      name: 'Clarté et précision',
      score: 0,
      weight: DIMENSION_WEIGHTS.clarte,
      reasoning: 'Aucun poste parsé — impossible d\'évaluer la clarté.',
    };
  }

  const scores = devisItems.map(item => {
    let itemScore = 100;

    // Penalize vague descriptions (too short)
    if (item.description.length < 10) itemScore -= 30;
    else if (item.description.length < 25) itemScore -= 15;

    // Penalize missing quantity
    if (!item.quantity || item.quantity === 0) itemScore -= 20;

    // Penalize missing unit
    if (!item.unit || item.unit === '') itemScore -= 10;

    // Penalize zero price
    if (!item.unit_price || item.unit_price === 0) itemScore -= 25;

    // Penalize uncategorized items
    if (!item.category || item.category === 'autre') itemScore -= 5;

    // Reward OCR-validated items (high per-item confidence)
    if (item.confidence && item.confidence >= 0.9) itemScore = Math.min(100, itemScore + 5);

    return Math.max(0, itemScore);
  });

  const avgScore = scores.reduce((s, v) => s + v, 0) / scores.length;
  const poorItems = scores.filter(s => s < 50).length;

  return {
    key: 'clarte',
    name: 'Clarté et précision',
    score: Math.round(avgScore),
    weight: DIMENSION_WEIGHTS.clarte,
    reasoning: `Score moyen par poste: ${avgScore.toFixed(1)}/100. ${poorItems} poste(s) insuffisamment détaillé(s).`,
    sub_scores: {
      avg_item_score: avgScore,
      poor_item_count: poorItems,
      total_items: devisItems.length,
    },
  };
}
```

---

## Evaluator Registry (Pluggable)

```typescript
type DimensionEvaluator = (ctx: ScoringContext) => ScoringDimension | Promise<ScoringDimension>;

const EVALUATOR_REGISTRY: Record<string, DimensionEvaluator> = {
  conformite:    evaluateConformite,
  exhaustivite:  evaluateExhaustivite,
  clarte:        evaluateClarte,
  competitivite: evaluateCompetitivite,  // Phase 3: pricing vs market
  risques:       evaluateRisques,         // Phase 3: anomaly detection
};

// Run all evaluators in parallel
async function runAllEvaluators(ctx: ScoringContext): Promise<ScoringResult> {
  const dimensionKeys = Object.keys(EVALUATOR_REGISTRY);
  const results = await Promise.all(
    dimensionKeys.map(key => EVALUATOR_REGISTRY[key](ctx))
  );
  return calculateDevisScore(results);
}
```

---

## Version Delta Tracking

When a devis is revised (version 2, 3...), compute the improvement delta:

```typescript
interface VersionDelta {
  from_version: number;
  to_version: number;
  from_score: number;
  to_score: number;
  from_grade: Grade;
  to_grade: Grade;
  score_delta: number;            // +/- points
  grade_improved: boolean;
  dimension_deltas: Array<{
    key: string;
    from_score: number;
    to_score: number;
    delta: number;
    trend: 'improved' | 'regressed' | 'stable';
  }>;
  improvements_made: string[];    // Narrative: what got better
  remaining_gaps: string[];       // What still needs fixing
}

function computeVersionDelta(
  previous: ScoringResult,
  current: ScoringResult,
  appliedRecommendations: string[] = []
): VersionDelta {
  const scoreDelta = current.final_score - previous.final_score;

  const dimensionDeltas = current.dimensions.map(curr => {
    const prev = previous.dimensions.find(d => d.key === curr.key);
    const delta = curr.score - (prev?.score ?? 0);
    return {
      key: curr.key,
      from_score: prev?.score ?? 0,
      to_score: curr.score,
      delta,
      trend: delta > 2 ? 'improved' : delta < -2 ? 'regressed' : 'stable',
    };
  });

  const improved = dimensionDeltas
    .filter(d => d.trend === 'improved')
    .map(d => `${d.key}: +${d.delta.toFixed(1)} pts`);

  const regressed = dimensionDeltas
    .filter(d => d.trend === 'regressed')
    .map(d => `${d.key}: ${d.delta.toFixed(1)} pts`);

  return {
    from_version: 1,
    to_version: 2,
    from_score: previous.final_score,
    to_score: current.final_score,
    from_grade: previous.grade,
    to_grade: current.grade,
    score_delta: scoreDelta,
    grade_improved: current.final_score >= scoreToGrade_threshold(previous.grade) + 1,
    dimension_deltas: dimensionDeltas,
    improvements_made: improved,
    remaining_gaps: regressed,
  };
}

function scoreToGrade_threshold(grade: Grade): number {
  const thresholds: Record<Grade, number> = { A: 85, B: 70, C: 55, D: 40, E: 0 };
  return thresholds[grade];
}
```

---

## Public Audit Report

The public-facing report (accessible via QR code) exposes a simplified view:

```typescript
interface PublicAuditReport {
  // Identity
  audit_id: string;
  short_code: string;           // From QRCode.short_code (e.g. "AB3XK7M2")
  generated_at: Date;
  scoring_version: string;

  // Score summary
  final_score: number;          // 0–100
  grade: Grade;
  grade_label: string;          // "Bon", "Critique", etc.
  grade_color: string;          // Hex color

  // Dimension breakdown (simplified)
  dimensions: Array<{
    name: string;
    score: number;
    grade: Grade;
  }>;

  // Narrative
  risk_label: string;           // "Risque faible", "Risque élevé"
  compliance_verdict: 'conforme' | 'attention' | 'non_conforme' | 'critique';
  highlights: string[];         // 3–5 strengths
  key_findings: string[];       // 2–4 key issues to address
  top_recommendation: string;   // Single most impactful action

  // Improvement potential
  potential_score?: number;
  potential_grade?: Grade;
  score_gain_possible?: number; // Points if top recs applied

  // Version delta (if v2+)
  version_delta?: {
    score_delta: number;
    grade_changed: boolean;
    summary: string;            // "Score amélioré de +12 pts (D→C)"
  };

  // Disclaimers
  expires_at?: Date;
  disclaimer: string;           // Legal/regulatory disclaimer
}

function buildPublicAuditReport(
  scoringResult: ScoringResult,
  auditId: string,
  shortCode: string,
  delta?: VersionDelta
): PublicAuditReport {
  const grade = scoringResult.grade;
  const gradeInfo = GRADE_LABELS[grade];

  const verdict: PublicAuditReport['compliance_verdict'] =
    grade === 'A' ? 'conforme' :
    grade === 'B' ? 'attention' :
    grade === 'C' ? 'non_conforme' :
    'critique';

  return {
    audit_id: auditId,
    short_code: shortCode,
    generated_at: scoringResult.computed_at,
    scoring_version: scoringResult.scoring_version,

    final_score: scoringResult.final_score,
    grade,
    grade_label: gradeInfo.fr,
    grade_color: gradeInfo.color,

    dimensions: scoringResult.dimensions.map(d => ({
      name: d.name,
      score: d.score,
      grade: scoreToGrade(d.score),
    })),

    risk_label: gradeInfo.risk,
    compliance_verdict: verdict,
    highlights: extractHighlights(scoringResult),
    key_findings: extractKeyFindings(scoringResult),
    top_recommendation: extractTopRecommendation(scoringResult),

    potential_score: scoringResult.potential_score,
    potential_grade: scoringResult.potential_grade,
    score_gain_possible: scoringResult.potential_score
      ? scoringResult.potential_score - scoringResult.final_score
      : undefined,

    version_delta: delta ? {
      score_delta: delta.score_delta,
      grade_changed: delta.grade_improved,
      summary: `Score ${delta.score_delta >= 0 ? 'amélioré' : 'dégradé'} de ${delta.score_delta >= 0 ? '+' : ''}${delta.score_delta.toFixed(1)} pts (${delta.from_grade}→${delta.to_grade})`,
    } : undefined,

    disclaimer: 'Ce rapport est généré automatiquement sur la base d\'une analyse algorithmique. Il ne constitue pas un avis juridique ou réglementaire.',
  };
}

function extractHighlights(result: ScoringResult): string[] {
  return result.dimensions
    .filter(d => d.score >= 75)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map(d => `${d.name} satisfaisante (${d.score}/100)`);
}

function extractKeyFindings(result: ScoringResult): string[] {
  return result.dimensions
    .filter(d => d.score < 55)
    .sort((a, b) => a.score - b.score)
    .slice(0, 3)
    .map(d => d.reasoning);
}

function extractTopRecommendation(result: ScoringResult): string {
  const weakest = result.dimensions
    .sort((a, b) => (a.score * a.weight) - (b.score * b.weight))[0];
  return `Améliorer la dimension "${weakest.name}" pour le gain de score le plus élevé.`;
}
```

---

## Scoring Thresholds Reference

| Score | Grade | Risk Level | Verdict | Recommended Action |
|-------|-------|-----------|---------|-------------------|
| 85–100 | A | Très faible | Conforme | Accept — optional spot check |
| 70–84 | B | Faible | Attention | Accept with minor corrections |
| 55–69 | C | Modéré | Non conforme | Request clarifications |
| 40–54 | D | Élevé | Non conforme | Negotiate or reject |
| 0–39 | E | Très élevé | Critique | Reject — safety/legal risk |

---

## Dimension Weight Configuration

Weights are configurable per project type or context. Example variants:

```typescript
// Default (balanced)
const WEIGHTS_DEFAULT = {
  conformite: 0.30, exhaustivite: 0.25, clarte: 0.20, competitivite: 0.15, risques: 0.10
};

// Safety-critical projects (piscines, structure)
const WEIGHTS_SAFETY = {
  conformite: 0.40, exhaustivite: 0.25, clarte: 0.15, competitivite: 0.10, risques: 0.10
};

// Budget-sensitive projects (renovation légère)
const WEIGHTS_BUDGET = {
  conformite: 0.20, exhaustivite: 0.20, clarte: 0.20, competitivite: 0.30, risques: 0.10
};
```
