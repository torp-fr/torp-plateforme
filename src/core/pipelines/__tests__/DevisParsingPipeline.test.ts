/**
 * Unit tests — DevisParsingPipeline (CSV path only — no storage/OCR needed)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Supabase storage
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    storage: {
      from: vi.fn(() => ({
        download: vi.fn(),
      })),
    },
  })),
}));

import { DevisParsingPipeline } from '../handlers/DevisParsingPipeline.js';
import { createClient } from '@supabase/supabase-js';

const mockContext = {
  pipelineName: 'DevisParsing',
  entityId:     'test-devis-id',
  entityType:   'devis' as const,
  startedAt:    new Date(),
  timeout:      30000,
};

const CSV_CONTENT = [
  'description;quantité;prix unitaire;total',
  'Tableau électrique TGBT;1;890;890',
  'Câblage 2.5mm²;100;12;1200',
  'Prises RJ45;6;45;270',
  'Éclairage LED;10;85;850',
].join('\n');

function makeCSVBuffer(content: string) {
  return Buffer.from(content, 'utf-8');
}

describe('DevisParsingPipeline', () => {
  let pipeline: DevisParsingPipeline;

  beforeEach(() => {
    pipeline = new DevisParsingPipeline();
    vi.clearAllMocks();
  });

  it('parses CSV correctly with 4 items', async () => {
    const mockSupabase = createClient('http://mock', 'mock-key');
    (mockSupabase.storage.from as ReturnType<typeof vi.fn>).mockReturnValue({
      download: vi.fn().mockResolvedValue({ data: { arrayBuffer: () => makeCSVBuffer(CSV_CONTENT).buffer }, error: null }),
    });

    const result = await pipeline.execute(
      { filePath: 'test/devis.csv', format: 'csv' },
      mockContext
    );

    expect(result.status).toBe('completed');
    expect(result.data?.items).toHaveLength(4);
    expect(result.data?.parsing_confidence).toBeGreaterThanOrEqual(0.9);
    expect(result.data?.parsing_method).toBe('csv');
  });

  it('calculates montant_ht as sum of total_ht', async () => {
    const mockSupabase = createClient('http://mock', 'mock-key');
    (mockSupabase.storage.from as ReturnType<typeof vi.fn>).mockReturnValue({
      download: vi.fn().mockResolvedValue({ data: { arrayBuffer: () => makeCSVBuffer(CSV_CONTENT).buffer }, error: null }),
    });

    const result = await pipeline.execute(
      { filePath: 'test/devis.csv', format: 'csv' },
      mockContext
    );

    // 890 + 1200 + 270 + 850 = 3210
    expect(result.data?.montant_ht).toBe(3210);
    expect(result.data?.montant_ttc).toBeCloseTo(3531, 0);
  });

  it('classifies electricite items correctly', async () => {
    const csvWithElec = [
      'description;qty;pu;total',
      'Tableau électrique TGBT;1;890;890',
      'Câblage circuits;100;12;1200',
    ].join('\n');

    const mockSupabase = createClient('http://mock', 'mock-key');
    (mockSupabase.storage.from as ReturnType<typeof vi.fn>).mockReturnValue({
      download: vi.fn().mockResolvedValue({ data: { arrayBuffer: () => makeCSVBuffer(csvWithElec).buffer }, error: null }),
    });

    const result = await pipeline.execute(
      { filePath: 'test/devis.csv', format: 'csv' },
      mockContext
    );

    const categories = result.data?.items.map(i => i.category) ?? [];
    expect(categories).toContain('electricite');
  });

  it('returns failed status when storage download fails', async () => {
    const mockSupabase = createClient('http://mock', 'mock-key');
    (mockSupabase.storage.from as ReturnType<typeof vi.fn>).mockReturnValue({
      download: vi.fn().mockResolvedValue({ data: null, error: { message: 'File not found' } }),
    });

    const result = await pipeline.execute(
      { filePath: 'nonexistent.csv', format: 'csv' },
      mockContext
    );

    expect(result.status).toBe('failed');
    expect(result.error).toContain('Storage download failed');
    expect(result.retryable).toBe(true);
  });

  it('returns failed status for unsupported format', async () => {
    const mockSupabase = createClient('http://mock', 'mock-key');
    (mockSupabase.storage.from as ReturnType<typeof vi.fn>).mockReturnValue({
      download: vi.fn().mockResolvedValue({ data: { arrayBuffer: () => Buffer.alloc(0).buffer }, error: null }),
    });

    const result = await pipeline.execute(
      { filePath: 'test/devis.xyz', format: 'xyz' as 'pdf' },
      mockContext
    );

    expect(result.status).toBe('failed');
    expect(result.error).toContain('Unsupported format');
  });

  it('handles empty CSV gracefully', async () => {
    const emptyCSV = 'description;qty;pu;total\n';

    const mockSupabase = createClient('http://mock', 'mock-key');
    (mockSupabase.storage.from as ReturnType<typeof vi.fn>).mockReturnValue({
      download: vi.fn().mockResolvedValue({ data: { arrayBuffer: () => makeCSVBuffer(emptyCSV).buffer }, error: null }),
    });

    const result = await pipeline.execute(
      { filePath: 'test/empty.csv', format: 'csv' },
      mockContext
    );

    // Either failed (no rows) or completed with 0 items
    expect(['completed', 'failed']).toContain(result.status);
    if (result.status === 'completed') {
      expect(result.data?.items).toHaveLength(0);
    }
  });
});
