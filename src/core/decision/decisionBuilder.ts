/**
 * Decision Builder
 *
 * Converts raw rule rows into normalized ProtoDecisions.
 * Filters to actionable_numeric rules only, normalizes fields,
 * and maps operators to semantic rule types.
 *
 * Tone: advisory — never punitive.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Raw row shape from the rules table (only fields we consume). */
export interface RuleRow {
  property: string | null;
  operator: string | null;
  value: number | string | null;
  unit: string | null;
  element: string | null;
  domain: string | null;
  classification: string | null;
  confidence_score: number | null;
  source_document_id: string | null;
}

export interface ProtoDecision {
  element?: string;
  domain: string;
  property: string;
  ruleType: "min" | "max" | "exact" | "range";
  value: number;
  unit?: string;
  confidence: number;
  source: string;
  interpretationHint: string;
  tone: "advisory";
  ruleOrigin: string;
  applicabilityScope?: string | null;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const OPERATOR_MAP: Record<string, ProtoDecision["ruleType"]> = {
  ">=": "min",
  ">": "min",
  "<=": "max",
  "<": "max",
  "=": "exact",
  "==": "exact",
  range: "range",
};

const INTERPRETATION_HINTS: Record<ProtoDecision["ruleType"], string> = {
  min: "minimum expected value based on standard practices",
  max: "maximum recommended limit",
  exact: "target value defined by standard",
  range: "acceptable value range",
};

// ---------------------------------------------------------------------------
// Private helpers
// ---------------------------------------------------------------------------

function isActionable(rule: RuleRow): boolean {
  return (
    rule.property !== null &&
    rule.property !== "n/a" &&
    rule.value !== null &&
    rule.operator !== null &&
    rule.operator !== "unknown"
  );
}

function normalizeString(value: string | null | undefined): string | undefined {
  if (value == null) return undefined;
  const trimmed = value.trim().toLowerCase();
  return trimmed.length > 0 ? trimmed : undefined;
}

function mapOperator(
  operator: string | null
): ProtoDecision["ruleType"] | null {
  if (operator == null) return null;
  return OPERATOR_MAP[operator.trim()] ?? null;
}

function parseValue(raw: number | string | null): number | null {
  if (raw === null) return null;
  const parsed = typeof raw === "number" ? raw : parseFloat(raw);
  return isNaN(parsed) ? null : parsed;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Convert a list of raw rule rows into normalized ProtoDecisions.
 * Rows that fail filtering or normalization are silently skipped.
 */
export function buildDecisions(rules: RuleRow[]): ProtoDecision[] {
  const actionable = rules.filter(isActionable);
  console.log(`[DecisionBuilder] actionable rules: ${actionable.length}/${rules.length}`);

  const decisions: ProtoDecision[] = [];

  for (const rule of actionable) {

    const ruleType = mapOperator(rule.operator);
    if (ruleType === null) continue;

    const value = parseValue(rule.value);
    if (value === null) continue;

    const property = normalizeString(rule.property);
    if (!property) continue;

    decisions.push({
      property,
      ruleType,
      value,
      tone: "advisory",
      domain: normalizeString(rule.domain) ?? "unknown",
      source: rule.source_document_id ?? "",
      ruleOrigin: rule.source_document_id ?? "",
      confidence: rule.confidence_score ?? 0,
      interpretationHint: INTERPRETATION_HINTS[ruleType],
      ...(normalizeString(rule.element) && {
        element: normalizeString(rule.element),
      }),
      ...(normalizeString(rule.unit) && { unit: normalizeString(rule.unit) }),
    });
  }

  return decisions.sort((a, b) =>
    `${a.domain}${a.element ?? ""}${a.property}`.localeCompare(
      `${b.domain}${b.element ?? ""}${b.property}`
    )
  );
}

/**
 * Group ProtoDecisions by a composite key: `element|property|unit`.
 * Used as input to the Decision Resolver.
 */
export function groupDecisionsByKey(
  decisions: ProtoDecision[]
): Record<string, ProtoDecision[]> {
  const groups: Record<string, ProtoDecision[]> = {};

  for (const d of decisions) {
    const key = `${d.element ?? ""}|${d.property}|${d.unit ?? ""}`;
    (groups[key] ??= []).push(d);
  }

  return groups;
}
