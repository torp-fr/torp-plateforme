/**
 * Integration tests — scoring.engine + decisionEngine
 * Run with: pnpm vitest run src/core/engines/__tests__/scoring.engine.integration.test.ts
 *
 * These tests exercise the full path:
 *   resolvedDecisions → adaptResolvedDecisionsToRuleRecords
 *     → evaluateProject → ScoringEngineResult.ruleEvaluation
 *
 * No Supabase or external calls. All inputs are in-memory fixtures.
 */

import { describe, it, expect } from 'vitest';
import { runScoringEngine } from '../scoring.engine';
import type { EngineExecutionContext } from '@/core/platform/engineExecutionContext';
import type { ResolvedDecision } from '@/core/decision/decisionResolver';

// ---------------------------------------------------------------------------
// Fixture helpers
// ---------------------------------------------------------------------------

function makeContext(
  resolvedDecisions: ResolvedDecision[],
  projectData: Record<string, unknown> = {},
  rules: Partial<EngineExecutionContext['rules']> = {},
): EngineExecutionContext {
  return {
    projectId:         'test-project',
    projectData,
    resolvedDecisions,
    rules: {
      obligationCount:       rules.obligationCount       ?? 0,
      totalWeight:           rules.totalWeight           ?? 0,
      severityBreakdown:     rules.severityBreakdown     ?? { critical: 0, high: 0, medium: 0, low: 0 },
      typeBreakdown:         rules.typeBreakdown         ?? { legal: 0, regulatory: 0, advisory: 0, commercial: 0 },
      detailedObligations:   rules.detailedObligations   ?? [],
    },
    lots: { complexityScore: 0 },
  };
}

function rd(overrides: Partial<ResolvedDecision> = {}): ResolvedDecision {
  return {
    property:   'epaisseur_chape',
    domain:     'structure',
    sources:    ['doc-001'],
    confidence: 0.90,
    priority:   1.0,
    tone:       'advisory',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('scoring.engine — decisionEngine integration', () => {

  it('case 1: compliant devis → grade A, 0 violations, globalScore near 100', async () => {
    // Rule: epaisseur_chape >= 45 mm
    // Project: epaisseur_chape = 60 (passes)
    const ctx = makeContext(
      [rd({ min: 45, unit: 'mm' })],
      { epaisseur_chape: 60 },
    );
    const result = await runScoringEngine(ctx);

    expect(result.ruleEvaluation).toBeDefined();
    expect(result.ruleEvaluation!.grade).toBe('A');
    expect(result.ruleEvaluation!.violations).toHaveLength(0);
    expect(result.ruleEvaluation!.compliance_score).toBeCloseTo(1.0, 1);
    // With 0 obligations and 0 violations, globalScore should be 100
    expect(result.globalScore).toBeCloseTo(100, 0);
    expect(result.scoreBreakdown.violationImpact).toBe(0);
  });

  it('case 2: non-compliant devis → violations detected, globalScore reduced', async () => {
    // Rule: epaisseur_chape >= 45 mm
    // Project: epaisseur_chape = 30 (fails — below minimum)
    const ctx = makeContext(
      [rd({ min: 45, unit: 'mm' })],
      { epaisseur_chape: 30 },
    );
    const result = await runScoringEngine(ctx);

    expect(result.ruleEvaluation).toBeDefined();
    expect(result.ruleEvaluation!.violations.length).toBeGreaterThan(0);
    // violation_summary should mention the count
    expect(result.ruleEvaluation!.violation_summary).toMatch(/\d+ violation/);
    // globalScore must be reduced (violationImpact = 5 per violation, compliance < 1.0)
    expect(result.globalScore).toBeLessThan(100);
    expect(result.scoreBreakdown.violationImpact).toBeGreaterThan(0);
  });

  it('case 3: no resolvedDecisions → ruleEvaluation is undefined, scoring works normally', async () => {
    const ctx = makeContext([], { epaisseur_chape: 50 });
    const result = await runScoringEngine(ctx);

    expect(result.ruleEvaluation).toBeUndefined();
    // Without rule evaluation, compliance multiplier is 1.0 — score stays at base
    expect(result.globalScore).toBe(100);
    expect(result.scoreBreakdown.violationImpact).toBe(0);
  });

  it('case 4: multiple rules, mixed pass/fail', async () => {
    const decisions: ResolvedDecision[] = [
      rd({ property: 'epaisseur_chape',  min: 45, unit: 'mm' }),  // 60 → PASS
      rd({ property: 'hauteur_plafond',  min: 250, unit: 'cm' }), // 220 → FAIL
    ];
    const ctx = makeContext(
      decisions,
      { epaisseur_chape: 60, hauteur_plafond: 220 },
    );
    const result = await runScoringEngine(ctx);

    expect(result.ruleEvaluation).toBeDefined();
    // At least 1 violation (hauteur_plafond)
    expect(result.ruleEvaluation!.violations.length).toBeGreaterThanOrEqual(1);
    // Score is reduced but not zero
    expect(result.globalScore).toBeGreaterThan(0);
    expect(result.globalScore).toBeLessThan(100);
  });

  it('case 5: conflicting resolvedDecisions are skipped — no crash', async () => {
    const conflicting = rd({
      min: 200, max: 100,
      conflict: true, conflictReason: 'min > max',
    });
    const ctx = makeContext([conflicting], { epaisseur_chape: 150 });
    const result = await runScoringEngine(ctx);

    // Conflict skipped → no records → ruleEvaluation is undefined
    expect(result.ruleEvaluation).toBeUndefined();
    expect(result.globalScore).toBe(100);
  });

  it('case 6: ScoringEngineResult contains all required fields', async () => {
    const ctx = makeContext([rd({ min: 45 })], { epaisseur_chape: 50 });
    const result = await runScoringEngine(ctx);

    expect(result).toHaveProperty('riskScore');
    expect(result).toHaveProperty('complexityImpact');
    expect(result).toHaveProperty('globalScore');
    expect(result).toHaveProperty('riskLevel');
    expect(result).toHaveProperty('scoreBreakdown.violationImpact');
    expect(result.meta.engineVersion).toBe('1.2');
  });

  it('case 7: ruleEvaluation violations capped at 5 in result', async () => {
    // Create 8 failing rules
    const decisions: ResolvedDecision[] = Array.from({ length: 8 }, (_, i) =>
      rd({ property: `prop_${i}`, min: 100, unit: 'mm' }),
    );
    const projectData: Record<string, unknown> = {};
    decisions.forEach((_, i) => { projectData[`prop_${i}`] = 10; }); // all fail

    const ctx = makeContext(decisions, projectData);
    const result = await runScoringEngine(ctx);

    expect(result.ruleEvaluation).toBeDefined();
    // Returned violations capped at 5 (full list in ruleEvaluation.violations)
    expect(result.ruleEvaluation!.violations.length).toBeLessThanOrEqual(5);
    // But violationImpact reflects the true count (8)
    expect(result.scoreBreakdown.violationImpact).toBe(8 * 5);
  });

});
