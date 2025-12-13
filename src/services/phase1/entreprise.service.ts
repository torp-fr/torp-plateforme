/**
 * TORP Phase 1 - Service Entreprises
 * Module 1.2 : Recherche et Qualification des Entreprises
 *
 * Gère la recherche, la qualification et le scoring des entreprises :
 * - Moteur de matching basé sur localisation, corps métier, budget
 * - Scoring automatique multicritères
 * - Vérification automatique (qualifications, assurances)
 */

import { supabase } from '@/lib/supabase';
import type { Phase0Project } from '@/types/phase0/project.types';
import type { Address } from '@/types/phase0/common.types';
import type { SelectedLot } from '@/types/phase0/lots.types';

import type {
  Entreprise,
  EntrepriseIdentification,
  EntrepriseQualification,
  EntrepriseAssurance,
  EntrepriseReference,
  EntrepriseCapacites,
  EntrepriseReputation,
  ScoreEntreprise,
  ScoreCritere,
  CritereScoring,
  RecommandationEntreprise,
  ParametresScoring,
  CriteresRechercheEntreprise,
  ResultatRechercheEntreprise,
  CorpsMetier,
  PONDERATIONS_SCORING_DEFAUT,
  SEUILS_RECOMMANDATION,
} from '@/types/phase1/entreprise.types';

// =============================================================================
// TYPES INTERNES
// =============================================================================

export interface EntrepriseMatchingInput {
  project: Phase0Project;
  rayonKm?: number;
  limiteResultats?: number;
  filtres?: {
    rgeObligatoire?: boolean;
    noteMinimale?: number;
    disponibiliteSousJours?: number;
  };
}

export interface EntrepriseMatchingResult {
  success: boolean;
  entreprises: Entreprise[];
  totalTrouvees: number;
  parametresUtilises: ParametresScoring;
  tempsRecherche: number;
}

export interface ScoringResult {
  entreprise: Entreprise;
  score: ScoreEntreprise;
}

// =============================================================================
// SERVICE
// =============================================================================

export class EntrepriseService {
  /**
   * Recherche et score les entreprises correspondant au projet
   */
  static async findMatchingEntreprises(
    input: EntrepriseMatchingInput
  ): Promise<EntrepriseMatchingResult> {
    const startTime = Date.now();
    const { project, rayonKm = 50, limiteResultats = 10, filtres } = input;

    try {
      // Construire les paramètres de scoring
      const parametres = this.buildScoringParams(project, filtres);

      // Construire les critères de recherche
      const criteres = this.buildSearchCriteria(project, rayonKm, filtres);

      // Rechercher les entreprises en base
      const entreprises = await this.searchEntreprises(criteres);

      // Scorer chaque entreprise
      const entreprisesAvecsScores = await Promise.all(
        entreprises.map(async (e) => this.scoreEntreprise(e, parametres))
      );

      // Trier par score décroissant
      entreprisesAvecsScores.sort((a, b) => b.score.scoreGlobal - a.score.scoreGlobal);

      // Limiter les résultats
      const topEntreprises = entreprisesAvecsScores.slice(0, limiteResultats);

      // Attacher le score à chaque entreprise
      const entreprisesFinales = topEntreprises.map(({ entreprise, score }) => ({
        ...entreprise,
        scoreTORP: score,
      }));

      return {
        success: true,
        entreprises: entreprisesFinales,
        totalTrouvees: entreprises.length,
        parametresUtilises: parametres,
        tempsRecherche: Date.now() - startTime,
      };
    } catch (error) {
      console.error('[Entreprise] Matching error:', error);
      return {
        success: false,
        entreprises: [],
        totalTrouvees: 0,
        parametresUtilises: this.buildScoringParams(project),
        tempsRecherche: Date.now() - startTime,
      };
    }
  }

  /**
   * Score une entreprise selon les paramètres du projet
   */
  static async scoreEntreprise(
    entreprise: Entreprise,
    parametres: ParametresScoring
  ): Promise<ScoringResult> {
    const scores: ScoreCritere[] = [];
    const ponderations = { ...PONDERATIONS_SCORING_DEFAUT, ...parametres.ponderations };

    // 1. Qualification RGE (si applicable)
    if (parametres.exigenceRGE) {
      const scoreRGE = this.scoreQualificationRGE(entreprise, parametres);
      scores.push(scoreRGE);
    }

    // 2. Niveau Qualibat
    const scoreQualibat = this.scoreNiveauQualibat(entreprise, parametres);
    scores.push(scoreQualibat);

    // 3. Assurances à jour
    const scoreAssurances = this.scoreAssurances(entreprise);
    scores.push(scoreAssurances);

    // 4. Références similaires
    const scoreReferences = this.scoreReferences(entreprise, parametres);
    scores.push(scoreReferences);

    // 5. Chiffre d'affaires
    const scoreCA = this.scoreChiffreAffaires(entreprise, parametres);
    scores.push(scoreCA);

    // 6. Proximité géographique
    const scoreProximite = this.scoreProximite(entreprise, parametres.localisation);
    scores.push(scoreProximite);

    // 7. Avis clients
    const scoreAvis = this.scoreAvisClients(entreprise);
    scores.push(scoreAvis);

    // 8. Disponibilité
    const scoreDisponibilite = this.scoreDisponibilite(entreprise, parametres.urgence);
    scores.push(scoreDisponibilite);

    // 9. Réactivité
    const scoreReactivite = this.scoreReactivite(entreprise);
    scores.push(scoreReactivite);

    // Calcul du score global pondéré
    const scoreGlobal = this.calculateScoreGlobal(scores, ponderations);

    // Déterminer la recommandation
    const recommandation = this.determineRecommandation(scoreGlobal, entreprise);

    const score: ScoreEntreprise = {
      scoreGlobal,
      scoreParCritere: scores,
      recommandation,
      dateCalcul: new Date().toISOString(),
      parametresCalcul: parametres,
    };

    return { entreprise, score };
  }

  /**
   * Vérifie les documents d'une entreprise (Kbis, assurances, qualifications)
   */
  static async verifyEntreprise(entrepriseId: string): Promise<{
    verified: boolean;
    verifications: VerificationResult[];
  }> {
    const entreprise = await this.getEntrepriseById(entrepriseId);
    if (!entreprise) {
      return { verified: false, verifications: [] };
    }

    const verifications: VerificationResult[] = [];

    // Vérification Kbis (via API Infogreffe - simulé)
    verifications.push({
      type: 'kbis',
      status: entreprise.metadata.verifiee ? 'verified' : 'pending',
      message: entreprise.metadata.verifiee
        ? 'Entreprise active au RCS'
        : 'Vérification Kbis en attente',
      date: new Date().toISOString(),
    });

    // Vérification assurances
    const assurancesValides = entreprise.assurances.every((a) => a.enCours);
    verifications.push({
      type: 'assurances',
      status: assurancesValides ? 'verified' : 'expired',
      message: assurancesValides
        ? 'Toutes les assurances sont à jour'
        : 'Une ou plusieurs assurances ont expiré',
      date: new Date().toISOString(),
    });

    // Vérification qualifications
    const qualificationsValides = entreprise.qualifications.every((q) => q.enCours);
    verifications.push({
      type: 'qualifications',
      status: qualificationsValides ? 'verified' : 'expired',
      message: qualificationsValides
        ? 'Toutes les qualifications sont valides'
        : 'Une ou plusieurs qualifications ont expiré',
      date: new Date().toISOString(),
    });

    const verified = verifications.every((v) => v.status === 'verified');

    return { verified, verifications };
  }

  // =============================================================================
  // MÉTHODES PRIVÉES - SCORING
  // =============================================================================

  private static scoreQualificationRGE(
    entreprise: Entreprise,
    parametres: ParametresScoring
  ): ScoreCritere {
    const config = PONDERATIONS_SCORING_DEFAUT.qualification_rge;
    const rgeQualifications = entreprise.qualifications.filter(
      (q) => q.type === 'rge' && q.enCours
    );

    // Vérifier si RGE correspond aux types de travaux
    const hasMatchingRGE = rgeQualifications.length > 0;

    return {
      critere: 'qualification_rge',
      poids: config.poids,
      pointsMax: config.pointsMax,
      pointsObtenus: hasMatchingRGE ? config.pointsMax : 0,
      details: hasMatchingRGE
        ? `RGE valide: ${rgeQualifications.map((q) => q.designation).join(', ')}`
        : 'Pas de qualification RGE valide',
    };
  }

  private static scoreNiveauQualibat(
    entreprise: Entreprise,
    _parametres: ParametresScoring
  ): ScoreCritere {
    const config = PONDERATIONS_SCORING_DEFAUT.niveau_qualibat;
    const qualibatCerts = entreprise.qualifications.filter(
      (q) => q.type === 'qualibat' && q.enCours
    );

    let points = 0;
    let niveau = 'Aucun';

    if (qualibatCerts.length > 0) {
      // Points selon niveau
      const niveaux = qualibatCerts.map((q) => q.niveau);
      if (niveaux.includes('technicite_exceptionnelle')) {
        points = config.pointsMax;
        niveau = 'Exceptionnel';
      } else if (niveaux.includes('technicite_superieure')) {
        points = config.pointsMax * 0.8;
        niveau = 'Supérieur';
      } else if (niveaux.includes('technicite_confirmee')) {
        points = config.pointsMax * 0.6;
        niveau = 'Confirmé';
      } else {
        points = config.pointsMax * 0.4;
        niveau = 'Traditionnel';
      }
    }

    return {
      critere: 'niveau_qualibat',
      poids: config.poids,
      pointsMax: config.pointsMax,
      pointsObtenus: Math.round(points),
      details: `Niveau Qualibat: ${niveau}`,
    };
  }

  private static scoreAssurances(entreprise: Entreprise): ScoreCritere {
    const config = PONDERATIONS_SCORING_DEFAUT.assurances_jour;
    const assurances = entreprise.assurances;

    const rcDecennale = assurances.find((a) => a.type === 'rc_decennale');
    const rcPro = assurances.find((a) => a.type === 'rc_professionnelle');

    let points = 0;
    const details: string[] = [];

    // RC Décennale (obligatoire - 60% des points)
    if (rcDecennale?.enCours) {
      points += config.pointsMax * 0.6;
      details.push('RC Décennale à jour');
    } else {
      details.push('RC Décennale manquante ou expirée');
    }

    // RC Professionnelle (40% des points)
    if (rcPro?.enCours) {
      points += config.pointsMax * 0.4;
      details.push('RC Pro à jour');
    } else {
      details.push('RC Pro manquante ou expirée');
    }

    return {
      critere: 'assurances_jour',
      poids: config.poids,
      pointsMax: config.pointsMax,
      pointsObtenus: Math.round(points),
      details: details.join(' | '),
    };
  }

  private static scoreReferences(
    entreprise: Entreprise,
    parametres: ParametresScoring
  ): ScoreCritere {
    const config = PONDERATIONS_SCORING_DEFAUT.references_similaires;
    const references = entreprise.references;

    // Filtrer références similaires (même type de travaux, budget comparable)
    const referencesSimiliaires = references.filter((ref) => {
      // Vérifier ancienneté (< 5 ans)
      const dateFin = new Date(ref.dateFin);
      const cinqAnsAgo = new Date();
      cinqAnsAgo.setFullYear(cinqAnsAgo.getFullYear() - 5);
      if (dateFin < cinqAnsAgo) return false;

      // Vérifier montant comparable (±50%)
      const budgetMin = (parametres.budgetEstime?.min || 10000) * 0.5;
      const budgetMax = (parametres.budgetEstime?.max || 100000) * 1.5;
      if (ref.montantHT < budgetMin || ref.montantHT > budgetMax) return false;

      return true;
    });

    // Score basé sur le nombre de références
    let points = 0;
    const count = referencesSimiliaires.length;

    if (count >= 5) points = config.pointsMax;
    else if (count >= 3) points = config.pointsMax * 0.8;
    else if (count >= 2) points = config.pointsMax * 0.6;
    else if (count >= 1) points = config.pointsMax * 0.3;

    // Bonus pour bonnes notes clients
    const avgNote = referencesSimiliaires
      .filter((r) => r.noteClient)
      .reduce((sum, r) => sum + (r.noteClient || 0), 0) / Math.max(referencesSimiliaires.filter((r) => r.noteClient).length, 1);

    if (avgNote >= 4.5) points *= 1.1;

    return {
      critere: 'references_similaires',
      poids: config.poids,
      pointsMax: config.pointsMax,
      pointsObtenus: Math.min(Math.round(points), config.pointsMax),
      details: `${count} références similaires (note moy: ${avgNote.toFixed(1)}/5)`,
    };
  }

  private static scoreChiffreAffaires(
    entreprise: Entreprise,
    parametres: ParametresScoring
  ): ScoreCritere {
    const config = PONDERATIONS_SCORING_DEFAUT.chiffre_affaires;
    const ca = entreprise.capacites.financieres.chiffreAffaires || 0;
    const budgetProjet = parametres.budgetEstime?.max || 50000;

    // CA minimum recommandé = 2x budget projet
    const caMinRecommande = budgetProjet * 2;

    let points = 0;
    if (ca >= caMinRecommande * 2) points = config.pointsMax;
    else if (ca >= caMinRecommande) points = config.pointsMax * 0.8;
    else if (ca >= caMinRecommande * 0.5) points = config.pointsMax * 0.5;

    // Malus si procédure collective
    if (entreprise.capacites.financieres.procedureCollective) {
      points *= 0.3;
    }

    return {
      critere: 'chiffre_affaires',
      poids: config.poids,
      pointsMax: config.pointsMax,
      pointsObtenus: Math.round(points),
      details: `CA: ${(ca / 1000).toFixed(0)}k€ (recommandé: ${(caMinRecommande / 1000).toFixed(0)}k€)`,
    };
  }

  private static scoreProximite(
    entreprise: Entreprise,
    localisation: Address
  ): ScoreCritere {
    const config = PONDERATIONS_SCORING_DEFAUT.proximite;

    // Calcul distance (simplifié - basé sur code postal)
    const distance = this.estimateDistance(
      entreprise.identification.adresse,
      localisation
    );

    let points = 0;
    if (distance <= 20) points = config.pointsMax;
    else if (distance <= 30) points = config.pointsMax * 0.8;
    else if (distance <= 50) points = config.pointsMax * 0.6;
    else if (distance <= 80) points = config.pointsMax * 0.3;

    return {
      critere: 'proximite',
      poids: config.poids,
      pointsMax: config.pointsMax,
      pointsObtenus: Math.round(points),
      details: `Distance estimée: ${distance} km`,
    };
  }

  private static scoreAvisClients(entreprise: Entreprise): ScoreCritere {
    const config = PONDERATIONS_SCORING_DEFAUT.avis_clients;
    const reputation = entreprise.reputation;

    // Calculer note moyenne des différentes plateformes
    const notes: number[] = [];
    if (reputation.avisGoogle?.note) notes.push(reputation.avisGoogle.note);
    if (reputation.avisPagesJaunes?.note) notes.push(reputation.avisPagesJaunes.note);
    if (reputation.avisTrustpilot?.note) notes.push(reputation.avisTrustpilot.note);
    if (reputation.avisFacebook?.note) notes.push(reputation.avisFacebook.note);

    const noteMoyenne = notes.length > 0
      ? notes.reduce((a, b) => a + b, 0) / notes.length
      : 0;

    // Nombre total d'avis
    const nombreAvis =
      (reputation.avisGoogle?.nombreAvis || 0) +
      (reputation.avisPagesJaunes?.nombreAvis || 0) +
      (reputation.avisTrustpilot?.nombreAvis || 0) +
      (reputation.avisFacebook?.nombreAvis || 0);

    // Score basé sur note et volume
    let points = 0;
    if (noteMoyenne >= 4.5) points = config.pointsMax;
    else if (noteMoyenne >= 4) points = config.pointsMax * 0.85;
    else if (noteMoyenne >= 3.5) points = config.pointsMax * 0.65;
    else if (noteMoyenne >= 3) points = config.pointsMax * 0.4;

    // Bonus volume d'avis (fiabilité)
    if (nombreAvis >= 50) points *= 1.05;
    else if (nombreAvis < 10) points *= 0.9;

    // Malus si signalements
    if ((reputation.signalements?.length || 0) > 0) {
      const signalementsPenalty = Math.min(reputation.signalements!.length * 0.1, 0.5);
      points *= (1 - signalementsPenalty);
    }

    return {
      critere: 'avis_clients',
      poids: config.poids,
      pointsMax: config.pointsMax,
      pointsObtenus: Math.round(points),
      details: `Note: ${noteMoyenne.toFixed(1)}/5 (${nombreAvis} avis)`,
    };
  }

  private static scoreDisponibilite(
    entreprise: Entreprise,
    urgence: 'normale' | 'urgente' | 'tres_urgente'
  ): ScoreCritere {
    const config = PONDERATIONS_SCORING_DEFAUT.disponibilite;

    // Disponibilité basée sur capacité de chantiers simultanés
    const capacite = entreprise.capacites.techniques.capaciteChantierSimultane;
    const effectif = entreprise.capacites.humaines.effectifProductif;

    // Estimation de disponibilité (simplifié)
    let disponible = effectif >= 5; // Entreprise avec effectif suffisant

    let points = 0;
    if (disponible) {
      if (urgence === 'normale') points = config.pointsMax;
      else if (urgence === 'urgente') points = capacite >= 3 ? config.pointsMax : config.pointsMax * 0.7;
      else points = capacite >= 5 ? config.pointsMax : config.pointsMax * 0.5;
    }

    return {
      critere: 'disponibilite',
      poids: config.poids,
      pointsMax: config.pointsMax,
      pointsObtenus: Math.round(points),
      details: `Capacité: ${capacite} chantiers simultanés`,
    };
  }

  private static scoreReactivite(entreprise: Entreprise): ScoreCritere {
    const config = PONDERATIONS_SCORING_DEFAUT.reactivite;

    // Basé sur l'historique TORP (si disponible)
    const historique = entreprise.reputation.historiqueTORP;

    let points = config.pointsMax * 0.5; // Score par défaut

    if (historique) {
      // Bonus si bon taux de recommandation
      if (historique.tauxRecommandation >= 0.9) points = config.pointsMax;
      else if (historique.tauxRecommandation >= 0.8) points = config.pointsMax * 0.8;
      else if (historique.tauxRecommandation >= 0.7) points = config.pointsMax * 0.6;
    }

    return {
      critere: 'reactivite',
      poids: config.poids,
      pointsMax: config.pointsMax,
      pointsObtenus: Math.round(points),
      details: historique
        ? `Taux recommandation TORP: ${(historique.tauxRecommandation * 100).toFixed(0)}%`
        : 'Nouvelle entreprise sur TORP',
    };
  }

  private static calculateScoreGlobal(
    scores: ScoreCritere[],
    ponderations: Record<CritereScoring, { poids: number; pointsMax: number }>
  ): number {
    // Calcul pondéré normalisé
    let totalPoids = 0;
    let totalScore = 0;

    scores.forEach((s) => {
      const config = ponderations[s.critere];
      if (config) {
        const scoreNormalise = (s.pointsObtenus / config.pointsMax) * 100;
        totalScore += scoreNormalise * config.poids;
        totalPoids += config.poids;
      }
    });

    return totalPoids > 0 ? Math.round(totalScore / totalPoids) : 0;
  }

  private static determineRecommandation(
    score: number,
    entreprise: Entreprise
  ): RecommandationEntreprise {
    // Critères éliminatoires
    const hasValidInsurance = entreprise.assurances.some(
      (a) => a.type === 'rc_decennale' && a.enCours
    );
    if (!hasValidInsurance) return 'non_recommande';

    // Si procédure collective active
    if (entreprise.capacites.financieres.procedureCollective) {
      if (entreprise.capacites.financieres.typeProcedure === 'liquidation') {
        return 'non_recommande';
      }
      return 'a_etudier';
    }

    // Basé sur le score
    if (score >= SEUILS_RECOMMANDATION.fortement_recommande) return 'fortement_recommande';
    if (score >= SEUILS_RECOMMANDATION.recommande) return 'recommande';
    return 'a_etudier';
  }

  // =============================================================================
  // MÉTHODES PRIVÉES - RECHERCHE
  // =============================================================================

  private static buildScoringParams(
    project: Phase0Project,
    filtres?: EntrepriseMatchingInput['filtres']
  ): ParametresScoring {
    const lots = project.selectedLots || [];
    const typeTravaux = lots.map((l) => l.type);

    // Déterminer si RGE requis
    const lotsEnergie = [
      'isolation_thermique',
      'chauffage',
      'menuiseries_exterieures',
      'ventilation',
      'photovoltaique',
    ];
    const exigenceRGE = filtres?.rgeObligatoire ??
      lots.some((l) => lotsEnergie.includes(l.type));

    return {
      projetId: project.id,
      localisation: project.property?.address || {
        street: '',
        postalCode: '',
        city: '',
        country: 'France',
      },
      typeTravaux,
      budgetEstime: project.workProject?.budget?.totalEnvelope || { min: 10000, max: 100000 },
      urgence: project.workProject?.constraints?.temporal?.isUrgent
        ? 'urgente'
        : 'normale',
      exigenceRGE,
    };
  }

  private static buildSearchCriteria(
    project: Phase0Project,
    rayonKm: number,
    filtres?: EntrepriseMatchingInput['filtres']
  ): CriteresRechercheEntreprise {
    const lots = project.selectedLots || [];

    // Mapper les lots vers les corps de métier
    const corpsMetier = this.mapLotsToCorpsMetier(lots);

    return {
      localisation: {
        adresse: project.property?.address || {
          street: '',
          postalCode: '',
          city: '',
          country: 'France',
        },
        rayonKm,
      },
      corpsMetier,
      budgetProjet: project.workProject?.budget?.totalEnvelope,
      rgeObligatoire: filtres?.rgeObligatoire,
      filtres: {
        noteMinimale: filtres?.noteMinimale,
        assurancesAJour: true,
        disponibiliteSous: filtres?.disponibiliteSousJours,
      },
      tri: {
        critere: 'score',
        ordre: 'desc',
      },
    };
  }

  private static mapLotsToCorpsMetier(lots: SelectedLot[]): CorpsMetier[] {
    const mapping: Record<string, CorpsMetier> = {
      demolition: 'demolition',
      gros_oeuvre: 'maconnerie',
      maconnerie: 'maconnerie',
      charpente: 'charpente',
      couverture: 'couverture',
      etancheite: 'etancheite',
      menuiseries_exterieures: 'menuiserie_exterieure',
      menuiseries_interieures: 'menuiserie_interieure',
      electricite: 'electricite',
      plomberie: 'plomberie',
      chauffage: 'chauffage',
      climatisation: 'climatisation',
      ventilation: 'ventilation',
      isolation_thermique: 'isolation',
      cloisons_doublages: 'platrerie',
      carrelage_faience: 'carrelage',
      parquet_sols_souples: 'parquet',
      peinture: 'peinture',
    };

    const corpsMetier: CorpsMetier[] = [];
    lots.forEach((lot) => {
      const corps = mapping[lot.type];
      if (corps && !corpsMetier.includes(corps)) {
        corpsMetier.push(corps);
      }
    });

    return corpsMetier;
  }

  private static async searchEntreprises(
    criteres: CriteresRechercheEntreprise
  ): Promise<Entreprise[]> {
    // Pour l'instant, retourner des données mockées
    // En production, cela utiliserait Supabase et/ou des APIs externes
    return this.getMockEntreprises(criteres);
  }

  private static estimateDistance(from: Address, to: Address): number {
    // Estimation simplifiée basée sur les codes postaux
    // En production, utiliser une API de géocodage
    const cp1 = parseInt(from.postalCode?.substring(0, 2) || '75');
    const cp2 = parseInt(to.postalCode?.substring(0, 2) || '75');

    if (from.postalCode === to.postalCode) return 5;
    if (cp1 === cp2) return 20;
    if (Math.abs(cp1 - cp2) <= 5) return 40;
    return 80;
  }

  // =============================================================================
  // PERSISTANCE
  // =============================================================================

  static async getEntrepriseById(id: string): Promise<Entreprise | null> {
    const { data, error } = await supabase
      .from('phase1_entreprises')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw new Error(`Erreur lors de la récupération de l'entreprise: ${error.message}`);
    }

    return this.mapRowToEntreprise(data);
  }

  static async saveEntreprise(entreprise: Entreprise): Promise<void> {
    const { error } = await supabase.from('phase1_entreprises').upsert({
      id: entreprise.id,
      identification: entreprise.identification,
      contact: entreprise.contact,
      qualifications: entreprise.qualifications,
      assurances: entreprise.assurances,
      references: entreprise.references,
      capacites: entreprise.capacites,
      reputation: entreprise.reputation,
      score_torp: entreprise.scoreTORP,
      metadata: entreprise.metadata,
    });

    if (error) {
      throw new Error(`Erreur lors de la sauvegarde de l'entreprise: ${error.message}`);
    }
  }

  private static mapRowToEntreprise(row: Record<string, unknown>): Entreprise {
    return {
      id: row.id as string,
      identification: row.identification as EntrepriseIdentification,
      contact: row.contact as Entreprise['contact'],
      qualifications: row.qualifications as EntrepriseQualification[],
      assurances: row.assurances as EntrepriseAssurance[],
      references: row.references as EntrepriseReference[],
      capacites: row.capacites as EntrepriseCapacites,
      reputation: row.reputation as EntrepriseReputation,
      scoreTORP: row.score_torp as ScoreEntreprise | undefined,
      metadata: row.metadata as Entreprise['metadata'],
    };
  }

  // =============================================================================
  // DONNÉES MOCK (pour démonstration)
  // =============================================================================

  private static getMockEntreprises(_criteres: CriteresRechercheEntreprise): Entreprise[] {
    return [
      this.createMockEntreprise('1', 'Rénovation Plus', 'Paris', 4.5, 85),
      this.createMockEntreprise('2', 'Bâti Services', 'Lyon', 4.2, 78),
      this.createMockEntreprise('3', 'Pro Réno', 'Marseille', 4.0, 72),
      this.createMockEntreprise('4', 'Artisans Réunis', 'Bordeaux', 3.8, 65),
      this.createMockEntreprise('5', 'Travaux Express', 'Nantes', 4.3, 80),
    ];
  }

  private static createMockEntreprise(
    id: string,
    nom: string,
    ville: string,
    note: number,
    score: number
  ): Entreprise {
    const now = new Date().toISOString();
    const futureDate = new Date();
    futureDate.setFullYear(futureDate.getFullYear() + 1);

    return {
      id,
      identification: {
        raisonSociale: nom,
        formeJuridique: 'sarl',
        siret: `${Math.random().toString().slice(2, 16)}`,
        adresse: {
          street: `${Math.floor(Math.random() * 100)} rue du Commerce`,
          postalCode: '75015',
          city: ville,
          country: 'France',
        },
      },
      contact: {
        nomContact: `M. ${nom.split(' ')[0]}`,
        fonction: 'Gérant',
        email: `contact@${nom.toLowerCase().replace(/\s/g, '')}.fr`,
        telephone: '01 23 45 67 89',
      },
      qualifications: [
        {
          id: `qual-${id}-1`,
          type: 'qualibat',
          organisme: 'Qualibat',
          designation: 'Qualibat 2111 - Maçonnerie',
          niveau: 'technicite_confirmee',
          dateObtention: '2020-01-15',
          dateExpiration: futureDate.toISOString(),
          enCours: true,
          verifie: true,
        },
        {
          id: `qual-${id}-2`,
          type: 'rge',
          organisme: 'Qualibat',
          designation: 'RGE - Isolation des murs',
          dateObtention: '2021-06-01',
          dateExpiration: futureDate.toISOString(),
          enCours: true,
          verifie: true,
        },
      ],
      assurances: [
        {
          id: `ass-${id}-1`,
          type: 'rc_decennale',
          compagnie: 'AXA',
          numeroContrat: `DEC-${id}-2024`,
          montantGaranti: 500000,
          activitesCouvertes: ['Maçonnerie', 'Isolation', 'Rénovation'],
          dateDebut: '2024-01-01',
          dateFin: futureDate.toISOString(),
          enCours: true,
          verifie: true,
        },
        {
          id: `ass-${id}-2`,
          type: 'rc_professionnelle',
          compagnie: 'AXA',
          numeroContrat: `RCP-${id}-2024`,
          montantGaranti: 300000,
          activitesCouvertes: ['Tous travaux'],
          dateDebut: '2024-01-01',
          dateFin: futureDate.toISOString(),
          enCours: true,
          verifie: true,
        },
      ],
      references: [
        {
          id: `ref-${id}-1`,
          client: {
            nom: 'M. Dupont',
            type: 'particulier',
            temoignageAutorise: true,
          },
          projet: {
            titre: 'Rénovation appartement 80m²',
            description: 'Rénovation complète',
            type: 'renovation_complete',
            surface: 80,
            lotsRealises: ['electricite', 'plomberie', 'peinture'],
          },
          montantHT: 45000,
          dateDebut: '2023-03-01',
          dateFin: '2023-06-15',
          delaiReel: 105,
          delaiPrevu: 90,
          noteClient: 4,
          reservesLevees: true,
          litiges: false,
          verifie: true,
        },
      ],
      capacites: {
        financieres: {
          chiffreAffaires: 800000,
          anneeCA: 2023,
          procedureCollective: false,
        },
        humaines: {
          effectifTotal: 12,
          effectifProductif: 10,
          effectifAdministratif: 2,
          effectifEncadrement: 2,
        },
        techniques: {
          corpsMetier: ['maconnerie', 'isolation', 'peinture'],
          outillage: ['Standard', 'Spécifique isolation'],
          enginsPropriete: ['Camionnette', 'Échafaudage'],
          enginsLocation: ['Nacelle'],
          capaciteChantierSimultane: 3,
        },
        geographiques: {
          rayonIntervention: 50,
          departementsIntervention: ['75', '92', '93', '94'],
          regionsIntervention: ['Île-de-France'],
        },
      },
      reputation: {
        avisGoogle: {
          plateforme: 'Google',
          note,
          nombreAvis: Math.floor(Math.random() * 50) + 10,
          dateRecuperation: now,
        },
        noteGlobaleTORP: note,
        historiqueTORP: {
          chantiersRealises: Math.floor(Math.random() * 20) + 5,
          notesMoyennes: note,
          tauxLitiges: 0.02,
          tauxRecommandation: 0.85,
        },
      },
      metadata: {
        source: 'inscription_directe',
        dateCreation: '2020-01-01',
        dateModification: now,
        verifiee: true,
        niveauVerification: 'verification_complete',
        derniereMAJ: now,
        actif: true,
      },
    };
  }
}

// =============================================================================
// TYPES EXPORTS
// =============================================================================

interface VerificationResult {
  type: 'kbis' | 'assurances' | 'qualifications';
  status: 'verified' | 'pending' | 'expired' | 'failed';
  message: string;
  date: string;
}

export default EntrepriseService;
