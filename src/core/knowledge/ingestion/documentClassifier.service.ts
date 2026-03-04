/**
 * Document Classifier Service
 * Identifies the type of a document from its normalized text content.
 *
 * Position in the ingestion pipeline:
 *   normalization → [THIS SERVICE] → chunking → embeddings
 *
 * Classification is:
 *  - Pure (no side effects, no I/O, no external calls)
 *  - Deterministic (same input always yields same result)
 *  - Fast (single linear scan per category, short-circuit on first match)
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type DocumentType =
  | 'jurisprudence'
  | 'normes'
  | 'pricing_reference'
  | 'technical_guide'
  | 'regulation'
  | 'generic';

// ---------------------------------------------------------------------------
// Detection patterns
// ---------------------------------------------------------------------------

/**
 * Each entry is one candidate DocumentType paired with a list of patterns.
 * A document matches a type when ANY of its patterns is found.
 *
 * Priority order (most specific → least specific):
 *  1. jurisprudence    — court vocabulary, unambiguous legal phrases
 *  2. normes           — standard identifiers (NF EN, ISO, Eurocode, EN NNN)
 *  3. pricing_reference— monetary signals (€, prix unitaire, tarif)
 *  4. technical_guide  — procedural / implementation language
 *  5. regulation       — only strict legal instrument patterns (Article N, Décret, Arrêté, Code)
 *  6. generic          — fallback
 *
 * Putting technical_guide BEFORE regulation prevents technical documents that
 * cite regulatory references from being mis-classified as regulations.
 * Putting normes BEFORE regulation prevents EN/ISO standards from matching
 * the "Article" patterns present in many normative documents.
 */
const CLASSIFICATION_RULES: ReadonlyArray<{
  type: DocumentType;
  patterns: ReadonlyArray<RegExp>;
}> = [
  {
    // Legal decisions — highly specific vocabulary, checked first.
    // NOTE: generic "\barrêt\b" removed — false-positive on "robinets d'arrêt",
    // "arrêt de rive", etc. Use contextualised phrases only.
    type: 'jurisprudence',
    patterns: [
      /cour de cassation/i,
      /conseil d'état/i,
      /cour d'appel/i,
      /\bjugement\b/i,
      /\btribunal\b/i,
      /\bjuridiction\b/i,
      /attendu que/i,       // opening formula of French legal rulings
      /considérant que/i,   // reasoning clause in French legal decisions
      /arrêt\s+n°/i,        // "arrêt n° 123" — unambiguous case reference
    ],
  },
  {
    // Technical standards — checked before regulation because normative documents
    // (ISO, EN, NF) contain "Article N" and "Section N" references that would
    // otherwise trigger the regulation classifier.
    type: 'normes',
    patterns: [
      /NF\s?EN/i,         // "NF EN 806", "NF EN ISO 13790"
      /\bISO\s+\d+/i,     // "ISO 9001", "ISO 13790"
      /Eurocode/i,        // "Eurocode 2", "Eurocode 7"
      /\bEN\s+\d{3,}/i,   // "EN 1717", "EN 806" (3+ digit code avoids "en" preposition)
    ],
  },
  {
    // Pricing documents — checked after normes (price tables can appear in standards).
    // Use only high-precision pricing signals absent from regulatory language.
    type: 'pricing_reference',
    patterns: [
      /€/,
      /\bEUR\b/,
      /prix\s+unitaire/i,   // canonical DPGF / BPU column header
      /\bttc\b/i,           // "toutes taxes comprises" — pricing context only
      /\btarif\b/i,
      /\bdevis\b/i,
    ],
  },
  {
    // Technical guides — procedural and implementation language.
    // Listed BEFORE regulation: guides frequently cite "Article N" from regulations,
    // so they must win when they also contain procedural signals.
    type: 'technical_guide',
    patterns: [
      /mise en œuvre/i,
      /\binstallation\b/i,
      /\bprocédure\b/i,
      /\brecommandé\b/i,
      /\bmode opératoire\b/i,
      /\bprotocole\b/i,
      /\bconfiguration\b/i,
    ],
  },
  {
    // Regulatory texts — only fire on strict legal instrument identifiers.
    // Overly broad triggers (\bchapitre\b, \bobligation\b, \bsection\b) removed:
    // they appear in technical guides and normative documents too.
    type: 'regulation',
    patterns: [
      /Article\s+\d+/i,   // "Article 1", "Article 12"
      /\bDécret\b/i,       // "Décret n° 2016-360"
      /\bArrêté\b/i,       // "Arrêté du 30 novembre 2005" (capital — instrument name)
      /\bCode\s/i,         // "Code civil", "Code de la construction"
    ],
  },
];

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Classify a normalized document by its textual content.
 *
 * Strategy: iterate candidate types in priority order; return the first type
 * whose pattern set contains at least one match. Falls back to 'generic' when
 * no patterns fire.
 *
 * Complexity: O(T × P) where T = number of types (5) and P = number of
 * patterns per type (≤ 9). In practice this is a fixed-size constant scan.
 *
 * @param text - Normalized document text (output of textNormalizer.service)
 * @returns Detected DocumentType
 */
export function classifyDocument(text: string): DocumentType {
  for (const rule of CLASSIFICATION_RULES) {
    for (const pattern of rule.patterns) {
      if (pattern.test(text)) {
        return rule.type;
      }
    }
  }

  return 'generic';
}
