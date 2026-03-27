/**
 * Rule Adapter
 *
 * Converts ResolvedDecision[] (output of rule.engine → decisionResolver)
 * into RuleRecord[] (input expected by decisionEngine.evaluateProject).
 *
 * Mapping rationale:
 *   - Each ResolvedDecision with both min and max produces two RuleRecords
 *     (one >= and one <=) so decisionEngine can evaluate each bound independently.
 *   - Conflicting decisions are skipped — their bounds are contradictory and
 *     cannot be safely evaluated.
 *   - enforcement_level is derived from confidence_score:
 *       ≥ 0.85 → normative   (DTU / code construction — high confidence)
 *       ≥ 0.65 → recommended (standard guidance)
 *       < 0.65 → informative (low-confidence or Eurocode-derived)
 */

import type { ResolvedDecision } from '@/core/decision/decisionResolver';
import type { RuleRecord, EnforcementLevel } from '@/core/rules/decisionEngine';

// ---------------------------------------------------------------------------
// Enforcement level derivation
// ---------------------------------------------------------------------------

function deriveEnforcementLevel(confidence: number): EnforcementLevel {
  if (confidence >= 0.85) return 'normative';
  if (confidence >= 0.65) return 'recommended';
  return 'informative';
}

// ---------------------------------------------------------------------------
// Description builder
// ---------------------------------------------------------------------------

function buildDescription(rd: ResolvedDecision, operator: string, value: number): string {
  const subject = rd.element ? `${rd.element} — ${rd.property}` : rd.property;
  const unit    = rd.unit ? ` ${rd.unit}` : '';
  return `${subject} ${operator} ${value}${unit}`;
}

// ---------------------------------------------------------------------------
// Single-constraint factory
// ---------------------------------------------------------------------------

function makeRecord(
  rd: ResolvedDecision,
  operator: string,
  value: number,
  suffix: string,
): RuleRecord {
  const baseId = `${rd.element ?? ''}|${rd.property}|${rd.unit ?? ''}`;

  return {
    id:               `${baseId}|${suffix}`,
    description:      buildDescription(rd, operator, value),
    enforcement_level: deriveEnforcementLevel(rd.confidence),
    confidence_score:  rd.confidence,
    applicability:     {},
    structured_data: {
      property_key: rd.property,
      operator,
      value,
      unit:         rd.unit ?? null,
      qualitative:  false,
    },
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Convert an array of ResolvedDecisions into RuleRecords consumable by
 * `decisionEngine.evaluateProject()`.
 *
 * @param decisions - Output of `resolveDecisions()` stored on executionContext.
 * @returns          Flat array of RuleRecords, one per bound per decision.
 *                   Returns [] for null / undefined / empty input.
 */
export function adaptResolvedDecisionsToRuleRecords(
  decisions: ResolvedDecision[] | null | undefined,
): RuleRecord[] {
  if (!decisions || decisions.length === 0) return [];

  const records: RuleRecord[] = [];

  for (const rd of decisions) {
    // Skip decisions with contradictory bounds — they cannot be evaluated safely.
    if (rd.conflict) continue;

    // Must have at least one numeric bound to be evaluable.
    const hasNumericBound =
      rd.min !== undefined || rd.max !== undefined || rd.exact !== undefined;

    if (!hasNumericBound) continue;

    if (rd.min !== undefined) {
      records.push(makeRecord(rd, '>=', rd.min, 'min'));
    }

    if (rd.max !== undefined) {
      records.push(makeRecord(rd, '<=', rd.max, 'max'));
    }

    if (rd.exact !== undefined) {
      records.push(makeRecord(rd, '=', rd.exact, 'exact'));
    }
  }

  return records;
}
