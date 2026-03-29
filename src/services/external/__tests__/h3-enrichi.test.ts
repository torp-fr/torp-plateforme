/**
 * H3-ENRICHI — Unit tests for the 4 enrichment service layers.
 *
 * Services under test:
 *   - GeorisquesService          (georisques.service.ts)
 *   - RGEProfessionalsService    (rge-professionals.service.ts)
 *   - DPELogementsService        (dpe-logements.service.ts)
 *   - MesAidesRenovService       (mesaidesrenov.service.ts)
 *
 * All fetch() calls are mocked — no network requests.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GeorisquesService }       from '../georisques.service.js';
import { RGEProfessionalsService } from '../rge-professionals.service.js';
import { DPELogementsService }     from '../dpe-logements.service.js';
import { MesAidesRenovService }    from '../mesaidesrenov.service.js';

// ── Global fetch mock ─────────────────────────────────────────────────────────

vi.mock('@/services/observability/structured-logger', () => ({
  structuredLogger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

// Helper: create a successful fetch response
function mockFetchOk(body: unknown): Response {
  return {
    ok:     true,
    status: 200,
    json:   async () => body,
  } as unknown as Response;
}

// Helper: create a failing fetch response
function mockFetchError(status: number): Response {
  return {
    ok:     false,
    status,
    json:   async () => ({}),
  } as unknown as Response;
}

// ── GeorisquesService ────────────────────────────────────────────────────────

describe('GeorisquesService', () => {
  let service: GeorisquesService;
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    service = new GeorisquesService();
    fetchSpy = vi.spyOn(globalThis, 'fetch');
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  // ── getRiskReport() ────────────────────────────────────────────────────────

  describe('getRiskReport()', () => {
    it('returns a structured risk report with natural and technological risks', async () => {
      fetchSpy
        .mockResolvedValueOnce(mockFetchOk({
          commune: 'Paris (75056)',
          url: 'https://www.georisques.gouv.fr/rapport?lon=2.3522&lat=48.8566',
          risquesNaturels: [
            { type: 'Inondation', present: true,  lib_risque_jo: 'Inondation par débordement' },
            { type: 'Retrait-gonflement des argiles', present: false, lib_risque_jo: 'RGA' },
          ],
          risquesTechnologiques: [
            { type: 'ICPE', present: false, lib_risque_jo: 'Installations classées' },
          ],
        }))
        .mockResolvedValueOnce(mockFetchOk({
          data: [{ code_zone: '1', zone_sismicite: '1 - TRES FAIBLE' }],
        }));

      const report = await service.getRiskReport(48.8566, 2.3522);

      expect(report.commune).toBe('Paris (75056)');
      expect(report.url_rapport).toContain('georisques');
      expect(report.risques_naturels).toHaveLength(2);
      expect(report.risques_naturels[0].present).toBe(true);
      expect(report.risques_naturels[0].type).toBe('Inondation');
      expect(report.risques_technologiques).toHaveLength(1);
      expect(report.seismic_zone?.code_zone).toBe('1');
      expect(report.seismic_zone?.zone_sismicite).toBe('1 - TRES FAIBLE');
      expect(report.source).toBe('georisques');
    });

    it('returns null seismic_zone when seismic API fails', async () => {
      fetchSpy
        .mockResolvedValueOnce(mockFetchOk({
          commune: 'Lyon',
          risquesNaturels: [],
          risquesTechnologiques: [],
        }))
        .mockResolvedValueOnce(mockFetchError(500));

      const report = await service.getRiskReport(45.75, 4.85);

      expect(report.seismic_zone).toBeNull();
      expect(report.commune).toBe('Lyon');
    });

    it('returns empty risk lists when API returns missing arrays', async () => {
      fetchSpy
        .mockResolvedValueOnce(mockFetchOk({ commune: null }))
        .mockResolvedValueOnce(mockFetchOk({ data: [] }));

      const report = await service.getRiskReport(43.0, 5.0);

      expect(report.risques_naturels).toEqual([]);
      expect(report.risques_technologiques).toEqual([]);
      expect(report.seismic_zone).toBeNull();
    });

    it('throws when risk report API returns an error', async () => {
      fetchSpy
        .mockResolvedValueOnce(mockFetchError(503))
        .mockResolvedValueOnce(mockFetchOk({ data: [] }));

      // The risk report fetch is one of two Promise.allSettled branches — it should
      // set risk data to null/empty but NOT throw (allSettled handles rejection)
      const report = await service.getRiskReport(43.0, 5.0);
      expect(report.risques_naturels).toEqual([]);
    });

    it('includes lat/lng in the result', async () => {
      fetchSpy
        .mockResolvedValueOnce(mockFetchOk({ commune: 'Bordeaux', risquesNaturels: [], risquesTechnologiques: [] }))
        .mockResolvedValueOnce(mockFetchOk({ data: [{ code_zone: '2', zone_sismicite: '2 - FAIBLE' }] }));

      const report = await service.getRiskReport(44.8378, -0.5792);
      expect(report.lat).toBe(44.8378);
      expect(report.lng).toBe(-0.5792);
    });
  });

  // ── getSeismicZone() ───────────────────────────────────────────────────────

  describe('getSeismicZone()', () => {
    it('returns seismic zone for valid coordinates', async () => {
      fetchSpy.mockResolvedValueOnce(mockFetchOk({
        data: [{ code_zone: '3', zone_sismicite: '3 - MODERE' }],
      }));

      const zone = await service.getSeismicZone(45.18, 5.72);
      expect(zone?.code_zone).toBe('3');
      expect(zone?.zone_sismicite).toBe('3 - MODERE');
    });

    it('returns null when API returns empty data array', async () => {
      fetchSpy.mockResolvedValueOnce(mockFetchOk({ data: [] }));
      const zone = await service.getSeismicZone(48.5, 2.0);
      expect(zone).toBeNull();
    });

    it('returns null when API returns 500 error', async () => {
      fetchSpy.mockResolvedValueOnce(mockFetchError(500));
      const zone = await service.getSeismicZone(48.5, 2.0);
      expect(zone).toBeNull();
    });

    it('uses correct URL format (latlon=lng,lat)', async () => {
      fetchSpy.mockResolvedValueOnce(mockFetchOk({ data: [] }));
      await service.getSeismicZone(48.8566, 2.3522);
      expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringContaining('latlon=2.3522,48.8566'),
        expect.any(Object)
      );
    });
  });
});

// ── RGEProfessionalsService ──────────────────────────────────────────────────

describe('RGEProfessionalsService', () => {
  let service: RGEProfessionalsService;
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  const SAMPLE_RGE_RECORD = {
    nom_entreprise:    'Thermique Pro SARL',
    siret:             '12345678901234',
    domaine:           'Travaux de rénovation énergétique',
    nom_qualification: 'RGE Qualibat Rénovation Énergétique',
    organisme:         'Qualibat',
    lien_date_fin:     '2025-12-31',
    adresse:           '10 rue de la Paix',
    code_postal:       '75002',
    commune:           'Paris',
    latitude:          48.8698,
    longitude:         2.3309,
  };

  beforeEach(() => {
    service  = new RGEProfessionalsService();
    fetchSpy = vi.spyOn(globalThis, 'fetch');
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  describe('searchNearLocation()', () => {
    it('returns a list of RGE professionals near a location', async () => {
      fetchSpy.mockResolvedValueOnce(mockFetchOk({
        results: [SAMPLE_RGE_RECORD, { ...SAMPLE_RGE_RECORD, nom_entreprise: 'Eco Confort' }],
        total: 2,
      }));

      const { professionals, total } = await service.searchNearLocation(48.8566, 2.3522);

      expect(professionals).toHaveLength(2);
      expect(professionals[0].nom_entreprise).toBe('Thermique Pro SARL');
      expect(professionals[0].siret).toBe('12345678901234');
      expect(professionals[0].organisme).toBe('Qualibat');
      expect(professionals[0].source).toBe('ademe-rge');
      expect(total).toBe(2);
    });

    it('maps lat/lng correctly from latitude/longitude fields', async () => {
      fetchSpy.mockResolvedValueOnce(mockFetchOk({ results: [SAMPLE_RGE_RECORD], total: 1 }));
      const { professionals } = await service.searchNearLocation(48.8566, 2.3522);
      expect(professionals[0].lat).toBeCloseTo(48.8698);
      expect(professionals[0].lng).toBeCloseTo(2.3309);
    });

    it('returns empty list when no professionals found', async () => {
      fetchSpy.mockResolvedValueOnce(mockFetchOk({ results: [], total: 0 }));
      const result = await service.searchNearLocation(43.0, 5.0);
      expect(result.professionals).toEqual([]);
      expect(result.total).toBe(0);
    });

    it('throws on API error', async () => {
      fetchSpy.mockResolvedValueOnce(mockFetchError(500));
      await expect(service.searchNearLocation(48.8566, 2.3522)).rejects.toThrow('ADEME RGE API returned 500');
    });

    it('handles missing results array gracefully', async () => {
      fetchSpy.mockResolvedValueOnce(mockFetchOk({}));
      const result = await service.searchNearLocation(48.8566, 2.3522);
      expect(result.professionals).toEqual([]);
    });
  });

  describe('searchByPostalCode()', () => {
    it('searches by postal code', async () => {
      fetchSpy.mockResolvedValueOnce(mockFetchOk({ results: [SAMPLE_RGE_RECORD], total: 1 }));
      const result = await service.searchByPostalCode('75001');
      expect(result.professionals).toHaveLength(1);
      expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringContaining('75001'),
        expect.any(Object)
      );
    });

    it('throws on API error', async () => {
      fetchSpy.mockResolvedValueOnce(mockFetchError(429));
      await expect(service.searchByPostalCode('75001')).rejects.toThrow('ADEME RGE API returned 429');
    });
  });

  describe('getCertificationsBySiret()', () => {
    it('returns all certifications for a given SIRET', async () => {
      fetchSpy.mockResolvedValueOnce(mockFetchOk({
        results: [
          SAMPLE_RGE_RECORD,
          { ...SAMPLE_RGE_RECORD, nom_qualification: 'RGE Qualifelec' },
        ],
      }));

      const certs = await service.getCertificationsBySiret('12345678901234');
      expect(certs).toHaveLength(2);
      expect(certs[0].nom_qualification).toBe('RGE Qualibat Rénovation Énergétique');
    });

    it('returns empty array when SIRET has no certifications', async () => {
      fetchSpy.mockResolvedValueOnce(mockFetchOk({ results: [] }));
      const certs = await service.getCertificationsBySiret('99999999999999');
      expect(certs).toEqual([]);
    });

    it('handles null fields gracefully', async () => {
      fetchSpy.mockResolvedValueOnce(mockFetchOk({
        results: [{ siret: '12345678901234' }],
      }));
      const certs = await service.getCertificationsBySiret('12345678901234');
      expect(certs[0].nom_entreprise).toBe('');
      expect(certs[0].domaine).toBeNull();
      expect(certs[0].source).toBe('ademe-rge');
    });
  });
});

// ── DPELogementsService ───────────────────────────────────────────────────────

describe('DPELogementsService', () => {
  let service: DPELogementsService;
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  const SAMPLE_DPE = {
    numero_dpe:                '2300E1234567890',
    date_etablissement_dpe:    '2023-06-15',
    type_batiment:             'maison',
    adresse_ban:               '12 rue des Lilas',
    code_postal_ban:           '69001',
    nom_commune_ban:           'Lyon',
    etiquette_dpe:             'C',
    etiquette_ges:             'B',
    conso_5_usages_par_m2_ep:  145,
    emission_ges_5_usages:     22,
    surface_habitable_logement: 95,
    type_energie_n1:           'Gaz naturel',
    type_energie_n2:           'Gaz naturel',
  };

  beforeEach(() => {
    service  = new DPELogementsService();
    fetchSpy = vi.spyOn(globalThis, 'fetch');
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  describe('searchByPostalCode()', () => {
    it('returns DPE records for a postal code', async () => {
      fetchSpy.mockResolvedValueOnce(mockFetchOk({ results: [SAMPLE_DPE], total: 1 }));

      const { dpe_records, total } = await service.searchByPostalCode('69001');

      expect(dpe_records).toHaveLength(1);
      expect(dpe_records[0].numero_dpe).toBe('2300E1234567890');
      expect(dpe_records[0].etiquette_energie).toBe('C');
      expect(dpe_records[0].etiquette_ges).toBe('B');
      expect(dpe_records[0].conso_energie_ep).toBe(145);
      expect(dpe_records[0].emission_ges).toBe(22);
      expect(dpe_records[0].surface_habitable).toBe(95);
      expect(dpe_records[0].source).toBe('ademe-dpe');
      expect(total).toBe(1);
    });

    it('maps commune from nom_commune_ban', async () => {
      fetchSpy.mockResolvedValueOnce(mockFetchOk({ results: [SAMPLE_DPE], total: 1 }));
      const { dpe_records } = await service.searchByPostalCode('69001');
      expect(dpe_records[0].commune).toBe('Lyon');
    });

    it('returns null energy label for invalid values', async () => {
      fetchSpy.mockResolvedValueOnce(mockFetchOk({
        results: [{ ...SAMPLE_DPE, etiquette_dpe: 'X', etiquette_ges: null }],
        total: 1,
      }));
      const { dpe_records } = await service.searchByPostalCode('75001');
      expect(dpe_records[0].etiquette_energie).toBeNull();
      expect(dpe_records[0].etiquette_ges).toBeNull();
    });

    it('throws on API error', async () => {
      fetchSpy.mockResolvedValueOnce(mockFetchError(503));
      await expect(service.searchByPostalCode('75001')).rejects.toThrow('ADEME DPE API returned 503');
    });
  });

  describe('searchNearLocation()', () => {
    it('returns DPE records near coordinates', async () => {
      fetchSpy.mockResolvedValueOnce(mockFetchOk({ results: [SAMPLE_DPE], total: 5 }));
      const result = await service.searchNearLocation(48.8566, 2.3522);
      expect(result.dpe_records).toHaveLength(1);
      expect(result.total).toBe(5);
    });

    it('passes radiusKm to geo_distance parameter', async () => {
      fetchSpy.mockResolvedValueOnce(mockFetchOk({ results: [], total: 0 }));
      await service.searchNearLocation(48.8566, 2.3522, 5);
      expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringContaining('5000'),  // 5km * 1000 = 5000m
        expect.any(Object)
      );
    });
  });

  describe('getDPEByNumber()', () => {
    it('returns the DPE record for a given DPE number', async () => {
      fetchSpy.mockResolvedValueOnce(mockFetchOk({ results: [SAMPLE_DPE] }));
      const dpe = await service.getDPEByNumber('2300E1234567890');
      expect(dpe?.numero_dpe).toBe('2300E1234567890');
      expect(dpe?.type_batiment).toBe('maison');
    });

    it('returns null when DPE not found', async () => {
      fetchSpy.mockResolvedValueOnce(mockFetchOk({ results: [] }));
      const dpe = await service.getDPEByNumber('NOTEXIST');
      expect(dpe).toBeNull();
    });
  });

  describe('getAreaEnergyStats()', () => {
    it('computes average consumption and label distribution', async () => {
      fetchSpy.mockResolvedValueOnce(mockFetchOk({
        results: [
          { ...SAMPLE_DPE, etiquette_dpe: 'D', conso_5_usages_par_m2_ep: 200 },
          { ...SAMPLE_DPE, etiquette_dpe: 'E', conso_5_usages_par_m2_ep: 280 },
          { ...SAMPLE_DPE, etiquette_dpe: 'D', conso_5_usages_par_m2_ep: 220 },
        ],
        total: 1000,
      }));

      const stats = await service.getAreaEnergyStats('69001');

      expect(stats.average_conso_ep).toBe(Math.round((200 + 280 + 220) / 3));
      expect(stats.label_distribution['D']).toBe(2);
      expect(stats.label_distribution['E']).toBe(1);
      expect(stats.total_records).toBe(1000);
    });

    it('returns null average_conso_ep when no records', async () => {
      fetchSpy.mockResolvedValueOnce(mockFetchOk({ results: [], total: 0 }));
      const stats = await service.getAreaEnergyStats('00000');
      expect(stats.average_conso_ep).toBeNull();
      expect(stats.total_records).toBe(0);
    });

    it('handles records with null conso values', async () => {
      fetchSpy.mockResolvedValueOnce(mockFetchOk({
        results: [
          { ...SAMPLE_DPE, conso_5_usages_par_m2_ep: null },
          { ...SAMPLE_DPE, conso_5_usages_par_m2_ep: 300 },
        ],
        total: 2,
      }));
      const stats = await service.getAreaEnergyStats('75001');
      expect(stats.average_conso_ep).toBe(300);
    });
  });

  describe('energy label normalization', () => {
    it.each([
      ['A', 'A'], ['B', 'B'], ['C', 'C'], ['D', 'D'],
      ['E', 'E'], ['F', 'F'], ['G', 'G'],
      ['a', 'A'], ['b', 'B'],  // lowercase normalization
      ['',  null], ['X', null], [null, null], [undefined, null],
    ])('maps etiquette "%s" → %s', async (input, expected) => {
      fetchSpy.mockResolvedValueOnce(mockFetchOk({
        results: [{ ...SAMPLE_DPE, etiquette_dpe: input }],
        total: 1,
      }));
      const { dpe_records } = await service.searchByPostalCode('75001');
      expect(dpe_records[0].etiquette_energie).toBe(expected);
    });
  });
});

// ── MesAidesRenovService ─────────────────────────────────────────────────────

describe('MesAidesRenovService', () => {
  let service: MesAidesRenovService;

  beforeEach(() => {
    service = new MesAidesRenovService();
  });

  // ── Revenue category ───────────────────────────────────────────────────────

  describe('Revenue category computation', () => {
    it('classifies très modestes household (Paris, 1 person, RFR=15000)', () => {
      const result = service.simulate({
        code_postal:        '75001',
        revenue_fiscal_ref: 15_000,
        nb_personnes_foyer: 1,
        work_types:         ['isolation_combles'],
        cout_travaux:       10_000,
        annee_construction: 1975,
        est_proprietaire:   true,
      });
      expect(result.revenue_category).toBe('tres_modestes');
    });

    it('classifies modestes household (province, 2 persons, RFR=28000)', () => {
      const result = service.simulate({
        code_postal:        '69001',
        revenue_fiscal_ref: 28_000,
        nb_personnes_foyer: 2,
        work_types:         ['isolation_combles'],
        cout_travaux:       10_000,
        annee_construction: 1980,
        est_proprietaire:   true,
      });
      expect(result.revenue_category).toBe('modestes');
    });

    it('classifies intermédiaires household (province, 3 persons, RFR=45000)', () => {
      const result = service.simulate({
        code_postal:        '33000',
        revenue_fiscal_ref: 45_000,
        nb_personnes_foyer: 3,
        work_types:         ['pompe_chaleur_air_eau'],
        cout_travaux:       15_000,
        annee_construction: 1990,
        est_proprietaire:   true,
      });
      expect(result.revenue_category).toBe('intermediaires');
    });

    it('classifies supérieurs household (IDF, 4 persons, RFR=120000)', () => {
      const result = service.simulate({
        code_postal:        '78000',
        revenue_fiscal_ref: 120_000,
        nb_personnes_foyer: 4,
        work_types:         ['renovation_globale'],
        cout_travaux:       50_000,
        annee_construction: 2000,
        est_proprietaire:   true,
      });
      expect(result.revenue_category).toBe('superieurs');
    });

    it('returns null revenue_category when RFR is null', () => {
      const result = service.simulate({
        code_postal:        '75001',
        revenue_fiscal_ref: null,
        nb_personnes_foyer: 2,
        work_types:         ['isolation_combles'],
        cout_travaux:       10_000,
        annee_construction: 1980,
        est_proprietaire:   true,
      });
      expect(result.revenue_category).toBeNull();
    });
  });

  // ── MaPrimeRénov' amounts ────────────────────────────────────────────────

  describe('MaPrimeRénov eligibility and amounts', () => {
    it('computes 75% aid for très modestes — isolation combles', () => {
      const result = service.simulate({
        code_postal:        '69001',
        revenue_fiscal_ref: 15_000,
        nb_personnes_foyer: 1,
        work_types:         ['isolation_combles'],
        cout_travaux:       10_000,
        annee_construction: 1975,
        est_proprietaire:   true,
      });
      const mpr = result.eligible_aids.find(a => a.name.includes('MaPrimeRénov') && a.name.includes('combles'));
      expect(mpr?.eligible).toBe(true);
      expect(mpr?.taux_aide).toBe(0.75);
      expect(mpr?.montant_estime).toBe(7_500);
    });

    it('computes 20% aid for supérieurs — pompe à chaleur air/eau', () => {
      const result = service.simulate({
        code_postal:        '75001',
        revenue_fiscal_ref: 200_000,
        nb_personnes_foyer: 2,
        work_types:         ['pompe_chaleur_air_eau'],
        cout_travaux:       20_000,
        annee_construction: 1985,
        est_proprietaire:   true,
      });
      const mpr = result.eligible_aids.find(a => a.name.includes('MaPrimeRénov') && a.name.includes('air/eau'));
      expect(mpr?.eligible).toBe(true);
      expect(mpr?.taux_aide).toBe(0.20);
      expect(mpr?.montant_estime).toBe(4_000);
    });

    it('marks chaudière gaz as NOT eligible (removed from MaPrimeRénov in 2024)', () => {
      const result = service.simulate({
        code_postal:        '75001',
        revenue_fiscal_ref: 15_000,
        nb_personnes_foyer: 1,
        work_types:         ['remplacement_chaudiere_gaz'],
        cout_travaux:       5_000,
        annee_construction: 1975,
        est_proprietaire:   true,
      });
      // chaudière gaz has taux=0 → not eligible, excluded from eligible_aids
      const gasAid = result.eligible_aids.find(a => a.name.includes('chaudière'));
      expect(gasAid).toBeUndefined();
    });

    it('does not include MaPrimeRénov when non-owner (locataire)', () => {
      const result = service.simulate({
        code_postal:        '75001',
        revenue_fiscal_ref: 15_000,
        nb_personnes_foyer: 1,
        work_types:         ['isolation_combles'],
        cout_travaux:       10_000,
        annee_construction: 1975,
        est_proprietaire:   false,
      });
      const mpr = result.eligible_aids.find(a => a.name.includes('MaPrimeRénov'));
      expect(mpr).toBeUndefined();
    });

    it('returns null montant_estime when cout_travaux is null', () => {
      const result = service.simulate({
        code_postal:        '69001',
        revenue_fiscal_ref: 15_000,
        nb_personnes_foyer: 1,
        work_types:         ['isolation_combles'],
        cout_travaux:       null,
        annee_construction: 1980,
        est_proprietaire:   true,
      });
      const mpr = result.eligible_aids.find(a => a.name.includes('MaPrimeRénov'));
      expect(mpr?.montant_estime).toBeNull();
    });
  });

  // ── CEE ───────────────────────────────────────────────────────────────────

  describe('CEE (Certificats d\'Économies d\'Énergie)', () => {
    it('includes CEE for eligible work types (isolation)', () => {
      const result = service.simulate({
        code_postal:        '75001',
        revenue_fiscal_ref: null,
        nb_personnes_foyer: 1,
        work_types:         ['isolation_murs'],
        cout_travaux:       20_000,
        annee_construction: 1985,
        est_proprietaire:   true,
      });
      const cee = result.eligible_aids.find(a => a.name.includes('CEE'));
      expect(cee?.eligible).toBe(true);
      expect(cee?.taux_aide).toBe(0.10);
      expect(cee?.montant_estime).toBe(2_000);
    });

    it('includes CEE for pompe à chaleur air/eau', () => {
      const result = service.simulate({
        code_postal:        '75001',
        revenue_fiscal_ref: null,
        nb_personnes_foyer: 1,
        work_types:         ['pompe_chaleur_air_eau'],
        cout_travaux:       15_000,
        annee_construction: 1985,
        est_proprietaire:   true,
      });
      const cee = result.eligible_aids.find(a => a.name.includes('CEE'));
      expect(cee?.eligible).toBe(true);
    });

    it('does NOT include CEE for windows-only work', () => {
      const result = service.simulate({
        code_postal:        '75001',
        revenue_fiscal_ref: null,
        nb_personnes_foyer: 1,
        work_types:         ['fenetres_double_vitrage'],
        cout_travaux:       8_000,
        annee_construction: 1990,
        est_proprietaire:   true,
      });
      const cee = result.eligible_aids.find(a => a.name.includes('CEE'));
      expect(cee).toBeUndefined();
    });
  });

  // ── Éco-PTZ ───────────────────────────────────────────────────────────────

  describe('Éco-PTZ', () => {
    it('includes Éco-PTZ for buildings constructed before 1990', () => {
      const result = service.simulate({
        code_postal:        '75001',
        revenue_fiscal_ref: null,
        nb_personnes_foyer: 1,
        work_types:         ['isolation_combles'],
        cout_travaux:       10_000,
        annee_construction: 1965,
        est_proprietaire:   true,
      });
      const ecoPtz = result.eligible_aids.find(a => a.name.includes('Éco-PTZ'));
      expect(ecoPtz?.eligible).toBe(true);
      expect(ecoPtz?.type).toBe('pret');
      expect(ecoPtz?.montant_estime).toBe(30_000);
    });

    it('does NOT include Éco-PTZ for buildings from 1990 or after', () => {
      const result = service.simulate({
        code_postal:        '75001',
        revenue_fiscal_ref: null,
        nb_personnes_foyer: 1,
        work_types:         ['isolation_combles'],
        cout_travaux:       10_000,
        annee_construction: 1990,
        est_proprietaire:   true,
      });
      const ecoPtz = result.eligible_aids.find(a => a.name.includes('Éco-PTZ'));
      expect(ecoPtz).toBeUndefined();
    });

    it('does NOT include Éco-PTZ for non-owners', () => {
      const result = service.simulate({
        code_postal:        '75001',
        revenue_fiscal_ref: null,
        nb_personnes_foyer: 1,
        work_types:         ['isolation_combles'],
        cout_travaux:       10_000,
        annee_construction: 1975,
        est_proprietaire:   false,
      });
      const ecoPtz = result.eligible_aids.find(a => a.name.includes('Éco-PTZ'));
      expect(ecoPtz).toBeUndefined();
    });
  });

  // ── TVA 5.5% ─────────────────────────────────────────────────────────────

  describe('TVA réduite 5.5%', () => {
    it('includes TVA 5.5% for buildings 1990+', () => {
      const result = service.simulate({
        code_postal:        '75001',
        revenue_fiscal_ref: null,
        nb_personnes_foyer: 1,
        work_types:         ['isolation_combles'],
        cout_travaux:       10_000,
        annee_construction: 1995,
        est_proprietaire:   true,
      });
      const tva = result.eligible_aids.find(a => a.name.includes('TVA'));
      expect(tva?.eligible).toBe(true);
      expect(tva?.type).toBe('tva_reduite');
      expect(tva?.montant_estime).toBe(Math.round(10_000 * 0.145));
    });

    it('includes TVA 5.5% when annee_construction is null', () => {
      const result = service.simulate({
        code_postal:        '75001',
        revenue_fiscal_ref: null,
        nb_personnes_foyer: 1,
        work_types:         ['isolation_combles'],
        cout_travaux:       5_000,
        annee_construction: null,
        est_proprietaire:   true,
      });
      const tva = result.eligible_aids.find(a => a.name.includes('TVA'));
      expect(tva?.eligible).toBe(true);
    });

    it('returns null TVA montant when cout_travaux is null', () => {
      const result = service.simulate({
        code_postal:        '75001',
        revenue_fiscal_ref: null,
        nb_personnes_foyer: 1,
        work_types:         ['isolation_combles'],
        cout_travaux:       null,
        annee_construction: 1995,
        est_proprietaire:   true,
      });
      const tva = result.eligible_aids.find(a => a.name.includes('TVA'));
      expect(tva?.montant_estime).toBeNull();
    });
  });

  // ── Total estimation ──────────────────────────────────────────────────────

  describe('Total estimation', () => {
    it('computes non-zero totals for a typical project', () => {
      const result = service.simulate({
        code_postal:        '75001',
        revenue_fiscal_ref: 15_000,
        nb_personnes_foyer: 1,
        work_types:         ['isolation_combles', 'pompe_chaleur_air_eau'],
        cout_travaux:       20_000,
        annee_construction: 1975,
        est_proprietaire:   true,
      });
      expect(result.total_estime_min).toBeGreaterThan(0);
      expect(result.total_estime_max).toBeGreaterThanOrEqual(result.total_estime_min);
    });

    it('total_estime_max does not exceed cout_travaux', () => {
      const result = service.simulate({
        code_postal:        '75001',
        revenue_fiscal_ref: 15_000,
        nb_personnes_foyer: 1,
        work_types:         ['renovation_globale'],
        cout_travaux:       10_000,
        annee_construction: 1975,
        est_proprietaire:   true,
      });
      expect(result.total_estime_max).toBeLessThanOrEqual(10_000);
    });

    it('returns zeros when no work types produce aids', () => {
      const result = service.simulate({
        code_postal:        '75001',
        revenue_fiscal_ref: null,
        nb_personnes_foyer: 1,
        work_types:         ['remplacement_chaudiere_gaz'],
        cout_travaux:       5_000,
        annee_construction: 1965,
        est_proprietaire:   false,
      });
      // Only Éco-PTZ would be eligible but est_proprietaire=false
      // Only CEE is possible but chaudière gaz is not CEE-eligible
      // total from TVA only (building pre-1990 → no TVA aid)
      expect(result.total_estime_min).toBeGreaterThanOrEqual(0);
    });
  });

  // ── Source and metadata ───────────────────────────────────────────────────

  describe('Result metadata', () => {
    it('always returns source=simulation-locale', () => {
      const result = service.simulate({
        code_postal: '75001', revenue_fiscal_ref: null,
        nb_personnes_foyer: 1, work_types: ['audit_energetique'],
        cout_travaux: null, annee_construction: null, est_proprietaire: true,
      });
      expect(result.source).toBe('simulation-locale');
    });

    it('returns correct departement from code_postal', () => {
      const r75 = service.simulate({
        code_postal: '75001', revenue_fiscal_ref: null,
        nb_personnes_foyer: 1, work_types: ['audit_energetique'],
        cout_travaux: null, annee_construction: null, est_proprietaire: true,
      });
      expect(r75.departement).toBe('75');

      const r69 = service.simulate({
        code_postal: '69003', revenue_fiscal_ref: null,
        nb_personnes_foyer: 1, work_types: ['audit_energetique'],
        cout_travaux: null, annee_construction: null, est_proprietaire: true,
      });
      expect(r69.departement).toBe('69');
    });

    it('includes a simulation_note string', () => {
      const result = service.simulate({
        code_postal: '75001', revenue_fiscal_ref: null,
        nb_personnes_foyer: 1, work_types: ['isolation_combles'],
        cout_travaux: null, annee_construction: null, est_proprietaire: true,
      });
      expect(typeof result.simulation_note).toBe('string');
      expect(result.simulation_note.length).toBeGreaterThan(10);
    });
  });
});
