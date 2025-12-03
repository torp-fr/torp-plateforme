/**
 * Service d'accès à l'API Sirene de l'INSEE
 * Documentation : https://api.insee.fr/catalogue/
 *
 * Endpoints utilisés :
 * - GET /siret/{siret} : Recherche établissement par SIRET (14 chiffres)
 * - GET /siren/{siren} : Recherche unité légale par SIREN (9 chiffres)
 * - GET /siret?q=... : Recherche multicritère
 */

const INSEE_API_URL = import.meta.env.VITE_INSEE_API_URL || 'https://api.insee.fr/api-sirene/3.11';
const INSEE_API_KEY = import.meta.env.VITE_INSEE_API_KEY;

// Types basés sur la documentation OpenAPI
export interface AdresseSirene {
  numeroVoieEtablissement: string | null;
  typeVoieEtablissement: string | null;
  libelleVoieEtablissement: string | null;
  codePostalEtablissement: string | null;
  libelleCommuneEtablissement: string | null;
  codeCommuneEtablissement: string | null;
  complementAdresseEtablissement: string | null;
}

export interface UniteLegaleSirene {
  siren: string;
  statutDiffusionUniteLegale: string;
  dateCreationUniteLegale: string | null;
  sigleUniteLegale: string | null;
  sexeUniteLegale: string | null;
  prenom1UniteLegale: string | null;
  nomUniteLegale: string | null;
  denominationUniteLegale: string | null;
  denominationUsuelle1UniteLegale: string | null;
  categorieJuridiqueUniteLegale: string | null;
  activitePrincipaleUniteLegale: string | null;
  nomenclatureActivitePrincipaleUniteLegale: string | null;
  nicSiegeUniteLegale: string | null;
  etatAdministratifUniteLegale: string; // A = Active, C = Cessée
  caractereEmployeurUniteLegale: string | null;
  trancheEffectifsUniteLegale: string | null;
  anneeEffectifsUniteLegale: string | null;
  categorieEntreprise: string | null; // PME, ETI, GE
}

export interface EtablissementSirene {
  siren: string;
  nic: string;
  siret: string;
  statutDiffusionEtablissement: string;
  dateCreationEtablissement: string | null;
  trancheEffectifsEtablissement: string | null;
  anneeEffectifsEtablissement: string | null;
  activitePrincipaleRegistreMetiersEtablissement: string | null;
  etablissementSiege: boolean;
  nombrePeriodesEtablissement: number;
  uniteLegale: UniteLegaleSirene;
  adresseEtablissement: AdresseSirene;
  periodesEtablissement: Array<{
    dateFin: string | null;
    dateDebut: string | null;
    etatAdministratifEtablissement: string; // A = Actif, F = Fermé
    enseigne1Etablissement: string | null;
    enseigne2Etablissement: string | null;
    enseigne3Etablissement: string | null;
    denominationUsuelleEtablissement: string | null;
    activitePrincipaleEtablissement: string | null;
    nomenclatureActivitePrincipaleEtablissement: string | null;
  }>;
}

export interface SireneEntreprise {
  // Identifiants
  siret: string;
  siren: string;
  nic: string;

  // Dénomination
  raisonSociale: string | null;
  denominationUsuelle: string | null;
  sigle: string | null;
  enseigne: string | null;

  // Forme juridique
  categorieJuridique: string | null;
  categorieJuridiqueLibelle: string | null;

  // Activité
  codeNAF: string | null;
  libelleNAF: string | null;
  activiteRegistreMetiers: string | null;

  // Adresse
  adresse: {
    numeroVoie: string | null;
    typeVoie: string | null;
    libelleVoie: string | null;
    complement: string | null;
    codePostal: string | null;
    commune: string | null;
    codeCommune: string | null;
  };
  adresseComplete: string;

  // Dates
  dateCreation: string | null;
  dateCreationFormatee: string | null;

  // État
  estActif: boolean;
  estSiege: boolean;
  etatAdministratif: 'A' | 'C' | 'F'; // Actif, Cessé (UL), Fermé (Etab)

  // Effectifs
  trancheEffectif: string | null;
  trancheEffectifLibelle: string | null;
  anneeEffectif: string | null;
  categorieEntreprise: string | null; // PME, ETI, GE

  // Métadonnées
  estDiffusible: boolean;

  // Calculs TORP
  ancienneteAnnees: number | null;
}

// Mapping des tranches d'effectif
const TRANCHES_EFFECTIF: Record<string, string> = {
  'NN': 'Non renseigné',
  '00': '0 salarié',
  '01': '1 ou 2 salariés',
  '02': '3 à 5 salariés',
  '03': '6 à 9 salariés',
  '11': '10 à 19 salariés',
  '12': '20 à 49 salariés',
  '21': '50 à 99 salariés',
  '22': '100 à 199 salariés',
  '31': '200 à 249 salariés',
  '32': '250 à 499 salariés',
  '41': '500 à 999 salariés',
  '42': '1 000 à 1 999 salariés',
  '51': '2 000 à 4 999 salariés',
  '52': '5 000 à 9 999 salariés',
  '53': '10 000 salariés et plus',
};

// Mapping simplifié des catégories juridiques principales
const CATEGORIES_JURIDIQUES: Record<string, string> = {
  '1000': 'Entrepreneur individuel',
  '5498': 'EURL',
  '5499': 'Société à responsabilité limitée (sans autre indication)',
  '5505': 'SA à conseil d\'administration',
  '5510': 'SA à directoire',
  '5515': 'SAS',
  '5520': 'SAS à associé unique (SASU)',
  '5522': 'Société par actions simplifiée',
  '5523': 'SASU',
  '5530': 'SA à participation ouvrière',
  '5532': 'SA de HLM',
  '5546': 'SA immobilière pour le commerce et l\'industrie',
  '5547': 'SA immobilière d\'investissement',
  '5599': 'SA (sans autre indication)',
  '5610': 'SCA',
  '5710': 'SCS',
  '5720': 'SNC',
  '6100': 'Caisse d\'épargne',
  '6220': 'Coopérative',
  '6316': 'CUMA',
  '6411': 'Mutuelle',
  '7112': 'Autorité administrative',
  '7120': 'Commune',
  '7130': 'Département',
  '7140': 'Région',
  '7150': 'Syndicat intercommunal',
  '7210': 'État',
  '7220': 'Service central',
  '7312': 'Établissement public administratif',
  '7321': 'Établissement public industriel et commercial',
  '8110': 'Régime général de la sécurité sociale',
  '8510': 'Caisse nationale militaire de sécurité sociale',
  '9110': 'Syndicat de propriétaires',
  '9210': 'Association non déclarée',
  '9220': 'Association déclarée',
  '9221': 'Association déclarée d\'insertion',
  '9222': 'Association intermédiaire',
  '9223': 'Groupement d\'employeurs',
  '9224': 'Association d\'avocats',
  '9230': 'Association déclarée reconnue d\'utilité publique',
  '9240': 'Congrégation',
  '9260': 'Association de droit local',
  '9300': 'Fondation',
};

class SireneService {
  private apiKey: string;
  private baseUrl: string;

  constructor() {
    this.apiKey = INSEE_API_KEY || '';
    this.baseUrl = INSEE_API_URL;
  }

  /**
   * Vérifie si l'API est configurée
   */
  isConfigured(): boolean {
    return !!this.apiKey;
  }

  /**
   * Headers pour les requêtes API
   */
  private getHeaders(): HeadersInit {
    return {
      'Accept': 'application/json',
      'X-INSEE-Api-Key-Integration': this.apiKey,
    };
  }

  /**
   * Valide le format d'un SIRET (14 chiffres)
   * Note: La vérification Luhn n'est pas appliquée car certains SIRET français
   * valides ne passent pas cet algorithme (exceptions historiques).
   * La validation finale est faite par l'API Sirene.
   */
  validateSiret(siret: string): { valid: boolean; error?: string; warning?: string } {
    const cleaned = siret.replace(/\s/g, '');

    if (!/^\d{14}$/.test(cleaned)) {
      return { valid: false, error: 'Le SIRET doit contenir exactement 14 chiffres' };
    }

    // Vérification Luhn optionnelle (avertissement seulement)
    if (!this.checkLuhn(cleaned)) {
      console.warn('[Sirene] SIRET ne passe pas la validation Luhn (peut être une exception):', cleaned);
    }

    return { valid: true };
  }

  /**
   * Valide le format d'un SIREN (9 chiffres)
   * Note: La vérification Luhn n'est pas appliquée strictement (exceptions historiques)
   */
  validateSiren(siren: string): { valid: boolean; error?: string } {
    const cleaned = siren.replace(/\s/g, '');

    if (!/^\d{9}$/.test(cleaned)) {
      return { valid: false, error: 'Le SIREN doit contenir exactement 9 chiffres' };
    }

    // Vérification Luhn optionnelle (avertissement seulement)
    if (!this.checkLuhn(cleaned)) {
      console.warn('[Sirene] SIREN ne passe pas la validation Luhn (peut être une exception):', cleaned);
    }

    return { valid: true };
  }

  /**
   * Algorithme de Luhn pour validation SIRET/SIREN
   */
  private checkLuhn(num: string): boolean {
    let sum = 0;
    for (let i = 0; i < num.length; i++) {
      let digit = parseInt(num[num.length - 1 - i], 10);
      if (i % 2 === 1) {
        digit *= 2;
        if (digit > 9) digit -= 9;
      }
      sum += digit;
    }
    return sum % 10 === 0;
  }

  /**
   * Recherche un établissement par SIRET
   */
  async getEtablissementBySiret(siret: string): Promise<{
    success: boolean;
    data?: SireneEntreprise;
    error?: string;
    notFound?: boolean;
  }> {
    if (!this.isConfigured()) {
      console.warn('[Sirene] API non configurée, utilisation du fallback recherche-entreprises');
      return this.getEtablissementFromOpenAPI(siret);
    }

    const validation = this.validateSiret(siret);
    if (!validation.valid) {
      return { success: false, error: validation.error };
    }

    const cleanSiret = siret.replace(/\s/g, '');

    try {
      console.log('[Sirene INSEE] Recherche SIRET:', cleanSiret);

      const response = await fetch(
        `${this.baseUrl}/siret/${cleanSiret}`,
        { headers: this.getHeaders() }
      );

      if (response.status === 404) {
        console.warn('[Sirene INSEE] Établissement non trouvé, fallback vers API ouverte');
        return this.getEtablissementFromOpenAPI(cleanSiret);
      }

      if (response.status === 403) {
        return { success: false, error: 'Établissement non diffusible (données protégées)' };
      }

      if (response.status === 429) {
        console.warn('[Sirene INSEE] Quota dépassé, fallback vers API ouverte');
        return this.getEtablissementFromOpenAPI(cleanSiret);
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('[Sirene INSEE] Erreur API:', response.status, errorData);
        return this.getEtablissementFromOpenAPI(cleanSiret);
      }

      const data = await response.json();
      const etablissement = data.etablissement as EtablissementSirene;

      console.log('[Sirene INSEE] Entreprise trouvée:', etablissement.uniteLegale?.denominationUniteLegale);

      return {
        success: true,
        data: this.mapEtablissement(etablissement),
      };

    } catch (error) {
      console.error('[Sirene INSEE] Erreur:', error);
      // Fallback vers l'API ouverte
      return this.getEtablissementFromOpenAPI(cleanSiret);
    }
  }

  /**
   * Fallback : API recherche-entreprises.api.gouv.fr (gratuite, sans clé)
   */
  private async getEtablissementFromOpenAPI(siret: string): Promise<{
    success: boolean;
    data?: SireneEntreprise;
    error?: string;
    notFound?: boolean;
  }> {
    try {
      console.log('[Sirene OpenAPI] Recherche SIRET:', siret);

      // Essayer d'abord la recherche exacte
      let response = await fetch(
        `https://recherche-entreprises.api.gouv.fr/search?q=siret:${siret}&page=1&per_page=1`,
        { headers: { 'Accept': 'application/json' } }
      );

      if (!response.ok) {
        console.error('[Sirene OpenAPI] Erreur:', response.status);
        return { success: false, error: `Erreur API: ${response.status}` };
      }

      let data = await response.json();

      // Si pas de résultat, essayer par SIREN
      if (!data.results || data.results.length === 0) {
        const siren = siret.substring(0, 9);
        console.log('[Sirene OpenAPI] Pas de résultat exact, recherche par SIREN:', siren);

        response = await fetch(
          `https://recherche-entreprises.api.gouv.fr/search?q=${siren}&page=1&per_page=5`,
          { headers: { 'Accept': 'application/json' } }
        );

        if (!response.ok) {
          return { success: false, notFound: true, error: 'Entreprise non trouvée' };
        }

        data = await response.json();

        if (!data.results || data.results.length === 0) {
          return { success: false, notFound: true, error: 'Entreprise non trouvée dans la base Sirene' };
        }

        // Trouver l'entreprise avec le bon SIREN
        const entreprise = data.results.find((e: any) => e.siren === siren) || data.results[0];
        console.log('[Sirene OpenAPI] Entreprise trouvée (via SIREN):', entreprise.nom_complet);

        return {
          success: true,
          data: this.mapOpenAPIEntreprise(entreprise, siret),
        };
      }

      const entreprise = data.results[0];
      console.log('[Sirene OpenAPI] Entreprise trouvée:', entreprise.nom_complet);

      return {
        success: true,
        data: this.mapOpenAPIEntreprise(entreprise, siret),
      };

    } catch (error) {
      console.error('[Sirene OpenAPI] Erreur:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erreur de connexion à l\'API Sirene'
      };
    }
  }

  /**
   * Mappe les données de l'API ouverte vers le format SireneEntreprise
   */
  private mapOpenAPIEntreprise(data: any, originalSiret: string): SireneEntreprise {
    const siege = data.siege || {};
    const dirigeants = data.dirigeants || [];

    // Calcul ancienneté
    const dateCreation = data.date_creation || siege.date_creation || null;
    let ancienneteAnnees: number | null = null;
    if (dateCreation) {
      const creation = new Date(dateCreation);
      const now = new Date();
      ancienneteAnnees = Math.floor(
        (now.getTime() - creation.getTime()) / (365.25 * 24 * 60 * 60 * 1000)
      );
    }

    // Construire l'adresse
    const adresseComplete = siege.adresse || siege.geo_adresse || 'Non renseignée';

    return {
      siret: siege.siret || originalSiret,
      siren: data.siren || originalSiret.substring(0, 9),
      nic: originalSiret.substring(9, 14),

      raisonSociale: data.nom_complet || data.nom_raison_sociale || null,
      denominationUsuelle: data.nom_complet || null,
      sigle: data.sigle || null,
      enseigne: null,

      categorieJuridique: data.nature_juridique || null,
      categorieJuridiqueLibelle: data.nature_juridique || 'Non renseigné',

      codeNAF: siege.activite_principale || data.activite_principale || null,
      libelleNAF: siege.libelle_activite_principale || data.libelle_activite_principale || null,
      activiteRegistreMetiers: null,

      adresse: {
        numeroVoie: null,
        typeVoie: null,
        libelleVoie: null,
        complement: null,
        codePostal: siege.code_postal || null,
        commune: siege.libelle_commune || siege.commune || null,
        codeCommune: siege.commune || null,
      },
      adresseComplete,

      dateCreation,
      dateCreationFormatee: dateCreation ? new Date(dateCreation).toLocaleDateString('fr-FR') : null,

      estActif: data.etat_administratif === 'A',
      estSiege: true,
      etatAdministratif: (data.etat_administratif || 'A') as 'A' | 'C' | 'F',

      trancheEffectif: data.tranche_effectif_salarie || siege.tranche_effectif_salarie || null,
      trancheEffectifLibelle: this.getTrancheEffectifLibelle(data.tranche_effectif_salarie || siege.tranche_effectif_salarie),
      anneeEffectif: null,
      categorieEntreprise: data.categorie_entreprise || null,

      estDiffusible: true,

      ancienneteAnnees,
    };
  }

  /**
   * Recherche une unité légale par SIREN
   */
  async getUniteLegaleBySiren(siren: string): Promise<{
    success: boolean;
    data?: Partial<SireneEntreprise>;
    error?: string;
    notFound?: boolean;
  }> {
    if (!this.isConfigured()) {
      return { success: false, error: 'API Sirene non configurée' };
    }

    const validation = this.validateSiren(siren);
    if (!validation.valid) {
      return { success: false, error: validation.error };
    }

    const cleanSiren = siren.replace(/\s/g, '');

    try {
      const response = await fetch(
        `${this.baseUrl}/siren/${cleanSiren}`,
        { headers: this.getHeaders() }
      );

      if (response.status === 404) {
        return { success: false, notFound: true, error: 'Entreprise non trouvée' };
      }

      if (!response.ok) {
        return { success: false, error: `Erreur API: ${response.status}` };
      }

      const data = await response.json();
      const uniteLegale = data.uniteLegale as UniteLegaleSirene;

      return {
        success: true,
        data: this.mapUniteLegale(uniteLegale),
      };

    } catch (error) {
      console.error('[Sirene] Erreur:', error);
      return { success: false, error: 'Erreur de connexion' };
    }
  }

  /**
   * Recherche multicritère d'établissements
   */
  async searchEtablissements(query: string, limit: number = 10): Promise<{
    success: boolean;
    data?: SireneEntreprise[];
    total?: number;
    error?: string;
  }> {
    // Utiliser l'API ouverte pour la recherche multicritère
    try {
      const response = await fetch(
        `https://recherche-entreprises.api.gouv.fr/search?q=${encodeURIComponent(query)}&page=1&per_page=${limit}`,
        { headers: { 'Accept': 'application/json' } }
      );

      if (response.status === 404) {
        return { success: true, data: [], total: 0 };
      }

      if (!response.ok) {
        return { success: false, error: `Erreur API: ${response.status}` };
      }

      const data = await response.json();
      const etablissements = (data.results || []) as any[];

      return {
        success: true,
        data: etablissements.map(e => this.mapOpenAPIEntreprise(e, e.siege?.siret || e.siren + '00000')),
        total: data.total_results || etablissements.length,
      };

    } catch (error) {
      console.error('[Sirene] Erreur recherche:', error);
      return { success: false, error: 'Erreur de connexion' };
    }
  }

  /**
   * Mappe les données brutes établissement vers le format TORP
   */
  private mapEtablissement(etab: EtablissementSirene): SireneEntreprise {
    const ul = etab.uniteLegale;
    const addr = etab.adresseEtablissement;
    const periode = etab.periodesEtablissement?.[0]; // Période courante

    // Construction de l'adresse complète
    const adresseComplete = [
      addr?.numeroVoieEtablissement,
      addr?.typeVoieEtablissement,
      addr?.libelleVoieEtablissement,
      addr?.complementAdresseEtablissement,
      addr?.codePostalEtablissement,
      addr?.libelleCommuneEtablissement,
    ].filter(Boolean).join(' ');

    // Calcul ancienneté
    let ancienneteAnnees: number | null = null;
    if (ul?.dateCreationUniteLegale) {
      const creation = new Date(ul.dateCreationUniteLegale);
      const now = new Date();
      ancienneteAnnees = Math.floor(
        (now.getTime() - creation.getTime()) / (365.25 * 24 * 60 * 60 * 1000)
      );
    }

    // Déterminer le nom de l'entreprise
    const raisonSociale = ul?.denominationUniteLegale
      || (ul?.prenom1UniteLegale && ul?.nomUniteLegale
          ? `${ul.prenom1UniteLegale} ${ul.nomUniteLegale}`
          : null);

    return {
      siret: etab.siret,
      siren: etab.siren,
      nic: etab.nic,

      raisonSociale,
      denominationUsuelle: periode?.denominationUsuelleEtablissement || ul?.denominationUsuelle1UniteLegale,
      sigle: ul?.sigleUniteLegale,
      enseigne: periode?.enseigne1Etablissement,

      categorieJuridique: ul?.categorieJuridiqueUniteLegale,
      categorieJuridiqueLibelle: ul?.categorieJuridiqueUniteLegale
        ? CATEGORIES_JURIDIQUES[ul.categorieJuridiqueUniteLegale] || ul.categorieJuridiqueUniteLegale
        : null,

      codeNAF: periode?.activitePrincipaleEtablissement || ul?.activitePrincipaleUniteLegale,
      libelleNAF: null, // Nécessiterait une table de correspondance NAF
      activiteRegistreMetiers: etab.activitePrincipaleRegistreMetiersEtablissement,

      adresse: {
        numeroVoie: addr?.numeroVoieEtablissement,
        typeVoie: addr?.typeVoieEtablissement,
        libelleVoie: addr?.libelleVoieEtablissement,
        complement: addr?.complementAdresseEtablissement,
        codePostal: addr?.codePostalEtablissement,
        commune: addr?.libelleCommuneEtablissement,
        codeCommune: addr?.codeCommuneEtablissement,
      },
      adresseComplete: adresseComplete || 'Non renseignée',

      dateCreation: ul?.dateCreationUniteLegale,
      dateCreationFormatee: ul?.dateCreationUniteLegale
        ? new Date(ul.dateCreationUniteLegale).toLocaleDateString('fr-FR')
        : null,

      estActif: ul?.etatAdministratifUniteLegale === 'A' && periode?.etatAdministratifEtablissement === 'A',
      estSiege: etab.etablissementSiege,
      etatAdministratif: (periode?.etatAdministratifEtablissement || ul?.etatAdministratifUniteLegale || 'A') as 'A' | 'C' | 'F',

      trancheEffectif: etab.trancheEffectifsEtablissement || ul?.trancheEffectifsUniteLegale,
      trancheEffectifLibelle: TRANCHES_EFFECTIF[etab.trancheEffectifsEtablissement || ul?.trancheEffectifsUniteLegale || 'NN'],
      anneeEffectif: etab.anneeEffectifsEtablissement || ul?.anneeEffectifsUniteLegale,
      categorieEntreprise: ul?.categorieEntreprise,

      estDiffusible: etab.statutDiffusionEtablissement === 'O',

      ancienneteAnnees,
    };
  }

  /**
   * Mappe les données unité légale (SIREN seul)
   */
  private mapUniteLegale(ul: UniteLegaleSirene): Partial<SireneEntreprise> {
    const raisonSociale = ul.denominationUniteLegale
      || (ul.prenom1UniteLegale && ul.nomUniteLegale
          ? `${ul.prenom1UniteLegale} ${ul.nomUniteLegale}`
          : null);

    let ancienneteAnnees: number | null = null;
    if (ul.dateCreationUniteLegale) {
      const creation = new Date(ul.dateCreationUniteLegale);
      ancienneteAnnees = Math.floor(
        (Date.now() - creation.getTime()) / (365.25 * 24 * 60 * 60 * 1000)
      );
    }

    return {
      siren: ul.siren,
      raisonSociale,
      sigle: ul.sigleUniteLegale,
      categorieJuridique: ul.categorieJuridiqueUniteLegale,
      categorieJuridiqueLibelle: ul.categorieJuridiqueUniteLegale
        ? CATEGORIES_JURIDIQUES[ul.categorieJuridiqueUniteLegale]
        : null,
      codeNAF: ul.activitePrincipaleUniteLegale,
      dateCreation: ul.dateCreationUniteLegale,
      estActif: ul.etatAdministratifUniteLegale === 'A',
      etatAdministratif: ul.etatAdministratifUniteLegale as 'A' | 'C',
      trancheEffectif: ul.trancheEffectifsUniteLegale,
      trancheEffectifLibelle: TRANCHES_EFFECTIF[ul.trancheEffectifsUniteLegale || 'NN'],
      categorieEntreprise: ul.categorieEntreprise,
      ancienneteAnnees,
    };
  }

  /**
   * Obtient le libellé de la tranche d'effectif
   */
  private getTrancheEffectifLibelle(tranche: string | null): string {
    if (!tranche) return 'Non renseigné';
    return TRANCHES_EFFECTIF[tranche] || 'Non renseigné';
  }
}

export const sireneService = new SireneService();
