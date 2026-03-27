/**
 * Extraction Configuration Store
 *
 * Holds per-task extraction parameters that the fixer modifies to improve
 * extraction quality. This is the ONLY surface the fixer writes to when
 * it needs to influence how rules are extracted — validation thresholds
 * are never touched.
 *
 * The task runner reads these parameters before each run and applies them
 * to content filtering, extractor selection, supplemental passes, and
 * near-duplicate removal.
 *
 * Lifecycle:
 *   boot           → config not in store → getExtractionConfig returns DEFAULT
 *   fix applied    → patchExtractionConfig writes updated values to store
 *   next runTask   → runner reads updated config, behaves differently
 *   task complete  → config remains in store for the duration of the session
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ExtractionConfig {
  /**
   * Minimum character length for chunk content to be sent to the extractor.
   * Chunks shorter than this are skipped as too sparse.
   *
   * Default : 100
   * STRENGTHEN_EXTRACTION sets to 50   (catch shorter technical specs)
   * FALLBACK_EXTRACTION   sets to 30   (most permissive; catches brief clauses)
   */
  min_sentence_length: number;

  /**
   * When true: if the category-specific extractor returns 0 rules for a chunk,
   * the generic DTU extractor is run as a fallback and its results are merged.
   * "Extract even implicit rules" mode.
   *
   * Default : false
   * FALLBACK_EXTRACTION sets to true
   */
  enable_category_fallback: boolean;

  /**
   * When true: if the category-specific extractor returns fewer rules than
   * `supplemental_pass_threshold`, the generic DTU extractor is also run and
   * its unique results (by signature) are merged with the primary results.
   * Analogous to the LLM worker's second-pass supplemental prompt.
   *
   * Default : false
   * STRENGTHEN_EXTRACTION and FALLBACK_EXTRACTION both set to true
   */
  enable_supplemental_pass: boolean;

  /**
   * Minimum rules from the primary extractor before a supplemental pass
   * is triggered. Only evaluated when enable_supplemental_pass is true.
   *
   * Default : 3
   * FALLBACK_EXTRACTION sets to 1 (trigger on every chunk)
   */
  supplemental_pass_threshold: number;

  /**
   * When true: normalize chunk content before extraction.
   * Normalization: strip French combining accents, collapse whitespace.
   * Greek/mathematical symbols are preserved (safe for EUROCODE extractor).
   *
   * Motivation: PDFs often encode accented characters as base + combining
   * diacritic. Normalizing improves regex pattern matching on these files.
   *
   * Default : false
   * FALLBACK_EXTRACTION and NORMALIZE_DEDUP both set to true
   */
  normalize_content: boolean;

  /**
   * When true: after cross-chunk signature deduplication, apply a second pass
   * that removes near-duplicate rules using Jaccard word-set similarity on
   * rule descriptions. Rules where similarity >= near_dedup_threshold are
   * collapsed (first occurrence is kept).
   *
   * This removes paraphrased versions of the same constraint that produce
   * different signatures but convey identical information.
   *
   * Default : false
   * NORMALIZE_DEDUP  sets to true with threshold 0.85
   * AGGRESSIVE_DEDUP sets to true with threshold 0.70
   */
  enable_near_dedup: boolean;

  /**
   * Jaccard similarity threshold for near-duplicate collapse. Range: 0.0–1.0.
   * Higher value = more conservative (only very similar rules removed).
   * Lower value  = more aggressive (more rules removed).
   *
   * Default : 0.85
   * NORMALIZE_DEDUP  uses 0.85
   * AGGRESSIVE_DEDUP uses 0.70
   */
  near_dedup_threshold: number;

  /**
   * Domain-targeted extraction focus.
   *
   * When non-null, the runner logs this value and enables maximum supplemental
   * coverage (supplemental_pass_threshold raised to 9999) so every chunk is
   * processed by both the category extractor and the generic extractor.
   *
   * This is the mechanism through which domain-specific fixes communicate their
   * intent to the runner — the actual extraction still uses the same regex
   * patterns, but the supplemental pass significantly increases recall for the
   * targeted sub-types.
   *
   * Set by domain-targeted fix strategies:
   *   EMPHASIZE_TOLERANCES            → 'tolerance'
   *   EMPHASIZE_EXECUTION_CONDITIONS  → 'execution'
   *   FORCE_LEGAL_EXTRACTION          → 'legal_reference'
   *   EMPHASIZE_COEFFICIENTS          → 'coefficient'
   *   EMPHASIZE_LIMIT_STATES          → 'limit_state'
   *   DOMAIN_FULL_SUPPLEMENTAL        → 'domain_coverage'
   *
   * Default : null
   */
  domain_extraction_focus: string | null;
}

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

export const DEFAULT_EXTRACTION_CONFIG: Readonly<ExtractionConfig> = {
  min_sentence_length:          100,
  enable_category_fallback:     false,
  enable_supplemental_pass:     false,
  supplemental_pass_threshold:  3,
  normalize_content:            false,
  enable_near_dedup:            false,
  near_dedup_threshold:         0.85,
  domain_extraction_focus:      null,
} as const;

// ---------------------------------------------------------------------------
// In-memory store
// ---------------------------------------------------------------------------

const store = new Map<string, ExtractionConfig>();

// ---------------------------------------------------------------------------
// API
// ---------------------------------------------------------------------------

/**
 * Read the extraction config for a task.
 * Returns a fresh copy of the defaults if no config has been set yet.
 */
export function getExtractionConfig(taskId: string): ExtractionConfig {
  return store.get(taskId) ?? { ...DEFAULT_EXTRACTION_CONFIG };
}

/**
 * Apply a partial update to a task's extraction config.
 * Starts from the current config (or defaults) and merges the patch.
 * Returns the full updated config so the fixer can log before/after.
 */
export function patchExtractionConfig(
  taskId: string,
  patch:  Partial<ExtractionConfig>,
): ExtractionConfig {
  const current: ExtractionConfig = store.get(taskId) ?? { ...DEFAULT_EXTRACTION_CONFIG };
  const updated: ExtractionConfig = { ...current, ...patch };
  store.set(taskId, updated);
  return updated;
}

/**
 * Remove the extraction config for a task.
 * The next call to getExtractionConfig will return the defaults.
 */
export function resetExtractionConfig(taskId: string): void {
  store.delete(taskId);
}
