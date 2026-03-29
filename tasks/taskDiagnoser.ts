/**
 * Task Diagnoser
 *
 * Analyses a failed validation and produces a structured Diagnosis that
 * explains WHY the task failed and WHAT fixes to attempt.
 *
 * The diagnoser is pure: it has no side effects, makes no DB calls,
 * and does not modify the registry. It only reads the task config,
 * the run result, and the validation outcome.
 *
 * Diagnosis priority (when multiple checks fail simultaneously):
 *   1. EMPTY_RESULT        — zero rules; most severe, blocks all other checks
 *   2. LOW_RULE_COUNT      — too few unique rules after deduplication
 *   3. HIGH_DUPLICATION    — cross-chunk duplicate ratio too high
 *   4. EXTRACTION_ERRORS   — per-chunk failures during extraction
 *   5. UNKNOWN             — fallback when no pattern matches
 *
 * Each Diagnosis carries an ordered list of FixStrategy values.
 * The fixer picks the first unapplied strategy on each fix cycle.
 */

import type { Task } from './taskRegistry';
import type { TaskRunResult } from './taskRunner';
import type { ValidationResult } from './taskValidator';
import { RULE_EXPECTATIONS, type DomainDiagnosisCode, type DomainFixStrategy } from './ruleExpectations';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type DiagnosisCode =
  | 'EMPTY_RESULT'       // 0 rules extracted; allow_empty is false
  | 'LOW_RULE_COUNT'     // rules_after_dedup < min_rules
  | 'HIGH_DUPLICATION'   // duplication_rate > max_duplication_rate
  | 'EXTRACTION_ERRORS'  // errors.length > 0 caused the no_errors check to fail
  // Domain completeness codes (from missing_rule_types / incomplete_rule_coverage checks)
  | DomainDiagnosisCode
  | 'UNKNOWN';           // validation failed but no pattern identified

export type DiagnosisSeverity = 'critical' | 'warning' | 'info';

/**
 * Fix strategies the fixer knows how to execute.
 * Each name is self-documenting; see taskFixer.ts for implementation details.
 *
 * All strategies improve extraction quality — none relax validation thresholds.
 */
export type FixStrategy =
  | 'INCREASE_BATCH_SIZE'    // batch_size × 2, capped at 100 — more input data
  | 'ISOLATE_ERRORS'         // batch_size ÷ 4 (min 3) — isolate failing chunks
  | 'STRENGTHEN_EXTRACTION'  // lower min_sentence_length + enable supplemental pass
  | 'FALLBACK_EXTRACTION'    // enable generic extractor fallback + normalize content
  | 'NORMALIZE_DEDUP'        // content normalization + near-dedup at 85% Jaccard
  | 'AGGRESSIVE_DEDUP'       // near-dedup at 70% Jaccard (more aggressive collapse)
  | 'SKIP_ERRORS_REATTEMPT'  // retry without config change (transient errors)
  // Domain-targeted fix strategies (applied when domain coverage checks fail)
  | DomainFixStrategy
  | 'NO_FIX_AVAILABLE';      // no applicable fix; task retires to standard retry

export interface Diagnosis {
  /** Machine-readable failure code */
  code: DiagnosisCode;
  /** Severity of the failure */
  severity: DiagnosisSeverity;
  /** One-sentence description of the observed failure */
  description: string;
  /** Explanation of the likely root cause */
  root_cause: string;
  /**
   * Ordered list of fix strategies to try.
   * The fixer picks the first unapplied strategy on each fix cycle.
   * The list always ends with NO_FIX_AVAILABLE as the final fallback.
   */
  suggested_fixes: FixStrategy[];
  /** Observed metrics relevant to this diagnosis */
  metrics: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Analyse a failed ValidationResult and produce a Diagnosis.
 *
 * @param task       - Task whose config (batch_size, validation) is inspected
 * @param validation - Result of validateResult() for the most recent run
 * @param result     - The TaskRunResult that failed validation
 * @returns A Diagnosis describing the failure and the ordered fix strategies
 */
export function diagnoseFailure(
  task:       Task,
  validation: ValidationResult,
  result:     TaskRunResult,
): Diagnosis {
  const failed = new Set(
    validation.checks.filter((c) => !c.passed).map((c) => c.name),
  );

  // ── 1. Empty result ────────────────────────────────────────────────────────
  if (failed.has('allow_empty')) {
    const hadChunks = result.chunks_fetched > 0;
    const allShort  = result.chunks_skipped === result.chunks_fetched && result.chunks_fetched > 0;

    return {
      code:        'EMPTY_RESULT',
      severity:    'critical',
      description: `Zero rules extracted from ${result.chunks_fetched} fetched chunk(s).`,
      root_cause:  allShort
        ? 'All fetched chunks were below the minimum content length and were skipped. ' +
          'The source documents may be very short or purely administrative.'
        : hadChunks
          ? 'Chunks were fetched and processed but no rules matched any extraction pattern. ' +
            'Possible causes: administrative content only (preamble, index), or the extractor ' +
            'patterns do not match this category\'s document style.'
          : 'No unprocessed chunks were found for this category. The corpus may be empty ' +
            'or all documents may already be marked as processed.',
      suggested_fixes: hadChunks
        ? ['FALLBACK_EXTRACTION', 'STRENGTHEN_EXTRACTION', 'NO_FIX_AVAILABLE']
        : ['NO_FIX_AVAILABLE'],
      metrics: {
        chunks_fetched:   result.chunks_fetched,
        chunks_processed: result.chunks_processed,
        chunks_skipped:   result.chunks_skipped,
        rules_extracted:  result.rules_extracted,
        batch_size:       task.batch_size,
      },
    };
  }

  // ── 2. Low rule count ──────────────────────────────────────────────────────
  if (failed.has('min_rules')) {
    const deficit     = task.validation.min_rules - result.rules_after_dedup;
    const nearMissThreshold = Math.ceil(task.validation.min_rules * 0.30);
    const isNearMiss  = deficit <= nearMissThreshold;
    const batchAtMax  = task.batch_size >= 100;
    const noMoreChunks = result.chunks_fetched < task.batch_size; // fetched < requested → corpus exhausted

    const root_cause = batchAtMax || noMoreChunks
      ? 'The available corpus is either fully processed or exhausted at the current batch size. ' +
        'The extraction patterns may not match the source document style — a supplemental pass ' +
        'with the generic DTU extractor can surface rules the category extractor missed.'
      : isNearMiss
        ? `Only ${deficit} rule(s) short of the minimum. A supplemental extraction pass or ` +
          'processing more chunks in the next batch is likely sufficient to close the gap.'
        : 'The batch processed too few chunks or the extraction yield per chunk is very low. ' +
          'Increasing the batch size provides more input; enabling the supplemental pass ' +
          'extracts rules the category-specific extractor missed.';

    const suggested_fixes: FixStrategy[] = batchAtMax || noMoreChunks
      ? ['STRENGTHEN_EXTRACTION', 'NO_FIX_AVAILABLE']
      : isNearMiss
        ? ['STRENGTHEN_EXTRACTION', 'INCREASE_BATCH_SIZE', 'NO_FIX_AVAILABLE']
        : ['INCREASE_BATCH_SIZE',   'STRENGTHEN_EXTRACTION', 'NO_FIX_AVAILABLE'];

    return {
      code:        'LOW_RULE_COUNT',
      severity:    isNearMiss ? 'warning' : 'critical',
      description:
        `${result.rules_after_dedup} unique rule(s) found; ` +
        `minimum required is ${task.validation.min_rules} (${deficit} short).`,
      root_cause,
      suggested_fixes,
      metrics: {
        rules_after_dedup:  result.rules_after_dedup,
        rules_extracted:    result.rules_extracted,
        min_rules:          task.validation.min_rules,
        deficit,
        batch_size:         task.batch_size,
        chunks_fetched:     result.chunks_fetched,
        chunks_processed:   result.chunks_processed,
      },
    };
  }

  // ── 3. High duplication ────────────────────────────────────────────────────
  if (failed.has('duplication_rate')) {
    const actual   = result.duplication_rate;
    const limit    = task.validation.max_duplication_rate;
    const excess   = actual - limit;
    const isSevere = excess > 0.25;
    const duplicatesRemoved = result.rules_extracted - result.rules_after_dedup;

    return {
      code:        'HIGH_DUPLICATION',
      severity:    isSevere ? 'critical' : 'warning',
      description:
        `Duplication rate ${(actual * 100).toFixed(1)}% exceeds the ` +
        `${(limit * 100).toFixed(0)}% limit (${duplicatesRemoved} duplicate(s) removed).`,
      root_cause:
        'Multiple chunks from the same or closely related source documents are producing ' +
        'identical rule signatures. Root causes: (1) the source corpus contains reprinted or ' +
        'copy-pasted sections; (2) the same document was ingested more than once; ' +
        '(3) the chunk overlap settings produce overlapping content.',
      suggested_fixes: isSevere
        ? ['NORMALIZE_DEDUP', 'AGGRESSIVE_DEDUP', 'NO_FIX_AVAILABLE']
        : ['NORMALIZE_DEDUP', 'AGGRESSIVE_DEDUP', 'NO_FIX_AVAILABLE'],
      metrics: {
        duplication_rate:    actual,
        max_allowed:         limit,
        excess_pct:          `${(excess * 100).toFixed(1)}pp above limit`,
        duplicates_removed:  duplicatesRemoved,
        rules_extracted:     result.rules_extracted,
        rules_after_dedup:   result.rules_after_dedup,
      },
    };
  }

  // ── 4. Extraction errors ───────────────────────────────────────────────────
  if (failed.has('no_errors')) {
    const errorCount    = result.errors.length;
    const totalChunks   = result.chunks_fetched;
    const errorRate     = totalChunks > 0 ? errorCount / totalChunks : 1;
    const isSystemic    = errorRate > 0.5;

    return {
      code:        'EXTRACTION_ERRORS',
      severity:    isSystemic ? 'critical' : 'warning',
      description: `${errorCount} of ${totalChunks} chunk(s) failed during extraction.`,
      root_cause:  isSystemic
        ? 'More than 50% of chunks failed. This is likely a systemic issue: DB connection ' +
          'problem, RLS policy blocking writes, a category normalisation error, or the ' +
          'rules table schema has diverged from the insert payload.'
        : 'A minority of chunks failed. Failures are typically transient (network timeout, ' +
          'momentary DB overload) or isolated to specific chunks with malformed content. ' +
          'Failed chunks were NOT marked as processed and will be retried on the next run.',
      suggested_fixes: isSystemic
        ? ['SKIP_ERRORS_REATTEMPT', 'ISOLATE_ERRORS', 'NO_FIX_AVAILABLE']
        : ['SKIP_ERRORS_REATTEMPT', 'ISOLATE_ERRORS', 'NO_FIX_AVAILABLE'],
      metrics: {
        error_count:    errorCount,
        total_chunks:   totalChunks,
        error_rate:     `${(errorRate * 100).toFixed(1)}%`,
        is_systemic:    isSystemic,
        sample_errors:  result.errors.slice(0, 3),
      },
    };
  }

  // ── 5. Domain coverage failures ────────────────────────────────────────────
  // missing_rule_types or incomplete_rule_coverage failed.
  // Strategy: inspect which specific types are missing and map each to a
  // targeted fix. If multiple types are missing, the highest-priority one wins;
  // subsequent fix cycles handle the remaining types.
  if (failed.has('missing_rule_types') || failed.has('incomplete_rule_coverage')) {
    const dc = result.domain_coverage;

    // Edge case: domain_coverage not yet populated (early vacuous pass)
    if (!dc || dc.expected_rule_types.length === 0) {
      return {
        code:            'INSUFFICIENT_DOMAIN_COVERAGE',
        severity:        'info',
        description:     'Domain coverage check failed but domain_coverage data is unavailable.',
        root_cause:      'The runner did not populate domain_coverage — this may be a first-run with 0 rules.',
        suggested_fixes: ['DOMAIN_FULL_SUPPLEMENTAL', 'NO_FIX_AVAILABLE'],
        metrics:         { failed_checks: [...failed] },
      };
    }

    const expectation  = RULE_EXPECTATIONS[task.category];

    // Map each missing type to its diagnosis code and fix strategy
    const missingSpecs = (expectation?.required_rule_types ?? [])
      .filter((rt) => dc.missing_rule_types.includes(rt.id));

    if (missingSpecs.length > 0) {
      // Pick the first (highest-priority) missing type for this cycle
      const primary = missingSpecs[0];

      // Build the ordered fix list: primary fix first, then generic supplemental
      // as fallback, then NO_FIX_AVAILABLE
      const suggested_fixes: FixStrategy[] = [
        primary.missing_fix,
        'DOMAIN_FULL_SUPPLEMENTAL',
        'NO_FIX_AVAILABLE',
      ];

      const missingLabels = missingSpecs.map((s) => s.label).join(', ');
      const missingIds    = dc.missing_rule_types.join(', ');

      return {
        code:     primary.missing_diagnosis,
        severity: dc.meets_threshold ? 'warning' : 'critical',
        description:
          `Domain coverage ${dc.coverage_percentage}% — ` +
          `missing rule type(s): [${missingIds}] ` +
          `(${dc.present_rule_types.length}/${dc.expected_rule_types.length} types present).`,
        root_cause:
          `The extraction produced insufficient coverage of: ${missingLabels}. ` +
          `Probable causes: (1) source chunks do not contain content of this type; ` +
          `(2) the extractor's patterns did not match the document style; ` +
          `(3) batch size too small — not enough chunks processed to encounter all rule types. ` +
          (missingIds.includes('tolerance')
            ? 'Tolerance rules are often in annexes or tables — a supplemental pass over all chunks helps. '
            : '') +
          (missingIds.includes('legal_ref') || missingIds.includes('article')
            ? 'Article references appear in short article-header sentences — lower the length threshold. '
            : '') +
          (missingIds.includes('coefficient')
            ? 'Coefficient definitions are in normative annexes — a full supplemental pass is needed. '
            : ''),
        suggested_fixes,
        metrics: {
          category:              dc.category,
          coverage_ratio:        dc.coverage_ratio,
          coverage_percentage:   dc.coverage_percentage,
          min_coverage:          dc.min_coverage,
          meets_threshold:       dc.meets_threshold,
          present_rule_types:    dc.present_rule_types,
          missing_rule_types:    dc.missing_rule_types,
          sub_type_distribution: dc.sub_type_distribution,
          rules_after_dedup:     result.rules_after_dedup,
          batch_size:            task.batch_size,
        },
      };
    }

    // Coverage below threshold but no individually missing types identified
    // (e.g. all types present but coverage_ratio computation differs)
    return {
      code:        'INSUFFICIENT_DOMAIN_COVERAGE',
      severity:    'warning',
      description: `Domain coverage ${dc.coverage_percentage}% is below the ${Math.round(dc.min_coverage * 100)}% threshold.`,
      root_cause:
        'Coverage ratio is below threshold despite types being present. ' +
        'Increasing the batch size or running a full supplemental pass may raise the rule count ' +
        'for the underrepresented types.',
      suggested_fixes: ['DOMAIN_FULL_SUPPLEMENTAL', 'INCREASE_BATCH_SIZE', 'NO_FIX_AVAILABLE'],
      metrics: {
        coverage_percentage:  dc.coverage_percentage,
        min_coverage:         dc.min_coverage,
        present_rule_types:   dc.present_rule_types,
        missing_rule_types:   dc.missing_rule_types,
      },
    };
  }

  // ── 6. Unknown ─────────────────────────────────────────────────────────────
  return {
    code:            'UNKNOWN',
    severity:        'info',
    description:     'Validation failed but no specific failure pattern could be identified.',
    root_cause:      'Check the full validation check list and per-chunk logs for clues.',
    suggested_fixes: ['NO_FIX_AVAILABLE'],
    metrics: {
      failed_checks:   [...failed],
      rules_extracted: result.rules_extracted,
      errors:          result.errors.length,
    },
  };
}
