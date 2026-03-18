/**
 * Rule Enrichment Service
 *
 * Post-extraction enrichment layer: takes an ExtractedRule produced by
 * ruleExtraction.service and decorates it with enforcement metadata.
 *
 * This layer is:
 *   - Pure (no DB calls, no side effects)
 *   - Deterministic (same input → same output)
 *   - Additive (never mutates extraction fields)
 *
 * Applied AFTER extraction, BEFORE DB persistence — inside the worker.
 *
 * New fields added to each rule:
 *   enforcement_level  — regulatory weight derived from document category
 *   flexibility_score  — 0 (rigid) → 1 (flexible), mirrors enforcement_level
 *   contextual         — true when the rule's applicability depends on context
 *   applicability      — structured context conditions (project type, location…)
 */

import type { ExtractedRule } from './ruleExtraction.service';
import {
  NEUF_RE,
  RENOV_RE,
  BUILDING_TYPE_PATTERNS,
  LOCATION_PATTERNS,
  CONTEXTUAL_RE,
  matchProjectType,
  matchBuildingType,
  matchLocation,
} from '@/core/nlp/patterns';

// =============================================================================
// New types
// =============================================================================

export type EnforcementLevel =
  | 'strict'       // Code de la construction, Eurocode — legally mandatory
  | 'normative'    // DTU, Normes NF — contractually mandatory on reference
  | 'recommended'  // Guide technique — best-practice, non-binding
  | 'adaptive'     // Jurisprudence — case-by-case interpretation
  | 'informative'; // Tarifs, indices — reference only

export interface RuleApplicability {
  /** Construction type — neuf or renovation */
  project_type?: 'neuf' | 'renovation';
  /** Occupancy / destination (logement, ERP, industriel…) */
  building_type?: string;
  /** Geographical or regulatory zone (zone sismique 2, littoral…) */
  location?: string;
  /** Additional applicability constraints from structured_data.conditions */
  constraints?: string[];
}

/** ExtractedRule + enrichment fields, ready for DB persistence */
export interface EnrichedRule extends ExtractedRule {
  enforcement_level: EnforcementLevel;
  flexibility_score: number;
  contextual: boolean;
  applicability: RuleApplicability;
  /** Document category that produced this rule (e.g. 'DTU', 'EUROCODE'). */
  category: string;
}

// =============================================================================
// Enforcement mapping
// =============================================================================

/**
 * Category → enforcement level.
 *
 * Keys are listed in both canonical uppercase form (produced by normalizeCategory)
 * and legacy lowercase/mixed form (for backward compat with rules already in DB).
 * All extraction categories are covered; jurisprudence and tarif are non-extraction
 * document types that may appear in older records.
 */
const ENFORCEMENT_MAP: Readonly<Record<string, EnforcementLevel>> = {
  CODE_CONSTRUCTION: 'strict',
  EUROCODE:          'strict',
  DTU:               'normative',
  NORMES:            'normative',
  GUIDE_TECHNIQUE:   'recommended',
  JURISPRUDENCE:     'adaptive',
  PRIX_BTP:          'informative',
};

/** Default when category is unknown */
const DEFAULT_ENFORCEMENT: EnforcementLevel = 'normative';

/**
 * Flexibility score paired to each enforcement level.
 *
 * 0.0 = absolutely rigid (statutory law)
 * 1.0 = purely indicative (no binding force)
 */
const FLEXIBILITY_BY_LEVEL: Record<EnforcementLevel, number> = {
  strict:      0.0,
  normative:   0.3,
  adaptive:    0.6,
  recommended: 0.7,
  informative: 1.0,
};

// =============================================================================
// Applicability detection
// =============================================================================

// Re-export canonical patterns so tests and consumers can import from here
export { NEUF_RE, RENOV_RE, BUILDING_TYPE_PATTERNS, LOCATION_PATTERNS, CONTEXTUAL_RE };

function buildApplicability(rule: ExtractedRule): RuleApplicability {
  const corpus = `${rule.description} ${rule.source_sentence}`;

  const project_type  = matchProjectType(corpus);
  const building_type = matchBuildingType(corpus);
  const location      = matchLocation(corpus);

  // Pull additional constraints from structured_data.conditions
  const conditionValues = rule.structured_data?.conditions
    ? Object.values(rule.structured_data.conditions).filter(Boolean)
    : [];

  const applicability: RuleApplicability = {};
  if (project_type)           applicability.project_type  = project_type;
  if (building_type)          applicability.building_type = building_type;
  if (location)               applicability.location      = location;
  if (conditionValues.length) applicability.constraints   = conditionValues;

  return applicability;
}

function isContextual(rule: ExtractedRule, applicability: RuleApplicability): boolean {
  // Explicit context conditions from structured_data
  const hasConditions = (rule.structured_data?.conditions &&
    Object.keys(rule.structured_data.conditions).length > 0) ?? false;

  // Non-empty applicability means context matters
  const hasApplicability = Object.keys(applicability).length > 0;

  // Linguistic contextual markers in source text
  const corpus = `${rule.description} ${rule.source_sentence}`;
  const hasContextualLanguage = CONTEXTUAL_RE.test(corpus);

  return hasConditions || hasApplicability || hasContextualLanguage;
}

// =============================================================================
// Public API
// =============================================================================

/**
 * Enrich a single ExtractedRule with enforcement metadata.
 *
 * @param rule     - Rule produced by extractRulesFromChunk()
 * @param category - Document category from knowledge_documents (e.g. 'DTU')
 * @returns EnrichedRule — all original fields preserved, new fields appended
 */
export function enrichRule(rule: ExtractedRule, category: string): EnrichedRule {
  const enforcement_level = ENFORCEMENT_MAP[category.toUpperCase()] ?? DEFAULT_ENFORCEMENT;
  const flexibility_score = FLEXIBILITY_BY_LEVEL[enforcement_level];
  const applicability     = buildApplicability(rule);
  const contextual        = isContextual(rule, applicability);

  return {
    ...rule,
    category,
    enforcement_level,
    flexibility_score,
    contextual,
    applicability,
  };
}

/**
 * Enrich an array of extracted rules.
 *
 * @param rules    - Rules from extractRulesFromChunk()
 * @param category - Document category (same for all rules in a chunk)
 * @returns EnrichedRule[]
 */
export function enrichRules(rules: ExtractedRule[], category: string): EnrichedRule[] {
  return rules.map((rule) => enrichRule(rule, category));
}

// Re-export constants for worker/test use
export { ENFORCEMENT_MAP, FLEXIBILITY_BY_LEVEL };
