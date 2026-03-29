/**
 * Rule Activation Service
 *
 * Activates applicable rules from the corpus based on detected work types.
 *
 * Responsibilities:
 *
 *   1. Given a set of DetectedWorkType objects, query the `rules` table to
 *      fetch all rules whose property_key or domain matches the spec for each
 *      detected work type.
 *
 *   2. For each activated rule, determine its VerifiabilityStatus:
 *
 *      verifiable      — rule applies and all required_context fields are
 *                        present in the analyzed text.
 *
 *      non_verifiable  — rule applies but required data is absent from the
 *                        quote (NOT a failure — marks for follow-up).
 *
 *      not_applicable  — rule's own applicability conditions exclude this
 *                        project context (e.g. seismic rule in zone 1 with
 *                        known zone = zone_sismique_1).
 *
 *   3. Return a full WorkTypeActivationResult with summary statistics.
 *
 * Verifiability logic:
 *
 *   The service NEVER returns a "failure" for a non_verifiable rule.
 *   non_verifiable means: "we cannot confirm compliance from the quote alone".
 *   This is the correct behavior for a quote-auditing system: the auditor must
 *   request the missing data, but the absence of data is NOT non-compliance.
 *
 * Dependency:
 *   Requires a Supabase client (server-side usage, service role).
 *   Pure detection (no DB) is available via detectWorkTypes() + this module's
 *   buildActivatedRuleFromRow() which can be tested independently.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  DetectedWorkType,
  ActivatedRule,
  ActivationSummary,
  WorkTypeActivationResult,
  VerifiabilityStatus,
  WorkType,
} from './workTypes';
import { detectWorkTypes }       from './workTypeDetection.service';
import { WORK_TYPE_RULES_MAP }   from './workTypeRulesMap';

// =============================================================================
// Context detection from quote text
// =============================================================================

/**
 * Detect which RequiredContext fields are present (or inferable) from the
 * quote text via lightweight regex matching.
 *
 * The result is a set of context keys whose values are present in the text.
 * This is used to decide verifiability:
 *   - If a work type requires 'zone_sismique' and we detect a zone mention,
 *     the rule is verifiable.
 *   - If the context is absent, the rule is non_verifiable.
 */
const CONTEXT_DETECTION_PATTERNS: Record<string, RegExp> = {
  zone_sismique: /zone\s*(sismique|de\s+sismicit[eé])\s*[0-9]/i,
  zone_climatique: /zone\s*(climatique|h[123][a-c]?)\b/i,
  destination_batiment: /\b(erp|logement|bureau|industri[ae]|entrepot|ehpad|habitat)\b/i,
  type_sol: /\b(classe\s+de\s+sol|sol\s+[a-e]\b|type\s+de\s+sol|argile|sable\s+fin|roche)\b/i,
  classe_exposition: /\b(xc[0-9]|xs[0-9]|xd[0-9]|classe\s+d.exposition)\b/i,
  surface_locaux: /\b([0-9]+\s*m[²2])\b/i,
  hauteur_batiment: /\b(hauteur\s*(du\s*)?b[aâ]timent|r\+[0-9]|[0-9]+\s*m\s*(de\s*)?haut)/i,
};

/**
 * Parse the source text and return the set of context keys that are
 * likely present. Does not extract values — only presence detection.
 */
export function detectPresentContext(text: string): Set<string> {
  const present = new Set<string>();
  for (const [key, re] of Object.entries(CONTEXT_DETECTION_PATTERNS)) {
    if (re.test(text)) {
      present.add(key);
    }
  }
  return present;
}

// =============================================================================
// DB row type (matches `rules` table columns used here)
// =============================================================================

interface RuleRow {
  id:                    string;
  signature:             string;
  description:           string;
  category:              string;
  domain:                string;
  rule_type:             string;
  property_key:          string | null;
  operator:              string | null;
  value:                 number | null;
  unit:                  string | null;
  adaptable:             boolean;
  enforcement_level:     string;
  strictness:            string;
  risk_level:            string;
  justification_required: boolean;
  contextual:            boolean;
  applicability:         Record<string, unknown>;
}

// =============================================================================
// Verifiability determination
// =============================================================================

/**
 * Determine verifiability for a single rule activation.
 *
 * @param rule          - The activated rule
 * @param workType      - Work type that triggered this rule
 * @param presentContext - Context fields present in the source text
 * @returns { verifiability, missing_data }
 */
function determineVerifiability(
  rule: RuleRow,
  workType: WorkType,
  presentContext: Set<string>,
): { verifiability: VerifiabilityStatus; missing_data: string[] } {
  const spec = WORK_TYPE_RULES_MAP[workType];
  const missingData: string[] = [];

  // Check each required context field for this work type
  for (const ctx of spec.required_context) {
    if (!presentContext.has(ctx)) {
      missingData.push(formatMissingContext(ctx));
    }
  }

  // If the rule itself is contextual but has no applicability match in text,
  // additional data may be missing (only when the rule has a property_key)
  if (rule.contextual && rule.property_key && !presentContext.has('destination_batiment')) {
    // Only flag destination if the domain suggests it's needed and not already flagged
    const domainNeedsDestination = /erp|accessibilit|incendie/i.test(rule.domain ?? '');
    if (domainNeedsDestination && !missingData.some((m) => m.includes('destination'))) {
      missingData.push('Destination du bâtiment non précisée');
    }
  }

  if (missingData.length > 0) {
    return { verifiability: 'non_verifiable', missing_data: missingData };
  }

  return { verifiability: 'verifiable', missing_data: [] };
}

function formatMissingContext(ctx: string): string {
  const labels: Record<string, string> = {
    zone_sismique:       'Zone sismique non précisée — requis pour les règles parasismiques (EN 1998)',
    zone_climatique:     'Zone climatique non précisée — requis pour RE2020 et règles thermiques',
    destination_batiment:'Destination du bâtiment non précisée — requis pour règles ERP / accessibilité / incendie',
    type_sol:            'Type de sol non précisé — requis pour règles de fondations et dallages (NF P 94-500)',
    classe_exposition:   'Classe d\'exposition béton non précisée — requis pour règles d\'enrobage (EN 1992)',
    surface_locaux:      'Surface des locaux non précisée — requis pour règles de compartimentage',
    hauteur_batiment:    'Hauteur du bâtiment non précisée — requis pour règles IGH et désenfumage',
  };
  return labels[ctx] ?? `Contexte manquant : ${ctx}`;
}

// =============================================================================
// Rule row → ActivatedRule
// =============================================================================

export function buildActivatedRuleFromRow(
  row: RuleRow,
  workType: WorkType,
  presentContext: Set<string>,
): ActivatedRule {
  const { verifiability, missing_data } = determineVerifiability(row, workType, presentContext);

  return {
    rule_id:               row.id,
    signature:             row.signature,
    work_type:             workType,
    description:           row.description,
    category:              row.category,
    domain:                row.domain,
    rule_type:             row.rule_type,
    property_key:          row.property_key,
    operator:              row.operator,
    value:                 row.value,
    unit:                  row.unit,
    adaptable:             row.adaptable,
    enforcement_level:     row.enforcement_level,
    strictness:            row.strictness,
    risk_level:            row.risk_level,
    justification_required: row.justification_required,
    verifiability,
    missing_data,
    contextual:            row.contextual,
    applicability:         row.applicability ?? {},
  };
}

// =============================================================================
// Supabase query builder
// =============================================================================

/**
 * Fetch rules from DB that apply to a given set of work types.
 *
 * Strategy: query rules where:
 *   - property_key IN (all property_keys for all detected work types)
 *   OR
 *   - domain IN (all domains for all detected work types)
 *
 * We then map each returned rule to the work type(s) it belongs to.
 */
async function fetchApplicableRules(
  supabase: SupabaseClient,
  workTypes: DetectedWorkType[],
): Promise<{ rule: RuleRow; work_type: WorkType }[]> {
  // Collect all property_keys and domains across all detected work types
  const allPropertyKeys = new Set<string>();
  const allDomains      = new Set<string>();
  const allCategories   = new Set<string>();

  for (const detected of workTypes) {
    const spec = WORK_TYPE_RULES_MAP[detected.work_type];
    spec.property_keys.forEach((k) => allPropertyKeys.add(k));
    spec.domains.forEach((d)       => allDomains.add(d));
    spec.categories.forEach((c)    => allCategories.add(c));
  }

  const propertyKeyArray = Array.from(allPropertyKeys);
  const domainArray      = Array.from(allDomains);
  const categoryArray    = Array.from(allCategories);

  // Fetch rules matching property_keys
  const { data: byKey, error: keyErr } = await supabase
    .from('rules')
    .select(
      'id, signature, description, category, domain, rule_type, property_key, operator, value, unit, adaptable, enforcement_level, strictness, risk_level, justification_required, contextual, applicability',
    )
    .in('property_key', propertyKeyArray)
    .in('category', categoryArray);

  if (keyErr) {
    console.error('[ACTIVATION] Error fetching rules by property_key:', keyErr.message);
  }

  // Fetch rules matching domains (catches rules without a property_key but scoped to a domain)
  const { data: byDomain, error: domainErr } = await supabase
    .from('rules')
    .select(
      'id, signature, description, category, domain, rule_type, property_key, operator, value, unit, adaptable, enforcement_level, strictness, risk_level, justification_required, contextual, applicability',
    )
    .in('domain', domainArray)
    .in('category', categoryArray);

  if (domainErr) {
    console.error('[ACTIVATION] Error fetching rules by domain:', domainErr.message);
  }

  // Merge and deduplicate by rule id
  const seen = new Set<string>();
  const merged: RuleRow[] = [];
  for (const row of [...(byKey ?? []), ...(byDomain ?? [])]) {
    if (!seen.has(row.id)) {
      seen.add(row.id);
      merged.push(row as RuleRow);
    }
  }

  // Map each rule to the work type(s) it belongs to
  const result: { rule: RuleRow; work_type: WorkType }[] = [];

  for (const rule of merged) {
    for (const detected of workTypes) {
      const spec = WORK_TYPE_RULES_MAP[detected.work_type];
      const matchesKey    = rule.property_key != null && spec.property_keys.includes(rule.property_key);
      const matchesDomain = spec.domains.includes(rule.domain);

      if (matchesKey || matchesDomain) {
        result.push({ rule, work_type: detected.work_type });
      }
    }
  }

  return result;
}

// =============================================================================
// Summary builder
// =============================================================================

function buildSummary(
  detectedTypes:   DetectedWorkType[],
  activatedRules:  ActivatedRule[],
): ActivationSummary {
  let verifiable_count     = 0;
  let non_verifiable_count = 0;
  let not_applicable_count = 0;
  let critical_gaps        = 0;

  for (const rule of activatedRules) {
    if (rule.verifiability === 'verifiable')      verifiable_count++;
    else if (rule.verifiability === 'non_verifiable') {
      non_verifiable_count++;
      // Critical gap: high strictness rule that cannot be verified
      if (rule.strictness === 'very_high' || rule.strictness === 'high') {
        critical_gaps++;
      }
    } else {
      not_applicable_count++;
    }
  }

  const high_confidence_types = detectedTypes
    .filter((d) => d.confidence >= 0.5)
    .map((d) => d.work_type);

  return {
    total_work_types_detected: detectedTypes.length,
    total_rules_activated:     activatedRules.length,
    verifiable_count,
    non_verifiable_count,
    not_applicable_count,
    high_confidence_types,
    critical_gaps,
  };
}

// =============================================================================
// Public API
// =============================================================================

/**
 * Activate applicable rules from the corpus for the given work types.
 *
 * @param supabase     - Supabase client (server-side, service role)
 * @param workTypes    - Detected work types (from detectWorkTypes)
 * @param sourceText   - Original quote text (used for context detection)
 * @returns Array of ActivatedRule with verifiability annotations
 */
export async function activateRules(
  supabase: SupabaseClient,
  workTypes: DetectedWorkType[],
  sourceText: string,
): Promise<ActivatedRule[]> {
  if (workTypes.length === 0) return [];

  const presentContext = detectPresentContext(sourceText);
  const ruleRows       = await fetchApplicableRules(supabase, workTypes);

  return ruleRows.map(({ rule, work_type }) =>
    buildActivatedRuleFromRow(rule, work_type, presentContext),
  );
}

/**
 * Full pipeline: text → detect work types → activate rules → return result.
 *
 * This is the primary entry point for the Rule Engine and Audit Engine.
 *
 * @param supabase  - Supabase client (server-side, service role)
 * @param text      - Raw quote text
 * @returns WorkTypeActivationResult — detected types, activated rules, summary
 */
export async function runWorkTypeActivationPipeline(
  supabase: SupabaseClient,
  text: string,
): Promise<WorkTypeActivationResult> {
  const detected_work_types = detectWorkTypes(text);
  const activated_rules     = await activateRules(supabase, detected_work_types, text);
  const summary             = buildSummary(detected_work_types, activated_rules);

  return {
    source_text:         text,
    detected_work_types,
    activated_rules,
    summary,
  };
}

// Re-export WorkTypeActivationResult type for consumers
export type { WorkTypeActivationResult } from './workTypes';
