import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { InsuranceValidator } from '../InsuranceValidator.js';
import type { SupabaseClient } from '@supabase/supabase-js';

const mockSupabase = {} as unknown as SupabaseClient;

// ── Helpers ───────────────────────────────────────────────────────────────────

const VALID_INSURANCE = {
  policy_number: 'POL-2026-001',
  insurer: 'AXA France',
  start_date: '2026-01-01',
  end_date: '2028-01-01',
  covered_activities: ['electricite', 'plomberie', 'isolation'],
  coverage_amounts: { responsabilite_civile: 2_000_000, dommages_ouvrage: 500_000 },
  garanties: ['RC Pro', 'Décennale'],
  exclusions: [],
  confidence: 0.95,
};

const EXPIRED_INSURANCE = {
  ...VALID_INSURANCE,
  end_date: '2020-01-01', // in the past
};

// ── Tests ────────────────────────────────────────────────────────────────────

describe('InsuranceValidator', () => {
  describe('validateCoverage()', () => {
    let validator: InsuranceValidator;

    beforeEach(() => {
      validator = new InsuranceValidator(mockSupabase);
    });

    it('is_covered = true when all project domains are covered', () => {
      const result = validator.validateCoverage(VALID_INSURANCE, ['electricite', 'plomberie']);
      expect(result.is_covered).toBe(true);
      expect(result.uncovered_domains).toHaveLength(0);
    });

    it('is_covered = false when some domains are not covered', () => {
      const result = validator.validateCoverage(VALID_INSURANCE, ['electricite', 'couverture']);
      expect(result.is_covered).toBe(false);
      expect(result.uncovered_domains).toContain('couverture');
    });

    it('is_covered = false when insurance is expired', () => {
      const result = validator.validateCoverage(EXPIRED_INSURANCE, ['electricite']);
      expect(result.is_covered).toBe(false);
      expect(result.expiry_alert).toMatch(/expir/i);
    });

    it('expiry_alert warns when insurance expires in < 30 days', () => {
      const soonExpiry = {
        ...VALID_INSURANCE,
        end_date: new Date(Date.now() + 15 * 86_400 * 1000).toISOString().substring(0, 10),
      };
      const result = validator.validateCoverage(soonExpiry, []);
      // Alert should mention a number of days (14–16 depending on timezone truncation)
      expect(result.expiry_alert).toMatch(/\d+ jours/);
    });

    it('no expiry_alert for insurance valid for > 60 days', () => {
      const farExpiry = {
        ...VALID_INSURANCE,
        end_date: new Date(Date.now() + 200 * 86_400 * 1000).toISOString().substring(0, 10),
      };
      const result = validator.validateCoverage(farExpiry, ['electricite']);
      expect(result.expiry_alert).toBeNull();
    });

    it('flags exclusion alerts for matching domains', () => {
      const insuranceWithExclusions = {
        ...VALID_INSURANCE,
        exclusions: ['plomberie non couverte au-delà de 2 étages'],
      };
      const result = validator.validateCoverage(insuranceWithExclusions, ['plomberie']);
      expect(result.exclusion_alerts.length).toBeGreaterThan(0);
    });

    it('confidence is passed through', () => {
      const result = validator.validateCoverage(VALID_INSURANCE, ['electricite']);
      expect(result.confidence).toBe(0.95);
    });
  });

  describe('buildAlerts()', () => {
    let validator: InsuranceValidator;

    beforeEach(() => {
      validator = new InsuranceValidator(mockSupabase);
    });

    it('returns expiry alert for expired insurance', () => {
      const alerts = validator.buildAlerts(EXPIRED_INSURANCE);
      expect(alerts.some(a => a.toLowerCase().includes('expir'))).toBe(true);
    });

    it('returns renewal alert for insurance expiring within 60 days', () => {
      const soonExpiry = {
        ...VALID_INSURANCE,
        end_date: new Date(Date.now() + 30 * 86_400 * 1000).toISOString().substring(0, 10),
      };
      const alerts = validator.buildAlerts(soonExpiry);
      expect(alerts.length).toBeGreaterThan(0);
    });

    it('alerts when no activities are covered', () => {
      const noActivities = { ...VALID_INSURANCE, covered_activities: [] };
      const alerts = validator.buildAlerts(noActivities);
      expect(alerts.some(a => a.toLowerCase().includes('activit'))).toBe(true);
    });

    it('alerts when policy number is null', () => {
      const noPolicy = { ...VALID_INSURANCE, policy_number: null };
      const alerts = validator.buildAlerts(noPolicy);
      expect(alerts.some(a => a.toLowerCase().includes('police') || a.toLowerCase().includes('numéro'))).toBe(true);
    });

    it('returns no alerts for valid insurance', () => {
      const alerts = validator.buildAlerts({
        ...VALID_INSURANCE,
        end_date: new Date(Date.now() + 200 * 86_400 * 1000).toISOString().substring(0, 10),
      });
      expect(alerts).toHaveLength(0);
    });
  });

  describe('parseDocument()', () => {
    let validator: InsuranceValidator;

    beforeEach(() => {
      validator = new InsuranceValidator(mockSupabase);
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('throws for unsupported file type', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        arrayBuffer: async () => new ArrayBuffer(8),
      }));

      await expect(
        validator.parseDocument('http://x/f.docx', 'f.docx')
      ).rejects.toThrow(/unsupported/i);

      vi.unstubAllGlobals();
    });

    it('throws when file download fails', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
      }));

      await expect(
        validator.parseDocument('http://x/f.pdf', 'f.pdf')
      ).rejects.toThrow(/HTTP 404/);

      vi.unstubAllGlobals();
    });
  });
});
