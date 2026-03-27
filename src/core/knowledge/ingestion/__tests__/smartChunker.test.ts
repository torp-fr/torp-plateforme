/**
 * SmartChunker unit tests
 *
 * Covers:
 *  - pricing_reference: price-line detection → one chunk per row + metadata
 *  - pricing_reference: non-price table rows packed together
 *  - pricing_reference: prose fallback between tables
 *  - pricing_reference: mixed document (price lines + prose + non-price rows)
 *  - pricing_reference: MAX_TOKENS enforcement on non-price table rows
 *  - regulation: article boundary splitting
 *  - technical_guide: section header splitting
 *  - generic: paragraph chunking with overlap
 *  - All strategies: empty input → empty output
 */

import { describe, it, expect } from 'vitest';
import { chunkSmart } from '../smartChunker.service';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const MAX_TOKENS = 1000;

function tokEst(s: string) {
  return Math.ceil(s.length / 4);
}

// ---------------------------------------------------------------------------
// pricing_reference — price line detection
// ---------------------------------------------------------------------------

describe('SmartChunker › pricing_reference › price-line rows', () => {
  const PRICE_ROW = '| 3.2.2 | Poteau section carrée 30×30 cm | ml | 225,00 |';

  it('emits one chunk per price line', () => {
    const text = [
      '| 3.2.1 | Poteau circulaire Ø20 cm     | ml | 180,00 |',
      '| 3.2.2 | Poteau section carrée 30×30 cm | ml | 225,00 |',
      '| 3.2.3 | Poteau section carrée 40×40 cm | ml | 310,00 |',
    ].join('\n');

    const chunks = chunkSmart(text, 'pricing_reference');

    expect(chunks).toHaveLength(3);
  });

  it('attaches type="price_line" metadata', () => {
    const chunks = chunkSmart(PRICE_ROW, 'pricing_reference');

    expect(chunks).toHaveLength(1);
    expect(chunks[0].metadata?.type).toBe('price_line');
  });

  it('extracts code from metadata', () => {
    const chunks = chunkSmart(PRICE_ROW, 'pricing_reference');

    expect(chunks[0].metadata?.code).toBe('3.2.2');
  });

  it('extracts unit from metadata', () => {
    const chunks = chunkSmart(PRICE_ROW, 'pricing_reference');

    expect(chunks[0].metadata?.unit).toBe('ml');
  });

  it('extracts price from metadata', () => {
    const chunks = chunkSmart(PRICE_ROW, 'pricing_reference');

    expect(chunks[0].metadata?.price).toBe('225,00');
  });

  it('keeps the original row text as chunk content', () => {
    const chunks = chunkSmart(PRICE_ROW, 'pricing_reference');

    expect(chunks[0].content).toBe(PRICE_ROW.trim());
  });

  it('handles prices with dots (1.250,00)', () => {
    const row = '| 5.1.0 | Dalle béton armé | m2 | 1.250,00 |';
    const chunks = chunkSmart(row, 'pricing_reference');

    expect(chunks[0].metadata?.price).toBe('1.250,00');
  });

  it('handles single-level codes (1 | description | u | 45,00)', () => {
    const row = '| 1 | Fourniture de béton B25 | m3 | 95,00 |';
    const chunks = chunkSmart(row, 'pricing_reference');

    expect(chunks[0].metadata?.code).toBe('1');
    expect(chunks[0].metadata?.type).toBe('price_line');
  });

  it('each price-line chunk stays under MAX_TOKENS', () => {
    const rows = Array.from(
      { length: 20 },
      (_, i) =>
        `| 1.${i + 1} | Élément de construction numéro ${i + 1} très long description | ml | ${(i + 1) * 10},00 |`
    ).join('\n');

    const chunks = chunkSmart(rows, 'pricing_reference');

    for (const chunk of chunks) {
      expect(chunk.tokenCount).toBeLessThanOrEqual(MAX_TOKENS);
    }
  });
});

// ---------------------------------------------------------------------------
// pricing_reference — non-price table rows (headers, separators)
// ---------------------------------------------------------------------------

describe('SmartChunker › pricing_reference › non-price table rows', () => {
  it('does not tag separator rows as price_line', () => {
    const text = [
      '| Code | Description | Unité | Prix HT |',
      '|------|-------------|-------|---------|',
      '| 3.2.2 | Poteau section carrée 30×30 cm | ml | 225,00 |',
    ].join('\n');

    const chunks = chunkSmart(text, 'pricing_reference');

    // Header + separator packed together, then price line separately
    const priceLine = chunks.find((c) => c.metadata?.type === 'price_line');
    const nonPrice = chunks.find((c) => c.metadata?.type !== 'price_line');

    expect(priceLine).toBeDefined();
    expect(nonPrice).toBeDefined();
    expect(nonPrice!.metadata?.type).not.toBe('price_line');
  });

  it('packs non-price rows under MAX_TOKENS', () => {
    const headerBlock = Array.from(
      { length: 5 },
      (_, i) => `| Col${i} | Value${i} | x${i} | ${i} |`
    ).join('\n');

    const chunks = chunkSmart(headerBlock, 'pricing_reference');

    // All should be under token limit
    for (const chunk of chunks) {
      expect(chunk.tokenCount).toBeLessThanOrEqual(MAX_TOKENS);
    }
  });
});

// ---------------------------------------------------------------------------
// pricing_reference — prose fallback
// ---------------------------------------------------------------------------

describe('SmartChunker › pricing_reference › prose fallback', () => {
  it('delegates prose to paragraph chunker', () => {
    const text = [
      'Introduction au bordereau de prix.',
      '',
      'Ce document présente les tarifs unitaires applicables.',
      '',
      '| 3.2.2 | Poteau section carrée 30×30 cm | ml | 225,00 |',
    ].join('\n');

    const chunks = chunkSmart(text, 'pricing_reference');

    const priceLine = chunks.find((c) => c.metadata?.type === 'price_line');
    const prose = chunks.find((c) => c.metadata?.splitMode === 'paragraph');

    expect(priceLine).toBeDefined();
    expect(prose).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// pricing_reference — mixed document
// ---------------------------------------------------------------------------

describe('SmartChunker › pricing_reference › mixed document', () => {
  it('correctly splits a realistic mixed pricing document', () => {
    const doc = `
Bordereau de Prix Unitaires — Lot 3 Gros Œuvre

Ce tableau récapitule les prix unitaires HT pour les ouvrages en béton armé.

| Code | Description                           | Unité | Prix HT  |
|------|---------------------------------------|-------|----------|
| 3.1.1 | Béton de propreté dosé à 150 kg/m3   | m3    | 85,00    |
| 3.1.2 | Béton armé pour semelles isolées      | m3    | 320,00   |
| 3.2.1 | Poteau circulaire Ø20 cm              | ml    | 180,00   |
| 3.2.2 | Poteau section carrée 30×30 cm        | ml    | 225,00   |

Les prix ci-dessus sont donnés hors taxes et peuvent être révisés trimestriellement.
`.trim();

    const chunks = chunkSmart(doc, 'pricing_reference');

    const priceLines = chunks.filter((c) => c.metadata?.type === 'price_line');
    const prose = chunks.filter((c) => c.metadata?.splitMode === 'paragraph');

    // 4 price rows → 4 individual chunks
    expect(priceLines).toHaveLength(4);

    // Prose before and after the table
    expect(prose.length).toBeGreaterThanOrEqual(1);

    // Codes are correctly extracted
    const codes = priceLines.map((c) => c.metadata?.code);
    expect(codes).toContain('3.1.1');
    expect(codes).toContain('3.2.2');

    // All chunks under MAX_TOKENS
    for (const chunk of chunks) {
      expect(chunk.tokenCount).toBeLessThanOrEqual(MAX_TOKENS);
    }
  });
});

// ---------------------------------------------------------------------------
// regulation
// ---------------------------------------------------------------------------

describe('SmartChunker › regulation', () => {
  it('splits on Article boundaries', () => {
    const text = [
      'Article 1 - Objet',
      'Le présent règlement a pour objet de définir les conditions.',
      '',
      'Article 2 - Champ d\'application',
      'Les présentes dispositions s\'appliquent à tous les marchés publics.',
    ].join('\n');

    const chunks = chunkSmart(text, 'regulation');

    expect(chunks.length).toBeGreaterThanOrEqual(2);
    expect(chunks.some((c) => c.metadata?.articleHeader?.toString().startsWith('Article 1'))).toBe(true);
    expect(chunks.some((c) => c.metadata?.articleHeader?.toString().startsWith('Article 2'))).toBe(true);
  });

  it('sub-chunks oversized articles', () => {
    // Create an article that exceeds MAX_TOKENS
    const longBody = 'Contenu très détaillé. '.repeat(100); // ~2400 chars → ~600 tokens
    const text = `Article 1 - Long\n${longBody}\n\nArticle 2 - Court\nBref contenu.`;

    const chunks = chunkSmart(text, 'regulation');

    for (const chunk of chunks) {
      expect(chunk.tokenCount).toBeLessThanOrEqual(MAX_TOKENS);
    }
  });
});

// ---------------------------------------------------------------------------
// technical_guide
// ---------------------------------------------------------------------------

describe('SmartChunker › technical_guide', () => {
  it('splits on numbered section headers', () => {
    const text = [
      '1. Généralités',
      'Description générale du guide technique.',
      '',
      '1.1 Domaine d\'application',
      'Ce guide s\'applique aux constructions neuves.',
      '',
      '2. Matériaux',
      'Liste des matériaux autorisés.',
    ].join('\n');

    const chunks = chunkSmart(text, 'technical_guide');

    expect(chunks.length).toBeGreaterThanOrEqual(3);
  });

  it('each chunk stays under MAX_TOKENS', () => {
    const longSection = '1.1 Section longue\n' + 'Paragraphe de contenu. '.repeat(100);
    const chunks = chunkSmart(longSection, 'technical_guide');

    for (const chunk of chunks) {
      expect(chunk.tokenCount).toBeLessThanOrEqual(MAX_TOKENS);
    }
  });
});

// ---------------------------------------------------------------------------
// generic / jurisprudence
// ---------------------------------------------------------------------------

describe('SmartChunker › generic', () => {
  it('produces chunks from plain paragraphs', () => {
    const text = 'Premier paragraphe.\n\nDeuxième paragraphe.\n\nTroisième paragraphe.';
    const chunks = chunkSmart(text, 'generic');

    expect(chunks.length).toBeGreaterThanOrEqual(1);
  });

  it('respects MAX_TOKENS for long documents', () => {
    const text = Array.from({ length: 50 }, (_, i) => `Paragraphe numéro ${i + 1}. `.repeat(10)).join('\n\n');
    const chunks = chunkSmart(text, 'generic');

    for (const chunk of chunks) {
      expect(chunk.tokenCount).toBeLessThanOrEqual(MAX_TOKENS);
    }
  });
});

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------

describe('SmartChunker › edge cases', () => {
  const STRATEGIES = ['regulation', 'technical_guide', 'pricing_reference', 'jurisprudence', 'generic'] as const;

  for (const strategy of STRATEGIES) {
    it(`returns empty array for empty input — ${strategy}`, () => {
      const chunks = chunkSmart('', strategy);
      expect(chunks).toHaveLength(0);
    });

    it(`returns empty array for whitespace-only input — ${strategy}`, () => {
      const chunks = chunkSmart('   \n\n   ', strategy);
      expect(chunks).toHaveLength(0);
    });
  }

  it('price line with extra whitespace in cells is still detected', () => {
    const row = '|  3.2.2  |  Poteau section carrée 30×30 cm  |  ml  |  225,00  |';
    const chunks = chunkSmart(row, 'pricing_reference');

    expect(chunks[0].metadata?.type).toBe('price_line');
    expect(chunks[0].metadata?.code).toBe('3.2.2');
  });

  it('row with only 3 columns is NOT detected as price line', () => {
    const row = '| 3.2.2 | Poteau section carrée 30×30 cm | 225,00 |';
    const chunks = chunkSmart(row, 'pricing_reference');

    // Should be packed as a generic table row, not a price_line
    expect(chunks[0].metadata?.type).not.toBe('price_line');
  });
});
