/**
 * Check Builder Service
 *
 * Transforms extracted rules (from ruleExtraction.service) into AnalysisChecks
 * that can be evaluated by the Devis Analysis Engine against quote line items.
 *
 * This is a pure transformation layer — it does not read from or write to the DB.
 * It is deterministic and side-effect-free.
 *
 * Usage:
 *   import { buildChecksFromRules } from '@/services/checkBuilder.service';
 *   const checks = buildChecksFromRules(rules);
 *
 * Check types:
 *   "min_value"  — operator >= or >  : value must be at least expected_value
 *   "max_value"  — operator <= or <  : value must be at most expected_value
 *   "presence"   — requirement rules : item/property must be present and compliant
 *   "compliance" — range operator    : value must fall within bounds (stored in metadata)
 */

import type { ExtractedRule, RuleType } from './ruleExtraction.service';
import type { Severity, CheckType } from '@/types/analysis.types';

export type { Severity, CheckType }; // re-export for downstream consumers

/**
 * ExtractedRule enriched with the DB-assigned id after persistence.
 * Use this type when loading rules from the `rules` table for check building.
 */
export interface PersistedRule extends ExtractedRule {
  /** UUID from rules.id — populated after DB insert */
  rule_id: string;
}

// =============================================================================
// Public types
// =============================================================================

export interface AnalysisCheck {
  /** Unique check identifier: `chk_${rule_id}_${type}` */
  id: string;

  /** Source rule — joins back to rules.id in the DB */
  rule_id: string;

  type: CheckType;

  /**
   * The measurable attribute or object being checked.
   *
   * Quantitative: property from structured_data (e.g. "pente", "épaisseur")
   * Qualitative:  derived label from description (e.g. "fixation conforme")
   */
  target: string;

  /** Threshold value (min_value / max_value / compliance only) */
  expected_value?: number;

  /** SI or domain unit matching structured_data.unit */
  unit?: string;

  severity: Severity;

  /** DTU domain from source rule (e.g. "plomberie", "électricité") */
  domain: string;

  /**
   * Extra context for the Analysis Engine:
   *   - element, conditions, context from quantitative structured_data
   *   - tags from qualitative structured_data
   *   - range bounds for compliance checks
   *   - source_sentence for audit trail
   */
  metadata?: Record<string, unknown>;
}

// =============================================================================
// Severity mapping
// =============================================================================

/**
 * Determine check severity from the source rule's type and domain.
 *
 * - DTU constraints (numeric limits)   → critical  (regulatory non-compliance)
 * - DTU requirements (qualitative)     → high      (mandatory obligation)
 * - Recommendations                    → medium
 * - Everything else (price, formula)   → low
 */
function severityFor(ruleType: RuleType, _domain: string): Severity {
  switch (ruleType) {
    case 'constraint':      return 'critical';
    case 'requirement':     return 'high';
    case 'recommendation':  return 'medium';
    default:                return 'low';
  }
}

// =============================================================================
// Qualitative target extraction
// =============================================================================

/**
 * Derive a concise, human-readable target label from a requirement description.
 *
 * Strategy:
 *  1. Strip modal verbs and leading filler.
 *  2. Take the first meaningful noun phrase (≤ 5 words).
 *  3. Suffix with " conforme" to signal a compliance expectation.
 *
 * Examples:
 *   "doit être fixé correctement"    → "fixation conforme"
 *   "doivent être étanches"          → "étanchéité conforme"
 *   "il faut vérifier l'alignement"  → "alignement conforme"
 */
const MODAL_STRIP_RE = /^(doit(vent)?\s+(être\s+)?|il\s+faut\s+|est\s+obligatoire\s*[:,]?\s*|doit\s+(permettre|respecter)\s+[a-zÀ-ÿ]+\s+)/i;

const NOUN_HINTS: ReadonlyMap<string, string> = new Map([
  ['fixé',         'fixation'],
  ['fixée',        'fixation'],
  ['étanche',      'étanchéité'],
  ['étanches',     'étanchéité'],
  ['aligné',       'alignement'],
  ['conforme',     'conformité'],
  ['protégé',      'protection'],
  ['isolé',        'isolation'],
  ['ventilé',      'ventilation'],
  ['ancré',        'ancrage'],
  ['scellé',       'scellement'],
  ['vérifié',      'vérification'],
  ['résistant',    'résistance'],
  ['accessible',   'accessibilité'],
]);

function qualitativeTarget(description: string): string {
  const stripped = description.replace(MODAL_STRIP_RE, '').trim();

  // Check for a known noun hint from the first few words
  const words = stripped.split(/\s+/).slice(0, 6);
  for (const word of words) {
    const hint = NOUN_HINTS.get(word.toLowerCase().replace(/[.,;:]/g, ''));
    if (hint) return `${hint} conforme`;
  }

  // Fallback: take the first 1–3 meaningful words
  const meaningful = words
    .filter((w) => w.length > 3)
    .slice(0, 3)
    .join(' ')
    .replace(/[.,;:]+$/, '');

  return meaningful ? `${meaningful} conforme` : 'exigence conforme';
}

// =============================================================================
// ID generation
// =============================================================================

function checkId(ruleId: string, type: CheckType): string {
  // rule_id may be a UUID or a temporary key — truncate for readability
  const short = ruleId.length > 8 ? ruleId.slice(0, 8) : ruleId;
  return `chk_${short}_${type}`;
}

// =============================================================================
// Core transformation
// =============================================================================

/**
 * Transform a single ExtractedRule into zero, one, or two AnalysisChecks.
 *
 * A "range" operator (e.g. "between 2% and 5%") produces a single "compliance"
 * check; all other numeric operators produce exactly one min_value or max_value.
 * Qualitative requirements produce exactly one "presence" check.
 * Rules with unknown operators and no qualitative flag are dropped.
 */
function ruleToChecks(rule: ExtractedRule | PersistedRule): AnalysisCheck[] {
  const ruleKey = ('rule_id' in rule) ? rule.rule_id : rule.signature;
  const severity = severityFor(rule.rule_type, rule.domain);
  const sd = rule.structured_data;

  // ── Qualitative path ──────────────────────────────────────────────────────
  if (rule.rule_type === 'requirement' || sd?.qualitative === true) {
    const target = qualitativeTarget(rule.description);
    const check: AnalysisCheck = {
      id:       checkId(ruleKey, 'presence'),
      rule_id:  ruleKey,
      type:     'presence',
      target,
      severity,
      domain:   rule.domain,
      metadata: {
        description:     rule.description,
        source_sentence: rule.source_sentence,
        tags:            sd?.tags ?? [],
      },
    };
    return [check];
  }

  // ── Quantitative path ─────────────────────────────────────────────────────
  if (!sd || sd.value === null) return [];

  const target = sd.property;
  const base: Omit<AnalysisCheck, 'id' | 'type' | 'expected_value'> = {
    rule_id:        ruleKey,
    target,
    unit:           sd.unit ?? undefined,
    severity,
    domain:         rule.domain,
    metadata: {
      element:         sd.element,
      conditions:      sd.conditions,
      context:         sd.context,
      source_sentence: rule.source_sentence,
      raw:             sd.raw,
    },
  };

  switch (sd.operator) {
    case '>=':
    case '>':
      return [{
        ...base,
        id:             checkId(base.rule_id, 'min_value'),
        type:           'min_value',
        expected_value: sd.value,
      }];

    case '<=':
    case '<':
      return [{
        ...base,
        id:             checkId(base.rule_id, 'max_value'),
        type:           'max_value',
        expected_value: sd.value,
      }];

    case '=':
      // Treat exact equality as both a min and a max (tight band)
      return [{
        ...base,
        id:             checkId(base.rule_id, 'min_value'),
        type:           'min_value',
        expected_value: sd.value,
      }, {
        ...base,
        id:             checkId(base.rule_id, 'max_value'),
        type:           'max_value',
        expected_value: sd.value,
      }];

    case 'range': {
      // Range bounds stored in metadata.context or inferred from value
      const rangeMin = (sd.context?.['min'] !== undefined)
        ? Number(sd.context['min'])
        : sd.value;
      const rangeMax = (sd.context?.['max'] !== undefined)
        ? Number(sd.context['max'])
        : sd.value;
      return [{
        ...base,
        id:   checkId(base.rule_id, 'compliance'),
        type: 'compliance',
        expected_value: rangeMin,
        metadata: {
          ...base.metadata,
          range_min: rangeMin,
          range_max: rangeMax,
        },
      }];
    }

    default:
      // operator = 'unknown' — not enough information to build a check
      return [];
  }
}

// =============================================================================
// Public API
// =============================================================================

/**
 * Transform an array of ExtractedRules into AnalysisChecks.
 *
 * Rules are expected to carry a `rule_id` field populated from the DB row id
 * after persistence. If missing, the rule's `signature` is used as a stable key.
 *
 * @param rules - Rules from ruleExtraction.service or loaded from the `rules` table
 * @returns Flat array of AnalysisChecks, ready for engine evaluation
 */
export function buildChecksFromRules(rules: Array<ExtractedRule | PersistedRule>): AnalysisCheck[] {
  const checks: AnalysisCheck[] = [];
  for (const rule of rules) {
    const produced = ruleToChecks(rule);
    checks.push(...produced);
  }
  return checks;
}

/**
 * Log a sample of generated checks for test/debug mode.
 *
 * Prints:
 *  - total check count and breakdown by type
 *  - up to `sampleSize` individual checks (default: 5)
 */
export function logCheckSample(checks: AnalysisCheck[], sampleSize = 5): void {
  const byType = checks.reduce<Record<string, number>>((acc, c) => {
    acc[c.type] = (acc[c.type] ?? 0) + 1;
    return acc;
  }, {});

  console.log('\n══════════════════════════════════════════════════════════');
  console.log(`[CheckBuilder] Total checks generated : ${checks.length}`);
  for (const [type, count] of Object.entries(byType)) {
    console.log(`[CheckBuilder]   ── ${type.padEnd(12)} : ${count}`);
  }

  const bySeverity = checks.reduce<Record<string, number>>((acc, c) => {
    acc[c.severity] = (acc[c.severity] ?? 0) + 1;
    return acc;
  }, {});
  console.log('[CheckBuilder] By severity:');
  for (const [sev, count] of Object.entries(bySeverity)) {
    console.log(`[CheckBuilder]   ── ${sev.padEnd(10)} : ${count}`);
  }

  console.log(`\n[CheckBuilder] Sample (first ${sampleSize}):`);
  for (const check of checks.slice(0, sampleSize)) {
    const val = check.expected_value !== undefined
      ? ` → ${check.expected_value}${check.unit ? ' ' + check.unit : ''}`
      : '';
    console.log(
      `  [${check.severity.toUpperCase()}] ${check.type.padEnd(12)} | ${check.domain.padEnd(16)} | ${check.target}${val}`,
    );
  }
  console.log('══════════════════════════════════════════════════════════\n');
}
