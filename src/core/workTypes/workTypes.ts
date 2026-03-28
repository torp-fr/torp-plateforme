/**
 * Work Type System — Core Types
 *
 * A WorkType represents a construction trade operation (corps d'état)
 * that can be detected from quote text. It is the primary key for
 * activating applicable DTU / Eurocode / Normes rules.
 *
 * Design: WorkType is narrower than a document category (DTU, EUROCODE…)
 * and broader than a single rule property_key. It is the bridge between
 * free-text quote descriptions and the structured rule corpus.
 *
 * Taxonomy: French BTP corps d'état
 */

// =============================================================================
// Work Type Enum
// =============================================================================

export const WORK_TYPES = [
  'CHAPE',           // Chapes et ragréages (DTU 26.2)
  'TOITURE',         // Couvertures, zinguerie, toiture en pente
  'ISOLATION',       // Isolation thermique et acoustique (DTU 45.x)
  'MENUISERIE',      // Fenêtres, portes, volets (DTU 36.x, 37.x)
  'FONDATION',       // Fondations superficielles et profondes (DTU 13.x)
  'STRUCTURE',       // Béton armé, voiles, poteaux, poutres
  'REVETEMENT_SOL',  // Parquet, stratifié, sol souple (DTU 53.x)
  'ENDUIT',          // Enduits de mortier, ravalement (DTU 26.1)
  'CARRELAGE',       // Revêtements céramiques (DTU 52.1)
  'PLOMBERIE',       // Canalisations, sanitaires (DTU 60.x)
  'ELECTRICITE',     // Installations électriques (NF C 15-100)
  'MACONNERIE',      // Ouvrages en maçonnerie (DTU 20.x)
  'CHARPENTE',       // Charpente et ossature bois (DTU 31.x)
  'CLOISON',         // Cloisons, doublages, faux-plafonds (DTU 25.x)
  'FACADE',          // Façades, bardage, ITE
  'ETANCHEITE',      // Étanchéité toiture-terrasse (DTU 43.x)
  'DALLAGE',         // Dallages sur sol (DTU 13.3)
  'TERRASSEMENT',    // Terrassements, fouilles (DTU 12)
  'CHAUFFAGE',       // Chauffage, VMC, climatisation
  'PEINTURE',        // Peinture, finition (DTU 59.x)
] as const;

export type WorkType = typeof WORK_TYPES[number];

// =============================================================================
// Verifiability
// =============================================================================

/**
 * Whether a specific rule can be verified from the quote text.
 *
 * verifiable     — the rule's required data is present in the quote
 *                  (e.g. "chape flottante ép. 50 mm" → epaisseur verifiable)
 * non_verifiable — the rule applies to this work type but the required data
 *                  is absent from the quote; marks for follow-up, NOT failure
 * not_applicable — the rule does not apply given the detected context
 *                  (e.g. seismic rule excluded from Zone 1)
 */
export type VerifiabilityStatus = 'verifiable' | 'non_verifiable' | 'not_applicable';

/**
 * Context required to verify a class of rules.
 * When a required context is absent from the quote, dependent rules
 * are flagged non_verifiable with the corresponding missing_data entry.
 */
export type RequiredContext =
  | 'zone_sismique'          // Seismic zone (1–5) — required for EN 1998 rules
  | 'zone_climatique'        // Thermal climate zone (H1a–H3) — required for RE2020
  | 'destination_batiment'   // ERP, logement, industrie — required for fire/access rules
  | 'type_sol'               // Soil class (A–E) — required for foundation rules
  | 'classe_exposition'      // Concrete exposure class (XC1–XS3) — required for RC rules
  | 'surface_locaux'         // Floor area — required for compartmentation rules
  | 'hauteur_batiment';      // Building height (m) — required for IGH / fire rules

// =============================================================================
// Detection output
// =============================================================================

export interface DetectedWorkType {
  /** The detected work type */
  work_type: WorkType;
  /**
   * Confidence score in [0, 1].
   * Calculated as: matched_keywords.length / total_scored_keywords_for_type
   * Capped at 1.0.
   */
  confidence: number;
  /** The keywords / phrases that triggered detection */
  matched_keywords: string[];
  /** Verbatim slice of the source text that matched (for audit log) */
  source_excerpt: string;
}

// =============================================================================
// Activated rule output
// =============================================================================

/**
 * A rule from the corpus that has been activated for a specific work type
 * detected in a quote, annotated with verifiability status.
 */
export interface ActivatedRule {
  // ── Identification ──────────────────────────────────────────────────────────
  rule_id:          string;
  signature:        string;
  /** The work type that triggered this rule's activation */
  work_type:        WorkType;

  // ── Rule content ────────────────────────────────────────────────────────────
  description:      string;
  category:         string;
  domain:           string;
  rule_type:        string;
  /** Canonical property identifier, e.g. 'epaisseur_chape_flottante' */
  property_key:     string | null;
  operator:         string | null;
  /** Expected numeric value (null for qualitative rules) */
  value:            number | null;
  unit:             string | null;
  /** Whether a derogation or justified non-compliance path exists */
  adaptable:        boolean;

  // ── Enforcement ─────────────────────────────────────────────────────────────
  enforcement_level:      string;
  strictness:             string;
  risk_level:             string;
  justification_required: boolean;

  // ── Verifiability ───────────────────────────────────────────────────────────
  verifiability: VerifiabilityStatus;
  /**
   * Human-readable list of what is missing to verify this rule.
   * Empty when verifiability = 'verifiable' or 'not_applicable'.
   * Examples:
   *   "Épaisseur non précisée dans le devis"
   *   "Zone climatique inconnue — requis pour RE2020"
   */
  missing_data: string[];

  // ── Context ─────────────────────────────────────────────────────────────────
  contextual:   boolean;
  applicability: Record<string, unknown>;
}

// =============================================================================
// Activation result (full pipeline output)
// =============================================================================

export interface ActivationSummary {
  total_work_types_detected: number;
  total_rules_activated:     number;
  verifiable_count:          number;
  non_verifiable_count:      number;
  not_applicable_count:      number;
  /** Work types detected with confidence ≥ 0.5 */
  high_confidence_types:     WorkType[];
  /** Rules that are high-strictness and non_verifiable — require follow-up */
  critical_gaps:             number;
}

/**
 * Full output of the work type → rule activation pipeline.
 * Consumed by the Rule Engine and Audit Engine.
 */
export interface WorkTypeActivationResult {
  /** Input text that was analysed */
  source_text:         string;
  detected_work_types: DetectedWorkType[];
  activated_rules:     ActivatedRule[];
  summary:             ActivationSummary;
}
