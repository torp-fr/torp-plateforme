/**
 * TORP Phase0 → Phase1 Connection Service
 * Service principal de connexion entre Phase0 (cadrage) et Phase1 (analyse devis)
 */

import type { Phase0Project, WorkLot, LotCategory } from '@/types/phase0';
import type { TorpAnalysisResult } from '@/types/torp';
import type { ExtractedDevisData } from '@/services/ai/torp-analyzer.service';

// =============================================================================
// TYPES
// =============================================================================

/**
 * Contexte Phase0 simplifié pour l'analyse de devis
 */
export interface Phase0AnalysisContext {
  // Identifiants
  projectId: string;
  projectReference?: string;

  // Budget défini en Phase0
  budget: {
    totalEnvelope?: number;
    minBudget?: number;
    maxBudget?: number;
    contingencyPercent?: number;
  };

  // Lots de travaux attendus
  expectedLots: Array<{
    category: LotCategory;
    type: string;
    label: string;
    estimatedBudget?: { min: number; max: number };
    priority: 'required' | 'optional';
  }>;

  // Contraintes identifiées
  constraints: {
    // Temporelles
    startDate?: string;
    endDate?: string;
    maxDuration?: number; // en jours
    blackoutPeriods?: Array<{ start: string; end: string; reason: string }>;

    // Réglementaires
    heritageProtection?: boolean;
    permitRequired?: boolean;
    rgeRequired?: boolean;

    // Techniques
    accessRestrictions?: string[];
    specificRequirements?: string[];
  };

  // Profil MOA pour adapter les recommandations
  ownerProfile: {
    type: 'B2C' | 'B2B' | 'B2G';
    expertiseLevel: 'novice' | 'intermediate' | 'expert';
    priorityFactors: string[];
    communicationStyle: 'simple' | 'detailed' | 'technical';
  };

  // Contexte géographique
  location: {
    region?: string;
    department?: string;
    city?: string;
    postalCode?: string;
  };

  // Type de travaux principal
  workType: {
    main: string;
    categories: string[];
  };
}

/**
 * Analyse enrichie avec le contexte Phase0
 */
export interface Phase0EnrichedAnalysis {
  // Analyse standard TORP
  baseAnalysis: TorpAnalysisResult;

  // Comparaisons avec Phase0
  phase0Comparison: {
    // Budget
    budgetComparison: {
      phase0Estimate: number;
      devisAmount: number;
      difference: number;
      differencePercent: number;
      status: 'under' | 'within' | 'over' | 'significantly_over';
      recommendation: string;
    };

    // Lots
    lotsComparison: {
      expectedLots: number;
      foundInDevis: number;
      missingLots: string[];
      extraLots: string[];
      coveragePercent: number;
    };

    // Délais
    delaysComparison?: {
      phase0Expected: number; // jours
      devisProposed: number;
      difference: number;
      isRealistic: boolean;
      conflicts: string[];
    };

    // Conformité contraintes
    constraintsCheck: {
      total: number;
      satisfied: number;
      violated: string[];
      warnings: string[];
    };
  };

  // Recommandations contextualisées
  contextualRecommendations: Array<{
    type: 'negotiation' | 'clarification' | 'warning' | 'validation' | 'alternative';
    priority: 'high' | 'medium' | 'low';
    title: string;
    description: string;
    action?: string;
    impact?: string;
  }>;

  // Score ajusté avec contexte
  contextualScore: {
    baseScore: number;
    adjustments: Array<{
      reason: string;
      points: number;
    }>;
    finalScore: number;
    contextConfidence: 'high' | 'medium' | 'low';
  };
}

// =============================================================================
// SERVICE
// =============================================================================

export class Phase0Phase1ConnectionService {
  /**
   * Enrichit une analyse TORP avec le contexte Phase0
   */
  static enrichAnalysisWithPhase0Context(
    baseAnalysis: TorpAnalysisResult,
    extractedData: ExtractedDevisData,
    phase0Context: Phase0AnalysisContext
  ): Phase0EnrichedAnalysis {
    // Comparer le budget
    const budgetComparison = this.compareBudget(
      extractedData.devis.montantTotal,
      phase0Context.budget
    );

    // Comparer les lots
    const lotsComparison = this.compareLots(
      extractedData.travaux.postes,
      phase0Context.expectedLots
    );

    // Comparer les délais
    const delaysComparison = this.compareDelays(
      extractedData.delais,
      phase0Context.constraints
    );

    // Vérifier les contraintes
    const constraintsCheck = this.checkConstraints(
      extractedData,
      baseAnalysis,
      phase0Context.constraints
    );

    // Générer les recommandations contextualisées
    const contextualRecommendations = this.generateContextualRecommendations(
      budgetComparison,
      lotsComparison,
      delaysComparison,
      constraintsCheck,
      phase0Context.ownerProfile
    );

    // Calculer le score ajusté
    const contextualScore = this.calculateContextualScore(
      baseAnalysis.scoreGlobal,
      budgetComparison,
      lotsComparison,
      constraintsCheck
    );

    return {
      baseAnalysis,
      phase0Comparison: {
        budgetComparison,
        lotsComparison,
        delaysComparison,
        constraintsCheck,
      },
      contextualRecommendations,
      contextualScore,
    };
  }

  /**
   * Compare le budget du devis avec l'estimation Phase0
   */
  private static compareBudget(
    devisAmount: number,
    phase0Budget: Phase0AnalysisContext['budget']
  ): Phase0EnrichedAnalysis['phase0Comparison']['budgetComparison'] {
    const phase0Estimate = phase0Budget.totalEnvelope || 0;
    const maxBudget = phase0Budget.maxBudget || phase0Estimate * 1.1;
    const minBudget = phase0Budget.minBudget || phase0Estimate * 0.9;

    const difference = devisAmount - phase0Estimate;
    const differencePercent = phase0Estimate > 0
      ? Math.round((difference / phase0Estimate) * 100)
      : 0;

    let status: 'under' | 'within' | 'over' | 'significantly_over';
    let recommendation: string;

    if (devisAmount < minBudget) {
      status = 'under';
      recommendation = `Le devis est ${Math.abs(differencePercent)}% en dessous de votre budget. Vérifiez que tous les postes sont bien inclus et que la qualité correspond à vos attentes.`;
    } else if (devisAmount <= maxBudget) {
      status = 'within';
      recommendation = `Le devis est dans votre enveloppe budgétaire. Bonne cohérence avec votre projet.`;
    } else if (devisAmount <= maxBudget * 1.2) {
      status = 'over';
      recommendation = `Le devis dépasse votre budget de ${differencePercent}%. Négociation possible sur certains postes ou révision du périmètre.`;
    } else {
      status = 'significantly_over';
      recommendation = `Le devis dépasse significativement votre budget (+${differencePercent}%). Demandez des variantes ou reconsidérez le périmètre des travaux.`;
    }

    return {
      phase0Estimate,
      devisAmount,
      difference,
      differencePercent,
      status,
      recommendation,
    };
  }

  /**
   * Compare les lots du devis avec ceux attendus en Phase0
   */
  private static compareLots(
    devisPostes: ExtractedDevisData['travaux']['postes'],
    expectedLots: Phase0AnalysisContext['expectedLots']
  ): Phase0EnrichedAnalysis['phase0Comparison']['lotsComparison'] {
    const expectedLabels = expectedLots.map(l => l.label.toLowerCase());
    const foundLabels: string[] = [];
    const missingLots: string[] = [];
    const extraLots: string[] = [];

    // Analyser les postes du devis
    for (const poste of devisPostes) {
      const posteDesc = poste.designation.toLowerCase();
      let matched = false;

      for (const expected of expectedLots) {
        const expectedLower = expected.label.toLowerCase();
        const keywords = expectedLower.split(/\s+/);

        // Vérifier si le poste correspond à un lot attendu
        if (keywords.some(kw => posteDesc.includes(kw) && kw.length > 3)) {
          foundLabels.push(expected.label);
          matched = true;
          break;
        }
      }

      if (!matched && poste.total > 500) {
        // Poste significatif non prévu
        extraLots.push(poste.designation);
      }
    }

    // Identifier les lots manquants (surtout les obligatoires)
    for (const expected of expectedLots) {
      if (expected.priority === 'required' && !foundLabels.includes(expected.label)) {
        missingLots.push(expected.label);
      }
    }

    const uniqueFound = [...new Set(foundLabels)];
    const coveragePercent = expectedLots.length > 0
      ? Math.round((uniqueFound.length / expectedLots.length) * 100)
      : 100;

    return {
      expectedLots: expectedLots.length,
      foundInDevis: uniqueFound.length,
      missingLots,
      extraLots: extraLots.slice(0, 5), // Limiter à 5
      coveragePercent,
    };
  }

  /**
   * Compare les délais proposés avec les contraintes Phase0
   */
  private static compareDelays(
    devisDelais: ExtractedDevisData['delais'],
    constraints: Phase0AnalysisContext['constraints']
  ): Phase0EnrichedAnalysis['phase0Comparison']['delaysComparison'] | undefined {
    if (!devisDelais.duree && !constraints.maxDuration) {
      return undefined;
    }

    const phase0Expected = constraints.maxDuration || 90; // 3 mois par défaut
    const devisProposed = devisDelais.duree || 0;
    const difference = devisProposed - phase0Expected;

    const conflicts: string[] = [];

    // Vérifier les périodes d'exclusion
    if (devisDelais.debut && constraints.blackoutPeriods) {
      const startDate = new Date(devisDelais.debut);
      for (const blackout of constraints.blackoutPeriods) {
        const blackoutStart = new Date(blackout.start);
        const blackoutEnd = new Date(blackout.end);
        if (startDate >= blackoutStart && startDate <= blackoutEnd) {
          conflicts.push(`Conflit avec période d'exclusion: ${blackout.reason}`);
        }
      }
    }

    // Vérifier la date de fin souhaitée
    if (constraints.endDate && devisDelais.fin) {
      const constraintEnd = new Date(constraints.endDate);
      const devisEnd = new Date(devisDelais.fin);
      if (devisEnd > constraintEnd) {
        conflicts.push(`Fin prévue après la date souhaitée (${constraints.endDate})`);
      }
    }

    return {
      phase0Expected,
      devisProposed,
      difference,
      isRealistic: Math.abs(difference) <= phase0Expected * 0.3, // +/- 30%
      conflicts,
    };
  }

  /**
   * Vérifie les contraintes Phase0 par rapport au devis
   */
  private static checkConstraints(
    extractedData: ExtractedDevisData,
    baseAnalysis: TorpAnalysisResult,
    constraints: Phase0AnalysisContext['constraints']
  ): Phase0EnrichedAnalysis['phase0Comparison']['constraintsCheck'] {
    const violated: string[] = [];
    const warnings: string[] = [];
    let satisfied = 0;
    let total = 0;

    // Vérifier RGE si requis
    if (constraints.rgeRequired) {
      total++;
      const hasRGE = extractedData.entreprise.certifications?.some(c =>
        c.toLowerCase().includes('rge') || c.toLowerCase().includes('qualibat')
      );
      if (hasRGE) {
        satisfied++;
      } else {
        violated.push('Certification RGE requise mais non trouvée dans le devis');
      }
    }

    // Vérifier les assurances
    if (extractedData.entreprise.assurances) {
      total++;
      if (extractedData.entreprise.assurances.decennale) {
        satisfied++;
      } else {
        warnings.push('Assurance décennale non mentionnée explicitement');
      }
    }

    // Vérifier les restrictions d'accès
    if (constraints.accessRestrictions?.length) {
      total++;
      // On suppose satisfait sauf indication contraire
      satisfied++;
      warnings.push(`Vérifiez que l'entreprise peut gérer: ${constraints.accessRestrictions.join(', ')}`);
    }

    // Vérifier patrimoine protégé
    if (constraints.heritageProtection) {
      total++;
      const mentionsHeritage = baseAnalysis.scoreConformite?.defauts?.some(d =>
        d.toLowerCase().includes('patrimoine') || d.toLowerCase().includes('abf')
      );
      if (!mentionsHeritage) {
        warnings.push('Bâtiment protégé: vérifiez les qualifications spécifiques de l\'entreprise');
      }
      satisfied++;
    }

    return {
      total: Math.max(total, 1),
      satisfied,
      violated,
      warnings,
    };
  }

  /**
   * Génère des recommandations contextualisées
   */
  private static generateContextualRecommendations(
    budgetComparison: Phase0EnrichedAnalysis['phase0Comparison']['budgetComparison'],
    lotsComparison: Phase0EnrichedAnalysis['phase0Comparison']['lotsComparison'],
    delaysComparison: Phase0EnrichedAnalysis['phase0Comparison']['delaysComparison'] | undefined,
    constraintsCheck: Phase0EnrichedAnalysis['phase0Comparison']['constraintsCheck'],
    ownerProfile: Phase0AnalysisContext['ownerProfile']
  ): Phase0EnrichedAnalysis['contextualRecommendations'] {
    const recommendations: Phase0EnrichedAnalysis['contextualRecommendations'] = [];
    const isSimpleMode = ownerProfile.communicationStyle === 'simple';

    // Recommandations budget
    if (budgetComparison.status === 'significantly_over') {
      recommendations.push({
        type: 'negotiation',
        priority: 'high',
        title: isSimpleMode ? 'Budget dépassé' : 'Dépassement budgétaire significatif',
        description: budgetComparison.recommendation,
        action: 'Demander des variantes économiques ou revoir le périmètre',
        impact: `Économie potentielle: ${Math.abs(budgetComparison.difference).toLocaleString('fr-FR')}€`,
      });
    } else if (budgetComparison.status === 'under') {
      recommendations.push({
        type: 'warning',
        priority: 'medium',
        title: isSimpleMode ? 'Prix bas' : 'Devis inférieur aux estimations',
        description: budgetComparison.recommendation,
        action: 'Vérifier la complétude et demander le détail des prestations',
      });
    } else if (budgetComparison.status === 'within') {
      recommendations.push({
        type: 'validation',
        priority: 'low',
        title: 'Budget cohérent',
        description: budgetComparison.recommendation,
      });
    }

    // Recommandations lots manquants
    if (lotsComparison.missingLots.length > 0) {
      recommendations.push({
        type: 'clarification',
        priority: 'high',
        title: isSimpleMode ? 'Travaux manquants' : 'Lots attendus non couverts',
        description: `${lotsComparison.missingLots.length} lot(s) prévu(s) dans votre projet ne sont pas dans ce devis`,
        action: `Demander un complément pour: ${lotsComparison.missingLots.slice(0, 3).join(', ')}`,
      });
    }

    // Recommandations lots supplémentaires
    if (lotsComparison.extraLots.length > 0) {
      recommendations.push({
        type: 'clarification',
        priority: 'medium',
        title: 'Travaux supplémentaires',
        description: `Ce devis inclut des postes non prévus initialement`,
        action: `Vérifier la pertinence de: ${lotsComparison.extraLots.slice(0, 2).join(', ')}`,
      });
    }

    // Recommandations délais
    if (delaysComparison) {
      if (delaysComparison.conflicts.length > 0) {
        recommendations.push({
          type: 'warning',
          priority: 'high',
          title: 'Conflits de planning',
          description: delaysComparison.conflicts.join('. '),
          action: 'Négocier les dates de début et fin de chantier',
        });
      } else if (!delaysComparison.isRealistic) {
        recommendations.push({
          type: 'clarification',
          priority: 'medium',
          title: 'Délais à vérifier',
          description: `Durée proposée (${delaysComparison.devisProposed}j) différente de votre estimation (${delaysComparison.phase0Expected}j)`,
          action: 'Demander un planning détaillé',
        });
      }
    }

    // Recommandations contraintes
    if (constraintsCheck.violated.length > 0) {
      recommendations.push({
        type: 'warning',
        priority: 'high',
        title: 'Contraintes non respectées',
        description: constraintsCheck.violated.join('. '),
        action: 'Demander des garanties écrites ou chercher un autre prestataire',
      });
    }

    if (constraintsCheck.warnings.length > 0) {
      recommendations.push({
        type: 'clarification',
        priority: 'low',
        title: 'Points à vérifier',
        description: constraintsCheck.warnings.join('. '),
      });
    }

    // Trier par priorité
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    return recommendations.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);
  }

  /**
   * Calcule un score ajusté avec le contexte Phase0
   */
  private static calculateContextualScore(
    baseScore: number,
    budgetComparison: Phase0EnrichedAnalysis['phase0Comparison']['budgetComparison'],
    lotsComparison: Phase0EnrichedAnalysis['phase0Comparison']['lotsComparison'],
    constraintsCheck: Phase0EnrichedAnalysis['phase0Comparison']['constraintsCheck']
  ): Phase0EnrichedAnalysis['contextualScore'] {
    const adjustments: Array<{ reason: string; points: number }> = [];
    let totalAdjustment = 0;

    // Ajustement budget
    if (budgetComparison.status === 'within') {
      adjustments.push({ reason: 'Budget cohérent avec le projet', points: 5 });
      totalAdjustment += 5;
    } else if (budgetComparison.status === 'significantly_over') {
      adjustments.push({ reason: 'Dépassement budgétaire important', points: -10 });
      totalAdjustment -= 10;
    } else if (budgetComparison.status === 'under') {
      adjustments.push({ reason: 'Prix anormalement bas', points: -5 });
      totalAdjustment -= 5;
    }

    // Ajustement couverture lots
    if (lotsComparison.coveragePercent >= 90) {
      adjustments.push({ reason: 'Bonne couverture des travaux prévus', points: 5 });
      totalAdjustment += 5;
    } else if (lotsComparison.coveragePercent < 50) {
      adjustments.push({ reason: 'Couverture partielle des travaux', points: -8 });
      totalAdjustment -= 8;
    }

    // Ajustement contraintes
    if (constraintsCheck.violated.length > 0) {
      const penalty = Math.min(constraintsCheck.violated.length * 5, 15);
      adjustments.push({ reason: 'Contraintes non respectées', points: -penalty });
      totalAdjustment -= penalty;
    }

    const finalScore = Math.max(0, Math.min(100, baseScore + totalAdjustment));

    // Calculer la confiance
    let contextConfidence: 'high' | 'medium' | 'low' = 'medium';
    if (lotsComparison.coveragePercent >= 80 && constraintsCheck.total >= 2) {
      contextConfidence = 'high';
    } else if (lotsComparison.coveragePercent < 30) {
      contextConfidence = 'low';
    }

    return {
      baseScore,
      adjustments,
      finalScore,
      contextConfidence,
    };
  }
}
