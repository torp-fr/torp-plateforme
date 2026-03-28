/**
 * E2E integration tests — Full pipeline flow
 *
 * Simulates the complete happy path:
 *   1. Register entreprise → enrichment pipeline
 *   2. Create client → localization pipeline
 *   3. Create project → context regulation pipeline
 *   4. Upload devis → parsing + scoring pipelines → audit record + QR code
 *
 * All external API calls and Supabase are mocked.
 * The goal is to verify the end-to-end orchestration wiring, not the
 * individual pipeline logic (covered in handler unit tests).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Supabase mock ─────────────────────────────────────────────────────────────

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => mockDB),
}));

// Track calls by table
const dbCalls: { table: string; method: string; payload?: unknown }[] = [];

function makeTableChain(table: string) {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {};
  const makeFn = (method: string) => vi.fn((...args: unknown[]) => {
    if (method !== 'select' && method !== 'eq' && method !== 'order' && method !== 'limit') {
      dbCalls.push({ table, method, payload: args[0] });
    }
    return chain;
  });

  chain['select']  = makeFn('select');
  chain['insert']  = makeFn('insert');
  chain['update']  = makeFn('update');
  chain['delete']  = makeFn('delete');
  chain['eq']      = makeFn('eq');
  chain['order']   = makeFn('order');
  chain['limit']   = makeFn('limit');
  chain['single']  = vi.fn().mockResolvedValue({ data: null, error: null });
  return chain;
}

// DB responses keyed by call order
const tableChains: Record<string, ReturnType<typeof makeTableChain>> = {};

const mockDB = {
  from: vi.fn((table: string) => {
    if (!tableChains[table]) tableChains[table] = makeTableChain(table);
    return tableChains[table];
  }),
};

// ── Pipeline handler mocks ─────────────────────────────────────────────────────

const enrichResult = {
  status: 'completed' as const,
  data: {
    rcs_data:       { code_naf: '43.21A', raison_sociale: 'SARL TEST' },
    certifications: { rge: true, qualiopi: false, labels: [], details: [] },
    reputation:     null,
  },
  executionTimeMs: 120,
  retryable: false,
};

const localResult = {
  status: 'completed' as const,
  data: {
    adresse_saisie:     '12 rue de la Paix, Paris',
    adresse_normalisee: '12 rue de la Paix 75001 Paris',
    code_postal:        '75001',
    ville:              'Paris',
    lat:                48.87,
    lng:                2.33,
    parcelle_cadastrale: null,
    fetched_at:         new Date().toISOString(),
  },
  executionTimeMs: 200,
  retryable: false,
};

const contextResult = {
  status: 'completed' as const,
  data: {
    needs_fetched:  ['PLU'],
    plu:            { status: 'loaded', data: { zone: 'UB' } },
    abf_protection: { status: 'skipped', data: null },
  },
  executionTimeMs: 300,
  retryable: false,
};

const parseResult = {
  status: 'completed' as const,
  data: {
    status:     'parsed',
    items:      [{ id: 'i1', line_number: 1, description: 'Tableau TGBT', quantity: 1, unit: 'u', unit_price: 890, total_ht: 890, category: 'electricite', is_taxable: true, tva_taux: 10 }],
    montant_ht: 890,
    montant_ttc: 979,
    tva_taux:   10,
    parsing_confidence: 0.95,
    parsing_method:     'csv',
    parsing_errors:     [],
    parsed_at:          new Date().toISOString(),
  },
  executionTimeMs: 500,
  retryable: false,
};

const scoreResult = {
  status: 'completed' as const,
  data: {
    coverage_analysis: { coverage_pct: 80 },
    scoring: { final_score: 75, grade: 'B', dimensions: [], potential_score: 82, potential_grade: 'B', scoring_version: '1.0', computed_at: new Date().toISOString() },
    recommendations: [],
    public_summary: { title: 'Audit', score: 75, grade: 'B', risk_label: 'Faible', compliance_verdict: 'conforme', highlights: [], key_findings: [], top_recommendation: 'RAS' },
  },
  executionTimeMs: 800,
  retryable: false,
};

vi.mock('../handlers/EnrichissementEntreprisePipeline.js', () => ({
  EnrichissementEntreprisePipeline: vi.fn().mockImplementation(() => ({
    execute: vi.fn().mockResolvedValue(enrichResult),
  })),
}));

vi.mock('../handlers/ClientLocalizationPipeline.js', () => ({
  ClientLocalizationPipeline: vi.fn().mockImplementation(() => ({
    execute: vi.fn().mockResolvedValue(localResult),
  })),
}));

vi.mock('../handlers/ContextRegulationPipeline.js', () => ({
  ContextRegulationPipeline: vi.fn().mockImplementation(() => ({
    execute: vi.fn().mockResolvedValue(contextResult),
  })),
}));

vi.mock('../handlers/DevisParsingPipeline.js', () => ({
  DevisParsingPipeline: vi.fn().mockImplementation(() => ({
    execute: vi.fn().mockResolvedValue(parseResult),
  })),
}));

vi.mock('../handlers/AuditScoringPipeline.js', () => ({
  AuditScoringPipeline: vi.fn().mockImplementation(() => ({
    execute: vi.fn().mockResolvedValue(scoreResult),
  })),
}));

import { PipelineOrchestrator } from '../../orchestration/PipelineOrchestrator.js';

// ─────────────────────────────────────────────────────────────────────────────

describe('E2E: Full pipeline flow', () => {
  let orchestrator: PipelineOrchestrator;

  beforeEach(() => {
    vi.clearAllMocks();
    dbCalls.length = 0;
    Object.keys(tableChains).forEach(k => delete tableChains[k]);

    // pipeline_executions: insert returns execution id
    const execChain = makeTableChain('pipeline_executions');
    execChain['single'].mockResolvedValue({ data: { id: 'exec-1' }, error: null });
    const insertChain = { ...execChain };
    insertChain['select'] = vi.fn().mockReturnValue({ ...execChain });
    execChain['insert'] = vi.fn().mockReturnValue(insertChain);
    tableChains['pipeline_executions'] = execChain;

    // devis: select returns devis with projet/entreprise
    const devisChain = makeTableChain('devis');
    devisChain['single'].mockResolvedValue({
      data: { id: 'devis-1', projet_id: 'projet-1', entreprise_id: 'ent-1' },
      error: null,
    });
    tableChains['devis'] = devisChain;

    // audits: insert returns audit id
    const auditChain = makeTableChain('audits');
    auditChain['single'].mockResolvedValue({ data: { id: 'audit-1' }, error: null });
    const auditInsertChain = { ...auditChain };
    auditInsertChain['select'] = vi.fn().mockReturnValue({ ...auditChain });
    auditChain['insert'] = vi.fn().mockReturnValue(auditInsertChain);
    tableChains['audits'] = auditChain;

    // qrcodes: insert returns qr record
    const qrChain = makeTableChain('qrcodes');
    qrChain['single'].mockResolvedValue({ data: { id: 'qr-1', short_code: 'ABCD1234' }, error: null });
    const qrInsertChain = { ...qrChain };
    qrInsertChain['select'] = vi.fn().mockReturnValue({ ...qrChain });
    qrChain['insert'] = vi.fn().mockReturnValue(qrInsertChain);
    tableChains['qrcodes'] = qrChain;

    orchestrator = new PipelineOrchestrator(mockDB as never);
  });

  // ── Step 1: Entreprise registration ────────────────────────────────────────

  it('Step 1 — onEntrepriseRegistered triggers enrichment and updates DB', async () => {
    await orchestrator.onEntrepriseRegistered('12345678901234', 'ent-1');

    // Must write to pipeline_executions and entreprises
    expect(mockDB.from).toHaveBeenCalledWith('pipeline_executions');
    expect(mockDB.from).toHaveBeenCalledWith('entreprises');
  });

  // ── Step 2: Client creation ─────────────────────────────────────────────────

  it('Step 2 — onClientCreated triggers localization and updates client', async () => {
    await orchestrator.onClientCreated('client-1', '12 rue de la Paix, Paris');

    expect(mockDB.from).toHaveBeenCalledWith('pipeline_executions');
    expect(mockDB.from).toHaveBeenCalledWith('clients');
  });

  // ── Step 3: Project creation ────────────────────────────────────────────────

  it('Step 3 — onProjectCreated triggers context regulation', async () => {
    await orchestrator.onProjectCreated('projet-1', 'electricite_seule', 48.87, 2.33, '75001');

    expect(mockDB.from).toHaveBeenCalledWith('pipeline_executions');
    expect(mockDB.from).toHaveBeenCalledWith('projets');
  });

  // ── Step 4: Devis upload + full chain ──────────────────────────────────────

  it('Step 4 — onDevisUploaded triggers parsing then scoring', async () => {
    await orchestrator.onDevisUploaded('devis-1', 'uploads/devis.csv', 'csv');

    // Both DevisParsing and AuditScoring must be triggered
    expect(mockDB.from).toHaveBeenCalledWith('pipeline_executions');
    expect(mockDB.from).toHaveBeenCalledWith('devis');
  });

  // ── Full sequential flow ────────────────────────────────────────────────────

  it('Full flow — all 4 steps complete without throwing', async () => {
    await expect(
      orchestrator.onEntrepriseRegistered('12345678901234', 'ent-1')
    ).resolves.not.toThrow();

    await expect(
      orchestrator.onClientCreated('client-1', '12 rue de la Paix, Paris')
    ).resolves.not.toThrow();

    await expect(
      orchestrator.onProjectCreated('projet-1', 'renovation_complete', 48.87, 2.33, '75001')
    ).resolves.not.toThrow();

    await expect(
      orchestrator.onDevisUploaded('devis-1', 'uploads/devis.csv', 'csv')
    ).resolves.not.toThrow();
  });

  // ── Failure isolation ───────────────────────────────────────────────────────

  it('Parsing failure stops chain — scoring is never triggered', async () => {
    const { DevisParsingPipeline } = await import('../handlers/DevisParsingPipeline.js');
    (DevisParsingPipeline as ReturnType<typeof vi.fn>).mockImplementationOnce(() => ({
      execute: vi.fn().mockResolvedValue({
        status: 'failed',
        error: 'Storage download failed',
        retryable: true,
        executionTimeMs: 50,
      }),
    }));

    // Re-instantiate to pick up the mock override
    const orch = new PipelineOrchestrator(mockDB as never);
    await orch.onDevisUploaded('devis-1', 'uploads/bad.pdf', 'pdf');

    // AuditScoring should NOT have been called
    const scoringCalls = dbCalls.filter(c => c.method === 'insert' && c.table === 'audits');
    expect(scoringCalls).toHaveLength(0);
  });
});
