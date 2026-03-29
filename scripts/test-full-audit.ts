/**
 * E2E test — Full Audit Completeness Chain (Étape 2B)
 *
 * Validates the 4-service reasoning chain end-to-end:
 *   extractRuleKeywords → analyzeCoverage → generateRecommendations → generateAuditReport
 *
 * Does NOT require Supabase — pure in-process test with synthetic data.
 *
 * Run: npx tsx scripts/test-full-audit.ts
 */

import { extractRuleKeywords, coverageScore, normalizeDevisText } from '../src/core/reasoning/ruleKeywordExtractor.service';
import { analyzeCoverage, type RuleInput, type DevisLine } from '../src/core/reasoning/coverageAnalyzer.service';
import { generateRecommendations } from '../src/core/reasoning/recommendationGenerator.service';
import { generateAuditReport } from '../src/core/reasoning/auditReportGenerator.service';

// ── Fixtures ─────────────────────────────────────────────────────────────────

const PISCINE_DEVIS_LINES: DevisLine[] = [
  { description: 'Terrassement et fouilles pour bassin 8x4m', category: 'structure' },
  { description: 'Structure béton armé bassin ferraillage HA20', category: 'structure' },
  { description: 'Plomberie réseau filtration pompe 12m³/h', category: 'plomberie' },
  { description: 'Installation électrique pompe tableau TGBT', category: 'electricite' },
  { description: 'Revêtement carrelage piscine anti-dérapant' },
];

const PISCINE_RULES: RuleInput[] = [
  // Structure — high risk
  {
    id: 'r1', domain: 'structure', rule_type: 'requirement', risk_level: 'high',
    description: 'Béton armé doit respecter la classe C25/30 minimum selon Eurocode 2',
    property_key: 'classe_beton', category: 'structure',
  },
  {
    id: 'r2', domain: 'structure', rule_type: 'requirement', risk_level: 'high',
    description: 'Ferraillage conforme DTU 13.1 — étude géotechnique obligatoire',
    property_key: 'ferraillage_dtu', category: 'structure',
  },
  // Hydraulique — medium risk
  {
    id: 'r3', domain: 'hydraulique', rule_type: 'constraint', risk_level: 'medium',
    description: 'Débit de filtration minimum 0.5 volume/heure pour piscine publique',
    property_key: 'debit_filtration', category: 'hydraulique',
  },
  {
    id: 'r4', domain: 'hydraulique', rule_type: 'constraint', risk_level: 'low',
    description: 'Traitement eau pH entre 7.2 et 7.6 mesuré quotidiennement',
    property_key: 'ph_eau', category: 'hydraulique',
  },
  // Électrique — high risk
  {
    id: 'r5', domain: 'électrique', rule_type: 'requirement', risk_level: 'high',
    description: 'Conformité NF C 15-100 pour installations en zone humide',
    property_key: 'nf_c_15_100_humide', category: 'électrique',
  },
  // Sécurité — high risk (gap — not in devis at all)
  {
    id: 'r6', domain: 'sécurité', rule_type: 'requirement', risk_level: 'high',
    description: 'Barrière de sécurité NF P90-306 obligatoire pour piscine privée',
    property_key: 'barriere_nf_p90', category: 'sécurité',
  },
  {
    id: 'r7', domain: 'sécurité', rule_type: 'requirement', risk_level: 'high',
    description: 'Alarme immersion conforme NF P90-307 avec détecteur certifié',
    property_key: 'alarme_immersion', category: 'sécurité',
  },
  // Thermique — low risk (gap)
  {
    id: 'r8', domain: 'thermique', rule_type: 'formula', risk_level: 'low',
    description: 'Déperditions thermiques bassin couvert à calculer selon RT2020',
    property_key: 'deperditions_thermiques', category: 'thermique',
  },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function ok(label: string, condition: boolean): void {
  console.log(`  ${condition ? '✅' : '❌'} ${label}`);
  if (!condition) process.exitCode = 1;
}

function section(title: string): void {
  console.log(`\n── ${title} ${'─'.repeat(Math.max(0, 60 - title.length))}`);
}

// ── Test 1: RuleKeywordExtractor ──────────────────────────────────────────────

section('1. RuleKeywordExtractor');

const kw1 = extractRuleKeywords('Béton armé doit respecter la classe C25/30 minimum selon Eurocode 2', 'classe_beton');
ok('Retourne des keywords', kw1.length > 0);
ok('"classe" extrait du property_key', kw1.includes('classe'));
ok('"beton" extrait (normalisé)', kw1.includes('beton'));
ok('"eurocode" extrait de la description', kw1.includes('eurocode'));

const devisNorm = normalizeDevisText(PISCINE_DEVIS_LINES);
ok('normalizeDevisText retourne une string non-vide', devisNorm.length > 0);
ok('devis normalisé contient "beton"', devisNorm.includes('beton'));

const score = coverageScore(kw1, devisNorm);
ok(`coverageScore r1 (béton) > 0 — score=${score.toFixed(2)}`, score > 0);

// ── Test 2: CoverageAnalyzer ──────────────────────────────────────────────────

section('2. CoverageAnalyzer');

const report = analyzeCoverage(PISCINE_DEVIS_LINES, PISCINE_RULES);

ok(`total_rules = ${report.total_rules}`, report.total_rules === PISCINE_RULES.length);
ok(`coverage_pct entre 0 et 100`, report.coverage_pct >= 0 && report.coverage_pct <= 100);
ok(`gaps >= 2 (sécurité + thermique non couverts)`, report.gaps >= 2);
ok('top_gaps triés high en premier', report.top_gaps[0]?.severity === 'high');
ok('risk_domains inclut "sécurité"', report.risk_domains.includes('sécurité'));
ok('strengths non vide', report.strengths.length > 0);

console.log(`     coverage: ${report.coverage_pct}% (explicit=${report.explicit_coverage}, implicit=${report.implicit_coverage}, gaps=${report.gaps})`);
console.log(`     risk_domains: [${report.risk_domains.join(', ')}]`);
console.log(`     strengths: ${report.strengths[0] ?? 'n/a'}`);

// ── Test 3: RecommendationGenerator ───────────────────────────────────────────

section('3. RecommendationGenerator');

const recs = generateRecommendations(report.top_gaps, 10);

ok('Retourne des recommandations', recs.length > 0);
ok('Première recommandation priority=critical ou high', ['critical', 'high'].includes(recs[0]?.priority));
ok('Toutes ont un domain, action, rationale', recs.every((r) => r.domain && r.action && r.rationale));
ok('gap_count >= 1 sur chaque rec', recs.every((r) => r.gap_count >= 1));
ok('Pas de recommandations dupliquées par domain', (() => {
  const domains = recs.map((r) => `${r.domain}::${r.priority}`);
  return domains.length === new Set(domains).size;
})());

console.log(`     ${recs.length} recommandation(s) générées`);
recs.slice(0, 3).forEach((r) => {
  console.log(`       [${r.priority}] ${r.domain}: ${r.action.slice(0, 50)}…`);
});

// ── Test 4: AuditReportGenerator ──────────────────────────────────────────────

section('4. AuditReportGenerator');

const auditReport = generateAuditReport('Piscine Privée Test', 'piscine', report, recs);

ok('meta.project_name correct', auditReport.meta.project_name === 'Piscine Privée Test');
ok('meta.project_type correct', auditReport.meta.project_type === 'piscine');
ok('meta.generated_at est un ISO string valide', !isNaN(Date.parse(auditReport.meta.generated_at)));
ok('executive_summary.risk_level défini', !!auditReport.executive_summary.risk_level);
ok('executive_summary.key_findings >= 2', auditReport.executive_summary.key_findings.length >= 2);
ok('coverage block cohérent', auditReport.coverage.total_rules === report.total_rules);
ok('recommendations présentes', auditReport.recommendations.length > 0);
ok('compliance_verdict défini', !!auditReport.compliance_verdict);

const riskLevel = auditReport.executive_summary.risk_level;
const pct = auditReport.executive_summary.coverage_pct;
const expectedRisk = pct < 50 ? 'critical' : pct < 70 ? 'high' : pct < 85 ? 'medium' : 'low';
ok(`risk_level (${riskLevel}) cohérent avec coverage_pct (${pct}%)`, riskLevel === expectedRisk);

console.log(`     compliance_verdict: ${auditReport.compliance_verdict}`);
console.log(`     risk_level: ${auditReport.executive_summary.risk_label} (${pct}%)`);
console.log(`     key_findings:`);
auditReport.executive_summary.key_findings.forEach((f) => console.log(`       • ${f}`));

// ── Test 5: Scénario "devis excellent" ────────────────────────────────────────

section('5. Scénario — Devis exhaustif (couverture élevée)');

const EXCELLENT_DEVIS: DevisLine[] = [
  { description: 'Structure béton armé ferraillage classe C30 étude géotechnique DTU 13.1', category: 'structure' },
  { description: 'Filtration débit 1 volume/heure pH 7.4 traitement eau quotidien', category: 'hydraulique' },
  { description: 'Installation électrique NF C 15-100 zone humide tableau TGBT', category: 'électrique' },
  { description: 'Barrière sécurité NF P90-306 alarme immersion NF P90-307 certifié', category: 'sécurité' },
  { description: 'Isolation thermique déperditions RT2020 calcul réglementaire', category: 'thermique' },
];

const reportExcellent = analyzeCoverage(EXCELLENT_DEVIS, PISCINE_RULES);
const recsExcellent = generateRecommendations(reportExcellent.top_gaps);
const auditExcellent = generateAuditReport('Devis Excellent', 'piscine', reportExcellent, recsExcellent);

ok(`Coverage élevée ≥ 50% — ${reportExcellent.coverage_pct}%`, reportExcellent.coverage_pct >= 50);
ok('Moins de gaps que le devis incomplet', reportExcellent.gaps < report.gaps);
ok(`Risk level moins sévère que ${riskLevel}`, (() => {
  const rank: Record<string, number> = { critical: 3, high: 2, medium: 1, low: 0 };
  return (rank[auditExcellent.executive_summary.risk_level] ?? 0) <= (rank[riskLevel] ?? 0);
})());
console.log(`     coverage: ${reportExcellent.coverage_pct}%, verdict: ${auditExcellent.compliance_verdict}`);

// ── Résultat ──────────────────────────────────────────────────────────────────

section('Résultat');
if (process.exitCode === 1) {
  console.log('\n❌ Des tests ont échoué — voir les ❌ ci-dessus');
} else {
  console.log('\n✅ Tous les tests passent — chaîne audit completeness fonctionnelle');
}
