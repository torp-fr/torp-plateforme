/**
 * Service API Pappers - Données enrichies (payant)
 * Documentation: https://www.pappers.fr/api/documentation
 *
 * Utilisé en complément des APIs open-source pour enrichir les données :
 * - Informations financières (capital social, chiffre d'affaires)
 * - Dirigeants et bénéficiaires
 * - Historique et modifications
 * - Données plus détaillées et mises à jour fréquemment
 */

export interface PappersData {
  siren: string;
  siret: string;
  nom_entreprise: string;
  forme_juridique?: string;
  code_naf?: string;
  siege: {
    siret?: string;
    adresse_ligne_1?: string;
    code_postal?: string;
    ville?: string;
    effectif?: string;
  };
  date_creation?: string;
  // Données enrichies (non disponibles dans SIRENE)
  capital_social?: number;
  chiffre_affaires?: number;
  resultat?: number;
  dirigeants?: Array<{
    nom: string;
    prenom: string;
    qualite: string;
  }>;
}

/**
 * Récupérer les données enrichies via Pappers
 * Nécessite VITE_PAPPERS_API_KEY
 */
export async function getPappersData(siret: string): Promise<PappersData | null> {
  const API_KEY = import.meta.env.VITE_PAPPERS_API_KEY;

  if (!API_KEY) {
    console.warn('⚠️ VITE_PAPPERS_API_KEY non configurée, enrichissement Pappers désactivé');
    return null;
  }

  try {
    const siretClean = siret.replace(/\s/g, '');

    const response = await fetch(
      `https://api.pappers.fr/v2/entreprise?siret=${siretClean}&api_token=${API_KEY}`
    );

    if (!response.ok) {
      console.warn(`❌ Pappers API: ${response.status}`);
      return null;
    }

    const data = await response.json();

    if (!data.siren) {
      return null;
    }

    return {
      siren: data.siren,
      siret: data.siege?.siret || siretClean,
      nom_entreprise: data.nom_entreprise || 'Non renseigné',
      forme_juridique: data.forme_juridique,
      code_naf: data.code_naf,
      siege: {
        siret: data.siege?.siret,
        adresse_ligne_1: data.siege?.adresse_ligne_1,
        code_postal: data.siege?.code_postal,
        ville: data.siege?.ville,
        effectif: data.siege?.effectif,
      },
      date_creation: data.date_creation,
      capital_social: data.capital_social,
      chiffre_affaires: data.derniers_bilans?.[0]?.chiffre_affaires,
      resultat: data.derniers_bilans?.[0]?.resultat,
      dirigeants: data.representants?.map((r: any) => ({
        nom: r.nom,
        prenom: r.prenom,
        qualite: r.qualite,
      })),
    };
  } catch (error) {
    console.error('❌ Erreur Pappers API:', error);
    return null;
  }
}

/**
 * Enrichir des données SIRENE avec Pappers
 * Complète les informations manquantes
 */
export async function enrichWithPappers(
  sireneData: any
): Promise<any> {
  const pappersData = await getPappersData(sireneData.siret);

  if (!pappersData) {
    return sireneData; // Retourner les données SIRENE sans enrichissement
  }

  // Fusionner les données : SIRENE + Pappers (Pappers complète)
  return {
    ...sireneData,
    // Compléter avec Pappers si SIRENE n'a pas les infos
    raison_sociale: sireneData.denomination || pappersData.nom_entreprise,
    forme_juridique: sireneData.forme_juridique || pappersData.forme_juridique,
    // Données enrichies uniquement disponibles dans Pappers
    capital_social: pappersData.capital_social,
    chiffre_affaires: pappersData.chiffre_affaires,
    resultat: pappersData.resultat,
    dirigeants: pappersData.dirigeants,
  };
}
