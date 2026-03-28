/**
 * NLP Patterns — Canonical French Construction Patterns
 *
 * Single source of truth for all regex and keyword detection logic used
 * across the construction intelligence services.
 *
 * Consumers:
 *   src/services/ccfEngine.service.ts    — intent parsing
 *   src/services/ruleEnrichment.service.ts — rule applicability detection
 *
 * Design rules:
 *   - All patterns are accent-aware (use [ée], [âa], /i flag, etc.)
 *   - All patterns work on both raw text and normalised (accent-stripped) text
 *   - Ordered by specificity (most specific first) where order matters
 *   - No side effects — pure exports only
 */

// =============================================================================
// Project type detection
// =============================================================================

/** Matches unambiguous references to new construction */
export const NEUF_RE =
  /\b(construction\s+neuve?|b[âa]timent\s+neuf|ouvrage\s+neuf|logement\s+neuf)\b/i;

/** Matches unambiguous references to renovation / existing buildings */
export const RENOV_RE =
  /\b(r[ée]novation|r[ée]habilitation|existant|ancien\s+b[âa]timent|mise\s+en\s+conformit[ée])\b/i;

// =============================================================================
// Building type patterns
// =============================================================================

export interface BuildingTypePattern {
  re: RegExp;
  label: string;
}

/**
 * Ordered by specificity — first match wins.
 *
 * IGH and ERP are the most restrictive regulatory categories and must be
 * detected before generic "immeuble" or "logement".
 */
export const BUILDING_TYPE_PATTERNS: ReadonlyArray<BuildingTypePattern> = [
  {
    re:    /\b(ERP|[ée]tablissement\s+recevant\s+du\s+public)\b/i,
    label: 'ERP',
  },
  {
    re:    /\b(IGH|immeuble\s+de\s+grande\s+hauteur)\b/i,
    label: 'IGH',
  },
  {
    re:    /\b(maison\s+individuelle|maison\s+unifamiliale|pavillonnaire|parc\s+r[ée]sidentiel)\b/i,
    label: 'maison individuelle',
  },
  {
    re:    /\b(immeuble\s+(d[''`]?habitation|r[ée]sidentiel|collectif)|logement\s+collectif|copropri[ée]t[ée]|syndicat\s+de\s+copropri[ée]t[ée])\b/i,
    label: 'immeuble collectif',
  },
  {
    re:    /\b(appartement|studio|t[1-5]\b|logement\s+en\s+(copropri[ée]t[ée]|[ée]tage))\b/i,
    label: 'appartement',
  },
  {
    re:    /\b(maison|villa|chalet|pavillon)\b/i,
    label: 'maison',
  },
  {
    re:    /\b(b[âa]timent\s+industriel|entrep[oô]t|atelier|usine)\b/i,
    label: 'industriel',
  },
  {
    re:    /\b(b[âa]timent\s+tertiaire|bureaux?|tertiaire|commerces?|locaux?\s+commerciaux?)\b/i,
    label: 'tertiaire',
  },
  {
    re:    /\b(parking|parc\s+de\s+stationnement)\b/i,
    label: 'parking',
  },
];

// =============================================================================
// Location / zone patterns
// =============================================================================

export interface LocationPattern {
  re: RegExp;
  label: string;
}

export const LOCATION_PATTERNS: ReadonlyArray<LocationPattern> = [
  { re: /\bzone\s+sis(?:mique)?\s*([0-5][a-b]?)\b/i,                         label: 'zone sismique' },
  { re: /\bzone\s+(?:climatique\s+)?([Hh][1-3][a-c]?)\b/,                    label: 'zone climatique' },
  { re: /\b(littoral|zone\s+c[ôo]ti[eè]re|bord\s+de\s+mer)\b/i,              label: 'littoral' },
  { re: /\b(zone\s+de\s+montagne|altitude\s+[>≥]\s*\d+\s*m)\b/i,             label: 'montagne' },
  { re: /\b(outre-?mer|DOM[- ]?TOM|Antilles|R[ée]union|Guyane|Mayotte)\b/i,  label: 'outre-mer' },
];

// =============================================================================
// Regulatory / heritage patterns (used in ccfEngine regulatory detection)
// =============================================================================

/** Signals that ABF (Architecte des Bâtiments de France) review is required */
export const ABF_RE =
  /\b(abf|architecte\s+des\s+b[âa]timents(\s+de\s+france)?|monument\s+historique|site\s+(class[ée]|inscrit|prot[ée]g[ée])|prot[ée]g[ée])\b/i;

/** Seismic zone code extraction: captures the zone number/letter */
export const ZONE_SISMIQUE_RE = /\bzone\s+sis(?:mique)?\s*([0-5][a-b]?)\b/i;

/** Thermal/climatic zone code extraction */
export const ZONE_CLIMATIQUE_RE = /\bzone\s+(?:climatique\s+)?([Hh][1-3][a-c]?)\b/;

// =============================================================================
// Contextual language markers
// =============================================================================

/**
 * Linguistic patterns that indicate a rule's applicability is conditional.
 * When these appear in a rule's text, contextual = true.
 */
export const CONTEXTUAL_RE =
  /\b(selon|suivant|en\s+fonction\s+de|si\s+(?:le|la|les|l[''])|en\s+cas\s+de|pour\s+les?\s+(?:b[âa]timents?|locaux|zones?|ouvrages?)|lorsque|quand|d[eè]s\s+lors\s+que|sous\s+r[ée]serve)\b/i;

// =============================================================================
// Helper functions
// =============================================================================

/**
 * Detect whether text describes new construction, renovation, or is ambiguous.
 * Returns undefined when no signal is found.
 */
export function matchProjectType(text: string): 'neuf' | 'renovation' | undefined {
  if (NEUF_RE.test(text))  return 'neuf';
  if (RENOV_RE.test(text)) return 'renovation';
  return undefined;
}

/**
 * Detect the first matching building type label from the ordered pattern list.
 * Returns undefined when no pattern matches.
 */
export function matchBuildingType(text: string): string | undefined {
  for (const { re, label } of BUILDING_TYPE_PATTERNS) {
    if (re.test(text)) return label;
  }
  return undefined;
}

/**
 * Detect the first matching location label (zone, region, geography).
 * Returns undefined when no pattern matches.
 */
export function matchLocation(text: string): string | undefined {
  for (const { re, label } of LOCATION_PATTERNS) {
    if (re.test(text)) return label;
  }
  return undefined;
}
