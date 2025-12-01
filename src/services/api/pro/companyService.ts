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
 * TODO: Récupérer le profil entreprise de l'utilisateur connecté
 */
export async function getCompanyProfile(): Promise<CompanyProfile | null> {
  // TODO: Implémenter l'appel Supabase
  throw new Error('Not implemented');
}

/**
 * TODO: Créer un nouveau profil entreprise
 */
export async function createCompanyProfile(
  data: Omit<CompanyProfile, 'id' | 'created_at' | 'updated_at'>
): Promise<CompanyProfile> {
  // TODO: Implémenter l'appel Supabase
  throw new Error('Not implemented');
}

/**
 * TODO: Mettre à jour le profil entreprise
 */
export async function updateCompanyProfile(
  id: string,
  data: Partial<CompanyProfile>
): Promise<CompanyProfile> {
  // TODO: Implémenter l'appel Supabase
  throw new Error('Not implemented');
}

/**
 * TODO: Supprimer le profil entreprise
 */
export async function deleteCompanyProfile(id: string): Promise<void> {
  // TODO: Implémenter l'appel Supabase
  throw new Error('Not implemented');
}

/**
 * TODO: Vérifier un numéro SIRET via API externe (Pappers, INSEE, etc.)
 */
export async function verifySiret(siret: string): Promise<VerifySiretResponse> {
  // TODO: Implémenter l'appel à l'API externe de vérification SIRET
  // Utiliser l'API Pappers ou l'API Entreprise Data Gouv
  throw new Error('Not implemented');
}
