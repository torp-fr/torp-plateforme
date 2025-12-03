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
  chiffreAffaires: number | null; // Dernier CA disponible
  resultat: number | null; // Dernier résultat
  effectif: number | null; // Dernier effectif
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

class PappersService {
  private apiKey: string | null = null;
  private baseUrl = 'https://api.pappers.fr/v2';
  private sireneApiUrl = 'https://api.insee.fr/entreprises/sirene/V3.11';

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
   * Priorité : API SIRENE gratuite, puis Pappers en fallback (optimisation coûts)
   */
  async getEntrepriseBySiret(siret: string): Promise<EnrichedEntrepriseData | null> {
    const cleanedSiret = siret.replace(/\s/g, '');

    // 1. Essayer d'abord l'API SIRENE gratuite (recherche-entreprises.api.gouv.fr)
    console.log('[SIRENE] Recherche SIRET:', cleanedSiret);
    const sireneResult = await this.getEntrepriseFromSirene(cleanedSiret);

    if (sireneResult) {
      console.log('[SIRENE] Entreprise trouvée:', sireneResult.nom);
      return sireneResult;
    }

    // 2. Fallback: API Pappers (payante) pour données enrichies ou si SIRENE échoue
    if (this.isConfigured()) {
      try {
        console.log('[Pappers] Fallback - Fetching data for SIRET:', cleanedSiret);

        const response = await fetch(
          `${this.baseUrl}/entreprise?api_token=${this.apiKey}&siret=${cleanedSiret}`
        );

        console.log('[Pappers] Response status:', response.status);

        if (response.ok) {
          const data: PappersEntreprise = await response.json();
          console.log('[Pappers] Data received:', {
            nom: data.nom_entreprise,
            siret: data.siret,
            forme: data.forme_juridique,
            hasFinancials: !!(data.chiffre_affaires?.length),
            hasRGE: !!(data.certifications_rge?.length)
          });
          return this.transformPappersData(data);
        }

        if (response.status !== 404) {
          const errorText = await response.text();
          console.error('[Pappers] API error:', response.status, errorText);
        } else {
          console.warn('[Pappers] Entreprise non trouvée:', siret);
        }
      } catch (error) {
        console.error('[Pappers] Error fetching entreprise:', error);
      }
    }

    console.warn('[Entreprise] Aucune donnée trouvée pour SIRET:', cleanedSiret);
    return null;
  }

  /**
   * Récupérer les données depuis l'API SIRENE gratuite
   * https://recherche-entreprises.api.gouv.fr/
   */
  private async getEntrepriseFromSirene(siret: string): Promise<EnrichedEntrepriseData | null> {
    try {
      // API recherche-entreprises (gratuite, open data)
      const response = await fetch(
        `https://recherche-entreprises.api.gouv.fr/search?q=${siret}&page=1&per_page=1`
      );

      if (!response.ok) {
        console.error('[SIRENE] API error:', response.status);
        return null;
      }

      const data = await response.json();

      if (!data.results || data.results.length === 0) {
        console.warn('[SIRENE] Entreprise non trouvée:', siret);
        return null;
      }

      const entreprise = data.results[0];
      console.log('[SIRENE] Data received:', {
        nom: entreprise.nom_complet,
        siret: entreprise.siege?.siret,
        siren: entreprise.siren
      });

      // Transformer les données SIRENE au format attendu
      return this.transformSireneData(entreprise, siret);
    } catch (error) {
      console.error('[SIRENE] Error fetching entreprise:', error);
      return null;
    }
  }

  /**
   * Transformer les données SIRENE en format utilisable
   */
  private transformSireneData(data: any, originalSiret: string): EnrichedEntrepriseData {
    const siege = data.siege || {};
    const dirigeants = data.dirigeants || [];

    // Calculer l'ancienneté
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

      capital: 0, // Non disponible dans l'API gratuite
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
   * Parser la tranche d'effectif
   */
  private parseEffectif(tranche: string | null): number | null {
    if (!tranche) return null;

    const tranches: Record<string, number> = {
      '00': 0,
      '01': 1,
      '02': 3,
      '03': 6,
      '11': 15,
      '12': 30,
      '21': 75,
      '22': 150,
      '31': 350,
      '32': 750,
      '41': 1500,
      '42': 3500,
      '51': 7500,
      '52': 9999,
    };

    return tranches[tranche] || null;
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

    // Calculer l'ancienneté
    const ancienneteAnnees = this.calculateAnciennete(data.date_creation);

    // Calculer la tendance CA
    const tendanceCA = this.calculateTendanceCA(data.chiffre_affaires || []);

    // Calculer le score de santé financière
    const healthScore = this.calculateHealthScore(
      ancienneteAnnees,
      data.capital || 0,
      dernierResultat,
      tendanceCA,
      data.etat_administratif
    );

    return {
      nom: data.nom_entreprise,
      formeJuridique: data.forme_juridique,
      siret: data.siret,
      siren: data.siren,

      codeNAF: data.code_naf,
      libelleNAF: data.libelle_code_naf,

      dateCreation: data.date_creation,
      dateImmatriculation: data.date_immatriculation,
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
      historiqueCA: (data.chiffre_affaires || []).map(ca => ({
        annee: ca.annee,
        valeur: ca.valeur,
      })),

      healthScore,

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
      estActive: data.etat_administratif === 'Actif' || data.etat_administratif === 'Active',
    };
  }

  /**
   * Calculer l'ancienneté en années
   */
  private calculateAnciennete(dateCreation: string): number {
    if (!dateCreation) return 0;
    try {
      const creation = new Date(dateCreation);
      const now = new Date();
      return Math.floor((now.getTime() - creation.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
    } catch {
      return 0;
    }
  }

  /**
   * Calculer la tendance du chiffre d'affaires
   */
  private calculateTendanceCA(historique: Array<{ annee: number; valeur: number }>): 'hausse' | 'baisse' | 'stable' | 'inconnu' {
    if (!historique || historique.length < 2) return 'inconnu';

    // Trier par année
    const sorted = [...historique].sort((a, b) => a.annee - b.annee);
    const recent = sorted.slice(-2);

    if (recent.length < 2) return 'inconnu';

    const diff = recent[1].valeur - recent[0].valeur;
    const percentChange = (diff / recent[0].valeur) * 100;

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
    if (etatAdmin && !['Actif', 'Active'].includes(etatAdmin)) {
      return {
        score: 10,
        niveau: 'faible',
        couleur: '#ef4444', // red-500
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
      scoreResultat = 12; // Neutre si pas de données
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

    // Score total
    const totalScore = scoreAnciennete + scoreCapital + scoreResultat + scoreTendance;

    // Déterminer le niveau et la couleur
    let niveau: HealthScore['niveau'];
    let couleur: string;
    if (totalScore >= 80) {
      niveau = 'excellent';
      couleur = '#10b981'; // emerald-500
    } else if (totalScore >= 60) {
      niveau = 'bon';
      couleur = '#22c55e'; // green-500
    } else if (totalScore >= 40) {
      niveau = 'moyen';
      couleur = '#f59e0b'; // amber-500
    } else {
      niveau = 'faible';
      couleur = '#ef4444'; // red-500
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
