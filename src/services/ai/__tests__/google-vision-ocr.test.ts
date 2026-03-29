import { describe, it, expect, vi, beforeEach } from 'vitest';
import { computeFileHash, shouldTryOCR } from '../google-vision-ocr.service.js';

// ── Supabase mock ─────────────────────────────────────────────────────────────
// Use a simple stub that individual tests can reconfigure via makeCacheMock().

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
    functions: { invoke: vi.fn() },
  },
}));

vi.mock('@/lib/logger', () => ({
  log:   vi.fn(),
  warn:  vi.fn(),
  error: vi.fn(),
}));

/** Build a `supabase.from()` return value.
 *  cacheData = null → cache miss; non-null → cache hit. */
function makeCacheMock(cacheData: { extracted_text: string; id: string } | null) {
  return {
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: cacheData,
          error: cacheData ? null : { message: 'Not found' },
        }),
      }),
    }),
    update: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        then:  (_: unknown) => Promise.resolve({}),
        catch: (_: unknown) => undefined,
      }),
    }),
    insert: vi.fn().mockResolvedValue({ error: null }),
  };
}

// ── computeFileHash() ────────────────────────────────────────────────────────

describe('computeFileHash()', () => {
  it('returns a 64-char hex string (SHA-256)', async () => {
    const hash = await computeFileHash(Buffer.from('hello'));
    expect(hash).toHaveLength(64);
    expect(hash).toMatch(/^[0-9a-f]+$/);
  });

  it('same buffer → same hash (deterministic)', async () => {
    const buf = Buffer.from('test content');
    const [h1, h2] = await Promise.all([computeFileHash(buf), computeFileHash(buf)]);
    expect(h1).toBe(h2);
  });

  it('different buffers → different hashes', async () => {
    const h1 = await computeFileHash(Buffer.from('file A'));
    const h2 = await computeFileHash(Buffer.from('file B'));
    expect(h1).not.toBe(h2);
  });
});

// ── shouldTryOCR() ────────────────────────────────────────────────────────────

describe('shouldTryOCR()', () => {
  it('returns true for null', () => {
    expect(shouldTryOCR(null)).toBe(true);
  });

  it('returns true for undefined', () => {
    expect(shouldTryOCR(undefined)).toBe(true);
  });

  it('returns true for empty string', () => {
    expect(shouldTryOCR('')).toBe(true);
  });

  it('returns true for whitespace-only string', () => {
    expect(shouldTryOCR('   \n\t  ')).toBe(true);
  });

  it('returns false when text is present', () => {
    expect(shouldTryOCR('Devis n°123')).toBe(false);
  });

  it('returns false for short but non-empty text', () => {
    expect(shouldTryOCR('ok')).toBe(false);
  });
});

// ── runGoogleVisionOCR() — cache HIT ─────────────────────────────────────────

describe('runGoogleVisionOCR() — cache hit', () => {
  beforeEach(() => vi.resetModules());

  it('returns cached text without calling Edge Function', async () => {
    const { supabase } = await import('@/lib/supabase');
    (supabase.from as ReturnType<typeof vi.fn>).mockReturnValue(
      makeCacheMock({ extracted_text: 'Texte OCR mis en cache', id: 'abc-123' })
    );
    (supabase.functions.invoke as ReturnType<typeof vi.fn>).mockClear();

    const { runGoogleVisionOCR } = await import('../google-vision-ocr.service.js');
    const result = await runGoogleVisionOCR(Buffer.from('pdf content'));

    expect(result).toBe('Texte OCR mis en cache');
    expect(supabase.functions.invoke).not.toHaveBeenCalled();
  });
});

// ── runGoogleVisionOCR() — cache MISS ────────────────────────────────────────

describe('runGoogleVisionOCR() — cache miss', () => {
  beforeEach(() => vi.resetModules());

  it('calls the Edge Function on cache miss', async () => {
    const { supabase } = await import('@/lib/supabase');
    (supabase.from as ReturnType<typeof vi.fn>).mockReturnValue(makeCacheMock(null));
    (supabase.functions.invoke as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: { text: 'Résultat OCR', confidence: 0.95, pages_processed: 2 },
      error: null,
    });

    const { runGoogleVisionOCR } = await import('../google-vision-ocr.service.js');
    const result = await runGoogleVisionOCR(Buffer.from('scanned pdf'), 'scan.pdf');

    expect(supabase.functions.invoke).toHaveBeenCalledWith(
      'google-vision-ocr',
      expect.objectContaining({
        body: expect.objectContaining({ mimeType: 'application/pdf', filename: 'scan.pdf' }),
      })
    );
    expect(result).toBe('Résultat OCR');
  });

  it('uses default filename "document.pdf" when none provided', async () => {
    const { supabase } = await import('@/lib/supabase');
    (supabase.from as ReturnType<typeof vi.fn>).mockReturnValue(makeCacheMock(null));
    (supabase.functions.invoke as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: { text: 'OCR result', confidence: 0.8, pages_processed: 1 },
      error: null,
    });

    const { runGoogleVisionOCR } = await import('../google-vision-ocr.service.js');
    await runGoogleVisionOCR(Buffer.from('pdf'));

    expect(supabase.functions.invoke).toHaveBeenCalledWith(
      'google-vision-ocr',
      expect.objectContaining({
        body: expect.objectContaining({ filename: 'document.pdf' }),
      })
    );
  });

  it('throws OCR_FAILED when Edge Function returns an error', async () => {
    const { supabase } = await import('@/lib/supabase');
    (supabase.from as ReturnType<typeof vi.fn>).mockReturnValue(makeCacheMock(null));
    (supabase.functions.invoke as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: null,
      error: { message: 'Internal Server Error' },
    });

    const { runGoogleVisionOCR } = await import('../google-vision-ocr.service.js');
    await expect(runGoogleVisionOCR(Buffer.from('pdf'))).rejects.toThrow('OCR_FAILED');
  });

  it('throws OCR_FAILED when Edge Function returns empty text', async () => {
    const { supabase } = await import('@/lib/supabase');
    (supabase.from as ReturnType<typeof vi.fn>).mockReturnValue(makeCacheMock(null));
    (supabase.functions.invoke as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: { text: '', confidence: 0, pages_processed: 0 },
      error: null,
    });

    const { runGoogleVisionOCR } = await import('../google-vision-ocr.service.js');
    await expect(runGoogleVisionOCR(Buffer.from('pdf'))).rejects.toThrow('OCR_FAILED');
  });

  it('throws OCR_FAILED for empty buffer (no API call made)', async () => {
    const { runGoogleVisionOCR } = await import('../google-vision-ocr.service.js');
    await expect(runGoogleVisionOCR(Buffer.alloc(0))).rejects.toThrow('OCR_FAILED: Empty buffer');
  });
});
