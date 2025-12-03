/**
 * Comparison Service
 * Service pour comparer plusieurs devis analysés
 */

import { supabase } from '@/lib/supabase';

// =====================================================
// INTERFACES
// =====================================================

export interface DevisComparable {
  id: string;
  nomProjet: string;
  entreprise: string;
  siret?: string;
  montant: number;
  scoreTotal: number;
  grade: string;
  scoreEntreprise: number;
  scorePrix: number;
  scoreCompletude: number;
  scoreConformite: number;
  scoreDelais: number;
  surcoutsDetectes: number;
  economiesPotentielles: number;
  dateAnalyse: string;
}

export interface ComparisonResult {
  id: string;
  name: string;
  devis: DevisComparable[];
  winner: {
    id: string;
    raison: string;
  };
  analyse: {
    meilleurPrix: string;
    meilleurScore: string;
    meilleureEntreprise: string;
    ecartPrix: number;
    ecartPrixPourcentage: number;
  };
  recommandation: string;
  createdAt: string;
}

export interface CreateComparisonInput {
  name?: string;
  devisIds: string[];
}

// =====================================================
// SERVICE
// =====================================================

class ComparisonService {
  /**
   * Récupérer les devis analysés d'un utilisateur (pour sélection)
   */
  async getAnalyzedDevisForUser(userId: string): Promise<DevisComparable[]> {
    const { data, error } = await supabase
      .from('devis')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'analyzed')
      .order('analyzed_at', { ascending: false });

    if (error) {
      console.error('[ComparisonService] Error fetching devis:', error);
      throw new Error(`Erreur lors de la récupération des devis: ${error.message}`);
    }

    return (data || []).map(d => this.mapDevisToComparable(d));
  }

  /**
   * Créer une nouvelle comparaison
   */
  async createComparison(userId: string, input: CreateComparisonInput): Promise<ComparisonResult> {
    const { devisIds, name } = input;

    // Validation
    if (devisIds.length < 2) {
      throw new Error('Minimum 2 devis requis pour une comparaison');
    }
    if (devisIds.length > 3) {
      throw new Error('Maximum 3 devis pour une comparaison');
    }

    // Récupérer les devis
    const { data: devisList, error: devisError } = await supabase
      .from('devis')
      .select('*')
      .in('id', devisIds)
      .eq('user_id', userId)
      .eq('status', 'analyzed');

    if (devisError) {
      console.error('[ComparisonService] Error fetching devis:', devisError);
      throw new Error(`Erreur lors de la récupération des devis: ${devisError.message}`);
    }

    if (!devisList || devisList.length < 2) {
      throw new Error('Devis non trouvés ou non analysés');
    }

    // Mapper les devis
    const devisComparables = devisList.map(d => this.mapDevisToComparable(d));

    // Calculer la comparaison
    const analyse = this.analyzeDevis(devisComparables);
    const winner = this.determineWinner(devisComparables, analyse);
    const recommandation = this.generateRecommandation(devisComparables, winner, analyse);

    // Générer un nom si non fourni
    const comparisonName = name || `Comparaison du ${new Date().toLocaleDateString('fr-FR')}`;

    // Construire le résultat
    const result: ComparisonResult = {
      id: '', // Sera défini après insertion
      name: comparisonName,
      devis: devisComparables,
      winner,
      analyse,
      recommandation,
      createdAt: new Date().toISOString(),
    };

    // Sauvegarder en base
    const { data: insertedComparison, error: insertError } = await supabase
      .from('comparisons')
      .insert({
        user_id: userId,
        name: comparisonName,
        devis_ids: devisIds,
        result: result,
        winner_id: winner.id,
      })
      .select()
      .single();

    if (insertError) {
      console.error('[ComparisonService] Error inserting comparison:', insertError);
      throw new Error(`Erreur lors de la sauvegarde: ${insertError.message}`);
    }

    result.id = insertedComparison.id;

    return result;
  }

  /**
   * Récupérer une comparaison par ID
   */
  async getComparison(comparisonId: string, userId: string): Promise<ComparisonResult | null> {
    const { data, error } = await supabase
      .from('comparisons')
      .select('*')
      .eq('id', comparisonId)
      .eq('user_id', userId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null; // Not found
      }
      console.error('[ComparisonService] Error fetching comparison:', error);
      throw new Error(`Erreur: ${error.message}`);
    }

    return data.result as ComparisonResult;
  }

  /**
   * Récupérer toutes les comparaisons d'un utilisateur
   */
  async getUserComparisons(userId: string): Promise<ComparisonResult[]> {
    const { data, error } = await supabase
      .from('comparisons')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[ComparisonService] Error fetching comparisons:', error);
      throw new Error(`Erreur: ${error.message}`);
    }

    return (data || []).map(c => ({
      ...c.result as ComparisonResult,
      id: c.id,
    }));
  }

  /**
   * Supprimer une comparaison
   */
  async deleteComparison(comparisonId: string, userId: string): Promise<void> {
    const { error } = await supabase
      .from('comparisons')
      .delete()
      .eq('id', comparisonId)
      .eq('user_id', userId);

    if (error) {
      console.error('[ComparisonService] Error deleting comparison:', error);
      throw new Error(`Erreur lors de la suppression: ${error.message}`);
    }
  }

  // =====================================================
  // MÉTHODES PRIVÉES
  // =====================================================

  private mapDevisToComparable(d: any): DevisComparable {
    return {
      id: d.id,
      nomProjet: d.nom_projet || 'Sans nom',
      entreprise: d.extracted_data?.entreprise?.nom || d.score_entreprise?.nom || 'Entreprise inconnue',
      siret: d.extracted_data?.entreprise?.siret || d.score_entreprise?.siret,
      montant: d.montant_total || d.amount || 0,
      scoreTotal: d.score_total || 0,
      grade: d.grade || 'N/A',
      scoreEntreprise: d.score_entreprise?.total || 0,
      scorePrix: d.score_prix?.total || 0,
      scoreCompletude: d.score_completude?.total || 0,
      scoreConformite: d.score_conformite?.total || 0,
      scoreDelais: d.score_delais?.total || 0,
      surcoutsDetectes: d.detected_overcosts || 0,
      economiesPotentielles: d.potential_savings || d.score_prix?.economiesPotentielles || 0,
      dateAnalyse: d.analyzed_at || d.created_at,
    };
  }

  private analyzeDevis(devis: DevisComparable[]) {
    // Trouver le meilleur prix (le moins cher)
    const meilleurPrixDevis = devis.reduce((min, d) =>
      d.montant < min.montant ? d : min
    );

    // Trouver le meilleur score
    const meilleurScoreDevis = devis.reduce((max, d) =>
      d.scoreTotal > max.scoreTotal ? d : max
    );

    // Trouver la meilleure entreprise (score entreprise)
    const meilleureEntrepriseDevis = devis.reduce((max, d) =>
      d.scoreEntreprise > max.scoreEntreprise ? d : max
    );

    // Calculer l'écart de prix
    const prixMax = Math.max(...devis.map(d => d.montant));
    const prixMin = Math.min(...devis.map(d => d.montant));
    const ecartPrix = prixMax - prixMin;
    const ecartPrixPourcentage = prixMin > 0 ? ((ecartPrix / prixMin) * 100) : 0;

    return {
      meilleurPrix: meilleurPrixDevis.id,
      meilleurScore: meilleurScoreDevis.id,
      meilleureEntreprise: meilleureEntrepriseDevis.id,
      ecartPrix,
      ecartPrixPourcentage: Math.round(ecartPrixPourcentage * 10) / 10,
    };
  }

  private determineWinner(
    devis: DevisComparable[],
    analyse: ReturnType<typeof this.analyzeDevis>
  ): { id: string; raison: string } {
    // Algorithme de sélection du gagnant basé sur un score pondéré
    const scores = devis.map(d => {
      // Score normalisé (0-100)
      const scoreNorm = (d.scoreTotal / 1000) * 100;

      // Prix inversé normalisé (moins cher = meilleur)
      const prixMax = Math.max(...devis.map(x => x.montant));
      const prixMin = Math.min(...devis.map(x => x.montant));
      const prixRange = prixMax - prixMin || 1;
      const prixNorm = ((prixMax - d.montant) / prixRange) * 100;

      // Score entreprise normalisé
      const entrepriseNorm = (d.scoreEntreprise / 250) * 100;

      // Score composite pondéré
      // 50% score global, 30% prix, 20% entreprise
      const scoreComposite = (scoreNorm * 0.5) + (prixNorm * 0.3) + (entrepriseNorm * 0.2);

      return {
        id: d.id,
        scoreComposite,
        entreprise: d.entreprise,
        montant: d.montant,
        scoreTotal: d.scoreTotal,
      };
    });

    // Trier par score composite décroissant
    scores.sort((a, b) => b.scoreComposite - a.scoreComposite);
    const winner = scores[0];

    // Générer la raison
    let raison = '';
    if (winner.id === analyse.meilleurScore && winner.id === analyse.meilleurPrix) {
      raison = `${winner.entreprise} offre le meilleur rapport qualité-prix avec le score le plus élevé (${winner.scoreTotal}/1000) ET le prix le plus compétitif.`;
    } else if (winner.id === analyse.meilleurScore) {
      raison = `${winner.entreprise} présente le meilleur score TORP (${winner.scoreTotal}/1000), garantissant qualité et fiabilité malgré un prix légèrement plus élevé.`;
    } else if (winner.id === analyse.meilleurPrix) {
      raison = `${winner.entreprise} propose le prix le plus compétitif tout en maintenant un score TORP acceptable.`;
    } else {
      raison = `${winner.entreprise} offre le meilleur équilibre entre qualité, prix et fiabilité de l'entreprise.`;
    }

    return { id: winner.id, raison };
  }

  private generateRecommandation(
    devis: DevisComparable[],
    winner: { id: string; raison: string },
    analyse: ReturnType<typeof this.analyzeDevis>
  ): string {
    const winnerDevis = devis.find(d => d.id === winner.id)!;
    const others = devis.filter(d => d.id !== winner.id);

    let recommandation = `**Recommandation TORP**\n\n`;
    recommandation += `Après analyse comparative de ${devis.length} devis, nous recommandons **${winnerDevis.entreprise}**.\n\n`;
    recommandation += `**Pourquoi ?** ${winner.raison}\n\n`;

    // Points forts du gagnant
    recommandation += `**Points forts:**\n`;
    if (winnerDevis.scoreEntreprise >= 200) {
      recommandation += `- Entreprise fiable et bien notée\n`;
    }
    if (winnerDevis.scorePrix >= 240) {
      recommandation += `- Prix cohérent avec le marché\n`;
    }
    if (winnerDevis.scoreCompletude >= 160) {
      recommandation += `- Devis complet et détaillé\n`;
    }
    if (winnerDevis.surcoutsDetectes === 0) {
      recommandation += `- Aucun surcoût détecté\n`;
    }

    // Économies potentielles
    if (analyse.ecartPrix > 0) {
      recommandation += `\n**À noter:** L'écart de prix entre les devis est de ${analyse.ecartPrix.toLocaleString('fr-FR')}€ (${analyse.ecartPrixPourcentage}%).\n`;
    }

    // Points d'attention
    if (winnerDevis.surcoutsDetectes > 0) {
      recommandation += `\n**Point de vigilance:** ${winnerDevis.surcoutsDetectes.toLocaleString('fr-FR')}€ de surcoûts potentiels détectés. Négociez ces points avant signature.\n`;
    }

    return recommandation;
  }
}

export const comparisonService = new ComparisonService();
export default comparisonService;
