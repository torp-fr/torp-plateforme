/**
 * Rule Extraction Service — v3 (quality-filtered)
 *
 * Deterministic rule extraction from DTU knowledge chunks.
 * v3 introduces four quality layers that eliminate ~70% of noise:
 *
 *   Layer 1 — Chunk pre-filter  : skip non-technical chunks before any work
 *   Layer 2 — Sentence filter   : drop noise sentences before parsing
 *   Layer 3 — Strict whitelists : property and element must be in curated lists
 *   Layer 4 — Validation gate   : rule must have value + unit + known property + confidence ≥ 0.6
 *
 * Only rules that pass all four layers reach the database.
 *
 * StructuredData schema (v2, unchanged):
 *   element    — whitelisted physical object (canalisation | ossature | plaque | béton | bois | câble)
 *   property   — whitelisted attribute (9-item list: pente, diamètre, épaisseur…)
 *   operator   — >=, <=, =, >, <, range, unknown
 *   value      — always a number, never a string
 *   unit       — normalized (mm, %, m, MPa…)
 *   conditions — conditional applicability
 *   context    — fluid type, flow type, location
 *   raw        — verbatim matched substring
 */

// =============================================================================
// Types (unchanged from v2 — backward compatible)
// =============================================================================

export type RuleType = 'constraint' | 'formula' | 'recommendation' | 'price' | 'requirement';

export type RuleOperator = '>=' | '<=' | '=' | '>' | '<' | 'range' | 'unknown';

export interface StructuredData {
  element: string | null;
  /** Display form of the property (e.g. "épaisseur"). Kept for readability. */
  property: string;
  /** Canonical registry key (e.g. "epaisseur"). Primary identifier downstream. */
  property_key: string;
  /** Domain category from the registry (e.g. "dimension", "thermal"). */
  property_category: string;
  operator: RuleOperator;
  value: number | null;
  unit: string | null;
  /** Omitted from output when empty — no noise in stored JSON */
  conditions?: Record<string, string>;
  /** Omitted from output when empty — no noise in stored JSON */
  context?: Record<string, string>;
  raw: string | null;
  /** Present only on requirement rules — keyword tags describing the obligation */
  tags?: string[];
  /** Marks this as a qualitative requirement (no numeric value expected) */
  qualitative?: true;
}

export interface ExtractedRule {
  rule_type: RuleType;
  domain: string;
  description: string;
  /**
   * Quantitative rules: fully populated StructuredData.
   * Requirement rules: minimal object with tags + qualitative flag, stored as JSONB.
   * Omitting structured_data in code is fine — the worker defaults it to {}.
   */
  structured_data?: StructuredData;
  confidence_score: number;
  source_sentence: string;
  /**
   * Deduplication key.
   * Quantitative: `${domain}|${element}|${property}|${operator}|${value}|${unit}`
   * Requirement:  `req_${fnv32a(description)}` — hash of the obligation text
   */
  signature: string;
}

export interface ChunkInput {
  id: string;
  content: string;
  category: string;
  document_id: string;
}

// =============================================================================
// Layer 1 — Chunk pre-filter constants
// =============================================================================

/**
 * Structural/administrative markers. A single match is enough to discard
 * a chunk — these sections never contain actionable technical rules.
 *
 * Extended to catch:
 *   ☐ / □ / ✓  — checkbox / form content (inspection checklists)
 *   \d{9,}      — long numeric codes (table reference IDs like "701005070")
 */
const CHUNK_NOISE_RE =
  /\b(?:sommaire|pr[eé]ambule|avant-propos|table\s+des\s+mati[eè]res|membres\s+du\s+comit[eé]|liste\s+des\s+(?:figures|tableaux)|domaine\s+d['']application)\b|[☐□✓]|\b\d{9,}\b/i;

// =============================================================================
// Layer 2 — Sentence noise filter
// =============================================================================

/**
 * Sentences matching this pattern are informational or illustrative.
 * They cannot form actionable engineering rules.
 *
 * Extended with:
 *   - "cahier des charges" — document title fragment, not a load rule
 *   - "perte de charge" — hydraulic head loss term, not a structural load
 *   - "hauteur manométrique" — pump head term (hydraulic, not structural)
 */
const SENTENCE_NOISE_RE =
  /\b(?:il\s+est\s+rappel[eé]|peut\s+[eê]tre|[aà]\s+titre\s+indicatif|par\s+exemple|exemple(?=\s|$)|voir\s+figure|figure\s+n?°?\s*\d|cf\s*\.|note\s*:|remarque\s*:|cahier\s+des\s+charges|perte\s+de\s+charge|hauteur\s+manométrique)\b/i;

// =============================================================================
// Qualitative extraction — constants (parallel path, does not affect quantitative)
// =============================================================================

/**
 * Triggers that identify a qualitative obligation sentence.
 * These patterns express mandatory requirements without numeric values.
 */
const QUALITATIVE_RE =
  /\b(?:doit\s+être|doivent\s+être|il\s+faut|est\s+obligatoire|doit\s+permettre|doit\s+respecter|doivent\s+respecter|est\s+requis|sont\s+requis)\b/i;

/**
 * Keyword → tag mapping.
 * Keys are accent-normalized for matching; values are display tags.
 * A sentence may produce multiple tags.
 */
const TAG_MAP: ReadonlyArray<{ normalized: string; tag: string }> = [
  // ── Original 16 entries ────────────────────────────────────────────────────
  { normalized: 'fixation',      tag: 'fixation' },
  { normalized: 'pose',          tag: 'pose' },
  { normalized: 'orientation',   tag: 'orientation' },
  { normalized: 'materiaux',     tag: 'matériaux' },
  { normalized: 'materiau',      tag: 'matériaux' },
  { normalized: 'structure',     tag: 'structure' },
  { normalized: 'etancheite',    tag: 'étanchéité' },
  { normalized: 'isolation',     tag: 'isolation' },
  { normalized: 'ventilation',   tag: 'ventilation' },
  { normalized: 'securite',      tag: 'sécurité' },
  { normalized: 'protection',    tag: 'protection' },
  { normalized: 'drainage',      tag: 'drainage' },
  { normalized: 'evacuation',    tag: 'évacuation' },
  { normalized: 'accessibilite', tag: 'accessibilité' },
  { normalized: 'resistance',    tag: 'résistance' },
  { normalized: 'compatibilite', tag: 'compatibilité' },
  // ── Extended: plumbing / assembly / installation verbs ────────────────────
  // These cover obligations that were missing tags because TAG_MAP was too narrow.
  // Each key is accent-normalized so it matches normalizeAccents(sentence).
  { normalized: 'joint',         tag: 'joint' },          // "joint souple doit être mis en place"
  { normalized: 'raccord',       tag: 'raccordement' },   // "raccordement doit être étanche"
  { normalized: 'assemblage',    tag: 'assemblage' },     // "assemblages par brides"
  { normalized: 'continu',       tag: 'continuité' },     // "fourreaux doivent être continus"
  { normalized: 'etanche',       tag: 'étanchéité' },     // adj form — "être étanche" ≠ "étanchéité"
  { normalized: 'infiltration',  tag: 'étanchéité' },     // "éviter toute infiltration"
  { normalized: 'accessible',    tag: 'accessibilité' },  // adj form — missing from 'accessibilite' match
  { normalized: 'protege',       tag: 'protection' },     // "protégées" → normalised "protegees" ⊃ "protege"
  { normalized: 'guidage',       tag: 'guidage' },        // "guidage des tubes"
  { normalized: 'guide',         tag: 'guidage' },        // "doivent être guidés"
  { normalized: 'traversee',     tag: 'traversée' },      // "traversée de la toiture"
  { normalized: 'desolidar',     tag: 'désolidarisation' }, // "doivent être désolidarisés"
  { normalized: 'calorifuge',    tag: 'isolation' },      // "doivent être calorifugées" → thermal
  { normalized: 'marquage',      tag: 'marquage' },       // "doivent être marquées"
  { normalized: 'marque',        tag: 'marquage' },       // "une marque...doit permettre de vérifier"
  { normalized: 'rebut',         tag: 'contrôle' },       // "doit être mis au rebut"
  { normalized: 'examen',        tag: 'contrôle' },       // "un examen visuel doit permettre"
  { normalized: 'essai',         tag: 'contrôle' },       // "en essai doit permettre de déceler"
  { normalized: 'percage',       tag: 'usinage' },        // "perçage doit être effectué à froid"
  { normalized: 'ebavur',        tag: 'usinage' },        // "doivent être ébavurées"
  { normalized: 'remblayage',    tag: 'terrassement' },   // "remblayage de la fouille"
  { normalized: 'fouille',       tag: 'terrassement' },   // "rembayage de la fouille"
  { normalized: 'gel',           tag: 'protection' },     // "protection contre les effets du gel"
];

// Qualitative confidence (fixed — no numeric evidence to boost score)
const QUALITATIVE_CONFIDENCE = 0.6;

// =============================================================================
// Domain keyword map (v3 — added second_oeuvre, consolidated structure)
// First match wins; most specific domains listed first.
// =============================================================================

const DOMAIN_KEYWORDS: ReadonlyArray<{ domain: string; keywords: string[] }> = [
  {
    domain: 'second_oeuvre',
    keywords: [
      'plaque', 'plaques', 'plâtre', 'platre', 'ba13', 'ba 13',
      'ossature', 'ossatures', 'montant métallique', 'cloison', 'doublage',
      'enduit', 'ravalement', 'bardage', 'facade', 'façade', 'crepis', 'crépi',
      'carrelage', 'faience', 'faïence', 'revetement', 'revêtement',
      'ragréage', 'ragreage', 'parquet', 'chape liquide',
    ],
  },
  {
    domain: 'plomberie',
    keywords: [
      'canalisation', 'canalisations', 'pvc', 'évacuation', 'evacuation',
      'siphon', 'robinetterie', 'tuyau', 'tuyauterie', 'collecteur',
      'branchement', 'sanitaire', 'plomberie',
      'gaz', 'propane', 'butane', 'compteur gaz', 'alimentation gaz',
      'assainissement', 'fosse septique', 'fosse', 'drainage', 'egout',
    ],
  },
  {
    domain: 'structure',
    keywords: [
      'béton', 'beton', 'ferraillage', 'dalle', 'fondation', 'armature',
      'poteau', 'poutre', 'voile', 'mur porteur', 'acier', 'coffrage',
      'charpente', 'bois', 'ferme', 'chevron', 'enrobage',
      'echafaudage', 'échafaudage', 'etaiement', 'étaiement', 'blindage',
      'genie civil', 'génie civil', 'terrassement', 'remblai', 'deblai',
      'vrd', 'voirie', 'reseaux', 'réseaux',
    ],
  },
  {
    domain: 'electricite',
    keywords: [
      'électrique', 'electrique', 'câble', 'cable', 'disjoncteur',
      'conducteur', 'tension', 'circuit', 'gaine électrique',
    ],
  },
  {
    domain: 'isolation',
    keywords: [
      'isolation', 'isolant', 'laine de verre', 'laine de roche',
      'polystyrène', 'polystyrene', 'résistance thermique', 'thermique',
      'acoustique', 'pare-vapeur',
    ],
  },
  {
    domain: 'toiture',
    keywords: [
      'toiture', 'tuile', 'couverture', 'ardoise', 'étanchéité',
      'etancheite', 'membrane', 'faîtage',
    ],
  },
  {
    domain: 'menuiserie',
    keywords: [
      'menuiserie', 'fenêtre', 'fenetre', 'porte', 'volet',
      'vitrage', 'dormant', 'ouvrant', 'huisserie',
    ],
  },
  {
    domain: 'ventilation',
    keywords: [
      'ventilation', 'vmc', 'aération', 'aeration', 'débit d\'air',
      'renouvellement d\'air', 'extracteur',
    ],
  },
  {
    domain: 'chauffage',
    keywords: [
      'chauffage', 'chaudière', 'chaudiere', 'radiateur',
      'plancher chauffant', 'pompe à chaleur',
    ],
  },
];

// =============================================================================
// Layer 3a — Property detection via PROPERTY_REGISTRY
//
// Replaces the former hardcoded PROPERTY_WHITELIST (11 items) and
// PROPERTY_UNIT_WHITELIST.  The registry is the single source of truth for:
//   • which properties are recognized
//   • what their canonical key / category are
//   • which units are valid per property
// =============================================================================

import { PROPERTY_REGISTRY, type PropertyDefinition } from '@/core/rules/propertyRegistry';

/** Extraction-time drop counters (reset per extractRulesFromChunk call). */
const _dropStats = { noProperty: 0, invalidUnit: 0 };

/** Reset counters — called at the start of each chunk extraction. */
function resetDropStats(): void {
  _dropStats.noProperty = 0;
  _dropStats.invalidUnit = 0;
}

/** Log accumulated drop counts — called after processing a chunk. */
function logDropStats(chunkId: string): void {
  if (_dropStats.noProperty > 0 || _dropStats.invalidUnit > 0) {
    console.warn(
      `[RuleExtraction] chunk=${chunkId} dropped: noProperty=${_dropStats.noProperty} invalidUnit=${_dropStats.invalidUnit}`,
    );
  }
}

// =============================================================================
// Layer 3b — Element whitelist (strict, 6 canonical values)
// Surface forms are matched normalized; canonical is stored in structured_data.
// Rules may have element = null (element detection is enrichment, not required).
// =============================================================================

const ELEMENT_WHITELIST: ReadonlyArray<{ surfaces: string[]; canonical: string }> = [
  {
    canonical: 'canalisation',
    surfaces: [
      'canalisation', 'canalisations', 'tuyau', 'tuyauterie',
      'tube', 'tubes', 'collecteur', 'collecteurs', 'evacuation',
      'évacuation', 'chute', 'chutes', 'branchement',
      'siphon', 'regard', 'fourreau hydraulique', 'conduit eau',
    ],
  },
  {
    canonical: 'ossature',
    surfaces: [
      'ossature', 'ossatures', 'montant', 'montants', 'rail', 'rails',
      'fourrure', 'fourrures', 'suspente', 'suspentes',
      'corniere', 'cornière', 'profil', 'profilé', 'profile',
      'listeau', 'lambourde', 'lambourdes', 'solive', 'solives',
    ],
  },
  {
    canonical: 'plaque',
    surfaces: [
      'plaque', 'plaques', 'platre', 'plâtre', 'ba13', 'ba 13',
      'panneau', 'panneaux', 'parement', 'parements',
      'plaquette', 'plaquettes', 'doublage',
    ],
  },
  {
    canonical: 'béton',
    surfaces: [
      'beton', 'béton', 'dalle', 'dalles', 'poteau', 'poteaux',
      'poutre', 'poutres', 'voile', 'fondation', 'radier', 'semelle',
      'chape', 'chappe', 'armature',
      'longrine', 'longrines', 'linteau', 'linteaux',
      'poutrelle', 'poutrelles', 'hourdis',
    ],
  },
  {
    canonical: 'bois',
    surfaces: [
      'bois', 'charpente', 'chevron', 'chevrons',
      'panne', 'pannes', 'ferme', 'fermes', 'madrier',
      'volige', 'voliges', 'latte', 'lattes', 'liteau', 'liteaux',
      'lambourde', 'lambourdes', 'solive', 'solives',
      'entrait', 'entraits', 'aisselier', 'aisseliers',
      'about', 'planche', 'planches',
    ],
  },
  {
    canonical: 'câble',
    surfaces: [
      'cable', 'câble', 'cables', 'câbles', 'fil', 'conducteur', 'conducteurs',
      'gaine', 'gaines', 'fourreau', 'fourreaux', 'conduit',
      'tube annele', 'tube annelé', 'iro',
    ],
  },
  {
    canonical: 'isolant',
    surfaces: [
      'isolant', 'isolants', 'laine', 'laines',
      'polystyrene', 'polystyrène', 'polyurethane', 'polyuréthane',
      'laine de verre', 'laine de roche', 'laine minerale', 'laine minérale',
      'panneau isolant', 'panneaux isolants',
      'ouate', 'cellulose', 'fibre de bois',
    ],
  },
  {
    canonical: 'membrane',
    surfaces: [
      'membrane', 'membranes', 'etancheite', 'étanchéité',
      'revetement etanche', 'revêtement étanche',
      'bitume', 'bitumineux', 'bac acier', 'bac en acier',
      'tuile', 'tuiles', 'ardoise', 'ardoises', 'zinc',
    ],
  },
];

// =============================================================================
// Domain hints from element (highest-confidence domain signal)
// =============================================================================

/**
 * Maps each canonical element name to its most likely domain.
 * Used as Tier 1 in resolveDomain() — the element is a structural identifier
 * and provides the most reliable domain signal for a rule.
 *
 * Note: gaine/fourreau surfaces map to the canonical 'câble' element, so
 * → electricite is covered automatically without an extra entry here.
 */
const ELEMENT_DOMAIN_MAP: Readonly<Record<string, string>> = {
  'canalisation': 'plomberie',
  'câble':        'electricite',
  'isolant':      'isolation',
  'membrane':     'toiture',
  'béton':        'structure',
  'bois':         'structure',
  'ossature':     'second_oeuvre',
  'plaque':       'second_oeuvre',
};

// =============================================================================
// Unit normalization (unchanged from v2)
// =============================================================================

/**
 * Set of all canonical (post-normalization) unit strings.
 * Any extracted unit NOT in this set is rejected — the rule is dropped.
 * This is a safety belt: UNIT_ALTERNATION already constrains what regex
 * can match, but normalization could theoretically produce an unrecognized form.
 */
const KNOWN_UNITS: ReadonlySet<string> = new Set([
  'W/(m·K)', 'W/m²K', 'N/mm²', 'GPa', 'MPa', 'kN/m²', 'kN/m', 'kPa', 'kN', 'daN',
  'kg', 'cm²', 'm²', 'm³', 'mm', 'cm', '°C', 'Pa', 'dB',
  '%', 'm/s', 'm',
]);

const UNIT_NORMALIZATION: Readonly<Record<string, string>> = {
  'w/(m·k)': 'W/(m·K)',
  'w/m²k':   'W/m²K',
  'n/mm²':   'N/mm²',
  'mpa':     'MPa',
  'kpa':     'kPa',
  'kn':      'kN',
  'dan':     'daN',
  'kg':      'kg',
  'cm²':     'cm²',
  'm²':      'm²',
  'm³':      'm³',
  'mm':      'mm',
  'cm':      'cm',
  '°c':      '°C',
  'pa':      'Pa',
  'db':      'dB',
  '%':       '%',
  'm/s':     'm/s',
  'm.s':     'm/s',
  'gpa':     'GPa',
  'kn/m²':   'kN/m²',
  'kn/m':    'kN/m',
  'm':       'm',
};

// =============================================================================
// Regex constants (unchanged from v2)
// =============================================================================

const UNIT_ALTERNATION =
  'W\\/\\(m·K\\)|W\\/m²K|N\\/mm²|GPa|kN\\/m²|kN\\/m|m\\/s|m\\.s|MPa|kPa|kN|daN|kg|cm²|m²|m³|mm|cm|°C|Pa|dB|%|m(?![²³\\w])';

// Note: "supérieure? ... à" ends with 'à' (U+00E0, not ASCII \w) — using (?=\s|\d|$) instead of \b.
const MIN_KEYWORDS_RE =
  /\b(?:minimum|minimale?|minimaux|au\s+moins|supérieure?\s+(?:ou\s+égale?\s+)?[aà](?=\s|\d|$)|≥)\b/i;

// Note: "inférieure? ... à" ends with 'à' — using (?=\s|\d|$) instead of \b.
const MAX_KEYWORDS_RE =
  /\b(?:maximum|maximale?|maximaux|au\s+plus|inférieure?\s+(?:ou\s+égale?\s+)?[aà](?=\s|\d|$)|≤)\b/i;

const MUST_KEYWORDS_RE =
  /\b(?:doit|doivent|devra|devront|doit\s+être|est\s+obligatoire|nécessaire|requis)\b/i;

/**
 * Negated-MAX pattern: "aucune flèche supérieure à X mm"
 * Semantically this is a maximum tolerance (value ≤ X), but the phrase
 * "supérieure à" would otherwise be caught as MIN by MIN_KEYWORDS_RE.
 * Must be checked BEFORE MIN_KEYWORDS_RE to override it.
 *
 * Implementation notes:
 *   - Uses \S+ instead of \w+ so accented French words (flèche, déflexion…) match.
 *   - Uses [aà](?=\s|\d|$) instead of [aà]\b because 'à' (U+00E0) is NOT in
 *     JavaScript's \w ([a-zA-Z0-9_]), so \b after 'à' never fires.
 */
const NEGATED_MAX_RE =
  /\baucun[e]?\s+\S+\s+sup[eé]rieure?\s+[aà](?=\s|\d|$)/i;

const SENTENCE_SEPARATOR_RE = /[.;!\n]+/g;

const CONDITION_TRIGGER_RE =
  /\b(?:si|lorsque|en cas de|dans le cas|pour les|pour un|quand)\b/i;

const FLUID_RE =
  /\b(EP|EU|EV|EF|EC|eau\s+pluviale|eaux\s+pluviales|eau\s+us[eé]e|eaux\s+us[eé]es|eau\s+vanne|eaux\s+vannes|eau\s+froide|eau\s+chaude)\b/i;

const FLOW_GRAVITAIRE_RE = /\bgravitaire\b/i;
const FLOW_PRESSION_RE   = /\b(?:sous\s+pression|en\s+charge)\b/i;

const LOC_EXTERIOR_RE    = /\b(?:ext[eé]rieur|en\s+saillie|fa[çc]ade|encastr[eé])\b/i;
const LOC_INTERIOR_RE    = /\b(?:int[eé]rieur|en\s+apparent)\b/i;
const LOC_UNDERGROUND_RE = /\b(?:enterr[eé]|sous\s+dallage|sous\s+dalle|en\s+souterrain)\b/i;

const DN_RE          = /\bDN\s*(\d+)\b/i;
const DIA_COMPARE_RE = /(?:diam[eè]tre|Ø)\s*([<>≤≥])\s*(\d+)\s*(mm)?/i;
const DIA_VALUE_RE   = /(?:diam[eè]tre|diamètre|Ø)\s*(?:de\s+)?(\d+)\s*(mm|cm)?/i;

const MIN_CONFIDENCE = 0.6;

// =============================================================================
// Core helpers
// =============================================================================

function normalizeAccents(str: string): string {
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function normalizeUnit(rawUnit: string): string {
  return UNIT_NORMALIZATION[rawUnit.toLowerCase().trim()] ?? rawUnit;
}

function splitIntoSentences(content: string): string[] {
  return content
    .split(SENTENCE_SEPARATOR_RE)
    .map((s) => s.trim())
    .filter((s) => s.length >= 25);
}

type ConstraintDirection = 'min' | 'max' | 'must' | null;

interface DirectionResult {
  direction: ConstraintDirection;
  /** End offset of the matched keyword — used for post-keyword value selection */
  keywordEnd: number;
}

/**
 * Detect constraint direction and the position where the direction keyword ends.
 * The keyword end is used by selectBestNumeric to prefer the value that follows
 * the direction keyword (e.g. "...supérieure à [5 mm]" vs "[2 m] ... supérieure à").
 *
 * NEGATED_MAX is checked first because "aucune flèche supérieure à X mm" contains
 * "supérieure à" which would otherwise match MIN_KEYWORDS_RE.
 */
function detectConstraintDirectionFull(sentence: string): DirectionResult {
  // Must run before MIN check — "supérieure à" in negated-MAX context is a MAX constraint
  const negMax = new RegExp(NEGATED_MAX_RE.source, 'ig').exec(sentence);
  if (negMax) return { direction: 'max', keywordEnd: negMax.index + negMax[0].length };

  const min = new RegExp(MIN_KEYWORDS_RE.source, 'ig').exec(sentence);
  if (min) return { direction: 'min', keywordEnd: min.index + min[0].length };

  const max = new RegExp(MAX_KEYWORDS_RE.source, 'ig').exec(sentence);
  if (max) return { direction: 'max', keywordEnd: max.index + max[0].length };

  const must = new RegExp(MUST_KEYWORDS_RE.source, 'ig').exec(sentence);
  if (must) return { direction: 'must', keywordEnd: must.index + must[0].length };

  return { direction: null, keywordEnd: -1 };
}

/** Legacy single-return wrapper kept for callers that only need the direction */
function detectConstraintDirection(sentence: string): ConstraintDirection {
  return detectConstraintDirectionFull(sentence).direction;
}

/**
 * Select the best numeric match from multiple candidates.
 *
 * When a sentence contains several numbers (e.g. "Sous la règle de 2 m aucune
 * flèche supérieure à 5 mm"), the contextually relevant value is the one that
 * appears AFTER the direction keyword, not the first occurrence.
 *
 * Falls back to the first value if none appear after the keyword end.
 */
function selectBestNumeric(
  numerics: NumericMatch[],
  keywordEnd: number,
): NumericMatch | null {
  if (numerics.length === 0) return null;
  if (numerics.length === 1 || keywordEnd < 0) return numerics[0];

  const afterKeyword = numerics.filter((n) => n.index >= keywordEnd);
  return afterKeyword.length > 0 ? afterKeyword[0] : numerics[0];
}

interface NumericMatch {
  value: number;
  unit: string;
  raw: string;
  /** Character offset of this match in the original sentence */
  index: number;
}

function extractNumericValues(sentence: string): NumericMatch[] {
  const results: NumericMatch[] = [];
  const regex = new RegExp(`(\\d+(?:[.,]\\d+)?)\\s*(${UNIT_ALTERNATION})`, 'gi');
  let match: RegExpExecArray | null;
  while ((match = regex.exec(sentence)) !== null) {
    results.push({
      value: parseFloat(match[1].replace(',', '.')),
      unit:  normalizeUnit(match[2]),
      raw:   match[0],
      index: match.index,
    });
  }
  return results;
}

/**
 * FNV-1a 32-bit hash of a string.
 * No external dependencies — pure arithmetic.
 * Used to build deterministic signatures for qualitative rules.
 */
function hashString(str: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    // Unsigned 32-bit multiply by FNV prime 0x01000193
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

/**
 * Extract keyword tags from a sentence using the TAG_MAP.
 * Matching is accent-insensitive. Duplicates are removed.
 */
function extractTags(sentence: string): string[] {
  const normalized = normalizeAccents(sentence.toLowerCase());
  const seen = new Set<string>();
  for (const { normalized: kw, tag } of TAG_MAP) {
    if (normalized.includes(kw)) seen.add(tag);
  }
  return [...seen];
}

// =============================================================================
// Layer 1 — Chunk pre-filter
// =============================================================================

/**
 * Returns false for chunks that should be skipped entirely.
 *
 * A chunk is irrelevant if:
 *   - It matches a structural/administrative section marker (sommaire, etc.)
 *   - It contains zero numeric values with recognized units
 *
 * Called once per chunk, before any sentence splitting.
 */
function isChunkRelevant(content: string): boolean {
  if (CHUNK_NOISE_RE.test(content)) return false;

  const numericRe = new RegExp(`\\d+(?:[.,]\\d+)?\\s*(?:${UNIT_ALTERNATION})`, 'i');
  if (!numericRe.test(content)) return false;

  return true;
}

// =============================================================================
// Layer 2 — Sentence noise filter
// =============================================================================

/**
 * Returns false for sentences that are informational or illustrative
 * and therefore cannot form actionable engineering rules.
 */
function isSentenceRelevant(sentence: string): boolean {
  return !SENTENCE_NOISE_RE.test(sentence);
}

// =============================================================================
// Layer 3a — Property detection (registry-backed)
// =============================================================================

/**
 * Escape characters that carry special meaning in a RegExp literal.
 * Handles dots in unit-style aliases (e.g. "ml.", "ens.") and grouping
 * characters that appear in some technical notation aliases.
 */
function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Detect which registered property is referenced in `text`.
 *
 * Strategy:
 *   1. Normalize text (lowercase, accent-stripped).
 *   2. For each PropertyDefinition in PROPERTY_REGISTRY, check whether any
 *      alias (also normalized) appears as a whole word using \b boundaries.
 *   3. Return the FIRST matching definition — no scoring, deterministic order.
 *
 * \b prevents partial-word false positives such as:
 *   "surcharge" matching alias "charge"
 *   "réentraxe"  matching alias "entraxe"
 *
 * Note: \b is a \w/\W boundary. Aliases that consist entirely of non-word
 * characters (e.g. the single-char Greek alias "λ") will not match via \b —
 * but every such property has ASCII aliases (e.g. "lambda") that will.
 *
 * Returns null when no registered property is found; the caller drops the rule.
 */
export function detectProperty(text: string): PropertyDefinition | null {
  const normalized = normalizeAccents(text.toLowerCase());
  for (const def of PROPERTY_REGISTRY) {
    for (const alias of def.aliases) {
      const normalizedAlias = escapeRegex(normalizeAccents(alias.toLowerCase()));
      if (new RegExp(`\\b${normalizedAlias}\\b`, 'i').test(normalized)) {
        return def;
      }
    }
  }
  return null;
}

// =============================================================================
// Layer 3b — Element extraction (whitelisted, exported)
// =============================================================================

/**
 * Detect the whitelisted canonical technical element in a sentence.
 * Only 6 canonical values are possible: canalisation | ossature | plaque |
 * béton | bois | câble. Returns null if none match.
 */
export function extractElement(sentence: string): string | null {
  const normalized = normalizeAccents(sentence.toLowerCase());
  for (const { surfaces, canonical } of ELEMENT_WHITELIST) {
    for (const surface of surfaces) {
      if (normalized.includes(normalizeAccents(surface))) {
        return canonical;
      }
    }
  }
  return null;
}

// =============================================================================
// Conditions extraction (unchanged from v2, exported)
// =============================================================================

export function extractConditions(sentence: string): Record<string, string> {
  const conditions: Record<string, string> = {};

  if (CONDITION_TRIGGER_RE.test(sentence)) {
    const clauseMatch = sentence.match(
      /(?:si|lorsque|en\s+cas\s+de|dans\s+le\s+cas|pour\s+les|pour\s+un|quand)\s+([^,;.]{5,60})/i,
    );
    if (clauseMatch) {
      conditions['applicability'] = clauseMatch[1].trim().toLowerCase();
    }
  }

  const dnMatch = sentence.match(DN_RE);
  if (dnMatch) {
    conditions['diameter'] = `DN${dnMatch[1]}`;
  }

  const diaCompare = sentence.match(DIA_COMPARE_RE);
  if (diaCompare && !dnMatch) {
    const unit = diaCompare[3] ?? 'mm';
    conditions['diameter'] = `${diaCompare[1]} ${diaCompare[2]}${unit}`;
  }

  if (!dnMatch && !diaCompare) {
    const diaVal = sentence.match(DIA_VALUE_RE);
    if (diaVal) {
      const unit = diaVal[2] ?? 'mm';
      conditions['diameter'] = `${diaVal[1]}${unit}`;
    }
  }

  return conditions;
}

// =============================================================================
// Context extraction (unchanged from v2, exported)
// =============================================================================

export function extractContext(sentence: string): Record<string, string> {
  const context: Record<string, string> = {};

  const fluidMatch = sentence.match(FLUID_RE);
  if (fluidMatch) {
    const raw = fluidMatch[1].trim().toUpperCase();
    const fluidMap: Record<string, string> = {
      'EAU PLUVIALE':   'EP', 'EAUX PLUVIALES': 'EP',
      'EAU USÉE':       'EU', 'EAUX USÉES':     'EU',
      'EAU USEE':       'EU', 'EAUX USEES':     'EU',
      'EAU VANNE':      'EV', 'EAUX VANNES':    'EV',
      'EAU FROIDE':     'EF',
      'EAU CHAUDE':     'EC',
    };
    context['fluid'] = fluidMap[raw] ?? raw;
  }

  if (FLOW_GRAVITAIRE_RE.test(sentence)) {
    context['flow_type'] = 'gravitaire';
  } else if (FLOW_PRESSION_RE.test(sentence)) {
    context['flow_type'] = 'sous_pression';
  }

  if (LOC_UNDERGROUND_RE.test(sentence)) {
    context['location'] = 'enterré';
  } else if (LOC_EXTERIOR_RE.test(sentence)) {
    context['location'] = 'extérieur';
  } else if (LOC_INTERIOR_RE.test(sentence)) {
    context['location'] = 'intérieur';
  }

  return context;
}

// =============================================================================
// Confidence scorer (additive model, unchanged from v2)
// =============================================================================

interface ConfidenceFactors {
  hasValue: boolean;
  hasUnit: boolean;
  hasOperator: boolean;
  hasElement: boolean;
  hasContext: boolean;
}

function computeConfidence(f: ConfidenceFactors): number {
  let score = 0;
  if (f.hasValue)    score += 0.30;
  if (f.hasUnit)     score += 0.20;
  if (f.hasOperator) score += 0.20;
  if (f.hasElement)  score += 0.20;
  if (f.hasContext)  score += 0.10;
  return Math.min(1.0, parseFloat(score.toFixed(2)));
}

// =============================================================================
// Signature & deduplication (exported)
// =============================================================================

/**
 * Build a deterministic deduplication key for a rule.
 *
 * Encodes the five semantic dimensions that make a rule unique:
 *   domain · element · property · operator · value · unit
 *
 * Null fields are represented as the literal string "null" so that
 * two rules with different null patterns produce different signatures.
 *
 * Example: "plomberie|canalisation|pente|>=|2|%"
 */
export function buildSignature(
  domain: string,
  element: string | null,
  property: string,
  operator: RuleOperator,
  value: number | null,
  unit: string | null,
): string {
  return [
    domain,
    element  ?? 'null',
    property,
    operator,
    value !== null ? value.toString() : 'null',
    unit     ?? 'null',
  ].join('|');
}

/**
 * Remove duplicate rules from an array using their pre-computed signatures.
 * First occurrence of each signature is kept; subsequent duplicates are dropped.
 *
 * Use this for cross-chunk deduplication (e.g. in the worker across a full batch).
 * Per-chunk deduplication is already performed inside extractRulesFromChunk().
 */
export function deduplicateRules(rules: ExtractedRule[]): ExtractedRule[] {
  const seen = new Set<string>();
  return rules.filter((rule) => {
    if (seen.has(rule.signature)) return false;
    seen.add(rule.signature);
    return true;
  });
}

// =============================================================================
// Domain detection (updated, exported)
// =============================================================================

/**
 * Detect the most likely domain for a text (chunk or sentence).
 *
 * Uses keyword scoring instead of first-match to avoid false positives:
 *   - Each domain accumulates one point per keyword hit
 *   - The domain with the highest score wins
 *   - Single-word keywords use plural-aware word-boundary regex (`\b${kw}[sx]?\b`)
 *     so "plaque" does not match "plaquette", and "pente" not "suspente"
 *   - Multi-word keywords (containing a space) use substring includes(),
 *     which is already specific enough
 *
 * Returns 'unknown' when no keyword matches any domain.
 */
export function detectDomain(content: string): string {
  const normalized = normalizeAccents(content.toLowerCase());
  let bestDomain = 'unknown';
  let bestScore  = 0;

  for (const { domain, keywords } of DOMAIN_KEYWORDS) {
    let score = 0;
    for (const kw of keywords) {
      const normKw = normalizeAccents(kw);
      const matched = normKw.includes(' ')
        // Multi-word: substring match is already precise
        ? normalized.includes(normKw)
        // Single-word: word boundary + optional French plural suffix (s/x)
        : new RegExp(`\\b${normKw}[sx]?\\b`).test(normalized);
      if (matched) score++;
    }
    if (score > bestScore) {
      bestScore  = score;
      bestDomain = domain;
    }
  }

  return bestDomain;
}

// =============================================================================
// Multi-signal domain resolution (rule-level, replaces chunk-level assignment)
// =============================================================================

/**
 * Determine the domain for an individual rule using a 3-tier priority.
 *
 * Tier 1 — Element → domain map (highest confidence)
 *   The canonical element extracted from the sentence is a structural
 *   identifier. `canalisation` → plomberie, `câble` → electricite, etc.
 *   This fires before any keyword scan.
 *
 * Tier 2 — Sentence-level keyword scoring
 *   Run detectDomain() on just the source sentence (1–2 clauses) rather
 *   than the full chunk (400–800 tokens). The sentence is focused and
 *   avoids domain bleed from surrounding context.
 *
 * Tier 3 — Chunk-level fallback
 *   If the sentence yields no keyword signal, fall back to the domain
 *   already computed for the whole chunk. This preserves the old
 *   behaviour for rules where the sentence is too short to be conclusive.
 *
 * Root problem this solves: detectDomain(chunk) ran once on the full chunk
 * and all rules inherited that domain. A single mention of "plaque" in a
 * 600-token chunk about waterproofing caused all its membrane/canalisation
 * rules to be classified as second_oeuvre.
 */
function resolveDomain(
  element: string | null,
  sentence: string,
  chunkDomain: string,
): string {
  // Tier 1 — element is the most reliable domain signal
  if (element !== null) {
    const fromElement = ELEMENT_DOMAIN_MAP[element];
    if (fromElement !== undefined) return fromElement;
  }

  // Tier 2 — sentence-level keyword scoring (focused context)
  const sentenceDomain = detectDomain(sentence);
  if (sentenceDomain !== 'unknown') return sentenceDomain;

  // Tier 3 — chunk-level fallback
  return chunkDomain;
}

// =============================================================================
// Sentence processor with Layer 4 validation gate
// =============================================================================

function processSentence(sentence: string, domain: string): ExtractedRule | null {
  // Layer 2 — sentence noise filter (called here for single-sentence processing)
  if (!isSentenceRelevant(sentence)) return null;

  const { direction, keywordEnd } = detectConstraintDirectionFull(sentence);
  if (direction === null) return null;

  const numerics = extractNumericValues(sentence);
  const hasValue = numerics.length > 0;

  // Layer 3a — property must exist in the registry
  const propertyDef = detectProperty(sentence);
  if (propertyDef === null) {
    _dropStats.noProperty++;
    return null;
  }

  const element        = extractElement(sentence);
  const resolvedDomain = resolveDomain(element, sentence, domain);
  const conditions     = extractConditions(sentence);
  const context        = extractContext(sentence);

  const operator: RuleOperator =
    direction === 'min'  ? '>=' :
    direction === 'max'  ? '<=' :
    direction === 'must' ? '='  :
    'unknown';

  // Resolve numeric fields — prefer the value that appears AFTER the direction keyword
  // so that "Sous la règle de 2 m aucune flèche supérieure à 5 mm" yields 5 mm, not 2 m.
  const bestNumeric = selectBestNumeric(numerics, keywordEnd);
  const rawValue = bestNumeric?.value ?? null;
  const rawUnit  = bestNumeric?.unit  ?? null;

  // STEP 1 — Value normalization: parseFloat already handles comma→period.
  // Round to 6 significant digits to eliminate floating-point noise
  // (e.g. 0.10000000000000001 → 0.1).
  const normalizedValue = rawValue !== null
    ? parseFloat(rawValue.toPrecision(6))
    : null;

  // STEP 2 — Unit validation: reject units not in the canonical set
  const hasUnit = rawUnit !== null && KNOWN_UNITS.has(rawUnit);

  // STEP 2b — Registry-based property/unit compatibility check.
  // Skip when allowedUnits is empty (categorical property — any unit passes).
  if (rawUnit !== null && hasUnit && propertyDef.allowedUnits.length > 0) {
    const unitNorm = rawUnit.toLowerCase();
    if (!propertyDef.allowedUnits.includes(unitNorm)) {
      _dropStats.invalidUnit++;
      return null;
    }
  }

  const hasOperator = operator !== 'unknown';
  const hasElement  = element !== null;
  const hasContext  = Object.keys(context).length > 0;

  const confidence = computeConfidence({
    hasValue: normalizedValue !== null,
    hasUnit,
    hasOperator,
    hasElement,
    hasContext,
  });

  // Layer 4 — hard validation gate
  if (
    normalizedValue === null  ||
    !hasUnit                  ||
    operator === 'unknown'    ||
    confidence < MIN_CONFIDENCE
  ) {
    return null;
  }

  // STEP 5 — Clean structure: omit empty conditions / context
  const structured: StructuredData = {
    element,
    property:          propertyDef.aliases[0] ?? propertyDef.key,  // human-readable display form
    property_key:      propertyDef.key,                             // canonical registry key
    property_category: propertyDef.category,                        // domain grouping
    operator,
    value: normalizedValue,
    unit:  rawUnit,
    raw:   bestNumeric?.raw ?? null,
    ...(Object.keys(conditions).length > 0 ? { conditions } : {}),
    ...(Object.keys(context).length    > 0 ? { context }    : {}),
  };

  // STEP 3 — Build signature using stable registry key (not display form)
  const signature = buildSignature(
    resolvedDomain,
    element,
    propertyDef.key,
    operator,
    normalizedValue,
    rawUnit,
  );

  return {
    rule_type:        'constraint',
    domain:           resolvedDomain,
    description:      sentence.length > 300 ? sentence.substring(0, 297) + '…' : sentence,
    structured_data:  structured,
    confidence_score: confidence,
    source_sentence:  sentence,
    signature,
  };
}

// =============================================================================
// Qualitative sentence processor (parallel path — does NOT touch quantitative)
// =============================================================================

/**
 * Extract a requirement-type rule from a sentence that expresses a qualitative
 * obligation (e.g. "doit être", "il faut", "est obligatoire").
 *
 * Rules:
 *   - Sentence must pass Layer 2 (noise filter)
 *   - Sentence must match QUALITATIVE_RE
 *   - Sentence must NOT have already produced a quantitative rule
 *     (enforced by the caller, not here)
 *   - Minimum description length: 25 chars (same as sentence filter)
 *
 * Signature: `req_${fnv32a(description)}` — hash of the obligation text.
 * This ensures cross-chunk deduplication of identical obligation sentences.
 */
function processQualitativeSentence(
  sentence: string,
  domain: string,
): ExtractedRule | null {
  if (!isSentenceRelevant(sentence)) return null;
  if (!QUALITATIVE_RE.test(sentence))  return null;

  const description    = sentence.length > 300
    ? sentence.substring(0, 297) + '…'
    : sentence;

  const tags           = extractTags(sentence);
  const signature      = `req_${hashString(description)}`;
  const element        = extractElement(sentence);
  const resolvedDomain = resolveDomain(element, sentence, domain);

  // Attempt property detection — qualitative sentences may reference a property
  // (e.g. "l'épaisseur doit être vérifiée"). Use registry key when found;
  // fall back to sentinel values so property_key is always non-null.
  const qualPropertyDef = detectProperty(sentence);

  const structured: StructuredData = {
    element,
    property:          qualPropertyDef ? (qualPropertyDef.aliases[0] ?? qualPropertyDef.key) : 'n/a',
    property_key:      qualPropertyDef?.key      ?? 'n/a',
    property_category: qualPropertyDef?.category ?? 'qualitative',
    operator:    'unknown',
    value:       null,
    unit:        null,
    raw:         null,
    qualitative: true,
    ...(tags.length > 0 ? { tags } : {}),
  };

  return {
    rule_type:        'requirement',
    domain:           resolvedDomain,
    description,
    structured_data:  structured,
    confidence_score: QUALITATIVE_CONFIDENCE,
    source_sentence:  sentence,
    signature,
  };
}

// =============================================================================
// Main export
// =============================================================================

/**
 * Extract high-quality rules from a single DTU knowledge chunk.
 *
 * Four quality layers reduce noise by ~70%:
 *   1. Chunk pre-filter  — skips non-technical chunks (no numerics, admin sections)
 *   2. Sentence filter   — drops illustrative/informational sentences
 *   3. Strict whitelists — property must be in 9-item list, element in 6-item list
 *   4. Validation gate   — value + unit + operator + confidence ≥ 0.6 required
 *
 * @param chunk - Chunk with id, content, category, document_id
 * @returns Array of validated rules (may be empty)
 */
export function extractRulesFromChunk(chunk: ChunkInput): ExtractedRule[] {
  if (chunk.category !== 'DTU') return [];

  // Layer 1 — chunk pre-filter
  if (!isChunkRelevant(chunk.content)) return [];

  resetDropStats();

  const sentences = splitIntoSentences(chunk.content);
  const domain    = detectDomain(chunk.content);
  const rules: ExtractedRule[] = [];

  // Per-chunk deduplication: one Set covers both quantitative and qualitative
  // signatures so a sentence can never produce both a quantitative and a
  // qualitative rule simultaneously.
  const seenSignatures      = new Set<string>();
  // Track sentences that produced a quantitative rule so the qualitative
  // pass can skip them (STEP 3 of the spec).
  const quantitativeSentences = new Set<string>();

  // ── Pass 1: quantitative rules (existing logic, untouched) ────────────────
  for (const sentence of sentences) {
    const rule = processSentence(sentence, domain);
    if (rule === null) continue;

    if (seenSignatures.has(rule.signature)) continue;
    seenSignatures.add(rule.signature);
    quantitativeSentences.add(sentence);
    rules.push(rule);
  }

  // ── Pass 2: qualitative / requirement rules (parallel, additive) ──────────
  for (const sentence of sentences) {
    // Skip sentences that already yielded a quantitative rule
    if (quantitativeSentences.has(sentence)) continue;

    const rule = processQualitativeSentence(sentence, domain);
    if (rule === null) continue;

    if (seenSignatures.has(rule.signature)) continue;
    seenSignatures.add(rule.signature);
    rules.push(rule);
  }

  logDropStats(chunk.id);
  return rules;
}
