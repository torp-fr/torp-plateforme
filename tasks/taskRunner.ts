/**
 * Task Runner
 *
 * Executes a single extraction task for one document category.
 *
 * Pipeline per task:
 *   1. Read ExtractionConfig for this task (set by the fixer on prior fix cycles)
 *   2. Fetch unprocessed chunks for the category (JOIN knowledge_documents)
 *   3. For each chunk:
 *      a. Skip if below config.min_sentence_length
 *      b. Optionally normalize content (accent strip + whitespace collapse)
 *      c. Run category-specific extractor → primary rules
 *      d. Run supplemental pass (generic DTU extractor) when:
 *           - enable_category_fallback AND primary = 0 rules, OR
 *           - enable_supplemental_pass AND primary < supplemental_pass_threshold
 *      e. Enrich rules with enforcement metadata
 *      f. Upsert rules to DB (ON CONFLICT signature DO NOTHING)
 *      g. Mark chunk as rule_processed = true
 *   4. Apply cross-chunk signature deduplication
 *   5. Optionally apply near-duplicate removal (Jaccard word-set similarity)
 *   6. Return TaskRunResult with full metrics
 *
 * Per-chunk errors are isolated: a failing chunk does not abort the task.
 * The result.errors array records every failure for the validator to inspect.
 */

import 'dotenv/config';
import { supabase } from '@/lib/supabase';
import {
  extractRulesByCategory,
  normalizeCategory,
  extractGenericRules,
} from '@/services/categoryExtraction.service';
import { enrichRules, type EnrichedRule } from '@/services/ruleEnrichment.service';
import {
  deduplicateRules,
  type ChunkInput,
  type ExtractedRule,
} from '@/services/ruleExtraction.service';
import { sanitizeUnit } from '@/core/utils/unitNormalizer';
import { getExtractionConfig } from './extractionConfig';
import type { ExtractionConfig } from './extractionConfig';
import type { Task, TaskCategory } from './taskRegistry';
import {
  computeSubTypeDistribution,
  computeDomainCoverage,
  formatDomainCoverage,
  type DomainCoverageResult,
} from './ruleExpectations';

// ---------------------------------------------------------------------------
// Public result type (consumed by taskValidator and taskLoop)
// ---------------------------------------------------------------------------

export interface TaskRunResult {
  /** Task that produced this result */
  task_id: string;
  /** Category processed */
  category: string;
  /** Total unprocessed chunks found in DB for the category */
  chunks_fetched: number;
  /** Chunks that completed extraction successfully */
  chunks_processed: number;
  /** Chunks skipped (below min_sentence_length) */
  chunks_skipped: number;
  /** Total rules extracted across all chunks (before cross-chunk dedup) */
  rules_extracted: number;
  /** Rules remaining after cross-chunk signature deduplication */
  rules_after_dedup: number;
  /** Rules actually written to the rules table */
  rules_inserted: number;
  /** (extracted − after_dedup) / extracted; 0 when extracted === 0 */
  duplication_rate: number;
  /** Per-chunk error messages; empty when everything succeeded */
  errors: string[];
  /** Wall-clock execution time in milliseconds */
  duration_ms: number;
  /** True when no per-chunk errors occurred */
  success: boolean;
  /**
   * Count of each rule_type (and derived sub-types) in the post-dedup rule set.
   * Keys: 'constraint', 'formula', 'recommendation', 'requirement',
   *       'constraint_with_tolerance', 'formula_with_coefficient',
   *       'formula_with_limit_state', 'requirement_with_article'.
   */
  rule_type_distribution: Record<string, number>;
  /**
   * Domain completeness analysis for the category.
   * Populated after deduplication using computeDomainCoverage().
   * Used by the validator's domain checks and the diagnoser.
   */
  domain_coverage: DomainCoverageResult;
}

// ---------------------------------------------------------------------------
// Internal DB row type (mirrors the rules table schema)
// ---------------------------------------------------------------------------

interface RuleInsertRow {
  document_id:       string;
  chunk_id:          string;
  category:          string;
  domain:            string;
  rule_type:         string;
  description:       string;
  structured_data:   Record<string, unknown>;
  confidence_score:  number;
  source:            string;
  signature:         string;
  enforcement_level: string;
  flexibility_score: number;
  contextual:        boolean;
  applicability:     Record<string, unknown>;
  // Contextual interpretation fields (migration 20260320000002)
  strictness:             string;
  tolerance:              Record<string, unknown> | null;
  adaptable:              boolean;
  risk_level:             string;
  justification_required: boolean;
}

// ---------------------------------------------------------------------------
// Content normalization
// ---------------------------------------------------------------------------

/**
 * Normalize chunk content for improved pattern matching.
 *
 * Strips French combining diacritical marks (é → e, à → a, ê → e…) using
 * NFD decomposition + removal of combining characters (U+0300–U+036F).
 * Greek/mathematical symbols (γ, λ, ≤, ≥) are in different Unicode ranges
 * and are NOT affected — safe for EUROCODE documents.
 *
 * Also collapses multi-whitespace, which is common in PDF-extracted text.
 */
function normalizeChunkContent(content: string): string {
  return content
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')  // strip combining diacritical marks
    .replace(/\s+/g, ' ')             // collapse multi-whitespace
    .trim();
}

// ---------------------------------------------------------------------------
// Near-duplicate removal
// ---------------------------------------------------------------------------

/**
 * Compute Jaccard similarity between two strings based on word sets.
 *
 * Both strings are lowercased, accent-stripped, and punctuation-removed
 * before comparison so that "L'épaisseur" and "l epaisseur" produce the
 * same word set and are correctly identified as near-duplicates.
 */
function wordSetSimilarity(a: string, b: string): number {
  const tokenize = (s: string): Set<string> =>
    new Set(
      s.toLowerCase()
       .normalize('NFD')
       .replace(/[\u0300-\u036f]/g, '')
       .replace(/[^\w\s]/g, ' ')
       .split(/\s+/)
       .filter(Boolean),
    );

  const setA = tokenize(a);
  const setB = tokenize(b);

  let intersection = 0;
  for (const w of setA) {
    if (setB.has(w)) intersection++;
  }

  const union = setA.size + setB.size - intersection;
  return union === 0 ? 1.0 : intersection / union;
}

/**
 * Remove near-duplicate rules using Jaccard word-set similarity on descriptions.
 *
 * Rules are compared pairwise. When two rules have similarity >= threshold,
 * the second occurrence is dropped (first-seen wins).
 *
 * Time complexity: O(n²) on rule descriptions. Acceptable for batches ≤ 500 rules.
 *
 * @returns The deduplicated rule array and the number of near-duplicates removed.
 */
function nearDeduplicateRules(
  rules:     ExtractedRule[],
  threshold: number,
): { rules: ExtractedRule[]; removed: number } {
  const kept: ExtractedRule[] = [];

  for (const candidate of rules) {
    const isNearDup = kept.some(
      (existing) => wordSetSimilarity(existing.description, candidate.description) >= threshold,
    );
    if (!isNearDup) kept.push(candidate);
  }

  return { rules: kept, removed: rules.length - kept.length };
}

// ---------------------------------------------------------------------------
// Step 2 — Fetch chunks for category (with JOIN to knowledge_documents)
// ---------------------------------------------------------------------------

async function fetchChunksForCategory(
  category: string,
  limit:    number,
): Promise<ChunkInput[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('knowledge_chunks')
    .select('id, content, document_id, knowledge_documents!inner(category)')
    .eq('rule_processed', false)
    .eq('knowledge_documents.category', category)
    .not('content', 'is', null)
    .order('created_at', { ascending: true })
    .limit(limit);

  if (error) {
    throw new Error(`[TaskRunner] fetchChunksForCategory("${category}") failed: ${error.message}`);
  }

  if (!data || data.length === 0) return [];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data as any[]).flatMap((row): ChunkInput[] => {
    const docCategory = row.knowledge_documents?.category as string | undefined;
    if (!docCategory) {
      console.warn(`[TaskRunner] chunk ${row.id} — no parent document category, skipping`);
      return [];
    }
    let canonicalCategory: string;
    try {
      canonicalCategory = normalizeCategory(docCategory);
    } catch {
      console.warn(`[TaskRunner] chunk ${row.id} — unrecognized category "${docCategory}", skipping`);
      return [];
    }
    return [{
      id:          row.id          as string,
      content:     row.content     as string,
      document_id: row.document_id as string,
      category:    canonicalCategory,
    }];
  });
}

// ---------------------------------------------------------------------------
// Step 3c–3d — Extract rules from one chunk (with optional supplemental pass)
// ---------------------------------------------------------------------------

/**
 * Extract rules from a single chunk, applying the current ExtractionConfig.
 *
 * Stages:
 *   1. Optionally normalize content
 *   2. Run category-specific extractor (primary)
 *   3a. FALLBACK  — if primary = 0 and enable_category_fallback: run generic extractor
 *   3b. SUPPLEMENT — if primary < threshold and enable_supplemental_pass: run generic
 *       extractor and merge unique signatures
 *
 * Logs the source of each rule set so fix impact is traceable.
 */
function extractFromChunk(
  chunk:  ChunkInput,
  config: ExtractionConfig,
): ExtractedRule[] {
  // ── 1. Content normalization ───────────────────────────────────────────────
  const effectiveChunk: ChunkInput = config.normalize_content
    ? { ...chunk, content: normalizeChunkContent(chunk.content) }
    : chunk;

  // ── 2. Primary extraction ──────────────────────────────────────────────────
  const primary: ExtractedRule[] = extractRulesByCategory(effectiveChunk, effectiveChunk.category);

  console.log(
    `[TaskRunner] chunk=${chunk.id} primary_extractor=${effectiveChunk.category}` +
    ` rules=${primary.length}` +
    (config.normalize_content ? ' (content normalized)' : ''),
  );

  // ── 3a. Category fallback (zero-yield) ────────────────────────────────────
  if (config.enable_category_fallback && primary.length === 0) {
    const fallback: ExtractedRule[] = extractGenericRules(effectiveChunk);
    if (fallback.length > 0) {
      console.log(
        `[TaskRunner] chunk=${chunk.id} fallback_extractor=GENERIC rules=${fallback.length}` +
        ` (triggered: primary=0, enable_category_fallback=true)`,
      );
    }
    return fallback;
  }

  // ── 3b. Supplemental pass (low-yield) ─────────────────────────────────────
  if (
    config.enable_supplemental_pass &&
    primary.length < config.supplemental_pass_threshold
  ) {
    const supplemental: ExtractedRule[] = extractGenericRules(effectiveChunk);
    const knownSigs = new Set(primary.map((r) => r.signature));
    const newRules  = supplemental.filter((r) => !knownSigs.has(r.signature));

    if (newRules.length > 0) {
      console.log(
        `[TaskRunner] chunk=${chunk.id} supplemental_extractor=GENERIC` +
        ` new_rules=${newRules.length} total=${primary.length + newRules.length}` +
        ` (triggered: primary=${primary.length} < threshold=${config.supplemental_pass_threshold})`,
      );
    }
    return [...primary, ...newRules];
  }

  return primary;
}

// ---------------------------------------------------------------------------
// Step 3f — Upsert extracted rules to DB
// ---------------------------------------------------------------------------

async function insertExtractedRules(
  rules:      EnrichedRule[],
  chunkId:    string,
  documentId: string,
  category:   string,
): Promise<{ inserted: number; skipped: number }> {
  if (rules.length === 0) return { inserted: 0, skipped: 0 };

  const rows: RuleInsertRow[] = rules
    .filter((rule) => {
      const key = (rule.structured_data as unknown as Record<string, unknown>)?.property_key;
      if (!key) {
        console.log(`[TaskRunner] SKIP rule — missing property_key (chunk=${chunkId})`);
        return false;
      }
      return true;
    })
    .map((rule): RuleInsertRow => {
      const sd = rule.structured_data as unknown as Record<string, unknown> | undefined;
      const structuredData: Record<string, unknown> = sd
        ? { ...sd, unit: sanitizeUnit((sd.unit as string | undefined) ?? undefined) }
        : {};

      const source = rule.source_sentence.length > 500
        ? rule.source_sentence.substring(0, 497) + '…'
        : rule.source_sentence;

      return {
        document_id:       documentId,
        chunk_id:          chunkId,
        category,
        domain:            rule.domain,
        rule_type:         rule.rule_type,
        description:       rule.description,
        structured_data:   structuredData,
        confidence_score:  rule.confidence_score,
        source,
        signature:              rule.signature,
        enforcement_level:      rule.enforcement_level,
        flexibility_score:      rule.flexibility_score,
        contextual:             rule.contextual,
        applicability:          rule.applicability as Record<string, unknown>,
        strictness:             rule.strictness,
        tolerance:              rule.tolerance as unknown as Record<string, unknown> | null,
        adaptable:              rule.adaptable,
        risk_level:             rule.risk_level,
        justification_required: rule.justification_required,
      };
    });

  if (rows.length === 0) return { inserted: 0, skipped: rules.length };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('rules')
    .upsert(rows, { onConflict: 'signature', ignoreDuplicates: true })
    .select('id');

  if (error) throw new Error(`[TaskRunner] insertExtractedRules failed: ${error.message}`);

  const inserted = (data as { id: string }[] | null)?.length ?? 0;
  return { inserted, skipped: rows.length - inserted };
}

// ---------------------------------------------------------------------------
// Step 3g — Mark chunk processed
// ---------------------------------------------------------------------------

async function markChunkProcessed(chunkId: string): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from('knowledge_chunks')
    .update({ rule_processed: true })
    .eq('id', chunkId);

  if (error) throw new Error(`[TaskRunner] markChunkProcessed(${chunkId}) failed: ${error.message}`);
}

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

/**
 * Run extraction for one task (one category, one batch of chunks).
 *
 * The runner reads the current ExtractionConfig at startup so that any fix
 * applied by the fixer in a previous cycle takes effect immediately.
 *
 * @returns TaskRunResult — all metrics required by the validator.
 */
export async function runTask(task: Task): Promise<TaskRunResult> {
  const start = Date.now();

  // ── Read extraction config (may have been patched by the fixer) ────────────
  const config: ExtractionConfig = getExtractionConfig(task.id);

  console.log(`[TaskRunner] task_id=${task.id} category=${task.category} config=${JSON.stringify(config)}`);

  // Log domain extraction focus when set by a domain-targeted fix
  if (config.domain_extraction_focus) {
    console.log(
      `[TaskRunner] task_id=${task.id} domain_extraction_focus=${config.domain_extraction_focus}` +
      ` — supplemental pass will run on every chunk (threshold overridden to 9999)`,
    );
  }

  const result: TaskRunResult = {
    task_id:                task.id,
    category:               task.category,
    chunks_fetched:         0,
    chunks_processed:       0,
    chunks_skipped:         0,
    rules_extracted:        0,
    rules_after_dedup:      0,
    rules_inserted:         0,
    duplication_rate:       0,
    errors:                 [],
    duration_ms:            0,
    success:                false,
    rule_type_distribution: {},
    // Placeholder — overwritten after dedup when actual rules are available
    domain_coverage: computeDomainCoverage({}, task.category),
  };

  // ── 2. Fetch ────────────────────────────────────────────────────────────────
  let chunks: ChunkInput[];
  try {
    chunks = await fetchChunksForCategory(task.category, task.batch_size);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[TaskRunner] task=${task.id} FETCH_ERROR ${msg}`);
    result.errors.push(`fetch: ${msg}`);
    result.duration_ms = Date.now() - start;
    return result;
  }

  result.chunks_fetched = chunks.length;

  console.log(
    `[TaskRunner] task_id=${task.id} category=${task.category}` +
    ` attempt=${task.attempt} chunks_fetched=${chunks.length} batch_size=${task.batch_size}`,
  );

  if (chunks.length === 0) {
    console.log(`[TaskRunner] task_id=${task.id} no unprocessed chunks — vacuous success`);
    result.success     = true;
    result.duration_ms = Date.now() - start;
    return result;
  }

  // ── 3. Process each chunk ──────────────────────────────────────────────────
  const allExtracted: ExtractedRule[] = [];

  for (const chunk of chunks) {

    // Skip chunks below the configured minimum length
    if (!chunk.content || chunk.content.length < config.min_sentence_length) {
      console.log(
        `[TaskRunner] chunk=${chunk.id} content_len=${chunk.content?.length ?? 0}` +
        ` < min=${config.min_sentence_length} — skipping`,
      );
      try { await markChunkProcessed(chunk.id); } catch { /* non-critical */ }
      result.chunks_skipped++;
      continue;
    }

    console.log(
      `[TaskRunner] chunk=${chunk.id} category=${chunk.category}` +
      ` content_len=${chunk.content.length}`,
    );

    try {
      // ── 3c–3d. Extract (with optional supplemental pass) ──────────────────
      // When a domain-targeted fix has set domain_extraction_focus, override the
      // supplemental threshold to 9999 so every chunk receives a supplemental pass.
      const effectiveConfig: ExtractionConfig = config.domain_extraction_focus
        ? {
            ...config,
            enable_supplemental_pass:    true,
            supplemental_pass_threshold: 9999,
          }
        : config;
      const extracted: ExtractedRule[] = extractFromChunk(chunk, effectiveConfig);
      allExtracted.push(...extracted);

      // ── 3e–3f. Enrich + Insert ────────────────────────────────────────────
      if (extracted.length > 0) {
        const enriched = enrichRules(extracted, chunk.category);
        const { inserted, skipped } = await insertExtractedRules(
          enriched,
          chunk.id,
          chunk.document_id,
          chunk.category,
        );
        result.rules_inserted += inserted;
        console.log(
          `[TaskRunner] chunk=${chunk.id} inserted=${inserted} skipped_dup=${skipped}`,
        );
      }

      // ── 3g. Mark processed ────────────────────────────────────────────────
      await markChunkProcessed(chunk.id);
      result.chunks_processed++;

    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[TaskRunner] chunk=${chunk.id} ERROR: ${msg}`);
      result.errors.push(`chunk:${chunk.id}: ${msg}`);
      // Do NOT mark as processed — this chunk will be retried on the next run
    }
  }

  // ── 4. Cross-chunk signature deduplication ─────────────────────────────────
  const dedupedBySignature  = deduplicateRules(allExtracted);

  // ── 5. Near-duplicate removal (optional) ───────────────────────────────────
  let finalRules = dedupedBySignature;

  if (config.enable_near_dedup && dedupedBySignature.length > 1) {
    const { rules: nearDeduped, removed } = nearDeduplicateRules(
      dedupedBySignature,
      config.near_dedup_threshold,
    );
    finalRules = nearDeduped;

    if (removed > 0) {
      console.log(
        `[TaskRunner] near-dedup: removed=${removed}` +
        ` threshold=${config.near_dedup_threshold}` +
        ` before=${dedupedBySignature.length} after=${nearDeduped.length}`,
      );
    }
  }

  // ── 6. Domain coverage analysis ───────────────────────────────────────────
  // Computed from finalRules (post-dedup) for accurate per-type counts.
  const subTypeDist = computeSubTypeDistribution(finalRules);
  const domainCoverage = computeDomainCoverage(subTypeDist, task.category as TaskCategory);
  result.rule_type_distribution = subTypeDist;
  result.domain_coverage        = domainCoverage;
  console.log(formatDomainCoverage(domainCoverage));

  // ── 7. Compute result metrics ──────────────────────────────────────────────
  result.rules_extracted   = allExtracted.length;
  result.rules_after_dedup = finalRules.length;
  result.duplication_rate  = allExtracted.length > 0
    ? (allExtracted.length - finalRules.length) / allExtracted.length
    : 0;

  result.success     = result.errors.length === 0;
  result.duration_ms = Date.now() - start;

  console.log(
    `[TaskRunner] task_id=${task.id} COMPLETE` +
    ` chunks=${result.chunks_processed}/${result.chunks_fetched}` +
    ` rules_extracted=${result.rules_extracted}` +
    ` rules_after_dedup=${result.rules_after_dedup}` +
    ` rules_inserted=${result.rules_inserted}` +
    ` dup_rate=${(result.duplication_rate * 100).toFixed(1)}%` +
    ` errors=${result.errors.length}` +
    ` duration_ms=${result.duration_ms}`,
  );

  return result;
}
