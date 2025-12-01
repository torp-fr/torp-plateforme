/**
 * TORP B2B - Service API Documents Entreprise
 *
 * TODO: Implémenter les appels API pour la gestion des documents
 *
 * Endpoints à implémenter:
 * - GET /api/pro/documents - Lister les documents de l'entreprise
 * - POST /api/pro/documents - Upload d'un nouveau document
 * - GET /api/pro/documents/:id - Récupérer un document
 * - PUT /api/pro/documents/:id - Mettre à jour un document
 * - DELETE /api/pro/documents/:id - Supprimer un document
 */

import { supabase } from '@/lib/supabase';

export type CompanyDocType =
  | 'KBIS'
  | 'ATTESTATION_URSSAF'
  | 'ATTESTATION_VIGILANCE'
  | 'ASSURANCE_DECENNALE'
  | 'ASSURANCE_RC_PRO'
  | 'CERTIFICATION_QUALIBAT'
  | 'CERTIFICATION_RGE'
  | 'CERTIFICATION_QUALIFELEC'
  | 'CERTIFICATION_QUALIPAC'
  | 'LABEL_AUTRE'
  | 'AUTRE';

export type DocStatus = 'PENDING' | 'VALID' | 'EXPIRING' | 'EXPIRED' | 'INVALID';

export interface CompanyDocument {
  id: string;
  company_id: string;
  type: CompanyDocType;
  nom: string;
  file_url: string;
  file_name: string;
  file_size?: number;
  mime_type?: string;
  date_emission?: string;
  date_expiration?: string;
  numero_document?: string;
  emetteur?: string;
  statut: DocStatus;
  date_verification?: string;
  verification_notes?: string;
  metadata?: Record<string, any>;
  uploaded_at: string;
}

export interface UploadDocumentData {
  company_id: string;
  type: CompanyDocType;
  nom: string;
  file: File;
  date_emission?: string;
  date_expiration?: string;
  numero_document?: string;
  emetteur?: string;
}

/**
 * TODO: Lister tous les documents de l'entreprise
 */
export async function listCompanyDocuments(companyId: string): Promise<CompanyDocument[]> {
  // TODO: Implémenter l'appel Supabase
  throw new Error('Not implemented');
}

/**
 * TODO: Récupérer un document spécifique
 */
export async function getCompanyDocument(documentId: string): Promise<CompanyDocument | null> {
  // TODO: Implémenter l'appel Supabase
  throw new Error('Not implemented');
}

/**
 * TODO: Upload d'un nouveau document
 */
export async function uploadCompanyDocument(data: UploadDocumentData): Promise<CompanyDocument> {
  // TODO: 1. Upload du fichier vers Supabase Storage
  // TODO: 2. Créer l'entrée dans la table company_documents
  // TODO: 3. (Optionnel) Extraire les métadonnées du document (OCR)
  throw new Error('Not implemented');
}

/**
 * TODO: Mettre à jour les métadonnées d'un document
 */
export async function updateCompanyDocument(
  documentId: string,
  data: Partial<CompanyDocument>
): Promise<CompanyDocument> {
  // TODO: Implémenter l'appel Supabase
  throw new Error('Not implemented');
}

/**
 * TODO: Supprimer un document
 */
export async function deleteCompanyDocument(documentId: string): Promise<void> {
  // TODO: 1. Supprimer le fichier de Supabase Storage
  // TODO: 2. Supprimer l'entrée de la base de données
  throw new Error('Not implemented');
}

/**
 * TODO: Vérifier les documents expirant bientôt (< 30 jours)
 */
export async function checkExpiringDocuments(companyId: string): Promise<CompanyDocument[]> {
  // TODO: Implémenter la requête pour récupérer les documents expirant dans moins de 30 jours
  throw new Error('Not implemented');
}
