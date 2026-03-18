/**
 * Rule Consolidation Service
 *
 * Transforms multiple ExtractedRule objects (from different chunks or documents)
 * into a smaller, reliable set of ConsolidatedRule objects.
 *
 * Consolidation groups rules by a semantic key (domain + element + property + unit)
 * so that duplicate rules across chunks collapse into a single, enriched record.
 *
 * When a group has conflicting numeric values, the dominant value (highest
 * frequency) is selected and `conflict: true` is flagged for review.
 *
 * This service is:
 *   - Pure (no DB calls, no side effects except console logs)
 *   - Deterministic (same input → same output)
 *   - Non-destructive (raw_rules preserves all originals)
 */

import type { ExtractedRule } from './ruleExtraction.service';

// =============================================================================
// Types
// =============================================================================

export interface ConsolidatedRule {
  /** Semantic grouping key: domain|element|property|unit */
  key: string;

  domain: string;
  element: string | null;
  property: string;
  unit: string;

  /** Dominant (most frequent) value across the group, or null for qualitative rules */
  value: number | null;
  operator: string;

  /** Up to 5 source sentences from the contributing rules */
  sources: string[];
  /** Total number of contributing rules */
  source_count: number;

  /** True when the group contains two or more distinct numeric values */
  conflict: boolean;
  /** All distinct values when conflict is true */
  conflict_values?: number[];

  /** Average confidence across contributing rules */
  confidence_score: number;
  /**
   * Weighted confidence that accounts for the authoritative weight of each
   * rule's source category (DTU/EUROCODE = 1.0, GUIDE_TECHNIQUE = 0.6, etc.)
   */
  priority_score: number;

  /** All original ExtractedRule objects that were merged into this record */
  raw_rules: ExtractedRule[];
}

// =============================================================================
// Source weights
// =============================================================================

/**
 * Authoritative weight per document category.
 * Rules from higher-authority sources contribute more to priority_score.
 * Unknown categories default to 0.5 (neutral).
 */
const SOURCE_WEIGHT: Readonly<Record<string, number>> = {
  DTU:               1.0,
  EUROCODE:          1.0,
  CODE_CONSTRUCTION: 1.0,
  NORMES:            0.9,
  GUIDE_TECHNIQUE:   0.6,
};

// =============================================================================
// Internal helpers
// =============================================================================

/**
 * Local type extension that allows access to the optional `category` field
 * that worker-augmented rules may carry alongside the base ExtractedRule.
 * Does not modify ExtractedRule — purely an internal cast for safe access.
 */
type ExtractedRuleWithMeta = ExtractedRule & { category?: string };

/**
 * Build the deduplication/grouping key for a rule.
 * Qualitative rules (no structured_data or unit = null) produce a valid key
 * using sentinel strings so they still group correctly.
 */
function buildConsolidationKey(rule: ExtractedRule): string {
  const sd = rule.structured_data;
  if (!sd) {
    return [rule.domain, 'null', 'unknown', 'null'].join('|');
  }
  return [
    rule.domain,
    sd.element  ?? 'null',
    sd.property,
    sd.unit     ?? 'null',
  ].join('|');
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

/**
 * Compute a source-weighted confidence score for a group of rules.
 * Falls back to weight 0.5 for categories not in SOURCE_WEIGHT.
 */
function computePriority(rules: ExtractedRule[]): number {
  if (rules.length === 0) return 0;
  let score = 0;
  for (const r of rules) {
    const category = (r as ExtractedRuleWithMeta).category;
    const weight   = category !== undefined ? (SOURCE_WEIGHT[category] ?? 0.5) : 0.5;
    score += r.confidence_score * weight;
  }
  return score / rules.length;
}

/**
 * Merge a group of rules that share the same consolidation key into one
 * ConsolidatedRule. The dominant numeric value (highest frequency) is chosen
 * when multiple distinct values are present; conflicts are flagged.
 *
 * Conflict detection requires element IS NOT NULL.
 * When element is null the grouping key (domain|null|property|unit) is too
 * coarse: it aggregates rules from different physical objects that happen to
 * share a domain + property + unit (e.g. door width and joint gap both appear
 * under menuiserie|null|largeur|mm). Flagging those as conflicts is a false
 * positive — they are distinct rules, not contradictory constraints.
 */
function consolidateGroup(rules: ExtractedRule[]): ConsolidatedRule {
  const first = rules[0];
  const sd    = first.structured_data;
  const elementKnown = (sd?.element ?? null) !== null;

  // Collect all non-null numeric values from the group
  const values: number[] = rules
    .map((r) => r.structured_data?.value ?? null)
    .filter((v): v is number => v !== null);

  const uniqueValues = [...new Set(values)];

  // Only flag a conflict when the element is identified.
  // Null-element groups skip conflict detection to avoid false positives.
  const conflict = elementKnown && uniqueValues.length > 1;

  // Find the dominant value (highest frequency; first-seen wins on ties)
  const valueFrequency = new Map<number, number>();
  for (const v of values) {
    valueFrequency.set(v, (valueFrequency.get(v) ?? 0) + 1);
  }

  let dominantValue: number | null = null;
  let maxFreq = 0;
  for (const [value, freq] of valueFrequency.entries()) {
    if (freq > maxFreq) {
      dominantValue = value;
      maxFreq = freq;
    }
  }

  return {
    key: buildConsolidationKey(first),

    domain:   first.domain,
    element:  sd?.element  ?? null,
    property: sd?.property ?? 'unknown',
    unit:     sd?.unit     ?? '',

    value:    dominantValue,
    operator: sd?.operator ?? 'unknown',

    sources:      rules.map((r) => r.source_sentence).slice(0, 5),
    source_count: rules.length,

    conflict,
    ...(conflict ? { conflict_values: uniqueValues } : {}),

    confidence_score: average(rules.map((r) => r.confidence_score)),
    priority_score:   computePriority(rules),

    raw_rules: rules,
  };
}

// =============================================================================
// Public API
// =============================================================================

/**
 * Consolidate an array of extracted rules into a deduplicated, enriched set.
 *
 * Rules that share the same domain + element + property + unit are merged:
 *   - Conflicting values are flagged
 *   - The dominant (most frequent) value is selected
 *   - Confidence is averaged; priority is source-weighted
 *
 * @param rules - Any mix of ExtractedRule from one or more chunks/documents
 * @returns Consolidated rules — one record per unique semantic key
 */
export function consolidateRules(rules: ExtractedRule[]): ConsolidatedRule[] {
  const groups = new Map<string, ExtractedRule[]>();

  for (const rule of rules) {
    const key = buildConsolidationKey(rule);
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key)!.push(rule);
  }

  // Count null-element groups that would have been flagged as conflicts
  // under the old (element-agnostic) logic — for transparency in logs.
  let skippedNullElementConflicts = 0;
  for (const group of groups.values()) {
    const hasNullElement = (group[0].structured_data?.element ?? null) === null;
    if (hasNullElement) {
      const vals = [...new Set(
        group.map((r) => r.structured_data?.value ?? null).filter((v): v is number => v !== null),
      )];
      if (vals.length > 1) skippedNullElementConflicts++;
    }
  }

  if (skippedNullElementConflicts > 0) {
    console.log(
      `[Consolidation] null-element conflict groups skipped: ${skippedNullElementConflicts}` +
      ` (element unknown — coarse grouping, not true conflicts)`,
    );
  }

  const result: ConsolidatedRule[] = [];
  for (const group of groups.values()) {
    result.push(consolidateGroup(group));
  }
  return result;
}

/**
 * Log a summary of the consolidation pass to the console.
 *
 * Reports:
 *   - input / output rule counts and reduction ratio
 *   - real conflicts (element IS NOT NULL, distinct values in same group)
 *   - null-element groups that were skipped for conflict detection
 *
 * @param input  - Rules before consolidation
 * @param output - Rules after consolidation
 */
export function logConsolidationStats(
  input: ExtractedRule[],
  output: ConsolidatedRule[],
): void {
  const conflicts = output.filter((r) => r.conflict).length;

  // Count null-element groups in the output that have multiple source values
  // (these were skipped by consolidateGroup but are visible in raw_rules).
  const nullElementSkipped = output.filter((r) => {
    if (r.element !== null) return false;
    const vals = [...new Set(r.raw_rules.map((rr) => rr.structured_data?.value ?? null).filter((v): v is number => v !== null))];
    return vals.length > 1;
  }).length;

  console.log(`[Consolidation] input rules              : ${input.length}`);
  console.log(`[Consolidation] output rules             : ${output.length}`);
  console.log(`[Consolidation] reduction                : ${input.length - output.length}`);
  console.log(`[Consolidation] real conflicts           : ${conflicts} (element known, values differ)`);
  console.log(`[Consolidation] null-element skipped     : ${nullElementSkipped} (not flagged — coarse grouping)`);
}
