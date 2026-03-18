/**
 * Context Engine Service
 *
 * Takes an EnrichedRule (from ruleEnrichment.service) and a ProjectContext
 * and produces a ContextualRule — a rule whose severity and applicability
 * have been adjusted to reflect the actual project conditions.
 *
 * This is the interpretation layer between the knowledge base and the
 * Devis Analysis Engine. It answers: "Given THIS project, how strictly
 * should THIS rule be enforced?"
 *
 * Design principles:
 *   - Pure function, no DB, no side effects
 *   - Strict rules (code de la construction, eurocode) are never suppressed
 *   - Severity degrades one step per context mismatch
 *   - final_score = confidence * (1 - flexibility_score)
 *     → strict/high-confidence rules score highest
 *     → recommended/low-confidence rules score lowest
 *   - A rule is inapplicable only when it is non-strict AND ALL its
 *     applicability dimensions contradict the project context
 *
 * Severity order (descending): critical → high → medium → low → info
 */

import type { EnrichedRule } from './ruleEnrichment.service';
import type { Severity } from '@/types/analysis.types';

export type { Severity }; // re-export for consumers that import from this module

// =============================================================================
// Types
// =============================================================================

/** The project conditions that drive rule interpretation */
export interface ProjectContext {
  /** Whether this is new construction or a renovation */
  project_type: 'neuf' | 'renovation';
  /** Occupancy / destination — free-form, matches building_type in applicability */
  building_type?: string;
  /** Geographic or regulatory zone (e.g. "zone sismique 2", "littoral") */
  location?: string;
  /** Additional project-level constraints (e.g. ["ossature bois", "BBC"]) */
  constraints?: string[];
}

/** EnrichedRule after context interpretation */
export interface ContextualRule extends EnrichedRule {
  /** Whether this rule is considered applicable to the given project context */
  applicable: boolean;
  /** Severity after context adjustment (may be lower than original) */
  adjusted_severity: Severity;
  /**
   * Weighted enforcement score for the Analysis Engine.
   * final_score = confidence_score × (1 − flexibility_score)
   * Range: 0.0 (informative, low confidence) → 1.0 (strict, full confidence)
   */
  final_score: number;
  /** Human-readable explanation of the context decision */
  context_reason: string;
}

// =============================================================================
// Severity ladder
// =============================================================================

const SEVERITY_LADDER: readonly Severity[] = ['critical', 'high', 'medium', 'low', 'info'];

/**
 * Initial severity derived from enforcement_level.
 * Mirrors severityFor() in checkBuilder — kept separate to avoid circular imports.
 */
const BASE_SEVERITY: Record<string, Severity> = {
  strict:      'critical',
  normative:   'high',
  adaptive:    'medium',
  recommended: 'medium',
  informative: 'low',
};

/**
 * Minimum severity floor per enforcement level.
 *
 * Strict rules cannot be reduced below 'high' regardless of mismatches —
 * statutory obligations remain legally significant even if not perfectly
 * matched to the project type.
 */
const SEVERITY_FLOOR: Record<string, Severity> = {
  strict:      'high',
  normative:   'low',
  adaptive:    'info',
  recommended: 'info',
  informative: 'info',
};

function degradeSeverity(current: Severity, steps: number): Severity {
  const idx = SEVERITY_LADDER.indexOf(current);
  const next = Math.min(idx + steps, SEVERITY_LADDER.length - 1);
  return SEVERITY_LADDER[next];
}

function clampSeverity(severity: Severity, floor: Severity): Severity {
  const sevIdx   = SEVERITY_LADDER.indexOf(severity);
  const floorIdx = SEVERITY_LADDER.indexOf(floor);
  // floor = minimum acceptable (lower index = more severe)
  return sevIdx <= floorIdx ? severity : floor;
}

// =============================================================================
// Mismatch detection
// =============================================================================

interface MismatchResult {
  count: number;
  reasons: string[];
}

/**
 * Compare rule applicability against project context dimension by dimension.
 * Only dimensions the rule explicitly declares are checked — an absent
 * applicability dimension means "applies universally on this axis".
 */
function detectMismatches(rule: EnrichedRule, ctx: ProjectContext): MismatchResult {
  const reasons: string[] = [];
  let count = 0;

  // ── project_type ─────────────────────────────────────────────────────────
  if (
    rule.applicability.project_type &&
    rule.applicability.project_type !== ctx.project_type
  ) {
    count++;
    reasons.push(
      `Rule targets "${rule.applicability.project_type}" projects; ` +
      `this project is "${ctx.project_type}"`,
    );
  }

  // ── building_type ─────────────────────────────────────────────────────────
  if (rule.applicability.building_type && ctx.building_type) {
    // Normalise to lower-case for partial matching
    const ruleType = rule.applicability.building_type.toLowerCase();
    const projType = ctx.building_type.toLowerCase();
    if (!projType.includes(ruleType) && !ruleType.includes(projType)) {
      count++;
      reasons.push(
        `Rule applies to "${rule.applicability.building_type}" buildings; ` +
        `project is "${ctx.building_type}"`,
      );
    }
  }

  // ── location ─────────────────────────────────────────────────────────────
  if (rule.applicability.location && ctx.location) {
    const ruleLoc = rule.applicability.location.toLowerCase();
    const projLoc = ctx.location.toLowerCase();
    if (!projLoc.includes(ruleLoc) && !ruleLoc.includes(projLoc)) {
      count++;
      reasons.push(
        `Rule is specific to "${rule.applicability.location}"; ` +
        `project location is "${ctx.location}"`,
      );
    }
  }

  // ── constraints (any overlap is enough to count as a match) ──────────────
  if (rule.applicability.constraints?.length && ctx.constraints?.length) {
    const ruleConstraints = rule.applicability.constraints.map((c) => c.toLowerCase());
    const projConstraints = ctx.constraints.map((c) => c.toLowerCase());
    const hasOverlap = ruleConstraints.some((rc) =>
      projConstraints.some((pc) => pc.includes(rc) || rc.includes(pc)),
    );
    if (!hasOverlap) {
      count++;
      reasons.push(
        `Rule constraint conditions [${rule.applicability.constraints.join(', ')}] ` +
        `not met by project constraints [${ctx.constraints.join(', ')}]`,
      );
    }
  }

  return { count, reasons };
}

// =============================================================================
// Applicability decision
// =============================================================================

/**
 * A rule is inapplicable only when ALL of these are true:
 *   1. Its enforcement_level is not 'strict' (strict rules always apply)
 *   2. At least one applicability dimension was declared by the rule
 *   3. Every declared dimension is a mismatch
 *
 * "Partially matched" rules (some dimensions match, some don't) are still
 * applicable — they just have a reduced severity.
 */
function isApplicable(
  rule: EnrichedRule,
  mismatchCount: number,
): boolean {
  // Strict enforcement is never suppressed
  if (rule.enforcement_level === 'strict') return true;

  // Count how many applicability dimensions the rule actually declared
  const applDimensions = [
    rule.applicability.project_type,
    rule.applicability.building_type,
    rule.applicability.location,
    rule.applicability.constraints?.length ? 'constraints' : undefined,
  ].filter(Boolean).length;

  // If rule declared no specific applicability → universal
  if (applDimensions === 0) return true;

  // Inapplicable only when every declared dimension is a mismatch
  return mismatchCount < applDimensions;
}

// =============================================================================
// Context reason builder
// =============================================================================

function buildContextReason(
  rule: EnrichedRule,
  ctx: ProjectContext,
  mismatches: MismatchResult,
  applicable: boolean,
  baseSeverity: Severity,
  adjustedSeverity: Severity,
): string {
  // Universal rule (no applicability declared)
  const applDimensions = [
    rule.applicability.project_type,
    rule.applicability.building_type,
    rule.applicability.location,
    rule.applicability.constraints?.length ? 'c' : undefined,
  ].filter(Boolean).length;

  if (applDimensions === 0) {
    return `Universal rule — applies to all project types (${rule.enforcement_level})`;
  }

  if (mismatches.count === 0) {
    return `Full context match — rule applies to this ${ctx.project_type} project (${rule.enforcement_level})`;
  }

  if (!applicable) {
    return (
      `Rule not applicable: ${mismatches.reasons.join('; ')}. ` +
      `Enforcement: ${rule.enforcement_level}`
    );
  }

  // Applicable but degraded
  const degraded = baseSeverity !== adjustedSeverity;
  const degradeNote = degraded
    ? ` Severity reduced: ${baseSeverity} → ${adjustedSeverity}.`
    : ` Severity maintained at ${adjustedSeverity} (${rule.enforcement_level} floor).`;

  if (rule.enforcement_level === 'strict') {
    return (
      `Strict rule — enforced regardless of context (${mismatches.reasons.join('; ')}).` +
      degradeNote
    );
  }

  return (
    `Partial context match — ${mismatches.count} mismatch(es): ${mismatches.reasons.join('; ')}.` +
    degradeNote
  );
}

// =============================================================================
// Final score
// =============================================================================

/**
 * Weighted enforcement score for the Analysis Engine.
 *
 * Combines extraction confidence with regulatory rigidity:
 *   final_score = confidence_score × (1 − flexibility_score)
 *
 * |  enforcement  | flexibility | confidence 0.8 → final_score |
 * |---------------|-------------|-------------------------------|
 * |  strict       |    0.0      |  0.80                         |
 * |  normative    |    0.3      |  0.56                         |
 * |  adaptive     |    0.6      |  0.32                         |
 * |  recommended  |    0.7      |  0.24                         |
 * |  informative  |    1.0      |  0.00                         |
 *
 * Non-applicable rules receive final_score = 0.
 */
function computeFinalScore(rule: EnrichedRule, applicable: boolean): number {
  if (!applicable) return 0;
  const raw = rule.confidence_score * (1 - rule.flexibility_score);
  return Math.round(raw * 1000) / 1000; // 3 decimal places
}

// =============================================================================
// Public API
// =============================================================================

/**
 * Apply project context to a single EnrichedRule, producing a ContextualRule.
 *
 * @param rule    - Rule from ruleEnrichment.service
 * @param context - Current project conditions
 * @returns ContextualRule with applicable, adjusted_severity, final_score, context_reason
 */
export function applyContextToRule(
  rule: EnrichedRule,
  context: ProjectContext,
): ContextualRule {
  const baseSeverity = BASE_SEVERITY[rule.enforcement_level] ?? 'medium';
  const floor        = SEVERITY_FLOOR[rule.enforcement_level] ?? 'info';

  const mismatches   = detectMismatches(rule, context);
  const applicable   = isApplicable(rule, mismatches.count);

  // Each mismatch degrades severity by one step (strict rules are then floored)
  const degraded     = degradeSeverity(baseSeverity, mismatches.count);
  const adjusted     = applicable
    ? clampSeverity(degraded, floor)
    : 'info'; // inapplicable rules are silenced

  const final_score    = computeFinalScore(rule, applicable);
  const context_reason = buildContextReason(
    rule, context, mismatches, applicable, baseSeverity, adjusted,
  );

  return {
    ...rule,
    applicable,
    adjusted_severity: adjusted,
    final_score,
    context_reason,
  };
}

/**
 * Apply project context to an array of EnrichedRules.
 *
 * Optionally filters out inapplicable rules (default: keep them, severity = info).
 *
 * @param rules            - Rules from ruleEnrichment.service
 * @param context          - Current project conditions
 * @param filterInapplicable - If true, removes rules where applicable = false
 */
export function applyContextToRules(
  rules: EnrichedRule[],
  context: ProjectContext,
  filterInapplicable = false,
): ContextualRule[] {
  const contextual = rules.map((rule) => applyContextToRule(rule, context));
  return filterInapplicable
    ? contextual.filter((r) => r.applicable)
    : contextual;
}

/**
 * Log a summary of context application results for test/debug mode.
 */
export function logContextSummary(
  rules: ContextualRule[],
  context: ProjectContext,
): void {
  const applicable   = rules.filter((r) => r.applicable);
  const inapplicable = rules.filter((r) => !r.applicable);

  const bySeverity = applicable.reduce<Record<string, number>>((acc, r) => {
    acc[r.adjusted_severity] = (acc[r.adjusted_severity] ?? 0) + 1;
    return acc;
  }, {});

  console.log('\n══════════════════════════════════════════════════════════');
  console.log(`[ContextEngine] Project: ${context.project_type}` +
    (context.building_type ? ` / ${context.building_type}` : '') +
    (context.location      ? ` / ${context.location}` : ''));
  console.log(`[ContextEngine] Total rules evaluated : ${rules.length}`);
  console.log(`[ContextEngine]   ── applicable       : ${applicable.length}`);
  console.log(`[ContextEngine]   ── inapplicable      : ${inapplicable.length}`);
  console.log('[ContextEngine] Applicable by adjusted severity:');
  for (const [sev, count] of Object.entries(bySeverity)) {
    console.log(`[ContextEngine]   ── ${sev.padEnd(10)} : ${count}`);
  }

  // Sample: top-5 highest final_score applicable rules
  const top5 = [...applicable]
    .sort((a, b) => b.final_score - a.final_score)
    .slice(0, 5);

  console.log('\n[ContextEngine] Top 5 by final_score:');
  for (const r of top5) {
    console.log(
      `  [${r.adjusted_severity.toUpperCase().padEnd(8)}] ` +
      `score=${r.final_score.toFixed(3)}  ` +
      `${r.domain.padEnd(16)}  ` +
      r.description.slice(0, 60),
    );
  }
  console.log('══════════════════════════════════════════════════════════\n');
}
