/**
 * Decision Builder
 *
 * Converts raw rule rows into normalized ProtoDecisions.
 * Filters to actionable_numeric rules only, normalizes fields,
 * and maps operators to semantic rule types.
 *
 * Tone: advisory — never punitive.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Raw row shape from the rules table (only fields we consume). */
export interface RuleRow {
  property: string | null;
  /** Canonical key from PROPERTY_REGISTRY — e.g. "epaisseur", "resistance_feu". */
  property_key: string | null;
  /** Category from PROPERTY_REGISTRY — e.g. "dimension", "structure", "thermal". */
  property_category: string | null;
  operator: string | null;
  value: number | string | null;
  unit: string | null;
  element: string | null;
  domain: string | null;
  /** Document category — e.g. "EUROCODE", "DTU", "NORMES". Controls filter strategy. */
  category: string | null;
  classification: string | null;
  confidence_score: number | null;
  source_document_id: string | null;
  /** Raw rule description — used for formula-style detection. */
  description: string | null;
}

export interface ProtoDecision {
  element?: string;
  domain: string;
  property: string;
  ruleType: "min" | "max" | "exact" | "range";
  value: number;
  unit?: string;
  confidence: number;
  source: string;
  interpretationHint: string;
  tone: "advisory";
  ruleOrigin: string;
  applicabilityScope?: string | null;
  /** Authority weight: 1.0 = DTU (execution), 0.9 = code (legal), 0.8 = normes, 0.6 = guide, 0.5 = Eurocode (calculation) */
  priority: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * Canonical property keys accepted by the decision engine.
 * Must mirror PROPERTY_REGISTRY exactly — source of truth is propertyRegistry.ts.
 */
const PROPERTY_REGISTRY_KEYS = new Set([
  // dimension
  'epaisseur', 'largeur', 'longueur', 'hauteur', 'diametre',
  'section', 'pente', 'courbure',
  // thermal
  'resistance_thermique', 'conductivite_thermique', 'inertie_thermique', 'deperdition',
  // structure
  'resistance_mecanique', 'resistance_compression', 'resistance_traction',
  'module_elasticite', 'densite', 'rigidite', 'fluage', 'retrait',
  // hydraulic
  'debit', 'pression', 'vitesse_eau', 'permeabilite',
  // electrical
  'puissance_electrique', 'tension', 'intensite', 'impedance',
  // acoustic
  'isolation_acoustique', 'affaiblissement_acoustique', 'impact',
  // geometry
  'inclinaison', 'rayon_courbure',
  // fire
  'reaction_feu', 'resistance_feu', 'densite_fumee',
  // energy
  'consommation_energie', 'etiquette_energetique',
  // fixation
  'resistance_fixation', 'espacement_fixation',
]);

/**
 * Matches 1–3 letter tokens that are Eurocode variable names (k, c, Rd, fck…).
 * A legitimate property_key is always a full French descriptor — never a symbol.
 */
const VARIABLE_PATTERN = /^[a-zA-Z]{1,3}$/;

/**
 * Known Eurocode structural mechanics symbols.
 * Their presence in a description signals a variable definition or formula,
 * not a measurable construction constraint.
 */
const EUROCODE_SYMBOLS = [
  'fck', 'fyk', 'ved', 'vrd', 'ned', 'med',
  'k', 'c', 'n', 'm', 'x', 'y', 'z',
];

// ---------------------------------------------------------------------------
// Context-aware priority
// ---------------------------------------------------------------------------

export type BuildingType = 'maison' | 'erp' | 'industrie' | 'autre';

/**
 * Minimal project context consumed by the decision layer.
 * Kept separate from the full ProjectContext to avoid coupling the decision
 * module to the persistence layer.
 */
export type DecisionContext = {
  buildingType?: BuildingType;
};

/**
 * Base authority weight by document category.
 * Reflects regulatory hierarchy in French construction law:
 *   DTU    → technical execution standard (highest authority for on-site work)
 *   CODE   → legal constraint (slightly higher than DTU for compliance work)
 *   NORMES → harmonised standard (solid, broadly applicable)
 *   GUIDE  → advisory technical guide
 *   EUROCODE → structural calculation framework (least applicable to fieldwork)
 */
const BASE_PRIORITY: Record<string, number> = {
  DTU: 1.0,
  CODE_CONSTRUCTION: 1.1,
  NORMES: 0.8,
  GUIDE_TECHNIQUE: 0.6,
  EUROCODE: 0.5,
};

/**
 * Context multipliers: boost authority of the most relevant document category
 * for a given building type.
 *
 *   erp       → legal code dominates (safety / accessibility obligations)
 *   maison    → DTU dominates (execution standard for residential work)
 *   industrie → Eurocode more applicable (structural engineering context)
 */
function getContextMultiplier(
  category: string | null | undefined,
  context: DecisionContext | undefined
): number {
  if (!context?.buildingType) return 1.0;

  const bt = context.buildingType.toLowerCase();
  const cat = category ?? '';

  if (bt === 'erp'      && cat === 'CODE_CONSTRUCTION') return 1.5;
  if (bt === 'maison'   && cat === 'DTU')               return 1.3;
  if (bt === 'industrie'&& cat === 'EUROCODE')          return 1.3;

  return 1.0;
}

function computePriority(
  category: string | null | undefined,
  context: DecisionContext | undefined
): number {
  const base = BASE_PRIORITY[category ?? ''] ?? 0.7;
  return base * getContextMultiplier(category, context);
}

const OPERATOR_MAP: Record<string, ProtoDecision["ruleType"]> = {
  ">=": "min",
  ">": "min",
  "<=": "max",
  "<": "max",
  "=": "exact",
  "==": "exact",
  range: "range",
};

const INTERPRETATION_HINTS: Record<ProtoDecision["ruleType"], string> = {
  min: "minimum expected value based on standard practices",
  max: "maximum recommended limit",
  exact: "target value defined by standard",
  range: "acceptable value range",
};

// ---------------------------------------------------------------------------
// Private helpers
// ---------------------------------------------------------------------------

/**
 * Reject reasons — used only for the debug log, never exposed to callers.
 * Prefixed with the strategy that raised them.
 */
type RejectReason =
  // ── Shared (all strategies) ──────────────────────────────────────────────
  | 'non_actionable_classification' // must be 'actionable_numeric'
  | 'no_property'
  | 'no_value'
  | 'no_operator'
  | 'unrecognized_property_key'   // F0: not in PROPERTY_REGISTRY
  | 'variable_pattern'            // F1: 1-3 letter symbol (k, c, Rd…)
  // ── Eurocode-only ────────────────────────────────────────────────────────
  | 'eurocode:formula_description' // F2: description looks like a variable definition
  | 'eurocode:symbol_in_desc'      // F3: known Eurocode variable in description
  | 'eurocode:no_unit_non_dim';    // F5: no unit outside dimension category

// ---------------------------------------------------------------------------
// Shared baseline (applies to ALL document categories)
// ---------------------------------------------------------------------------

/**
 * Basic quality gate shared by every filter strategy.
 * Returns the reject reason, or null if the rule passes baseline checks.
 */
function _baselineReject(rule: RuleRow): RejectReason | null {
  // Classification gate — only rules explicitly marked actionable_numeric
  // (mapped from DB rule_type via ACTIONABLE_RULE_TYPES in rule.engine.ts)
  // enter the decision pipeline.
  if (rule.classification !== 'actionable_numeric') {
    return 'non_actionable_classification';
  }

  // Nullability
  if (rule.property === null || rule.property === 'n/a') return 'no_property';
  if (rule.value === null)                                return 'no_value';
  if (rule.operator === null || rule.operator === 'unknown') return 'no_operator';

  // F0 — property_key must map to a known PROPERTY_REGISTRY entry.
  // This is mandatory for all categories because an unrecognized key means
  // the extraction pipeline could not identify the measured property.
  if (!rule.property_key || !PROPERTY_REGISTRY_KEYS.has(rule.property_key)) {
    return 'unrecognized_property_key';
  }

  // F1 — PROPERTY_REGISTRY keys are full French descriptors ("epaisseur",
  // "resistance_feu"). A 1–3 letter result means the extractor captured an
  // abbreviation or Eurocode symbol — never a valid property key.
  if (VARIABLE_PATTERN.test(rule.property_key)) return 'variable_pattern';

  return null;
}

// ---------------------------------------------------------------------------
// Strategy A — Eurocode (strict)
// ---------------------------------------------------------------------------

/**
 * Eurocode documents contain structural calculation parameters, variable
 * definitions, and safety factors. The vast majority are NOT actionable
 * construction constraints. Apply aggressive semantic filtering.
 */
function _eurocodeReject(rule: RuleRow): RejectReason | null {
  const base = _baselineReject(rule);
  if (base !== null) return base;

  // F2 — Formula-style descriptions: "fyk = 500 MPa", "Rd = 1,00" etc.
  // These define calculation variables, not measurable on-site values.
  // Pattern: a 1-3 letter token immediately before "=".
  if (
    rule.description?.includes('=') &&
    /[a-zA-Z]{1,3}\s*=/.test(rule.description)
  ) {
    return 'eurocode:formula_description';
  }

  // F3 — Known Eurocode structural symbols in the description signal that
  // the rule lives inside a structural mechanics expression, not a field spec.
  // Check for the symbol followed by a space or "=" to avoid false matches
  // on longer French words containing these substrings.
  if (rule.description) {
    const descLower = rule.description.toLowerCase();
    if (
      EUROCODE_SYMBOLS.some(
        (sym) => descLower.includes(`${sym} `) || descLower.includes(`${sym}=`)
      )
    ) {
      return 'eurocode:symbol_in_desc';
    }
  }

  // F5 — A rule without a unit outside the dimension category is almost
  // certainly a dimensionless Eurocode coefficient (partial safety factor,
  // combination factor, etc.) rather than a measurable construction value.
  if (rule.unit === null && rule.property_category !== 'dimension') {
    return 'eurocode:no_unit_non_dim';
  }

  return null;
}

// ---------------------------------------------------------------------------
// Strategy B — Standard (DTU, NORMES, GUIDE_TECHNIQUE, CODE_CONSTRUCTION)
// ---------------------------------------------------------------------------

/**
 * Specification documents (DTU, NF norms, technical guides) state concrete
 * requirements in plain language: "épaisseur minimale 120 mm", "pente ≥ 3%".
 * These should pass through with maximum recall — apply only the shared
 * baseline and no Eurocode-specific semantic checks.
 *
 * Not applied:
 *  - F2 (formula_description): DTU can legitimately write "épaisseur = 120 mm"
 *  - F3 (eurocode_symbol): overlapping vocabulary with technical French text
 *  - F5 (no_unit_non_dim): dimensionless DTU constraints (slopes, ratios) are valid
 */
function _standardReject(rule: RuleRow): RejectReason | null {
  return _baselineReject(rule);
}

// ---------------------------------------------------------------------------
// Dispatcher
// ---------------------------------------------------------------------------

const EUROCODE_CATEGORIES = new Set(['EUROCODE']);

function _rejectReason(rule: RuleRow): RejectReason | null {
  return EUROCODE_CATEGORIES.has(rule.category ?? '')
    ? _eurocodeReject(rule)
    : _standardReject(rule);
}


function normalizeString(value: string | null | undefined): string | undefined {
  if (value == null) return undefined;
  const trimmed = value.trim().toLowerCase();
  return trimmed.length > 0 ? trimmed : undefined;
}

function mapOperator(
  operator: string | null
): ProtoDecision["ruleType"] | null {
  if (operator == null) return null;
  return OPERATOR_MAP[operator.trim()] ?? null;
}

function parseValue(raw: number | string | null): number | null {
  if (raw === null) return null;
  const parsed = typeof raw === "number" ? raw : parseFloat(raw);
  return isNaN(parsed) ? null : parsed;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Convert a list of raw rule rows into normalized ProtoDecisions.
 * Rows that fail filtering or normalization are silently skipped.
 */
export function buildDecisions(rules: RuleRow[], context?: DecisionContext): ProtoDecision[] {
  // Proof-of-execution trace — must appear in logs whenever the pipeline runs.
  console.log('[DECISION_BUILDER_ACTIVE]', rules.length);

  // Collect per-filter rejection counts for observability
  const rejectCounts: Record<string, number> = {};
  const actionable = rules.filter((rule) => {
    const reason = _rejectReason(rule);
    if (reason !== null) {
      rejectCounts[reason] = (rejectCounts[reason] ?? 0) + 1;
      return false;
    }
    return true;
  });

  console.log(
    `[DecisionBuilder] actionable rules: ${actionable.length}/${rules.length}`,
    Object.keys(rejectCounts).length > 0 ? { rejected: rejectCounts } : ''
  );

  const decisions: ProtoDecision[] = [];

  for (const rule of actionable) {

    const ruleType = mapOperator(rule.operator);
    if (ruleType === null) continue;

    const value = parseValue(rule.value);
    if (value === null) continue;

    const property = normalizeString(rule.property);
    if (!property) continue;

    decisions.push({
      property,
      ruleType,
      value,
      tone: "advisory",
      domain: normalizeString(rule.domain) ?? "unknown",
      source: rule.source_document_id ?? "",
      ruleOrigin: rule.source_document_id ?? "",
      confidence: rule.confidence_score ?? 0,
      interpretationHint: INTERPRETATION_HINTS[ruleType],
      priority: computePriority(rule.category, context),
      ...(normalizeString(rule.element) && {
        element: normalizeString(rule.element),
      }),
      ...(normalizeString(rule.unit) && { unit: normalizeString(rule.unit) }),
    });
  }

  return decisions.sort((a, b) =>
    `${a.domain}${a.element ?? ""}${a.property}`.localeCompare(
      `${b.domain}${b.element ?? ""}${b.property}`
    )
  );
}

/**
 * Group ProtoDecisions by a composite key: `element|property|unit`.
 * Used as input to the Decision Resolver.
 */
export function groupDecisionsByKey(
  decisions: ProtoDecision[]
): Record<string, ProtoDecision[]> {
  const groups: Record<string, ProtoDecision[]> = {};

  for (const d of decisions) {
    const key = `${d.element ?? ""}|${d.property}|${d.unit ?? ""}`;
    (groups[key] ??= []).push(d);
  }

  return groups;
}
