/**
 * CoverageAnalyzer
 * Compare les lignes d'un devis contre les règles applicables.
 * Produit un rapport de couverture avec gaps identifiés.
 *
 * Algorithme de couverture (tiered):
 *  EXPLICIT (score ≥ 0.4) : des termes-clés de la règle sont mentionnés dans le devis
 *  IMPLICIT (domain match) : le devis a du travail dans le même domaine que la règle
 *  GAP (aucun match)       : règle non couverte — à signaler
 */

import {
  extractRuleKeywords,
  normalizeDevisText,
  coverageScore,
} from './ruleKeywordExtractor.service';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface RuleInput {
  id: string;
  domain: string;
  description: string | null;
  property_key?: string | null;  // structured_data.property
  rule_type?: string | null;
  risk_level?: 'high' | 'medium' | 'low';
  category?: string | null;
}

export interface DevisLine {
  description: string;
  amount?: number;
  category?: string;
}

export type CoverageStatus = 'explicit' | 'implicit' | 'gap';

export interface RuleCoverage {
  rule: RuleInput;
  status: CoverageStatus;
  score: number;           // 0–1
  matched_terms: string[]; // termes trouvés dans le devis
}

export interface CoverageGap {
  rule: RuleInput;
  severity: 'high' | 'medium' | 'low';
  reason: 'not_mentioned' | 'domain_only' | 'underspecified';
  suggestion: string;
}

export interface CoverageReport {
  total_rules: number;
  explicit_coverage: number;  // règles avec termes-clés dans le devis
  implicit_coverage: number;  // règles dans un domaine représenté mais sans termes
  gaps: number;               // règles non couvertes
  coverage_pct: number;       // (explicit + implicit) / total × 100
  explicit_pct: number;       // explicit / total × 100
  detail: RuleCoverage[];
  top_gaps: CoverageGap[];    // top 20 gaps triés par sévérité
  strengths: string[];        // domaines bien couverts
  risk_domains: string[];     // domaines avec gaps critiques
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function domainFromLines(lines: DevisLine[]): Set<string> {
  // Extrait les domaines présents via le champ `category` si disponible
  const domains = new Set<string>();
  for (const l of lines) {
    if (l.category) domains.add(l.category);
  }
  return domains;
}

function makeSuggestion(rule: RuleInput): string {
  const desc = rule.description ?? rule.property_key ?? 'cette exigence';
  const short = desc.length > 70 ? desc.slice(0, 70) + '…' : desc;
  return `Mentionner explicitement : « ${short} »`;
}

function toSeverity(rule: RuleInput): 'high' | 'medium' | 'low' {
  if (rule.risk_level) return rule.risk_level;
  // heuristique : les formulas/requirements sont généralement critiques
  if (rule.rule_type === 'requirement') return 'high';
  if (rule.rule_type === 'formula') return 'medium';
  return 'low';
}

// ── API publique ───────────────────────────────────────────────────────────────

/**
 * Analyse la couverture des règles applicables par les lignes du devis.
 *
 * Seuils de couverture:
 *   explicit : coverageScore ≥ THRESHOLD_EXPLICIT (termes clés mentionnés)
 *   implicit : domaine représenté dans le devis mais pas les termes spécifiques
 *   gap      : ni termes ni domaine → vraie lacune
 */
export function analyzeCoverage(
  devisLines: DevisLine[],
  applicableRules: RuleInput[],
  options: {
    /** Score minimum pour "explicit". Défaut: 0.25 (au moins 1/4 des termes). */
    thresholdExplicit?: number;
    /** Domaines représentés dans le devis (pour implicit). */
    representedDomains?: Set<string>;
  } = {},
): CoverageReport {
  const { thresholdExplicit = 0.25 } = options;

  // Pré-normalise le texte complet du devis (une seule fois)
  const devisNorm = normalizeDevisText(devisLines);
  const repDomains = options.representedDomains ?? domainFromLines(devisLines);

  const detail: RuleCoverage[] = [];
  const gapList: CoverageGap[] = [];

  let explicitCount = 0;
  let implicitCount = 0;
  const domainGapCounts: Record<string, number> = {};
  const domainHighGapCounts: Record<string, number> = {};

  for (const rule of applicableRules) {
    const keywords = extractRuleKeywords(
      rule.description ?? '',
      rule.property_key,
    );

    const score = coverageScore(keywords, devisNorm);

    // Termes effectivement trouvés dans le devis
    const matched = keywords.filter((kw) => devisNorm.includes(kw));

    let status: CoverageStatus;

    if (score >= thresholdExplicit) {
      status = 'explicit';
      explicitCount++;
    } else if (repDomains.has(rule.domain)) {
      status = 'implicit';
      implicitCount++;
    } else {
      status = 'gap';
      domainGapCounts[rule.domain] = (domainGapCounts[rule.domain] ?? 0) + 1;
      if (toSeverity(rule) === 'high') {
        domainHighGapCounts[rule.domain] = (domainHighGapCounts[rule.domain] ?? 0) + 1;
      }
      gapList.push({
        rule,
        severity: toSeverity(rule),
        reason: score === 0 ? 'not_mentioned' : 'underspecified',
        suggestion: makeSuggestion(rule),
      });
    }

    detail.push({ rule, status, score, matched_terms: matched });
  }

  // Trier les gaps : high en premier, puis medium, puis low
  const severityRank: Record<string, number> = { high: 0, medium: 1, low: 2 };
  gapList.sort((a, b) => severityRank[a.severity] - severityRank[b.severity]);

  // Domaines avec gaps (ordonnés par nombre de gaps critiques)
  const riskDomains = Object.entries(domainHighGapCounts)
    .sort(([, a], [, b]) => b - a)
    .map(([d]) => d);

  // Domaines bien couverts : explicit count élevé
  const domainExplicit: Record<string, number> = {};
  for (const rc of detail) {
    if (rc.status === 'explicit') {
      domainExplicit[rc.rule.domain] = (domainExplicit[rc.rule.domain] ?? 0) + 1;
    }
  }
  const strengths = Object.entries(domainExplicit)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3)
    .map(([d, n]) => `${d} (${n} règles couvertes explicitement)`);

  const total = applicableRules.length;
  const covered = explicitCount + implicitCount;

  return {
    total_rules: total,
    explicit_coverage: explicitCount,
    implicit_coverage: implicitCount,
    gaps: gapList.length,
    coverage_pct: total === 0 ? 100 : Math.round((covered / total) * 100),
    explicit_pct: total === 0 ? 100 : Math.round((explicitCount / total) * 100),
    detail,
    top_gaps: gapList.slice(0, 20),
    strengths,
    risk_domains: riskDomains,
  };
}
