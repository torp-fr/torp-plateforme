/**
 * AuditReportGenerator
 * Compile un rapport d'audit complet à partir du rapport de couverture et des recommandations.
 * Produit un JSON structuré prêt à être affiché ou stocké.
 */

import type { CoverageReport } from './coverageAnalyzer.service';
import type { Recommendation } from './recommendationGenerator.service';

// ── Types ─────────────────────────────────────────────────────────────────────

export type RiskLevel = 'critical' | 'high' | 'medium' | 'low';

export interface ExecutiveSummary {
  risk_level: RiskLevel;
  risk_label: string;         // libellé lisible (ex: "Risque élevé")
  coverage_pct: number;
  explicit_pct: number;
  total_rules: number;
  gap_count: number;
  key_findings: string[];     // 2–4 constats majeurs en français
}

export interface AuditReport {
  meta: {
    project_name: string;
    project_type: string | null;
    generated_at: string;     // ISO 8601
    audit_version: string;
  };
  executive_summary: ExecutiveSummary;
  coverage: {
    total_rules: number;
    explicit: number;
    implicit: number;
    gaps: number;
    coverage_pct: number;
    explicit_pct: number;
    risk_domains: string[];
    strengths: string[];
  };
  recommendations: Recommendation[];
  compliance_verdict: 'conforme' | 'attention' | 'non_conforme' | 'critique';
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function toRiskLevel(coveragePct: number): RiskLevel {
  if (coveragePct < 50) return 'critical';
  if (coveragePct < 70) return 'high';
  if (coveragePct < 85) return 'medium';
  return 'low';
}

const RISK_LABELS: Record<RiskLevel, string> = {
  critical: 'Risque critique',
  high:     'Risque élevé',
  medium:   'Risque modéré',
  low:      'Risque faible',
};

function toVerdict(riskLevel: RiskLevel): AuditReport['compliance_verdict'] {
  if (riskLevel === 'critical') return 'critique';
  if (riskLevel === 'high')     return 'non_conforme';
  if (riskLevel === 'medium')   return 'attention';
  return 'conforme';
}

function buildKeyFindings(
  coverage: CoverageReport,
  riskLevel: RiskLevel,
): string[] {
  const findings: string[] = [];

  // Couverture globale
  findings.push(
    `Couverture globale : ${coverage.coverage_pct}% (${coverage.explicit_coverage} règles explicites, ${coverage.implicit_coverage} implicites sur ${coverage.total_rules})`,
  );

  // Gaps critiques
  if (coverage.gaps > 0) {
    const highGaps = coverage.top_gaps.filter((g) => g.severity === 'high').length;
    if (highGaps > 0) {
      findings.push(`${highGaps} règle(s) à risque élevé non couvertes dans le devis`);
    }
  }

  // Domaines à risque
  if (coverage.risk_domains.length > 0) {
    findings.push(`Domaines critiques avec lacunes : ${coverage.risk_domains.slice(0, 3).join(', ')}`);
  }

  // Points forts
  if (coverage.strengths.length > 0) {
    findings.push(`Points forts : ${coverage.strengths[0]}`);
  }

  // Verdict global
  if (riskLevel === 'low') {
    findings.push('Le devis couvre correctement les exigences réglementaires applicables');
  }

  return findings.slice(0, 4);
}

// ── API publique ───────────────────────────────────────────────────────────────

/**
 * Génère un rapport d'audit complet.
 *
 * @param projectName     - Nom du projet / devis
 * @param projectType     - Type de projet (ex: 'piscine', 'maison_neuve')
 * @param coverageReport  - Rapport de couverture issu de analyzeCoverage()
 * @param recommendations - Recommandations issues de generateRecommendations()
 */
export function generateAuditReport(
  projectName: string,
  projectType: string | null,
  coverageReport: CoverageReport,
  recommendations: Recommendation[],
): AuditReport {
  const riskLevel = toRiskLevel(coverageReport.coverage_pct);

  const executiveSummary: ExecutiveSummary = {
    risk_level: riskLevel,
    risk_label: RISK_LABELS[riskLevel],
    coverage_pct: coverageReport.coverage_pct,
    explicit_pct: coverageReport.explicit_pct,
    total_rules: coverageReport.total_rules,
    gap_count: coverageReport.gaps,
    key_findings: buildKeyFindings(coverageReport, riskLevel),
  };

  return {
    meta: {
      project_name: projectName,
      project_type: projectType,
      generated_at: new Date().toISOString(),
      audit_version: '1.0',
    },
    executive_summary: executiveSummary,
    coverage: {
      total_rules: coverageReport.total_rules,
      explicit: coverageReport.explicit_coverage,
      implicit: coverageReport.implicit_coverage,
      gaps: coverageReport.gaps,
      coverage_pct: coverageReport.coverage_pct,
      explicit_pct: coverageReport.explicit_pct,
      risk_domains: coverageReport.risk_domains,
      strengths: coverageReport.strengths,
    },
    recommendations,
    compliance_verdict: toVerdict(riskLevel),
  };
}
