/**
 * Unit tests — ruleAdapter
 * Run with: pnpm vitest run src/core/rules/__tests__/ruleAdapter.test.ts
 */

import { describe, it, expect } from 'vitest';
import { adaptResolvedDecisionsToRuleRecords } from '../ruleAdapter';
import type { ResolvedDecision } from '@/core/decision/decisionResolver';

// ---------------------------------------------------------------------------
// Fixture factory
// ---------------------------------------------------------------------------

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

describe('adaptResolvedDecisionsToRuleRecords', () => {

  it('returns empty array for empty input', () => {
    expect(adaptResolvedDecisionsToRuleRecords([])).toEqual([]);
  });

  it('returns empty array for null input', () => {
    expect(adaptResolvedDecisionsToRuleRecords(null)).toEqual([]);
  });

  it('returns empty array for undefined input', () => {
    expect(adaptResolvedDecisionsToRuleRecords(undefined)).toEqual([]);
  });

  it('maps a simple minimum constraint (min: 45)', () => {
    const result = adaptResolvedDecisionsToRuleRecords([rd({ min: 45, unit: 'mm' })]);
    expect(result).toHaveLength(1);
    const rec = result[0];
    expect(rec.structured_data.operator).toBe('>=');
    expect(rec.structured_data.value).toBe(45);
    expect(rec.structured_data.unit).toBe('mm');
    expect(rec.structured_data.property_key).toBe('epaisseur_chape');
    expect(rec.structured_data.qualitative).toBe(false);
  });

  it('maps a maximum constraint (max: 200)', () => {
    const result = adaptResolvedDecisionsToRuleRecords([rd({ max: 200, unit: 'mm' })]);
    expect(result).toHaveLength(1);
    const rec = result[0];
    expect(rec.structured_data.operator).toBe('<=');
    expect(rec.structured_data.value).toBe(200);
  });

  it('maps an exact value constraint (exact: 170)', () => {
    const result = adaptResolvedDecisionsToRuleRecords([rd({ exact: 170, unit: 'cm' })]);
    expect(result).toHaveLength(1);
    const rec = result[0];
    expect(rec.structured_data.operator).toBe('=');
    expect(rec.structured_data.value).toBe(170);
  });

  it('produces two records when both min and max are present', () => {
    const result = adaptResolvedDecisionsToRuleRecords([rd({ min: 40, max: 120, unit: 'mm' })]);
    expect(result).toHaveLength(2);
    const operators = result.map(r => r.structured_data.operator).sort();
    expect(operators).toEqual(['<=', '>=']);
  });

  it('produces three records when min, max and exact are all present', () => {
    const result = adaptResolvedDecisionsToRuleRecords([rd({ min: 40, max: 120, exact: 80, unit: 'mm' })]);
    expect(result).toHaveLength(3);
  });

  it('maps high confidence (≥ 0.85) to enforcement_level normative', () => {
    const result = adaptResolvedDecisionsToRuleRecords([rd({ min: 50, confidence: 0.90 })]);
    expect(result[0].enforcement_level).toBe('normative');
  });

  it('maps medium confidence (0.65–0.84) to enforcement_level recommended', () => {
    const result = adaptResolvedDecisionsToRuleRecords([rd({ min: 50, confidence: 0.70 })]);
    expect(result[0].enforcement_level).toBe('recommended');
  });

  it('maps low confidence (< 0.65) to enforcement_level informative', () => {
    const result = adaptResolvedDecisionsToRuleRecords([rd({ min: 50, confidence: 0.50 })]);
    expect(result[0].enforcement_level).toBe('informative');
  });

  it('skips conflicting decisions', () => {
    const conflicting = rd({ min: 200, max: 100, conflict: true, conflictReason: 'min > max' });
    const valid       = rd({ min: 45, property: 'autre_prop' });
    const result = adaptResolvedDecisionsToRuleRecords([conflicting, valid]);
    expect(result).toHaveLength(1);
    expect(result[0].structured_data.property_key).toBe('autre_prop');
  });

  it('skips decisions with no numeric bound', () => {
    const noValue = rd({}); // no min, max, or exact
    expect(adaptResolvedDecisionsToRuleRecords([noValue])).toEqual([]);
  });

  it('handles missing optional fields (no element, no unit)', () => {
    const result = adaptResolvedDecisionsToRuleRecords([
      rd({ min: 30, element: undefined, unit: undefined }),
    ]);
    expect(result).toHaveLength(1);
    const rec = result[0];
    expect(rec.structured_data.unit).toBeNull();
    expect(rec.description).toBe('epaisseur_chape >= 30');
  });

  it('includes element in description when present', () => {
    const result = adaptResolvedDecisionsToRuleRecords([
      rd({ min: 50, element: 'Dalle béton', unit: 'mm' }),
    ]);
    expect(result[0].description).toBe('Dalle béton — epaisseur_chape >= 50 mm');
  });

  it('propagates confidence_score directly', () => {
    const result = adaptResolvedDecisionsToRuleRecords([rd({ min: 50, confidence: 0.77 })]);
    expect(result[0].confidence_score).toBe(0.77);
  });

  it('generates unique ids per bound type', () => {
    const result = adaptResolvedDecisionsToRuleRecords([
      rd({ min: 40, max: 120, unit: 'mm' }),
    ]);
    const ids = result.map(r => r.id);
    expect(new Set(ids).size).toBe(2); // no duplicates
    expect(ids.some(id => id.endsWith('|min'))).toBe(true);
    expect(ids.some(id => id.endsWith('|max'))).toBe(true);
  });

  it('handles multiple valid decisions in one call', () => {
    const decisions = [
      rd({ property: 'epaisseur_chape',   min: 45,  unit: 'mm' }),
      rd({ property: 'hauteur_plafond',   min: 250, unit: 'cm' }),
      rd({ property: 'resistance_thermique', exact: 3.7, unit: 'm2K/W' }),
    ];
    const result = adaptResolvedDecisionsToRuleRecords(decisions);
    expect(result).toHaveLength(3);
    const keys = result.map(r => r.structured_data.property_key);
    expect(keys).toContain('epaisseur_chape');
    expect(keys).toContain('hauteur_plafond');
    expect(keys).toContain('resistance_thermique');
  });

});
