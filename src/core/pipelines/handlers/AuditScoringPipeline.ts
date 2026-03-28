// ─────────────────────────────────────────────────────────────────────
// AuditScoringPipeline
// Runs Phase 2 coverage analysis + Phase 3 scoring on a parsed devis
// Input:  { devisId }
// Output: { coverage_analysis, scoring, recommendations, public_summary }
// ─────────────────────────────────────────────────────────────────────

import { createClient } from '@supabase/supabase-js';
import type { PipelineContext, PipelineResult, DevisItem } from '../types/index.js';

// Imports from Phase 2 reasoning layer
import { analyzeCoverage } from '../../reasoning/coverageAnalyzer.service.js';
import { generateRecommendations } from '../../reasoning/recommendationGenerator.service.js';
import { generateAuditReport } from '../../reasoning/auditReportGenerator.service.js';

type Grade = 'A' | 'B' | 'C' | 'D' | 'E';

interface ScoringDimension {
  key: string;
  name: string;
  score: number;
  weight: number;
  reasoning: string;
}

interface ScoringResult {
  dimensions: ScoringDimension[];
  final_score: number;
  grade: Grade;
  potential_score: number;
  potential_grade: Grade;
  scoring_version: string;
  computed_at: string;
}

interface AuditScoringOutput {
  coverage_analysis: unknown;
  scoring: ScoringResult;
  recommendations: unknown[];
  public_summary: {
    title: string;
    score: number;
    grade: Grade;
    risk_label: string;
    compliance_verdict: string;
    highlights: string[];
    key_findings: string[];
    top_recommendation: string;
  };
}

const DIMENSION_WEIGHTS = {
  conformite:    0.30,
  exhaustivite:  0.25,
  clarte:        0.20,
  competitivite: 0.15,
  risques:       0.10,
};

const GRADE_LABELS: Record<Grade, { fr: string; risk: string }> = {
  A: { fr: 'Excellent',   risk: 'Très faible' },
  B: { fr: 'Bon',         risk: 'Faible' },
  C: { fr: 'Passable',    risk: 'Modéré' },
  D: { fr: 'Insuffisant', risk: 'Élevé' },
  E: { fr: 'Critique',    risk: 'Très élevé' },
};

function scoreToGrade(score: number): Grade {
  if (score >= 85) return 'A';
  if (score >= 70) return 'B';
  if (score >= 55) return 'C';
  if (score >= 40) return 'D';
  return 'E';
}

export class AuditScoringPipeline {
  private supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  async execute(
    params: { devisId: string },
    context: PipelineContext
  ): Promise<PipelineResult<AuditScoringOutput>> {
    const startTime = Date.now();

    try {
      // Step 1: Load devis + project from DB
      const { devis, projet } = await this.loadData(params.devisId);

      if (!devis || !projet) {
        return {
          status: 'failed',
          error: `Devis ${params.devisId} or its projet not found`,
          executionTimeMs: Date.now() - startTime,
          retryable: false,
        };
      }

      const items: DevisItem[] = devis.parsing_result?.items ?? [];
      const projectType: string = projet.type;
      const impliedDomains: string[] = projet.implied_domains ?? [];

      // Step 2: Phase 2 coverage analysis
      const devisLines = items.map(item => ({
        description: item.description,
        category:    item.category,
        domain:      item.domain,
      }));

      // Fetch rules for implied domains from knowledge_chunks
      const rules = await this.fetchRulesForDomains(impliedDomains);

      let coverageReport: ReturnType<typeof analyzeCoverage> | null = null;
      try {
        coverageReport = analyzeCoverage(devisLines, rules);
      } catch (err) {
        console.warn('[AuditScoring] Coverage analysis failed:', err);
      }

      // Step 3: Generate recommendations
      const recommendations = coverageReport
        ? generateRecommendations(coverageReport)
        : [];

      // Step 4: Phase 3 scoring — 5 dimensions
      const dimensions = this.computeDimensions(items, impliedDomains, coverageReport);
      const scoringResult = this.computeFinalScore(dimensions);

      // Step 5: Generate audit report (Phase 2 format)
      let auditReport = null;
      if (coverageReport) {
        try {
          auditReport = generateAuditReport(
            `Projet ${projectType}`,
            projectType,
            coverageReport,
            recommendations
          );
        } catch (err) {
          console.warn('[AuditScoring] Audit report generation failed:', err);
        }
      }

      // Step 6: Build public summary
      const grade = scoringResult.grade;
      const gradeInfo = GRADE_LABELS[grade];

      const compliance_verdict =
        grade === 'A' ? 'conforme' :
        grade === 'B' ? 'attention' :
        grade === 'C' ? 'non_conforme' :
        'critique';

      const public_summary = {
        title:      `Audit de devis — ${projectType}`,
        score:      scoringResult.final_score,
        grade,
        risk_label: gradeInfo.risk,
        compliance_verdict,
        highlights: dimensions
          .filter(d => d.score >= 75)
          .slice(0, 3)
          .map(d => `${d.name}: ${d.score}/100`),
        key_findings: dimensions
          .filter(d => d.score < 55)
          .slice(0, 3)
          .map(d => d.reasoning),
        top_recommendation: (recommendations as Array<{ action?: string }>)[0]?.action
          ?? `Améliorer la dimension "${dimensions.sort((a, b) => a.score - b.score)[0]?.name}"`,
      };

      const data: AuditScoringOutput = {
        coverage_analysis: coverageReport ?? auditReport?.coverage ?? null,
        scoring:           scoringResult,
        recommendations,
        public_summary,
      };

      return {
        status: 'completed',
        data,
        executionTimeMs: Date.now() - startTime,
        retryable: false,
      };
    } catch (err) {
      return {
        status: 'failed',
        error: err instanceof Error ? err.message : String(err),
        executionTimeMs: Date.now() - startTime,
        retryable: true,
      };
    }
  }

  private async loadData(devisId: string) {
    const { data: devis } = await this.supabase
      .from('devis')
      .select('id, parsing_result, projet_id')
      .eq('id', devisId)
      .single();

    if (!devis) return { devis: null, projet: null };

    const { data: projet } = await this.supabase
      .from('projets')
      .select('id, type, implied_domains, contexte_reglementaire')
      .eq('id', devis.projet_id)
      .single();

    return { devis, projet };
  }

  private async fetchRulesForDomains(domains: string[]): Promise<Array<{ id: string; content: string; metadata?: Record<string, unknown> }>> {
    if (domains.length === 0) return [];

    const { data } = await this.supabase
      .from('knowledge_chunks')
      .select('id, content, metadata')
      .limit(100);

    return (data ?? []).filter(chunk => {
      const domain = (chunk.metadata as Record<string, unknown>)?.['domain'] as string | undefined;
      return !domain || domains.some(d => domain.includes(d));
    });
  }

  private computeDimensions(
    items: DevisItem[],
    impliedDomains: string[],
    coverageReport: ReturnType<typeof analyzeCoverage> | null
  ): ScoringDimension[] {
    return [
      this.scoreConformite(coverageReport),
      this.scoreExhaustivite(items, impliedDomains),
      this.scoreClarte(items),
      this.scoreCompetitivite(items),
      this.scoreRisques(items),
    ];
  }

  private scoreConformite(coverageReport: ReturnType<typeof analyzeCoverage> | null): ScoringDimension {
    if (!coverageReport) {
      return { key: 'conformite', name: 'Conformité réglementaire', score: 50, weight: DIMENSION_WEIGHTS.conformite, reasoning: 'Analyse réglementaire indisponible — score neutre.' };
    }

    const report = coverageReport as { coverage_pct?: number; explicit_pct?: number; top_gaps?: Array<{ severity?: string }> };
    const base = report.coverage_pct ?? 50;
    const bonus = ((report.explicit_pct ?? 0) / 100) * 10;
    const criticalGaps = (report.top_gaps ?? []).filter((g) => g.severity === 'high').length;
    const score = Math.min(100, Math.max(0, base + bonus - criticalGaps * 10));

    return {
      key:       'conformite',
      name:      'Conformité réglementaire',
      score:     Math.round(score),
      weight:    DIMENSION_WEIGHTS.conformite,
      reasoning: `Couverture: ${base.toFixed(1)}%. ${criticalGaps} lacune(s) critique(s).`,
    };
  }

  private scoreExhaustivite(items: DevisItem[], impliedDomains: string[]): ScoringDimension {
    const coveredDomains = new Set(items.map(i => i.domain).filter(Boolean));
    const missing = impliedDomains.filter(d => !coveredDomains.has(d));
    const domainCoverage = impliedDomains.length > 0 ? (coveredDomains.size / impliedDomains.length) * 100 : 100;
    const densityScore = items.length < 3 ? 20 : items.length < 7 ? 60 : items.length < 15 ? 85 : 100;
    const score = Math.round(domainCoverage * 0.7 + densityScore * 0.3);

    return {
      key:       'exhaustivite',
      name:      'Exhaustivité des prestations',
      score,
      weight:    DIMENSION_WEIGHTS.exhaustivite,
      reasoning: `${coveredDomains.size}/${impliedDomains.length} domaine(s) couverts. ${items.length} postes. ${missing.length ? `Manquant: ${missing.join(', ')}.` : ''}`,
    };
  }

  private scoreClarte(items: DevisItem[]): ScoringDimension {
    if (items.length === 0) return { key: 'clarte', name: 'Clarté et précision', score: 0, weight: DIMENSION_WEIGHTS.clarte, reasoning: 'Aucun poste parsé.' };

    const scores = items.map(item => {
      let s = 100;
      if (item.description.length < 10) s -= 30;
      else if (item.description.length < 25) s -= 15;
      if (!item.quantity || item.quantity === 0) s -= 20;
      if (!item.unit || item.unit === '') s -= 10;
      if (!item.unit_price || item.unit_price === 0) s -= 25;
      if (!item.category || item.category === 'autre') s -= 5;
      return Math.max(0, s);
    });

    const avg = scores.reduce((s, v) => s + v, 0) / scores.length;
    const poor = scores.filter(s => s < 50).length;

    return {
      key:       'clarte',
      name:      'Clarté et précision',
      score:     Math.round(avg),
      weight:    DIMENSION_WEIGHTS.clarte,
      reasoning: `Moyenne par poste: ${avg.toFixed(1)}/100. ${poor} poste(s) insuffisamment détaillé(s).`,
    };
  }

  private scoreCompetitivite(items: DevisItem[]): ScoringDimension {
    // Phase 3B: market price comparison — stub for now
    const zeroPrice = items.filter(i => !i.unit_price || i.unit_price === 0).length;
    const score = Math.max(40, 80 - zeroPrice * 10);

    return {
      key:       'competitivite',
      name:      'Compétitivité des prix',
      score,
      weight:    DIMENSION_WEIGHTS.competitivite,
      reasoning: `${zeroPrice} poste(s) sans prix unitaire. Benchmark marché à implémenter (Phase 3B).`,
    };
  }

  private scoreRisques(items: DevisItem[]): ScoringDimension {
    // Red flags: total mismatch, zero-price items, very short descriptions
    const zeroPrice   = items.filter(i => !i.unit_price || i.unit_price === 0).length;
    const vague       = items.filter(i => i.description.length < 8).length;
    const totalCheck  = items.reduce((s, i) => s + (i.quantity * i.unit_price - i.total_ht), 0);
    const mismatch    = Math.abs(totalCheck) > 1 ? 1 : 0;

    const score = Math.max(0, 100 - zeroPrice * 5 - vague * 10 - mismatch * 15);

    return {
      key:       'risques',
      name:      'Risques et anomalies',
      score,
      weight:    DIMENSION_WEIGHTS.risques,
      reasoning: `${zeroPrice} prix à 0€. ${vague} descriptions vagues. Cohérence totaux: ${mismatch ? 'incohérente' : 'OK'}.`,
    };
  }

  private computeFinalScore(dimensions: ScoringDimension[]): ScoringResult {
    const totalWeight = dimensions.reduce((s, d) => s + d.weight, 0);
    const final_score = dimensions.reduce((s, d) => s + d.score * d.weight, 0) / totalWeight;

    const potential = Math.min(100, final_score + dimensions
      .filter(d => d.score < 70)
      .reduce((s, d) => s + Math.min(20, (70 - d.score) * 0.5) * d.weight, 0));

    return {
      dimensions,
      final_score:    Math.round(final_score * 10) / 10,
      grade:          scoreToGrade(final_score),
      potential_score: Math.round(potential * 10) / 10,
      potential_grade: scoreToGrade(potential),
      scoring_version: '1.0',
      computed_at:     new Date().toISOString(),
    };
  }
}
