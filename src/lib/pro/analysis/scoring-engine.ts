/**
 * Moteur de scoring B2B TORP
 * Types et interfaces pour le calcul du score sur 1000 points
 */

import type { ExtractedDevisData } from '../ocr/extract-devis';
import type { EnrichedCompanyData } from './enrich-company-data';

// ===== TYPES DE BASE =====

export type AxisCode = 'fiabilite' | 'assurances' | 'tarifs' | 'qualite' | 'conformite' | 'transparence';
export type CritereStatus = 'ok' | 'warning' | 'error' | 'missing';
export type AxisStatus = 'excellent' | 'bon' | 'moyen' | 'insuffisant' | 'critique';
export type Grade = 'A' | 'B' | 'C' | 'D' | 'E';
export type BlockingSeverity = 'critical' | 'major';

// ===== CONFIGURATION DU SCORING =====

export interface ScoringConfig {
  axes: Record<
    AxisCode,
    {
      maxPoints: number;
      weight: number;
      label: string;
    }
  >;
}

export const SCORING_CONFIG: ScoringConfig = {
  axes: {
    fiabilite: { maxPoints: 250, weight: 0.25, label: 'Fiabilité entreprise' },
    assurances: { maxPoints: 200, weight: 0.20, label: 'Assurances' },
    tarifs: { maxPoints: 200, weight: 0.20, label: 'Justesse tarifaire' },
    qualite: { maxPoints: 150, weight: 0.15, label: 'Qualité du devis' },
    conformite: { maxPoints: 120, weight: 0.12, label: 'Conformité légale' },
    transparence: { maxPoints: 80, weight: 0.08, label: 'Transparence' },
  },
};

// ===== RÉSULTATS =====

export interface ScoringResult {
  // Score global
  scoreTotal: number; // 0-1000
  grade: Grade;

  // Détail par axe
  axes: Record<AxisCode, AxisResult>;

  // Points bloquants (font chuter le score)
  pointsBloquants: BlockingPoint[];

  // Recommandations générées
  recommandations: Recommendation[];

  // Métadonnées
  analyzedAt: Date;
  version: number;
  confidence: number;
}

export interface AxisResult {
  code: AxisCode;
  label: string;
  maxPoints: number;
  pointsObtenus: number;
  pourcentage: number; // 0-100
  status: AxisStatus;
  criteres: CritereResult[];
}

export interface CritereResult {
  code: string;
  label: string;
  pointsMax: number;
  pointsObtenus: number;
  statut: CritereStatus;
  detail?: string;
}

export interface BlockingPoint {
  code: string;
  severity: BlockingSeverity;
  titre: string;
  description: string;
  impact: number; // Points perdus
  solution: string;
  axeConcerne: AxisCode;
}

export interface Recommendation {
  id: string;
  priorite: 'critical' | 'high' | 'medium' | 'low';
  categorie: string;
  titre: string;
  description: string;
  actionnable: boolean;
  action?: {
    type: 'add_document' | 'edit_devis' | 'complete_profile' | 'info';
    label: string;
    href?: string;
  };
  impactEstime: number; // Points potentiellement gagnés
  axeConcerne: AxisCode;
}

// ===== CRITÈRES D'ÉVALUATION =====

export type CritereEvaluator = (
  extractedData: ExtractedDevisData,
  enrichedData: EnrichedCompanyData
) => CritereEvaluationResult;

export interface CritereEvaluationResult {
  score: number;
  status: CritereStatus;
  detail?: string;
}

export interface CritereDefinition {
  code: string;
  label: string;
  points: number;
  bloquant?: boolean;
  evaluate: CritereEvaluator;
}

export interface AxisDefinition {
  code: AxisCode;
  label: string;
  maxPoints: number;
  criteres: CritereDefinition[];
}

// ===== FONCTIONS UTILITAIRES =====

/**
 * Calcule le grade en fonction du score
 */
export function calculateGrade(score: number): Grade {
  if (score >= 850) return 'A';
  if (score >= 700) return 'B';
  if (score >= 550) return 'C';
  if (score >= 400) return 'D';
  return 'E';
}

/**
 * Détermine le statut d'un axe en fonction du pourcentage obtenu
 */
export function getAxisStatus(pourcentage: number): AxisStatus {
  if (pourcentage >= 90) return 'excellent';
  if (pourcentage >= 75) return 'bon';
  if (pourcentage >= 60) return 'moyen';
  if (pourcentage >= 40) return 'insuffisant';
  return 'critique';
}

/**
 * Calcule le score d'un axe à partir des résultats de ses critères
 */
export function calculateAxisScore(criteres: CritereResult[]): {
  pointsObtenus: number;
  maxPoints: number;
  pourcentage: number;
} {
  const pointsObtenus = criteres.reduce((sum, c) => sum + c.pointsObtenus, 0);
  const maxPoints = criteres.reduce((sum, c) => sum + c.pointsMax, 0);
  const pourcentage = maxPoints > 0 ? Math.round((pointsObtenus / maxPoints) * 100) : 0;

  return { pointsObtenus, maxPoints, pourcentage };
}

/**
 * Identifie les points bloquants à partir des critères
 */
export function identifyBlockingPoints(
  axes: Record<AxisCode, AxisResult>
): BlockingPoint[] {
  const blockingPoints: BlockingPoint[] = [];

  Object.entries(axes).forEach(([axisCode, axisResult]) => {
    axisResult.criteres.forEach((critere) => {
      // Un critère est bloquant si son statut est 'error' ou 'missing' et qu'il a perdu beaucoup de points
      if ((critere.statut === 'error' || critere.statut === 'missing') && critere.pointsObtenus === 0) {
        const pointsPerdus = critere.pointsMax;

        // Seuil pour considérer comme bloquant
        if (pointsPerdus >= 40) {
          blockingPoints.push({
            code: `blocking_${critere.code}`,
            severity: 'critical',
            titre: `${critere.label} - Manquant`,
            description: critere.detail || `Ce critère n'est pas rempli et fait perdre ${pointsPerdus} points.`,
            impact: pointsPerdus,
            solution: getSolutionForCritere(critere.code),
            axeConcerne: axisCode as AxisCode,
          });
        } else if (pointsPerdus >= 20) {
          blockingPoints.push({
            code: `blocking_${critere.code}`,
            severity: 'major',
            titre: `${critere.label} - À améliorer`,
            description: critere.detail || `Ce critère fait perdre ${pointsPerdus} points.`,
            impact: pointsPerdus,
            solution: getSolutionForCritere(critere.code),
            axeConcerne: axisCode as AxisCode,
          });
        }
      }
    });
  });

  // Trier par impact décroissant
  return blockingPoints.sort((a, b) => b.impact - a.impact);
}

/**
 * Retourne une solution adaptée au critère manquant
 */
function getSolutionForCritere(critereCode: string): string {
  const solutions: Record<string, string> = {
    SIRET_VALIDE: 'Ajoutez votre numéro SIRET sur le devis et vérifiez-le sur votre profil TORP.',
    DECENNALE_MENTIONNEE: 'Mentionnez le numéro d\'assurance décennale sur votre devis (obligatoire).',
    DECENNALE_VALIDE: 'Mettez à jour votre attestation décennale dans votre profil TORP.',
    MENTIONS_OBLIGATOIRES: 'Ajoutez les mentions légales obligatoires : raison sociale, SIRET, adresse, forme juridique.',
    CGV: 'Ajoutez vos Conditions Générales de Vente au verso ou en annexe du devis.',
    DETAIL_LIGNES: 'Détaillez davantage les prestations ligne par ligne avec quantités et prix unitaires.',
  };

  return solutions[critereCode] || 'Consultez la section recommandations pour améliorer ce point.';
}
