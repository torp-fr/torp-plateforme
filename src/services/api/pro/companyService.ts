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
import { getSireneData, formatSireneAddress } from '@/services/api/external/sirene.service';
import { enrichAddress } from '@/services/api/external/ban.service';
import { enrichWithPappers } from '@/services/api/external/pappers.service';

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
 * Vérifier un numéro SIRET avec APIs open-source (priorité) + enrichissement Pappers
 *
 * Architecture modulaire :
 * 1. API SIRENE open data (gratuite, prioritaire)
 * 2. Base Adresse Nationale (normalisation adresse)
 * 3. Pappers (enrichissement optionnel : capital, dirigeants, CA)
 *
 * AUCUN MOCK : Si données non disponibles, retourne "Non disponible"
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

  // ÉTAPE 1 : Récupérer les données SIRENE (API open data - PRIORITAIRE)
  console.log('🔍 Étape 1/3 : Récupération SIRENE open data...');
  const sireneData = await getSireneData(siretClean);

  if (!sireneData) {
    return {
      valid: false,
      error: 'SIRET non trouvé dans la base SIRENE. Vérifiez le numéro saisi.',
    };
  }

  console.log('✅ Données SIRENE récupérées:', sireneData.denomination);

  // ÉTAPE 2 : Enrichir l'adresse avec BAN (optionnel)
  console.log('🔍 Étape 2/3 : Enrichissement adresse BAN...');
  let adresseComplete = formatSireneAddress(sireneData.adresse);
  let codePostal = sireneData.adresse?.code_postal;
  let ville = sireneData.adresse?.commune;

  // Si adresse incomplète, essayer BAN pour normaliser
  if (!codePostal || !ville) {
    const banAddress = await enrichAddress(
      adresseComplete,
      ville,
      codePostal
    );

    if (banAddress) {
      console.log('✅ Adresse enrichie via BAN');
      adresseComplete = banAddress.label;
      codePostal = banAddress.postcode || codePostal;
      ville = banAddress.city || ville;
    }
  }

  // Préparer les données de base (SIRENE + BAN)
  let finalData = {
    siren: sireneData.siren,
    siret: sireneData.siret,
    raison_sociale: sireneData.denomination || 'Non disponible',
    forme_juridique: sireneData.forme_juridique || 'Non disponible',
    code_naf: sireneData.code_naf || 'Non disponible',
    adresse: adresseComplete || 'Non disponible',
    code_postal: codePostal || 'Non disponible',
    ville: ville || 'Non disponible',
    date_creation: sireneData.date_creation || 'Non disponible',
    effectif: sireneData.tranche_effectif || 'Non disponible',
  };

  // ÉTAPE 3 : Enrichissement optionnel avec Pappers (données financières, dirigeants)
  console.log('🔍 Étape 3/3 : Enrichissement Pappers (optionnel)...');
  try {
    const enrichedData = await enrichWithPappers(finalData);

    if (enrichedData.capital_social || enrichedData.dirigeants) {
      console.log('✅ Données enrichies via Pappers');
      finalData = enrichedData;
    } else {
      console.log('ℹ️ Pappers non configuré ou données non disponibles');
    }
  } catch (error) {
    console.log('ℹ️ Enrichissement Pappers échoué (non bloquant)');
  }

  return {
    valid: true,
    data: finalData,
  };
}
