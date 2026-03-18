/**
 * Comparison Engine
 *
 * Matches ResolvedDecisions (expected values from standards) against
 * QuoteLineItems (observed values from a parsed devis) and produces
 * structured ComparisonResults.
 *
 * Matching is exact (normalized lowercase) — no fuzzy matching.
 * Tone: advisory — every result is a suggestion, never a rejection.
 */

import type { ResolvedDecision } from '@/core/decision/decisionResolver';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Extended quote line item — the parser produces the base shape;
 * `property`, `element`, and `value` are enriched upstream before comparison.
 */
export interface QuoteLineItem {
  description: string;
  quantity?: number;
  unit?: string;
  unitPrice?: number;
  totalPrice?: number;
  // Enriched fields (added before comparison)
  property?: string;
  element?: string;
  value?: number;
}

export interface ComparisonResult {
  category: 'aligned' | 'deviation' | 'missing' | 'unclear';
  message: string;
  recommendation?: string;
  property: string;
  element?: string;
  expected?: string;
  actual?: string;
  tone: 'advisory';
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const RECOMMENDATION_DEFAULT =
  'Vérifier si ce choix est justifié par les contraintes du chantier.';

const RECOMMENDATION_MISSING =
  "Demander au prestataire de préciser cette valeur dans le devis.";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function norm(s: string | undefined): string {
  return (s ?? '').trim().toLowerCase();
}

function fmtUnit(unit?: string): string {
  return unit ? ` ${unit}` : '';
}

function fmtMin(d: ResolvedDecision): string {
  return `≥ ${d.min}${fmtUnit(d.unit)}`;
}

function fmtMax(d: ResolvedDecision): string {
  return `≤ ${d.max}${fmtUnit(d.unit)}`;
}

function fmtExact(d: ResolvedDecision): string {
  return `${d.exact}${fmtUnit(d.unit)}`;
}

function fmtExpected(d: ResolvedDecision): string {
  if (d.min !== undefined && d.max !== undefined) {
    return `entre ${d.min} et ${d.max}${fmtUnit(d.unit)}`;
  }
  if (d.min !== undefined) return fmtMin(d);
  if (d.max !== undefined) return fmtMax(d);
  if (d.exact !== undefined) return fmtExact(d);
  return '–';
}

// ---------------------------------------------------------------------------
// Matching
// ---------------------------------------------------------------------------

/**
 * A quote item matches a decision when:
 *   1. Its property (or description) contains the decision property keyword.
 *   2. Its unit matches the decision unit (when the decision has one).
 *
 * Both sides are normalized to lowercase before comparison.
 */
function matches(item: QuoteLineItem, decision: ResolvedDecision): boolean {
  const decisionProp = norm(decision.property);

  // Property match: prefer explicit item.property, fall back to description scan
  const itemProp = norm(item.property);
  const propMatch = itemProp
    ? itemProp === decisionProp
    : norm(item.description).includes(decisionProp);

  if (!propMatch) return false;

  // Unit match: only enforced when the decision specifies a unit
  if (decision.unit !== undefined) {
    return norm(item.unit) === norm(decision.unit);
  }

  return true;
}

// ---------------------------------------------------------------------------
// Single comparison
// ---------------------------------------------------------------------------

function compareOne(
  decision: ResolvedDecision,
  items: QuoteLineItem[]
): ComparisonResult {
  const base = {
    property: decision.property,
    tone: 'advisory' as const,
    expected: fmtExpected(decision),
    ...(decision.element && { element: decision.element }),
  };

  // 1. No matching item in the quote
  const candidates = items.filter((item) => matches(item, decision));

  if (candidates.length === 0) {
    return {
      ...base,
      category: 'missing',
      message: 'Aucune information trouvée dans le devis pour cette propriété.',
      recommendation: RECOMMENDATION_MISSING,
    };
  }

  // Use the first match; prefer items that carry an explicit value
  const item =
    candidates.find((c) => c.value !== undefined) ?? candidates[0];

  const actual = item.value;

  // 2. Match found but no numeric value to compare
  if (actual === undefined) {
    return {
      ...base,
      category: 'unclear',
      message: "L'élément est mentionné dans le devis mais aucune valeur numérique n'a pu être extraite.",
      recommendation: RECOMMENDATION_DEFAULT,
      actual: item.description,
    };
  }

  const actualStr = `${actual}${fmtUnit(item.unit ?? decision.unit)}`;

  // 3. Min check
  if (decision.min !== undefined && actual < decision.min) {
    return {
      ...base,
      category: 'deviation',
      message: `La valeur observée (${actualStr}) est inférieure à la valeur de référence (${fmtMin(decision)}).`,
      recommendation: RECOMMENDATION_DEFAULT,
      actual: actualStr,
    };
  }

  // 4. Max check
  if (decision.max !== undefined && actual > decision.max) {
    return {
      ...base,
      category: 'deviation',
      message: `La valeur observée (${actualStr}) dépasse la valeur de référence (${fmtMax(decision)}).`,
      recommendation: RECOMMENDATION_DEFAULT,
      actual: actualStr,
    };
  }

  // 5. Exact check
  if (decision.exact !== undefined && actual !== decision.exact) {
    return {
      ...base,
      category: 'deviation',
      message: `La valeur observée (${actualStr}) diffère de la valeur cible (${fmtExact(decision)}).`,
      recommendation: RECOMMENDATION_DEFAULT,
      actual: actualStr,
    };
  }

  // 6. All checks passed
  return {
    ...base,
    category: 'aligned',
    message: 'La valeur observée est cohérente avec les pratiques de référence.',
    actual: actualStr,
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Compare a list of ResolvedDecisions against parsed quote line items.
 *
 * Output is sorted: deviations first, then missing, unclear, aligned.
 *
 * @param decisions - Authoritative constraints from the standards pipeline
 * @param items     - Structured line items extracted from the quote
 * @returns One ComparisonResult per decision
 */
export function compareQuote(
  decisions: ResolvedDecision[],
  items: QuoteLineItem[]
): ComparisonResult[] {
  const CATEGORY_ORDER: Record<ComparisonResult['category'], number> = {
    deviation: 0,
    missing: 1,
    unclear: 2,
    aligned: 3,
  };

  return decisions
    .map((d) => compareOne(d, items))
    .sort((a, b) => CATEGORY_ORDER[a.category] - CATEGORY_ORDER[b.category]);
}
