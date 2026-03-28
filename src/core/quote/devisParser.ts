/**
 * Devis Parser
 *
 * Extracts structured line items from raw construction quote text.
 * Recall-oriented: a partial item is always better than a dropped one.
 *
 * No external dependencies. No ML. No perfection.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface QuoteLineItem {
  description: string;
  quantity?: number;
  unit?: string;
  unitPrice?: number;
  totalPrice?: number;
}

// ---------------------------------------------------------------------------
// Patterns
// ---------------------------------------------------------------------------

// Supported units — order matters: longer tokens must come before shorter ones.
// Unicode units (m², m³) must appear before plain 'm' so alternation picks
// the longer match first.
const UNITS = [
  // surface / volume
  'm²', 'm2', 'm³', 'm3',
  // length (multi-char first)
  'ml', 'mm', 'cm',
  // piece/misc
  'ens', 'ft', 'kg', 'l',
  // single-char — last to avoid eating the prefix of longer units
  'u', 'h', 'm',
].join('|');

// (\d+[.,]\d+) covers decimals with comma or dot separator (French convention)
const NUM = '(\\d+(?:[.,]\\d+)?)';

// Quantity + unit: "12 m²", "3.5 ml", "120 mm", "1u"
// Use (?!\w) instead of \b so that unicode suffix chars (², ³) don't break
// the boundary check — \b fails between two \W chars like 'm²' + space.
const RE_QTY_UNIT = new RegExp(`${NUM}\\s*(${UNITS})(?!\\w)`, 'i');

// Unit price: "25 €/m²", "25€/u", "120,00 € / ml", "25 €"
const RE_UNIT_PRICE = new RegExp(
  `${NUM}\\s*€\\s*\\/\\s*(?:${UNITS})|${NUM}\\s*€(?!\\s*\\/|\\d)`,
  'i'
);

// Price followed by € or HT / TTC marker
const RE_PRICE = new RegExp(`${NUM}\\s*(?:€|eur|HT|TTC)`, 'i');

// Bare number at end of line (last resort for totalPrice)
const RE_TRAILING_NUMBER = /(\d+(?:[.,]\d+)?)\s*$$/;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Parse a French/English decimal string to float.
 * Handles both "1.500,00" and "1500.00" and "1 500,00".
 */
export function extractNumber(value: string): number | undefined {
  // Remove thousand-separator spaces
  let s = value.replace(/\s/g, '');
  // French format: 1.500,00 → replace dot (thousand sep) then comma (decimal sep)
  if (/\d\.\d{3},\d/.test(s)) {
    s = s.replace('.', '').replace(',', '.');
  } else {
    // Standard: replace comma decimal separator
    s = s.replace(',', '.');
  }
  const n = parseFloat(s);
  return isNaN(n) ? undefined : n;
}

function normalizeUnit(raw: string): string {
  return raw
    .toLowerCase()
    .replace('.', '')   // "ens." → "ens"
    .replace('m2', 'm²')
    .replace('m3', 'm³');
}

// ---------------------------------------------------------------------------
// Per-line extraction
// ---------------------------------------------------------------------------

function parseLine(line: string): QuoteLineItem | null {
  const trimmed = line.trim();
  if (!trimmed) return null;

  let remaining = trimmed;

  // --- quantity + unit ---
  let quantity: number | undefined;
  let unit: string | undefined;

  const qtyMatch = RE_QTY_UNIT.exec(remaining);
  if (qtyMatch) {
    quantity = extractNumber(qtyMatch[1]);
    unit = normalizeUnit(qtyMatch[2]);
    // Remove the matched token so it doesn't pollute description or price parsing
    remaining = remaining.slice(0, qtyMatch.index) + remaining.slice(qtyMatch.index + qtyMatch[0].length);
  }

  // --- unit price ---
  let unitPrice: number | undefined;

  const upMatch = RE_UNIT_PRICE.exec(remaining);
  if (upMatch) {
    // Group 1 = price-per-unit form, group 2 = standalone € form
    const raw = upMatch[1] ?? upMatch[2];
    unitPrice = extractNumber(raw);
    remaining = remaining.slice(0, upMatch.index) + remaining.slice(upMatch.index + upMatch[0].length);
  }

  // --- total price ---
  let totalPrice: number | undefined;

  const priceMatch = RE_PRICE.exec(remaining);
  if (priceMatch) {
    totalPrice = extractNumber(priceMatch[1]);
    remaining = remaining.slice(0, priceMatch.index) + remaining.slice(priceMatch.index + priceMatch[0].length);
  }

  // Fallback: trailing number as total price
  if (totalPrice === undefined) {
    const trailingMatch = RE_TRAILING_NUMBER.exec(remaining);
    if (trailingMatch) {
      const candidate = extractNumber(trailingMatch[1]);
      // Only treat it as a price if it looks plausible (> 0)
      if (candidate !== undefined && candidate > 0) {
        totalPrice = candidate;
        remaining = remaining.slice(0, trailingMatch.index);
      }
    }
  }

  // --- description: what's left after removing numeric tokens ---
  const description = remaining.replace(/\s{2,}/g, ' ').trim();

  // Drop lines that carry no meaningful content at all
  if (!description && quantity === undefined && totalPrice === undefined) {
    return null;
  }

  return {
    description: description || trimmed, // always fall back to raw line
    ...(quantity !== undefined && { quantity }),
    ...(unit !== undefined && { unit }),
    ...(unitPrice !== undefined && { unitPrice }),
    ...(totalPrice !== undefined && { totalPrice }),
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Parse raw quote text into structured line items.
 * Every line that carries any signal is kept (recall-first).
 *
 * @param text - Raw quote text (pre-extracted from PDF/OCR)
 * @returns Array of QuoteLineItems, partial items included
 */
export function parseDevis(text: string): QuoteLineItem[] {
  return text
    .split('\n')
    .map(parseLine)
    .filter((item): item is QuoteLineItem => item !== null);
}
