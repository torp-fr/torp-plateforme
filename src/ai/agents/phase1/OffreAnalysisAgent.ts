/**
 * OffreAnalysisAgent - Agent IA Phase 1
 * Analyse et scoring des offres des entreprises
 * Compare les offres, détecte les anomalies, formule des recommandations
 */

import { secureAI } from '@/services/ai/secure-ai.service';

// =============================================================================
// TYPES
// =============================================================================

export interface OffreInput {
  id: string;
  entreprise: {
    nom: string;
    siret?: string;
    anciennete?: number;
    rge?: boolean;
    qualibat?: boolean;
    avis_clients?: number;
    chiffre_affaires?: number;
    effectif?: number;
  };
  lot_code: string;
  lot_nom?: string;
  montant_ht: number;
  montant_ttc?: number;
  delai_jours: number;
  memoire_technique?: string;
  documents?: string[];
}

export interface OffreAnalysis {
  offre_id: string;
  score_global: number;
  scores_details: {
    prix: number;
    technique: number;
    delai: number;
    fiabilite: number;
    garanties: number;
  };
  points_forts: string[];
  points_faibles: string[];
  alertes: string[];
  recommandation: 'retenir' | 'negocier' | 'rejeter';
  justification: string;
  comparaison_marche: {
    position: 'inferieur' | 'dans_la_moyenne' | 'superieur';
    ecart_pourcentage: number;
  };
  suggestions_negociation?: string[];
}

export interface ComparaisonResult {
  classement: {
    offre_id: string;
    entreprise_nom: string;
    rang: number;
    score: number;
    montant_ht: number;
  }[];
  meilleure_offre: string;
  analyse_comparative: string;
  synthese: string;
  recommandation_finale: string;
}

export interface AnalyseDevisResult {
  postes_identifies: {
    designation: string;
    quantite?: number;
    unite?: string;
    prix_unitaire?: number;
    prix_total: number;
    commentaire?: string;
  }[];
  anomalies: {
    type: 'prix_anormal' | 'quantite_suspecte' | 'poste_manquant' | 'doublon' | 'incoherence';
    description: string;
    impact_estime?: number;
  }[];
  total_analyse: number;
  ecart_annonce: number;
  taux_confiance: number;
}

// =============================================================================
// AGENT
// =============================================================================

export class OffreAnalysisAgent {
  private readonly prixReference: Record<string, { min: number; moyen: number; max: number }> = {
    DEMO: { min: 30, moyen: 50, max: 80 },
    GO: { min: 800, moyen: 1200, max: 2000 },
    ELEC: { min: 80, moyen: 120, max: 180 },
    PLOMB: { min: 100, moyen: 150, max: 220 },
    CVC: { min: 150, moyen: 250, max: 400 },
    ISOL: { min: 40, moyen: 70, max: 120 },
    PLAT: { min: 35, moyen: 55, max: 85 },
    PEINT: { min: 20, moyen: 35, max: 55 },
    MENU_EXT: { min: 400, moyen: 700, max: 1200 },
    MENU_INT: { min: 200, moyen: 350, max: 600 },
    CARRE: { min: 50, moyen: 80, max: 130 },
    SOLS: { min: 30, moyen: 55, max: 90 },
  };

  /**
   * Analyse une offre individuelle
   */
  async analyzeOffre(
    offre: OffreInput,
    contexte?: {
      prix_reference?: number;
      autres_offres?: OffreInput[];
      budget_max?: number;
    }
  ): Promise<OffreAnalysis> {
    // Calcul du score prix
    let scorePrix = 70;
    let ecartPrix = 0;
    let position: 'inferieur' | 'dans_la_moyenne' | 'superieur' = 'dans_la_moyenne';

    if (contexte?.prix_reference) {
      ecartPrix = ((offre.montant_ht - contexte.prix_reference) / contexte.prix_reference) * 100;
    } else if (contexte?.autres_offres?.length) {
      const moyenne = contexte.autres_offres.reduce((s, o) => s + o.montant_ht, 0) / contexte.autres_offres.length;
      ecartPrix = ((offre.montant_ht - moyenne) / moyenne) * 100;
    }

    if (ecartPrix <= -15) {
      scorePrix = 95;
      position = 'inferieur';
    } else if (ecartPrix <= -5) {
      scorePrix = 85;
      position = 'inferieur';
    } else if (ecartPrix <= 5) {
      scorePrix = 75;
    } else if (ecartPrix <= 15) {
      scorePrix = 60;
      position = 'superieur';
    } else if (ecartPrix <= 25) {
      scorePrix = 45;
      position = 'superieur';
    } else {
      scorePrix = 30;
      position = 'superieur';
    }

    // Score fiabilité entreprise
    let scoreFiabilite = 50;
    if (offre.entreprise.rge) scoreFiabilite += 15;
    if (offre.entreprise.qualibat) scoreFiabilite += 12;
    if (offre.entreprise.anciennete) {
      if (offre.entreprise.anciennete > 10) scoreFiabilite += 10;
      else if (offre.entreprise.anciennete > 5) scoreFiabilite += 7;
      else if (offre.entreprise.anciennete > 2) scoreFiabilite += 3;
    }
    if (offre.entreprise.avis_clients) {
      if (offre.entreprise.avis_clients >= 4.5) scoreFiabilite += 8;
      else if (offre.entreprise.avis_clients >= 4) scoreFiabilite += 5;
      else if (offre.entreprise.avis_clients >= 3.5) scoreFiabilite += 2;
    }
    scoreFiabilite = Math.min(100, scoreFiabilite);

    // Score délai
    let scoreDelai = 70;
    if (offre.delai_jours <= 15) scoreDelai = 95;
    else if (offre.delai_jours <= 30) scoreDelai = 85;
    else if (offre.delai_jours <= 45) scoreDelai = 75;
    else if (offre.delai_jours <= 60) scoreDelai = 65;
    else if (offre.delai_jours <= 90) scoreDelai = 50;
    else scoreDelai = 35;

    // Score technique (basé sur mémoire technique si disponible)
    let scoreTechnique = 70;
    if (offre.memoire_technique) {
      // Analyse IA du mémoire technique
      try {
        const analyseMemoire = await this.analyzeMemoireTechnique(offre.memoire_technique);
        scoreTechnique = analyseMemoire.score;
      } catch {
        scoreTechnique = 70;
      }
    }

    // Score garanties
    let scoreGaranties = 50;
    if (offre.entreprise.rge) scoreGaranties += 25;
    if (offre.entreprise.qualibat) scoreGaranties += 25;
    scoreGaranties = Math.min(100, scoreGaranties);

    // Score global pondéré
    const scoreGlobal = Math.round(
      scorePrix * 0.30 +
      scoreTechnique * 0.25 +
      scoreFiabilite * 0.25 +
      scoreDelai * 0.10 +
      scoreGaranties * 0.10
    );

    // Points forts et faibles
    const points_forts: string[] = [];
    const points_faibles: string[] = [];
    const alertes: string[] = [];

    if (scorePrix >= 80) points_forts.push('Prix très compétitif');
    else if (scorePrix >= 70) points_forts.push('Prix dans la moyenne');
    else if (scorePrix <= 50) points_faibles.push('Prix élevé par rapport au marché');

    if (offre.entreprise.rge) points_forts.push('Certification RGE (accès aux aides)');
    else if (['ISOL', 'CVC', 'ELEC', 'MENU_EXT'].includes(offre.lot_code)) {
      alertes.push('⚠️ Entreprise non RGE - pas d\'accès aux aides énergétiques');
    }

    if (offre.entreprise.qualibat) points_forts.push('Certification Qualibat');
    if (offre.entreprise.anciennete && offre.entreprise.anciennete > 10) {
      points_forts.push(`Entreprise établie (${offre.entreprise.anciennete} ans)`);
    }

    if (scoreDelai >= 85) points_forts.push('Délai d\'intervention rapide');
    else if (scoreDelai <= 50) points_faibles.push('Délai d\'intervention long');

    if (scoreFiabilite >= 80) points_forts.push('Entreprise de confiance');
    else if (scoreFiabilite <= 40) points_faibles.push('Peu d\'éléments de confiance');

    // Alertes supplémentaires
    if (scorePrix >= 95 && ecartPrix < -20) {
      alertes.push('⚠️ Prix anormalement bas - vérifier la qualité des prestations');
    }
    if (contexte?.budget_max && offre.montant_ht > contexte.budget_max) {
      alertes.push('⚠️ Dépasse le budget maximum défini');
    }

    // Recommandation
    let recommandation: 'retenir' | 'negocier' | 'rejeter';
    if (scoreGlobal >= 75 && alertes.length === 0) {
      recommandation = 'retenir';
    } else if (scoreGlobal >= 55 || (scoreGlobal >= 45 && points_forts.length >= 2)) {
      recommandation = 'negocier';
    } else {
      recommandation = 'rejeter';
    }

    // Suggestions de négociation
    const suggestions_negociation: string[] = [];
    if (recommandation === 'negocier') {
      if (scorePrix <= 60) suggestions_negociation.push('Négocier une réduction du prix');
      if (scoreDelai <= 60) suggestions_negociation.push('Demander un engagement sur les délais');
      if (!offre.entreprise.qualibat) suggestions_negociation.push('Demander une garantie de parfait achèvement étendue');
    }

    return {
      offre_id: offre.id,
      score_global: scoreGlobal,
      scores_details: {
        prix: scorePrix,
        technique: scoreTechnique,
        delai: scoreDelai,
        fiabilite: scoreFiabilite,
        garanties: scoreGaranties,
      },
      points_forts,
      points_faibles,
      alertes,
      recommandation,
      justification: this.generateJustification(scoreGlobal, recommandation, points_forts, points_faibles, alertes),
      comparaison_marche: {
        position,
        ecart_pourcentage: Math.round(ecartPrix),
      },
      suggestions_negociation: suggestions_negociation.length > 0 ? suggestions_negociation : undefined,
    };
  }

  /**
   * Compare plusieurs offres et établit un classement
   */
  async compareOffres(offres: OffreInput[]): Promise<ComparaisonResult> {
    if (offres.length === 0) {
      return {
        classement: [],
        meilleure_offre: '',
        analyse_comparative: 'Aucune offre à comparer',
        synthese: '',
        recommandation_finale: 'Aucune offre disponible',
      };
    }

    // Analyser chaque offre
    const analyses = await Promise.all(
      offres.map(async (offre) => ({
        offre,
        analysis: await this.analyzeOffre(offre, { autres_offres: offres.filter(o => o.id !== offre.id) }),
      }))
    );

    // Établir le classement
    const classement = analyses
      .sort((a, b) => b.analysis.score_global - a.analysis.score_global)
      .map((a, i) => ({
        offre_id: a.offre.id,
        entreprise_nom: a.offre.entreprise.nom,
        rang: i + 1,
        score: a.analysis.score_global,
        montant_ht: a.offre.montant_ht,
      }));

    const meilleure = analyses.find(a => a.offre.id === classement[0]?.offre_id);
    const ecartPrix = classement.length > 1
      ? Math.round(((classement[classement.length - 1].montant_ht - classement[0].montant_ht) / classement[0].montant_ht) * 100)
      : 0;

    return {
      classement,
      meilleure_offre: classement[0]?.offre_id || '',
      analyse_comparative: `${classement.length} offres analysées. Écart de prix entre la moins chère et la plus chère : ${ecartPrix}%.`,
      synthese: this.generateSynthese(classement, analyses),
      recommandation_finale: meilleure
        ? `Recommandation : ${meilleure.analysis.recommandation === 'retenir' ? 'Retenir' : 'Négocier avec'} ${meilleure.offre.entreprise.nom} (score ${meilleure.analysis.score_global}/100)`
        : 'Aucune recommandation',
    };
  }

  /**
   * Analyse un devis détaillé
   */
  async analyzeDevis(devisContent: string, montantAnnonce: number): Promise<AnalyseDevisResult> {
    const prompt = `Analyse ce devis de travaux BTP:

${devisContent}

Montant annoncé: ${montantAnnonce.toLocaleString('fr-FR')} € HT

Identifie:
1. Chaque poste avec sa désignation, quantité, unité, prix unitaire et total
2. Les anomalies (prix anormaux, quantités suspectes, postes manquants, doublons)
3. Le total recalculé
4. L'écart avec le montant annoncé

Réponds en JSON:
{
  "postes_identifies": [...],
  "anomalies": [...],
  "total_analyse": number,
  "ecart_annonce": number,
  "taux_confiance": number
}`;

    try {
      const response = await secureAI.complete({
        messages: [{ role: 'user', content: prompt }],
        model: 'gpt-4o',
        provider: 'openai',
        temperature: 0.2,
        max_tokens: 3000,
        response_format: { type: 'json_object' },
      });

      return JSON.parse(response);
    } catch (error) {
      console.error('OffreAnalysisAgent.analyzeDevis error:', error);
      return {
        postes_identifies: [],
        anomalies: [{ type: 'incoherence', description: 'Analyse automatique non disponible' }],
        total_analyse: montantAnnonce,
        ecart_annonce: 0,
        taux_confiance: 0,
      };
    }
  }

  /**
   * Analyse le mémoire technique
   */
  private async analyzeMemoireTechnique(memoire: string): Promise<{ score: number; points: string[] }> {
    const prompt = `Analyse ce mémoire technique d'une entreprise BTP:

${memoire.substring(0, 2000)}

Évalue sur 100:
- Qualité de la présentation
- Pertinence des moyens proposés
- Compréhension du projet
- Engagement sur la qualité

Réponds en JSON: { "score": number, "points": ["string"] }`;

    try {
      const response = await secureAI.complete({
        messages: [{ role: 'user', content: prompt }],
        model: 'gpt-4o',
        provider: 'openai',
        temperature: 0.3,
        max_tokens: 500,
        response_format: { type: 'json_object' },
      });

      return JSON.parse(response);
    } catch {
      return { score: 70, points: [] };
    }
  }

  private generateJustification(
    score: number,
    reco: string,
    forts: string[],
    faibles: string[],
    alertes: string[]
  ): string {
    if (reco === 'retenir') {
      return `Offre de qualité (score ${score}/100) avec ${forts.length} points forts : ${forts.slice(0, 2).join(', ')}. Recommandation : retenir cette offre.`;
    } else if (reco === 'negocier') {
      const points = faibles.length > 0 ? faibles.slice(0, 2).join(', ') : 'certains aspects';
      return `Offre acceptable (score ${score}/100) mais des améliorations sont possibles sur : ${points}. Une négociation pourrait améliorer les conditions.`;
    } else {
      const problemes = [...alertes, ...faibles].slice(0, 2).join(', ') || 'plusieurs critères';
      return `Offre insuffisante (score ${score}/100). Problèmes identifiés : ${problemes}. Recommandation : chercher d'autres offres ou demander une révision significative.`;
    }
  }

  private generateSynthese(
    classement: { entreprise_nom: string; score: number; montant_ht: number }[],
    analyses: { offre: OffreInput; analysis: OffreAnalysis }[]
  ): string {
    if (classement.length === 0) return '';

    const top = classement[0];
    const aRetenir = analyses.filter(a => a.analysis.recommandation === 'retenir').length;
    const aNegocier = analyses.filter(a => a.analysis.recommandation === 'negocier').length;

    return `Sur ${classement.length} offres : ${aRetenir} à retenir, ${aNegocier} à négocier. ` +
      `${top.entreprise_nom} arrive en tête avec un score de ${top.score}/100 ` +
      `pour un montant de ${top.montant_ht.toLocaleString('fr-FR')} € HT.`;
  }
}

export const offreAnalysisAgent = new OffreAnalysisAgent();
export default OffreAnalysisAgent;
