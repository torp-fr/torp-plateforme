/**
 * Task Validator
 *
 * Validates a TaskRunResult against the task's ValidationRules.
 * Each check is independent and reports its own pass/fail state so the loop
 * can log precise failure reasons before deciding whether to retry.
 *
 * Checks (in evaluation order):
 *
 *   no_chunks_available  — if chunks_fetched === 0 the task passes vacuously;
 *                          no further checks are run
 *   allow_empty          — fails when rules_extracted === 0 and allow_empty is false
 *   min_rules            — rules_after_dedup must reach the category minimum
 *   duplication_rate     — cross-chunk duplicate ratio must be within the limit
 *   no_errors            — all chunks must have processed without errors
 *
 * The overall result passes only when every applicable check passes.
 */

import type { TaskRunResult } from './taskRunner';
import type { ValidationRules } from './taskRegistry';
import { RULE_EXPECTATIONS } from './ruleExpectations';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ValidationCheck {
  /** Machine-readable check identifier */
  name: string;
  /** True when the check's condition is satisfied */
  passed: boolean;
  /** Observed value for this check */
  actual: number | boolean | string;
  /** Human-readable expectation */
  expected: string;
  /** One-sentence explanation of the outcome */
  message: string;
}

export interface ValidationResult {
  /** True only when every applicable check passed */
  passed: boolean;
  /** Individual check outcomes — always at least one entry */
  checks: ValidationCheck[];
  /** One-line summary for logging and task error fields */
  summary: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function pct(rate: number): string {
  return `${(rate * 100).toFixed(1)}%`;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Validate a TaskRunResult against a set of ValidationRules.
 *
 * @param result - The output of runTask()
 * @param rules  - The ValidationRules from the task that produced the result
 * @returns ValidationResult with individual check outcomes and an overall verdict
 */
export function validateResult(
  result: TaskRunResult,
  rules:  ValidationRules,
): ValidationResult {

  // ── Special case: nothing to process ──────────────────────────────────────
  // When no unprocessed chunks exist the category corpus is already fully
  // processed. This is a valid terminal state, not an extraction failure.
  if (result.chunks_fetched === 0) {
    const check: ValidationCheck = {
      name:     'no_chunks_available',
      passed:   true,
      actual:   0,
      expected: 'n/a',
      message:  'No unprocessed chunks found for this category — already fully processed',
    };
    return {
      passed:  true,
      checks:  [check],
      summary: 'No unprocessed chunks — task vacuously passed',
    };
  }

  const checks: ValidationCheck[] = [];

  // ── Check 1: Empty result gate ─────────────────────────────────────────────
  // Only evaluated when allow_empty is false.
  if (!rules.allow_empty) {
    const passed = result.rules_extracted > 0;
    checks.push({
      name:     'allow_empty',
      passed,
      actual:   result.rules_extracted,
      expected: '> 0 rules',
      message: passed
        ? `${result.rules_extracted} rules extracted — result is not empty`
        : 'Zero rules extracted; allow_empty is false for this category',
    });
  }

  // ── Check 2: Minimum unique rules ─────────────────────────────────────────
  const meetsMin = result.rules_after_dedup >= rules.min_rules;
  checks.push({
    name:     'min_rules',
    passed:   meetsMin,
    actual:   result.rules_after_dedup,
    expected: `>= ${rules.min_rules}`,
    message: meetsMin
      ? `${result.rules_after_dedup} unique rules meets minimum of ${rules.min_rules}`
      : `${result.rules_after_dedup} unique rules is below minimum of ${rules.min_rules}`,
  });

  // ── Check 3: Duplication rate ──────────────────────────────────────────────
  // A high duplication rate indicates that the same patterns recur across
  // chunks, which often signals low-quality or repetitive source documents.
  const meetsDedup = result.duplication_rate <= rules.max_duplication_rate;
  checks.push({
    name:     'duplication_rate',
    passed:   meetsDedup,
    actual:   result.duplication_rate,
    expected: `<= ${pct(rules.max_duplication_rate)}`,
    message: meetsDedup
      ? `Duplication rate ${pct(result.duplication_rate)} is within the ${pct(rules.max_duplication_rate)} limit`
      : `Duplication rate ${pct(result.duplication_rate)} exceeds the ${pct(rules.max_duplication_rate)} limit`,
  });

  // ── Check 4: No per-chunk extraction errors ────────────────────────────────
  // Any error means at least one chunk was not processed and will be retried.
  // Failing this check creates a retry task so the skipped chunks get another
  // chance rather than being silently abandoned.
  const noErrors = result.errors.length === 0;
  const errorSample = result.errors
    .slice(0, 2)
    .join('; ')
    .concat(result.errors.length > 2 ? ` (+ ${result.errors.length - 2} more)` : '');

  checks.push({
    name:     'no_errors',
    passed:   noErrors,
    actual:   result.errors.length,
    expected: '0 errors',
    message: noErrors
      ? 'All chunks processed without errors'
      : `${result.errors.length} chunk(s) failed: ${errorSample}`,
  });

  // ── Check 5: Domain completeness — missing rule types ─────────────────────
  // Passes when every required rule type for the category has at least one
  // representative in the post-dedup rule set.
  // This check is informational for categories that don't strictly require all
  // types (GUIDE_TECHNIQUE, CODE_CONSTRUCTION) but acts as a hard gate for
  // categories with min_coverage = 1.0 (currently GUIDE_TECHNIQUE).
  if (result.domain_coverage && result.domain_coverage.expected_rule_types.length > 0) {
    const dc            = result.domain_coverage;
    const allPresent    = dc.missing_rule_types.length === 0;
    const expectation   = RULE_EXPECTATIONS[result.category as keyof typeof RULE_EXPECTATIONS];

    checks.push({
      name:     'missing_rule_types',
      passed:   allPresent,
      actual:   dc.missing_rule_types.length === 0
        ? 'all present'
        : dc.missing_rule_types.join(', '),
      expected: `all of: ${dc.expected_rule_types.join(', ')}`,
      message: allPresent
        ? `All ${dc.expected_rule_types.length} required rule type(s) present: [${dc.present_rule_types.join(', ')}]`
        : `Missing rule type(s): [${dc.missing_rule_types.join(', ')}] — ` +
          `present: [${dc.present_rule_types.join(', ')}] — ` +
          (expectation
            ? `see RULE_EXPECTATIONS['${result.category}'] for fix guidance`
            : 'check extraction patterns for this category'),
    });

    // ── Check 6: Domain coverage threshold ──────────────────────────────────
    // Hard gate: fails when coverage_ratio < min_coverage.
    // Distinct from check 5 — a batch may have some types present but still
    // fail the coverage threshold (e.g. only 1 of 3 types for DTU).
    const meetsThreshold = dc.meets_threshold;
    checks.push({
      name:     'incomplete_rule_coverage',
      passed:   meetsThreshold,
      actual:   `${dc.coverage_percentage}%`,
      expected: `>= ${Math.round(dc.min_coverage * 100)}%`,
      message: meetsThreshold
        ? `Domain coverage ${dc.coverage_percentage}% meets the ` +
          `${Math.round(dc.min_coverage * 100)}% threshold for ${result.category}`
        : `Domain coverage ${dc.coverage_percentage}% is below the ` +
          `${Math.round(dc.min_coverage * 100)}% threshold for ${result.category} ` +
          `(${dc.present_rule_types.length}/${dc.expected_rule_types.length} types present)`,
    });
  }

  // ── Overall verdict ────────────────────────────────────────────────────────
  const failedChecks = checks.filter((c) => !c.passed);
  const passed       = failedChecks.length === 0;

  const summary = passed
    ? `All ${checks.length} validation checks passed`
    : `${failedChecks.length}/${checks.length} check(s) failed: ${failedChecks.map((c) => c.name).join(', ')}`;

  return { passed, checks, summary };
}
