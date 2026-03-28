import { log, warn, error, time, timeEnd } from '@/lib/logger';

/**
 * Service d'accès à l'API Pappers
 * Documentation : https://www.pappers.fr/api/documentation
 *
 * Utilisé en complément/fallback de l'API Sirene INSEE
 * - Sirene = données de base (gratuit)
 * - Pappers = enrichissement financier + documents (payant)
 *
 * Endpoints principaux :
 * - GET /entreprise : Fiche entreprise complète
 * - GET /recherche : Recherche multicritère
 * - GET /suggestions : Autocomplete
 * - GET /entreprise/comptes : Comptes annuels
 * - GET /document/* : Téléchargement documents
 */

const PAPPERS_API_URL = import.meta.env.VITE_PAPPERS_API_URL || 'https://api.pappers.fr/v2';
const PAPPERS_API_KEY = import.meta.env.VITE_PAPPERS_API_KEY;

// ============================================
// TYPES
// ============================================

export interface PappersEntreprise {
  siren: string;
  siren_formate: string;
  siret_siege: string;
  nom_entreprise: string | null;
  nom_commercial: string | null;
  denomination: string | null;
  sigle: string | null;

  // Forme juridique
  forme_juridique: string | null;
  forme_juridique_code: string | null;

  // Activité
  code_naf: string | null;
  libelle_code_naf: string | null;
  domaine_activite: string | null;
  objet_social: string | null;

  // Dates
  date_creation: string | null;
  date_creation_formate: string | null;
  date_immatriculation_rcs: string | null;
  date_radiation_rcs: string | null;

  // État
  entreprise_cessee: boolean;
  date_cessation: string | null;
  entreprise_employeuse: boolean | null;

  // Effectifs
  effectif: string | null;
  effectif_min: number | null;
  effectif_max: number | null;
  tranche_effectif: string | null;
  annee_effectif: number | null;

  // Capital
  capital: number | null;
  capital_formate: string | null;
  capital_actuel_si_variable: string | null;
  devise_capital: string | null;

  // Adresse siège
  siege: PappersEtablissement | null;

  // Dirigeants
  representants: PappersRepresentant[] | null;
  beneficiaires_effectifs: PappersBeneficiaire[] | null;

  // Finances (nécessite option)
  finances: PappersFinances[] | null;
  derniers_statuts: PappersDocument | null;

  // Scores Pappers
  scoring_financier: PappersScoringFinancier | null;
  scoring_non_financier: PappersScoringNonFinancier | null;

  // Labels et certifications
  labels: PappersLabels | null;

  // Procédures
  procedures_collectives: PappersProcedure[] | null;

  // Divers
  numero_tva_intracommunautaire: string | null;
  greffe: string | null;
  numero_rcs: string | null;
  rnm: any | null; // Répertoire National des Métiers
  conventions_collectives: PappersConvention[] | null;
}

export interface PappersEtablissement {
  siret: string;
  siret_formate: string;
  nic: string;

  etablissement_siege: boolean;
  etablissement_employeur: boolean | null;

  adresse_ligne_1: string | null;
  adresse_ligne_2: string | null;
  code_postal: string | null;
  ville: string | null;
  pays: string | null;

  latitude: number | null;
  longitude: number | null;

  code_naf: string | null;
  libelle_code_naf: string | null;

  date_creation: string | null;
  etablissement_cesse: boolean;
  date_cessation: string | null;

  effectif: string | null;
  effectif_min: number | null;
  effectif_max: number | null;
  tranche_effectif: string | null;
}

export interface PappersRepresentant {
  nom: string | null;
  prenom: string | null;
  nom_complet: string | null;

  qualite: string | null;
  type_representant: 'personne_physique' | 'personne_morale';

  date_naissance: string | null;
  date_naissance_formate: string | null;
  age: number | null;
  nationalite: string | null;

  // Si personne morale
  denomination: string | null;
  siren: string | null;
  forme_juridique: string | null;

  date_prise_poste: string | null;
  actuel: boolean;
}

export interface PappersBeneficiaire {
  nom: string | null;
  prenom: string | null;
  nom_complet: string | null;

  date_naissance: string | null;
  nationalite: string | null;

  pourcentage_parts: number | null;
  pourcentage_votes: number | null;

  date_greffe: string | null;
}

export interface PappersFinances {
  annee: number;
  date_cloture: string;
  duree_exercice: number | null;

  chiffre_affaires: number | null;
  resultat: number | null;
  effectif: number | null;

  // Ratios (si disponibles)
  marge_brute: number | null;
  excedent_brut_exploitation: number | null;
  resultat_exploitation: number | null;
  resultat_net: number | null;

  capitaux_propres: number | null;
  total_bilan: number | null;
  dettes: number | null;

  // Indicateurs
  ratio_endettement: number | null;
  ratio_liquidite: number | null;
  ratio_solvabilite: number | null;
}

export interface PappersScoringFinancier {
  score: number; // 0-100
  score_secteur: number | null;
  risque_defaillance: string | null; // "faible", "modéré", "élevé"
  details: {
    rentabilite: number | null;
    solvabilite: number | null;
    liquidite: number | null;
    activite: number | null;
  } | null;
}

export interface PappersScoringNonFinancier {
  score: number;
  details: any;
}

export interface PappersLabels {
  labels_rge: PappersLabel[] | null;
  labels_qualite: PappersLabel[] | null;
}

export interface PappersLabel {
  nom: string;
  numero: string | null;
  date_obtention: string | null;
  date_fin_validite: string | null;
  organisme: string | null;
  domaines: string[] | null;
  url: string | null;
}

export interface PappersProcedure {
  type: string;
  date_debut: string;
  date_fin: string | null;
  tribunal: string | null;
}

export interface PappersConvention {
  nom: string;
  idcc: string;
}

export interface PappersDocument {
  type: string;
  date_depot: string | null;
  token: string;
  nom_fichier: string | null;
}

export interface PappersSearchResult {
  siren: string;
  siret: string;
  nom_entreprise: string | null;
  denomination: string | null;
  siege: {
    code_postal: string | null;
    ville: string | null;
  } | null;
  code_naf: string | null;
  libelle_code_naf: string | null;
  forme_juridique: string | null;
  effectif: string | null;
  date_creation: string | null;
  entreprise_cessee: boolean;
}

// ============================================
// FORMAT TORP UNIFIÉ
// ============================================

export interface EntrepriseEnrichie {
  // Identifiants
  siret: string;
  siren: string;

  // Dénomination
  raisonSociale: string | null;
  nomCommercial: string | null;
  sigle: string | null;

  // Forme juridique
  formeJuridique: string | null;
  formeJuridiqueCode: string | null;

  // Activité
  codeNAF: string | null;
  libelleNAF: string | null;
  domaineActivite: string | null;
  objetSocial: string | null;

  // Adresse
  adresse: {
    ligne1: string | null;
    ligne2: string | null;
    codePostal: string | null;
    ville: string | null;
    pays: string | null;
    latitude: number | null;
    longitude: number | null;
  };
  adresseComplete: string;

  // Dates
  dateCreation: string | null;
  dateCreationFormatee: string | null;
  ancienneteAnnees: number | null;

  // État
  estActif: boolean;
  dateCessation: string | null;
  estEmployeur: boolean | null;

  // Effectifs
  effectif: string | null;
  effectifMin: number | null;
  effectifMax: number | null;
  trancheEffectif: string | null;

  // Capital
  capital: number | null;
  capitalFormate: string | null;

  // Finances (enrichissement Pappers)
  dernieresFinances: {
    annee: number;
    chiffreAffaires: number | null;
    chiffreAffairesFormate: string | null;
    resultat: number | null;
    resultatFormate: string | null;
    effectif: number | null;
  } | null;
  historiqueFinances: PappersFinances[] | null;

  // Scoring
  scoringFinancier: {
    score: number;
    risque: string | null;
    details: any;
  } | null;

  // Dirigeants
  dirigeants: {
    nom: string | null;
    prenom: string | null;
    qualite: string | null;
    age: number | null;
  }[] | null;

  // Certifications / Labels (important BTP)
  labelsRGE: PappersLabel[] | null;
  labelsQualite: PappersLabel[] | null;

  // Procédures collectives
  proceduresCollectives: PappersProcedure[] | null;
  aProcedureenCours: boolean;

  // TVA
  numeroTVA: string | null;

  // Source des données
  source: 'sirene' | 'pappers' | 'combined';
  sourceDetails: {
    sirene: boolean;
    pappers: boolean;
    pappersEnrichissement: boolean;
  };
}

// ============================================
// TYPES HÉRITÉS (Compatibilité)
// ============================================

export interface HealthScore {
  score: number; // 0-100
  niveau: 'excellent' | 'bon' | 'moyen' | 'faible' | 'inconnu';
  couleur: string;
  details: {
    anciennete: { score: number; label: string };
    capital: { score: number; label: string };
    resultat: { score: number; label: string };
    tendanceCA: { score: number; label: string };
  };
}

export interface EnrichedEntrepriseData {
  // Identité
  nom: string;
  formeJuridique: string;
  siret: string;
  siren: string;

  // NAF
  codeNAF: string;
  libelleNAF: string;

  // Dates
  dateCreation: string;
  dateImmatriculation: string;
  ancienneteAnnees: number;

  // Adresse complète
  adresse: {
    ligne1: string;
    codePostal: string;
    ville: string;
    pays: string;
  };

  // Finances
  capital: number;
  chiffreAffaires: number | null;
  resultat: number | null;
  effectif: number | null;
  tendanceCA: 'hausse' | 'baisse' | 'stable' | 'inconnu';
  historiqueCA: Array<{ annee: number; valeur: number }>;

  // Score de santé financière
  healthScore: HealthScore;

  // Dirigeants
  dirigeants: Array<{
    nom: string;
    prenom: string;
    fonction: string;
  }>;

  // Certifications
  certificationsRGE: Array<{
    nom: string;
    domaine: string;
    numero: string;
    validite: string;
  }>;

  labels: string[];

  // Statut
  statutRCS: string;
  etatAdministratif: string;
  estActive: boolean;
}

// ============================================
// SERVICE PAPPERS
// ============================================

class PappersService {
  private apiKey: string;
  private baseUrl: string;

  constructor() {
    this.apiKey = PAPPERS_API_KEY || '';
    this.baseUrl = PAPPERS_API_URL;
  }

  /**
   * Vérifie si l'API est configurée
   */
  isConfigured(): boolean {
    return !!this.apiKey;
  }

  /**
   * Headers pour les requêtes
   */
  private getHeaders(): HeadersInit {
    return {
      'Accept': 'application/json',
      'api-key': this.apiKey,
    };
  }

  /**
   * Construit l'URL avec paramètres
   */
  private buildUrl(endpoint: string, params: Record<string, any> = {}): string {
    const url = new URL(`${this.baseUrl}${endpoint}`);

    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        url.searchParams.append(key, String(value));
      }
    });

    return url.toString();
  }

  /**
   * Récupère la fiche complète d'une entreprise par SIREN ou SIRET
   */
  async getEntreprise(sirenOrSiret: string, options: {
    includeFinances?: boolean;
    includeRepresentants?: boolean;
    includeBeneficiaires?: boolean;
    includeDocuments?: boolean;
    includeProcedures?: boolean;
    includeLabels?: boolean;
    includeScoring?: boolean;
  } = {}): Promise<{
    success: boolean;
    data?: PappersEntreprise;
    error?: string;
    notFound?: boolean;
  }> {
    if (!this.isConfigured()) {
      return { success: false, error: 'API Pappers non configurée' };
    }

    const cleaned = sirenOrSiret.replace(/\s/g, '');

    // Déterminer si SIREN (9) ou SIRET (14)
    const isSiret = cleaned.length === 14;
    const param = isSiret ? 'siret' : 'siren';

    try {
      const url = this.buildUrl('/entreprise', {
        [param]: cleaned,
        // Champs optionnels (coûtent des jetons supplémentaires)
        finances: options.includeFinances ? 'true' : undefined,
        representants: options.includeRepresentants !== false ? 'true' : undefined,
        beneficiaires: options.includeBeneficiaires ? 'true' : undefined,
        documents: options.includeDocuments ? 'true' : undefined,
        procedures: options.includeProcedures ? 'true' : undefined,
        labels: options.includeLabels ? 'true' : undefined,
        scoring: options.includeScoring ? 'true' : undefined,
      });

      log('[Pappers] Fetching:', url.replace(this.apiKey, '***'));

      const response = await fetch(url, {
        headers: this.getHeaders(),
      });

      if (response.status === 404) {
        return { success: false, notFound: true, error: 'Entreprise non trouvée' };
      }

      if (response.status === 401) {
        return { success: false, error: 'Clé API Pappers invalide' };
      }

      if (response.status === 402) {
        return { success: false, error: 'Crédit Pappers insuffisant' };
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        return {
          success: false,
          error: errorData.message || `Erreur API Pappers: ${response.status}`
        };
      }

      const data = await response.json() as PappersEntreprise;
      log('[Pappers] Data received:', {
        siren: data.siren,
        nom: data.nom_entreprise || data.denomination,
        hasFinances: !!data.finances?.length,
        hasLabels: !!data.labels,
        hasScoring: !!data.scoring_financier,
      });

      return { success: true, data };

    } catch (error) {
      console.error('[Pappers] Erreur:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erreur de connexion à Pappers'
      };
    }
  }

  /**
   * Recherche d'entreprises
   */
  async recherche(params: {
    q?: string;
    code_naf?: string;
    departement?: string;
    region?: string;
    code_postal?: string;
    convention_collective?: string;
    categorie_juridique?: string;
    entreprise_cessee?: boolean;
    page?: number;
    par_page?: number;
  }): Promise<{
    success: boolean;
    data?: {
      resultats: PappersSearchResult[];
      total: number;
      page: number;
      par_page: number;
    };
    error?: string;
  }> {
    if (!this.isConfigured()) {
      return { success: false, error: 'API Pappers non configurée' };
    }

    try {
      const url = this.buildUrl('/recherche', {
        ...params,
        par_page: params.par_page || 10,
      });

      const response = await fetch(url, {
        headers: this.getHeaders(),
      });

      if (!response.ok) {
        return { success: false, error: `Erreur API: ${response.status}` };
      }

      const data = await response.json();
      return {
        success: true,
        data: {
          resultats: data.resultats || [],
          total: data.total || 0,
          page: data.page || 1,
          par_page: data.par_page || 10,
        },
      };

    } catch (error) {
      console.error('[Pappers] Erreur recherche:', error);
      return { success: false, error: 'Erreur de connexion' };
    }
  }

  /**
   * Suggestions (autocomplete)
   */
  async suggestions(query: string, limit: number = 5): Promise<{
    success: boolean;
    data?: PappersSearchResult[];
    error?: string;
  }> {
    if (!this.isConfigured() || !query || query.length < 2) {
      return { success: false, error: 'Requête trop courte' };
    }

    try {
      const url = this.buildUrl('/suggestions', {
        q: query,
        longueur: limit,
      });

      const response = await fetch(url, {
        headers: this.getHeaders(),
      });

      if (!response.ok) {
        return { success: false, error: `Erreur API: ${response.status}` };
      }

      const data = await response.json();

      // Pappers retourne différentes catégories de résultats
      const resultats: PappersSearchResult[] = [];

      if (data.resultats_siren) {
        resultats.push(...data.resultats_siren);
      }
      if (data.resultats_siret) {
        resultats.push(...data.resultats_siret);
      }
      if (data.resultats_denomination) {
        resultats.push(...data.resultats_denomination);
      }
      if (data.resultats_nom_entreprise) {
        resultats.push(...data.resultats_nom_entreprise);
      }

      return { success: true, data: resultats.slice(0, limit) };

    } catch (error) {
      console.error('[Pappers] Erreur suggestions:', error);
      return { success: false, error: 'Erreur de connexion' };
    }
  }

  /**
   * Récupère les comptes annuels
   */
  async getComptesAnnuels(siren: string): Promise<{
    success: boolean;
    data?: PappersFinances[];
    error?: string;
  }> {
    if (!this.isConfigured()) {
      return { success: false, error: 'API non configurée' };
    }

    try {
      const url = this.buildUrl('/entreprise/comptes', {
        siren: siren.replace(/\s/g, ''),
      });

      const response = await fetch(url, {
        headers: this.getHeaders(),
      });

      if (!response.ok) {
        return { success: false, error: `Erreur API: ${response.status}` };
      }

      const data = await response.json();
      return { success: true, data: data || [] };

    } catch (error) {
      return { success: false, error: 'Erreur de connexion' };
    }
  }

  /**
   * Télécharge un document par token
   */
  getDocumentUrl(token: string): string {
    return `${this.baseUrl}/document/telechargement?api_token=${this.apiKey}&token=${token}`;
  }

  /**
   * URL vers l'extrait Pappers (PDF)
   */
  getExtraitPappersUrl(sirenOrSiret: string): string {
    const cleaned = sirenOrSiret.replace(/\s/g, '');
    const param = cleaned.length === 14 ? 'siret' : 'siren';
    return `${this.baseUrl}/document/extrait_pappers?api_token=${this.apiKey}&${param}=${cleaned}`;
  }

  /**
   * Mappe les données Pappers vers le format TORP unifié
   */
  mapToEntrepriseEnrichie(data: PappersEntreprise): EntrepriseEnrichie {
    const siege = data.siege;

    // Calcul ancienneté
    let ancienneteAnnees: number | null = null;
    if (data.date_creation) {
      const creation = new Date(data.date_creation);
      ancienneteAnnees = Math.floor(
        (Date.now() - creation.getTime()) / (365.25 * 24 * 60 * 60 * 1000)
      );
    }

    // Construction adresse
    const adresseComplete = [
      siege?.adresse_ligne_1,
      siege?.adresse_ligne_2,
      siege?.code_postal,
      siege?.ville,
    ].filter(Boolean).join(' ') || 'Non renseignée';

    // Dernières finances
    let dernieresFinances: EntrepriseEnrichie['dernieresFinances'] = null;
    if (data.finances && data.finances.length > 0) {
      const derniere = data.finances.sort((a, b) => b.annee - a.annee)[0];
      dernieresFinances = {
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
    }

    // Procédure en cours ?
    const aProcedureenCours = (data.procedures_collectives || [])
      .some(p => !p.date_fin);

    return {
      siret: data.siret_siege || siege?.siret || '',
      siren: data.siren,

      raisonSociale: data.denomination || data.nom_entreprise,
      nomCommercial: data.nom_commercial,
      sigle: data.sigle,

      formeJuridique: data.forme_juridique,
      formeJuridiqueCode: data.forme_juridique_code,

      codeNAF: data.code_naf,
      libelleNAF: data.libelle_code_naf,
      domaineActivite: data.domaine_activite,
      objetSocial: data.objet_social,

      adresse: {
        ligne1: siege?.adresse_ligne_1 || null,
        ligne2: siege?.adresse_ligne_2 || null,
        codePostal: siege?.code_postal || null,
        ville: siege?.ville || null,
        pays: siege?.pays || 'France',
        latitude: siege?.latitude || null,
        longitude: siege?.longitude || null,
      },
      adresseComplete,

      dateCreation: data.date_creation,
      dateCreationFormatee: data.date_creation_formate,
      ancienneteAnnees,

      estActif: !data.entreprise_cessee,
      dateCessation: data.date_cessation,
      estEmployeur: data.entreprise_employeuse,

      effectif: data.effectif,
      effectifMin: data.effectif_min,
      effectifMax: data.effectif_max,
      trancheEffectif: data.tranche_effectif,

      capital: data.capital,
      capitalFormate: data.capital_formate,

      dernieresFinances,
      historiqueFinances: data.finances || null,

      scoringFinancier: data.scoring_financier ? {
        score: data.scoring_financier.score,
        risque: data.scoring_financier.risque_defaillance,
        details: data.scoring_financier.details,
      } : null,

      dirigeants: (data.representants || [])
        .filter(r => r.actuel)
        .slice(0, 5)
        .map(r => ({
          nom: r.nom,
          prenom: r.prenom,
          qualite: r.qualite,
          age: r.age,
        })),

      labelsRGE: data.labels?.labels_rge || null,
      labelsQualite: data.labels?.labels_qualite || null,

      proceduresCollectives: data.procedures_collectives || null,
      aProcedureenCours,

      numeroTVA: data.numero_tva_intracommunautaire,

      source: 'pappers',
      sourceDetails: {
        sirene: false,
        pappers: true,
        pappersEnrichissement: true,
      },
    };
  }

  /**
   * Formate un montant en euros
   */
  private formatMontant(montant: number): string {
    if (Math.abs(montant) >= 1000000) {
      return `${(montant / 1000000).toFixed(1)} M€`;
    }
    if (Math.abs(montant) >= 1000) {
      return `${(montant / 1000).toFixed(0)} k€`;
    }
    return `${montant.toLocaleString('fr-FR')} €`;
  }

  // ============================================
  // MÉTHODES DE COMPATIBILITÉ (ancienne API)
  // ============================================

  /**
   * Rechercher une entreprise par SIRET (méthode de compatibilité)
   * Utilise d'abord l'API SIRENE gratuite, puis Pappers en fallback
   */
  async getEntrepriseBySiret(siret: string): Promise<EnrichedEntrepriseData | null> {
    const cleanedSiret = siret.replace(/\s/g, '');

    // 1. Essayer d'abord l'API SIRENE gratuite (recherche-entreprises.api.gouv.fr)
    log('[SIRENE] Recherche SIRET:', cleanedSiret);
    const sireneResult = await this.getEntrepriseFromSirene(cleanedSiret);

    if (sireneResult) {
      log('[SIRENE] Entreprise trouvée:', sireneResult.nom);
      return sireneResult;
    }

    // 2. Fallback: API Pappers (payante) pour données enrichies ou si SIRENE échoue
    if (this.isConfigured()) {
      try {
        log('[Pappers] Fallback - Fetching data for SIRET:', cleanedSiret);

        const result = await this.getEntreprise(cleanedSiret, {
          includeFinances: true,
          includeRepresentants: true,
          includeLabels: true,
        });

        if (result.success && result.data) {
          log('[Pappers] Data received:', {
            nom: result.data.nom_entreprise,
            siret: result.data.siret_siege,
            hasFinancials: !!(result.data.finances?.length),
            hasRGE: !!(result.data.labels?.labels_rge?.length)
          });
          return this.transformPappersData(result.data);
        }

        if (result.notFound) {
          warn('[Pappers] Entreprise non trouvée:', siret);
        } else if (result.error) {
          console.error('[Pappers] API error:', result.error);
        }
      } catch (error) {
        console.error('[Pappers] Error fetching entreprise:', error);
      }
    }

    warn('[Entreprise] Aucune donnée trouvée pour SIRET:', cleanedSiret);
    return null;
  }

  /**
   * Récupérer les données depuis l'API SIRENE gratuite
   */
  private async getEntrepriseFromSirene(siret: string): Promise<EnrichedEntrepriseData | null> {
    try {
      const response = await fetch(
        `https://recherche-entreprises.api.gouv.fr/search?q=siret:${siret}&page=1&per_page=1`,
        { headers: { 'Accept': 'application/json' } }
      );

      if (!response.ok) {
        console.error('[SIRENE] API error:', response.status);
        return this.getEntrepriseFromSireneFallback(siret);
      }

      const data = await response.json();

      if (!data.results || data.results.length === 0) {
        warn('[SIRENE] Pas de résultat exact, essai recherche libre...');
        return this.getEntrepriseFromSireneFallback(siret);
      }

      const entreprise = data.results[0];
      return this.transformSireneData(entreprise, siret);
    } catch (error) {
      console.error('[SIRENE] Error fetching entreprise:', error);
      return this.getEntrepriseFromSireneFallback(siret);
    }
  }

  /**
   * Fallback: recherche libre dans l'API SIRENE
   */
  private async getEntrepriseFromSireneFallback(siret: string): Promise<EnrichedEntrepriseData | null> {
    try {
      const siren = siret.substring(0, 9);
      log('[SIRENE Fallback] Recherche par SIREN:', siren);

      const response = await fetch(
        `https://recherche-entreprises.api.gouv.fr/search?q=${siren}&page=1&per_page=5`,
        { headers: { 'Accept': 'application/json' } }
      );

      if (!response.ok) {
        console.error('[SIRENE Fallback] API error:', response.status);
        return null;
      }

      const data = await response.json();

      if (!data.results || data.results.length === 0) {
        return null;
      }

      const entreprise = data.results.find((e: any) => e.siren === siren) || data.results[0];
      return this.transformSireneData(entreprise, siret);
    } catch (error) {
      console.error('[SIRENE Fallback] Error:', error);
      return null;
    }
  }

  /**
   * Transformer les données SIRENE en format utilisable
   */
  private transformSireneData(data: any, originalSiret: string): EnrichedEntrepriseData {
    const siege = data.siege || {};
    const dirigeants = data.dirigeants || [];
    const dateCreation = data.date_creation || siege.date_creation || '';
    const ancienneteAnnees = this.calculateAnciennete(dateCreation);

    return {
      nom: data.nom_complet || data.nom_raison_sociale || 'Non renseigné',
      formeJuridique: data.nature_juridique || 'Non renseigné',
      siret: siege.siret || originalSiret,
      siren: data.siren || originalSiret.substring(0, 9),

      codeNAF: siege.activite_principale || data.activite_principale || '',
      libelleNAF: siege.libelle_activite_principale || data.libelle_activite_principale || '',

      dateCreation: dateCreation,
      dateImmatriculation: dateCreation,
      ancienneteAnnees,

      adresse: {
        ligne1: siege.adresse || siege.geo_adresse || '',
        codePostal: siege.code_postal || '',
        ville: siege.libelle_commune || siege.commune || '',
        pays: 'France',
      },

      capital: 0,
      chiffreAffaires: null,
      resultat: null,
      effectif: this.parseEffectif(data.tranche_effectif_salarie || siege.tranche_effectif_salarie),
      tendanceCA: 'inconnu',
      historiqueCA: [],

      healthScore: {
        score: 50,
        niveau: 'inconnu',
        couleur: '#6b7280',
        details: {
          anciennete: { score: Math.min(25, ancienneteAnnees * 2.5), label: `${ancienneteAnnees} an(s)` },
          capital: { score: 12, label: 'Non disponible' },
          resultat: { score: 12, label: 'Non disponible' },
          tendanceCA: { score: 12, label: 'Non disponible' },
        },
      },

      dirigeants: dirigeants.map((d: any) => ({
        nom: d.nom || '',
        prenom: d.prenoms || '',
        fonction: d.qualite || 'Dirigeant',
      })),

      certificationsRGE: [],
      labels: [],

      statutRCS: 'Non renseigné',
      etatAdministratif: data.etat_administratif === 'A' ? 'Actif' : (data.etat_administratif || 'Inconnu'),
      estActive: data.etat_administratif === 'A',
    };
  }

  /**
   * Transformer les données Pappers en format utilisable
   */
  private transformPappersData(data: PappersEntreprise): EnrichedEntrepriseData {
    const dernierCA = data.finances?.length ?
      data.finances.sort((a, b) => b.annee - a.annee)[0]?.chiffre_affaires : null;
    const dernierResultat = data.finances?.length ?
      data.finances.sort((a, b) => b.annee - a.annee)[0]?.resultat : null;
    const dernierEffectif = data.finances?.length ?
      data.finances.sort((a, b) => b.annee - a.annee)[0]?.effectif : null;

    const ancienneteAnnees = this.calculateAnciennete(data.date_creation || '');
    const tendanceCA = this.calculateTendanceCA(data.finances || []);

    const healthScore = this.calculateHealthScore(
      ancienneteAnnees,
      data.capital || 0,
      dernierResultat,
      tendanceCA,
      data.entreprise_cessee ? 'Cessée' : 'Actif'
    );

    return {
      nom: data.nom_entreprise || data.denomination || 'Non renseigné',
      formeJuridique: data.forme_juridique || 'Non renseigné',
      siret: data.siret_siege || data.siege?.siret || '',
      siren: data.siren,

      codeNAF: data.code_naf || '',
      libelleNAF: data.libelle_code_naf || '',

      dateCreation: data.date_creation || '',
      dateImmatriculation: data.date_immatriculation_rcs || data.date_creation || '',
      ancienneteAnnees,

      adresse: {
        ligne1: data.siege?.adresse_ligne_1 || '',
        codePostal: data.siege?.code_postal || '',
        ville: data.siege?.ville || '',
        pays: data.siege?.pays || 'France',
      },

      capital: data.capital || 0,
      chiffreAffaires: dernierCA,
      resultat: dernierResultat,
      effectif: dernierEffectif,
      tendanceCA,
      historiqueCA: (data.finances || []).map(f => ({
        annee: f.annee,
        valeur: f.chiffre_affaires || 0,
      })),

      healthScore,

      dirigeants: (data.representants || [])
        .filter(r => r.actuel)
        .map(rep => ({
          nom: rep.nom || '',
          prenom: rep.prenom || '',
          fonction: rep.qualite || '',
        })),

      certificationsRGE: (data.labels?.labels_rge || []).map(cert => ({
        nom: cert.nom,
        domaine: cert.domaines?.join(', ') || '',
        numero: cert.numero || '',
        validite: cert.date_fin_validite
          ? `Jusqu'au ${new Date(cert.date_fin_validite).toLocaleDateString('fr-FR')}`
          : 'En cours',
      })),

      labels: (data.labels?.labels_qualite || []).map(l => l.nom),

      statutRCS: data.numero_rcs || 'Non renseigné',
      etatAdministratif: data.entreprise_cessee ? 'Cessée' : 'Actif',
      estActive: !data.entreprise_cessee,
    };
  }

  /**
   * Rechercher une entreprise par SIREN (méthode de compatibilité)
   */
  async getEntrepriseBySiren(siren: string): Promise<EnrichedEntrepriseData | null> {
    if (!this.isConfigured()) {
      warn('[Pappers] API key not configured');
      return null;
    }

    try {
      const cleanedSiren = siren.replace(/\s/g, '');
      const result = await this.getEntreprise(cleanedSiren, {
        includeFinances: true,
        includeRepresentants: true,
        includeLabels: true,
      });

      if (result.success && result.data) {
        return this.transformPappersData(result.data);
      }

      if (result.notFound) {
        warn('[Pappers] Entreprise non trouvée:', siren);
      }
      return null;
    } catch (error) {
      console.error('[Pappers] Error fetching entreprise:', error);
      return null;
    }
  }

  /**
   * Parser la tranche d'effectif
   */
  private parseEffectif(tranche: string | null): number | null {
    if (!tranche) return null;

    const tranches: Record<string, number> = {
      '00': 0, '01': 1, '02': 3, '03': 6,
      '11': 15, '12': 30, '21': 75, '22': 150,
      '31': 350, '32': 750, '41': 1500, '42': 3500,
      '51': 7500, '52': 9999,
    };

    return tranches[tranche] || null;
  }

  /**
   * Calculer l'ancienneté en années
   */
  private calculateAnciennete(dateCreation: string): number {
    if (!dateCreation) return 0;
    try {
      const creation = new Date(dateCreation);
      return Math.floor((Date.now() - creation.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
    } catch {
      return 0;
    }
  }

  /**
   * Calculer la tendance du chiffre d'affaires
   */
  private calculateTendanceCA(finances: PappersFinances[]): 'hausse' | 'baisse' | 'stable' | 'inconnu' {
    if (!finances || finances.length < 2) return 'inconnu';

    const sorted = [...finances].sort((a, b) => a.annee - b.annee);
    const recent = sorted.slice(-2);

    if (recent.length < 2 || !recent[0].chiffre_affaires || !recent[1].chiffre_affaires) {
      return 'inconnu';
    }

    const diff = recent[1].chiffre_affaires - recent[0].chiffre_affaires;
    const percentChange = (diff / recent[0].chiffre_affaires) * 100;

    if (percentChange > 5) return 'hausse';
    if (percentChange < -5) return 'baisse';
    return 'stable';
  }

  /**
   * Calculer le score de santé financière (0-100)
   */
  private calculateHealthScore(
    anciennete: number,
    capital: number,
    resultat: number | null,
    tendance: 'hausse' | 'baisse' | 'stable' | 'inconnu',
    etatAdmin: string
  ): HealthScore {
    // Si entreprise inactive, score très faible
    if (etatAdmin && !['Actif', 'Active', 'A'].includes(etatAdmin)) {
      return {
        score: 10,
        niveau: 'faible',
        couleur: '#ef4444',
        details: {
          anciennete: { score: 0, label: 'Entreprise inactive' },
          capital: { score: 0, label: 'N/A' },
          resultat: { score: 0, label: 'N/A' },
          tendanceCA: { score: 0, label: 'N/A' },
        },
      };
    }

    // Score ancienneté (25 pts max)
    let scoreAnciennete = 0;
    let labelAnciennete = '';
    if (anciennete >= 10) {
      scoreAnciennete = 25;
      labelAnciennete = `${anciennete} ans - Excellente ancienneté`;
    } else if (anciennete >= 5) {
      scoreAnciennete = 20;
      labelAnciennete = `${anciennete} ans - Bonne ancienneté`;
    } else if (anciennete >= 3) {
      scoreAnciennete = 15;
      labelAnciennete = `${anciennete} ans - Ancienneté correcte`;
    } else if (anciennete >= 1) {
      scoreAnciennete = 10;
      labelAnciennete = `${anciennete} an(s) - Jeune entreprise`;
    } else {
      scoreAnciennete = 5;
      labelAnciennete = 'Moins d\'1 an - Très jeune entreprise';
    }

    // Score capital (25 pts max)
    let scoreCapital = 0;
    let labelCapital = '';
    if (capital >= 100000) {
      scoreCapital = 25;
      labelCapital = `${(capital / 1000).toLocaleString('fr-FR')}k€ - Capital solide`;
    } else if (capital >= 50000) {
      scoreCapital = 20;
      labelCapital = `${(capital / 1000).toLocaleString('fr-FR')}k€ - Bon capital`;
    } else if (capital >= 10000) {
      scoreCapital = 15;
      labelCapital = `${(capital / 1000).toLocaleString('fr-FR')}k€ - Capital correct`;
    } else if (capital > 0) {
      scoreCapital = 10;
      labelCapital = `${capital.toLocaleString('fr-FR')}€ - Capital limité`;
    } else {
      scoreCapital = 5;
      labelCapital = 'Non renseigné';
    }

    // Score résultat (25 pts max)
    let scoreResultat = 0;
    let labelResultat = '';
    if (resultat === null) {
      scoreResultat = 12;
      labelResultat = 'Non disponible';
    } else if (resultat > 50000) {
      scoreResultat = 25;
      labelResultat = 'Excellent résultat';
    } else if (resultat > 10000) {
      scoreResultat = 20;
      labelResultat = 'Bon résultat';
    } else if (resultat > 0) {
      scoreResultat = 15;
      labelResultat = 'Résultat positif';
    } else if (resultat === 0) {
      scoreResultat = 10;
      labelResultat = 'À l\'équilibre';
    } else {
      scoreResultat = 5;
      labelResultat = 'Résultat négatif';
    }

    // Score tendance CA (25 pts max)
    let scoreTendance = 0;
    let labelTendance = '';
    switch (tendance) {
      case 'hausse':
        scoreTendance = 25;
        labelTendance = 'CA en croissance';
        break;
      case 'stable':
        scoreTendance = 20;
        labelTendance = 'CA stable';
        break;
      case 'baisse':
        scoreTendance = 10;
        labelTendance = 'CA en baisse';
        break;
      default:
        scoreTendance = 12;
        labelTendance = 'Tendance inconnue';
    }

    const totalScore = scoreAnciennete + scoreCapital + scoreResultat + scoreTendance;

    let niveau: HealthScore['niveau'];
    let couleur: string;
    if (totalScore >= 80) {
      niveau = 'excellent';
      couleur = '#10b981';
    } else if (totalScore >= 60) {
      niveau = 'bon';
      couleur = '#22c55e';
    } else if (totalScore >= 40) {
      niveau = 'moyen';
      couleur = '#f59e0b';
    } else {
      niveau = 'faible';
      couleur = '#ef4444';
    }

    return {
      score: totalScore,
      niveau,
      couleur,
      details: {
        anciennete: { score: scoreAnciennete, label: labelAnciennete },
        capital: { score: scoreCapital, label: labelCapital },
        resultat: { score: scoreResultat, label: labelResultat },
        tendanceCA: { score: scoreTendance, label: labelTendance },
      },
    };
  }
}

export const pappersService = new PappersService();
export default pappersService;
