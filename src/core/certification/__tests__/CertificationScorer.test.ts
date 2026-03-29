import { describe, it, expect, vi } from 'vitest';
import { CertificationScorer } from '../CertificationScorer.js';
import type { SupabaseClient } from '@supabase/supabase-js';

function makeMockSupabase(overrides?: {
  insuranceEndDate?: string | null;
  dlqCount?: number;
}): SupabaseClient {
  const endDate = overrides?.insuranceEndDate ?? '2030-01-01'; // Valid by default
  const dlqCount = overrides?.dlqCount ?? 0;

  return {
    from: vi.fn().mockImplementation((table: string) => {
      if (table === 'company_profiles') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({
            data: endDate ? { insurance_profile: { end_date: endDate } } : null,
            error: null,
          }),
        };
      }
      if (table === 'pipeline_dead_letters') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          gt: vi.fn().mockReturnThis(),
          limit: vi.fn().mockResolvedValue({ data: Array(dlqCount).fill({ id: 'x' }), error: null }),
        };
      }
      return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), maybeSingle: vi.fn().mockResolvedValue({ data: null }) };
    }),
  } as unknown as SupabaseClient;
}

describe('CertificationScorer', () => {
  describe('scoreDevis()', () => {
    it('perfect factors yields score close to 100', () => {
      const scorer = new CertificationScorer(makeMockSupabase());
      const score = scorer.scoreDevis({
        devisQuality: 100,
        conformity: 100,
        insuranceCoverage: 10,
        benchmarkPosition: 100,
        responsiveness: 10,
      });
      expect(score).toBe(100);
    });

    it('zero factors yields score of 0', () => {
      const scorer = new CertificationScorer(makeMockSupabase());
      const score = scorer.scoreDevis({
        devisQuality: 0,
        conformity: 0,
        insuranceCoverage: 0,
        benchmarkPosition: 0,
        responsiveness: 0,
      });
      expect(score).toBe(0);
    });

    it('insurance bonus adds 10 raw points', () => {
      const scorer = new CertificationScorer(makeMockSupabase());
      const withInsurance = scorer.scoreDevis({ devisQuality: 80, conformity: 80, insuranceCoverage: 10, benchmarkPosition: 50 });
      const withoutInsurance = scorer.scoreDevis({ devisQuality: 80, conformity: 80, insuranceCoverage: 0, benchmarkPosition: 50 });
      expect(withInsurance - withoutInsurance).toBe(10);
    });

    it('quality contributes 30% of total', () => {
      const scorer = new CertificationScorer(makeMockSupabase());
      const score = scorer.scoreDevis({ devisQuality: 100, conformity: 0, insuranceCoverage: 0, benchmarkPosition: 0, responsiveness: 0 });
      expect(score).toBe(30);
    });

    it('conformity contributes 30% of total', () => {
      const scorer = new CertificationScorer(makeMockSupabase());
      const score = scorer.scoreDevis({ devisQuality: 0, conformity: 100, insuranceCoverage: 0, benchmarkPosition: 0, responsiveness: 0 });
      expect(score).toBe(30);
    });

    it('benchmark contributes 20% of total', () => {
      const scorer = new CertificationScorer(makeMockSupabase());
      const score = scorer.scoreDevis({ devisQuality: 0, conformity: 0, insuranceCoverage: 0, benchmarkPosition: 100, responsiveness: 0 });
      expect(score).toBe(20);
    });
  });

  describe('computeBreakdown()', () => {
    it('returns grade A for score >= 85', () => {
      const scorer = new CertificationScorer(makeMockSupabase());
      const breakdown = scorer.computeBreakdown({
        devisQuality: 100, conformity: 100, insuranceCoverage: 10, benchmarkPosition: 80, responsiveness: 8,
      });
      expect(breakdown.grade).toBe('A');
      expect(breakdown.total).toBeGreaterThanOrEqual(85);
    });

    it('returns grade E for score < 40', () => {
      const scorer = new CertificationScorer(makeMockSupabase());
      const breakdown = scorer.computeBreakdown({
        devisQuality: 10, conformity: 10, insuranceCoverage: 0, benchmarkPosition: 10, responsiveness: 0,
      });
      expect(breakdown.grade).toBe('E');
    });

    it('individual points sum to total', () => {
      const scorer = new CertificationScorer(makeMockSupabase());
      const breakdown = scorer.computeBreakdown({
        devisQuality: 70, conformity: 60, insuranceCoverage: 10, benchmarkPosition: 50, responsiveness: 7,
      });
      const sum = breakdown.quality_points + breakdown.conformity_points + breakdown.insurance_points
        + breakdown.benchmark_points + breakdown.responsiveness_points;
      // Allow ±1 for rounding
      expect(Math.abs(sum - breakdown.total)).toBeLessThanOrEqual(1);
    });

    it('total is capped at 100', () => {
      const scorer = new CertificationScorer(makeMockSupabase());
      const breakdown = scorer.computeBreakdown({
        devisQuality: 100, conformity: 100, insuranceCoverage: 10, benchmarkPosition: 100, responsiveness: 10,
      });
      expect(breakdown.total).toBe(100);
    });
  });

  describe('getStarEligibility()', () => {
    it('returns 0 stars and all requirements missing for empty scores', async () => {
      const scorer = new CertificationScorer(makeMockSupabase());
      const result = await scorer.getStarEligibility('12345678901234', []);
      expect(result.recommended_stars).toBe(0);
      expect(result.eligible_for_stars).toBe(false);
      expect(result.requirements_missing.length).toBe(5);
    });

    it('recommends stars for company with high avg score + 10+ devis', async () => {
      const scorer = new CertificationScorer(makeMockSupabase({ insuranceEndDate: '2030-01-01' }));
      const scores = Array(10).fill(92); // 10 devis, avg = 92
      const result = await scorer.getStarEligibility('35600000059843', scores);
      expect(result.avg_score).toBe(92);
      expect(result.recommended_stars).toBeGreaterThanOrEqual(3);
      expect(result.eligible_for_stars).toBe(true);
    });

    it('blocks stars if insurance is expired', async () => {
      const scorer = new CertificationScorer(makeMockSupabase({ insuranceEndDate: '2020-01-01' }));
      const scores = Array(10).fill(90);
      const result = await scorer.getStarEligibility('12345678901234', scores);
      expect(result.requirements_missing).toContain('insurance_coverage');
    });

    it('blocks stars if any score below 60', async () => {
      const scorer = new CertificationScorer(makeMockSupabase());
      const scores = [...Array(9).fill(90), 55]; // one bad score
      const result = await scorer.getStarEligibility('12345678901234', scores);
      expect(result.requirements_missing).toContain('no_low_scores');
    });

    it('next_milestone mentions devis count when < 10', async () => {
      const scorer = new CertificationScorer(makeMockSupabase());
      const result = await scorer.getStarEligibility('12345678901234', [85, 90]);
      expect(result.next_milestone.toLowerCase()).toMatch(/10.*devis|devis.*10/);
    });
  });
});
