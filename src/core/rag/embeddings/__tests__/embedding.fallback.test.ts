import { describe, it, expect } from 'vitest';
import {
  generateSyntheticEmbedding,
  cosineSimilarity,
  type SyntheticEmbeddingResult,
} from '../embedding.fallback.js';

// ── generateSyntheticEmbedding() ──────────────────────────────────────────────

describe('generateSyntheticEmbedding()', () => {
  // ── Output shape ──────────────────────────────────────────────────────────

  it('returns an object with is_synthetic=true', () => {
    const result = generateSyntheticEmbedding('hello world');
    expect(result.is_synthetic).toBe(true);
  });

  it('returns method=tfidf-hash', () => {
    const result = generateSyntheticEmbedding('test');
    expect(result.method).toBe('tfidf-hash');
  });

  it('returns embedding array of default 384 dimensions', () => {
    const { embedding } = generateSyntheticEmbedding('foo bar baz');
    expect(embedding).toHaveLength(384);
  });

  it('returns embedding array of custom dimension count', () => {
    const { embedding } = generateSyntheticEmbedding('foo', 128);
    expect(embedding).toHaveLength(128);
  });

  it('all values are finite numbers', () => {
    const { embedding } = generateSyntheticEmbedding('construction BTP maçonnerie');
    expect(embedding.every(v => Number.isFinite(v))).toBe(true);
  });

  // ── Normalization ─────────────────────────────────────────────────────────

  it('vector has unit L2 norm (approximately)', () => {
    const { embedding } = generateSyntheticEmbedding('devis travaux toiture');
    const magnitude = Math.sqrt(embedding.reduce((sum, v) => sum + v * v, 0));
    expect(magnitude).toBeCloseTo(1.0, 3);
  });

  it('zero vector returned for empty string', () => {
    const { embedding } = generateSyntheticEmbedding('');
    expect(embedding).toHaveLength(384);
    expect(embedding.every(v => v === 0)).toBe(true);
  });

  it('zero vector returned for whitespace-only string', () => {
    const { embedding } = generateSyntheticEmbedding('   ');
    expect(embedding.every(v => v === 0)).toBe(true);
  });

  // ── Determinism ───────────────────────────────────────────────────────────

  it('produces identical vectors for the same input (deterministic)', () => {
    const text = 'enduit de façade RPE grain fin';
    const a = generateSyntheticEmbedding(text);
    const b = generateSyntheticEmbedding(text);
    expect(a.embedding).toEqual(b.embedding);
  });

  it('produces different vectors for different inputs', () => {
    const a = generateSyntheticEmbedding('plomberie sanitaire');
    const b = generateSyntheticEmbedding('charpente bois lamellé-collé');
    expect(a.embedding).not.toEqual(b.embedding);
  });

  // ── Semantic proximity ────────────────────────────────────────────────────

  it('similar texts are closer than unrelated texts', () => {
    const base     = generateSyntheticEmbedding('isolation thermique laine de verre');
    const similar  = generateSyntheticEmbedding('isolation thermique laine de roche');
    const unrelated = generateSyntheticEmbedding('électricité tableau disjoncteur');

    const simSimilar   = cosineSimilarity(base.embedding, similar.embedding);
    const simUnrelated = cosineSimilarity(base.embedding, unrelated.embedding);

    expect(simSimilar).toBeGreaterThan(simUnrelated);
  });

  it('identical text has cosine similarity = 1', () => {
    const text = 'carrelage sol 60x60';
    const a = generateSyntheticEmbedding(text);
    const b = generateSyntheticEmbedding(text);
    expect(cosineSimilarity(a.embedding, b.embedding)).toBeCloseTo(1.0, 5);
  });

  // ── Long input handling ───────────────────────────────────────────────────

  it('handles very long text without throwing', () => {
    const longText = 'devis BTP '.repeat(2000); // 20,000 chars
    expect(() => generateSyntheticEmbedding(longText)).not.toThrow();
  });

  it('truncates long text and still returns valid dimensions', () => {
    const longText = 'x'.repeat(20_000);
    const { embedding } = generateSyntheticEmbedding(longText);
    expect(embedding).toHaveLength(384);
  });
});

// ── cosineSimilarity() ────────────────────────────────────────────────────────

describe('cosineSimilarity()', () => {
  it('returns 1 for identical vectors', () => {
    const v = [1, 0, 0, 0];
    expect(cosineSimilarity(v, v)).toBeCloseTo(1.0);
  });

  it('returns 0 for orthogonal vectors', () => {
    expect(cosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0);
  });

  it('returns -1 for opposite vectors', () => {
    expect(cosineSimilarity([1, 0], [-1, 0])).toBeCloseTo(-1);
  });

  it('returns 0 for zero vector', () => {
    expect(cosineSimilarity([0, 0, 0], [1, 2, 3])).toBe(0);
  });

  it('throws when vectors have different lengths', () => {
    expect(() => cosineSimilarity([1, 2], [1, 2, 3])).toThrow('equal dimensions');
  });

  it('is symmetric: sim(a,b) === sim(b,a)', () => {
    const a = [0.5, 0.3, 0.8];
    const b = [0.1, 0.9, 0.2];
    expect(cosineSimilarity(a, b)).toBeCloseTo(cosineSimilarity(b, a));
  });
});
