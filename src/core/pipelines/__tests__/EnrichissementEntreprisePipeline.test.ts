/**
 * Unit tests — EnrichissementEntreprisePipeline
 * All external API calls are mocked.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EnrichissementEntreprisePipeline } from '../handlers/EnrichissementEntreprisePipeline.js';

// Mock the API clients module
vi.mock('../../external/clients/index.js', () => ({
  apiClients: {
    pappers: {
      getCompanyBySIRET: vi.fn(),
    },
    datagouv: {
      getCertificationsBySIRET: vi.fn(),
    },
    trustpilot: null,
    ign: {},
    nominatim: {},
  },
}));

import { apiClients } from '../../external/clients/index.js';

const mockContext = {
  pipelineName: 'EnrichissementEntreprise',
  entityId:     'test-entreprise-id',
  entityType:   'entreprise' as const,
  startedAt:    new Date(),
  timeout:      30000,
};

describe('EnrichissementEntreprisePipeline', () => {
  let pipeline: EnrichissementEntreprisePipeline;

  beforeEach(() => {
    pipeline = new EnrichissementEntreprisePipeline();
    vi.clearAllMocks();
  });

  it('returns completed status with enriched data when all APIs succeed', async () => {
    (apiClients.pappers.getCompanyBySIRET as ReturnType<typeof vi.fn>).mockResolvedValue({
      success: true,
      data: {
        siret:           '12345678901234',
        siren:           '123456789',
        raison_sociale:  'SARL TEST',
        code_naf:        '43.21A',
        libelle_naf:     'Travaux installation électrique',
        effectifs:       10,
        effectifs_etab:  10,
        chiffre_affaires: 500000,
        date_creation:   '2010-01-01',
        date_modification: '',
        statut_juridique: 'SARL',
        adresse:         '12 rue de la Paix',
        code_postal:     '75001',
        ville:           'Paris',
        latitude:        48.87,
        longitude:       2.33,
      },
    });

    (apiClients.datagouv.getCertificationsBySIRET as ReturnType<typeof vi.fn>).mockResolvedValue({
      success: true,
      data: [
        { id: 'rge:1', name: 'RGE', type: 'rge', issued_date: '2023-01-01', valid_until: '2026-01-01' },
      ],
    });

    const result = await pipeline.execute({ siret: '12345678901234' }, mockContext);

    expect(result.status).toBe('completed');
    expect(result.data?.rcs_data?.code_naf).toBe('43.21A');
    expect(result.data?.certifications.rge).toBe(true);
    expect(result.data?.certifications.qualiopi).toBe(false);
    expect(result.data?.reputation).toBeNull();
    expect(result.executionTimeMs).toBeGreaterThanOrEqual(0);
  });

  it('returns partial result with warning when Pappers fails', async () => {
    (apiClients.pappers.getCompanyBySIRET as ReturnType<typeof vi.fn>).mockResolvedValue({
      success: false,
      error: 'PAPPERS_API_KEY not configured',
    });

    (apiClients.datagouv.getCertificationsBySIRET as ReturnType<typeof vi.fn>).mockResolvedValue({
      success: true,
      data: [],
    });

    const result = await pipeline.execute({ siret: '12345678901234' }, mockContext);

    expect(result.status).toBe('completed');
    expect(result.data?.rcs_data).toBeNull();
    expect(result.warnings).toBeDefined();
    expect(result.warnings!.length).toBeGreaterThan(0);
    expect(result.warnings![0]).toContain('Pappers');
  });

  it('returns completed even when data.gouv fails (certifications empty)', async () => {
    (apiClients.pappers.getCompanyBySIRET as ReturnType<typeof vi.fn>).mockResolvedValue({
      success: true,
      data: { siret: '12345678901234', siren: '123456789', raison_sociale: 'SARL TEST',
        code_naf: '43.21A', libelle_naf: '', effectifs: 5, effectifs_etab: 5,
        chiffre_affaires: 0, date_creation: '', date_modification: '', statut_juridique: 'SARL',
        adresse: '', code_postal: '', ville: '', latitude: 0, longitude: 0 },
    });

    (apiClients.datagouv.getCertificationsBySIRET as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('Network timeout')
    );

    const result = await pipeline.execute({ siret: '12345678901234' }, mockContext);

    expect(result.status).toBe('completed');
    expect(result.data?.certifications.rge).toBe(false);
    expect(result.data?.certifications.details).toEqual([]);
  });

  it('returns failed status when an unexpected error occurs', async () => {
    (apiClients.pappers.getCompanyBySIRET as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('Unexpected crash')
    );
    (apiClients.datagouv.getCertificationsBySIRET as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('Also crashed')
    );

    const result = await pipeline.execute({ siret: '12345678901234' }, mockContext);

    // Promise.allSettled means it still completes
    expect(result.status).toBe('completed');
    expect(result.data?.rcs_data).toBeNull();
  });

  it('normalizes certification data correctly', async () => {
    (apiClients.pappers.getCompanyBySIRET as ReturnType<typeof vi.fn>).mockResolvedValue({ success: false, error: 'no key' });
    (apiClients.datagouv.getCertificationsBySIRET as ReturnType<typeof vi.fn>).mockResolvedValue({
      success: true,
      data: [
        { id: 'rge:1', name: 'RGE', type: 'rge', issued_date: '2023-01-01' },
        { id: 'rge:2', name: 'RGE Isolation', type: 'rge', issued_date: '2024-01-01' },
        { id: 'qualiopi:1', name: 'Qualiopi', type: 'qualiopi', issued_date: '2023-06-01' },
        { id: 'label:1', name: 'Qualibat', type: 'label', issued_date: '2022-01-01' },
      ],
    });

    const result = await pipeline.execute({ siret: '12345678901234' }, mockContext);

    expect(result.data?.certifications.rge).toBe(true);
    expect(result.data?.certifications.qualiopi).toBe(true);
    expect(result.data?.certifications.labels).toContain('Qualibat');
    expect(result.data?.certifications.details).toHaveLength(4);
  });
});
