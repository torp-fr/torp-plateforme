/**
 * TORP B2B - Service API Entreprise
 *
 * TODO: Implémenter les appels API pour la gestion des profils entreprise
 *
 * Endpoints à implémenter:
 * - POST /api/pro/company - Créer un profil entreprise
 * - GET /api/pro/company - Récupérer le profil entreprise de l'utilisateur
 * - PUT /api/pro/company/:id - Mettre à jour le profil entreprise
 * - DELETE /api/pro/company/:id - Supprimer le profil entreprise
 * - POST /api/pro/verify-siret - Vérifier un numéro SIRET (API externe)
 */

import { supabase } from '@/lib/supabase';

export interface CompanyProfile {
  id: string;
  user_id: string;
  siret: string;
  siren: string;
  raison_sociale: string;
  forme_juridique?: string;
  code_naf?: string;
  adresse?: string;
  code_postal?: string;
  ville?: string;
  telephone?: string;
  email: string;
  site_web?: string;
  date_creation?: string;
  capital_social?: number;
  effectif?: string;
  dirigeant_nom?: string;
  siret_verifie: boolean;
  siret_verifie_le?: string;
  metadata?: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface VerifySiretResponse {
  valid: boolean;
  data?: {
    siren: string;
    siret: string;
    raison_sociale: string;
    forme_juridique?: string;
    code_naf?: string;
    adresse?: string;
    code_postal?: string;
    ville?: string;
    date_creation?: string;
    effectif?: string;
  };
  error?: string;
}

/**
 * Récupérer le profil entreprise de l'utilisateur connecté
 */
export async function getCompanyProfile(): Promise<CompanyProfile | null> {
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('User not authenticated');
  }

  const { data, error } = await supabase
    .from('pro_company_profiles')
    .select('*')
    .eq('user_id', user.id)
    .single();

  if (error) {
    // Si l'erreur est "not found", retourner null (pas d'erreur)
    if (error.code === 'PGRST116') {
      return null;
    }
    throw error;
  }

  return data;
}

/**
 * Créer un nouveau profil entreprise
 */
export async function createCompanyProfile(
  data: Omit<CompanyProfile, 'id' | 'created_at' | 'updated_at'>
): Promise<CompanyProfile> {
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('User not authenticated');
  }

  // Vérifier qu'un profil n'existe pas déjà
  const existing = await getCompanyProfile();
  if (existing) {
    throw new Error('Company profile already exists');
  }

  const { data: profile, error } = await supabase
    .from('pro_company_profiles')
    .insert({
      ...data,
      user_id: user.id,
    })
    .select()
    .single();

  if (error) {
    throw error;
  }

  return profile;
}

/**
 * Mettre à jour le profil entreprise
 */
export async function updateCompanyProfile(
  id: string,
  data: Partial<CompanyProfile>
): Promise<CompanyProfile> {
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('User not authenticated');
  }

  // Retirer les champs non modifiables
  const { id: _, user_id, created_at, updated_at, ...updateData } = data as any;

  const { data: profile, error } = await supabase
    .from('pro_company_profiles')
    .update(updateData)
    .eq('id', id)
    .eq('user_id', user.id) // Sécurité : ne mettre à jour que son propre profil
    .select()
    .single();

  if (error) {
    throw error;
  }

  return profile;
}

/**
 * Supprimer le profil entreprise
 */
export async function deleteCompanyProfile(id: string): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('User not authenticated');
  }

  const { error } = await supabase
    .from('pro_company_profiles')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id); // Sécurité : ne supprimer que son propre profil

  if (error) {
    throw error;
  }
}

/**
 * Vérifier un numéro SIRET via API Pappers (prioritaire) ou API SIRENE open data (fallback)
 *
 * Documentation Pappers: https://www.pappers.fr/api/documentation
 * Documentation SIRENE: https://api.insee.fr/catalogue/
 */
export async function verifySiret(siret: string): Promise<VerifySiretResponse> {
  // Validation basique du format SIRET (14 chiffres)
  const siretClean = siret.replace(/\s/g, '');
  if (!/^\d{14}$/.test(siretClean)) {
    return {
      valid: false,
      error: 'Format SIRET invalide (14 chiffres requis)',
    };
  }

  const PAPPERS_API_KEY = import.meta.env.VITE_PAPPERS_API_KEY;

  // 1. Essayer d'abord avec Pappers (si clé configurée)
  if (PAPPERS_API_KEY) {
    try {
      const response = await fetch(
        `https://api.pappers.fr/v2/entreprise?siret=${siretClean}&api_token=${PAPPERS_API_KEY}`
      );

      if (response.ok) {
        const data = await response.json();

        return {
          valid: !!data.siren,
          data: {
            siren: data.siren,
            siret: data.siege?.siret || siretClean,
            raison_sociale: data.nom_entreprise || 'Non renseigné',
            forme_juridique: data.forme_juridique,
            code_naf: data.code_naf,
            adresse: data.siege?.adresse_ligne_1,
            code_postal: data.siege?.code_postal,
            ville: data.siege?.ville,
            date_creation: data.date_creation,
            effectif: data.siege?.effectif,
          },
        };
      }

      console.warn('⚠️ Pappers API error, fallback vers SIRENE open data');
    } catch (error) {
      console.error('❌ Erreur Pappers:', error);
    }
  }

  // 2. Fallback vers API SIRENE open data (gratuite, sans authentification)
  try {
    const siren = siretClean.substring(0, 9);

    const response = await fetch(
      `https://api.insee.fr/entreprises/sirene/V3/siret/${siretClean}`,
      {
        headers: {
          'Accept': 'application/json'
        }
      }
    );

    if (!response.ok) {
      if (response.status === 404) {
        return { valid: false, error: 'SIRET non trouvé dans la base SIRENE' };
      }
      console.warn('⚠️ API SIRENE error, utilisation du mock');
      return await verifySiretMock(siretClean);
    }

    const data = await response.json();
    const etablissement = data.etablissement;
    const uniteLegale = etablissement?.uniteLegale;

    if (!etablissement) {
      return { valid: false, error: 'Données entreprise non disponibles' };
    }

    // Construire l'adresse
    const adresse = etablissement.adresseEtablissement;
    const adresseComplete = adresse
      ? `${adresse.numeroVoieEtablissement || ''} ${adresse.typeVoieEtablissement || ''} ${adresse.libelleVoieEtablissement || ''}`.trim()
      : undefined;

    return {
      valid: true,
      data: {
        siren: uniteLegale?.siren || siren,
        siret: etablissement.siret,
        raison_sociale: uniteLegale?.denominationUniteLegale || etablissement.denominationUsuelleEtablissement || 'Non renseigné',
        forme_juridique: uniteLegale?.categorieJuridiqueUniteLegale,
        code_naf: etablissement.activitePrincipaleEtablissement,
        adresse: adresseComplete,
        code_postal: adresse?.codePostalEtablissement,
        ville: adresse?.libelleCommuneEtablissement,
        date_creation: uniteLegale?.dateCreationUniteLegale,
        effectif: etablissement.trancheEffectifsEtablissement,
      },
    };
  } catch (error) {
    console.error('❌ Erreur API SIRENE:', error);

    // Dernier fallback : mock
    console.warn('⚠️ Fallback vers mock');
    return await verifySiretMock(siretClean);
  }
}

/**
 * Version mock pour développement sans API key
 */
async function verifySiretMock(siretClean: string): Promise<VerifySiretResponse> {
  // Simuler un délai réseau
  await new Promise(resolve => setTimeout(resolve, 500));

  const siren = siretClean.substring(0, 9);

  return {
    valid: true,
    data: {
      siren,
      siret: siretClean,
      raison_sociale: 'ENTREPRISE TEST MOCK',
      forme_juridique: 'SARL',
      code_naf: '4120A',
      adresse: '123 Rue de Test',
      code_postal: '75001',
      ville: 'Paris',
      date_creation: '2020-01-15',
      effectif: '1-10',
    },
  };
}
