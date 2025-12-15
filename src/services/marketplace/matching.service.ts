/**
 * Service de Matching Marketplace
 * Algorithme intelligent de mise en relation projets / artisans
 */

import type {
  ArtisanProfile,
  MatchingResult,
  MatchingCriteria,
  MetierBTP,
  DemandeDevis,
} from '@/types/marketplace.types';
import type { Phase0Project } from '@/types/phase0';

// Poids des critères de matching
const MATCHING_WEIGHTS = {
  competencesTechniques: 30,
  proximiteGeographique: 20,
  disponibilite: 15,
  prixCompetitif: 15,
  notation: 10,
  qualifications: 10,
};

/**
 * Service de matching entre projets et artisans
 */
export class MatchingService {
  /**
   * Trouver les meilleurs artisans pour une demande
   */
  async findMatchingArtisans(
    criteria: MatchingCriteria,
    artisans: ArtisanProfile[],
    limit = 10
  ): Promise<MatchingResult[]> {
    const results: MatchingResult[] = [];

    for (const artisan of artisans) {
      // Filtres éliminatoires
      if (!this.passesBasicFilters(artisan, criteria)) {
        continue;
      }

      // Calcul du score de matching
      const scoreDetails = this.calculateMatchingScore(artisan, criteria);
      const totalScore = this.calculateTotalScore(scoreDetails);

      results.push({
        artisanId: artisan.id,
        score: totalScore,
        scoreDetails,
        artisan,
      });
    }

    // Trier par score décroissant
    results.sort((a, b) => b.score - a.score);

    return results.slice(0, limit);
  }

  /**
   * Créer des critères de matching depuis un projet Phase0
   */
  createCriteriaFromPhase0Project(
    project: Phase0Project,
    demandeId: string
  ): MatchingCriteria {
    // Extraire les métiers depuis les lots sélectionnés
    const metiers = this.extractMetiersFromLots(project.selectedLots || []);

    // Déterminer si RGE requis
    const rgeRequis = project.selectedLots?.some(
      lot => lot.isRGEEligible || lot.category === 'energy'
    ) || false;

    // Extraire le budget
    const budget = project.workProject?.budget?.totalEnvelope;
    const budgetEstime = budget ? {
      min: budget.minAmount || budget.amount * 0.8,
      max: budget.maxAmount || budget.amount * 1.2,
    } : undefined;

    // Date de début souhaitée
    const dateDebut = project.workProject?.constraints?.temporal?.preferredStart
      ? new Date(project.workProject.constraints.temporal.preferredStart)
      : undefined;

    return {
      demandeId,
      metiers,
      codePostal: project.property?.address?.postalCode || '',
      budgetEstime,
      rgeRequis,
      qualificationsRequises: rgeRequis ? ['RGE'] : [],
      dateDebut,
    };
  }

  /**
   * Filtres éliminatoires de base
   */
  private passesBasicFilters(
    artisan: ArtisanProfile,
    criteria: MatchingCriteria
  ): boolean {
    // Artisan doit être vérifié
    if (artisan.status !== 'verified' && artisan.status !== 'premium') {
      return false;
    }

    // Vérifier couverture géographique
    const dept = criteria.codePostal.substring(0, 2);
    if (!artisan.zoneIntervention.departements.includes(dept)) {
      if (!artisan.zoneIntervention.mobiliteNationale) {
        return false;
      }
    }

    // Vérifier compétences métier (au moins un métier en commun)
    const hasMatchingMetier = criteria.metiers.some(
      m => artisan.metiers.includes(m)
    );
    if (!hasMatchingMetier) {
      return false;
    }

    // Vérifier RGE si requis
    if (criteria.rgeRequis) {
      const hasValidRGE = artisan.qualifications.some(
        q => q.type === 'RGE' && q.estValide
      );
      if (!hasValidRGE) {
        return false;
      }
    }

    // Vérifier budget dans les préférences artisan
    if (criteria.budgetEstime && artisan.preferences.budgetMinimum) {
      if (criteria.budgetEstime.max < artisan.preferences.budgetMinimum) {
        return false;
      }
    }

    return true;
  }

  /**
   * Calculer les scores détaillés de matching
   */
  private calculateMatchingScore(
    artisan: ArtisanProfile,
    criteria: MatchingCriteria
  ): MatchingResult['scoreDetails'] {
    return {
      competencesTechniques: this.scoreCompetences(artisan, criteria),
      proximiteGeographique: this.scoreProximite(artisan, criteria),
      disponibilite: this.scoreDisponibilite(artisan, criteria),
      prixCompetitif: this.scorePrix(artisan, criteria),
      notation: this.scoreNotation(artisan),
      qualifications: this.scoreQualifications(artisan, criteria),
    };
  }

  /**
   * Score de compétences techniques (0-100)
   */
  private scoreCompetences(
    artisan: ArtisanProfile,
    criteria: MatchingCriteria
  ): number {
    const matchingMetiers = criteria.metiers.filter(
      m => artisan.metiers.includes(m)
    );
    const coverage = matchingMetiers.length / criteria.metiers.length;

    // Bonus si artisan spécialisé dans ces métiers
    const isSpecialized = artisan.metiers.length <= 3;
    const specializationBonus = isSpecialized ? 10 : 0;

    return Math.min(100, coverage * 90 + specializationBonus);
  }

  /**
   * Score de proximité géographique (0-100)
   */
  private scoreProximite(
    artisan: ArtisanProfile,
    criteria: MatchingCriteria
  ): number {
    const dept = criteria.codePostal.substring(0, 2);
    const artisanDept = artisan.entreprise.adresse.departement;

    // Même département = score max
    if (artisanDept === dept) {
      return 100;
    }

    // Dans la zone d'intervention
    if (artisan.zoneIntervention.departements.includes(dept)) {
      return 80;
    }

    // Mobilité nationale
    if (artisan.zoneIntervention.mobiliteNationale) {
      return 50;
    }

    return 0;
  }

  /**
   * Score de disponibilité (0-100)
   */
  private scoreDisponibilite(
    artisan: ArtisanProfile,
    criteria: MatchingCriteria
  ): number {
    const delai = artisan.capacites.delaiIntervention;

    const scores: Record<typeof delai, number> = {
      'immediat': 100,
      '1_semaine': 85,
      '2_semaines': 70,
      '1_mois': 50,
      'plus': 30,
    };

    let score = scores[delai] || 50;

    // Ajuster selon date de début demandée
    if (criteria.dateDebut) {
      const joursAvantDebut = Math.floor(
        (criteria.dateDebut.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
      );

      // Si date éloignée, la disponibilité immédiate n'est pas nécessaire
      if (joursAvantDebut > 30) {
        score = Math.min(100, score + 20);
      }
    }

    return score;
  }

  /**
   * Score de compétitivité prix (0-100)
   */
  private scorePrix(
    artisan: ArtisanProfile,
    criteria: MatchingCriteria
  ): number {
    // Sans budget estimé, score neutre
    if (!criteria.budgetEstime) {
      return 70;
    }

    // Si artisan a des préférences de budget
    if (artisan.preferences.budgetMinimum && artisan.preferences.budgetMaximum) {
      const artisanMid = (artisan.preferences.budgetMinimum + artisan.preferences.budgetMaximum) / 2;
      const criteriaMid = (criteria.budgetEstime.min + criteria.budgetEstime.max) / 2;

      // Si l'artisan vise un budget proche
      const ratio = criteriaMid / artisanMid;
      if (ratio >= 0.8 && ratio <= 1.2) {
        return 90;
      } else if (ratio >= 0.5 && ratio <= 1.5) {
        return 70;
      }
      return 50;
    }

    // Pas de préférence = score neutre
    return 70;
  }

  /**
   * Score de notation (0-100)
   */
  private scoreNotation(artisan: ArtisanProfile): number {
    const { noteMoyenne, nombreAvis, torpScore } = artisan.stats;

    // Pondérer par nombre d'avis
    let score = 0;

    if (nombreAvis >= 10) {
      // Assez d'avis pour être représentatif
      score = (noteMoyenne / 5) * 100;
    } else if (nombreAvis >= 5) {
      score = (noteMoyenne / 5) * 90;
    } else if (nombreAvis >= 1) {
      score = (noteMoyenne / 5) * 75;
    } else {
      // Pas d'avis = score neutre
      score = 60;
    }

    // Bonus TORP Score
    if (torpScore && torpScore >= 800) {
      score = Math.min(100, score + 10);
    }

    return score;
  }

  /**
   * Score qualifications (0-100)
   */
  private scoreQualifications(
    artisan: ArtisanProfile,
    criteria: MatchingCriteria
  ): number {
    let score = 50; // Base

    const validQualifs = artisan.qualifications.filter(q => q.estValide);

    // Points par qualification valide
    score += validQualifs.length * 10;

    // Bonus si toutes les qualifications requises sont présentes
    if (criteria.qualificationsRequises.length > 0) {
      const hasAll = criteria.qualificationsRequises.every(
        req => validQualifs.some(q => q.type === req || q.domaines.includes(req))
      );
      if (hasAll) {
        score += 20;
      }
    }

    // Bonus artisan premium
    if (artisan.status === 'premium') {
      score += 10;
    }

    return Math.min(100, score);
  }

  /**
   * Calculer le score total pondéré
   */
  private calculateTotalScore(
    details: MatchingResult['scoreDetails']
  ): number {
    const weighted =
      details.competencesTechniques * (MATCHING_WEIGHTS.competencesTechniques / 100) +
      details.proximiteGeographique * (MATCHING_WEIGHTS.proximiteGeographique / 100) +
      details.disponibilite * (MATCHING_WEIGHTS.disponibilite / 100) +
      details.prixCompetitif * (MATCHING_WEIGHTS.prixCompetitif / 100) +
      details.notation * (MATCHING_WEIGHTS.notation / 100) +
      details.qualifications * (MATCHING_WEIGHTS.qualifications / 100);

    return Math.round(weighted);
  }

  /**
   * Extraire les métiers depuis les lots
   */
  private extractMetiersFromLots(lots: unknown[]): MetierBTP[] {
    const metierMap: Record<string, MetierBTP> = {
      'demolition': 'maconnerie',
      'gros_oeuvre': 'maconnerie',
      'plomberie': 'plomberie',
      'electricite': 'electricite',
      'chauffage': 'chauffage',
      'energy': 'chauffage',
      'climatisation': 'climatisation',
      'menuiserie': 'menuiserie',
      'couverture': 'couverture',
      'charpente': 'charpente',
      'peinture': 'peinture',
      'carrelage': 'carrelage',
      'platrerie': 'platerie',
      'isolation': 'isolation',
      'facade': 'facade',
      'terrassement': 'terrassement',
      'assainissement': 'assainissement',
    };

    const metiers = new Set<MetierBTP>();

    for (const lot of lots) {
      const category = (lot as { category?: string }).category;
      if (category && metierMap[category]) {
        metiers.add(metierMap[category]);
      }
    }

    return [...metiers];
  }

  /**
   * Générer des suggestions d'amélioration pour le matching
   */
  generateMatchingSuggestions(
    results: MatchingResult[],
    criteria: MatchingCriteria
  ): string[] {
    const suggestions: string[] = [];

    if (results.length === 0) {
      suggestions.push('Aucun artisan trouvé - élargissez votre zone de recherche');
      if (criteria.rgeRequis) {
        suggestions.push('Essayez sans filtre RGE obligatoire');
      }
    } else if (results.length < 3) {
      suggestions.push('Peu d\'artisans disponibles - patientez quelques jours');
    }

    // Analyser les scores moyens
    if (results.length > 0) {
      const avgScore = results.reduce((s, r) => s + r.score, 0) / results.length;
      if (avgScore < 60) {
        suggestions.push('Les correspondances sont faibles - ajustez vos critères');
      }
    }

    return suggestions;
  }
}

export const matchingService = new MatchingService();
export default matchingService;
