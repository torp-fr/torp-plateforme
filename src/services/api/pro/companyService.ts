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
 * Vérifier un numéro SIRET via API Entreprise (API gouvernementale gratuite)
 *
 * Documentation: https://api.gouv.fr/les-api/api-entreprise
 * Fallback vers mock si VITE_API_ENTREPRISE_TOKEN non configuré
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

  // Vérifier si l'API Entreprise est configurée
  const API_KEY = import.meta.env.VITE_API_ENTREPRISE_TOKEN;

  if (!API_KEY) {
    console.warn('⚠️ VITE_API_ENTREPRISE_TOKEN non configuré, utilisation du mock');
    return await verifySiretMock(siretClean);
  }

  try {
    const siren = siretClean.substring(0, 9);

    // 1. Récupérer les informations de l'unité légale (entreprise)
    const uniteResponse = await fetch(
      `https://entreprise.api.gouv.fr/v3/insee/sirene/unites_legales/${siren}`,
      {
        headers: {
          'Authorization': `Bearer ${API_KEY}`,
          'Accept': 'application/json'
        }
      }
    );

    if (!uniteResponse.ok) {
      if (uniteResponse.status === 404) {
        return { valid: false, error: 'SIREN non trouvé dans la base SIRENE' };
      }
      if (uniteResponse.status === 401 || uniteResponse.status === 403) {
        console.error('❌ API Entreprise: Token invalide ou non autorisé');
        return { valid: false, error: 'Erreur d\'authentification API Entreprise' };
      }
      return { valid: false, error: 'API Entreprise temporairement indisponible' };
    }

    const uniteData = await uniteResponse.json();
    const unite = uniteData.data?.unite_legale;

    if (!unite) {
      return { valid: false, error: 'Données entreprise non disponibles' };
    }

    // 2. Récupérer les informations de l'établissement (adresse, etc.)
    const etablissementResponse = await fetch(
      `https://entreprise.api.gouv.fr/v3/insee/sirene/etablissements/${siretClean}`,
      {
        headers: {
          'Authorization': `Bearer ${API_KEY}`,
          'Accept': 'application/json'
        }
      }
    );

    let etablissement = null;
    if (etablissementResponse.ok) {
      const etablissementData = await etablissementResponse.json();
      etablissement = etablissementData.data?.etablissement;
    }

    // 3. Construire la réponse avec les données récupérées
    return {
      valid: true,
      data: {
        siren: unite.siren,
        siret: siretClean,
        raison_sociale: unite.personne_morale_attributs?.raison_sociale || unite.denomination || 'Non renseigné',
        forme_juridique: unite.forme_juridique?.libelle,
        code_naf: unite.activite_principale,
        adresse: etablissement?.adresse
          ? `${etablissement.adresse.numero_voie || ''} ${etablissement.adresse.type_voie || ''} ${etablissement.adresse.libelle_voie || ''}`.trim()
          : undefined,
        code_postal: etablissement?.adresse?.code_postal,
        ville: etablissement?.adresse?.libelle_commune,
        date_creation: unite.date_creation,
        effectif: etablissement?.tranche_effectifs?.libelle,
      },
    };
  } catch (error) {
    console.error('❌ Erreur API Entreprise:', error);

    // En cas d'erreur réseau, fallback vers mock
    if (error instanceof TypeError && error.message.includes('fetch')) {
      console.warn('⚠️ Erreur réseau, utilisation du mock');
      return await verifySiretMock(siretClean);
    }

    return { valid: false, error: 'Erreur lors de la vérification SIRET' };
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
