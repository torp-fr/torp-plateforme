/**
 * Category-Aware Rule Extraction Service
 *
 * Routes extraction to a category-specific function based on the document
 * category stored in knowledge_documents.category.
 *
 * Supported categories and their strategies:
 *
 *   DTU               — quantitative constraints + qualitative requirements
 *                       (reuses the existing ruleExtraction.service pipeline)
 *   EUROCODE          — formulas, coefficients (γ/λ/ψ), limit states (ELU/ELS)
 *   NORMES            — same structure as DTU (NF standards); delegates to DTU path
 *   GUIDE_TECHNIQUE   — best-practice recommendations with lower confidence
 *   CODE_CONSTRUCTION — legal obligations; article/decree references
 *   (default)         — generic fallback: DTU pipeline applied to any category
 *
 * Public API:
 *   extractRulesByCategory(chunk, category) → ExtractedRule[]
 *
 * Backward compat:
 *   The original extractRulesFromChunk() in ruleExtraction.service.ts is
 *   unchanged and still callable directly for DTU-only consumers.
 */

import {
  extractRulesFromChunk,
  detectDomain,
  extractElement,
  detectProperty,
  type ChunkInput,
  type ExtractedRule,
  type StructuredData,
} from './ruleExtraction.service';

// =============================================================================
// Shared helpers (private)
// =============================================================================

/** FNV-1a 32-bit — same algorithm as ruleExtraction.service (private there). */
function hashString(str: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

function splitSentences(content: string): string[] {
  return content
    .split(/[.;!\n]+/g)
    .map((s) => s.trim())
    .filter((s) => s.length >= 20);
}

function normalizeAccents(str: string): string {
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

// =============================================================================
// DTU — reuse existing pipeline
// =============================================================================

/**
 * DTU (Documents Techniques Unifiés): quantitative constraints + qualitative
 * requirements. Delegates entirely to the existing v3 extraction pipeline.
 */
function extractDTURules(chunk: ChunkInput): ExtractedRule[] {
  return extractRulesFromChunk(chunk);
}

// =============================================================================
// NORMES — same structure as DTU
// =============================================================================

/**
 * Normes NF have the same quantitative/qualitative structure as DTU chunks.
 * The DTU pipeline is reused; the category override is an internal detail only.
 */
function extractNormeRules(chunk: ChunkInput): ExtractedRule[] {
  return extractRulesFromChunk({ ...chunk, category: 'DTU' });
}

// =============================================================================
// EUROCODE — formulas, coefficients, limit states
// =============================================================================

/**
 * Coefficient names (Greek letters spelled out, as they appear in French PDFs).
 * Also matches Unicode Greek letters when the PDF preserves them.
 */
const EC_COEFF_NAMED_RE =
  /\b(gamma|lambda|alpha|beta|psi|phi|chi|rho|epsilon|zeta|eta|theta|kappa|mu|nu|sigma|tau|xi|omega)\b/i;

const EC_COEFF_UNICODE_RE = /[γλαβψφχρεζηθκμνστξωΓΛΑΒΨΦΧΡΕΖΗΘΚΜΝΣΤΞΩ]/;

/**
 * Matches variable = value patterns:
 *   "gamma_M0 = 1,00"  |  "f_yk = 500 N/mm²"  |  "E_s = 210 000 MPa"
 */
const EC_ASSIGNMENT_RE =
  /([A-Za-zγλαβψφΨΦ_Φ]{1,12}(?:[\s_][A-Za-z0-9,]{0,8})?)\s*=\s*([\d][\d\s,.']*)\s*([A-Za-z/²³°%·]{0,8})?/;

/**
 * Inequality formulas:
 *   "N_Ed ≤ N_c,Rd"  |  "M_Ed / M_Rd ≤ 1,0"
 */
const EC_INEQUALITY_RE =
  /[A-Za-z_ΓΛΑΒΨγλαβ]{1,8}(?:[\s,_][A-Za-z0-9]{0,6})*\s*[≤≥]\s*[\d,.]+/;

/** Limit state identifiers. */
const EC_LIMIT_STATE_RE =
  /\b(?:ELU|ELS|[eé]tat\s+limite(?:\s+ultime|\s+de\s+service)?|ULS|SLS)\b/i;

/**
 * Structural domain keywords for Eurocode (covers EC2 béton, EC3 acier, EC5 bois).
 */
const EC_DOMAIN_RE =
  /\b(?:b[eé]ton\s+arm[eé]|beton|acier|bois\s+lamell[eé]|fondation|dalle|poteau|poutre|voile|semelle|charpente)\b/i;

const UNIT_NORMALIZATION_EC: Readonly<Record<string, string>> = {
  'n/mm²': 'N/mm²',
  'mpa':   'MPa',
  'kn':    'kN',
  'kpa':   'kPa',
  'dan':   'daN',
  'gpa':   'GPa',
  'mm':    'mm',
  'cm':    'cm',
  'm':     'm',
  '%':     '%',
  '°c':    '°C',
  'kn/m²': 'kN/m²',
  'kn/m':  'kN/m',
};

function normalizeUnitEC(raw: string): string {
  return UNIT_NORMALIZATION_EC[raw.toLowerCase().trim()] ?? raw;
}

interface EurocodeRule {
  formula: string;     // human-readable expression
  coeff_name?: string; // e.g. "gamma_M0", "lambda"
  value?: number;      // numeric value if assignment
  unit?: string;       // unit if present
  limit_state?: string;// ELU | ELS | null
  is_formula: boolean; // false → coefficient assignment, true → inequality/formula
}

function parseEurocodeExpression(sentence: string): EurocodeRule | null {
  // Must contain a coefficient / formula signal
  const hasCoeff = EC_COEFF_NAMED_RE.test(sentence) || EC_COEFF_UNICODE_RE.test(sentence);
  const hasFormula = EC_INEQUALITY_RE.test(sentence) || EC_ASSIGNMENT_RE.test(sentence);
  const hasLimitState = EC_LIMIT_STATE_RE.test(sentence);

  if (!hasCoeff && !hasFormula && !hasLimitState) return null;

  const limitStateMatch = sentence.match(EC_LIMIT_STATE_RE);
  const limit_state = limitStateMatch ? limitStateMatch[0].trim().toUpperCase() : undefined;

  // Try to extract assignment: name = value [unit]
  const assignMatch = sentence.match(EC_ASSIGNMENT_RE);
  if (assignMatch) {
    const rawValue = parseFloat(assignMatch[2].replace(/\s/g, '').replace(',', '.'));
    const rawUnit  = assignMatch[3]?.trim();
    const unit     = rawUnit ? normalizeUnitEC(rawUnit) : undefined;

    return {
      formula:      `${assignMatch[1].trim()} = ${assignMatch[2].trim()}${rawUnit ? ' ' + rawUnit : ''}`,
      coeff_name:   assignMatch[1].trim(),
      value:        isNaN(rawValue) ? undefined : rawValue,
      unit,
      limit_state,
      is_formula:   false,
    };
  }

  // Inequality expression (no direct assignment)
  const ineqMatch = sentence.match(EC_INEQUALITY_RE);
  if (ineqMatch) {
    return {
      formula:     ineqMatch[0].trim(),
      limit_state,
      is_formula:  true,
    };
  }

  // Limit state only mention
  if (limit_state) {
    return {
      formula:    sentence.length > 100 ? sentence.substring(0, 97) + '…' : sentence,
      limit_state,
      is_formula: false,
    };
  }

  return null;
}

function extractEurocodeRules(chunk: ChunkInput): ExtractedRule[] {
  // Skip purely administrative chunks
  if (/\b(?:sommaire|pr[eé]ambule|avant-propos|table\s+des\s+mati[eè]res)\b/i.test(chunk.content)) {
    return [];
  }

  const sentences = splitSentences(chunk.content);
  const domain    = detectDomain(chunk.content);
  const rules: ExtractedRule[] = [];
  const seen  = new Set<string>();

  for (const sentence of sentences) {
    const parsed = parseEurocodeExpression(sentence);
    if (!parsed) continue;

    // Confidence: presence-based additive model
    let confidence = 0.40;
    if (parsed.value !== undefined) confidence += 0.25;
    if (parsed.unit !== undefined)  confidence += 0.15;
    if (parsed.limit_state)         confidence += 0.15;
    if (!parsed.is_formula)         confidence += 0.05; // assignment more certain
    confidence = Math.min(1.0, parseFloat(confidence.toFixed(2)));

    const description = sentence.length > 300 ? sentence.substring(0, 297) + '…' : sentence;
    const signature   = `ec_${hashString(description)}`;

    if (seen.has(signature)) continue;
    seen.add(signature);

    const element    = extractElement(sentence);
    const propertyDef = detectProperty(sentence);
    // Eurocode sentences often reference specific coefficient names (γ_M0, f_yk)
    // that are not in the property registry. Fall back to the parsed coeff name.
    const ecPropertyKey      = propertyDef?.key      ?? parsed.coeff_name ?? 'formula';
    const ecPropertyCategory = propertyDef?.category ?? 'formula';
    const ecPropertyDisplay  = propertyDef
      ? (propertyDef.aliases[0] ?? propertyDef.key)
      : (parsed.coeff_name ?? 'formula');

    const structured: StructuredData = {
      element,
      property:          ecPropertyDisplay,
      property_key:      ecPropertyKey,
      property_category: ecPropertyCategory,
      operator:  parsed.is_formula ? '<=' : '=',
      value:     parsed.value ?? null,
      unit:      parsed.unit ?? null,
      raw:       parsed.formula,
      ...(parsed.limit_state
        ? { conditions: { limit_state: parsed.limit_state } }
        : {}),
    };

    rules.push({
      rule_type:        'formula',
      domain:           domain !== 'unknown' ? domain : 'structure',
      description,
      structured_data:  structured,
      confidence_score: confidence,
      source_sentence:  sentence,
      signature,
    });
  }

  return rules;
}

// =============================================================================
// GUIDE_TECHNIQUE — best-practice recommendations
// =============================================================================

/** Recommendation triggers (non-binding best practices). */
const GUIDE_REC_RE =
  /\b(?:il\s+est\s+recommand[eé]|recommand[eé]|conseill[eé]|pr[eé]conis[eé]|il\s+convient\s+de|de\s+pr[eé]f[eé]rence|pr[eé]f[eé]rentiellement)\b/i;

/** Negative advice / avoidance. */
const GUIDE_AVOID_RE =
  /\b(?:[eé]viter|ne\s+pas\s+utiliser|d[eé]conseill[eé]|proscrit|interdit\s+de)\b/i;

/**
 * Tag map specific to guide technique content (broader than DTU qualitative).
 */
const GUIDE_TAGS: ReadonlyArray<{ normalized: string; tag: string }> = [
  { normalized: 'mise en oeuvre',   tag: 'mise_en_oeuvre' },
  { normalized: 'mise en œuvre',    tag: 'mise_en_oeuvre' },
  { normalized: 'preparation',      tag: 'préparation' },
  { normalized: 'controle',         tag: 'contrôle' },
  { normalized: 'verification',     tag: 'vérification' },
  { normalized: 'entretien',        tag: 'entretien' },
  { normalized: 'maintenance',      tag: 'maintenance' },
  { normalized: 'securite',         tag: 'sécurité' },
  { normalized: 'protection',       tag: 'protection' },
  { normalized: 'thermique',        tag: 'thermique' },
  { normalized: 'acoustique',       tag: 'acoustique' },
  { normalized: 'etancheite',       tag: 'étanchéité' },
  { normalized: 'fixation',         tag: 'fixation' },
  { normalized: 'support',          tag: 'support' },
  { normalized: 'surface',          tag: 'surface' },
];

const GUIDE_CONFIDENCE = 0.55; // lower than DTU (0.6) — non-binding

function extractGuideTags(sentence: string): string[] {
  const normalized = normalizeAccents(sentence.toLowerCase());
  const seen = new Set<string>();
  for (const { normalized: kw, tag } of GUIDE_TAGS) {
    if (normalized.includes(normalizeAccents(kw))) seen.add(tag);
  }
  return [...seen];
}

function extractGuideRules(chunk: ChunkInput): ExtractedRule[] {
  // Skip noise sections
  if (/\b(?:sommaire|pr[eé]ambule|avant-propos|table\s+des\s+mati[eè]res)\b/i.test(chunk.content)) {
    return [];
  }

  const sentences = splitSentences(chunk.content);
  const domain    = detectDomain(chunk.content);
  const rules: ExtractedRule[] = [];
  const seen  = new Set<string>();

  for (const sentence of sentences) {
    const isRec   = GUIDE_REC_RE.test(sentence);
    const isAvoid = GUIDE_AVOID_RE.test(sentence);

    if (!isRec && !isAvoid) continue;

    const description = sentence.length > 300 ? sentence.substring(0, 297) + '…' : sentence;
    const signature   = `guide_${hashString(description)}`;

    if (seen.has(signature)) continue;
    seen.add(signature);

    const tags        = extractGuideTags(sentence);
    const element     = extractElement(sentence);
    const propertyDef = detectProperty(sentence);

    const structured: StructuredData = {
      element,
      property:          propertyDef ? (propertyDef.aliases[0] ?? propertyDef.key) : 'n/a',
      property_key:      propertyDef?.key      ?? 'n/a',
      property_category: propertyDef?.category ?? 'qualitative',
      operator:    'unknown',
      value:       null,
      unit:        null,
      raw:         null,
      qualitative: true,
      ...(tags.length > 0 ? { tags } : {}),
      ...(isAvoid ? { conditions: { polarity: 'avoid' } } : {}),
    };

    rules.push({
      rule_type:        'recommendation',
      domain:           domain !== 'unknown' ? domain : 'general',
      description,
      structured_data:  structured,
      confidence_score: GUIDE_CONFIDENCE,
      source_sentence:  sentence,
      signature,
    });
  }

  return rules;
}

// =============================================================================
// CODE_CONSTRUCTION — legal obligations
// =============================================================================

/** Hard legal obligation triggers (statutory / regulatory binding language). */
const LEGAL_OBLIGATION_RE =
  /\b(?:est\s+obligatoire|sont\s+obligatoires|est\s+exig[eé]|sont\s+exig[eé]s|est\s+interdit|sont\s+interdits|doit\s+(?:imp[eé]rativement|obligatoirement)|est\s+prescrit|il\s+est\s+exig[eé])\b/i;

/** Article / decree reference patterns. */
const LEGAL_ARTICLE_RE =
  /\b(?:Art(?:icle)?\.?\s*[LRD]\d[\d-]*|D[eé]cret\s+n°\s*\d[\d-]*|Arr[eê]t[eé]\s+du\s+\d|Code\s+de\s+la\s+[Cc]onstruction|CCH\s+[LRD]\d|R[eé]glement(?:ation)?)\b/i;

const LEGAL_TAGS: ReadonlyArray<{ normalized: string; tag: string }> = [
  { normalized: 'securite incendie',    tag: 'sécurité_incendie' },
  { normalized: 'securite',             tag: 'sécurité' },
  { normalized: 'accessibilite',        tag: 'accessibilité' },
  { normalized: 'thermique',            tag: 'thermique' },
  { normalized: 'acoustique',           tag: 'acoustique' },
  { normalized: 'parasismique',         tag: 'parasismique' },
  { normalized: 'energetique',          tag: 'énergie' },
  { normalized: 'logement',             tag: 'logement' },
  { normalized: 'assainissement',       tag: 'assainissement' },
  { normalized: 'permis de construire', tag: 'permis' },
  { normalized: 'urban',                tag: 'urbanisme' },
];

const LEGAL_CONFIDENCE = 0.75; // high confidence — statutory language is unambiguous

function extractLegalTags(sentence: string): string[] {
  const normalized = normalizeAccents(sentence.toLowerCase());
  const seen = new Set<string>();
  for (const { normalized: kw, tag } of LEGAL_TAGS) {
    if (normalized.includes(normalizeAccents(kw))) seen.add(tag);
  }
  return [...seen];
}

function extractLegalRules(chunk: ChunkInput): ExtractedRule[] {
  // Skip noise sections
  if (/\b(?:sommaire|pr[eé]ambule|avant-propos|table\s+des\s+mati[eè]res)\b/i.test(chunk.content)) {
    return [];
  }

  const sentences = splitSentences(chunk.content);
  const domain    = detectDomain(chunk.content);
  const rules: ExtractedRule[] = [];
  const seen  = new Set<string>();

  for (const sentence of sentences) {
    const isObligation = LEGAL_OBLIGATION_RE.test(sentence);
    const hasArticle   = LEGAL_ARTICLE_RE.test(sentence);

    if (!isObligation && !hasArticle) continue;

    const description = sentence.length > 300 ? sentence.substring(0, 297) + '…' : sentence;
    const signature   = `legal_${hashString(description)}`;

    if (seen.has(signature)) continue;
    seen.add(signature);

    const tags        = extractLegalTags(sentence);
    const element     = extractElement(sentence);
    const propertyDef = detectProperty(sentence);

    // Extract article reference as a condition context
    const articleMatch = sentence.match(LEGAL_ARTICLE_RE);
    const conditions: Record<string, string> = {};
    if (articleMatch) {
      conditions['article'] = articleMatch[0].trim();
    }

    const structured: StructuredData = {
      element,
      property:          propertyDef ? (propertyDef.aliases[0] ?? propertyDef.key) : 'n/a',
      property_key:      propertyDef?.key      ?? 'n/a',
      property_category: propertyDef?.category ?? 'qualitative',
      operator:    'unknown',
      value:       null,
      unit:        null,
      raw:         null,
      qualitative: true,
      ...(tags.length > 0 ? { tags } : {}),
      ...(Object.keys(conditions).length > 0 ? { conditions } : {}),
    };

    rules.push({
      rule_type:        'requirement',
      domain:           domain !== 'unknown' ? domain : 'reglementation',
      description,
      structured_data:  structured,
      confidence_score: LEGAL_CONFIDENCE,
      source_sentence:  sentence,
      signature,
    });
  }

  return rules;
}

// =============================================================================
// Generic fallback — applies DTU pipeline to unknown categories
// =============================================================================

/**
 * Fallback for categories that do not have a dedicated extractor.
 * Applies the DTU quantitative/qualitative pipeline since it is the most
 * conservative (strict whitelists reduce noise even on non-DTU content).
 */
function extractGenericRules(chunk: ChunkInput): ExtractedRule[] {
  return extractRulesFromChunk({ ...chunk, category: 'DTU' });
}

// =============================================================================
// Category constants
// =============================================================================

/** Categories with dedicated extraction logic. */
export const SUPPORTED_EXTRACTION_CATEGORIES = [
  'DTU',
  'EUROCODE',
  'NORMES',
  'GUIDE_TECHNIQUE',
  'CODE_CONSTRUCTION',
] as const;

export type ExtractionCategory = typeof SUPPORTED_EXTRACTION_CATEGORIES[number];

// =============================================================================
// Category normalizer
// =============================================================================

/**
 * Normalization table: maps raw DB category strings to canonical ExtractionCategory.
 *
 * Matching rules:
 *   - Input is lowercased, accent-stripped, underscores/hyphens replaced by space
 *   - First-match-wins; more specific patterns are listed before broader ones
 *   - `exact` patterns require an exact match after normalization
 *   - `prefix` patterns also match when followed by a space (e.g. "dtu 20.1")
 */
interface CategoryAlias {
  canonical: ExtractionCategory;
  /** Exact match after normalization */
  exact: string[];
  /** Prefix match: normalized input starts with this string + ' ' */
  prefix: string[];
}

const CATEGORY_ALIASES: ReadonlyArray<CategoryAlias> = [
  {
    canonical: 'CODE_CONSTRUCTION',
    exact:  ['code construction', 'code de la construction', 'cch', 'code de l habitabilite'],
    prefix: ['code construction', 'code de la construction', 'r111', 'decret', 'arrete'],
  },
  {
    canonical: 'EUROCODE',
    exact:  ['eurocode', 'ec2', 'ec3', 'ec4', 'ec5', 'ec6', 'ec7', 'ec8'],
    prefix: ['eurocode', 'en 199'],
  },
  {
    canonical: 'GUIDE_TECHNIQUE',
    exact:  ['guide technique', 'guide pratique', 'fiche technique', 'cahier du cstb', 'avis technique', 'document technique unified', 'guide'],
    prefix: ['guide technique', 'guide pratique', 'fiche technique', 'avis technique', 'cahier du cstb'],
  },
  {
    canonical: 'NORMES',
    exact:  ['normes', 'norme', 'nf', 'normes nf', 'norme nf', 'iso', 'standard'],
    // 'nf' covers "NF P 10-101" → normalized "nf p 10 101" startsWith "nf "
    // 'iso' covers "ISO 9001"   → normalized "iso 9001"    startsWith "iso "
    // 'en' covers "EN 1990"     → normalized "en 1990"     startsWith "en "
    prefix: ['normes nf', 'norme nf', 'nf', 'iso', 'en'],
  },
  {
    canonical: 'DTU',
    exact:  ['dtu'],
    // 'dtu' covers "DTU 20.1" → normalized "dtu 20.1" startsWith "dtu "
    prefix: ['dtu'],
  },
];

/**
 * Normalize a raw document category string to a canonical ExtractionCategory.
 *
 * Handles:
 *   "DTU"            → "DTU"
 *   "dtu"            → "DTU"
 *   "DTU 20.1"       → "DTU"
 *   "Eurocode"       → "EUROCODE"
 *   "EUROCODE 2"     → "EUROCODE"
 *   "guide technique" → "GUIDE_TECHNIQUE"
 *   "GUIDE_TECHNIQUE" → "GUIDE_TECHNIQUE"
 *   "NF P 10-101"    → "NORMES"
 *   "CODE_CONSTRUCTION" → "CODE_CONSTRUCTION"
 *   (unknown)        → throws Error (fail-fast — no silent routing)
 *
 * @param raw - Raw category value from knowledge_documents.category
 * @returns Canonical ExtractionCategory, or the raw value for unknown categories
 */
export function normalizeCategory(raw: string): ExtractionCategory {
  // 1. Normalize the input: lowercase, strip accents, underscores/hyphens → space, collapse whitespace
  const normalized = raw
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[_\-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // 2. Try each alias entry in order (first-match-wins)
  for (const { canonical, exact, prefix } of CATEGORY_ALIASES) {
    if (exact.includes(normalized)) return canonical;
    for (const p of prefix) {
      if (normalized.startsWith(p + ' ') || normalized.startsWith(p + '-')) return canonical;
    }
  }

  // 3. Unknown category: fail fast — do not silently route unknown inputs
  throw new Error(
    `[CategoryExtraction] Unknown document category: "${raw}". ` +
    `Supported: ${SUPPORTED_EXTRACTION_CATEGORIES.join(', ')}`,
  );
}

// =============================================================================
// Public API — router
// =============================================================================

/**
 * Route a chunk to the appropriate extraction function based on document category.
 *
 * Normalizes the category before routing so that "dtu", "DTU 20.1", "guide technique"
 * etc. all resolve to the correct extractor without additional preprocessing by callers.
 *
 * @param chunk    - Chunk with id, content, document_id, and category
 * @param category - Raw document category (from knowledge_documents.category)
 * @returns Array of extracted rules (may be empty if chunk has no actionable content)
 */
export function extractRulesByCategory(
  chunk: ChunkInput,
  category: string,
): ExtractedRule[] {
  const canonical = normalizeCategory(category);

  // Ensure the chunk itself carries the canonical category so downstream helpers
  // (e.g. extractRulesFromChunk which guards on chunk.category === 'DTU') see
  // the normalized value.
  const normalizedChunk: ChunkInput =
    canonical === chunk.category ? chunk : { ...chunk, category: canonical };

  switch (canonical) {
    case 'DTU':
      return extractDTURules(normalizedChunk);

    case 'EUROCODE':
      return extractEurocodeRules(normalizedChunk);

    case 'NORMES':
      return extractNormeRules(normalizedChunk);

    case 'GUIDE_TECHNIQUE':
      return extractGuideRules(normalizedChunk);

    case 'CODE_CONSTRUCTION':
      return extractLegalRules(normalizedChunk);

    default:
      return extractGenericRules(normalizedChunk);
  }
}

// Re-export category-specific functions for testing
export {
  extractDTURules,
  extractEurocodeRules,
  extractNormeRules,
  extractGuideRules,
  extractLegalRules,
  extractGenericRules,
};
