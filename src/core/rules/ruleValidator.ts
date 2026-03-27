/**
 * Rule Validator
 *
 * Pre-persistence quality gate applied to each EnrichedRule before it is
 * written to the `rules` table.
 *
 * Soft-mode validation contract:
 *   - Qualitative rules (structured_data.qualitative === true) → always valid
 *   - property_key missing/n/a → warn but keep
 *   - operator "unknown" → coerced to ">="
 *   - unit missing with value → coerced to null
 *   - value not a number → coerced via Number(); rejected only if NaN
 *   - value exceeds sanity bounds → rejected
 *
 * This layer may mutate structured_data fields for fallback coercion.
 */

import type { EnrichedRule } from '@/services/ruleEnrichment.service';
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sd = rule.structured_data as any;
  const profile = getIngestionProfile(rule.category);

  // ── 1. structured_data must exist ─────────────────────────────────────────
  if (!sd) {
    return reject('missing structured_data', sd);
  }

  // ── 2. Qualitative rules — gate on profile ────────────────────────────────
  if (sd.qualitative === true) {
    if (!profile.allowQualitative) {
      return reject(`qualitative rule not allowed for category="${rule.category}"`, sd);
    }
    return { valid: true };
  }

  // ── 3. property_key — warn on invalid, do not reject ─────────────────────
  if (!sd.property_key || sd.property_key === 'n/a') {
    console.warn('[VALIDATOR] invalid property_key but keeping:', sd.property_key ?? 'undefined');
  }

  // ── 4. Operator — fallback to '>=' instead of rejecting ──────────────────
  if (!sd.operator || sd.operator === 'unknown') {
    sd.operator = '>=';
  }

  // ── 5. Value type coercion ────────────────────────────────────────────────
  if (sd.value !== null && sd.value !== undefined) {
    if (typeof sd.value !== 'number') {
      const parsed = Number(sd.value);
      if (!isNaN(parsed)) {
        sd.value = parsed;
      } else {
        return reject(`value="${sd.value}" is not numeric and cannot be coerced`, sd);
      }
    }

    // ── 5a. Unit fallback — set to null instead of rejecting ───────────────
    if (profile.requireUnitWithValue && !sd.unit) {
      sd.unit = null;
    }

    // ── 6. Sanity bounds — always applied regardless of profile ─────────────
    const bounds = SANITY_BOUNDS[sd.property_key ?? ''];
    if (bounds !== undefined && sd.value > bounds.max) {
      return reject(
        `value=${sd.value} exceeds sanity bound of ${bounds.max}` +
        ` for property_key="${sd.property_key}" unit="${sd.unit ?? 'none'}"`,
        sd,
      );
    }
  }

  return { valid: true };
}

// ---------------------------------------------------------------------------
// Private helper
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function reject(reason: string, sd?: any): ValidationResult {
  console.warn('[VALIDATOR] rejected rule:', {
    property_key: sd?.property_key,
    operator:     sd?.operator,
    value:        sd?.value,
    unit:         sd?.unit,
    reason,
  });
  return { valid: false, reason };
}
