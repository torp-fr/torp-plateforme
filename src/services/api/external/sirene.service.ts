/**
 * Service API SIRENE (INSEE) - Open Data gratuite
 * Documentation: https://api.insee.fr/catalogue/
 *
 * Données disponibles:
 * - Informations entreprise (dénomination, forme juridique)
 * - Établissement (adresse, NAF, effectif)
 * - Données officielles à jour
 */

export interface SireneData {
  siren: string;
  siret: string;
  denomination: string;
  forme_juridique?: string;
  code_naf?: string;
  adresse?: {
    numero_voie?: string;
    type_voie?: string;
    libelle_voie?: string;
    code_postal?: string;
    commune?: string;
  };
  date_creation?: string;
  tranche_effectif?: string;
}

/**
 * Récupérer les informations d'un SIRET via API SIRENE open data
 * Gratuit, sans authentification
 */
export async function getSireneData(siret: string): Promise<SireneData | null> {
  try {
    const siretClean = siret.replace(/\s/g, '');

    const response = await fetch(
      `https://api.insee.fr/entreprises/sirene/V3/siret/${siretClean}`,
      {
        headers: {
          'Accept': 'application/json'
        }
      }
    );

    if (!response.ok) {
      console.warn(`❌ SIRENE API: ${response.status} - ${response.statusText}`);
      return null;
    }

    const data = await response.json();
    const etablissement = data.etablissement;
    const uniteLegale = etablissement?.uniteLegale;
    const adresse = etablissement?.adresseEtablissement;

    if (!etablissement) {
      return null;
    }

    return {
      siren: uniteLegale?.siren || siretClean.substring(0, 9),
      siret: etablissement.siret,
      denomination: uniteLegale?.denominationUniteLegale ||
                    etablissement.denominationUsuelleEtablissement ||
                    'Non renseigné',
      forme_juridique: uniteLegale?.categorieJuridiqueUniteLegale,
      code_naf: etablissement.activitePrincipaleEtablissement,
      adresse: adresse ? {
        numero_voie: adresse.numeroVoieEtablissement,
        type_voie: adresse.typeVoieEtablissement,
        libelle_voie: adresse.libelleVoieEtablissement,
        code_postal: adresse.codePostalEtablissement,
        commune: adresse.libelleCommuneEtablissement,
      } : undefined,
      date_creation: uniteLegale?.dateCreationUniteLegale,
      tranche_effectif: etablissement.trancheEffectifsEtablissement,
    };
  } catch (error) {
    console.error('❌ Erreur SIRENE API:', error);
    return null;
  }
}

/**
 * Formater l'adresse complète depuis les données SIRENE
 */
export function formatSireneAddress(adresse?: SireneData['adresse']): string | undefined {
  if (!adresse) return undefined;

  const parts = [
    adresse.numero_voie,
    adresse.type_voie,
    adresse.libelle_voie
  ].filter(Boolean);

  return parts.length > 0 ? parts.join(' ').trim() : undefined;
}
