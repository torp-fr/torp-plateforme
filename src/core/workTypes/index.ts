/**
 * Work Type Engine — barrel export
 *
 * Public surface:
 *
 *   Types:
 *     WorkType, WORK_TYPES
 *     DetectedWorkType, ActivatedRule, WorkTypeActivationResult, ActivationSummary
 *     VerifiabilityStatus, RequiredContext
 *
 *   Detection:
 *     detectWorkTypes(text)          → DetectedWorkType[]
 *     normalizeText(text)            → string
 *     DETECTION_THRESHOLD            → 0.15
 *
 *   Activation:
 *     activateRules(supabase, workTypes, text)  → Promise<ActivatedRule[]>
 *     runWorkTypeActivationPipeline(supabase, text) → Promise<WorkTypeActivationResult>
 *     detectPresentContext(text)     → Set<string>
 *     buildActivatedRuleFromRow(row, workType, ctx) → ActivatedRule
 *
 *   Keyword data:
 *     WORK_TYPE_KEYWORDS             — keyword/phrase map per WorkType
 *     maxScoreForWorkType(type)      → number
 *
 *   Rules map:
 *     WORK_TYPE_RULES_MAP            — property_keys/domains/categories/context per WorkType
 */

// ── Types ──────────────────────────────────────────────────────────────────
export type {
  WorkType,
  DetectedWorkType,
  ActivatedRule,
  WorkTypeActivationResult,
  ActivationSummary,
  VerifiabilityStatus,
  RequiredContext,
} from './workTypes';

export { WORK_TYPES } from './workTypes';

// ── Detection ──────────────────────────────────────────────────────────────
export {
  detectWorkTypes,
  normalizeText,
  DETECTION_THRESHOLD,
} from './workTypeDetection.service';

// ── Activation ─────────────────────────────────────────────────────────────
export {
  activateRules,
  runWorkTypeActivationPipeline,
  detectPresentContext,
  buildActivatedRuleFromRow,
} from './ruleActivation.service';

// ── Keyword data ───────────────────────────────────────────────────────────
export {
  WORK_TYPE_KEYWORDS,
  PHRASE_WEIGHT,
  KEYWORD_WEIGHT,
  maxScoreForWorkType,
} from './workTypeKeywords';

// ── Rules map ──────────────────────────────────────────────────────────────
export { WORK_TYPE_RULES_MAP } from './workTypeRulesMap';
export type { WorkTypeRuleSpec } from './workTypeRulesMap';
