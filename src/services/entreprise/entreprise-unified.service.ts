/**
 * Service unifié de récupération des données entreprise
 *
 * Stratégie :
 * 1. Sirene INSEE (gratuit) → données de base
 * 2. Pappers (payant) → enrichissement financier si demandé
 * 3. Fallback Pappers si Sirene échoue
 */

import { sireneService, SireneEntreprise } from '@/services/api/sirene.service';
import {
  pappersService,
  EntrepriseEnrichie,
  PappersEntreprise,
  PappersFinances,
  PappersLabel,
  PappersProcedure,
} from '@/services/api/pappers.service';

export interface EntrepriseUnifiee extends EntrepriseEnrichie {
  // Données de base toujours présentes
}

export interface GetEntrepriseOptions {
  // Enrichissement Pappers (coûte des jetons)
  enrichirFinances?: boolean;
  enrichirDirigeants?: boolean;
  enrichirLabels?: boolean;  // Important pour BTP (RGE, etc.)
  enrichirScoring?: boolean;
  enrichirProcedures?: boolean;

  // Forcer une source
  forcerSource?: 'sirene' | 'pappers';

  // Fallback
  fallbackSiEchec?: boolean; // true par défaut
}

export interface GetEntrepriseResult {
  success: boolean;
  data?: EntrepriseUnifiee;
  error?: string;
  sources: {
    sirene: { used: boolean; success: boolean; error?: string };
    pappers: { used: boolean; success: boolean; error?: string };
  };
}

class EntrepriseUnifiedService {

  /**
   * Récupère les données entreprise avec la stratégie optimale
   *
   * @param siretOrSiren SIRET (14 chiffres) ou SIREN (9 chiffres)
   * @param options Options d'enrichissement
   */
  async getEntreprise(
    siretOrSiren: string,
    options: GetEntrepriseOptions = {}
  ): Promise<GetEntrepriseResult> {
    const {
      enrichirFinances = false,
      enrichirDirigeants = true,
      enrichirLabels = true, // Important BTP
      enrichirScoring = false,
      enrichirProcedures = false,
      forcerSource,
      fallbackSiEchec = true,
    } = options;

    const sources = {
      sirene: { used: false, success: false, error: undefined as string | undefined },
      pappers: { used: false, success: false, error: undefined as string | undefined },
    };

    let entrepriseBase: SireneEntreprise | null = null;
    let entreprisePappers: PappersEntreprise | null = null;

    // Déterminer si on a besoin d'enrichissement Pappers
    const needsEnrichment = enrichirFinances || enrichirScoring || enrichirProcedures;

    // ==========================================
    // ÉTAPE 1 : Données de base (Sirene ou Pappers)
    // ==========================================

    if (forcerSource !== 'pappers' && sireneService.isConfigured()) {
      // Essayer Sirene d'abord (gratuit)
      sources.sirene.used = true;

      const cleaned = siretOrSiren.replace(/\s/g, '');
      const isSiret = cleaned.length === 14;

      let sireneResult;
      if (isSiret) {
        sireneResult = await sireneService.getEtablissementBySiret(cleaned);
      } else {
        sireneResult = await sireneService.getUniteLegaleBySiren(cleaned);
      }

      if (sireneResult.success && sireneResult.data) {
        sources.sirene.success = true;
        entrepriseBase = sireneResult.data as SireneEntreprise;
        console.log('[EntrepriseUnified] Sirene OK:', entrepriseBase.raisonSociale);
      } else {
        sources.sirene.error = sireneResult.error;
        console.log('[EntrepriseUnified] Sirene échec:', sireneResult.error);
      }
    }

    // Si Sirene a échoué et fallback activé, ou si forcé Pappers
    if ((!entrepriseBase && fallbackSiEchec) || forcerSource === 'pappers') {
      if (pappersService.isConfigured()) {
        sources.pappers.used = true;

        const pappersResult = await pappersService.getEntreprise(siretOrSiren, {
          includeFinances: enrichirFinances,
          includeRepresentants: enrichirDirigeants,
          includeLabels: enrichirLabels,
          includeScoring: enrichirScoring,
          includeProcedures: enrichirProcedures,
        });

        if (pappersResult.success && pappersResult.data) {
          sources.pappers.success = true;
          entreprisePappers = pappersResult.data;
          console.log('[EntrepriseUnified] Pappers OK:', entreprisePappers.nom_entreprise || entreprisePappers.denomination);

          // Si pas de données Sirene, utiliser Pappers comme base
          if (!entrepriseBase) {
            const enrichie = pappersService.mapToEntrepriseEnrichie(entreprisePappers);
            enrichie.sourceDetails.sirene = false;
            enrichie.sourceDetails.pappers = true;
            enrichie.source = 'pappers';

            return {
              success: true,
              data: enrichie,
              sources,
            };
          }
        } else {
          sources.pappers.error = pappersResult.error;
          console.log('[EntrepriseUnified] Pappers échec:', pappersResult.error);
        }
      }
    }

    // Aucune donnée obtenue
    if (!entrepriseBase && !entreprisePappers) {
      return {
        success: false,
        error: sources.sirene.error || sources.pappers.error || 'Aucune source disponible',
        sources,
      };
    }

    // ==========================================
    // ÉTAPE 2 : Enrichissement si demandé
    // ==========================================

    if (needsEnrichment && entrepriseBase && !entreprisePappers && pappersService.isConfigured()) {
      sources.pappers.used = true;

      const pappersResult = await pappersService.getEntreprise(siretOrSiren, {
        includeFinances: enrichirFinances,
        includeRepresentants: false, // Déjà dans Sirene
        includeLabels: enrichirLabels,
        includeScoring: enrichirScoring,
        includeProcedures: enrichirProcedures,
      });

      if (pappersResult.success && pappersResult.data) {
        sources.pappers.success = true;
        entreprisePappers = pappersResult.data;
        console.log('[EntrepriseUnified] Pappers enrichissement OK');
      } else {
        sources.pappers.error = pappersResult.error;
        console.log('[EntrepriseUnified] Pappers enrichissement échec:', pappersResult.error);
      }
    }

    // ==========================================
    // ÉTAPE 3 : Fusion des données
    // ==========================================

    const result = this.mergeData(entrepriseBase!, entreprisePappers);

    return {
      success: true,
      data: result,
      sources,
    };
  }

  /**
   * Fusionne les données Sirene et Pappers
   */
  private mergeData(
    sirene: SireneEntreprise,
    pappers: PappersEntreprise | null
  ): EntrepriseUnifiee {
    // Base Sirene
    const base: EntrepriseUnifiee = {
      siret: sirene.siret,
      siren: sirene.siren,

      raisonSociale: sirene.raisonSociale,
      nomCommercial: sirene.denominationUsuelle,
      sigle: sirene.sigle,

      formeJuridique: sirene.categorieJuridiqueLibelle,
      formeJuridiqueCode: sirene.categorieJuridique,

      codeNAF: sirene.codeNAF,
      libelleNAF: sirene.libelleNAF || pappers?.libelle_code_naf || null,
      domaineActivite: pappers?.domaine_activite || null,
      objetSocial: pappers?.objet_social || null,

      adresse: {
        ligne1: sirene.adresse.numeroVoie
          ? `${sirene.adresse.numeroVoie} ${sirene.adresse.typeVoie || ''} ${sirene.adresse.libelleVoie || ''}`.trim()
          : pappers?.siege?.adresse_ligne_1 || null,
        ligne2: sirene.adresse.complement || pappers?.siege?.adresse_ligne_2 || null,
        codePostal: sirene.adresse.codePostal || pappers?.siege?.code_postal || null,
        ville: sirene.adresse.commune || pappers?.siege?.ville || null,
        pays: 'France',
        latitude: pappers?.siege?.latitude || null,
        longitude: pappers?.siege?.longitude || null,
      },
      adresseComplete: sirene.adresseComplete,

      dateCreation: sirene.dateCreation,
      dateCreationFormatee: sirene.dateCreationFormatee || pappers?.date_creation_formate || null,
      ancienneteAnnees: sirene.ancienneteAnnees,

      estActif: sirene.estActif,
      dateCessation: pappers?.date_cessation || null,
      estEmployeur: pappers?.entreprise_employeuse ?? null,

      effectif: sirene.trancheEffectifLibelle || pappers?.effectif,
      effectifMin: pappers?.effectif_min || null,
      effectifMax: pappers?.effectif_max || null,
      trancheEffectif: sirene.trancheEffectif || pappers?.tranche_effectif || null,

      capital: pappers?.capital || null,
      capitalFormate: pappers?.capital_formate || null,

      // Données Pappers uniquement
      dernieresFinances: null,
      historiqueFinances: null,
      scoringFinancier: null,
      dirigeants: null,
      labelsRGE: null,
      labelsQualite: null,
      proceduresCollectives: null,
      aProcedureenCours: false,

      numeroTVA: pappers?.numero_tva_intracommunautaire || null,

      source: pappers ? 'combined' : 'sirene',
      sourceDetails: {
        sirene: true,
        pappers: !!pappers,
        pappersEnrichissement: !!pappers,
      },
    };

    // Enrichissement Pappers si disponible
    if (pappers) {
      // Finances
      if (pappers.finances && pappers.finances.length > 0) {
        const derniere = pappers.finances.sort((a, b) => b.annee - a.annee)[0];
        base.dernieresFinances = {
          annee: derniere.annee,
          chiffreAffaires: derniere.chiffre_affaires,
          chiffreAffairesFormate: derniere.chiffre_affaires
            ? this.formatMontant(derniere.chiffre_affaires)
            : null,
          resultat: derniere.resultat,
          resultatFormate: derniere.resultat
            ? this.formatMontant(derniere.resultat)
            : null,
          effectif: derniere.effectif,
        };
        base.historiqueFinances = pappers.finances;
      }

      // Scoring
      if (pappers.scoring_financier) {
        base.scoringFinancier = {
          score: pappers.scoring_financier.score,
          risque: pappers.scoring_financier.risque_defaillance,
          details: pappers.scoring_financier.details,
        };
      }

      // Dirigeants
      if (pappers.representants) {
        base.dirigeants = pappers.representants
          .filter(r => r.actuel)
          .slice(0, 5)
          .map(r => ({
            nom: r.nom,
            prenom: r.prenom,
            qualite: r.qualite,
            age: r.age,
          }));
      }

      // Labels (important BTP)
      if (pappers.labels) {
        base.labelsRGE = pappers.labels.labels_rge;
        base.labelsQualite = pappers.labels.labels_qualite;
      }

      // Procédures
      if (pappers.procedures_collectives) {
        base.proceduresCollectives = pappers.procedures_collectives;
        base.aProcedureenCours = pappers.procedures_collectives.some(p => !p.date_fin);
      }
    }

    return base;
  }

  private formatMontant(montant: number): string {
    if (Math.abs(montant) >= 1000000) {
      return `${(montant / 1000000).toFixed(1)} M€`;
    }
    if (Math.abs(montant) >= 1000) {
      return `${(montant / 1000).toFixed(0)} k€`;
    }
    return `${montant.toLocaleString('fr-FR')} €`;
  }

  /**
   * Vérifie quelles APIs sont configurées
   */
  getStatus(): {
    sirene: boolean;
    pappers: boolean;
    anyConfigured: boolean;
  } {
    const sirene = sireneService.isConfigured();
    const pappers = pappersService.isConfigured();

    return {
      sirene,
      pappers,
      anyConfigured: sirene || pappers,
    };
  }
}

export const entrepriseUnifiedService = new EntrepriseUnifiedService();
