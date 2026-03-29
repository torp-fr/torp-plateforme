/**
 * Decision Engine
 *
 * Deterministic project-vs-rules evaluator.
 * No LLM. No external libraries. No DB schema changes.
 *
 * Improvements applied:
 *   Section 1 — PropertyMatcher: similarity-gated prefix matching (LCS / max ≥ 0.7)
 *   Section 2 — QualitativeEvaluator: typed boolean/string/null dispatch
 *   Section 3 — RelativeRuleEvaluator: fraction/times/proportion resolution before INAPPLICABLE
 */

// ── Types ─────────────────────────────────────────────────────────────────────

export type EnforcementLevel =
  | 'strict'
  | 'normative'
  | 'recommended'
  | 'adaptive'
  | 'informative';

export type EvalOutcome =
  | 'PASS'
  | 'VIOLATION'
  | 'WARNING'
  | 'INAPPLICABLE'
  | 'OUT_OF_SCOPE'
  | 'CONFLICT';

export interface RuleRecord {
  id:               string;
  description:      string;
  enforcement_level: EnforcementLevel;
  confidence_score:  number;
  applicability: {
    project_type?:  'neuf' | 'renovation';
    building_type?: string;
    location?:      string;
  };
  structured_data: {
    property_key: string;
    operator:     string;
    value:        number | null;
    unit:         string | null;
    qualitative:  boolean;
  };
}

export interface ProjectData {
  [property: string]: number | boolean | string | null;
}

export interface ProjectContext {
  project_type?:  'neuf' | 'renovation';
  building_type?: string;
  location?:      string;
  /** Explicit unit declarations for numeric fields. If absent, rule's unit is assumed. */
  units?: Record<string, string>;
}

export interface RuleOutcome {
  rule_id:          string;
  property_key:     string;
  description:      string;
  enforcement_level: EnforcementLevel;
  outcome:          EvalOutcome;
  reason:           string;
  weight:           number;
}

export interface ConflictReport {
  property_key: string;
  rule_a:       string;
  rule_b:       string;
  description:  string;
}

export interface EvaluationResult {
  compliance_score: number;
  grade:            'A' | 'B' | 'C' | 'D' | 'E';
  coverage:         number;
  violations:       RuleOutcome[];
  warnings:         RuleOutcome[];
  passed:           RuleOutcome[];
  conflicts:        ConflictReport[];
  untested:         RuleOutcome[];
  low_coverage:     boolean;
  meta: {
    rules_loaded:       number;
    rules_evaluated:    number;
    rules_inapplicable: number;
    rules_out_of_scope: number;
  };
}

// ── Constants ─────────────────────────────────────────────────────────────────

const ENFORCEMENT_WEIGHTS: Readonly<Record<EnforcementLevel, number>> = {
  strict:      1.00,
  normative:   0.80,
  recommended: 0.40,
  adaptive:    0.25,
  informative: 0.10,
};

const NUMERIC_OPS = new Set(['>', '<', '>=', '<=', '=']);

// ══════════════════════════════════════════════════════════════════════════════
// SECTION 1 — PropertyMatcher
// Improvement: similarity-gated prefix matching via longest common substring.
// Prevents spurious matches while still resolving key variants and suffixes.
// ══════════════════════════════════════════════════════════════════════════════

const SIMILARITY_THRESHOLD = 0.7;

/**
 * Longest common substring length between two strings.
 * Uses a rolling 2-row DP to keep memory O(n).
 * Time: O(m × n) — negligible for property key lengths (< 60 chars).
 */
function longestCommonSubstringLength(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  let max  = 0;
  let prev = new Array<number>(n + 1).fill(0);
  let curr = new Array<number>(n + 1).fill(0);

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      curr[j] = a[i - 1] === b[j - 1] ? prev[j - 1] + 1 : 0;
      if (curr[j] > max) max = curr[j];
    }
    [prev, curr] = [curr, prev];
    curr.fill(0);
  }

  return max;
}

/**
 * Similarity score in [0, 1].
 * Formula: longest_common_substring / max(len_a, len_b).
 * Symmetric. Returns 1 for identical strings.
 */
function stringSimilarity(a: string, b: string): number {
  if (a === b) return 1;
  const lcs = longestCommonSubstringLength(a, b);
  return lcs / Math.max(a.length, b.length);
}

/**
 * Resolve a rule's property_key to a key that exists in projectData.
 *
 * Resolution order:
 *   1. Exact match — O(1)
 *   2. Alias map   — O(1)
 *   3. Similarity  — O(keys × m × n), accepts only if score ≥ 0.7, picks best
 *
 * Returns null if no match passes the threshold.
 */
export function matchProperty(
  ruleKey:     string,
  projectData: ProjectData,
  aliases:     Readonly<Record<string, string>> = {},
): string | null {
  // Level 1: exact match
  if (ruleKey in projectData) return ruleKey;

  // Level 2: alias map
  const aliased = aliases[ruleKey];
  if (aliased !== undefined && aliased in projectData) return aliased;

  // Level 3: similarity-gated prefix match with ambiguity guard
  let bestKey:    string | null = null;
  let bestSim  = 0;
  let secondSim = 0;

  for (const projectKey of Object.keys(projectData)) {
    const sim = stringSimilarity(ruleKey, projectKey);
    if (sim >= SIMILARITY_THRESHOLD) {
      if (sim > bestSim) {
        secondSim = bestSim;
        bestSim   = sim;
        bestKey   = projectKey;
      } else if (sim > secondSim) {
        secondSim = sim;
      }
    }
  }

  // Ambiguity guard: two candidates too close → refuse to guess
  if (bestKey !== null && (bestSim - secondSim) < 0.1) return null;

  return bestKey;
}

// ══════════════════════════════════════════════════════════════════════════════
// SECTION 2 — Qualitative Evaluation
// Improvement: replaces generic truthy/falsy with typed boolean/string/null
// dispatch. String values require explicit compliance markers to reach PASS;
// ambiguous strings produce WARNING instead of false PASS.
// ══════════════════════════════════════════════════════════════════════════════

/** Words that indicate a string value is explicitly compliant. */
const COMPLIANT_MARKERS = ['conforme', 'ok', 'validé', 'valide', 'oui', 'yes'] as const;

function isCompliantString(val: string): boolean {
  const lower = val.toLowerCase().trim();
  return COMPLIANT_MARKERS.some(m => lower.includes(m));
}

/**
 * Evaluate a single project value against a qualitative operator.
 *
 * Decision matrix:
 *   operator        | boolean true | boolean false | compliant string | other string | null/undefined
 *   ─────────────── | ──────────── | ───────────── | ──────────────── | ──────────── | ──────────────
 *   obligatoire     | PASS         | VIOLATION     | PASS             | WARNING      | VIOLATION
 *   conforme_a      | PASS         | VIOLATION     | PASS             | WARNING      | VIOLATION
 *   interdit        | VIOLATION    | PASS          | VIOLATION        | PASS         | PASS
 *   recommande      | PASS         | WARNING       | PASS             | WARNING      | WARNING
 */
export function evaluateQualitative(
  operator:   string,
  projectVal: unknown,
): 'PASS' | 'VIOLATION' | 'WARNING' {
  switch (operator) {
    case 'obligatoire':
    case 'conforme_a':
      return evaluatePresenceRequired(projectVal);

    case 'interdit':
      return evaluatePresenceForbidden(projectVal);

    case 'recommande': {
      const result = evaluatePresenceRequired(projectVal);
      // Soft requirement: downgrade VIOLATION → WARNING
      return result === 'VIOLATION' ? 'WARNING' : result;
    }

    default:
      return 'WARNING';
  }
}

/** Evaluate that a value is present and compliant (obligatoire / conforme_a). */
function evaluatePresenceRequired(val: unknown): 'PASS' | 'VIOLATION' | 'WARNING' {
  if (val === null || val === undefined) return 'VIOLATION';
  if (typeof val === 'boolean')          return val ? 'PASS' : 'VIOLATION';
  if (typeof val === 'string')           return isCompliantString(val) ? 'PASS' : 'WARNING';
  if (typeof val === 'number')           return val !== 0 ? 'PASS' : 'VIOLATION';
  return 'WARNING'; // unknown type
}

/** Evaluate that a value is absent or non-compliant (interdit). */
function evaluatePresenceForbidden(val: unknown): 'PASS' | 'VIOLATION' | 'WARNING' {
  if (val === null || val === undefined) return 'PASS';
  if (typeof val === 'boolean')          return val ? 'VIOLATION' : 'PASS';
  // A string with a compliance marker means the prohibited thing IS present
  if (typeof val === 'string')           return isCompliantString(val) ? 'VIOLATION' : 'PASS';
  if (typeof val === 'number')           return val !== 0 ? 'VIOLATION' : 'PASS';
  return 'WARNING';
}

// ══════════════════════════════════════════════════════════════════════════════
// SECTION 3 — Relative Rule Evaluation
// Improvement: before marking a rule INAPPLICABLE (numeric op, value=null),
// scan the description for fraction/times/proportion patterns, attempt to
// resolve the reference property, compute a derived threshold, and evaluate.
// Falls back to INAPPLICABLE only if any step fails.
// ══════════════════════════════════════════════════════════════════════════════

// Patterns that signal a relative constraint is present in the description
const RELATIVE_MARKER_RE  = /\b(\d+\s*\/\s*\d+|proportion|fois)\b/i;
const FRACTION_RE         = /\b(\d+)\s*\/\s*(\d+)\b/;
const TIMES_RE            = /\b(\d+(?:[.,]\d+)?)\s*fois\b/i;
const PROPORTION_RE       = /proportion\s+(?:de\s+)?(\d+(?:[.,]\d+)?)\s*%/i;

/** Property nouns that can appear in descriptions, paired with a key fragment. */
const REFERENCE_HINTS: Array<[RegExp, string]> = [
  [/longueur/i,   'longueur'],
  [/largeur/i,    'largeur'],
  [/hauteur/i,    'hauteur'],
  [/épaisseur/i,  'epaisseur'],
  [/diamètre/i,   'diametre'],
  [/section/i,    'section'],
  [/entraxe/i,    'entraxe'],
  [/profondeur/i, 'profondeur'],
];

/**
 * Extract a dimensionless numeric multiplier from a description string.
 * Handles: "1/3", "1/2", "3 fois", "proportion de 50%".
 * Returns null if no recognizable pattern is found.
 */
function extractMultiplier(description: string): number | null {
  const frac = FRACTION_RE.exec(description);
  if (frac) {
    const den = parseInt(frac[2], 10);
    if (den === 0) return null;
    return parseInt(frac[1], 10) / den;
  }

  const times = TIMES_RE.exec(description);
  if (times) return parseFloat(times[1].replace(',', '.'));

  const pct = PROPORTION_RE.exec(description);
  if (pct)   return parseFloat(pct[1].replace(',', '.')) / 100;

  return null;
}

/**
 * Scan the description for known property nouns and look for a matching key
 * in projectData. Returns the first project key whose name contains the hint.
 */
function findReferenceProperty(description: string, projectData: ProjectData): string | null {
  for (const [pattern, hint] of REFERENCE_HINTS) {
    if (!pattern.test(description)) continue;
    for (const key of Object.keys(projectData)) {
      if (key.includes(hint)) return key;
    }
  }
  return null;
}

interface RelativeResult {
  outcome: 'PASS' | 'VIOLATION' | 'INAPPLICABLE';
  reason:  string;
}

/**
 * Attempt to evaluate a relative constraint before falling back to INAPPLICABLE.
 *
 * Steps:
 *   1. Quick guard — bail if no relative marker in description
 *   2. Extract multiplier (fraction / times / proportion)
 *   3. Find reference property in projectData by noun-hint matching
 *   4. Compute derived threshold = multiplier × reference_value
 *   5. Evaluate: project_val [op] derived_threshold
 */
export function evaluateRelativeRule(
  operator:    string,
  description: string,
  projectVal:  unknown,
  projectData: ProjectData,
): RelativeResult {
  if (!RELATIVE_MARKER_RE.test(description)) {
    return { outcome: 'INAPPLICABLE', reason: 'no relative marker in description' };
  }

  const multiplier = extractMultiplier(description);
  if (multiplier === null) {
    return { outcome: 'INAPPLICABLE', reason: 'could not parse multiplier' };
  }

  const refKey = findReferenceProperty(description, projectData);
  if (refKey === null) {
    return { outcome: 'INAPPLICABLE', reason: 'reference property not found in project data' };
  }

  const refValue = projectData[refKey];
  if (typeof refValue !== 'number') {
    return { outcome: 'INAPPLICABLE', reason: `reference "${refKey}" is not numeric` };
  }

  if (typeof projectVal !== 'number') {
    return { outcome: 'INAPPLICABLE', reason: 'project value is not numeric' };
  }

  const threshold = multiplier * refValue;
  const passed    = applyNumericOperator(operator, projectVal, threshold);

  return {
    outcome: passed ? 'PASS' : 'VIOLATION',
    reason:  `${projectVal} ${operator} ${multiplier} × ${refKey}(${refValue}) = ${threshold.toFixed(3)}`,
  };
}

// ── Unit Normalizer ───────────────────────────────────────────────────────────

const UNIT_FACTORS: Readonly<Record<string, number>> = {
  'cm→mm':    10,
  'dm→mm':    100,
  'm→mm':     1_000,
  'kn/m²→pa': 1_000,
  'kpa→pa':   1_000,
  'mpa→pa':   1_000_000,
  'bar→pa':   100_000,
  'kn→n':     1_000,
  't→kg':     1_000,
};

/**
 * Convert a project value from its declared unit to the rule's unit.
 * Returns the converted value, or null if units are incompatible.
 * If either unit is absent, returns value unchanged (same-unit assumption).
 */
export function normalizeUnit(
  value:    number,
  fromUnit: string | null | undefined,
  toUnit:   string | null | undefined,
): number | null {
  if (!fromUnit || !toUnit) return value;
  const from = fromUnit.trim().toLowerCase();
  const to   = toUnit.trim().toLowerCase();
  if (from === to) return value;

  const factor = UNIT_FACTORS[`${from}→${to}`];
  if (factor !== undefined) return value * factor;

  const reverse = UNIT_FACTORS[`${to}→${from}`];
  if (reverse !== undefined) return value / reverse;

  return null; // incompatible
}

// ── Quantitative Operator ─────────────────────────────────────────────────────

/**
 * Apply a numeric comparison. Equality uses 1% relative tolerance to account
 * for construction measurement imprecision.
 */
function applyNumericOperator(op: string, projectVal: number, ruleVal: number): boolean {
  switch (op) {
    case '>=': return projectVal >= ruleVal;
    case '<=': return projectVal <= ruleVal;
    case '>':  return projectVal >  ruleVal;
    case '<':  return projectVal <  ruleVal;
    case '=': {
      const tol = Math.abs(ruleVal) * 0.01 || 0.001;
      return Math.abs(projectVal - ruleVal) <= tol;
    }
    default:   return false;
  }
}

// ── Conflict Detector ─────────────────────────────────────────────────────────

/**
 * Detect contradictory quantitative rules on the same property_key.
 * A conflict exists when the intersection of all rule ranges is empty
 * (e.g., rule_a: >= 80, rule_b: <= 40).
 */
export function detectConflicts(rules: RuleRecord[]): ConflictReport[] {
  const conflicts: ConflictReport[] = [];
  const byKey = new Map<string, RuleRecord[]>();

  for (const rule of rules) {
    const key = rule.structured_data.property_key;
    if (!byKey.has(key)) byKey.set(key, []);
    byKey.get(key)!.push(rule);
  }

  for (const [, group] of byKey) {
    const quant = group.filter(
      r => !r.structured_data.qualitative && r.structured_data.value !== null,
    );
    if (quant.length < 2) continue;

    let lower = -Infinity;
    let upper =  Infinity;
    let lowerRule: RuleRecord | undefined;
    let upperRule: RuleRecord | undefined;

    for (const r of quant) {
      const v  = r.structured_data.value!;
      const op = r.structured_data.operator;
      if ((op === '>=' || op === '>') && v > lower) { lower = v; lowerRule = r; }
      if ((op === '<=' || op === '<') && v < upper) { upper = v; upperRule = r; }
    }

    if (lower > upper && lowerRule && upperRule) {
      conflicts.push({
        property_key: lowerRule.structured_data.property_key,
        rule_a:       lowerRule.id,
        rule_b:       upperRule.id,
        description:  `Infeasible range: rule requires ${lowerRule.structured_data.operator} ${lower} AND ${upperRule.structured_data.operator} ${upper}`,
      });
    }
  }

  return conflicts;
}

// ── Score Aggregator ──────────────────────────────────────────────────────────

function ruleWeight(rule: RuleRecord): number {
  return ENFORCEMENT_WEIGHTS[rule.enforcement_level] * rule.confidence_score;
}

/**
 * Route a raw VIOLATION through the enforcement level.
 * Recommended/informative violations become WARNINGs (soft requirements).
 */
function routeEnforcement(
  outcome: 'PASS' | 'VIOLATION',
  level:   EnforcementLevel,
): 'PASS' | 'VIOLATION' | 'WARNING' {
  if (outcome === 'VIOLATION' && (level === 'recommended' || level === 'informative')) {
    return 'WARNING';
  }
  return outcome;
}

function scoreToGrade(score: number): 'A' | 'B' | 'C' | 'D' | 'E' {
  if (score >= 0.90) return 'A';
  if (score >= 0.75) return 'B';
  if (score >= 0.60) return 'C';
  if (score >= 0.40) return 'D';
  return 'E';
}

function buildOutcome(
  rule:   RuleRecord,
  weight: number,
  outcome: EvalOutcome,
  reason: string,
): RuleOutcome {
  return {
    rule_id:          rule.id,
    property_key:     rule.structured_data.property_key,
    description:      rule.description,
    enforcement_level: rule.enforcement_level,
    outcome,
    reason,
    weight,
  };
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Evaluate a project deterministically against a pre-fetched rule set.
 *
 * @param rules       Rules from the `rules` table (caller fetches, engine is pure)
 * @param projectData Project property values to evaluate
 * @param context     Project context for scope filtering and unit declarations
 * @param aliases     Optional property alias map { rule_key → project_key }
 */
export function evaluateProject(
  rules:       RuleRecord[],
  projectData: ProjectData,
  context:     ProjectContext,
  aliases:     Readonly<Record<string, string>> = {},
): EvaluationResult {
  const violations: RuleOutcome[]  = [];
  const warnings:   RuleOutcome[]  = [];
  const passed:     RuleOutcome[]  = [];
  const untested:   RuleOutcome[]  = [];

  const conflicts    = detectConflicts(rules);
  const conflictIds  = new Set(conflicts.flatMap(c => [c.rule_a, c.rule_b]));

  let weightedScore    = 0;
  let weightedTotal    = 0;
  let inapplicable     = 0;
  let outOfScope       = 0;

  for (const rule of rules) {
    const sd     = rule.structured_data;
    const weight = ruleWeight(rule);

    // ── 1. Scope filter ─────────────────────────────────────────────────────
    const app = rule.applicability ?? {};
    if (app.project_type  && context.project_type  && app.project_type  !== context.project_type)  { outOfScope++; continue; }
    if (app.building_type && context.building_type && app.building_type !== context.building_type) { outOfScope++; continue; }

    // ── 2. Conflict guard ────────────────────────────────────────────────────
    if (conflictIds.has(rule.id)) {
      untested.push(buildOutcome(rule, weight, 'CONFLICT', 'contradictory rule — see conflicts report'));
      continue;
    }

    // ── 3. Property match ────────────────────────────────────────────────────
    const matchedKey = matchProperty(sd.property_key, projectData, aliases);
    if (matchedKey === null) {
      inapplicable++;
      untested.push(buildOutcome(rule, weight, 'INAPPLICABLE', 'no matching project field'));
      continue;
    }

    const rawVal = projectData[matchedKey];

    // ── 4a. Qualitative path ─────────────────────────────────────────────────
    if (sd.qualitative) {
      const raw    = evaluateQualitative(sd.operator, rawVal);
      const final  = routeEnforcement(raw === 'WARNING' ? 'VIOLATION' : raw, rule.enforcement_level);
      // WARNING from evaluateQualitative is kept as-is (string ambiguity); not re-routed
      const outcome = raw === 'WARNING' ? 'WARNING' : final;
      const reason  = `operator="${sd.operator}" value=${JSON.stringify(rawVal)} → ${outcome}`;
      accumulate(outcome, weight, violations, warnings, passed, untested, rule, reason,
                 (s, t) => { weightedScore += s; weightedTotal += t; });
      continue;
    }

    // ── 4b. Quantitative path (fixed value) ──────────────────────────────────
    if (sd.value !== null) {
      // Unit sanity check: large value with a small unit is likely a unit mismatch
      const SMALL_UNITS = new Set(['mm', 'cm']);
      if (typeof rawVal === 'number' && rawVal > 1000 && SMALL_UNITS.has(sd.unit ?? '')) {
        console.warn('[DECISION] Possible unit mismatch:', sd.property_key, `value=${rawVal}`, `unit=${sd.unit}`);
      }

      if (typeof rawVal !== 'number') {
        inapplicable++;
        untested.push(buildOutcome(rule, weight, 'INAPPLICABLE', `project value "${rawVal}" is not numeric`));
        continue;
      }

      const projectUnit = context.units?.[matchedKey] ?? null;
      const normalized  = normalizeUnit(rawVal, projectUnit, sd.unit);

      if (normalized === null) {
        inapplicable++;
        untested.push(buildOutcome(rule, weight, 'INAPPLICABLE', `incompatible units: ${projectUnit} vs ${sd.unit}`));
        continue;
      }

      const ok     = applyNumericOperator(sd.operator, normalized, sd.value);
      const raw    = ok ? 'PASS' : 'VIOLATION';
      const final  = routeEnforcement(raw, rule.enforcement_level);
      const reason = ok
        ? `${normalized} ${sd.operator} ${sd.value} ${sd.unit ?? ''} ✓`
        : `${normalized} ${sd.operator} ${sd.value} ${sd.unit ?? ''} ✗`;
      accumulate(final, weight, violations, warnings, passed, untested, rule, reason,
                 (s, t) => { weightedScore += s; weightedTotal += t; });
      continue;
    }

    // ── 4c. Relative rule attempt (value=null + numeric op) ──────────────────
    if (NUMERIC_OPS.has(sd.operator)) {
      const rel = evaluateRelativeRule(sd.operator, rule.description, rawVal, projectData);

      if (rel.outcome !== 'INAPPLICABLE') {
        const final = routeEnforcement(rel.outcome, rule.enforcement_level);
        accumulate(final, weight, violations, warnings, passed, untested, rule, rel.reason,
                   (s, t) => { weightedScore += s; weightedTotal += t; });
        continue;
      }
    }

    // ── 4d. Fallback ─────────────────────────────────────────────────────────
    inapplicable++;
    untested.push(buildOutcome(rule, weight, 'INAPPLICABLE', 'relative rule — reference not resolvable'));
  }

  const score    = weightedTotal > 0 ? weightedScore / weightedTotal : 1;
  const tested   = rules.length - inapplicable - outOfScope;
  const coverage = rules.length > 0 ? tested / rules.length : 0;

  return {
    compliance_score: round3(score),
    grade:            scoreToGrade(score),
    coverage:         round3(coverage),
    low_coverage:     coverage < 0.5,
    violations,
    warnings,
    passed,
    conflicts,
    untested,
    meta: {
      rules_loaded:       rules.length,
      rules_evaluated:    tested,
      rules_inapplicable: inapplicable,
      rules_out_of_scope: outOfScope,
    },
  };
}

// ── Private helpers ───────────────────────────────────────────────────────────

function accumulate(
  outcome:    'PASS' | 'VIOLATION' | 'WARNING' | EvalOutcome,
  weight:     number,
  violations: RuleOutcome[],
  warnings:   RuleOutcome[],
  passed:     RuleOutcome[],
  untested:   RuleOutcome[],
  rule:       RuleRecord,
  reason:     string,
  addScore:   (score: number, total: number) => void,
): void {
  const o = buildOutcome(rule, weight, outcome as EvalOutcome, reason);
  switch (outcome) {
    case 'PASS':      passed.push(o);     addScore(weight,       weight); break;
    case 'VIOLATION': violations.push(o); addScore(0,            weight); break;
    case 'WARNING':   warnings.push(o);   addScore(weight * 0.5, weight); break;
    default:          untested.push(o); break;
  }
}

function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}
