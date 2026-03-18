/**
 * Decision Resolver
 *
 * Collapses grouped ProtoDecisions into a single authoritative ResolvedDecision
 * per (element, property, unit) key.
 *
 * Resolution strategy:
 *   - Multiple "min"   → keep the strictest (highest) value
 *   - Multiple "max"   → keep the strictest (lowest) value
 *   - Multiple "exact" → keep if unanimous; flag conflict if divergent
 *   - min > max        → flag conflict
 *
 * Tone: advisory — conflicts are surfaced as flags, never as rejections.
 */

import type { ProtoDecision } from "./decisionBuilder.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ResolvedDecision {
  element?: string;
  property: string;
  domain: string;
  min?: number;
  max?: number;
  exact?: number;
  unit?: string;
  sources: string[];
  confidence: number;
  /** Weighted authority score averaged from source rules (1.0 = DTU, 0.5 = Eurocode). */
  priority: number;
  tone: "advisory";
  conflict?: boolean;
  conflictReason?: string;
}

// ---------------------------------------------------------------------------
// Private helpers
// ---------------------------------------------------------------------------

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

function uniqueSources(decisions: ProtoDecision[]): string[] {
  return [...new Set(decisions.map((d) => d.source).filter(Boolean))];
}

function resolveGroup(decisions: ProtoDecision[]): ResolvedDecision {
  // Use the first decision for stable scalar fields
  const first = decisions[0];

  const resolved: ResolvedDecision = {
    property: first.property,
    domain: first.domain,
    tone: "advisory",
    sources: uniqueSources(decisions),
    confidence: average(decisions.map((d) => d.confidence)),
    priority: Math.max(...decisions.map((d) => d.priority)),
    ...(first.element && { element: first.element }),
    ...(first.unit && { unit: first.unit }),
  };

  const mins = decisions.filter((d) => d.ruleType === "min").map((d) => d.value);
  const maxs = decisions.filter((d) => d.ruleType === "max").map((d) => d.value);
  const exacts = decisions.filter((d) => d.ruleType === "exact").map((d) => d.value);
  const conflicts: string[] = [];

  // Strictest min (highest lower bound)
  if (mins.length > 0) {
    resolved.min = Math.max(...mins);
  }

  // Strictest max (lowest upper bound)
  if (maxs.length > 0) {
    resolved.max = Math.min(...maxs);
  }

  // Exact — unanimous or conflict
  if (exacts.length > 0) {
    const unique = [...new Set(exacts)];
    if (unique.length === 1) {
      resolved.exact = unique[0];
    } else {
      conflicts.push(
        `conflicting exact values: ${unique.join(", ")} ${resolved.unit ?? ""}`.trim()
      );
    }
  }

  // Structural conflict: min > max
  if (resolved.min !== undefined && resolved.max !== undefined && resolved.min > resolved.max) {
    conflicts.push(
      `min (${resolved.min}) exceeds max (${resolved.max}) — bounds are contradictory`
    );
  }

  if (conflicts.length > 0) {
    resolved.conflict = true;
    resolved.conflictReason = conflicts.join("; ");
  }

  return resolved;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Resolve all decision groups into authoritative ResolvedDecisions.
 *
 * @param groups - Output of `groupDecisionsByKey()`
 * @returns Array of resolved decisions, one per (element, property, unit) key
 */
export function resolveDecisions(
  groups: Record<string, ProtoDecision[]>
): ResolvedDecision[] {
  return Object.values(groups)
    .filter((group) => group.length > 0)
    .map(resolveGroup)
    .sort((a, b) => b.priority - a.priority);
}

/**
 * Resolve a single group — useful for incremental processing.
 */
export { resolveGroup };
