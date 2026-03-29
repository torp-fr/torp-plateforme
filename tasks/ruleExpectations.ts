/**
 * Rule Expectations — Domain Completeness Configuration
 *
 * Defines what a GOOD extraction result looks like per document category.
 * Used by the validator, diagnoser, and fixer to detect and correct
 * domain-level gaps in extracted rule sets.
 *
 * ── Architecture ────────────────────────────────────────────────────────────
 *
 *   Rule type taxonomy used here maps to the actual `rule_type` values
 *   produced by the category extractors, PLUS derived sub-types that are
 *   computed from `structured_data` fields:
 *
 *   Extractor output (rule_type field)
 *   ─────────────────────────────────
 *   constraint       DTU / NORMES — quantitative dimensional rules
 *                    Example: "L'épaisseur minimale est de 50 mm"
 *
 *   formula          EUROCODE — coefficient assignments and inequalities
 *                    Example: "γ_M0 = 1.00",  "N_Ed ≤ N_Rd"
 *
 *   recommendation   GUIDE_TECHNIQUE — non-binding best practices
 *                    Example: "Il est recommandé de…"
 *
 *   requirement      DTU / NORMES / CODE_CONSTRUCTION — qualitative obligations
 *                    Example: "Le support doit être…"
 *
 *   Derived sub-types (computed from structured_data analysis)
 *   ──────────────────────────────────────────────────────────
 *   constraint_with_tolerance
 *       A 'constraint' rule whose description or source contains a tolerance
 *       indicator (± symbol, "tolérance", "déviation admissible").
 *       Absence → tolerance extraction pass needed.
 *
 *   formula_with_coefficient
 *       A 'formula' rule where the extractor identified a named coefficient
 *       (property_key ≠ 'formula' — e.g. 'gamma_M0', 'f_yk').
 *       Absence → coefficient parsing pass needed.
 *
 *   formula_with_limit_state
 *       A 'formula' rule where structured_data.conditions.limit_state
 *       is set (ELU, ELS, ULS, SLS).
 *       Absence → limit state extraction pass needed.
 *
 *   requirement_with_article
 *       A 'requirement' rule where structured_data.conditions.article
 *       is set (legal article reference).
 *       Absence → legal reference extraction pass needed.
 *
 * ── Coverage logic ────────────────────────────────────────────────────────────
 *
 *   coverage_ratio = present_types.length / required_types.length
 *   meets_threshold = coverage_ratio >= expectation.min_coverage
 *
 *   A category passes domain validation when meets_threshold === true.
 *   A category with all required types present has coverage_ratio = 1.0.
 */

import type { TaskCategory } from './taskRegistry';
import type { ExtractedRule } from '@/services/ruleExtraction.service';

// =============================================================================
// Types
// =============================================================================

/**
 * A single required rule type for a category.
 * The id must be a value the sub-type distribution can contain.
 */
export interface RequiredRuleType {
  /** Identifier — matches a key in the sub-type distribution */
  id: string;
  /** Human-readable French label */
  label: string;
  /**
   * One-sentence domain description of what this type captures.
   * Used in diagnoser messages and fix context.
   */
  description: string;
  /** Representative examples from actual source documents */
  examples: string[];
  /**
   * Diagnosis code raised when this type is absent.
   * Mapped to a targeted fix strategy by the diagnoser.
   */
  missing_diagnosis: DomainDiagnosisCode;
  /**
   * Fix strategy to apply when this type is absent.
   * The fixer uses this to select the correct extraction emphasis.
   */
  missing_fix: DomainFixStrategy;
}

/** Diagnosis codes specific to domain coverage failures */
export type DomainDiagnosisCode =
  | 'MISSING_TOLERANCE_RULES'    // DTU/NORMES: no constraint_with_tolerance
  | 'MISSING_EXECUTION_RULES'    // DTU/NORMES: no requirement (execution conditions)
  | 'MISSING_LEGAL_REFERENCES'   // CODE_CONSTRUCTION: no requirement_with_article
  | 'MISSING_COEFFICIENTS'       // EUROCODE: no formula_with_coefficient
  | 'MISSING_LIMIT_STATES'       // EUROCODE: no formula_with_limit_state
  | 'MISSING_CONSTRAINT_RULES'   // DTU/NORMES: no constraint (dimensional rules)
  | 'MISSING_RECOMMENDATION_RULES' // GUIDE_TECHNIQUE: no recommendation
  | 'INSUFFICIENT_DOMAIN_COVERAGE'; // generic: coverage_ratio < min_coverage

/** Fix strategies specific to domain coverage improvements */
export type DomainFixStrategy =
  | 'EMPHASIZE_TOLERANCES'         // Lower length threshold + full supplemental for tolerance patterns
  | 'EMPHASIZE_EXECUTION_CONDITIONS' // Full supplemental pass targeting conditions/sequencing
  | 'FORCE_LEGAL_EXTRACTION'       // Full supplemental + legal-reference focus
  | 'EMPHASIZE_COEFFICIENTS'       // Full supplemental targeting coefficient patterns
  | 'EMPHASIZE_LIMIT_STATES'       // Full supplemental targeting ELU/ELS patterns
  | 'DOMAIN_FULL_SUPPLEMENTAL';    // Generic: full supplemental pass to surface missed types

/** Per-category domain completeness expectation */
export interface CategoryExpectation {
  category: TaskCategory;
  /** Human-readable intent of this category's extraction */
  description: string;
  /** Rule types that must be present for the batch to be considered domain-complete */
  required_rule_types: RequiredRuleType[];
  /**
   * Minimum fraction of required_rule_types that must be present.
   * 1.0 = all must be present.
   * 0.67 = at least 2 of 3 must be present (useful when one sub-type is optional).
   */
  min_coverage: number;
}

/** Output of computeDomainCoverage() — consumed by validator + diagnoser */
export interface DomainCoverageResult {
  category: string;
  /** Expected rule type ids from the category expectation */
  expected_rule_types: string[];
  /** Expected type ids that were found in the batch (count > 0) */
  present_rule_types: string[];
  /** Expected type ids with count === 0 */
  missing_rule_types: string[];
  /** present / expected */
  coverage_ratio: number;
  /** Percentage for logging: Math.round(coverage_ratio * 100) */
  coverage_percentage: number;
  /** True when coverage_ratio >= expectation.min_coverage */
  meets_threshold: boolean;
  /** Min coverage threshold from the expectation */
  min_coverage: number;
  /** Per-type count map (all types, not just required ones) */
  sub_type_distribution: Record<string, number>;
}

// =============================================================================
// Tolerance pattern detection
// =============================================================================

/**
 * Patterns that indicate a constraint rule carries a tolerance specification.
 * Matches: ±5 mm, "tolérance ±", "déviation admissible", "±0.5%", "tolér"
 */
const TOLERANCE_RE = /[±]|toler[ae]n|d[eé]viation\s+admissible|[eé]cart\s+admissible/i;

// =============================================================================
// Sub-type distribution computation
// =============================================================================

/**
 * Compute the domain sub-type distribution from a list of extracted rules.
 *
 * Returns counts per type:
 *   - Basic types: 'constraint', 'formula', 'recommendation', 'requirement'
 *   - Derived types: 'constraint_with_tolerance', 'formula_with_coefficient',
 *     'formula_with_limit_state', 'requirement_with_article'
 *
 * @param rules - Post-dedup extracted rules from TaskRunResult
 */
export function computeSubTypeDistribution(rules: ExtractedRule[]): Record<string, number> {
  const counts: Record<string, number> = {};

  const inc = (key: string): void => {
    counts[key] = (counts[key] ?? 0) + 1;
  };

  for (const rule of rules) {
    // Basic rule type
    inc(rule.rule_type);

    // Cast structured_data to access nested fields
    const sd = rule.structured_data as Record<string, unknown> | undefined;

    if (rule.rule_type === 'formula') {
      // formula_with_coefficient: the extractor resolved a real property key
      // (not the generic fallback 'formula')
      const propertyKey = sd?.property_key as string | undefined;
      if (propertyKey && propertyKey !== 'formula' && propertyKey !== 'n/a') {
        inc('formula_with_coefficient');
      }

      // formula_with_limit_state: ELU/ELS/ULS/SLS in conditions
      const conditions = sd?.conditions as Record<string, unknown> | undefined;
      if (conditions?.limit_state) {
        inc('formula_with_limit_state');
      }
    }

    if (rule.rule_type === 'requirement') {
      // requirement_with_article: legal article reference extracted
      const conditions = sd?.conditions as Record<string, unknown> | undefined;
      if (conditions?.article) {
        inc('requirement_with_article');
      }
    }

    if (rule.rule_type === 'constraint') {
      // constraint_with_tolerance: tolerance indicator in description or source
      if (TOLERANCE_RE.test(rule.description) || TOLERANCE_RE.test(rule.source_sentence)) {
        inc('constraint_with_tolerance');
      }
    }
  }

  return counts;
}

// =============================================================================
// Expectations per category
// =============================================================================

export const RULE_EXPECTATIONS: Readonly<Record<TaskCategory, CategoryExpectation>> = {

  // ── DTU ───────────────────────────────────────────────────────────────────
  DTU: {
    category:    'DTU',
    description: 'Documents Techniques Unifiés — exigences dimensionnelles, matériaux, mise en œuvre',
    required_rule_types: [
      {
        id:          'constraint',
        label:       'Contraintes dimensionnelles',
        description: 'Règles quantitatives avec valeur numérique : épaisseurs, pentes, longueurs, résistances.',
        examples:    [
          "L'épaisseur minimale de la chape flottante est de 50 mm (DTU 26.2)",
          "La pente minimale est de 1,5 % (DTU 43.1)",
        ],
        missing_diagnosis: 'MISSING_CONSTRAINT_RULES',
        missing_fix:       'DOMAIN_FULL_SUPPLEMENTAL',
      },
      {
        id:          'requirement',
        label:       'Conditions d\'exécution',
        description: 'Règles qualitatives sur la séquence, la préparation du support, les conditions climatiques.',
        examples:    [
          "Le support doit être exempt de toute trace d'huile avant application",
          "La mise en œuvre ne peut être effectuée par température inférieure à +5 °C",
        ],
        missing_diagnosis: 'MISSING_EXECUTION_RULES',
        missing_fix:       'EMPHASIZE_EXECUTION_CONDITIONS',
      },
      {
        id:          'constraint_with_tolerance',
        label:       'Tolérances dimensionnelles',
        description: 'Contraintes portant une tolérance explicite (±, déviation admissible, écart toléré).',
        examples:    [
          "La planéité du support ne doit pas dépasser ±3 mm sous la règle de 2 m",
          "Tolérance sur épaisseur : ±5 mm",
        ],
        missing_diagnosis: 'MISSING_TOLERANCE_RULES',
        missing_fix:       'EMPHASIZE_TOLERANCES',
      },
    ],
    min_coverage: 0.67, // at least 2 of 3 types required; tolerance is highly desirable
  },

  // ── EUROCODE ──────────────────────────────────────────────────────────────
  EUROCODE: {
    category:    'EUROCODE',
    description: 'Eurocodes structuraux — formules de dimensionnement, coefficients partiels, états limites',
    required_rule_types: [
      {
        id:          'formula',
        label:       'Formules et expressions de calcul',
        description: 'Formules structurales : inégalités de dimensionnement, assignations de valeur.',
        examples:    [
          "N_Ed ≤ N_c,Rd",
          "f_cd = f_ck / γ_C",
        ],
        missing_diagnosis: 'INSUFFICIENT_DOMAIN_COVERAGE',
        missing_fix:       'DOMAIN_FULL_SUPPLEMENTAL',
      },
      {
        id:          'formula_with_coefficient',
        label:       'Coefficients partiels de sécurité',
        description: 'Assignations de valeur pour les coefficients γ, λ, ψ, φ (facteurs partiels).',
        examples:    [
          "γ_M0 = 1,00",
          "γ_C = 1,50 pour le béton en situation fondamentale",
        ],
        missing_diagnosis: 'MISSING_COEFFICIENTS',
        missing_fix:       'EMPHASIZE_COEFFICIENTS',
      },
      {
        id:          'formula_with_limit_state',
        label:       'États limites (ELU / ELS)',
        description: 'Règles référençant explicitement l\'état limite ultime (ELU) ou de service (ELS).',
        examples:    [
          'Vérification à l'ELU : M_Ed / M_Rd ≤ 1',
          'La flèche à l'ELS ne doit pas dépasser L/500',
        ],
        missing_diagnosis: 'MISSING_LIMIT_STATES',
        missing_fix:       'EMPHASIZE_LIMIT_STATES',
      },
    ],
    min_coverage: 0.67, // at least 2 of 3 types required
  },

  // ── NORMES ────────────────────────────────────────────────────────────────
  NORMES: {
    category:    'NORMES',
    description: 'Normes NF / EN — seuils de performance, classifications, exigences de marquage',
    required_rule_types: [
      {
        id:          'constraint',
        label:       'Seuils de performance',
        description: 'Valeurs numériques de performance : résistance thermique, affaiblissement acoustique, résistance au feu.',
        examples:    [
          'La résistance à la compression doit être ≥ 3 MPa (NF EN 13813)',
          'L'indice d'affaiblissement acoustique Rw doit être ≥ 45 dB',
        ],
        missing_diagnosis: 'MISSING_CONSTRAINT_RULES',
        missing_fix:       'DOMAIN_FULL_SUPPLEMENTAL',
      },
      {
        id:          'requirement',
        label:       'Exigences de classification',
        description: 'Obligations qualitatives sur les classes de produit, certification, marquage CE.',
        examples:    [
          'Le produit doit être certifié NF ou disposer d'un Avis Technique',
          'Le carrelage doit présenter un marquage CE conforme NF EN 14411',
        ],
        missing_diagnosis: 'MISSING_EXECUTION_RULES',
        missing_fix:       'EMPHASIZE_EXECUTION_CONDITIONS',
      },
    ],
    min_coverage: 0.50, // at least 1 of 2 — classification reqs may be sparse
  },

  // ── GUIDE_TECHNIQUE ───────────────────────────────────────────────────────
  GUIDE_TECHNIQUE: {
    category:    'GUIDE_TECHNIQUE',
    description: 'Guides techniques et avis — recommandations de bonnes pratiques',
    required_rule_types: [
      {
        id:          'recommendation',
        label:       'Recommandations de bonnes pratiques',
        description: 'Conseils non-contractuels : "il est recommandé", "de préférence", "il convient de".',
        examples:    [
          'Il est recommandé d'appliquer une couche primaire avant l'enduit',
          'De préférence, le jointoiement sera effectué 24 h après la pose',
        ],
        missing_diagnosis: 'MISSING_RECOMMENDATION_RULES',
        missing_fix:       'DOMAIN_FULL_SUPPLEMENTAL',
      },
    ],
    min_coverage: 1.0, // only 1 required type — must be present
  },

  // ── CODE_CONSTRUCTION ─────────────────────────────────────────────────────
  CODE_CONSTRUCTION: {
    category:    'CODE_CONSTRUCTION',
    description: 'Code de la construction — obligations légales, décrets, articles réglementaires',
    required_rule_types: [
      {
        id:          'requirement',
        label:       'Obligations légales',
        description: 'Exigences de conformité à caractère légal : "est obligatoire", "est exigé", "est prescrit".',
        examples:    [
          'L'isolation thermique est obligatoire pour tout bâtiment neuf',
          'Les installations électriques doivent impérativement être conformes à la NF C 15-100',
        ],
        missing_diagnosis: 'MISSING_EXECUTION_RULES',
        missing_fix:       'FORCE_LEGAL_EXTRACTION',
      },
      {
        id:          'requirement_with_article',
        label:       'Références légales (articles, décrets)',
        description: 'Obligations citant une référence normative explicite : Article R., Décret n°, Code CCH.',
        examples:    [
          'Conformément à l'Article R. 111-2 du Code de la Construction',
          'En application du Décret n° 2016-1736 du 14 décembre 2016',
        ],
        missing_diagnosis: 'MISSING_LEGAL_REFERENCES',
        missing_fix:       'FORCE_LEGAL_EXTRACTION',
      },
    ],
    min_coverage: 0.50, // at least 1 of 2 — article refs may not appear in all chunks
  },
};

// =============================================================================
// Coverage computation
// =============================================================================

/**
 * Compute the domain coverage result for a category.
 *
 * @param subTypeDistribution - Output of computeSubTypeDistribution()
 * @param category            - The document category being validated
 * @returns DomainCoverageResult with present/missing types and coverage ratio
 */
export function computeDomainCoverage(
  subTypeDistribution: Record<string, number>,
  category:            TaskCategory,
): DomainCoverageResult {
  const expectation   = RULE_EXPECTATIONS[category];
  const requiredTypes = expectation.required_rule_types.map((r) => r.id);

  const present_rule_types: string[] = [];
  const missing_rule_types: string[] = [];

  for (const typeId of requiredTypes) {
    const count = subTypeDistribution[typeId] ?? 0;
    if (count > 0) {
      present_rule_types.push(typeId);
    } else {
      missing_rule_types.push(typeId);
    }
  }

  const coverage_ratio = requiredTypes.length > 0
    ? present_rule_types.length / requiredTypes.length
    : 1.0;

  return {
    category,
    expected_rule_types:  requiredTypes,
    present_rule_types,
    missing_rule_types,
    coverage_ratio:       Math.round(coverage_ratio * 1000) / 1000,
    coverage_percentage:  Math.round(coverage_ratio * 100),
    meets_threshold:      coverage_ratio >= expectation.min_coverage,
    min_coverage:         expectation.min_coverage,
    sub_type_distribution: subTypeDistribution,
  };
}

/**
 * Format a domain coverage result as a human-readable log line.
 * Used in the task loop for per-run domain coverage logging.
 */
export function formatDomainCoverage(result: DomainCoverageResult): string {
  const present = result.present_rule_types.join(', ') || 'none';
  const missing = result.missing_rule_types.length > 0
    ? ` | MISSING: ${result.missing_rule_types.join(', ')}`
    : '';

  return (
    `[DOMAIN] ${result.category} coverage=${result.coverage_percentage}%` +
    ` (${result.present_rule_types.length}/${result.expected_rule_types.length} types)` +
    ` present=[${present}]${missing}` +
    ` threshold=${Math.round(result.min_coverage * 100)}%` +
    ` meets=${result.meets_threshold}`
  );
}
