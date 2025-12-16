/**
 * QualityAgent - Agent IA pour le suivi qualité Phase 3
 * Analyse les contrôles, génère des recommandations, prédit les risques qualité
 * SÉCURISÉ: Utilise les Edge Functions Supabase (pas de clé API côté client)
 */

import { supabase } from '@/lib/supabase';
import { secureAI } from '@/services/ai/secure-ai.service';

// Types
interface QualityScore {
  projetId: string;
  dateCalcul: Date;
  scoreGlobal: number;
  scoresParLot: LotQualityScore[];
  tendance: 'amelioration' | 'stable' | 'degradation';
  pointsForts: string[];
  pointsFaibles: string[];
}

interface LotQualityScore {
  lotId: string;
  lotNom: string;
  score: number;
  nombreControles: number;
  tauxConformite: number;
  nonConformitesOuvertes: number;
  delaiMoyenResolution: number;
}

interface QualityPrediction {
  risqueGlobal: 'faible' | 'modere' | 'eleve' | 'critique';
  probabiliteNonConformite: number;
  zonesRisque: Array<{
    zone: string;
    lot: string;
    risque: number;
    facteurs: string[];
  }>;
  recommandationsPreventives: string[];
}

interface QualityRecommendation {
  type: 'preventive' | 'corrective' | 'amelioration';
  priorite: 'haute' | 'moyenne' | 'basse';
  titre: string;
  description: string;
  impact: string;
  lotsConcernes: string[];
  actionsSuggerees: string[];
}

export class QualityAgent {
  private model: string = 'gpt-4o';

  /**
   * Calcule le score qualité global du projet
   */
  async calculateQualityScore(projetId: string): Promise<QualityScore> {
    // Récupérer les contrôles qualité
    const { data: controles } = await supabase
      .from('quality_controls')
      .select('*, control_visits(*)')
      .eq('projet_id', projetId);

    // Récupérer les lots
    const { data: lots } = await supabase
      .from('lots')
      .select('*')
      .eq('projet_id', projetId);

    const scoresParLot: LotQualityScore[] = [];
    let totalScore = 0;

    for (const lot of lots || []) {
      const controlesLot = (controles || []).filter(c => c.lot_id === lot.id);
      const conformes = controlesLot.filter(c => c.resultat === 'conforme').length;
      const total = controlesLot.length;
      const tauxConformite = total > 0 ? (conformes / total) * 100 : 100;

      const nonConformitesOuvertes = controlesLot.filter(
        c => c.resultat === 'non_conforme' && c.statut !== 'cloture'
      ).length;

      // Calcul du délai moyen de résolution
      const resolus = controlesLot.filter(
        c => c.resultat === 'non_conforme' && c.statut === 'cloture'
      );
      let delaiMoyenResolution = 0;
      if (resolus.length > 0) {
        const totalDelai = resolus.reduce((sum, c) => {
          const debut = new Date(c.created_at);
          const fin = new Date(c.date_cloture || c.updated_at);
          return sum + (fin.getTime() - debut.getTime()) / (1000 * 60 * 60 * 24);
        }, 0);
        delaiMoyenResolution = totalDelai / resolus.length;
      }

      // Score lot: pondération du taux de conformité et des NC ouvertes
      const scoreLot = Math.max(
        0,
        tauxConformite - nonConformitesOuvertes * 5 - Math.max(0, delaiMoyenResolution - 7) * 2
      );

      scoresParLot.push({
        lotId: lot.id,
        lotNom: lot.nom,
        score: Math.round(scoreLot),
        nombreControles: total,
        tauxConformite: Math.round(tauxConformite),
        nonConformitesOuvertes,
        delaiMoyenResolution: Math.round(delaiMoyenResolution),
      });

      totalScore += scoreLot;
    }

    const scoreGlobal = scoresParLot.length > 0 ? totalScore / scoresParLot.length : 100;

    // Déterminer la tendance (comparaison avec le dernier score)
    const tendance = await this.calculateTrend(projetId, scoreGlobal);

    // Identifier points forts et faibles
    const pointsForts = scoresParLot
      .filter(s => s.score >= 80)
      .map(s => `${s.lotNom}: ${s.score}% de conformité`);

    const pointsFaibles = scoresParLot
      .filter(s => s.score < 70)
      .map(s => `${s.lotNom}: ${s.nonConformitesOuvertes} NC ouvertes`);

    const result: QualityScore = {
      projetId,
      dateCalcul: new Date(),
      scoreGlobal: Math.round(scoreGlobal),
      scoresParLot,
      tendance,
      pointsForts,
      pointsFaibles,
    };

    // Sauvegarder le score
    await this.saveQualityScore(result);

    return result;
  }

  /**
   * Calcule la tendance qualité
   */
  private async calculateTrend(
    projetId: string,
    currentScore: number
  ): Promise<QualityScore['tendance']> {
    const { data: lastScores } = await supabase
      .from('quality_scores')
      .select('score_global')
      .eq('projet_id', projetId)
      .order('date_calcul', { ascending: false })
      .limit(1);

    if (!lastScores || lastScores.length === 0) return 'stable';

    const lastScore = lastScores[0].score_global;
    const diff = currentScore - lastScore;

    if (diff > 5) return 'amelioration';
    if (diff < -5) return 'degradation';
    return 'stable';
  }

  /**
   * Prédit les risques qualité futurs
   */
  async predictQualityRisks(projetId: string): Promise<QualityPrediction> {
    // Collecter les données historiques
    const { data: controles } = await supabase
      .from('quality_controls')
      .select('*, control_visits(*)')
      .eq('projet_id', projetId)
      .order('created_at', { ascending: false });

    const { data: lots } = await supabase.from('lots').select('*').eq('projet_id', projetId);

    // Analyser les patterns avec l'IA
    const prompt = `Tu es un expert en qualité BTP. Analyse ces données de contrôles qualité et prédit les risques futurs.

## Données des contrôles (${controles?.length || 0} contrôles)
${JSON.stringify(
  controles?.slice(0, 20).map(c => ({
    lot: c.lot_id,
    type: c.type_controle,
    resultat: c.resultat,
    zone: c.zone,
    date: c.created_at,
  })),
  null,
  2
)}

## Lots du projet
${JSON.stringify(
  lots?.map(l => ({ id: l.id, nom: l.nom })),
  null,
  2
)}

Analyse les patterns et retourne un JSON avec:
1. "risqueGlobal": "faible", "modere", "eleve", "critique"
2. "probabiliteNonConformite": 0-100 (probabilité d'avoir une NC dans les 2 prochaines semaines)
3. "zonesRisque": liste des zones à risque avec {zone, lot, risque (0-100), facteurs[]}
4. "recommandationsPreventives": liste de 3-5 recommandations préventives

Réponds uniquement en JSON valide.`;

    try {
      return await secureAI.completeJSON<QualityPrediction>({
        messages: [{ role: 'user', content: prompt }],
        model: this.model,
        provider: 'openai',
        temperature: 0.3,
      });
    } catch (error) {
      console.error('Quality prediction error:', error);
      return {
        risqueGlobal: 'modere',
        probabiliteNonConformite: 30,
        zonesRisque: [],
        recommandationsPreventives: ['Maintenir le rythme de contrôles actuel'],
      };
    }
  }

  /**
   * Génère des recommandations qualité personnalisées
   */
  async generateRecommendations(projetId: string): Promise<QualityRecommendation[]> {
    const qualityScore = await this.calculateQualityScore(projetId);
    const predictions = await this.predictQualityRisks(projetId);

    const recommendations: QualityRecommendation[] = [];

    // Recommandations basées sur le score
    if (qualityScore.scoreGlobal < 70) {
      recommendations.push({
        type: 'corrective',
        priorite: 'haute',
        titre: 'Plan d\'action qualité urgent',
        description: `Le score qualité global (${qualityScore.scoreGlobal}%) nécessite des mesures correctives immédiates.`,
        impact: 'Réduction du risque de malfaçons et de reprises coûteuses',
        lotsConcernes: qualityScore.scoresParLot.filter(s => s.score < 70).map(s => s.lotId),
        actionsSuggerees: [
          'Organiser une réunion qualité avec tous les intervenants',
          'Renforcer les contrôles sur les lots critiques',
          'Mettre en place un suivi quotidien des NC',
        ],
      });
    }

    // Recommandations basées sur les prédictions
    for (const zone of predictions.zonesRisque.filter(z => z.risque > 60)) {
      recommendations.push({
        type: 'preventive',
        priorite: zone.risque > 80 ? 'haute' : 'moyenne',
        titre: `Vigilance renforcée sur ${zone.zone}`,
        description: `Zone identifiée à risque (${zone.risque}%) basé sur l'historique des contrôles.`,
        impact: 'Prévention des non-conformités potentielles',
        lotsConcernes: [zone.lot],
        actionsSuggerees: zone.facteurs.map(f => `Contrôler: ${f}`),
      });
    }

    // Recommandations d'amélioration continue
    if (qualityScore.tendance === 'amelioration') {
      recommendations.push({
        type: 'amelioration',
        priorite: 'basse',
        titre: 'Capitalisation des bonnes pratiques',
        description: 'La tendance qualité est positive. Opportunité de documenter les bonnes pratiques.',
        impact: 'Pérennisation des améliorations et transfert de savoir-faire',
        lotsConcernes: qualityScore.scoresParLot.filter(s => s.score >= 80).map(s => s.lotId),
        actionsSuggerees: [
          'Documenter les processus qui fonctionnent',
          'Partager les retours d\'expérience positifs',
          'Mettre à jour les procédures de contrôle',
        ],
      });
    }

    return recommendations;
  }

  /**
   * Sauvegarde le score qualité
   */
  private async saveQualityScore(score: QualityScore): Promise<void> {
    await supabase.from('quality_scores').insert({
      projet_id: score.projetId,
      date_calcul: score.dateCalcul.toISOString(),
      score_global: score.scoreGlobal,
      scores_par_lot: score.scoresParLot,
      tendance: score.tendance,
      points_forts: score.pointsForts,
      points_faibles: score.pointsFaibles,
    });
  }
}

export const qualityAgent = new QualityAgent();
