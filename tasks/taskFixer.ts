/**
 * Task Fixer — Extraction-Quality Edition
 *
 * Applies concrete fixes that improve EXTRACTION QUALITY.
 * Validation thresholds (min_rules, max_duplication_rate) are never touched.
 *
 * All fixes write to two possible surfaces:
 *   ExtractionConfig store  — how the runner extracts, filters, and deduplicates
 *   TaskRegistry            — batch_size (data volume in the next run)
 *
 * Fix strategies and what they change:
 *
 *   STRENGTHEN_EXTRACTION
 *     min_sentence_length  → 50 (catch shorter technical specifications)
 *     enable_supplemental_pass → true (run generic DTU extractor as second pass
 *       on any chunk that yields < 3 rules from the category extractor)
 *     Effect: surfaces rules in chunks where the category patterns matched few
 *             sentences — especially useful for EUROCODE and CODE_CONSTRUCTION.
 *
 *   FALLBACK_EXTRACTION
 *     min_sentence_length       → 30 (most permissive — catches brief clauses)
 *     normalize_content         → true (strip accents, collapse whitespace)
 *     enable_category_fallback  → true (for zero-yield chunks: run generic extractor)
 *     enable_supplemental_pass  → true (trigger at threshold 1 — every chunk)
 *     Effect: maximum recall mode. Catches implicit rules and content that
 *             regex patterns miss due to encoding artefacts from PDF export.
 *
 *   NORMALIZE_DEDUP
 *     normalize_content    → true (stabilize pattern matching on PDF-derived text)
 *     enable_near_dedup    → true (Jaccard word-set similarity threshold 0.85)
 *     Effect: removes paraphrased duplicates — same constraint stated with
 *             slightly different wording across overlapping chunks.
 *
 *   AGGRESSIVE_DEDUP
 *     enable_near_dedup    → true
 *     near_dedup_threshold → 0.70 (70% word overlap → treat as duplicate)
 *     Effect: collapses loosely paraphrased variants. More aggressive than
 *             NORMALIZE_DEDUP; use when high duplication persists after it.
 *
 *   INCREASE_BATCH_SIZE
 *     task.batch_size      × 2, capped at 100
 *     Effect: processes more chunks → more candidate rules → better chance of
 *             meeting min_rules when the per-chunk yield is low but corpus is large.
 *
 *   ISOLATE_ERRORS
 *     task.batch_size      ÷ 4, minimum 3
 *     Effect: smaller batch makes it easier to identify which specific chunks
 *             are triggering errors, while still allowing most chunks to succeed.
 *
 *   SKIP_ERRORS_REATTEMPT
 *     No config change. Failed chunks are still unprocessed and will be retried.
 *     Effect: handles transient errors (network blip, momentary DB overload).
 *
 *   NO_FIX_AVAILABLE
 *     No change. Signals that all strategies are exhausted.
 *
 * IMPORTANT: After applyFix() returns, the caller MUST re-fetch the task from
 * the registry before calling runTask(), because applyFix() mutates the STORE,
 * not the task object passed in.
 *
 *   const fix         = applyFix(currentTask, diagnosis, alreadyApplied);
 *   const retestTask  = TaskRegistry.get(task.id) ?? currentTask;
 *   const result      = await runTask(retestTask);
 */

import { TaskRegistry } from './taskRegistry';
import type { Task } from './taskRegistry';
import { patchExtractionConfig, getExtractionConfig } from './extractionConfig';
import type { ExtractionConfig } from './extractionConfig';
import type { Diagnosis, FixStrategy } from './taskDiagnoser';

// ---------------------------------------------------------------------------
// Public result type
// ---------------------------------------------------------------------------

export interface AppliedFix {
  /** The strategy that was selected and executed */
  strategy:     FixStrategy;
  /** Human-readable description of the change, including exact before → after values */
  description:  string;
  /** Task/extraction config values BEFORE the fix */
  param_before: Record<string, unknown>;
  /** Task/extraction config values AFTER the fix */
  param_after:  Record<string, unknown>;
  /**
   * True when an actual change was made.
   * False only for NO_FIX_AVAILABLE and SKIP_ERRORS_REATTEMPT (no-op).
   */
  applied: boolean;
}

// ---------------------------------------------------------------------------
// Strategy selection
// ---------------------------------------------------------------------------

function pickStrategy(
  suggested:      FixStrategy[],
  alreadyApplied: FixStrategy[],
): FixStrategy {
  const applied = new Set(alreadyApplied);
  return suggested.find((s) => !applied.has(s)) ?? 'NO_FIX_AVAILABLE';
}

// ---------------------------------------------------------------------------
// Fix implementations
// ---------------------------------------------------------------------------

/**
 * STRENGTHEN_EXTRACTION
 *
 * Problem:  Not enough rules extracted per chunk; category extractor too narrow.
 * Solution: Lower sentence length floor so shorter technical clauses are processed.
 *           Enable a supplemental pass: for any chunk yielding < 3 rules from
 *           the primary extractor, also run the generic DTU extractor and merge
 *           the unique results.
 *
 * Prompt analogy: "Extract ALL constraints, including short ones. Do not skip
 *                  sentences just because they are brief."
 */
function fixStrengthenExtraction(task: Task): AppliedFix {
  const before = getExtractionConfig(task.id);

  const after = patchExtractionConfig(task.id, {
    min_sentence_length:         Math.min(before.min_sentence_length, 50),
    enable_supplemental_pass:    true,
    supplemental_pass_threshold: 3,
  });

  return {
    strategy:    'STRENGTHEN_EXTRACTION',
    description:
      `min_sentence_length ${before.min_sentence_length} → ${after.min_sentence_length} chars. ` +
      `Supplemental extraction pass enabled (threshold=${after.supplemental_pass_threshold}): ` +
      'chunks yielding < 3 rules from the category extractor will also be processed by ' +
      'the generic DTU extractor, and unique results merged.',
    param_before: {
      min_sentence_length:      before.min_sentence_length,
      enable_supplemental_pass: before.enable_supplemental_pass,
    },
    param_after: {
      min_sentence_length:         after.min_sentence_length,
      enable_supplemental_pass:    after.enable_supplemental_pass,
      supplemental_pass_threshold: after.supplemental_pass_threshold,
    },
    applied: true,
  };
}

/**
 * FALLBACK_EXTRACTION
 *
 * Problem:  Zero rules extracted — category extractor patterns produced no matches.
 * Solution: Maximum-recall mode.
 *           (1) Normalize content before extraction to fix PDF accent encoding.
 *           (2) Enable category fallback: zero-yield chunks also run through
 *               the generic DTU extractor.
 *           (3) Enable supplemental pass with threshold 1 (every chunk).
 *           (4) Lower sentence floor to 30 chars.
 *
 * Prompt analogy: "Extract even implicit rules. Include any sentence that could
 *                  plausibly contain a constraint, obligation, or requirement.
 *                  Do not require explicit keywords."
 */
function fixFallbackExtraction(task: Task): AppliedFix {
  const before = getExtractionConfig(task.id);

  const after = patchExtractionConfig(task.id, {
    min_sentence_length:         30,
    normalize_content:           true,
    enable_category_fallback:    true,
    enable_supplemental_pass:    true,
    supplemental_pass_threshold: 1,
  });

  return {
    strategy:    'FALLBACK_EXTRACTION',
    description:
      `min_sentence_length → 30 (most permissive). ` +
      'Content normalization enabled: accents stripped, whitespace collapsed before extraction ' +
      '(improves regex pattern matching on PDF-derived text). ' +
      'Category fallback enabled: any chunk with 0 rules from the primary extractor ' +
      'is also processed by the generic DTU extractor. ' +
      'Supplemental pass threshold → 1 (applies to every chunk, not just sparse ones).',
    param_before: {
      min_sentence_length:      before.min_sentence_length,
      normalize_content:        before.normalize_content,
      enable_category_fallback: before.enable_category_fallback,
      enable_supplemental_pass: before.enable_supplemental_pass,
    },
    param_after: {
      min_sentence_length:         after.min_sentence_length,
      normalize_content:           after.normalize_content,
      enable_category_fallback:    after.enable_category_fallback,
      enable_supplemental_pass:    after.enable_supplemental_pass,
      supplemental_pass_threshold: after.supplemental_pass_threshold,
    },
    applied: true,
  };
}

/**
 * NORMALIZE_DEDUP
 *
 * Problem:  High cross-chunk duplication — identical or near-identical rules
 *           appear across multiple chunks from the same source document.
 * Solution: (1) Normalize content before extraction so signature generation
 *               is stable across encoding variants.
 *           (2) Enable near-duplicate removal: after signature-based dedup,
 *               apply a Jaccard word-set similarity pass at 85% threshold.
 *               Rules sharing ≥ 85% of their description words are collapsed.
 *
 * Deduplication improvement analogy: "After extracting rules, remove any rule
 *   whose meaning is already captured by another rule in the batch."
 */
function fixNormalizeDedup(task: Task): AppliedFix {
  const before = getExtractionConfig(task.id);

  const after = patchExtractionConfig(task.id, {
    normalize_content:    true,
    enable_near_dedup:    true,
    near_dedup_threshold: 0.85,
  });

  return {
    strategy:    'NORMALIZE_DEDUP',
    description:
      'Content normalization enabled: stabilizes signature generation across PDF encoding ' +
      'variants. Near-duplicate removal enabled with Jaccard threshold=0.85: rule pairs ' +
      'sharing ≥ 85% of description words are collapsed to a single entry.',
    param_before: {
      normalize_content:    before.normalize_content,
      enable_near_dedup:    before.enable_near_dedup,
      near_dedup_threshold: before.near_dedup_threshold,
    },
    param_after: {
      normalize_content:    after.normalize_content,
      enable_near_dedup:    after.enable_near_dedup,
      near_dedup_threshold: after.near_dedup_threshold,
    },
    applied: true,
  };
}

/**
 * AGGRESSIVE_DEDUP
 *
 * Problem:  Duplication persists after NORMALIZE_DEDUP — paraphrased rules
 *           with different wording but same meaning are still present.
 * Solution: Lower the Jaccard threshold to 0.70 so that rules sharing ≥ 70%
 *           of description words are also collapsed.
 *
 * Trade-off: At 0.70, some legitimately distinct rules with shared vocabulary
 *            (e.g. two constraints about "épaisseur") may be collapsed. This is
 *            acceptable when the alternative is a task that never passes dedup.
 */
function fixAggressiveDedup(task: Task): AppliedFix {
  const before = getExtractionConfig(task.id);

  const after = patchExtractionConfig(task.id, {
    normalize_content:    true,
    enable_near_dedup:    true,
    near_dedup_threshold: 0.70,
  });

  return {
    strategy:    'AGGRESSIVE_DEDUP',
    description:
      `Near-dedup threshold ${before.near_dedup_threshold} → 0.70 (more aggressive). ` +
      'Rules sharing ≥ 70% of description words are collapsed. ' +
      'Content normalization remains active.',
    param_before: {
      near_dedup_threshold: before.near_dedup_threshold,
      enable_near_dedup:    before.enable_near_dedup,
    },
    param_after: {
      near_dedup_threshold: after.near_dedup_threshold,
      enable_near_dedup:    after.enable_near_dedup,
    },
    applied: true,
  };
}

/**
 * INCREASE_BATCH_SIZE
 *
 * Problem:  Rule count is low but per-chunk yield is normal — just not enough
 *           chunks were processed.
 * Solution: Double batch_size (cap 100) to process more chunks per run.
 *           More input data → more extracted rules.
 */
function fixIncreaseBatchSize(task: Task): AppliedFix {
  const before = task.batch_size;
  const after  = Math.min(100, before * 2);
  TaskRegistry.update(task.id, { batch_size: after });

  return {
    strategy:    'INCREASE_BATCH_SIZE',
    description: `batch_size ${before} → ${after} (×2, cap=100). More chunks processed per run.`,
    param_before: { batch_size: before },
    param_after:  { batch_size: after },
    applied:      true,
  };
}

/**
 * ISOLATE_ERRORS
 *
 * Problem:  Extraction errors are occurring on specific chunks that block
 *           the rest of the batch.
 * Solution: Reduce batch_size to 25% of current (min 3). Processing fewer
 *           chunks per run means the good chunks succeed; the bad chunks are
 *           identified and can be investigated manually.
 *           Failed chunks are never marked as processed, so they will appear
 *           again in subsequent runs and can be diagnosed separately.
 *
 * Retry logic improvement analogy: "Process a smaller subset first to ensure
 *   the majority of data is handled correctly, then retry failed items."
 */
function fixIsolateErrors(task: Task): AppliedFix {
  const before = task.batch_size;
  const after  = Math.max(3, Math.floor(before / 4));
  TaskRegistry.update(task.id, { batch_size: after });

  return {
    strategy:    'ISOLATE_ERRORS',
    description:
      `batch_size ${before} → ${after} (÷4, min=3). ` +
      'Smaller batch isolates failing chunks so the majority complete successfully. ' +
      'Failed chunks remain unprocessed and will be retried in subsequent runs.',
    param_before: { batch_size: before },
    param_after:  { batch_size: after },
    applied:      true,
  };
}

/**
 * SKIP_ERRORS_REATTEMPT
 *
 * Problem:  Extraction errors occurred but they may be transient.
 * Solution: No config change. Failed chunks are still unprocessed (the runner
 *           never marks them as processed on error), so they will be retried
 *           automatically on the next runTask call.
 *
 * Retry logic improvement analogy: "Re-submit failed items without modification;
 *   transient errors often resolve on resubmission."
 */
function fixSkipErrorsReattempt(_task: Task): AppliedFix {
  return {
    strategy:    'SKIP_ERRORS_REATTEMPT',
    description:
      'No config change. Failed chunks were not marked as processed by the runner ' +
      'and will be retried on the next run. Handles transient errors (network, DB overload).',
    param_before: {},
    param_after:  {},
    applied:      true,  // "applied" = a retry will happen; no config mutation needed
  };
}

function fixNoFixAvailable(_task: Task): AppliedFix {
  return {
    strategy:    'NO_FIX_AVAILABLE',
    description: 'No further extraction improvements available. Task defers to standard retry.',
    param_before: {},
    param_after:  {},
    applied:      false,
  };
}

// ---------------------------------------------------------------------------
// Domain-targeted fix implementations
// ---------------------------------------------------------------------------

/**
 * EMPHASIZE_TOLERANCES
 *
 * Problem:  No constraint_with_tolerance rules found — tolerance specifications
 *           (±, déviation admissible) were missed by the primary extractor.
 *
 * Root cause: Tolerance statements are often short (< 100 chars: "±5 mm").
 *             The default min_sentence_length of 100 chars filters them out.
 *             They also appear in annexes and tables which the primary extractor
 *             passes over; a supplemental pass on every chunk recovers them.
 *
 * Fix:
 *   1. Lower min_sentence_length to 30 (catch short tolerance clauses).
 *   2. Enable full supplemental pass (every chunk, threshold=9999).
 *   3. Set domain_extraction_focus = 'tolerance' for audit logging.
 *
 * Analogy: "Look specifically for ± values and tolerance tables. Include even
 *           very short sentences that contain a numeric deviation."
 */
function fixEmphasizeTolerances(task: Task): AppliedFix {
  const before = getExtractionConfig(task.id);

  const after = patchExtractionConfig(task.id, {
    min_sentence_length:         Math.min(before.min_sentence_length, 30),
    enable_supplemental_pass:    true,
    supplemental_pass_threshold: 9999,
    domain_extraction_focus:     'tolerance',
  });

  return {
    strategy:    'EMPHASIZE_TOLERANCES',
    description:
      `min_sentence_length ${before.min_sentence_length} → ${after.min_sentence_length} chars ` +
      '(tolerance specs are often short: "±5 mm"). ' +
      'Full supplemental pass enabled on every chunk (threshold=9999) to surface ' +
      'tolerance rules in annexes and tables that the primary extractor skips. ' +
      'domain_extraction_focus=tolerance logged for traceability.',
    param_before: {
      min_sentence_length:      before.min_sentence_length,
      enable_supplemental_pass: before.enable_supplemental_pass,
      domain_extraction_focus:  before.domain_extraction_focus,
    },
    param_after: {
      min_sentence_length:         after.min_sentence_length,
      enable_supplemental_pass:    after.enable_supplemental_pass,
      supplemental_pass_threshold: after.supplemental_pass_threshold,
      domain_extraction_focus:     after.domain_extraction_focus,
    },
    applied: true,
  };
}

/**
 * EMPHASIZE_EXECUTION_CONDITIONS
 *
 * Problem:  No 'requirement' rules found — execution conditions (temperature
 *           requirements, surface preparation, sequencing constraints) were
 *           not extracted.
 *
 * Root cause: Execution conditions are qualitative ("doit", "ne pas") and
 *             appear in long paragraphs. The DTU pipeline's qualitative extractor
 *             may miss them if the regex patterns don't match the document's
 *             phrasing. A supplemental generic pass over every chunk increases
 *             recall for these patterns.
 *
 * Fix:
 *   1. Enable full supplemental pass (every chunk, threshold=9999).
 *   2. Enable content normalization (removes encoding artefacts that break
 *      regex on French obligation phrases like "doit être").
 *   3. Set domain_extraction_focus = 'execution'.
 */
function fixEmphasizeExecutionConditions(task: Task): AppliedFix {
  const before = getExtractionConfig(task.id);

  const after = patchExtractionConfig(task.id, {
    enable_supplemental_pass:    true,
    supplemental_pass_threshold: 9999,
    normalize_content:           true,
    domain_extraction_focus:     'execution',
  });

  return {
    strategy:    'EMPHASIZE_EXECUTION_CONDITIONS',
    description:
      'Full supplemental pass enabled on every chunk (threshold=9999) to surface ' +
      'execution condition rules ("doit être", "ne pas utiliser", "avant application") ' +
      'that the primary extractor may miss in dense paragraphs. ' +
      'Content normalization enabled: fixes PDF accent encoding that breaks ' +
      'French obligation phrase matching. domain_extraction_focus=execution.',
    param_before: {
      enable_supplemental_pass: before.enable_supplemental_pass,
      normalize_content:        before.normalize_content,
      domain_extraction_focus:  before.domain_extraction_focus,
    },
    param_after: {
      enable_supplemental_pass:    after.enable_supplemental_pass,
      supplemental_pass_threshold: after.supplemental_pass_threshold,
      normalize_content:           after.normalize_content,
      domain_extraction_focus:     after.domain_extraction_focus,
    },
    applied: true,
  };
}

/**
 * FORCE_LEGAL_EXTRACTION
 *
 * Problem:  No requirement_with_article rules found — legal article references
 *           (Article R.111-2, Décret n°2016-...) were not captured.
 *
 * Root cause: Legal article references appear in short header sentences or
 *             inline citations that are typically < 50 chars and get skipped
 *             by the min_sentence_length filter.
 *             The CODE_CONSTRUCTION extractor requires either the
 *             LEGAL_OBLIGATION_RE or LEGAL_ARTICLE_RE to match. Article
 *             references alone (without an obligation trigger) must also fire —
 *             the supplemental pass catches these via the generic extractor.
 *
 * Fix:
 *   1. Lower min_sentence_length to 30 (catch short article citations).
 *   2. Enable full supplemental pass (every chunk, threshold=9999).
 *   3. Enable content normalization (article refs often have encoding issues).
 *   4. Set domain_extraction_focus = 'legal_reference'.
 */
function fixForceLegalExtraction(task: Task): AppliedFix {
  const before = getExtractionConfig(task.id);

  const after = patchExtractionConfig(task.id, {
    min_sentence_length:         Math.min(before.min_sentence_length, 30),
    enable_supplemental_pass:    true,
    supplemental_pass_threshold: 9999,
    normalize_content:           true,
    domain_extraction_focus:     'legal_reference',
  });

  return {
    strategy:    'FORCE_LEGAL_EXTRACTION',
    description:
      `min_sentence_length ${before.min_sentence_length} → ${after.min_sentence_length} chars ` +
      '(legal article citations are short: "Art. R.111-2 du CCH"). ' +
      'Full supplemental pass enabled on every chunk (threshold=9999) to catch ' +
      'article references that appear without an obligation trigger. ' +
      'Content normalization enabled: fixes accent encoding in legal French. ' +
      'domain_extraction_focus=legal_reference.',
    param_before: {
      min_sentence_length:      before.min_sentence_length,
      enable_supplemental_pass: before.enable_supplemental_pass,
      normalize_content:        before.normalize_content,
      domain_extraction_focus:  before.domain_extraction_focus,
    },
    param_after: {
      min_sentence_length:         after.min_sentence_length,
      enable_supplemental_pass:    after.enable_supplemental_pass,
      supplemental_pass_threshold: after.supplemental_pass_threshold,
      normalize_content:           after.normalize_content,
      domain_extraction_focus:     after.domain_extraction_focus,
    },
    applied: true,
  };
}

/**
 * EMPHASIZE_COEFFICIENTS
 *
 * Problem:  No formula_with_coefficient rules — Eurocode coefficient
 *           assignments (γ_M0 = 1.00, f_yk = 500 N/mm²) were not captured.
 *
 * Root cause: Coefficient tables in Eurocodes are formatted as two-column
 *             tables (symbol | value). PDF extraction often merges table rows
 *             into single long strings or splits them across lines. The
 *             EC_ASSIGNMENT_RE pattern may not match these artefacts.
 *             Normalization helps by collapsing multi-whitespace; the
 *             supplemental pass provides an additional extraction attempt.
 *             Crucially, normalization must preserve Greek letters — the
 *             normalizeChunkContent function in taskRunner.ts only strips
 *             French combining marks, NOT mathematical symbols.
 *
 * Fix:
 *   1. Enable full supplemental pass (every chunk, threshold=9999).
 *   2. Enable content normalization (collapses whitespace artefacts from
 *      PDF table extraction without affecting Greek symbols).
 *   3. Set domain_extraction_focus = 'coefficient'.
 */
function fixEmphasizeCoefficients(task: Task): AppliedFix {
  const before = getExtractionConfig(task.id);

  const after = patchExtractionConfig(task.id, {
    enable_supplemental_pass:    true,
    supplemental_pass_threshold: 9999,
    normalize_content:           true,
    domain_extraction_focus:     'coefficient',
  });

  return {
    strategy:    'EMPHASIZE_COEFFICIENTS',
    description:
      'Full supplemental pass enabled on every chunk (threshold=9999) to recover ' +
      'Eurocode coefficient assignments (γ_M0, f_yk, λ) from table-derived chunks. ' +
      'Content normalization enabled: collapses PDF table whitespace artefacts that ' +
      'break the assignment pattern matcher. Greek/math symbols are preserved ' +
      '(only French combining accents are stripped by the normalizer). ' +
      'domain_extraction_focus=coefficient.',
    param_before: {
      enable_supplemental_pass: before.enable_supplemental_pass,
      normalize_content:        before.normalize_content,
      domain_extraction_focus:  before.domain_extraction_focus,
    },
    param_after: {
      enable_supplemental_pass:    after.enable_supplemental_pass,
      supplemental_pass_threshold: after.supplemental_pass_threshold,
      normalize_content:           after.normalize_content,
      domain_extraction_focus:     after.domain_extraction_focus,
    },
    applied: true,
  };
}

/**
 * EMPHASIZE_LIMIT_STATES
 *
 * Problem:  No formula_with_limit_state rules — ELU/ELS limit state references
 *           were not captured in extracted Eurocode rules.
 *
 * Root cause: ELU/ELS mentions appear in introductory paragraphs before
 *             verification formulas. If those paragraphs are short (introductory
 *             sentences) or the ELU keyword is on a separate line from the
 *             formula, the extractor may miss the pairing.
 *             Lowering min_sentence_length catches short introductory lines.
 *             The supplemental pass recovers ELU/ELS references in chunks where
 *             the primary formula extractor found no coefficient assignments.
 *
 * Fix:
 *   1. Lower min_sentence_length to 50.
 *   2. Enable full supplemental pass (every chunk, threshold=9999).
 *   3. Set domain_extraction_focus = 'limit_state'.
 */
function fixEmphasizeLimitStates(task: Task): AppliedFix {
  const before = getExtractionConfig(task.id);

  const after = patchExtractionConfig(task.id, {
    min_sentence_length:         Math.min(before.min_sentence_length, 50),
    enable_supplemental_pass:    true,
    supplemental_pass_threshold: 9999,
    domain_extraction_focus:     'limit_state',
  });

  return {
    strategy:    'EMPHASIZE_LIMIT_STATES',
    description:
      `min_sentence_length ${before.min_sentence_length} → ${after.min_sentence_length} chars ` +
      '(ELU/ELS mentions appear in short introductory lines before formulas). ' +
      'Full supplemental pass enabled on every chunk (threshold=9999) to capture ' +
      'limit state references (ELU, ELS, ULS, SLS) that appear on lines separate ' +
      'from the verification formula. domain_extraction_focus=limit_state.',
    param_before: {
      min_sentence_length:      before.min_sentence_length,
      enable_supplemental_pass: before.enable_supplemental_pass,
      domain_extraction_focus:  before.domain_extraction_focus,
    },
    param_after: {
      min_sentence_length:         after.min_sentence_length,
      enable_supplemental_pass:    after.enable_supplemental_pass,
      supplemental_pass_threshold: after.supplemental_pass_threshold,
      domain_extraction_focus:     after.domain_extraction_focus,
    },
    applied: true,
  };
}

/**
 * DOMAIN_FULL_SUPPLEMENTAL
 *
 * Problem:  Domain coverage is below threshold but no specific type is
 *           identified as the primary gap (or the specific targeted fix has
 *           already been applied in a prior cycle).
 *
 * Solution: Generic domain coverage fix.
 *   1. Enable full supplemental pass (every chunk, threshold=9999).
 *   2. Increase batch size × 1.5 (capped at 100) for more source material.
 *   3. Set domain_extraction_focus = 'domain_coverage'.
 *
 * This is the second-in-line fallback for all domain diagnosis codes when the
 * targeted fix was already applied in a prior cycle.
 */
function fixDomainFullSupplemental(task: Task): AppliedFix {
  const before       = getExtractionConfig(task.id);
  const batchBefore  = task.batch_size;
  const batchAfter   = Math.min(100, Math.ceil(batchBefore * 1.5));
  TaskRegistry.update(task.id, { batch_size: batchAfter });

  const after = patchExtractionConfig(task.id, {
    enable_supplemental_pass:    true,
    supplemental_pass_threshold: 9999,
    domain_extraction_focus:     'domain_coverage',
  });

  return {
    strategy:    'DOMAIN_FULL_SUPPLEMENTAL',
    description:
      'Full supplemental pass enabled on every chunk (threshold=9999). ' +
      `batch_size ${batchBefore} → ${batchAfter} (×1.5, cap=100) for more source material. ` +
      'domain_extraction_focus=domain_coverage. ' +
      'Use when targeted domain fix was already applied or when no specific type is identified.',
    param_before: {
      enable_supplemental_pass: before.enable_supplemental_pass,
      domain_extraction_focus:  before.domain_extraction_focus,
      batch_size:               batchBefore,
    },
    param_after: {
      enable_supplemental_pass:    after.enable_supplemental_pass,
      supplemental_pass_threshold: after.supplemental_pass_threshold,
      domain_extraction_focus:     after.domain_extraction_focus,
      batch_size:                  batchAfter,
    },
    applied: true,
  };
}

// ---------------------------------------------------------------------------
// Dispatch table — maps every FixStrategy to its implementation
// ---------------------------------------------------------------------------

const DISPATCH: Readonly<Record<FixStrategy, (task: Task) => AppliedFix>> = {
  STRENGTHEN_EXTRACTION:          fixStrengthenExtraction,
  FALLBACK_EXTRACTION:            fixFallbackExtraction,
  NORMALIZE_DEDUP:                fixNormalizeDedup,
  AGGRESSIVE_DEDUP:               fixAggressiveDedup,
  INCREASE_BATCH_SIZE:            fixIncreaseBatchSize,
  ISOLATE_ERRORS:                 fixIsolateErrors,
  SKIP_ERRORS_REATTEMPT:          fixSkipErrorsReattempt,
  // Domain-targeted strategies
  EMPHASIZE_TOLERANCES:           fixEmphasizeTolerances,
  EMPHASIZE_EXECUTION_CONDITIONS: fixEmphasizeExecutionConditions,
  FORCE_LEGAL_EXTRACTION:         fixForceLegalExtraction,
  EMPHASIZE_COEFFICIENTS:         fixEmphasizeCoefficients,
  EMPHASIZE_LIMIT_STATES:         fixEmphasizeLimitStates,
  DOMAIN_FULL_SUPPLEMENTAL:       fixDomainFullSupplemental,
  NO_FIX_AVAILABLE:               fixNoFixAvailable,
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Select and execute the next unapplied fix strategy from the diagnosis.
 *
 * Strategy selection: first entry in diagnosis.suggested_fixes that is NOT
 * present in alreadyApplied. Falls back to NO_FIX_AVAILABLE when exhausted.
 *
 * @param task           - Current task state (registry is mutated, this object is not)
 * @param diagnosis      - Produced by diagnoseFailure()
 * @param alreadyApplied - Strategies tried in earlier fix cycles for this task
 * @returns AppliedFix describing the strategy chosen and the exact delta applied
 */
export function applyFix(
  task:           Task,
  diagnosis:      Diagnosis,
  alreadyApplied: FixStrategy[],
): AppliedFix {
  const strategy = pickStrategy(diagnosis.suggested_fixes, alreadyApplied);
  return DISPATCH[strategy](task);
}

// Re-export for consumers that need the type without importing taskDiagnoser
export type { ExtractionConfig };
