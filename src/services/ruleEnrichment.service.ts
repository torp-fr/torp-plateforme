/**
 * Rule Enrichment Service
 *
 * Post-extraction enrichment layer: takes an ExtractedRule produced by
 * ruleExtraction.service and decorates it with enforcement metadata and
 * contextual interpretation fields.
 *
 * This layer is:
 *   - Pure (no DB calls, no side effects)
 *   - Deterministic (same input → same output)
 *   - Additive (never mutates extraction fields)
 *
 * Applied AFTER extraction, BEFORE DB persistence — inside the worker.
 *
 * Fields added to each rule
 * ─────────────────────────────────────────────────────────────────────────
 * Original enrichment fields (migration 20260317000004):
 *   enforcement_level  — regulatory weight derived from document category
 *   flexibility_score  — 0 (rigid) → 1 (flexible), mirrors enforcement_level
 *   contextual         — true when the rule's applicability depends on context
 *   applicability      — structured context conditions (project type, location…)
 *
 * Contextual interpretation fields (migration 20260320000002):
 *   strictness             — granular regulatory weight (very_high → low)
 *   tolerance              — acceptable deviation for dimensional rules
 *   adaptable              — whether a derogation path exists
 *   risk_level             — project risk if rule is not respected
 *   justification_required — whether non-compliance requires written justification
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
// ── Original types (unchanged) ───────────────────────────────────────────────
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

// =============================================================================
// ── New types (contextual interpretation) ────────────────────────────────────
// =============================================================================

/**
 * Granular regulatory weight.
 *
 *   very_high — CODE_CONSTRUCTION (statute) / EUROCODE (structural safety)
 *   high      — DTU (contractual) / NORMES (certification)
 *   medium    — GUIDE_TECHNIQUE (best practice)
 *   low       — informative / indicative sources
 */
export type Strictness = 'very_high' | 'high' | 'medium' | 'low';

/**
 * Project risk if the rule is not respected.
 *
 *   high   — structural failure, legal sanction, permit refusal
 *   medium — quality defect, compliance gap, insurance issue
 *   low    — best-practice deviation, no direct sanction
 */
export type RiskLevel = 'low' | 'medium' | 'high';

/**
 * Acceptable deviation for a dimensional constraint.
 *
 * Only populated when the rule has a numeric value and a dimensional unit
 * (mm, cm, m, m², %). Null for qualitative, structural-load, or thermal rules.
 *
 * Percentage: 5% for very_high/high strictness, 10% for medium.
 * Rationale: DTU planarity tolerances are typically ±5 mm under 2 m straight-edge;
 * guide values carry more room for interpretation.
 */
export interface RuleTolerance {
  /** Computed tolerance value (e.g. 2 for 2 mm when nominal = 40 mm at 5%) */
  value:      number;
  /** Same unit as the rule nominal value */
  unit:       string;
  /** Percentage of the nominal value used to compute this tolerance */
  percentage: number;
  /** Human-readable derivation (for audit log) */
  basis:      string;
}

// =============================================================================
// ── Extended EnrichedRule ─────────────────────────────────────────────────────
// =============================================================================

/** ExtractedRule + all enrichment fields, ready for DB persistence */
export interface EnrichedRule extends ExtractedRule {
  // ── Original fields (migration 20260317000004) ──────────────────────────
  enforcement_level: EnforcementLevel;
  flexibility_score: number;
  contextual:        boolean;
  applicability:     RuleApplicability;
  /** Document category that produced this rule (e.g. 'DTU', 'EUROCODE'). */
  category:          string;

  // ── Contextual interpretation fields (migration 20260320000002) ─────────
  /** Granular regulatory weight of the source document category */
  strictness:             Strictness;
  /**
   * Acceptable dimensional deviation.
   * null  = non-dimensional rule (qualitative, load, thermal…)
   * value = { value, unit, percentage, basis }
   */
  tolerance:              RuleTolerance | null;
  /**
   * True when a legitimate derogation path exists:
   *   DTU           → Avis Technique or equivalent performance justification
   *   GUIDE         → case-by-case engineering decision
   *   EUROCODE      → false (structural calculation path is fixed)
   *   CODE_CONST.   → false (only legislative derogation, not engineering)
   */
  adaptable:              boolean;
  /** Project risk if this rule is not respected */
  risk_level:             RiskLevel;
  /**
   * True when non-compliance must be documented in writing.
   *   DTU   → true  (technical file required for deviation)
   *   NORMES → true  (equivalent performance must be proven)
   *   Others → false
   */
  justification_required: boolean;
}

// =============================================================================
// ── Original enforcement mapping (unchanged) ─────────────────────────────────
// =============================================================================

/**
 * Category → enforcement level.
 *
 * Keys are listed in canonical uppercase form (produced by normalizeCategory)
 * and legacy lowercase/mixed form (for backward compat with rules already in DB).
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
// ── New contextual-interpretation mappings ────────────────────────────────────
// =============================================================================

/** Category → strictness */
const STRICTNESS_MAP: Readonly<Record<string, Strictness>> = {
  CODE_CONSTRUCTION: 'very_high',
  EUROCODE:          'very_high',
  DTU:               'high',
  NORMES:            'high',
  GUIDE_TECHNIQUE:   'medium',
  JURISPRUDENCE:     'medium',
  PRIX_BTP:          'low',
};

/** Default strictness when category is unknown */
const DEFAULT_STRICTNESS: Strictness = 'high';

/**
 * Category → adaptable.
 *
 *   DTU           → true  (Avis Technique / equivalent-performance path)
 *   GUIDE         → true  (case-by-case engineering decision)
 *   EUROCODE      → false (calculation path is fixed; no engineering shortcut)
 *   CODE_CONST.   → false (only legislative derogation, not engineering judgment)
 *   NORMES        → false (pass/fail against standardized test)
 */
const ADAPTABLE_MAP: Readonly<Record<string, boolean>> = {
  CODE_CONSTRUCTION: false,
  EUROCODE:          false,
  DTU:               true,
  NORMES:            false,
  GUIDE_TECHNIQUE:   true,
  JURISPRUDENCE:     true,
  PRIX_BTP:          true,
};

/**
 * Category → justification_required.
 *
 *   DTU    → true  (technical deviation file required)
 *   NORMES → true  (equivalent performance must be documented)
 *   Others → false (no justification required or no justification possible)
 */
const JUSTIFICATION_MAP: Readonly<Record<string, boolean>> = {
  CODE_CONSTRUCTION: false,  // compliance is binary — no justification replaces law
  EUROCODE:          false,  // calculation is the justification; no separate document
  DTU:               true,
  NORMES:            true,
  GUIDE_TECHNIQUE:   false,
  JURISPRUDENCE:     false,
  PRIX_BTP:          false,
};

// =============================================================================
// ── Tolerance computation ─────────────────────────────────────────────────────
// =============================================================================

/**
 * Physical length / area / volume units for which a tolerance percentage is
 * meaningful. Structural loads (kN, MPa), thermal (W/m²K), acoustic (dB),
 * and energy (kWh) values are intentionally excluded: their tolerances are
 * defined by the standards themselves and must not be approximated.
 */
const DIMENSIONAL_UNITS: ReadonlySet<string> = new Set([
  'mm', 'cm', 'm', 'km', 'dm', 'μm',
  'mm²', 'cm²', 'm²', 'km²',
  'mm³', 'cm³', 'm³', 'dm³',
  '%',   // slopes, moisture content, mix ratios
]);

/**
 * Tolerance percentage by strictness.
 *
 * 5%  — very_high / high: DTU planarity is ±5 mm under 2 m; structural dims tight
 * 10% — medium: guide-technique values are advisory targets
 * 15% — low: informative/indicative values only
 */
const TOLERANCE_PERCENTAGE: Readonly<Record<Strictness, number>> = {
  very_high: 5,
  high:      5,
  medium:    10,
  low:       15,
};

/**
 * Compute acceptable deviation for a dimensional constraint.
 * Returns null when the rule is non-dimensional or has no numeric value.
 */
function computeTolerance(rule: ExtractedRule, strictness: Strictness): RuleTolerance | null {
  const sd = rule.structured_data;
  if (!sd) return null;

  const value = sd.value;
  const unit  = sd.unit?.toLowerCase().trim() ?? '';

  // No numeric value → no tolerance
  if (value === null || value === undefined || value === 0) return null;

  // Non-dimensional unit → no tolerance
  if (!unit || !DIMENSIONAL_UNITS.has(unit)) return null;

  const percentage     = TOLERANCE_PERCENTAGE[strictness];
  // Round to 2 decimal places to avoid floating-point noise
  const toleranceValue = Math.round(Math.abs(value) * percentage / 100 * 100) / 100;

  return {
    value:      toleranceValue,
    unit,
    percentage,
    basis: `${percentage}% of nominal ${value} ${unit} (strictness=${strictness})`,
  };
}

// =============================================================================
// ── Risk level computation ────────────────────────────────────────────────────
// =============================================================================

/**
 * Compute project risk based on strictness and whether the rule is contextual.
 *
 * Logic:
 *   very_high strictness          → high  (structural/legal: always high)
 *   high strictness + contextual  → medium (context may exempt the project)
 *   high strictness + not context → high  (unconditional execution obligation)
 *   medium strictness             → medium
 *   low strictness                → low
 *
 * The contextual modifier only applies at 'high' strictness because EUROCODE and
 * CODE_CONSTRUCTION obligations are high-risk even when context-dependent.
 */
function computeRiskLevel(strictness: Strictness, contextual: boolean): RiskLevel {
  if (strictness === 'very_high') return 'high';
  if (strictness === 'high')      return contextual ? 'medium' : 'high';
  if (strictness === 'medium')    return 'medium';
  return 'low';
}

// =============================================================================
// ── Original applicability detection (unchanged) ─────────────────────────────
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
// ── Public API ────────────────────────────────────────────────────────────────
// =============================================================================

/**
 * Enrich a single ExtractedRule with enforcement and contextual metadata.
 *
 * @param rule     - Rule produced by extractRulesFromChunk()
 * @param category - Document category from knowledge_documents (e.g. 'DTU')
 * @returns EnrichedRule — all original fields preserved, enrichment fields appended
 */
export function enrichRule(rule: ExtractedRule, category: string): EnrichedRule {
  const cat = category.toUpperCase();

  // ── Original enrichment ────────────────────────────────────────────────────
  const enforcement_level = ENFORCEMENT_MAP[cat] ?? DEFAULT_ENFORCEMENT;
  const flexibility_score = FLEXIBILITY_BY_LEVEL[enforcement_level];
  const applicability     = buildApplicability(rule);
  const contextual        = isContextual(rule, applicability);

  // ── Contextual interpretation ──────────────────────────────────────────────
  const strictness             = STRICTNESS_MAP[cat]      ?? DEFAULT_STRICTNESS;
  const tolerance              = computeTolerance(rule, strictness);
  const adaptable              = ADAPTABLE_MAP[cat]       ?? false;
  const risk_level             = computeRiskLevel(strictness, contextual);
  const justification_required = JUSTIFICATION_MAP[cat]   ?? false;

  return {
    ...rule,
    category,
    // Original
    enforcement_level,
    flexibility_score,
    contextual,
    applicability,
    // New
    strictness,
    tolerance,
    adaptable,
    risk_level,
    justification_required,
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
export { ENFORCEMENT_MAP, FLEXIBILITY_BY_LEVEL, STRICTNESS_MAP, ADAPTABLE_MAP, JUSTIFICATION_MAP };
