/**
 * TORP Phase 1 - Service Entreprises (Production)
 * Module 1.2 : Recherche et Qualification des Entreprises
 *
 * VERSION PRODUCTION - ZÉRO MOCK
 * Utilise Supabase pour la persistance et les APIs externes pour l'enrichissement
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
  CorpsMetier,
  PONDERATIONS_SCORING_DEFAUT,
  SEUILS_RECOMMANDATION,
} from '@/types/phase1/entreprise.types';

// =============================================================================
// TYPES
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
  source: 'database' | 'api' | 'empty';
}

export interface ScoringResult {
  entreprise: Entreprise;
  score: ScoreEntreprise;
}

interface VerificationResult {
  type: 'kbis' | 'assurances' | 'qualifications';
  status: 'verified' | 'pending' | 'expired' | 'failed';
  message: string;
  date: string;
}

interface CompanyDBRow {
  id: string;
  siret: string;
  siren: string;
  denomination: string;
  forme_juridique?: string;
  adresse_siege?: string;
  code_postal?: string;
  ville?: string;
  departement?: string;
  telephone?: string;
  email?: string;
  site_web?: string;
  code_naf?: string;
  activite_principale?: string;
  specialites: string[];
  zones_intervention: string[];
  capital_social?: number;
  chiffre_affaires?: number;
  ca_annee?: number;
  effectif?: number;
  date_creation?: string;
  qualifications: any[];
  certifications: any[];
  assurance_decennale?: any;
  assurance_rc_pro?: any;
  avis_google?: any;
  historique_torp?: any;
  score_torp?: number;
  score_details?: any;
  verified: boolean;
  last_enriched_at?: string;
}

// =============================================================================
// SERVICE
// =============================================================================

export class EntrepriseService {
  /**
   * Recherche et score les entreprises correspondant au projet
   * Utilise la base de données Supabase, puis enrichit si nécessaire via APIs
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

      // 1. Rechercher les entreprises en base de données
      const entreprisesDB = await this.searchEntreprisesFromDB(criteres, limiteResultats * 2);

      if (entreprisesDB.length === 0) {
        // Aucune entreprise trouvée
        return {
          success: true,
          entreprises: [],
          totalTrouvees: 0,
          parametresUtilises: parametres,
          tempsRecherche: Date.now() - startTime,
          source: 'empty',
        };
      }

      // 2. Scorer chaque entreprise
      const entreprisesAvecsScores = await Promise.all(
        entreprisesDB.map(async (e) => this.scoreEntreprise(e, parametres))
      );

      // 3. Trier par score décroissant
      entreprisesAvecsScores.sort((a, b) => b.score.scoreGlobal - a.score.scoreGlobal);

      // 4. Limiter les résultats
      const topEntreprises = entreprisesAvecsScores.slice(0, limiteResultats);

      // 5. Attacher le score à chaque entreprise
      const entreprisesFinales = topEntreprises.map(({ entreprise, score }) => ({
        ...entreprise,
        scoreTORP: score,
      }));

      return {
        success: true,
        entreprises: entreprisesFinales,
        totalTrouvees: entreprisesDB.length,
        parametresUtilises: parametres,
        tempsRecherche: Date.now() - startTime,
        source: 'database',
      };
    } catch (error) {
      console.error('[Entreprise] Matching error:', error);
      return {
        success: false,
        entreprises: [],
        totalTrouvees: 0,
        parametresUtilises: this.buildScoringParams(project),
        tempsRecherche: Date.now() - startTime,
        source: 'empty',
      };
    }
  }

  /**
   * Recherche d'entreprises dans la base de données Supabase
   */
  private static async searchEntreprisesFromDB(
    criteres: CriteresRechercheEntreprise,
    limit: number
  ): Promise<Entreprise[]> {
    try {
      let query = supabase
        .from('companies')
        .select('*')
        .order('score_torp', { ascending: false, nullsFirst: false });

      // Filtre par département
      const departement = criteres.localisation.adresse.postalCode?.substring(0, 2);
      if (departement) {
        query = query.eq('departement', departement);
      }

      // Filtre par spécialités (corps de métier)
      if (criteres.corpsMetier && criteres.corpsMetier.length > 0) {
        // Recherche dans le tableau specialites
        query = query.overlaps('specialites', criteres.corpsMetier);
      }

      // Filtre RGE si requis
      if (criteres.rgeObligatoire) {
        query = query.contains('certifications', [{ type: 'RGE' }]);
      }

      // Filtre note minimale
      if (criteres.filtres?.noteMinimale) {
        query = query.gte('score_torp', criteres.filtres.noteMinimale);
      }

      // Limite
      query = query.limit(limit);

      const { data, error } = await query;

      if (error) {
        console.error('[Entreprise] Database search error:', error);
        return [];
      }

      if (!data || data.length === 0) {
        console.log('[Entreprise] No companies found in database for criteria:', criteres);
        return [];
      }

      // Mapper les données DB vers le format Entreprise
      return data.map((row) => this.mapDBRowToEntreprise(row as CompanyDBRow));
    } catch (error) {
      console.error('[Entreprise] Search error:', error);
      return [];
    }
  }

  /**
   * Recherche une entreprise par SIRET avec enrichissement API si nécessaire
   */
  static async findBySiret(siret: string): Promise<Entreprise | null> {
    // Valider le SIRET
    if (!siret || siret.length !== 14 || !/^\d{14}$/.test(siret)) {
      console.warn('[Entreprise] Invalid SIRET format:', siret);
      return null;
    }

    try {
      // 1. Chercher en base
      const { data: existing } = await supabase
        .from('companies')
        .select('*')
        .eq('siret', siret)
        .single();

      if (existing) {
        // Vérifier si enrichissement nécessaire (> 30 jours)
        const lastEnriched = existing.last_enriched_at
          ? new Date(existing.last_enriched_at)
          : null;
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        if (!lastEnriched || lastEnriched < thirtyDaysAgo) {
          // Enrichir en arrière-plan (ne pas bloquer)
          this.enrichCompanyAsync(existing.id, siret);
        }

        return this.mapDBRowToEntreprise(existing as CompanyDBRow);
      }

      // 2. Sinon, rechercher via API et créer
      const enrichedData = await this.fetchFromAPIs(siret);
      if (enrichedData) {
        const { data: created, error } = await supabase
          .from('companies')
          .insert(enrichedData)
          .select()
          .single();

        if (error) {
          console.error('[Entreprise] Error creating company:', error);
          return null;
        }

        return this.mapDBRowToEntreprise(created as CompanyDBRow);
      }

      return null;
    } catch (error) {
      console.error('[Entreprise] findBySiret error:', error);
      return null;
    }
  }

  /**
   * Enrichir une entreprise via les APIs externes
   */
  private static async fetchFromAPIs(siret: string): Promise<Partial<CompanyDBRow> | null> {
    const result: Partial<CompanyDBRow> = {
      siret,
      siren: siret.substring(0, 9),
      specialites: [],
      zones_intervention: [],
      qualifications: [],
      certifications: [],
    };

    // 1. API Recherche Entreprises (api.gouv.fr - gratuit, sans clé)
    try {
      const searchResponse = await fetch(
        `https://recherche-entreprises.api.gouv.fr/search?q=${siret}&per_page=1`
      );

      if (searchResponse.ok) {
        const searchData = await searchResponse.json();
        if (searchData.results && searchData.results.length > 0) {
          const entreprise = searchData.results[0];
          const siege = entreprise.siege;

          result.denomination = entreprise.nom_complet || entreprise.nom_raison_sociale || 'Non spécifié';
          result.forme_juridique = entreprise.nature_juridique;
          result.adresse_siege = siege?.adresse || siege?.geo_adresse;
          result.code_postal = siege?.code_postal;
          result.ville = siege?.libelle_commune;
          result.departement = siege?.departement;
          result.code_naf = entreprise.activite_principale;
          result.activite_principale = entreprise.section_activite_principale;
          result.date_creation = entreprise.date_creation;
          result.effectif = entreprise.tranche_effectif_salarie_entreprise
            ? parseInt(entreprise.tranche_effectif_salarie_entreprise)
            : undefined;

          // Dirigeants si disponibles
          if (entreprise.dirigeants && entreprise.dirigeants.length > 0) {
            const dirigeant = entreprise.dirigeants[0];
            // Stocker dans un champ approprié si nécessaire
          }
        }
      }
    } catch (error) {
      console.warn('[Entreprise] API recherche-entreprises error:', error);
    }

    // 2. API ADEME RGE (gratuit, sans clé)
    try {
      const rgeResponse = await fetch(
        `https://data.ademe.fr/data-fair/api/v1/datasets/liste-des-entreprises-rge-2/lines?siret=${siret}`
      );

      if (rgeResponse.ok) {
        const rgeData = await rgeResponse.json();
        if (rgeData.results && rgeData.results.length > 0) {
          result.certifications = rgeData.results.map((rge: any) => ({
            type: 'RGE',
            nom: rge.nom_qualification || 'RGE',
            organisme: rge.organisme || 'ADEME',
            domaine: rge.domaine || 'Énergie',
            validite_fin: rge.date_fin_validite,
          }));
        }
      }
    } catch (error) {
      console.warn('[Entreprise] ADEME RGE API error:', error);
    }

    // 3. Calculer le score initial
    result.score_torp = this.calculateInitialScore(result);
    result.score_details = this.calculateScoreDetails(result);
    result.last_enriched_at = new Date().toISOString();
    result.verified = false;

    return result.denomination ? result : null;
  }

  /**
   * Enrichir une entreprise en arrière-plan (async)
   */
  private static async enrichCompanyAsync(companyId: string, siret: string): Promise<void> {
    try {
      const enriched = await this.fetchFromAPIs(siret);
      if (enriched) {
        await supabase
          .from('companies')
          .update({
            ...enriched,
            id: undefined, // Ne pas écraser l'ID
          })
          .eq('id', companyId);
      }
    } catch (error) {
      console.warn('[Entreprise] Background enrichment failed:', error);
    }
  }

  /**
   * Calcul du score TORP initial (0-100)
   */
  private static calculateInitialScore(company: Partial<CompanyDBRow>): number {
    let score = 50; // Base

    // Qualifications (+20 max)
    if (company.qualifications && company.qualifications.length > 0) {
      score += Math.min(company.qualifications.length * 5, 20);
    }

    // Certifications RGE (+15)
    if (company.certifications?.some((c: any) => c.type === 'RGE')) {
      score += 15;
    }

    // Ancienneté (+10 max)
    if (company.date_creation) {
      const age = new Date().getFullYear() - new Date(company.date_creation).getFullYear();
      score += Math.min(age, 10);
    }

    // Effectif (+5)
    if (company.effectif && company.effectif >= 5) {
      score += 5;
    }

    return Math.min(score, 100);
  }

  /**
   * Détail du score par dimension
   */
  private static calculateScoreDetails(company: Partial<CompanyDBRow>): Record<string, number> {
    return {
      qualifications: company.qualifications?.length ? 70 + Math.min(company.qualifications.length * 5, 30) : 50,
      experience: company.date_creation
        ? Math.min(50 + (new Date().getFullYear() - new Date(company.date_creation).getFullYear()) * 3, 100)
        : 50,
      finances: company.chiffre_affaires ? 70 : 50,
      reputation: 60, // À enrichir avec avis Google
      proximite: 80, // À calculer selon distance
    };
  }

  /**
   * Mapper une ligne DB vers le format Entreprise
   */
  private static mapDBRowToEntreprise(row: CompanyDBRow): Entreprise {
    const now = new Date().toISOString();

    // Mapper qualifications
    const qualifications: EntrepriseQualification[] = [
      ...(row.qualifications || []).map((q: any) => ({
        id: q.id || `qual-${row.id}-${Math.random().toString(36).substring(7)}`,
        type: q.type || 'qualibat',
        organisme: q.organisme || 'Qualibat',
        designation: q.libelle || q.designation || q.nom || 'Non spécifié',
        niveau: q.niveau,
        dateObtention: q.validite_debut || q.date_obtention,
        dateExpiration: q.validite_fin || q.date_expiration,
        enCours: q.validite_fin ? new Date(q.validite_fin) > new Date() : true,
        verifie: row.verified,
      })),
      ...(row.certifications || []).map((c: any) => ({
        id: c.id || `cert-${row.id}-${Math.random().toString(36).substring(7)}`,
        type: c.type?.toLowerCase() === 'rge' ? 'rge' : 'autre',
        organisme: c.organisme || 'ADEME',
        designation: c.nom || c.designation || 'RGE',
        domaine: c.domaine,
        dateExpiration: c.validite_fin,
        enCours: c.validite_fin ? new Date(c.validite_fin) > new Date() : true,
        verifie: row.verified,
      })),
    ];

    // Mapper assurances
    const assurances: EntrepriseAssurance[] = [];
    if (row.assurance_decennale) {
      assurances.push({
        id: `ass-dec-${row.id}`,
        type: 'rc_decennale',
        compagnie: row.assurance_decennale.assureur || 'Non spécifié',
        numeroContrat: row.assurance_decennale.numero,
        montantGaranti: row.assurance_decennale.montant_garanti,
        activitesCouvertes: row.assurance_decennale.activites_couvertes || [],
        dateFin: row.assurance_decennale.validite_fin,
        enCours: row.assurance_decennale.validite_fin
          ? new Date(row.assurance_decennale.validite_fin) > new Date()
          : false,
        verifie: row.verified,
      });
    }
    if (row.assurance_rc_pro) {
      assurances.push({
        id: `ass-rc-${row.id}`,
        type: 'rc_professionnelle',
        compagnie: row.assurance_rc_pro.assureur || 'Non spécifié',
        numeroContrat: row.assurance_rc_pro.numero,
        dateFin: row.assurance_rc_pro.validite_fin,
        enCours: row.assurance_rc_pro.validite_fin
          ? new Date(row.assurance_rc_pro.validite_fin) > new Date()
          : false,
        verifie: row.verified,
      });
    }

    // Construire l'objet Entreprise
    return {
      id: row.id,
      identification: {
        raisonSociale: row.denomination || 'Non spécifié',
        formeJuridique: (row.forme_juridique as any) || 'autre',
        siret: row.siret,
        adresse: {
          street: row.adresse_siege || '',
          postalCode: row.code_postal || '',
          city: row.ville || '',
          country: 'France',
        },
      },
      contact: {
        email: row.email,
        telephone: row.telephone,
        siteWeb: row.site_web,
      },
      qualifications,
      assurances,
      references: [], // À charger séparément si nécessaire
      capacites: {
        financieres: {
          chiffreAffaires: row.chiffre_affaires,
          anneeCA: row.ca_annee,
          capitalSocial: row.capital_social,
          procedureCollective: false,
        },
        humaines: {
          effectifTotal: row.effectif || 0,
          effectifProductif: Math.floor((row.effectif || 0) * 0.8),
          effectifAdministratif: Math.ceil((row.effectif || 0) * 0.2),
        },
        techniques: {
          corpsMetier: row.specialites || [],
          capaciteChantierSimultane: Math.max(1, Math.floor((row.effectif || 1) / 4)),
        },
        geographiques: {
          rayonIntervention: 50,
          departementsIntervention: row.departement ? [row.departement] : [],
          regionsIntervention: row.zones_intervention || [],
        },
      },
      reputation: {
        avisGoogle: row.avis_google
          ? {
              plateforme: 'Google',
              note: row.avis_google.note || 0,
              nombreAvis: row.avis_google.nombre_avis || 0,
              dateRecuperation: row.avis_google.date || now,
            }
          : undefined,
        noteGlobaleTORP: row.score_torp,
        historiqueTORP: row.historique_torp,
      },
      metadata: {
        source: 'database',
        dateCreation: row.date_creation || now,
        dateModification: now,
        verifiee: row.verified,
        niveauVerification: row.verified ? 'verification_complete' : 'non_verifie',
        derniereMAJ: row.last_enriched_at || now,
        actif: true,
      },
    };
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
    const now = new Date().toISOString();

    // Vérification SIRET via API
    const siretValid = entreprise.identification.siret?.length === 14;
    verifications.push({
      type: 'kbis',
      status: siretValid && entreprise.metadata.verifiee ? 'verified' : 'pending',
      message: siretValid
        ? entreprise.metadata.verifiee
          ? 'Entreprise vérifiée'
          : 'Vérification en cours'
        : 'SIRET invalide',
      date: now,
    });

    // Vérification assurances
    const hasValidDecennale = entreprise.assurances.some(
      (a) => a.type === 'rc_decennale' && a.enCours
    );
    verifications.push({
      type: 'assurances',
      status: hasValidDecennale ? 'verified' : 'expired',
      message: hasValidDecennale
        ? 'Assurance décennale à jour'
        : 'Assurance décennale manquante ou expirée',
      date: now,
    });

    // Vérification qualifications
    const hasValidQualifications = entreprise.qualifications.some((q) => q.enCours);
    verifications.push({
      type: 'qualifications',
      status: hasValidQualifications ? 'verified' : 'pending',
      message: hasValidQualifications
        ? `${entreprise.qualifications.filter((q) => q.enCours).length} qualification(s) valide(s)`
        : 'Aucune qualification valide',
      date: now,
    });

    const verified = verifications.every((v) => v.status === 'verified');

    return { verified, verifications };
  }

  // =============================================================================
  // MÉTHODES PRIVÉES - SCORING
  // =============================================================================

  private static scoreQualificationRGE(
    entreprise: Entreprise,
    _parametres: ParametresScoring
  ): ScoreCritere {
    const config = PONDERATIONS_SCORING_DEFAUT.qualification_rge;
    const rgeQualifications = entreprise.qualifications.filter(
      (q) => q.type === 'rge' && q.enCours
    );

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

    if (rcDecennale?.enCours) {
      points += config.pointsMax * 0.6;
      details.push('RC Décennale à jour');
    } else {
      details.push('RC Décennale manquante ou expirée');
    }

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
    const references = entreprise.references || [];

    // Filtrer références similaires
    const referencesSimiliaires = references.filter((ref) => {
      const dateFin = new Date(ref.dateFin);
      const cinqAnsAgo = new Date();
      cinqAnsAgo.setFullYear(cinqAnsAgo.getFullYear() - 5);
      if (dateFin < cinqAnsAgo) return false;

      const budgetMin = (parametres.budgetEstime?.min || 10000) * 0.5;
      const budgetMax = (parametres.budgetEstime?.max || 100000) * 1.5;
      if (ref.montantHT < budgetMin || ref.montantHT > budgetMax) return false;

      return true;
    });

    let points = 0;
    const count = referencesSimiliaires.length;

    if (count >= 5) points = config.pointsMax;
    else if (count >= 3) points = config.pointsMax * 0.8;
    else if (count >= 2) points = config.pointsMax * 0.6;
    else if (count >= 1) points = config.pointsMax * 0.3;

    return {
      critere: 'references_similaires',
      poids: config.poids,
      pointsMax: config.pointsMax,
      pointsObtenus: Math.min(Math.round(points), config.pointsMax),
      details: count > 0 ? `${count} référence(s) similaire(s)` : 'Aucune référence',
    };
  }

  private static scoreChiffreAffaires(
    entreprise: Entreprise,
    parametres: ParametresScoring
  ): ScoreCritere {
    const config = PONDERATIONS_SCORING_DEFAUT.chiffre_affaires;
    const ca = entreprise.capacites.financieres.chiffreAffaires || 0;
    const budgetProjet = parametres.budgetEstime?.max || 50000;
    const caMinRecommande = budgetProjet * 2;

    let points = 0;
    if (ca >= caMinRecommande * 2) points = config.pointsMax;
    else if (ca >= caMinRecommande) points = config.pointsMax * 0.8;
    else if (ca >= caMinRecommande * 0.5) points = config.pointsMax * 0.5;
    else if (ca > 0) points = config.pointsMax * 0.2;

    if (entreprise.capacites.financieres.procedureCollective) {
      points *= 0.3;
    }

    return {
      critere: 'chiffre_affaires',
      poids: config.poids,
      pointsMax: config.pointsMax,
      pointsObtenus: Math.round(points),
      details: ca > 0
        ? `CA: ${(ca / 1000).toFixed(0)}k€`
        : 'Chiffre d\'affaires non renseigné',
    };
  }

  private static scoreProximite(
    entreprise: Entreprise,
    localisation: Address
  ): ScoreCritere {
    const config = PONDERATIONS_SCORING_DEFAUT.proximite;
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

    const notes: number[] = [];
    if (reputation.avisGoogle?.note) notes.push(reputation.avisGoogle.note);

    const noteMoyenne = notes.length > 0
      ? notes.reduce((a, b) => a + b, 0) / notes.length
      : 0;

    const nombreAvis = reputation.avisGoogle?.nombreAvis || 0;

    let points = 0;
    if (noteMoyenne >= 4.5) points = config.pointsMax;
    else if (noteMoyenne >= 4) points = config.pointsMax * 0.85;
    else if (noteMoyenne >= 3.5) points = config.pointsMax * 0.65;
    else if (noteMoyenne >= 3) points = config.pointsMax * 0.4;
    else if (noteMoyenne > 0) points = config.pointsMax * 0.2;

    if (nombreAvis >= 50) points *= 1.05;
    else if (nombreAvis < 10 && nombreAvis > 0) points *= 0.9;

    return {
      critere: 'avis_clients',
      poids: config.poids,
      pointsMax: config.pointsMax,
      pointsObtenus: Math.round(Math.min(points, config.pointsMax)),
      details: noteMoyenne > 0
        ? `Note: ${noteMoyenne.toFixed(1)}/5 (${nombreAvis} avis)`
        : 'Aucun avis disponible',
    };
  }

  private static scoreDisponibilite(
    entreprise: Entreprise,
    urgence: 'normale' | 'urgente' | 'tres_urgente'
  ): ScoreCritere {
    const config = PONDERATIONS_SCORING_DEFAUT.disponibilite;
    const capacite = entreprise.capacites.techniques.capaciteChantierSimultane || 1;
    const effectif = entreprise.capacites.humaines.effectifProductif || 0;

    const disponible = effectif >= 2;

    let points = 0;
    if (disponible) {
      if (urgence === 'normale') points = config.pointsMax;
      else if (urgence === 'urgente') points = capacite >= 3 ? config.pointsMax : config.pointsMax * 0.7;
      else points = capacite >= 5 ? config.pointsMax : config.pointsMax * 0.5;
    } else {
      points = config.pointsMax * 0.3;
    }

    return {
      critere: 'disponibilite',
      poids: config.poids,
      pointsMax: config.pointsMax,
      pointsObtenus: Math.round(points),
      details: `Capacité: ${capacite} chantier(s) simultané(s)`,
    };
  }

  private static scoreReactivite(entreprise: Entreprise): ScoreCritere {
    const config = PONDERATIONS_SCORING_DEFAUT.reactivite;
    const historique = entreprise.reputation.historiqueTORP;

    let points = config.pointsMax * 0.5;

    if (historique) {
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
    const hasValidInsurance = entreprise.assurances.some(
      (a) => a.type === 'rc_decennale' && a.enCours
    );
    if (!hasValidInsurance) return 'non_recommande';

    if (entreprise.capacites.financieres.procedureCollective) {
      if (entreprise.capacites.financieres.typeProcedure === 'liquidation') {
        return 'non_recommande';
      }
      return 'a_etudier';
    }

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

  private static estimateDistance(from: Address, to: Address): number {
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
      .from('companies')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      console.error('[Entreprise] Get by ID error:', error);
      return null;
    }

    return this.mapDBRowToEntreprise(data as CompanyDBRow);
  }

  static async saveEntreprise(entreprise: Entreprise): Promise<void> {
    const dbRow: Partial<CompanyDBRow> = {
      id: entreprise.id,
      siret: entreprise.identification.siret,
      siren: entreprise.identification.siret?.substring(0, 9),
      denomination: entreprise.identification.raisonSociale,
      forme_juridique: entreprise.identification.formeJuridique,
      adresse_siege: entreprise.identification.adresse.street,
      code_postal: entreprise.identification.adresse.postalCode,
      ville: entreprise.identification.adresse.city,
      departement: entreprise.identification.adresse.postalCode?.substring(0, 2),
      telephone: entreprise.contact?.telephone,
      email: entreprise.contact?.email,
      site_web: entreprise.contact?.siteWeb,
      specialites: entreprise.capacites.techniques.corpsMetier || [],
      chiffre_affaires: entreprise.capacites.financieres.chiffreAffaires,
      effectif: entreprise.capacites.humaines.effectifTotal,
      qualifications: entreprise.qualifications.filter(q => q.type === 'qualibat'),
      certifications: entreprise.qualifications.filter(q => q.type === 'rge'),
      score_torp: entreprise.scoreTORP?.scoreGlobal,
      verified: entreprise.metadata.verifiee,
    };

    const { error } = await supabase.from('companies').upsert(dbRow);

    if (error) {
      throw new Error(`Erreur lors de la sauvegarde de l'entreprise: ${error.message}`);
    }
  }
}

export default EntrepriseService;
