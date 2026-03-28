/**
 * Ingestion Profiles
 *
 * Per-document-category configuration that controls what the rule validator
 * accepts. Different source types have different structural guarantees:
 *
 *   CODE_CONSTRUCTION / EUROCODE  — high-precision, operator always present
 *   DTU / NORMES                  — normative, mixed numeric + qualitative
 *   GUIDE_TECHNIQUE               — advisory, qualitative-heavy, operator optional
 *
 * Priority (1–5) reflects regulatory weight — used downstream for conflict
 * resolution when rules from multiple source types disagree on the same property.
 */

export interface IngestionProfile {
  /** Accept qualitative rules (structured_data.qualitative === true) */
  allowQualitative: boolean;
  /** Reject numeric rules whose operator is "unknown" */
  requireOperator: boolean;
  /** Reject numeric rules that have a value but no unit */
  requireUnitWithValue: boolean;
  /** Accept formula rules (rule_type === "formula") */
  allowFormula?: boolean;
  /** Regulatory weight 1 (lowest) → 5 (highest) */
  priority: number;
}

export const INGESTION_PROFILES: Record<string, IngestionProfile> = {
  DTU: {
    allowQualitative:     true,
    requireOperator:      true,
    requireUnitWithValue: true,
    priority: 3,
  },
  EUROCODE: {
    allowQualitative:     false,
    requireOperator:      false,
    requireUnitWithValue: false,
    allowFormula:         true,
    priority: 5,
  },
  NORMES: {
    allowQualitative:     true,
    requireOperator:      true,
    requireUnitWithValue: true,
    priority: 4,
  },
  GUIDE_TECHNIQUE: {
    allowQualitative:     true,
    requireOperator:      false,
    requireUnitWithValue: false,
    priority: 2,
  },
  CODE_CONSTRUCTION: {
    allowQualitative:     true,
    requireOperator:      true,
    requireUnitWithValue: false,
    priority: 5,
  },
};

/**
 * Return the profile for a given document category.
 * Falls back to DTU when the category is unknown or missing.
 */
export function getIngestionProfile(category?: string): IngestionProfile {
  return INGESTION_PROFILES[category ?? 'DTU'] ?? INGESTION_PROFILES.DTU;
}
