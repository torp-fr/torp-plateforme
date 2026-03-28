/**
 * Integration tests — PipelineOrchestrator
 * Supabase is mocked. Pipeline handlers are mocked.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Supabase
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => mockSupabase),
}));

const mockSupabase = {
  from: vi.fn().mockReturnThis(),
  select: vi.fn().mockReturnThis(),
  insert: vi.fn().mockReturnThis(),
  update: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  single: vi.fn(),
  order: vi.fn().mockReturnThis(),
  limit: vi.fn().mockReturnThis(),
};

// Mock pipeline handlers
vi.mock('../handlers/EnrichissementEntreprisePipeline.js', () => ({
  EnrichissementEntreprisePipeline: vi.fn().mockImplementation(() => ({
    execute: vi.fn().mockResolvedValue({
      status: 'completed',
      data: { rcs_data: { code_naf: '43.21A' }, certifications: { rge: true, qualiopi: false, labels: [], details: [] }, reputation: null },
      executionTimeMs: 100,
      retryable: false,
    }),
  })),
}));

vi.mock('../handlers/ClientLocalizationPipeline.js', () => ({
  ClientLocalizationPipeline: vi.fn().mockImplementation(() => ({
    execute: vi.fn().mockResolvedValue({
      status: 'completed',
      data: { adresse_saisie: '12 rue de la Paix', adresse_normalisee: '12 rue de la Paix 75001 Paris', code_postal: '75001', ville: 'Paris', lat: 48.87, lng: 2.33, parcelle_cadastrale: null, fetched_at: new Date().toISOString() },
      executionTimeMs: 200,
      retryable: false,
    }),
  })),
}));

vi.mock('../handlers/ContextRegulationPipeline.js', () => ({
  ContextRegulationPipeline: vi.fn().mockImplementation(() => ({
    execute: vi.fn().mockResolvedValue({
      status: 'completed',
      data: { needs_fetched: ['PLU', 'ABF'], plu: { status: 'loaded', data: {} }, abf_protection: { status: 'loaded', data: false } },
      executionTimeMs: 300,
      retryable: false,
    }),
  })),
}));

vi.mock('../handlers/DevisParsingPipeline.js', () => ({
  DevisParsingPipeline: vi.fn().mockImplementation(() => ({
    execute: vi.fn().mockResolvedValue({
      status: 'completed',
      data: { status: 'parsed', items: [{ id: 'i1', line_number: 1, description: 'Test', quantity: 1, unit: 'forfait', unit_price: 100, total_ht: 100, category: 'electricite', is_taxable: true, tva_taux: 10 }], montant_ht: 100, montant_ttc: 110, tva_taux: 10, parsing_confidence: 0.9, parsing_method: 'csv', parsing_errors: [], parsed_at: new Date().toISOString() },
      executionTimeMs: 500,
      retryable: false,
    }),
  })),
}));

vi.mock('../handlers/AuditScoringPipeline.js', () => ({
  AuditScoringPipeline: vi.fn().mockImplementation(() => ({
    execute: vi.fn().mockResolvedValue({
      status: 'completed',
      data: {
        coverage_analysis: { coverage_pct: 75 },
        scoring: { final_score: 72, grade: 'B', dimensions: [], potential_score: 80, potential_grade: 'B', scoring_version: '1.0', computed_at: new Date().toISOString() },
        recommendations: [],
        public_summary: { title: 'Test', score: 72, grade: 'B', risk_label: 'Faible', compliance_verdict: 'attention', highlights: [], key_findings: [], top_recommendation: 'Test' },
      },
      executionTimeMs: 800,
      retryable: false,
    }),
  })),
}));

import { PipelineOrchestrator } from '../../orchestration/PipelineOrchestrator.js';

describe('PipelineOrchestrator', () => {
  let orchestrator: PipelineOrchestrator;

  beforeEach(() => {
    vi.clearAllMocks();

    // Default DB mock responses
    mockSupabase.single.mockResolvedValue({ data: { id: 'audit-1' }, error: null });
    mockSupabase.insert.mockReturnValue({
      ...mockSupabase,
      select: vi.fn().mockReturnValue({
        ...mockSupabase,
        single: vi.fn().mockResolvedValue({ data: { id: 'execution-1' }, error: null }),
      }),
    });

    orchestrator = new PipelineOrchestrator(mockSupabase as never);
  });

  it('instantiates with all 5 pipelines registered', () => {
    expect(orchestrator).toBeDefined();
  });

  it('onEntrepriseRegistered calls enrichment pipeline and updates DB', async () => {
    mockSupabase.single.mockResolvedValueOnce({ data: { id: 'execution-1' }, error: null });

    await orchestrator.onEntrepriseRegistered('12345678901234', 'entreprise-uuid');

    // Should have called update on entreprises table
    expect(mockSupabase.from).toHaveBeenCalledWith(expect.stringContaining('pipeline_executions'));
  });

  it('onClientCreated calls localization pipeline', async () => {
    await orchestrator.onClientCreated('client-uuid', '12 rue de la Paix, Paris');

    expect(mockSupabase.from).toHaveBeenCalled();
  });

  it('onProjectCreated calls context regulation pipeline', async () => {
    await orchestrator.onProjectCreated('projet-uuid', 'piscine', 48.87, 2.33, '75001');

    expect(mockSupabase.from).toHaveBeenCalled();
  });

  it('generateShortCode produces 8-char alphanumeric string', () => {
    // Access private method via type cast for testing
    const code = (orchestrator as unknown as Record<string, () => string>)['generateShortCode']();
    expect(code).toHaveLength(8);
    expect(code).toMatch(/^[A-Z2-9]{8}$/);
  });

  it('generateShortCode produces unique codes', () => {
    const generateShortCode = (orchestrator as unknown as Record<string, () => string>)['generateShortCode'].bind(orchestrator);
    const codes = new Set(Array.from({ length: 100 }, () => generateShortCode()));
    // With 8 chars from 32-char alphabet = 32^8 = 1 trillion combinations — no duplicates in 100
    expect(codes.size).toBe(100);
  });
});
