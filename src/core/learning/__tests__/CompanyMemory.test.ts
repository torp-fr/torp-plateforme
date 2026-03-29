import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CompanyMemory } from '../CompanyMemory.js';
import type { SupabaseClient } from '@supabase/supabase-js';

// ── Supabase mock factory ─────────────────────────────────────────────────────

function makeMockSupabase(overrides?: {
  selectData?: unknown;
  selectError?: { message: string } | null;
}): SupabaseClient {
  const selectData = overrides?.selectData ?? [];
  const selectError = overrides?.selectError ?? null;

  const mockChain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    upsert: vi.fn().mockResolvedValue({ error: null }),
    maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
  };

  return {
    from: vi.fn().mockReturnValue({
      ...mockChain,
      select: vi.fn().mockReturnValue({
        ...mockChain,
        data: selectData,
        error: selectError,
      }),
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      }),
      upsert: vi.fn().mockResolvedValue({ error: null }),
    }),
  } as unknown as SupabaseClient;
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('CompanyMemory', () => {
  const SIRET = '35600000059843';

  describe('initialize()', () => {
    it('loads profiles from DB into cache on init', async () => {
      const supabase = {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockResolvedValue({
            data: [
              { siret: SIRET, raison_sociale: 'BOUYGUES TP', region: 'IDF', secteur: 'BTP', tarifs: {}, formats: {}, processus: {}, insurance_profile: null, devis_count: 3, learning_confidence: 0.3, patterns: [] },
            ],
            error: null,
          }),
        }),
      } as unknown as SupabaseClient;

      const memory = new CompanyMemory(supabase);
      await memory.initialize();

      const profile = await memory.getProfile(SIRET);
      expect(profile?.siret).toBe(SIRET);
      expect(profile?.raison_sociale).toBe('BOUYGUES TP');
    });

    it('handles DB error gracefully during initialize()', async () => {
      const supabase = {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockResolvedValue({ data: null, error: { message: 'DB down' } }),
        }),
      } as unknown as SupabaseClient;

      const memory = new CompanyMemory(supabase);
      // Should not throw
      await expect(memory.initialize()).resolves.not.toThrow();
    });
  });

  describe('createCompanyProfile()', () => {
    it('creates a profile and stores it in cache', async () => {
      const upsertFn = vi.fn().mockResolvedValue({ error: null });
      const supabase = {
        from: vi.fn().mockReturnValue({ upsert: upsertFn }),
      } as unknown as SupabaseClient;

      const memory = new CompanyMemory(supabase);
      await memory.createCompanyProfile(SIRET, { raison_sociale: 'TEST SAS', region: 'IDF', secteur: 'BTP' });

      expect(upsertFn).toHaveBeenCalledOnce();
      // Check the profile was cached
      const profile = await memory.getProfile(SIRET);
      expect(profile?.siret).toBe(SIRET);
      expect(profile?.devis_count).toBe(0);
      expect(profile?.learning_confidence).toBe(0);
    });

    it('does not overwrite existing profile', async () => {
      const upsertFn = vi.fn().mockResolvedValue({ error: null });
      const supabase = {
        from: vi.fn().mockReturnValue({ upsert: upsertFn }),
      } as unknown as SupabaseClient;

      const memory = new CompanyMemory(supabase);
      await memory.createCompanyProfile(SIRET, { raison_sociale: 'FIRST' });
      await memory.createCompanyProfile(SIRET, { raison_sociale: 'SECOND' });

      // upsert should only be called once (second call is a no-op)
      expect(upsertFn).toHaveBeenCalledOnce();
    });
  });

  describe('learnFromDevis()', () => {
    it('increments devis_count and updates learning_confidence', async () => {
      const updateFn = vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) });
      const supabase = {
        from: vi.fn().mockReturnValue({ update: updateFn }),
      } as unknown as SupabaseClient;

      const memory = new CompanyMemory(supabase);
      // Inject profile directly into cache (avoids needing a full upsert mock)
      (memory as unknown as { cache: Map<string, unknown> }).cache.set(SIRET, {
        siret: SIRET, raison_sociale: 'TEST', region: null, secteur: null,
        tarifs: {}, formats: {}, processus: {}, insurance_profile: null,
        devis_count: 4, learning_confidence: 0.4, patterns: [],
      });

      await memory.learnFromDevis(SIRET, {
        items: [{ description: 'Câblage 2.5mm²', unit: 'm', unit_price: 12 }],
        montant_ht: 10000,
        montant_ttc: 11000,
      });

      expect(updateFn).toHaveBeenCalled();
      const updateArg = updateFn.mock.calls[0][0] as { devis_count: number; learning_confidence: number };
      expect(updateArg.devis_count).toBe(5);
      expect(updateArg.learning_confidence).toBeCloseTo(0.5);
    });

    it('builds tarif pattern after multiple devis', async () => {
      const updateFn = vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) });

      const memory = new CompanyMemory({ from: vi.fn().mockReturnValue({ update: updateFn }) } as unknown as SupabaseClient);

      const inject = (devisCount: number) => {
        (memory as unknown as { cache: Map<string, unknown> }).cache.set(SIRET, {
          siret: SIRET, raison_sociale: 'TEST', region: null, secteur: null,
          tarifs: {}, formats: {}, processus: {}, insurance_profile: null,
          devis_count: devisCount, learning_confidence: devisCount / 10, patterns: [],
        });
      };

      inject(0);
      await memory.learnFromDevis(SIRET, { items: [{ description: 'Câblage 2.5mm²', unit: 'm', unit_price: 10 }] });

      inject(1);
      await memory.learnFromDevis(SIRET, { items: [{ description: 'Câblage 2.5mm²', unit: 'm', unit_price: 12 }] });

      const pattern = memory.getTarifPattern(SIRET, 'Câblage 2.5mm²');
      expect(pattern).not.toBeNull();
      expect(pattern!.count).toBeGreaterThan(0);
      expect(pattern!.avg).toBeGreaterThan(0);
    });

    it('reaches max learning_confidence at 10 devis', async () => {
      const updateFn = vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) });
      const memory = new CompanyMemory({ from: vi.fn().mockReturnValue({ update: updateFn }) } as unknown as SupabaseClient);

      (memory as unknown as { cache: Map<string, unknown> }).cache.set(SIRET, {
        siret: SIRET, raison_sociale: 'TEST', region: null, secteur: null,
        tarifs: {}, formats: {}, processus: {}, insurance_profile: null,
        devis_count: 10, learning_confidence: 1.0, patterns: [],
      });

      await memory.learnFromDevis(SIRET, { montant_ht: 5000, montant_ttc: 6000 });

      // confidence should stay capped at 1.0
      const updateCall = updateFn.mock.calls[0][0] as { learning_confidence: number };
      expect(updateCall.learning_confidence).toBe(1.0);
    });
  });

  describe('getTarifPattern()', () => {
    it('returns null for unknown siret', () => {
      const memory = new CompanyMemory({} as unknown as SupabaseClient);
      expect(memory.getTarifPattern('99999999999999', 'Isolation')).toBeNull();
    });
  });

  describe('updateInsuranceProfile()', () => {
    it('stores insurance in cache and DB', async () => {
      const updateFn = vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) });
      const memory = new CompanyMemory({ from: vi.fn().mockReturnValue({ update: updateFn }) } as unknown as SupabaseClient);

      (memory as unknown as { cache: Map<string, unknown> }).cache.set(SIRET, {
        siret: SIRET, raison_sociale: 'TEST', region: null, secteur: null,
        tarifs: {}, formats: {}, processus: {}, insurance_profile: null,
        devis_count: 0, learning_confidence: 0, patterns: [],
      });

      await memory.updateInsuranceProfile(SIRET, {
        policy_number: 'POL-001',
        insurer: 'AXA',
        start_date: '2025-01-01',
        end_date: '2026-01-01',
        covered_activities: ['electricite', 'plomberie'],
        coverage_amounts: { responsabilite_civile: 1_000_000 },
        garanties: ['RC Pro'],
      });

      expect(updateFn).toHaveBeenCalled();

      const profile = await memory.getInsuranceProfile(SIRET);
      expect(profile?.insurer).toBe('AXA');
      expect(profile?.covered_activities).toContain('electricite');
    });
  });
});
