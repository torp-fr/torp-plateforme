/**
 * RecommendationGenerator
 * Transforme les gaps de couverture en recommandations actionnables.
 * Regroupe par domaine pour éviter la répétition.
 */

import type { CoverageGap } from './coverageAnalyzer.service';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface Recommendation {
  priority: 'critical' | 'high' | 'medium' | 'low';
  domain: string;
  action: string;
  rationale: string;
  reference: string;  // catégorie source (DTU, EUROCODE, etc.)
  effort: 'quick' | 'medium' | 'complex';
  gap_count: number;  // nombre de gaps dans ce groupe
}

// ── Templates par domaine ─────────────────────────────────────────────────────

const DOMAIN_ACTIONS: Record<string, { action: string; reference: string }> = {
  'sécurité': {
    action: 'Mentionner explicitement les dispositifs de sécurité requis (barrières, protections, signalétique)',
    reference: 'NF P90-307 / Code de la construction',
  },
  'électrique': {
    action: 'Préciser la conformité NF C 15-100 et prévoir le certificat CONSUEL',
    reference: 'DTU / NF C 15-100',
  },
  'hydraulique': {
    action: 'Détailler le système de drainage, filtration et évacuation des eaux',
    reference: 'DTU 60.1 / DTU 60.11',
  },
  'structure': {
    action: 'Spécifier les caractéristiques béton armé (classe, ferraillage, étude géotechnique)',
    reference: 'DTU 13.1 / Eurocode 2',
  },
  'thermique': {
    action: 'Justifier la performance thermique de l\'installation (RT/RE 2020)',
    reference: 'DTU / RE 2020',
  },
  'incendie': {
    action: 'Prévoir le plan de protection incendie et les équipements réglementaires',
    reference: 'Code de la construction / ERP',
  },
  'accessibilité': {
    action: 'Vérifier la conformité PMR (largeurs, rampes, signalétique)',
    reference: 'Code de la construction / Arrêté du 20/04/2017',
  },
  'acoustique': {
    action: 'Intégrer les exigences d\'isolation acoustique (NRA) dans les spécifications',
    reference: 'DTU 68 / NRA',
  },
  'sismique': {
    action: 'Confirmer la prise en compte des règles parasismiques selon la zone du projet',
    reference: 'Eurocode 8 / PS-MI',
  },
};

const DEFAULT_ACTION = {
  action: 'Vérifier la conformité aux règles applicables pour ce domaine',
  reference: 'DTU / Code de la construction',
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function toPriority(severity: 'high' | 'medium' | 'low', gapCount: number): Recommendation['priority'] {
  if (severity === 'high') return 'critical';
  if (severity === 'medium' && gapCount >= 3) return 'high';
  if (severity === 'medium') return 'medium';
  return 'low';
}

function toEffort(severity: 'high' | 'medium' | 'low'): Recommendation['effort'] {
  if (severity === 'high') return 'medium';
  if (severity === 'medium') return 'quick';
  return 'quick';
}

// ── API publique ───────────────────────────────────────────────────────────────

/**
 * Génère des recommandations à partir des gaps identifiés par CoverageAnalyzer.
 * Regroupe par (domaine × sévérité) pour un output actionable et non répétitif.
 *
 * @param gaps     - Liste des gaps depuis CoverageReport.top_gaps
 * @param maxRecs  - Nombre max de recommandations (défaut: 10)
 */
export function generateRecommendations(
  gaps: CoverageGap[],
  maxRecs = 10,
): Recommendation[] {
  if (gaps.length === 0) return [];

  // Grouper par (domaine, sévérité)
  const groups = new Map<string, { severity: 'high' | 'medium' | 'low'; gaps: CoverageGap[] }>();

  for (const gap of gaps) {
    const key = `${gap.rule.domain}::${gap.severity}`;
    if (!groups.has(key)) {
      groups.set(key, { severity: gap.severity, gaps: [] });
    }
    groups.get(key)!.gaps.push(gap);
  }

  const recommendations: Recommendation[] = [];

  for (const [key, group] of groups) {
    const domain = key.split('::')[0];
    const { action, reference } = DOMAIN_ACTIONS[domain] ?? DEFAULT_ACTION;
    const gapCount = group.gaps.length;

    // Rationale : liste les 2 premières règles non couvertes
    const exampleRules = group.gaps
      .slice(0, 2)
      .map((g) => {
        const desc = g.rule.description ?? g.rule.property_key ?? '(règle sans description)';
        return `"${desc.slice(0, 60)}${desc.length > 60 ? '…' : ''}"`;
      })
      .join(' ; ');

    recommendations.push({
      priority: toPriority(group.severity, gapCount),
      domain,
      action,
      rationale: `${gapCount} règle(s) non couverte(s) dans ce domaine. Ex: ${exampleRules}`,
      reference,
      effort: toEffort(group.severity),
      gap_count: gapCount,
    });
  }

  // Trier par priorité
  const priorityRank: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
  recommendations.sort((a, b) => priorityRank[a.priority] - priorityRank[b.priority]);

  return recommendations.slice(0, maxRecs);
}
