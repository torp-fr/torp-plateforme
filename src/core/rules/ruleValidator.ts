/**
 * Rule Validator
 *
 * Pre-persistence quality gate applied to each EnrichedRule before it is
 * written to the `rules` table.
 *
 * Validation contract:
 *   - Qualitative rules (structured_data.qualitative === true) → always valid
 *   - Numeric rules must have:
 *       • property_key set and not "n/a"
 *       • operator not "unknown"
 *       • unit present when value is present
 *       • value within per-property sanity bounds
 *
 * This layer is:
 *   - Pure (no DB calls, no side effects)
 *   - Fast (no async, no I/O)
 *   - Additive (does not mutate the rule)
 */

import type { EnrichedRule } from '@/services/ruleEnrichment.service';
import type { StructuredData } from '@/services/ruleExtraction.service';
import { getIngestionProfile } from '@/core/ingestion/ingestionProfiles';

// ---------------------------------------------------------------------------
// Sanity bounds
//
// Upper limits per property_key. Values in the rules table are stored in
// whatever unit was extracted (already normalized by unitNormalizer), so
// bounds are intentionally generous to catch only clearly absurd values
// (extraction artifacts, OCR errors, misplaced decimal points).
//
// Keys match PROPERTY_REGISTRY.key values.
// ---------------------------------------------------------------------------

const SANITY_BOUNDS: Readonly<Record<string, { max: number }>> = {
  epaisseur:          { max: 10_000 },  // 10 000 mm = 10 m ceiling
  largeur:            { max: 50_000 },  // 50 m (large bridge lane)
  hauteur:            { max: 50_000 },  // 50 m
  longueur:           { max: 500_000 }, // 500 m (long spans, tunnels)
  entraxe:            { max: 10_000 },  // 10 m between studs
  diametre:           { max: 5_000 },   // 5 000 mm = 5 m pipe
  section:            { max: 1_000_000 }, // 1 m² section
  profondeur:         { max: 30_000 },  // 30 m depth
  charge:             { max: 100_000 }, // 100 000 kN per task spec
  charge_lineique:    { max: 100_000 },
  charge_surfacique:  { max: 100_000 },
  resistance_mecanique: { max: 1_000 }, // 1 000 MPa (ultra-high-strength steel)
  pression:           { max: 10_000 },  // 10 000 bar
  temperature:        { max: 2_000 },   // °C — above 2000 is physically impossible in construction
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface ValidationResult {
  valid: boolean;
  reason?: string;
}

/**
 * Validate a single EnrichedRule before DB persistence.
 *
 * Returns `{ valid: true }` or `{ valid: false, reason: string }`.
 * Logs a line for every rejected rule.
 */
export function validateRule(rule: EnrichedRule): ValidationResult {
  const sd: StructuredData | undefined = rule.structured_data;
  const profile = getIngestionProfile(rule.category);

  // ── 1. structured_data must exist ─────────────────────────────────────────
  if (!sd) {
    return reject('missing structured_data');
  }

  // ── 2. Qualitative rules — gate on profile ────────────────────────────────
  if (sd.qualitative === true) {
    if (!profile.allowQualitative) {
      return reject(`qualitative rule not allowed for category="${rule.category}"`);
    }
    return { valid: true };
  }

  // ── 3. property_key must be set and meaningful ────────────────────────────
  if (!sd.property_key || sd.property_key === 'n/a') {
    return reject(`property_key is "${sd.property_key ?? 'undefined'}"`);
  }

  // ── 4. Operator check — only enforced when profile requires it ────────────
  if (profile.requireOperator && sd.operator === 'unknown') {
    return reject(`operator is "unknown" for property_key="${sd.property_key}" category="${rule.category}"`);
  }

  // ── 5. Unit + value check — only enforced when profile requires it ─────────
  if (sd.value !== null && sd.value !== undefined) {
    if (profile.requireUnitWithValue && !sd.unit) {
      return reject(`value=${sd.value} has no unit (property_key="${sd.property_key}" category="${rule.category}")`);
    }

    // ── 6. Sanity bounds — always applied regardless of profile ─────────────
    const bounds = SANITY_BOUNDS[sd.property_key];
    if (bounds !== undefined && sd.value > bounds.max) {
      return reject(
        `value=${sd.value} exceeds sanity bound of ${bounds.max}` +
        ` for property_key="${sd.property_key}" unit="${sd.unit ?? 'none'}"`,
      );
    }
  }

  return { valid: true };
}

// ---------------------------------------------------------------------------
// Private helper
// ---------------------------------------------------------------------------

function reject(reason: string): ValidationResult {
  console.log(`[RuleValidator] rejected: ${reason}`);
  return { valid: false, reason };
}
