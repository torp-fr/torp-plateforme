import { describe, it, expect, vi } from 'vitest';
import { DependencyValidator } from '../DependencyValidator.js';
import type { SupabaseClient } from '@supabase/supabase-js';

// ── Mock factory ──────────────────────────────────────────────────────────────

function makeMockSupabase(tables: Record<string, unknown>) {
  return {
    from: vi.fn().mockImplementation((table: string) => {
      const row = tables[table] ?? null;
      const chain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: row, error: null }),
      };
      return chain;
    }),
  } as unknown as SupabaseClient;
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('DependencyValidator', () => {
  describe('validateClientExists()', () => {
    it('resolves without error when client exists', async () => {
      const supabase = makeMockSupabase({ clients: { id: 'c1' } });
      const validator = new DependencyValidator(supabase);
      await expect(validator.validateClientExists('c1')).resolves.not.toThrow();
    });

    it('throws when client does not exist', async () => {
      const supabase = makeMockSupabase({ clients: null });
      const validator = new DependencyValidator(supabase);
      await expect(validator.validateClientExists('missing-id')).rejects.toThrow('Client not found');
    });
  });

  describe('validateProjectExists()', () => {
    it('resolves without error when project exists', async () => {
      const supabase = makeMockSupabase({ projets: { id: 'p1' } });
      const validator = new DependencyValidator(supabase);
      await expect(validator.validateProjectExists('p1')).resolves.not.toThrow();
    });

    it('throws when project does not exist', async () => {
      const supabase = makeMockSupabase({ projets: null });
      const validator = new DependencyValidator(supabase);
      await expect(validator.validateProjectExists('missing-id')).rejects.toThrow('Project not found');
    });
  });

  describe('validateDevisReady()', () => {
    it('resolves when devis has a file_path', async () => {
      const supabase = makeMockSupabase({ devis: { id: 'd1', file_path: 'uploads/d1.pdf' } });
      const validator = new DependencyValidator(supabase);
      await expect(validator.validateDevisReady('d1')).resolves.not.toThrow();
    });

    it('throws when devis has no file_path', async () => {
      const supabase = makeMockSupabase({ devis: { id: 'd1', file_path: null } });
      const validator = new DependencyValidator(supabase);
      await expect(validator.validateDevisReady('d1')).rejects.toThrow('no file_path');
    });

    it('throws when devis not found', async () => {
      const supabase = makeMockSupabase({ devis: null });
      const validator = new DependencyValidator(supabase);
      await expect(validator.validateDevisReady('d1')).rejects.toThrow('Devis not found');
    });
  });

  describe('validateDevisAnalysisDependencies()', () => {
    it('returns valid=true for a complete devis with project', async () => {
      const supabase = {
        from: vi.fn().mockImplementation((table: string) => {
          const rows: Record<string, unknown> = {
            devis: { id: 'd1', projet_id: 'p1', entreprise_id: 'e1', file_path: 'f.pdf' },
            projets: { id: 'p1', type: 'piscine', localisation: { lat: 48.8, lon: 2.3 } },
          };
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({ data: rows[table] ?? null, error: null }),
          };
        }),
      } as unknown as SupabaseClient;

      const validator = new DependencyValidator(supabase);
      const result = await validator.validateDevisAnalysisDependencies('d1');

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('returns valid=false when devis is missing', async () => {
      const supabase = makeMockSupabase({ devis: null });
      const validator = new DependencyValidator(supabase);
      const result = await validator.validateDevisAnalysisDependencies('missing');

      expect(result.valid).toBe(false);
      expect(result.errors[0]).toMatch(/not found/);
    });

    it('returns valid=false when devis has no file_path', async () => {
      const supabase = makeMockSupabase({ devis: { id: 'd1', projet_id: 'p1', file_path: null } });
      const validator = new DependencyValidator(supabase);
      const result = await validator.validateDevisAnalysisDependencies('d1');

      expect(result.valid).toBe(false);
      expect(result.errors[0]).toMatch(/file_path/);
    });

    it('adds warnings for missing project_id', async () => {
      const supabase = makeMockSupabase({ devis: { id: 'd1', projet_id: null, entreprise_id: null, file_path: 'f.pdf' } });
      const validator = new DependencyValidator(supabase);
      const result = await validator.validateDevisAnalysisDependencies('d1');

      expect(result.valid).toBe(true); // Still valid
      expect(result.warnings.some(w => w.includes('project'))).toBe(true);
    });
  });

  describe('validateProjectDependencies()', () => {
    it('returns valid=true for complete project', async () => {
      const supabase = {
        from: vi.fn().mockImplementation((table: string) => {
          const rows: Record<string, unknown> = {
            projets: { id: 'p1', client_id: 'c1', type: 'renovation', localisation: { lat: 48 } },
            clients: { id: 'c1' },
          };
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({ data: rows[table] ?? null, error: null }),
          };
        }),
      } as unknown as SupabaseClient;

      const validator = new DependencyValidator(supabase);
      const result = await validator.validateProjectDependencies('p1');
      expect(result.valid).toBe(true);
    });

    it('errors when project type is missing', async () => {
      const supabase = {
        from: vi.fn().mockImplementation(() => ({
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({
            data: { id: 'p1', client_id: 'c1', type: null, localisation: null },
            error: null,
          }),
        })),
      } as unknown as SupabaseClient;

      const validator = new DependencyValidator(supabase);
      const result = await validator.validateProjectDependencies('p1');
      expect(result.errors.some(e => e.includes('type'))).toBe(true);
    });
  });
});
