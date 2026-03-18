/**
 * Unit Normalizer
 *
 * Collapses semantically identical unit strings into a single canonical form
 * so that rule grouping and validation operate on a consistent surface.
 *
 * Canonical forms are lowercase and match the `allowedUnits` arrays in
 * src/core/rules/propertyRegistry.ts.
 *
 * Integration order:
 *   1. Extract raw unit from source text
 *   2. → normalizeUnit()          ← here
 *   3. → validate against registry allowedUnits
 *   4. → group decisions by (element, property, unit)
 *
 * This function performs NO unit conversion (no arithmetic).
 * "mpa" and "n/mm²" are treated as the same string, not converted numerically.
 */

// ---------------------------------------------------------------------------
// Pre-processing helpers (applied before the equivalence map)
// ---------------------------------------------------------------------------

/**
 * Strip internal whitespace around operators and slash separators.
 * "kn / m²" → "kn/m²",  "w / (m · k)" → "w/(m·k)"
 */
function stripInternalSpaces(s: string): string {
  return s
    .replace(/\s*\/\s*/g, '/')   // spaces around /
    .replace(/\s*\·\s*/g, '·')   // spaces around middle dot
    .replace(/\s*\.\s*/g, '.')   // spaces around dot
    .replace(/\s*\*\s*/g, '*');  // spaces around *
}

/**
 * Normalize superscript digits to ASCII equivalents that the registry uses.
 * "m²" → "m²" already canonical; handle "m2", "m3" written as plain ASCII.
 */
function normalizeSuperscripts(s: string): string {
  return s
    .replace(/m2(?!\/)/g, 'm²')   // m2 → m² (but not m2/ which may be part of a compound)
    .replace(/m3(?!\/)/g, 'm³')
    .replace(/mm2/g, 'mm²')
    .replace(/cm2/g, 'cm²')
    .replace(/n\/mm2/g, 'n/mm²')
    .replace(/kn\/m2/g, 'kn/m²')
    .replace(/n\/m2/g, 'n/m²')
    .replace(/w\/m2/g, 'w/m²')
    .replace(/m2\.k\/w/g, 'm².k/w')
    .replace(/kwh\/m2/g, 'kwh/m²')
    .replace(/m3\/h/g, 'm³/h')
    .replace(/m3\/s/g, 'm³/s');
}

/**
 * Normalize middle-dot and interpunct separator variants.
 * "w/m·k", "w/m.k", "w/(m·k)", "w/(m.k)" → "w/m.k"
 */
function normalizeDotSeparator(s: string): string {
  // Collapse parenthesised forms: w/(m.k) → w/m.k
  return s
    .replace(/\(([^)]+)\)/g, '$1')   // remove surrounding parens: (m.k) → m.k
    .replace(/·/g, '.');             // middle dot → plain dot
}

// ---------------------------------------------------------------------------
// Equivalence map
//
// Keys   : lowercase normalized input forms (after pre-processing above)
// Values : canonical lowercase form (must match propertyRegistry allowedUnits)
//
// Groups:
//   PRESSURE   — mpa / n/mm² / kpa / kn/m² / pa / n/m²
//   FORCE      — dan / kn / n
//   THERMAL    — conductivity and transmittance separators
//   TEMPERATURE — °c variants
//   FLOW       — l/min → l/s equivalent notation kept separate (no math)
//   ACOUSTIC   — db(a) variants
// ---------------------------------------------------------------------------

const UNIT_EQUIVALENCE: Readonly<Record<string, string>> = {
  // ── Pressure / stress ───────────────────────────────────────────────────
  'mpa':       'n/mm²',    // 1 MPa = 1 N/mm² (exact)
  'n/mm²':     'n/mm²',
  'kpa':       'kn/m²',   // 1 kPa = 1 kN/m² (exact)
  'kn/m²':     'kn/m²',
  'pa':        'n/m²',    // 1 Pa = 1 N/m² (exact)
  'n/m²':      'n/m²',
  'gpa':       'gpa',     // kept distinct — much larger scale, no collapse
  'n/mm2':     'n/mm²',   // ASCII fallback
  'kn/m2':     'kn/m²',
  'n/m2':      'n/m²',

  // ── Force ────────────────────────────────────────────────────────────────
  'dan':       'n',        // 1 daN = 10 N; collapsed for grouping purposes
  'kn':        'kn',
  'n':         'n',
  'kg':        'kg',

  // ── Thermal conductivity  ─────────────────────────────────────────────
  'w/m.k':     'w/m.k',
  'w/m·k':     'w/m.k',   // middle-dot variant
  'w/mk':      'w/m.k',   // no separator
  'wm-1k-1':   'w/m.k',   // scientific notation

  // ── Thermal transmittance  ────────────────────────────────────────────
  'w/m².k':    'w/m².k',
  'w/m2.k':    'w/m².k',
  'w/m²k':     'w/m².k',  // no dot before k
  'w/m2k':     'w/m².k',
  'wm-2k-1':   'w/m².k',

  // ── Thermal resistance ────────────────────────────────────────────────
  'm².k/w':    'm².k/w',
  'm2.k/w':    'm².k/w',
  'm²k/w':     'm².k/w',

  // ── Temperature ──────────────────────────────────────────────────────────
  '°c':        'c',
  'degc':      'c',
  'deg c':     'c',
  'celsius':   'c',
  'c':         'c',

  // ── Length ───────────────────────────────────────────────────────────────
  'mm':        'mm',
  'cm':        'cm',
  'm':         'm',
  'ml':        'ml',     // mètre linéaire

  // ── Area ─────────────────────────────────────────────────────────────────
  'm²':        'm²',
  'm2':        'm²',
  'cm²':       'cm²',
  'cm2':       'cm²',
  'mm²':       'mm²',
  'mm2':       'mm²',

  // ── Volume ────────────────────────────────────────────────────────────────
  'm³':        'm³',
  'm3':        'm³',

  // ── Flow rate ─────────────────────────────────────────────────────────────
  'l/s':       'l/s',
  'l/min':     'l/min',   // kept distinct — different scale
  'm³/h':      'm³/h',
  'm3/h':      'm³/h',
  'm³/s':      'm³/s',
  'm3/s':      'm³/s',

  // ── Energy / air permeability ────────────────────────────────────────────
  'm³/h.m²':   'm³/h.m²',
  'm3/h.m2':   'm³/h.m²',
  'kwh/m².an': 'kwh/m².an',
  'kwh/m2.an': 'kwh/m².an',

  // ── Acoustics ────────────────────────────────────────────────────────────
  'db':        'db',
  'dba':       'db(a)',
  'db(a)':     'db(a)',
  'db(c)':     'db(c)',

  // ── Pressure (hydraulic) ─────────────────────────────────────────────────
  'bar':       'bar',

  // ── Electrical ───────────────────────────────────────────────────────────
  'v':         'v',
  'kv':        'kv',
  'a':         'a',
  'ma':        'ma',
  'ka':        'ka',
  'w':         'w',
  'kw':        'kw',
  'va':        'va',
  'kva':       'kva',

  // ── Miscellaneous ────────────────────────────────────────────────────────
  '%':         '%',
  'm/s':       'm/s',
  'cm/m':      'cm/m',
  '°':         '°',
  'min':       'min',
  'h':         'h',
  's':         's',
  'u':         'u',
  'ens':       'ens',
};

// ---------------------------------------------------------------------------
// Valid canonical unit set
//
// Derived from the right-hand side of UNIT_EQUIVALENCE: every string that is
// a known physical unit. Strings that survive normalization but are NOT in
// this set are parsing artifacts ("et", "fck", "VEd", "/", …).
// ---------------------------------------------------------------------------

const VALID_CANONICAL_UNITS: ReadonlySet<string> = new Set(
  Object.values(UNIT_EQUIVALENCE),
);

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Normalize a raw unit string to its canonical lowercase form.
 *
 * Steps:
 *   1. Lowercase + trim
 *   2. Strip internal spaces around separators
 *   3. Normalize superscript ASCII digits (m2 → m²)
 *   4. Normalize dot separators and remove redundant parentheses
 *   5. Look up in equivalence map → return canonical form
 *   6. If not in map, return the pre-processed string as-is (open fallback)
 *
 * Returns undefined when input is undefined or blank.
 */
export function normalizeUnit(unit?: string): string | undefined {
  if (!unit) return undefined;

  const step1 = unit.trim().toLowerCase();
  if (!step1) return undefined;

  const step2 = stripInternalSpaces(step1);
  const step3 = normalizeSuperscripts(step2);
  const step4 = normalizeDotSeparator(step3);

  return UNIT_EQUIVALENCE[step4] ?? step4;
}

/**
 * Normalize a unit and validate it against the known physical unit set.
 *
 * Returns the canonical unit string when valid, or null when the input is
 * blank, unmappable, or a parsing artifact (variable names, words, symbols
 * like "et", "fck", "VEd", "/").
 *
 * Use this instead of normalizeUnit() when the caller must not persist
 * unrecognized units to the database.
 */
export function sanitizeUnit(unit?: string): string | null {
  const normalized = normalizeUnit(unit);
  if (!normalized) return null;
  return VALID_CANONICAL_UNITS.has(normalized) ? normalized : null;
}
