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
    type: 'jurisprudence',
    patterns: [
      /cour de cassation/i,
      /\bjugement\b/i,
      /\barrêt\b/i,
      /\btribunal\b/i,
      /\bjuridiction\b/i,
    ],
  },
  {
    // Regulatory texts — numbered articles and formal obligation language
    type: 'regulation',
    patterns: [
      /\barticle\s+\d+/i,   // "Article 1", "Article 12"
      /\bart\.\s*\d+/i,     // "Art. 3"
      /\bsection\s+\d+/i,
      /\bchapitre\b/i,
      /\bobligation\b/i,
      /\bdécret\b/i,
      /\barrêté\b/i,
    ],
  },
  {
    // Pricing documents — currency symbols, price columns, price vocabulary
    type: 'pricing_reference',
    patterns: [
      /€/,
      /\bEUR\b/,
      /\bprix\b/i,
      /\btarif\b/i,
      /\bdevis\b/i,
      /\bhtva?\b/i,         // HT / HTA / TVA
      /\bttc\b/i,
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
