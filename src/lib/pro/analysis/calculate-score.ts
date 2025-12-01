/**
 * Moteur de calcul du score TORP B2B
 * Évalue chaque critère et génère le score final
 */

import type { ExtractedDevisData } from '../ocr/extract-devis';
import type { EnrichedCompanyData } from './enrich-company-data';
import type {
  ScoringResult,
  AxisResult,
  CritereResult,
  AxisCode,
} from './scoring-engine';
import {
  calculateGrade,
  getAxisStatus,
  calculateAxisScore,
  identifyBlockingPoints,
} from './scoring-engine';
import { ALL_AXES } from './scoring-criteria';

/**
 * Calcule le score complet d'un devis
 */
export function calculateScore(
  extractedData: ExtractedDevisData,
  enrichedData: EnrichedCompanyData
): Omit<ScoringResult, 'recommandations' | 'pointsBloquants'> {
  const axes: Record<AxisCode, AxisResult> = {} as any;

  // Évaluer chaque axe
  ALL_AXES.forEach((axisDefinition) => {
    // Évaluer tous les critères de l'axe
    const criteres: CritereResult[] = axisDefinition.criteres.map((critereDef) => {
      // Appeler la fonction d'évaluation du critère
      const evaluation = critereDef.evaluate(extractedData, enrichedData);

      return {
        code: critereDef.code,
        label: critereDef.label,
        pointsMax: critereDef.points,
        pointsObtenus: evaluation.score,
        statut: evaluation.status,
        detail: evaluation.detail,
      };
    });

    // Calculer le score de l'axe
    const { pointsObtenus, maxPoints, pourcentage } = calculateAxisScore(criteres);
    const status = getAxisStatus(pourcentage);

    axes[axisDefinition.code] = {
      code: axisDefinition.code,
      label: axisDefinition.label,
      maxPoints,
      pointsObtenus,
      pourcentage,
      status,
      criteres,
    };
  });

  // Calculer le score total
  const scoreTotal = Object.values(axes).reduce((sum, axis) => sum + axis.pointsObtenus, 0);

  // Calculer le grade
  const grade = calculateGrade(scoreTotal);

  // Identifier les points bloquants
  const pointsBloquants = identifyBlockingPoints(axes);

  return {
    scoreTotal: Math.round(scoreTotal),
    grade,
    axes,
    pointsBloquants,
    analyzedAt: new Date(),
    version: 1,
    confidence: extractedData.confidence,
  };
}
