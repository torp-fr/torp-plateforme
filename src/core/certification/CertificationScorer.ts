// ─────────────────────────────────────────────────────────────────────────────
// CertificationScorer — Compute devis score (0–100) + star eligibility
// Scoring model: quality + conformity + insurance + benchmark + responsiveness
// ─────────────────────────────────────────────────────────────────────────────

import type { SupabaseClient } from '@supabase/supabase-js';

// ── Types ────────────────────────────────────────────────────────────────────

export interface CertificationFactors {
  /** 0–100: technical quality of the devis document */
  devisQuality: number;
  /** 0–100: regulatory conformity score */
  conformity: number;
  /** 0–10: bonus for having valid insurance coverage */
  insuranceCoverage: number;
  /** 0–100: market percentile (from BenchmarkEngine) */
  benchmarkPosition: number;
  /** 0–10: responsiveness / amendment speed */
  responsiveness?: number;
}

export interface StarEligibility {
  avg_score: number;
  eligible_for_stars: boolean;
  recommended_stars: 0 | 1 | 2 | 3 | 4 | 5;
  requirements_met: string[];
  requirements_missing: string[];
  next_milestone: string;
}

export interface CertificationBreakdown {
  total: number;
  quality_points: number;
  conformity_points: number;
  insurance_points: number;
  benchmark_points: number;
  responsiveness_points: number;
  grade: 'A' | 'B' | 'C' | 'D' | 'E';
}

// Score → grade mapping (same scale as TORP trust score)
const GRADE_THRESHOLDS: Array<{ min: number; grade: CertificationBreakdown['grade'] }> = [
  { min: 85, grade: 'A' },
  { min: 70, grade: 'B' },
  { min: 55, grade: 'C' },
  { min: 40, grade: 'D' },
  { min: 0,  grade: 'E' },
];

// ── CertificationScorer ───────────────────────────────────────────────────────

export class CertificationScorer {
  constructor(private readonly supabase: SupabaseClient) {}

  /**
   * Score a devis on a 0–100 scale.
   * Returns a simple number for quick comparison.
   */
  scoreDevis(factors: CertificationFactors): number {
    return this.computeBreakdown(factors).total;
  }

  /**
   * Full breakdown with grade letter.
   */
  computeBreakdown(factors: CertificationFactors): CertificationBreakdown {
    const qualityPoints     = Math.min(30, (factors.devisQuality / 100) * 30);
    const conformityPoints  = Math.min(30, (factors.conformity / 100) * 30);
    const insurancePoints   = Math.min(10, Math.max(0, factors.insuranceCoverage));
    const benchmarkPoints   = Math.min(20, (factors.benchmarkPosition / 100) * 20);
    const responsivenessPoints = Math.min(10, Math.max(0, factors.responsiveness ?? 5));

    const total = Math.round(
      qualityPoints + conformityPoints + insurancePoints + benchmarkPoints + responsivenessPoints
    );

    const capped = Math.min(100, Math.max(0, total));
    const grade = GRADE_THRESHOLDS.find(t => capped >= t.min)?.grade ?? 'E';

    return {
      total: capped,
      quality_points: Math.round(qualityPoints),
      conformity_points: Math.round(conformityPoints),
      insurance_points: Math.round(insurancePoints),
      benchmark_points: Math.round(benchmarkPoints),
      responsiveness_points: Math.round(responsivenessPoints),
      grade,
    };
  }

  /**
   * Determine star eligibility based on a company's recent scores.
   * Stars are forward-looking (economic model, not yet MVP).
   */
  async getStarEligibility(
    siret: string,
    recentScores: number[]
  ): Promise<StarEligibility> {
    if (recentScores.length === 0) {
      return {
        avg_score: 0,
        eligible_for_stars: false,
        recommended_stars: 0,
        requirements_met: [],
        requirements_missing: ['avg_score_85', 'min_devis_10', 'no_low_scores', 'insurance_coverage', 'no_recent_complaints'],
        next_milestone: 'Soumettre au moins 1 devis pour commencer l\'évaluation',
      };
    }

    const avgScore = recentScores.reduce((s, v) => s + v, 0) / recentScores.length;
    const hasValidInsurance = await this.checkValidInsurance(siret);
    const noRecentComplaints = await this.checkNoRecentComplaints(siret);

    const requirements = {
      avg_score_85:          avgScore >= 85,
      min_devis_10:          recentScores.length >= 10,
      no_low_scores:         !recentScores.some(s => s < 60),
      insurance_coverage:    hasValidInsurance,
      no_recent_complaints:  noRecentComplaints,
    };

    const met = (Object.entries(requirements) as [string, boolean][])
      .filter(([, v]) => v).map(([k]) => k);
    const missing = (Object.entries(requirements) as [string, boolean][])
      .filter(([, v]) => !v).map(([k]) => k);

    const recommendedStars = this.computeStars(avgScore, met.length);
    const nextMilestone = this.buildNextMilestone(avgScore, missing);

    return {
      avg_score: Math.round(avgScore),
      eligible_for_stars: recommendedStars > 0,
      recommended_stars: recommendedStars as 0 | 1 | 2 | 3 | 4 | 5,
      requirements_met: met,
      requirements_missing: missing,
      next_milestone: nextMilestone,
    };
  }

  // ── Private helpers ─────────────────────────────────────────────────────────

  private computeStars(avgScore: number, metCount: number): number {
    if (avgScore >= 95 && metCount >= 5) return 5;
    if (avgScore >= 90 && metCount >= 4) return 4;
    if (avgScore >= 85 && metCount >= 3) return 3;
    if (avgScore >= 75 && metCount >= 2) return 2;
    if (avgScore >= 65 && metCount >= 1) return 1;
    return 0;
  }

  private buildNextMilestone(avgScore: number, missing: string[]): string {
    if (missing.includes('min_devis_10')) return 'Soumettre 10 devis pour être éligible aux étoiles';
    if (missing.includes('avg_score_85')) return `Atteindre une moyenne de 85/100 (actuel: ${Math.round(avgScore)}/100)`;
    if (missing.includes('insurance_coverage')) return 'Uploader une attestation d\'assurance valide';
    if (missing.includes('no_low_scores')) return 'Éviter les scores inférieurs à 60/100';
    if (missing.includes('no_recent_complaints')) return 'Aucune réclamation récente requise';
    return 'Toutes les conditions remplies — éligibilité en cours de validation';
  }

  private async checkValidInsurance(siret: string): Promise<boolean> {
    const { data } = await this.supabase
      .from('company_profiles')
      .select('insurance_profile')
      .eq('siret', siret)
      .maybeSingle()
      .catch(() => ({ data: null }));

    const insurance = (data as { insurance_profile?: { end_date?: string } } | null)?.insurance_profile;
    if (!insurance?.end_date) return false;

    const expiryDays = (new Date(insurance.end_date).getTime() - Date.now()) / (86_400 * 1000);
    return expiryDays > 0;
  }

  private async checkNoRecentComplaints(siret: string): Promise<boolean> {
    // Check pipeline_dead_letters for complaint signals (placeholder)
    const { data } = await this.supabase
      .from('pipeline_dead_letters')
      .select('id')
      .eq('resource_id', siret)
      .eq('resolved', false)
      .gt('created_at', new Date(Date.now() - 90 * 24 * 3600 * 1000).toISOString())
      .limit(1)
      .catch(() => ({ data: [] }));

    return !data || data.length === 0;
  }
}
