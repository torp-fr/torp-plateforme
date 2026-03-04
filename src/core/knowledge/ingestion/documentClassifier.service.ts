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
  | 'regulation'
  | 'technical_guide'
  | 'pricing_reference'
  | 'jurisprudence'
  | 'generic';

// ---------------------------------------------------------------------------
// Detection patterns
// ---------------------------------------------------------------------------

/**
 * Each entry is one candidate DocumentType paired with a list of patterns.
 * A document matches a type when ANY of its patterns is found (case-insensitive).
 *
 * Order defines priority: the first type whose patterns match wins.
 * More specific types (jurisprudence, regulation) are listed before broader
 * ones (technical_guide, pricing_reference) to avoid mis-classification.
 */
const CLASSIFICATION_RULES: ReadonlyArray<{
  type: DocumentType;
  patterns: ReadonlyArray<RegExp>;
}> = [
  {
    // Legal decisions — highly specific vocabulary, checked first
    // NOTE: generic "\barrêt\b" removed — false-positive on "robinets d'arrêt",
    // "arrêt de rive", etc. Use contextualised phrases only.
    type: 'jurisprudence',
    patterns: [
      /cour de cassation/i,
      /cour d'appel/i,
      /\bjugement\b/i,
      /\btribunal\b/i,
      /\bjuridiction\b/i,
      /attendu que/i,         // opening formula of French legal rulings
      /considérant que/i,     // reasoning clause in French legal decisions
      /arrêt\s+n°/i,          // "arrêt n° 123" — unambiguous case reference
    ],
  },
  {
    // Regulatory texts — numbered articles and formal obligation language.
    // Checked before pricing because regulation texts can mention prices (penalty clauses).
    // NOTE: "\bsection\s+\d+" removed — too broad; technical guides also use "Section N.M".
    //        French regulations are reliably identified by "Article N" / "Art. N" / "Chapitre".
    type: 'regulation',
    patterns: [
      /\barticle\s+\d+/i,   // "Article 1", "Article 12" — canonical French regulation structure
      /\bart\.\s*\d+/i,     // "Art. 3", "Art. 2.1"
      /\bchapitre\b/i,      // "Chapitre II" — regulation chapter divisions
      /\bobligation\b/i,
      /\bdécret\b/i,
      /\barrêté\b/i,        // "arrêté ministériel" — regulatory instrument (not court ruling)
    ],
  },
  {
    // Pricing documents — checked after regulation (reg texts can mention € in penalty clauses).
    // Use only high-precision pricing signals that don't appear in regulatory language.
    type: 'pricing_reference',
    patterns: [
      /€/,
      /\bEUR\b/,
      /prix\s+unitaire/i,   // specific column header in DPGF / BPU
      /\bttc\b/i,           // TTC (toutes taxes comprises) — pricing context
      /\btarif\b/i,
      /\bdevis\b/i,
    ],
  },
  {
    // Technical guides — procedural and implementation language
    type: 'technical_guide',
    patterns: [
      /\binstallation\b/i,
      /\bprocédure\b/i,
      /mise en œuvre/i,
      /\brecommandé\b/i,
      /\bmode opératoire\b/i,
      /\bprotocole\b/i,
      /\bconfiguration\b/i,
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
 * Complexity: O(T × P) where T = number of types (4) and P = number of
 * patterns per type (≤ 7). In practice this is a fixed-size constant scan.
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
