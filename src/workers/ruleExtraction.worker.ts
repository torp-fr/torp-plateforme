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

import 'dotenv/config';
import { fileURLToPath } from 'url';
import OpenAI from 'openai';
import { supabase } from '@/lib/supabase';

console.log('[ENV] OPENAI_API_KEY loaded:', !!process.env.OPENAI_API_KEY);
import {
  deduplicateRules,
  type ChunkInput,
  type ExtractedRule,
  type RuleOperator,
} from '@/services/ruleExtraction.service';
import {
  normalizeCategory,
  SUPPORTED_EXTRACTION_CATEGORIES,
} from '@/services/categoryExtraction.service';
import { enrichRules, type EnrichedRule } from '@/services/ruleEnrichment.service';
import { sanitizeUnit } from '@/core/utils/unitNormalizer';

// Allowed BTP technical domains — 'general' is explicitly excluded.
const VALID_DOMAINS = new Set([
  'structure', 'thermique', 'acoustique', 'sismique',
  'sécurité', 'incendie', 'accessibilité', 'hydraulique', 'électrique',
]);

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const BATCH_SIZE = 10;
const TEST_BATCH_SIZE = 10;

// ---------------------------------------------------------------------------
// Utility functions
// ---------------------------------------------------------------------------

/**
 * Determine if a chunk is non-relevant for rule extraction based on heuristics.
 * Non-relevant chunks should be marked as processed without retry.
 */
function isNonRelevantChunk(content: string): boolean {
  // Heuristic 1: content length < 300 chars
  if (content.length < 300) {
    return true;
  }

  const lowerContent = content.toLowerCase();

  // Heuristic 2: contains table of contents indicators
  const tocIndicators = ['sommaire', 'table des matières', 'avant-propos', 'table of contents', 'contents'];
  if (tocIndicators.some(indicator => lowerContent.includes(indicator))) {
    return true;
  }

  // Heuristic 3: mostly uppercase / names / lists
  const words = content.split(/\s+/);
  const uppercaseWords = words.filter(word => word === word.toUpperCase() && word.length > 2);
  const uppercaseRatio = uppercaseWords.length / words.length;

  // If more than 30% of words are uppercase, likely a list of names/titles
  if (uppercaseRatio > 0.3) {
    return true;
  }

  // Check for list-like patterns (many short lines, bullet points, etc.)
  const lines = content.split('\n');
  const shortLines = lines.filter(line => line.trim().length > 0 && line.trim().length < 50);
  const listRatio = shortLines.length / lines.length;

  // If more than 60% of lines are short, likely a list
  if (listRatio > 0.6) {
    return true;
  }

  return false;
}

// ---------------------------------------------------------------------------
// LLM client
// ---------------------------------------------------------------------------

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/**
 * Extract structured rules from a chunk using GPT-4o-mini.
 * Returns an array of raw rule objects; never throws (returns [] on failure).
 */
// ---------------------------------------------------------------------------
// Shared LLM item → ExtractedRule mapping
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapLLMItems(items: any[], category: string): ExtractedRule[] {
  return items
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .filter((item: any) => item && typeof item === 'object' && typeof item.property_key === 'string')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .map((item: any): ExtractedRule => {
      const propKey = String(item.property_key ?? 'n/a');
      let   op      = String(item.operator ?? '>=');
      const val     = typeof item.value === 'number' ? item.value : null;
      const unit    = item.unit != null ? String(item.unit) : null;
      const desc    = String(item.description ?? '');

      const NUMERIC_OPS = new Set(['>', '<', '>=', '<=', '=']);
      let isQualitative: boolean;
      if (NUMERIC_OPS.has(op)) {
        isQualitative = val === null;
      } else {
        if (val !== null) { op = '='; isQualitative = false; }
        else              { isQualitative = true; }
      }

      const sigBase = `${category}|${propKey}|${op}|${val}|${unit}`;
      let h = 0x811c9dc5;
      for (let i = 0; i < sigBase.length; i++) {
        h = Math.imul(h ^ sigBase.charCodeAt(i), 0x01000193) >>> 0;
      }

      const rawDomain = item.domain ? String(item.domain).toLowerCase().trim() : '';
      const domain = VALID_DOMAINS.has(rawDomain) ? rawDomain : 'structure';

      return {
        rule_type:       'constraint',
        domain,
        description:     desc,
        structured_data: {
          element:           null,
          property:          propKey,
          property_key:      propKey,
          property_category: 'dimension',
          operator:          op as RuleOperator,
          value:             val,
          unit,
          ...(isQualitative ? { qualitative: true as const } : {}),
          raw:               null,
        },
        confidence_score: typeof item.confidence === 'number' ? item.confidence : 0.7,
        source_sentence:  desc,
        signature:        `llm_${h.toString(16)}`,
      };
    });
}

// ---------------------------------------------------------------------------
// Safe JSON parsing — with automatic repair retry on first failure
// ---------------------------------------------------------------------------

/**
 * Parse LLM JSON output, with one automatic repair attempt on first failure.
 *
 * @param raw     - Raw text from the LLM response (may contain markdown fences).
 * @param chunkId - Used only for log messages.
 * @returns Parsed array on success.
 *          null when both the initial parse AND the repair fail — the caller
 *          must NOT mark the chunk as processed so it is retried next cycle.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function safeParseRulesJSON(raw: string, chunkId: string): Promise<any[] | null> {
  const cleaned = raw.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();

  try {
    const parsed = JSON.parse(cleaned);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    console.warn(`[PARSE] JSON parse failed for chunk ${chunkId} — attempting repair`);
  }

  // ── Repair pass ──────────────────────────────────────────────────────────
  try {
    const repair = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0,
      max_tokens: 8000,
      messages: [
        {
          role: 'system',
          content: 'Tu corriges du JSON invalide. Réponds UNIQUEMENT avec un tableau JSON valide, aucun texte autour.',
        },
        {
          role: 'user',
          content: `Corrige ce JSON invalide. Retourne UNIQUEMENT un tableau JSON valide.\n\n${raw.slice(0, 4000)}`,
        },
      ],
    });
    const repairRaw     = repair.choices[0]?.message?.content ?? '[]';
    const repairCleaned = repairRaw.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();
    const repaired      = JSON.parse(repairCleaned);
    console.log(`[PARSE] JSON repair succeeded for chunk ${chunkId}`);
    return Array.isArray(repaired) ? repaired : [];
  } catch {
    console.error(`[PARSE] JSON repair also failed for chunk ${chunkId} — chunk will NOT be marked processed`);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Single-chunk LLM extraction
// ---------------------------------------------------------------------------

/**
 * Extract structured rules from a single chunk using gpt-4o-mini.
 *
 * @param chunk        - The chunk to process.
 * @param supplemental - When true, prefixes the prompt with a second-pass
 *                       directive instructing the model to surface constraints
 *                       missed on the first pass.
 * @returns ExtractedRule[] on success.
 *          null             when JSON parse failed twice → caller must NOT mark processed.
 *          'RATE_LIMIT'     when a 429 is received from the API.
 */
async function extractRulesFromChunk(
  chunk: ChunkInput,
  supplemental = false,
): Promise<ExtractedRule[] | null | 'RATE_LIMIT'> {
  await new Promise<void>((r) => setTimeout(r, 200)); // per-call throttle

  const supplementalPrefix = supplemental
    ? '⚠️ SECONDE ANALYSE : Tu as analysé ce texte une première fois mais tu as manqué des ' +
      'contraintes techniques. Extrais TOUTES les règles restantes, même implicites, même ' +
      'procédurales. Ne répète pas les règles déjà trouvées.\n\n'
    : '';

  const prompt = `${supplementalPrefix}Catégorie : ${chunk.category}
Extrais TOUTES les contraintes techniques du texte BTP ci-dessous. N'en manque aucune.

════════════════════════════════════════════════════
COMPORTEMENT CRITIQUE
════════════════════════════════════════════════════
⚠️ Ne sois PAS conservateur — la sur-extraction est OBLIGATOIRE
⚠️ Si une phrase POURRAIT être une règle → l'inclure
⚠️ Manquer une règle est PIRE qu'ajouter une règle faible
⚠️ Chaque valeur numérique avec unité est une règle distincte

════════════════════════════════════════════════════
CE QU'EST UNE RÈGLE
════════════════════════════════════════════════════
• Valeurs numériques avec unité (mm, %, m, °C, kN, dB, W/m²K…)
• Tolérances et plages (±, min/max, entre X et Y)
• Obligations : doit, doivent, il faut, est obligatoire, est requis
• Interdictions : interdit, ne doit pas, ne peut pas, est proscrit
• Recommandations : il convient de, il est recommandé
• Conformités : doit être conforme à, doit respecter, selon la norme
• Exigences procédurales : étapes obligatoires, séquences imposées
• Limites techniques : résistances, portées, pentes, débits, pressions

════════════════════════════════════════════════════
DENSITÉ MINIMALE
════════════════════════════════════════════════════
• Contenu technique → MINIMUM 5 règles, vise 8 à 15
• [] UNIQUEMENT si le chunk est purement administratif (sommaire, mentions légales)
• Ne pas résumer — extraire chaque contrainte granulaire séparément

════════════════════════════════════════════════════
FORMAT OBLIGATOIRE — tableau JSON strict, aucun texte autour
════════════════════════════════════════════════════
[
  {"property_key":"epaisseur_chape","operator":">=","value":50,"unit":"mm","description":"L'épaisseur de la chape doit être ≥ 50 mm","confidence":0.95,"type":"quantitative","domain":"structure"},
  {"property_key":"joint_peripherique","operator":"obligatoire","value":null,"unit":null,"description":"Un joint périphérique souple est obligatoire","confidence":0.90,"type":"qualitative","domain":"acoustique"}
]

TYPE QUANTITATIF → operator: ">=" | "<=" | "=" | ">" | "<" | "range", value: number, unit: string
TYPE QUALITATIF  → operator: "obligatoire" | "interdit" | "conforme_a" | "recommande", value: null, unit: null
DOMAINE (obligatoire) : structure | thermique | acoustique | sismique | sécurité | incendie | accessibilité | hydraulique | électrique

TEXTE :
${chunk.content.slice(0, 6000)}`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0,
      max_tokens: 8000,
      messages: [
        {
          role: 'system',
          content:
            'Tu extrais des règles techniques BTP en JSON strict. ' +
            'Exhaustivité maximale — extrais TOUTES les règles. ' +
            'Réponds UNIQUEMENT avec un tableau JSON, aucun texte autour.',
        },
        { role: 'user', content: prompt },
      ],
    });

    const raw   = response.choices[0]?.message?.content ?? '[]';
    const items = await safeParseRulesJSON(raw, chunk.id);

    // null = JSON parse failed twice — caller must NOT mark chunk as processed
    if (items === null) return null;

    return mapLLMItems(items, chunk.category);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('429')) {
      console.warn('[RATE LIMIT] 429 received — stopping extraction');
      return 'RATE_LIMIT';
    }
    // Non-429 API error: return empty so the chunk is still marked processed
    // (avoids a permanent retry loop on a transient infrastructure failure)
    console.error(`[EXTRACT] LLM call failed for chunk ${chunk.id}:`, msg);
    return [];
  }
}

// ---------------------------------------------------------------------------
// Multi-pass extraction
// ---------------------------------------------------------------------------

/** Minimum rules before a second pass is considered unnecessary. */
const MIN_RULES_PER_CHUNK = 5;

/**
 * Two-pass extraction with automatic retry when rule density is low.
 *
 * Pass 1 — normal extraction.
 * Pass 2 — triggered when pass 1 returns < MIN_RULES_PER_CHUNK rules.
 *           Uses a supplemental prompt to surface missed constraints.
 *
 * Results are merged and deduplicated by signature so no rule is counted twice.
 *
 * @returns ExtractedRule[] on success.
 *          null             when JSON parse failed and the chunk must not be marked processed.
 *          'RATE_LIMIT'     to propagate a 429 upstream.
 */
async function extractRulesWithRetry(
  chunk: ChunkInput,
): Promise<ExtractedRule[] | null | 'RATE_LIMIT'> {
  // ── Pass 1 ───────────────────────────────────────────────────────────────
  const pass1 = await extractRulesFromChunk(chunk);
  if (pass1 === null || pass1 === 'RATE_LIMIT') return pass1;

  if (pass1.length >= MIN_RULES_PER_CHUNK) {
    console.log(`[EXTRACT] chunk=${chunk.id} pass=1 rules=${pass1.length} retry=no`);
    return pass1;
  }

  // ── Pass 2 — low density detected ────────────────────────────────────────
  console.log(
    `[EXTRACT] chunk=${chunk.id} pass=1 rules=${pass1.length} (< ${MIN_RULES_PER_CHUNK}) — triggering pass 2`,
  );

  const pass2 = await extractRulesFromChunk(chunk, /* supplemental */ true);

  if (pass2 === null) {
    // Pass 2 JSON failed — return pass 1 results to avoid losing valid rules
    console.warn(`[EXTRACT] chunk=${chunk.id} pass=2 JSON failed — using pass 1 results only`);
    return pass1;
  }
  if (pass2 === 'RATE_LIMIT') return 'RATE_LIMIT';

  // ── Merge + deduplicate by signature ─────────────────────────────────────
  const seenSignatures = new Set(pass1.map((r) => r.signature));
  const newFromPass2   = pass2.filter((r) => !seenSignatures.has(r.signature));
  const merged         = [...pass1, ...newFromPass2];

  console.log(
    `[EXTRACT] chunk=${chunk.id} pass=2 ` +
    `rules_pass1=${pass1.length} new_from_pass2=${newFromPass2.length} total=${merged.length} retry=yes`,
  );

  return merged;
}

// ---------------------------------------------------------------------------
// Internal DB types
// (rules table not yet in generated Database type — cast via unknown as needed)
// ---------------------------------------------------------------------------


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
  // Contextual interpretation fields (migration 20260320000002)
  strictness:             string;
  tolerance:              Record<string, unknown> | null;
  adaptable:              boolean;
  risk_level:             string;
  justification_required: boolean;
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
  rateLimited?: boolean;
  error?: string;
  skipped?: boolean;
  empty?: boolean;
}

// ---------------------------------------------------------------------------
// DB operations
// ---------------------------------------------------------------------------

/**
 * Fetch a batch of unprocessed chunks for supported extraction categories.
 *
 * category is read directly from knowledge_chunks.category (propagated at
 * ingestion time — migration 20260320000001). No JOIN to knowledge_documents
 * is needed. Chunks with a missing or unsupported category are skipped and
 * an error is logged; the chunk is NOT marked as processed so it can be
 * investigated and retried after the data is corrected.
 */
async function fetchChunks(limit: number): Promise<ChunkInput[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: chunks, error } = await (supabase as any)
    .from('knowledge_chunks')
    .select('id, content, document_id, category')
    .eq('rule_processed', false)
    .not('content', 'is', null)
    .not('category', 'is', null)
    .in('category', SUPPORTED_EXTRACTION_CATEGORIES)
    .order('created_at', { ascending: true })
    .limit(limit);

  if (error) {
    console.error('[RULE WORKER] fetch error:', error);
    throw new Error(`fetchChunks: ${error.message}`);
  }

  if (!chunks || chunks.length === 0) {
    console.log('[FETCH] chunks fetched: 0');
    return [];
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result: ChunkInput[] = (chunks as any[]).flatMap((row): ChunkInput[] => {
    if (!row.category) {
      console.error(`[FETCH] chunk=${row.id} — missing category, skipping (not marked processed)`);
      return [];
    }

    let canonical: string;
    try {
      canonical = normalizeCategory(row.category);
    } catch {
      console.error(`[FETCH] chunk=${row.id} — unrecognized category="${row.category}", skipping`);
      return [];
    }

    return [{ id: row.id, content: row.content, document_id: row.document_id, category: canonical }];
  });

  // Log category distribution for this batch
  const distribution: Record<string, number> = {};
  for (const chunk of result) {
    distribution[chunk.category] = (distribution[chunk.category] ?? 0) + 1;
  }
  console.log(`[FETCH] chunks fetched: ${result.length} | category distribution: ${JSON.stringify(distribution)}`);

  return result;
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
      // Only skip if property_key is completely missing — insert everything else.
      const propertyKey = (rule.structured_data as unknown as Record<string, unknown>)?.property_key;
      if (!propertyKey) {
        console.log('[RULE SKIP] reason=missing property_key');
        return false;
      }
      return true;
    })
    .map((rule) => {
      console.log(`[RULE INSERT] ${(rule.structured_data as unknown as Record<string, unknown>)?.property_key}`);
      return ({
      document_id:     documentId,
      chunk_id:        chunkId,
      category,
      domain:          rule.domain,
      rule_type:       rule.rule_type,
      description:     rule.description,
      structured_data: (rule.structured_data
        ? {
            ...(rule.structured_data as unknown as Record<string, unknown>),
            unit: sanitizeUnit(rule.structured_data.unit ?? undefined),
          }
        : rule.structured_data) as unknown as Record<string, unknown>,
      confidence_score: rule.confidence_score,
      source: rule.source_sentence.length > 500
        ? rule.source_sentence.substring(0, 497) + '…'
        : rule.source_sentence,
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
      });
    });

  console.log('[RULE INSERT COUNT]', rows.length);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('rules')
    .upsert(rows, { onConflict: 'signature', ignoreDuplicates: true })
    .select('id');

  if (error) {
    console.error('[RULE INSERT ERROR]', error);
    throw error;
  }

  // ignoreDuplicates: true — rows with an existing signature are silently skipped.
  // data contains only the rows actually inserted (not the skipped duplicates).
  const inserted = (data as { id: string }[] | null)?.length ?? 0;
  const skipped  = rows.length - inserted;

  console.log(`[RULE INSERT] inserted=${inserted} skipped_dup=${skipped}`);

  return { inserted, skipped };
}

/**
 * Mark a chunk as processed so it is skipped in subsequent worker runs.
 */
async function markChunkProcessed(chunkId: string): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('knowledge_chunks')
    .update({ rule_processed: true })
    .eq('id', chunkId)
    .select();

  if (error) {
    console.error('[MARK PROCESSED ERROR]', error);
    throw error;
  }

  if (!data || data.length === 0) {
    throw new Error('[MARK PROCESSED FAILED] No rows updated — chunk_id not found or RLS blocked the update');
  }
}

// ---------------------------------------------------------------------------
// Worker pool constants
// ---------------------------------------------------------------------------

const CONCURRENCY        = 3;   // parallel LLM requests per poll cycle
const MIN_CONTENT_LENGTH = 500; // chunks below this are skipped without an LLM call

// ---------------------------------------------------------------------------
// Parallel worker pool
// ---------------------------------------------------------------------------

/**
 * Drains `queue` one chunk at a time using CONCURRENCY parallel workers.
 * Each worker calls extractRulesWithRetry() independently per chunk.
 *
 * Failure modes and their handling:
 *   'RATE_LIMIT'        — sets shared flag, all workers stop immediately.
 *   null (JSON failure) — chunk left unprocessed; retried on next poll cycle.
 *   0 rules extracted   — always marked processed (no infinite retry):
 *                         non-relevant chunks → [SKIP], others → [EMPTY].
 *   Non-429 API error   — chunk marked processed to prevent an infinite retry
 *                         loop on transient infrastructure failures.
 *
 * Returns true if the run was cut short by a rate limit.
 */
async function runWorkerPool(
  queue: ChunkInput[],
  allResults: ExtractionResult[],
): Promise<boolean> {
  const state = { rateLimitHit: false };

  async function worker(): Promise<void> {
    while (queue.length > 0 && !state.rateLimitHit) {
      const chunk = queue.shift(); // synchronous — safe in single-threaded JS
      if (!chunk) break;

      // Short chunks: mark processed immediately — no LLM call needed
      if (!chunk.content || chunk.content.length < MIN_CONTENT_LENGTH) {
        console.log('[SKIP] Short chunk — marking processed:', chunk.id);
        await markChunkProcessed(chunk.id);
        allResults.push({ chunkId: chunk.id, rulesExtracted: 0, rulesInserted: 0, rulesSkipped: 0, success: true });
        continue;
      }

      try {
        const result = await extractRulesWithRetry(chunk);

        // ── Rate limit ──────────────────────────────────────────────────────
        if (result === 'RATE_LIMIT') {
          state.rateLimitHit = true;
          console.warn('[STOP] Rate limit reached — stopping all workers');
          allResults.push({ chunkId: chunk.id, rulesExtracted: 0, rulesInserted: 0, rulesSkipped: 0, success: false, rateLimited: true });
          break;
        }

        // ── JSON parse failed (both passes) ────────────────────────────────
        if (result === null) {
          console.warn(`[WARN] chunk=${chunk.id} JSON parse failed both times — not marking processed`);
          allResults.push({ chunkId: chunk.id, rulesExtracted: 0, rulesInserted: 0, rulesSkipped: 0, success: false, error: 'json_parse_failed' });
          continue;
        }

        // ── No rules extracted ─────────────────────────────────────────────
        if (result.length === 0) {
          if (isNonRelevantChunk(chunk.content)) {
            await markChunkProcessed(chunk.id);
            console.log(`[SKIP] non-relevant chunk: ${chunk.id}`);
            allResults.push({ chunkId: chunk.id, rulesExtracted: 0, rulesInserted: 0, rulesSkipped: 0, success: true, skipped: true });
          } else {
            await markChunkProcessed(chunk.id);
            console.log(`[EMPTY] no rules extracted: ${chunk.id}`);
            allResults.push({ chunkId: chunk.id, rulesExtracted: 0, rulesInserted: 0, rulesSkipped: 0, success: true, empty: true });
          }
          continue;
        }

        // ── Insert rules + mark processed ──────────────────────────────────
        const enriched              = enrichRules(result, chunk.category);
        const { inserted, skipped } = await insertRules(enriched, chunk.id, chunk.document_id, chunk.category);
        await markChunkProcessed(chunk.id);
        console.log(`[DONE] chunk=${chunk.id} rules=${result.length} inserted=${inserted} skipped=${skipped}`);
        allResults.push({ chunkId: chunk.id, rulesExtracted: result.length, rulesInserted: inserted, rulesSkipped: skipped, success: true });

      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error('[WORKER ERROR] chunk=%s error=%s', chunk.id, msg);
        // Unexpected error: do not mark processed — allow retry next cycle
        allResults.push({ chunkId: chunk.id, rulesExtracted: 0, rulesInserted: 0, rulesSkipped: 0, success: false, error: msg });
      }
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));
  return state.rateLimitHit;
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

  console.log(`[RULE WORKER] fetched chunks: ${chunks.length}`);

  const results: ExtractionResult[] = [];
  const rateLimitHit = await runWorkerPool([...chunks], results);

  if (rateLimitHit) {
    console.warn('[RuleExtraction] Stopped early — rate limit hit. Unprocessed chunks remain in queue.');
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
    const extracted = await extractRulesWithRetry(chunk);

    if (extracted === 'RATE_LIMIT') {
      console.warn('[RuleExtraction:TEST] Rate limit reached — stopping test early');
      break;
    }
    if (extracted === null) {
      console.warn(`[RuleExtraction:TEST] JSON parse failed for chunk ${chunk.id} — skipping`);
      continue;
    }

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

// ---------------------------------------------------------------------------
// Per-cycle stats
// ---------------------------------------------------------------------------

interface CycleStats {
  cycle:            number;
  chunks_fetched:   number;
  chunks_processed: number;
  rules_extracted:  number;
  rules_inserted:   number;
  errors:           number;
  rate_limited:     boolean;
}

/**
 * Run one extraction poll cycle and return structured stats.
 * Never throws — all errors are caught and counted.
 */
async function runCycle(cycle: number): Promise<CycleStats> {
  const stats: CycleStats = {
    cycle,
    chunks_fetched:   0,
    chunks_processed: 0,
    rules_extracted:  0,
    rules_inserted:   0,
    errors:           0,
    rate_limited:     false,
  };

  const chunks = await fetchChunks(BATCH_SIZE);
  stats.chunks_fetched = chunks.length;

  if (chunks.length === 0) {
    console.log(`[CYCLE ${cycle}] No unprocessed chunks available`);
    return stats;
  }

  const results: ExtractionResult[] = [];
  stats.rate_limited = await runWorkerPool([...chunks], results);

  for (const r of results) {
    if (r.success) {
      stats.chunks_processed++;
      stats.rules_extracted += r.rulesExtracted;
      stats.rules_inserted  += r.rulesInserted;
    } else {
      stats.errors++;
    }
  }

  const rateLimitTag = stats.rate_limited ? ' ⚠ RATE_LIMITED' : '';
  console.log(
    `[CYCLE ${cycle}]` +
    ` fetched=${stats.chunks_fetched}` +
    ` processed=${stats.chunks_processed}` +
    ` extracted=${stats.rules_extracted}` +
    ` inserted=${stats.rules_inserted}` +
    ` errors=${stats.errors}` +
    rateLimitTag,
  );

  return stats;
}

// ---------------------------------------------------------------------------
// Graceful shutdown
// ---------------------------------------------------------------------------

/** Set to true by SIGINT/SIGTERM — the loop exits cleanly after its current cycle. */
let shuttingDown = false;

function handleShutdown(signal: string): void {
  if (shuttingDown) return; // already shutting down — ignore duplicate signal
  console.log(`\n[WORKER] ${signal} received — finishing current cycle then exiting`);
  shuttingDown = true;
}

// ---------------------------------------------------------------------------
// Main worker loop
// ---------------------------------------------------------------------------

/** Delay (ms) between cycles when chunks are available. */
const POLL_INTERVAL  = 5_000;
/** Delay (ms) when no chunks are available — avoid hammering the DB. */
const IDLE_INTERVAL  = 30_000;
/** Delay (ms) after an unexpected error — back off before retrying. */
const ERROR_INTERVAL = 2_000;

async function startWorkerLoop(): Promise<void> {

  // ── Startup diagnostics ──────────────────────────────────────────────────
  console.log('[SUPABASE URL]', process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? '(not set)');
  console.log('[SUPABASE KEY PREFIX]', process.env.SUPABASE_SERVICE_ROLE_KEY?.slice(0, 10) ?? '(not set)');

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('[RULE WORKER] SUPABASE_SERVICE_ROLE_KEY is not set — cannot bypass RLS. Aborting.');
  }

  // ── Startup insert test ──────────────────────────────────────────────────
  // Confirms table access, RLS bypass, FK constraints, and column schema.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: testChunk, error: chunkError } = await (supabase as any)
    .from('knowledge_chunks')
    .select('id, document_id')
    .limit(1)
    .single();

  if (chunkError || !testChunk) {
    throw new Error(
      `[RULE WORKER] Startup: no chunk found in knowledge_chunks — ${chunkError?.message ?? 'empty table'}`,
    );
  }

  console.log('[TEST INSERT] chunk_id:', testChunk.id, '| document_id:', testChunk.document_id);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const testInsert = await (supabase as any).from('rules').insert([{
    description:       'TEST RULE',
    chunk_id:          testChunk.id,
    document_id:       testChunk.document_id,
    category:          'DTU',
    domain:            'structure',
    rule_type:         'constraint',
    structured_data:   { property_key: 'test_key', operator: '=', value: 1, unit: 'test', qualitative: false },
    confidence_score:  1.0,
    source:            'startup test',
    signature:         `test_startup_${Date.now()}`,
    enforcement_level: 'normative',
    flexibility_score: 0.3,
    contextual:        false,
    applicability:     {},
  }]).select();

  if (testInsert.error) {
    console.error('[TEST INSERT ERROR]', testInsert.error);
    throw new Error(
      `[RULE WORKER] Startup insert failed: ${testInsert.error.message} — check RLS and schema.`,
    );
  }
  console.log('[TEST INSERT OK] Table access confirmed');

  // ── Signal handlers ──────────────────────────────────────────────────────
  process.on('SIGINT',  () => handleShutdown('SIGINT'));
  process.on('SIGTERM', () => handleShutdown('SIGTERM'));

  console.log(
    `\n🚀 Rule Worker running — categories: [${SUPPORTED_EXTRACTION_CATEGORIES.join(', ')}]`,
    `\n   POLL_INTERVAL=${POLL_INTERVAL}ms  IDLE_INTERVAL=${IDLE_INTERVAL}ms  BATCH_SIZE=${BATCH_SIZE}`,
    '\n   Send SIGINT (Ctrl+C) or SIGTERM to stop gracefully\n',
  );

  // ── Main loop ────────────────────────────────────────────────────────────
  let cycle = 0;

  while (!shuttingDown) {
    cycle++;

    let delayMs = POLL_INTERVAL;

    try {
      const stats = await runCycle(cycle);

      // Back off when idle so we don't spin on an empty queue
      if (stats.chunks_fetched === 0) delayMs = IDLE_INTERVAL;

      // Longer back-off after a rate limit hit
      if (stats.rate_limited) {
        console.warn('[WORKER] Rate limit hit — backing off 60 s before next cycle');
        delayMs = 60_000;
      }

    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[CYCLE ${cycle}] Unexpected error: ${msg}`);
      delayMs = ERROR_INTERVAL;
    }

    if (!shuttingDown) {
      await new Promise<void>((r) => setTimeout(r, delayMs));
    }
  }

  console.log('[WORKER] Graceful shutdown complete');
  process.exit(0);
}

// ---------------------------------------------------------------------------
// ESM entrypoint guard
// ---------------------------------------------------------------------------
// When executed directly (tsx src/workers/ruleExtraction.worker.ts) the loop
// starts automatically. When imported by other modules (e.g. runRuleExtraction
// in scripts/), this block is skipped — no side effects on import.

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  startWorkerLoop().catch((err) => {
    console.error('[WORKER] Fatal startup error:', err);
    process.exit(1);
  });
}
