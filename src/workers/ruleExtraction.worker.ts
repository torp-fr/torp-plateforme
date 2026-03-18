/**
 * Rule Extraction Worker
 *
 * Batch worker that processes DTU knowledge chunks and writes extracted rules
 * to the `rules` table. Designed to be run as a one-shot job or on a schedule.
 *
 * Usage:
 *   import { runRuleExtraction } from '@/workers/ruleExtraction.worker';
 *   await runRuleExtraction();
 *
 * Test mode (no DB writes, full rule logging):
 *   import { runRuleExtractionTest } from '@/workers/ruleExtraction.worker';
 *   await runRuleExtractionTest();
 *
 * Constraints:
 *   - Only processes chunks where knowledge_documents.category is in SUPPORTED_EXTRACTION_CATEGORIES
 *   - Only processes chunks where rule_processed = false
 *   - Per-chunk error isolation: a failing chunk does not abort the batch
 *   - Requires SUPABASE_SERVICE_ROLE_KEY in environment for RLS bypass
 */

import { supabase } from '@/lib/supabase';
import {
  deduplicateRules,
  type ChunkInput,
  type ExtractedRule,
} from '@/services/ruleExtraction.service';
import {
  extractRulesByCategory,
  normalizeCategory,
  SUPPORTED_EXTRACTION_CATEGORIES,
} from '@/services/categoryExtraction.service';
import { enrichRules, type EnrichedRule } from '@/services/ruleEnrichment.service';
import { validateRule } from '@/core/rules/ruleValidator';
import { sanitizeUnit } from '@/core/utils/unitNormalizer';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const BATCH_SIZE = 50;
const TEST_BATCH_SIZE = 10;

// ---------------------------------------------------------------------------
// Internal DB types
// (rules table not yet in generated Database type — cast via unknown as needed)
// ---------------------------------------------------------------------------

interface DBChunkRow {
  id: string;
  content: string;
  document_id: string;
  knowledge_documents: {
    category: string;
  };
}

interface RuleInsertRow {
  document_id: string;
  chunk_id: string;
  category: string;
  domain: string;
  rule_type: string;
  description: string;
  structured_data: Record<string, unknown>;
  confidence_score: number;
  source: string;
  /** Deduplication key — unique constraint in DB prevents duplicate rules */
  signature: string;
  // Enrichment fields (migration 20260317000004)
  enforcement_level: string;
  flexibility_score: number;
  contextual: boolean;
  applicability: Record<string, unknown>;
}

interface InsertResult {
  inserted: number;
  skipped: number;
}

interface ExtractionResult {
  chunkId: string;
  rulesExtracted: number;
  rulesInserted: number;
  rulesSkipped: number;
  success: boolean;
  error?: string;
}

// ---------------------------------------------------------------------------
// DB operations
// ---------------------------------------------------------------------------

/**
 * Fetch a batch of unprocessed chunks for all supported extraction categories,
 * joining to knowledge_documents to get the category alongside the chunk.
 */
async function fetchChunks(limit: number): Promise<ChunkInput[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('knowledge_chunks')
    .select('id, content, document_id, knowledge_documents!inner(category)')
    .eq('rule_processed', false)
    .in('knowledge_documents.category', SUPPORTED_EXTRACTION_CATEGORIES)
    .limit(limit);

  if (error) {
    throw new Error(`fetchChunks: ${error.message}`);
  }

  if (!data || data.length === 0) return [];

  return (data as DBChunkRow[]).map((row) => ({
    id: row.id,
    content: row.content,
    document_id: row.document_id,
    // Normalize at the DB boundary so all downstream code sees canonical form
    category: normalizeCategory(row.knowledge_documents.category),
  }));
}

/**
 * Batch-upsert extracted rules for a given chunk.
 *
 * Uses INSERT ... ON CONFLICT (signature) DO NOTHING so that rules already
 * present in the database from a previous run are silently skipped.
 * The UNIQUE constraint on rules.signature must exist in the DB
 * (see migration 20260317000002_rules_signature.sql).
 *
 * Returns the number of rows actually inserted and skipped.
 */
async function insertRules(
  rules: EnrichedRule[],
  chunkId: string,
  documentId: string,
  category: string,
): Promise<InsertResult> {
  if (rules.length === 0) return { inserted: 0, skipped: 0 };

  const rows: RuleInsertRow[] = rules
    .filter((rule) => {
      const { valid } = validateRule(rule);
      return valid;
    })
    .map((rule) => ({
      document_id:     documentId,
      chunk_id:        chunkId,
      category,
      domain:          rule.domain,
      rule_type:       rule.rule_type,
      description:     rule.description,
      structured_data: rule.structured_data
        ? {
            ...(rule.structured_data as Record<string, unknown>),
            unit: sanitizeUnit(rule.structured_data.unit ?? undefined),
          }
        : rule.structured_data,
      confidence_score: rule.confidence_score,
      source: rule.source_sentence.length > 500
        ? rule.source_sentence.substring(0, 497) + '…'
        : rule.source_sentence,
      signature:         rule.signature,
      enforcement_level: rule.enforcement_level,
      flexibility_score: rule.flexibility_score,
      contextual:        rule.contextual,
      applicability:     rule.applicability as Record<string, unknown>,
    }));

  // ignoreDuplicates: true → ON CONFLICT DO NOTHING
  // .select('id')          → RETURNING id (only actually-inserted rows come back)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('rules')
    .upsert(rows, { onConflict: 'signature', ignoreDuplicates: true })
    .select('id');

  if (error) {
    throw new Error(`insertRules (chunk ${chunkId}): ${error.message}`);
  }

  const inserted = (data as { id: string }[] | null)?.length ?? 0;
  const skipped  = rows.length - inserted;

  return { inserted, skipped };
}

/**
 * Mark a chunk as processed so it is skipped in subsequent worker runs.
 */
async function markChunkProcessed(chunkId: string): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from('knowledge_chunks')
    .update({ rule_processed: true })
    .eq('id', chunkId);

  if (error) {
    throw new Error(`markChunkProcessed (chunk ${chunkId}): ${error.message}`);
  }
}

// ---------------------------------------------------------------------------
// Core processing
// ---------------------------------------------------------------------------

/**
 * Process a single chunk end-to-end: extract → insert → mark processed.
 * Returns a result object; never throws (errors are captured in the result).
 */
async function processChunk(chunk: ChunkInput): Promise<ExtractionResult> {
  try {
    const extracted = extractRulesByCategory(chunk, chunk.category);
    // Enrich with enforcement metadata before persistence
    const rules = enrichRules(extracted, chunk.category);
    const { inserted, skipped } = await insertRules(rules, chunk.id, chunk.document_id, chunk.category);
    await markChunkProcessed(chunk.id);

    console.log(
      `[RuleExtraction] ✓ chunk=${chunk.id}` +
      ` extracted=${rules.length} inserted=${inserted} skipped=${skipped}` +
      ` domain=${rules[0]?.domain ?? 'n/a'}`,
    );

    return {
      chunkId:       chunk.id,
      rulesExtracted: rules.length,
      rulesInserted:  inserted,
      rulesSkipped:   skipped,
      success:        true,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[RuleExtraction] ✗ chunk=${chunk.id} error=${message}`);
    return {
      chunkId:       chunk.id,
      rulesExtracted: 0,
      rulesInserted:  0,
      rulesSkipped:   0,
      success:        false,
      error:          message,
    };
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Run the rule extraction pipeline on a batch of DTU chunks.
 *
 * @param limit - Maximum number of chunks to process (default: 50)
 */
export async function runRuleExtraction(limit = BATCH_SIZE): Promise<{ chunksProcessed: number }> {
  console.log(`[RuleExtraction] Starting — batch size: ${limit} (categories: ${SUPPORTED_EXTRACTION_CATEGORIES.join(', ')})`);

  let chunks: ChunkInput[];
  try {
    chunks = await fetchChunks(limit);
  } catch (err) {
    console.error('[RuleExtraction] Failed to fetch chunks:', err);
    return { chunksProcessed: 0 };
  }

  if (chunks.length === 0) {
    console.log('[RuleExtraction] No unprocessed chunks found for supported categories — nothing to do.');
    return { chunksProcessed: 0 };
  }

  console.log(`[RuleExtraction] Fetched ${chunks.length} chunk(s) to process`);

  const results: ExtractionResult[] = [];

  // Sequential processing: per-chunk isolation, no parallel DB writes
  for (const chunk of chunks) {
    const result = await processChunk(chunk);
    results.push(result);
  }

  // Summary
  const succeeded      = results.filter((r) => r.success);
  const failed         = results.filter((r) => !r.success);
  const totalExtracted = succeeded.reduce((sum, r) => sum + r.rulesExtracted, 0);
  const totalInserted  = succeeded.reduce((sum, r) => sum + r.rulesInserted,  0);
  const totalSkipped   = succeeded.reduce((sum, r) => sum + r.rulesSkipped,   0);

  console.log(`[RuleExtraction] Done — chunks: ${succeeded.length}/${chunks.length} ok`);
  console.log(`[RuleExtraction]   rules extracted : ${totalExtracted}`);
  console.log(`[RuleExtraction]   rules inserted  : ${totalInserted}`);
  console.log(`[RuleExtraction]   rules skipped   : ${totalSkipped} (already in DB)`);

  if (failed.length > 0) {
    console.warn(`[RuleExtraction] ${failed.length} chunk(s) failed:`);
    for (const { chunkId, error } of failed) {
      console.warn(`  ✗ chunk=${chunkId} — ${error}`);
    }
  }

  return { chunksProcessed: chunks.length };
}

/**
 * Test mode: fetch up to 10 DTU chunks, run extraction, and log results.
 * Does NOT write to the database — safe to run at any time.
 */
export async function runRuleExtractionTest(): Promise<void> {
  console.log(`[RuleExtraction:TEST] Starting test mode — 10 chunks, no DB writes (categories: ${SUPPORTED_EXTRACTION_CATEGORIES.join(', ')})`);

  let chunks: ChunkInput[];
  try {
    chunks = await fetchChunks(TEST_BATCH_SIZE);
  } catch (err) {
    console.error('[RuleExtraction:TEST] Failed to fetch chunks:', err);
    return;
  }

  if (chunks.length === 0) {
    console.log('[RuleExtraction:TEST] No unprocessed chunks found for supported categories.');
    return;
  }

  console.log(`[RuleExtraction:TEST] Processing ${chunks.length} chunk(s)...\n`);

  // Collect all rules across chunks before cross-chunk dedup
  const allRulesBeforeDedup: ExtractedRule[] = [];

  for (const chunk of chunks) {
    const extracted = extractRulesByCategory(chunk, chunk.category);
    const rules = enrichRules(extracted, chunk.category);
    allRulesBeforeDedup.push(...rules);

    console.log('\n══════════════════════════════════════════════════════════');
    console.log(`chunk_id    : ${chunk.id}`);
    console.log(`document_id : ${chunk.document_id}`);
    console.log(`category    : ${chunk.category}`);
    console.log('------ CHUNK ------');
    console.log(chunk.content);
    console.log('------ RULES (enriched) ------');
    console.dir(rules, { depth: null });
    console.log(`rules found (this chunk) : ${rules.length}`);
  }

  // Cross-chunk deduplication
  const dedupedRules = deduplicateRules(allRulesBeforeDedup);

  const quantCount      = dedupedRules.filter((r) => r.rule_type === 'constraint').length;
  const qualCount       = dedupedRules.filter((r) => r.rule_type === 'requirement').length;
  const otherCount      = dedupedRules.length - quantCount - qualCount;
  const contextualCount = dedupedRules.filter((r) => (r as { contextual?: boolean }).contextual).length;

  console.log('\n══════════════════════════════════════════════════════════');
  console.log(`[RuleExtraction:TEST] ✓ chunks processed    : ${chunks.length}`);
  console.log(`[RuleExtraction:TEST]   rules before dedup  : ${allRulesBeforeDedup.length}`);
  console.log(`[RuleExtraction:TEST]   rules after  dedup  : ${dedupedRules.length}`);
  console.log(`[RuleExtraction:TEST]   duplicates removed  : ${allRulesBeforeDedup.length - dedupedRules.length}`);
  console.log(`[RuleExtraction:TEST]   ── quantitative      : ${quantCount} (constraint)`);
  console.log(`[RuleExtraction:TEST]   ── qualitative       : ${qualCount} (requirement)`);
  if (otherCount > 0) {
    console.log(`[RuleExtraction:TEST]   ── other             : ${otherCount}`);
  }
  console.log(`[RuleExtraction:TEST]   ── contextual        : ${contextualCount} (context-dependent)`);
}
