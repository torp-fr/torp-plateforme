import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { RegionalRiskProfiler } from '../RegionalRiskProfiler.js';
import type { SupabaseClient } from '@supabase/supabase-js';

const mockSupabase = {} as unknown as SupabaseClient;

describe('RegionalRiskProfiler', () => {
  let profiler: RegionalRiskProfiler;

  beforeEach(() => {
    profiler = new RegionalRiskProfiler(mockSupabase);
    // Stub the geocodeAddress to return Paris by default
    vi.spyOn(profiler, 'geocodeAddress').mockResolvedValue({ lat: 48.8566, lon: 2.3522 });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── inferDTURequirements ──────────────────────────────────────────────────

  describe('inferDTURequirements()', () => {
    const seismicLow = { zone: 1, description: 'Zone 1', requires_ec8: false };
    const seismicHigh = { zone: 4, description: 'Zone 4', requires_ec8: true };
    const snowLight = { zone: 'A2' as const, snow_load_kg_m2: 70, dtu_reference: 'NV65' };
    const snowHeavy = { zone: 'D' as const, snow_load_kg_m2: 350, dtu_reference: 'NV65' };
    const windLow = { wind_zone: 1 as const, max_speed_kmh: 120, dynamic_pressure_pa: 900 };
    const windHigh = { wind_zone: 4 as const, max_speed_kmh: 200, dynamic_pressure_pa: 2000 };

    it('includes DTU 20.1 for structure domain', () => {
      const dtus = profiler.inferDTURequirements(['structure'], seismicLow, snowLight, windLow);
      expect(dtus.some(d => d.includes('DTU 20.1'))).toBe(true);
    });

    it('includes EC8 for seismic zone >= 3 with structure', () => {
      const dtus = profiler.inferDTURequirements(['structure'], seismicHigh, snowLight, windLow);
      expect(dtus.some(d => d.includes('1998') || d.includes('EC8') || d.includes('sismique'))).toBe(true);
    });

    it('includes NF C 15-100 for electricite', () => {
      const dtus = profiler.inferDTURequirements(['electricite'], seismicLow, snowLight, windLow);
      expect(dtus.some(d => d.includes('15-100'))).toBe(true);
    });

    it('includes RE 2020 for isolation', () => {
      const dtus = profiler.inferDTURequirements(['isolation'], seismicLow, snowLight, windLow);
      expect(dtus.some(d => d.includes('RE 2020') || d.includes('RT 2012'))).toBe(true);
    });

    it('includes snow reinforcement for heavy snow zone', () => {
      const dtus = profiler.inferDTURequirements(['couverture'], seismicLow, snowHeavy, windLow);
      expect(dtus.some(d => d.toLowerCase().includes('neige'))).toBe(true);
    });

    it('includes wind reinforcement for zone 3+ wind', () => {
      const dtus = profiler.inferDTURequirements(['couverture'], seismicLow, snowLight, windHigh);
      expect(dtus.some(d => d.toLowerCase().includes('vent'))).toBe(true);
    });

    it('includes DTU 43.1 for etancheite', () => {
      const dtus = profiler.inferDTURequirements(['etancheite'], seismicLow, snowLight, windLow);
      expect(dtus.some(d => d.includes('43.1'))).toBe(true);
    });

    it('deduplicates DTU list', () => {
      const dtus = profiler.inferDTURequirements(['structure', 'structure'], seismicLow, snowLight, windLow);
      const uniqueDtus = [...new Set(dtus)];
      expect(dtus.length).toBe(uniqueDtus.length);
    });

    it('returns empty array for unknown domain', () => {
      const dtus = profiler.inferDTURequirements(['unknown_domain'], seismicLow, snowLight, windLow);
      expect(dtus).toEqual([]);
    });
  });

  // ── geocodeAddress ────────────────────────────────────────────────────────

  describe('geocodeAddress()', () => {
    it('falls back to Paris centroid on fetch error', async () => {
      vi.restoreAllMocks(); // Remove the spy to test real behavior
      const profilerReal = new RegionalRiskProfiler(mockSupabase);

      // Mock global fetch to fail
      const mockFetch = vi.fn().mockRejectedValue(new Error('Network error'));
      vi.stubGlobal('fetch', mockFetch);

      const coords = await profilerReal.geocodeAddress('12 rue de la Paix, Paris');
      expect(coords.lat).toBe(48.8566);
      expect(coords.lon).toBe(2.3522);

      vi.unstubAllGlobals();
    });
  });

  // ── assessProject integration ─────────────────────────────────────────────

  describe('assessProject()', () => {
    it('returns a RegionalRisks object with all fields', async () => {
      // Mock all HTTP calls to fail safely (defaults will be used)
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));

      const result = await profiler.assessProject('12 rue de la Paix, 75001 Paris', ['structure', 'electricite']);

      expect(result).toHaveProperty('seismic');
      expect(result).toHaveProperty('flooding');
      expect(result).toHaveProperty('snow_load');
      expect(result).toHaveProperty('wind_exposure');
      expect(result).toHaveProperty('plu_restrictions');
      expect(result).toHaveProperty('inferred_dtu_requirements');
      expect(result).toHaveProperty('summary');
      expect(result).toHaveProperty('assessed_at');

      expect(Array.isArray(result.inferred_dtu_requirements)).toBe(true);
      expect(typeof result.summary).toBe('string');

      vi.unstubAllGlobals();
    });

    it('inferred DTUs include domain-appropriate norms', async () => {
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));

      const result = await profiler.assessProject('1 rue Test', ['isolation', 'plomberie']);
      expect(result.inferred_dtu_requirements.some(d => d.includes('45') || d.includes('RE 2020'))).toBe(true);

      vi.unstubAllGlobals();
    });

    it('summary mentions "standard" for low-risk project', async () => {
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));

      const result = await profiler.assessProject('1 rue Test', ['peinture']);
      expect(result.summary.toLowerCase()).toMatch(/standard|usuel/);

      vi.unstubAllGlobals();
    });
  });
});
