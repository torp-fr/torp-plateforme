/**
 * SIRET Lookup Service
 * Récupération des informations entreprise via SIRET
 * Utilise l'API Pappers ou fallback vers data.gouv.fr (Sirene)
 */

export interface CompanyLookupResult {
  siret: string;
  siren: string;
  raisonSociale: string;
  formeJuridique?: string;
  codeApe?: string;
  libelleApe?: string;
  dateCreation?: string;
  capital?: number;
  effectif?: string;
  effectifMin?: number;
  effectifMax?: number;
  adresse?: {
    voie?: string;
    codePostal?: string;
    ville?: string;
    complete?: string;
  };
  dirigeant?: {
    nom?: string;
    prenom?: string;
    fonction?: string;
  };
  tvaIntracommunautaire?: string;
  rcs?: string;
  codeInsee?: string;
  estActif: boolean;
}

export interface SiretLookupError {
  code: 'INVALID_SIRET' | 'NOT_FOUND' | 'API_ERROR' | 'RATE_LIMITED';
  message: string;
}

// Tranches d'effectif INSEE
const EFFECTIF_TRANCHES: Record<string, { label: string; min: number; max: number }> = {
  '00': { label: '0 salarié', min: 0, max: 0 },
  '01': { label: '1 ou 2 salariés', min: 1, max: 2 },
  '02': { label: '3 à 5 salariés', min: 3, max: 5 },
  '03': { label: '6 à 9 salariés', min: 6, max: 9 },
  '11': { label: '10 à 19 salariés', min: 10, max: 19 },
  '12': { label: '20 à 49 salariés', min: 20, max: 49 },
  '21': { label: '50 à 99 salariés', min: 50, max: 99 },
  '22': { label: '100 à 199 salariés', min: 100, max: 199 },
  '31': { label: '200 à 249 salariés', min: 200, max: 249 },
  '32': { label: '250 à 499 salariés', min: 250, max: 499 },
  '41': { label: '500 à 999 salariés', min: 500, max: 999 },
  '42': { label: '1000 à 1999 salariés', min: 1000, max: 1999 },
  '51': { label: '2000 à 4999 salariés', min: 2000, max: 4999 },
  '52': { label: '5000 à 9999 salariés', min: 5000, max: 9999 },
  '53': { label: '10000 salariés et plus', min: 10000, max: 100000 },
};

export class SiretLookupService {
  private static PAPPERS_API_KEY = import.meta.env.VITE_PAPPERS_API_KEY;
  private static SIRENE_API_URL = 'https://api.insee.fr/entreprises/sirene/V3.11';

  /**
   * Valider le format SIRET (14 chiffres)
   * Note: La validation Luhn n'est plus bloquante car certains SIRET français
   * valides ne passent pas cet algorithme (exceptions historiques comme La Poste)
   */
  static validateSiret(siret: string): boolean {
    const cleaned = siret.replace(/\s/g, '');
    // Valider uniquement le format (14 chiffres)
    if (!/^\d{14}$/.test(cleaned)) return false;

    // Validation Luhn optionnelle (avertissement seulement)
    let sum = 0;
    for (let i = 0; i < 14; i++) {
      let digit = parseInt(cleaned[i], 10);
      if (i % 2 === 0) {
        digit *= 2;
        if (digit > 9) digit -= 9;
      }
      sum += digit;
    }
    if (sum % 10 !== 0) {
      console.warn('[SiretLookup] SIRET ne passe pas la validation Luhn (peut être une exception historique):', cleaned);
    }

    return true;
  }

  /**
   * Formater SIRET avec espaces
   */
  static formatSiret(siret: string): string {
    const cleaned = siret.replace(/\s/g, '');
    return `${cleaned.slice(0, 3)} ${cleaned.slice(3, 6)} ${cleaned.slice(6, 9)} ${cleaned.slice(9, 14)}`;
  }

  /**
   * Extraire SIREN du SIRET
   */
  static getSirenFromSiret(siret: string): string {
    return siret.replace(/\s/g, '').slice(0, 9);
  }

  /**
   * Rechercher une entreprise par SIRET
   */
  static async lookupBySiret(siret: string): Promise<CompanyLookupResult> {
    const cleanedSiret = siret.replace(/\s/g, '');

    if (!this.validateSiret(cleanedSiret)) {
      throw { code: 'INVALID_SIRET', message: 'Numéro SIRET invalide' } as SiretLookupError;
    }

    // Essayer Pappers d'abord si clé API disponible
    if (this.PAPPERS_API_KEY) {
      try {
        return await this.lookupViaPappers(cleanedSiret);
      } catch (error) {
        console.warn('[SiretLookup] Pappers failed, falling back to Sirene:', error);
      }
    }

    // Fallback vers API Sirene (data.gouv.fr - gratuit mais limité)
    return await this.lookupViaSirene(cleanedSiret);
  }

  /**
   * Recherche via API Pappers (payante mais complète)
   */
  private static async lookupViaPappers(siret: string): Promise<CompanyLookupResult> {
    const response = await fetch(
      `https://api.pappers.fr/v2/entreprise?siret=${siret}&api_token=${this.PAPPERS_API_KEY}`
    );

    if (!response.ok) {
      if (response.status === 404) {
        throw { code: 'NOT_FOUND', message: 'Entreprise non trouvée' } as SiretLookupError;
      }
      if (response.status === 429) {
        throw { code: 'RATE_LIMITED', message: 'Trop de requêtes, réessayez plus tard' } as SiretLookupError;
      }
      throw { code: 'API_ERROR', message: 'Erreur API Pappers' } as SiretLookupError;
    }

    const data = await response.json();

    // Trouver l'établissement correspondant au SIRET
    const etablissement = data.etablissements?.find((e: any) => e.siret === siret) || data.siege;

    return {
      siret,
      siren: data.siren,
      raisonSociale: data.nom_entreprise || data.denomination,
      formeJuridique: data.forme_juridique,
      codeApe: data.code_naf,
      libelleApe: data.libelle_code_naf,
      dateCreation: data.date_creation,
      capital: data.capital ? parseInt(data.capital, 10) : undefined,
      effectif: data.effectif,
      effectifMin: data.effectif_min,
      effectifMax: data.effectif_max,
      adresse: etablissement ? {
        voie: `${etablissement.numero_voie || ''} ${etablissement.type_voie || ''} ${etablissement.libelle_voie || ''}`.trim(),
        codePostal: etablissement.code_postal,
        ville: etablissement.libelle_commune,
        complete: etablissement.adresse_ligne_1,
      } : undefined,
      dirigeant: data.representants?.[0] ? {
        nom: data.representants[0].nom,
        prenom: data.representants[0].prenom,
        fonction: data.representants[0].qualite,
      } : undefined,
      tvaIntracommunautaire: data.numero_tva_intracommunautaire,
      rcs: data.numero_rcs,
      estActif: !data.entreprise_cessee,
    };
  }

  /**
   * Recherche via API Sirene (INSEE - gratuit)
   */
  private static async lookupViaSirene(siret: string): Promise<CompanyLookupResult> {
    // API publique de recherche d'entreprises (entreprise.data.gouv.fr)
    const response = await fetch(
      `https://recherche-entreprises.api.gouv.fr/search?q=${siret}&per_page=1`
    );

    if (!response.ok) {
      throw { code: 'API_ERROR', message: 'Erreur API Sirene' } as SiretLookupError;
    }

    const data = await response.json();

    if (!data.results || data.results.length === 0) {
      throw { code: 'NOT_FOUND', message: 'Entreprise non trouvée' } as SiretLookupError;
    }

    const company = data.results[0];
    const siege = company.siege;
    const effectifTranche = EFFECTIF_TRANCHES[company.tranche_effectif_salarie] || null;

    return {
      siret: siege?.siret || siret,
      siren: company.siren,
      raisonSociale: company.nom_complet || company.nom_raison_sociale,
      formeJuridique: company.nature_juridique,
      codeApe: company.activite_principale,
      libelleApe: company.libelle_activite_principale,
      dateCreation: company.date_creation,
      capital: undefined, // Non disponible via cette API
      effectif: effectifTranche?.label,
      effectifMin: effectifTranche?.min,
      effectifMax: effectifTranche?.max,
      adresse: siege ? {
        voie: siege.adresse,
        codePostal: siege.code_postal,
        ville: siege.libelle_commune,
        complete: `${siege.adresse || ''}, ${siege.code_postal || ''} ${siege.libelle_commune || ''}`.trim(),
      } : undefined,
      dirigeant: company.dirigeants?.[0] ? {
        nom: company.dirigeants[0].nom,
        prenom: company.dirigeants[0].prenom,
        fonction: company.dirigeants[0].qualite,
      } : undefined,
      codeInsee: siege?.commune,
      estActif: company.etat_administratif === 'A',
    };
  }

  /**
   * Recherche par nom d'entreprise (pour autocomplétion)
   */
  static async searchByName(query: string, limit: number = 10): Promise<CompanyLookupResult[]> {
    if (!query || query.length < 3) return [];

    try {
      const response = await fetch(
        `https://recherche-entreprises.api.gouv.fr/search?q=${encodeURIComponent(query)}&per_page=${limit}`
      );

      if (!response.ok) return [];

      const data = await response.json();

      return (data.results || []).map((company: any) => {
        const siege = company.siege;
        const effectifTranche = EFFECTIF_TRANCHES[company.tranche_effectif_salarie] || null;

        return {
          siret: siege?.siret || '',
          siren: company.siren,
          raisonSociale: company.nom_complet || company.nom_raison_sociale,
          codeApe: company.activite_principale,
          libelleApe: company.libelle_activite_principale,
          dateCreation: company.date_creation,
          effectif: effectifTranche?.label,
          effectifMin: effectifTranche?.min,
          effectifMax: effectifTranche?.max,
          adresse: siege ? {
            ville: siege.libelle_commune,
            codePostal: siege.code_postal,
          } : undefined,
          estActif: company.etat_administratif === 'A',
        } as CompanyLookupResult;
      });
    } catch (error) {
      console.error('[SiretLookup] Search by name failed:', error);
      return [];
    }
  }
}

export default SiretLookupService;
