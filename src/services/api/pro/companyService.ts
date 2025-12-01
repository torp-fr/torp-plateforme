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
    date_creation?: string;
    // ... autres données de l'API
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
 * Vérifier un numéro SIRET via API externe
 *
 * Version mock pour développement.
 * En production, remplacer par un appel à l'API Pappers ou API Entreprise.
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

  // TODO: En production, utiliser une vraie API
  // Exemple avec Pappers API:
  /*
  const response = await fetch(
    `https://api.pappers.fr/v2/entreprise?siret=${siretClean}&api_token=${import.meta.env.VITE_PAPPERS_API_KEY}`
  );

  if (!response.ok) {
    return { valid: false, error: 'Erreur lors de la vérification' };
  }

  const data = await response.json();

  return {
    valid: !!data.siren,
    data: {
      siren: data.siren,
      siret: data.siege.siret,
      raison_sociale: data.nom_entreprise,
      forme_juridique: data.forme_juridique,
      code_naf: data.code_naf,
      adresse: data.siege.adresse_ligne_1,
      date_creation: data.date_creation,
    },
  };
  */

  // Version MOCK pour développement
  console.warn('⚠️ Utilisation de la version MOCK de verifySiret. Configurer l\'API Pappers pour la production.');

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
      adresse: '123 Rue de Test, 75001 Paris',
      date_creation: '2020-01-15',
    },
  };
}
