/**
 * Insight Engine
 *
 * Converts ResolvedDecisions into user-facing advisory insights.
 * Rule-based only — no quote comparison at this stage.
 *
 * Tone: advisory — never punitive.
 */

import type { ResolvedDecision } from '@/core/decision/decisionResolver';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Insight {
  category: 'aligned' | 'deviation' | 'missing' | 'unclear';
  severity: 'low' | 'medium' | 'high';
  message: string;
  recommendation?: string;
  element?: string;
  property: string;
  domain: string;
  confidence: number;
  tone: 'advisory';
}

// ---------------------------------------------------------------------------
// Formatters
// ---------------------------------------------------------------------------

function fmt(value: number, unit?: string): string {
  return unit ? `${value} ${unit}` : String(value);
}

// ---------------------------------------------------------------------------
// Single-decision → Insight
// ---------------------------------------------------------------------------

function decisionToInsight(d: ResolvedDecision): Insight {
  const base = {
    property: d.property,
    domain: d.domain,
    confidence: d.confidence,
    tone: 'advisory' as const,
    ...(d.element && { element: d.element }),
  };

  // 1. Conflict
  if (d.conflict) {
    return {
      ...base,
      category: 'unclear',
      severity: 'high',
      message: 'Les exigences issues des normes sont contradictoires.',
      recommendation: d.conflictReason,
    };
  }

  // 2. Range (min + max)
  if (d.min !== undefined && d.max !== undefined) {
    return {
      ...base,
      category: 'missing',
      severity: 'medium',
      message: `Plage recommandée : entre ${fmt(d.min, d.unit)} et ${fmt(d.max, d.unit)}.`,
      recommendation: 'Vérifier que le devis se situe dans cette plage ou justifier un écart.',
    };
  }

  // 3. Min only
  if (d.min !== undefined) {
    return {
      ...base,
      category: 'missing',
      severity: 'medium',
      message: `Valeur minimale attendue : ≥ ${fmt(d.min, d.unit)}.`,
      recommendation: 'Vérifier que le devis respecte cette valeur ou justifier un écart.',
    };
  }

  // 4. Max only
  if (d.max !== undefined) {
    return {
      ...base,
      category: 'missing',
      severity: 'medium',
      message: `Valeur maximale recommandée : ≤ ${fmt(d.max, d.unit)}.`,
      recommendation: 'Vérifier que le devis ne dépasse pas cette limite.',
    };
  }

  // 5. Exact
  if (d.exact !== undefined) {
    return {
      ...base,
      category: 'missing',
      severity: 'low',
      message: `Valeur cible : ${fmt(d.exact, d.unit)}.`,
      recommendation: 'Vérifier que la valeur indiquée dans le devis correspond à cette cible.',
    };
  }

  // Fallback — decision has no numeric bounds (should not occur after filtering)
  return {
    ...base,
    category: 'unclear',
    severity: 'low',
    message: `Exigence détectée pour "${d.property}" sans valeur numérique exploitable.`,
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Convert a list of ResolvedDecisions into user-facing advisory insights.
 * Output is sorted: high severity first, then by domain and property.
 */
export function buildInsights(decisions: ResolvedDecision[]): Insight[] {
  const SEVERITY_ORDER: Record<Insight['severity'], number> = {
    high: 0,
    medium: 1,
    low: 2,
  };

  return decisions
    .map(decisionToInsight)
    .sort(
      (a, b) =>
        SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] ||
        a.domain.localeCompare(b.domain) ||
        a.property.localeCompare(b.property)
    );
}
