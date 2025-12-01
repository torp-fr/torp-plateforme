/**
 * Pappers API Service
 * Service pour enrichir les données entreprise via l'API Pappers
 * https://www.pappers.fr/api/documentation
 */

export interface PappersEntreprise {
  siren: string;
  siret: string;
  nom_entreprise: string;
  forme_juridique: string;
  code_naf: string;
  libelle_code_naf: string;
  date_creation: string;
  date_immatriculation: string;
  capital: number;

  siege: {
    adresse_ligne_1: string;
    code_postal: string;
    ville: string;
    pays: string;
    latitude: number | null;
    longitude: number | null;
  };

  representants: Array<{
    nom: string;
    prenom: string;
    qualite: string;
  }>;

  chiffre_affaires: Array<{
    annee: number;
    valeur: number;
  }>;

  resultat: Array<{
    annee: number;
    valeur: number;
  }>;

  effectif: Array<{
    annee: number;
    valeur: number;
  }>;

  certifications_rge: Array<{
    nom: string;
    domaine: string;
    numero: string;
    date_debut: string;
    date_fin: string;
  }>;

  labels_certificats: string[];

  statut_rcs: string;
  etat_administratif: string;
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

  // Adresse complète
  adresse: {
    ligne1: string;
    codePostal: string;
    ville: string;
    pays: string;
  };

  // Finances
  capital: number;
  chiffreAffaires: number | null; // Dernier CA disponible
  resultat: number | null; // Dernier résultat
  effectif: number | null; // Dernier effectif

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
}

class PappersService {
  private apiKey: string | null = null;
  private baseUrl = 'https://api.pappers.fr/v2';

  constructor() {
    // Récupérer la clé API depuis les variables d'environnement
    this.apiKey = import.meta.env.VITE_PAPPERS_API_KEY || null;
  }

  /**
   * Vérifier si l'API Pappers est configurée
   */
  isConfigured(): boolean {
    return this.apiKey !== null && this.apiKey !== '';
  }

  /**
   * Rechercher une entreprise par SIRET
   */
  async getEntrepriseBySiret(siret: string): Promise<EnrichedEntrepriseData | null> {
    if (!this.isConfigured()) {
      console.warn('[Pappers] API key not configured - set VITE_PAPPERS_API_KEY in your .env');
      return null;
    }

    try {
      const cleanedSiret = siret.replace(/\s/g, '');
      console.log('[Pappers] Fetching data for SIRET:', cleanedSiret);

      const response = await fetch(
        `${this.baseUrl}/entreprise?api_token=${this.apiKey}&siret=${cleanedSiret}`
      );

      console.log('[Pappers] Response status:', response.status);

      if (!response.ok) {
        if (response.status === 404) {
          console.warn('[Pappers] Entreprise non trouvée:', siret);
          return null;
        }
        const errorText = await response.text();
        console.error('[Pappers] API error:', response.status, errorText);
        throw new Error(`Pappers API error: ${response.status}`);
      }

      const data: PappersEntreprise = await response.json();
      console.log('[Pappers] Data received:', {
        nom: data.nom_entreprise,
        siret: data.siret,
        forme: data.forme_juridique,
        hasFinancials: !!(data.chiffre_affaires?.length),
        hasRGE: !!(data.certifications_rge?.length)
      });

      return this.transformPappersData(data);
    } catch (error) {
      console.error('[Pappers] Error fetching entreprise:', error);
      return null;
    }
  }

  /**
   * Rechercher une entreprise par SIREN
   */
  async getEntrepriseBySiren(siren: string): Promise<EnrichedEntrepriseData | null> {
    if (!this.isConfigured()) {
      console.warn('[Pappers] API key not configured');
      return null;
    }

    try {
      const cleanedSiren = siren.replace(/\s/g, '');

      const response = await fetch(
        `${this.baseUrl}/entreprise?api_token=${this.apiKey}&siren=${cleanedSiren}`
      );

      if (!response.ok) {
        if (response.status === 404) {
          console.warn('[Pappers] Entreprise non trouvée:', siren);
          return null;
        }
        throw new Error(`Pappers API error: ${response.status}`);
      }

      const data: PappersEntreprise = await response.json();
      return this.transformPappersData(data);
    } catch (error) {
      console.error('[Pappers] Error fetching entreprise:', error);
      return null;
    }
  }

  /**
   * Transformer les données Pappers en format utilisable
   */
  private transformPappersData(data: PappersEntreprise): EnrichedEntrepriseData {
    // Récupérer les dernières données financières
    const dernierCA = data.chiffre_affaires?.length > 0
      ? data.chiffre_affaires[data.chiffre_affaires.length - 1].valeur
      : null;

    const dernierResultat = data.resultat?.length > 0
      ? data.resultat[data.resultat.length - 1].valeur
      : null;

    const dernierEffectif = data.effectif?.length > 0
      ? data.effectif[data.effectif.length - 1].valeur
      : null;

    return {
      nom: data.nom_entreprise,
      formeJuridique: data.forme_juridique,
      siret: data.siret,
      siren: data.siren,

      codeNAF: data.code_naf,
      libelleNAF: data.libelle_code_naf,

      dateCreation: data.date_creation,
      dateImmatriculation: data.date_immatriculation,

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

      dirigeants: (data.representants || []).map(rep => ({
        nom: rep.nom,
        prenom: rep.prenom,
        fonction: rep.qualite,
      })),

      certificationsRGE: (data.certifications_rge || []).map(cert => ({
        nom: cert.nom,
        domaine: cert.domaine,
        numero: cert.numero,
        validite: cert.date_fin ? `Jusqu'au ${new Date(cert.date_fin).toLocaleDateString('fr-FR')}` : 'En cours',
      })),

      labels: data.labels_certificats || [],

      statutRCS: data.statut_rcs,
      etatAdministratif: data.etat_administratif,
    };
  }
}

export const pappersService = new PappersService();
export default pappersService;
