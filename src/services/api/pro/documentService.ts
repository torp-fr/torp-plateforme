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
 * Lister tous les documents de l'entreprise
 */
export async function listCompanyDocuments(companyId: string): Promise<CompanyDocument[]> {
  const { data, error } = await supabase
    .from('company_documents')
    .select('*')
    .eq('company_id', companyId)
    .order('uploaded_at', { ascending: false });

  if (error) {
    throw error;
  }

  return data || [];
}

/**
 * Récupérer un document spécifique
 */
export async function getCompanyDocument(documentId: string): Promise<CompanyDocument | null> {
  const { data, error } = await supabase
    .from('company_documents')
    .select('*')
    .eq('id', documentId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null;
    }
    throw error;
  }

  return data;
}

/**
 * Upload d'un nouveau document
 */
export async function uploadCompanyDocument(data: UploadDocumentData): Promise<CompanyDocument> {
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('User not authenticated');
  }

  const { file, company_id, type, nom, ...metadata } = data;

  // 1. Générer un nom de fichier unique
  const fileExt = file.name.split('.').pop();
  const fileName = `${user.id}/${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;

  // 2. Upload du fichier vers Supabase Storage
  const { data: uploadData, error: uploadError } = await supabase.storage
    .from('company-documents')
    .upload(fileName, file, {
      contentType: file.type,
      upsert: false,
    });

  if (uploadError) {
    throw uploadError;
  }

  // 3. Récupérer l'URL publique du fichier
  const { data: { publicUrl } } = supabase.storage
    .from('company-documents')
    .getPublicUrl(fileName);

  // 4. Créer l'entrée dans la base de données
  const { data: document, error: dbError } = await supabase
    .from('company_documents')
    .insert({
      company_id,
      type,
      nom,
      file_url: publicUrl,
      file_name: file.name,
      file_size: file.size,
      mime_type: file.type,
      ...metadata,
      statut: 'PENDING',
    })
    .select()
    .single();

  if (dbError) {
    // Si l'insertion DB échoue, supprimer le fichier uploadé
    await supabase.storage
      .from('company-documents')
      .remove([fileName]);

    throw dbError;
  }

  return document;
}

/**
 * Mettre à jour les métadonnées d'un document
 */
export async function updateCompanyDocument(
  documentId: string,
  data: Partial<CompanyDocument>
): Promise<CompanyDocument> {
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('User not authenticated');
  }

  // Retirer les champs non modifiables
  const { id: _, company_id, file_url, file_name, uploaded_at, ...updateData } = data as any;

  const { data: document, error } = await supabase
    .from('company_documents')
    .update(updateData)
    .eq('id', documentId)
    .select()
    .single();

  if (error) {
    throw error;
  }

  return document;
}

/**
 * Supprimer un document
 */
export async function deleteCompanyDocument(documentId: string): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('User not authenticated');
  }

  // 1. Récupérer le document pour obtenir le file_url
  const document = await getCompanyDocument(documentId);

  if (!document) {
    throw new Error('Document not found');
  }

  // 2. Extraire le nom du fichier depuis l'URL
  const fileName = document.file_url.split('/').pop();

  if (fileName) {
    // 3. Supprimer le fichier du Storage
    const { error: storageError } = await supabase.storage
      .from('company-documents')
      .remove([`${user.id}/${fileName}`]);

    if (storageError) {
      console.error('Error deleting file from storage:', storageError);
    }
  }

  // 4. Supprimer l'entrée de la base de données
  const { error: dbError } = await supabase
    .from('company_documents')
    .delete()
    .eq('id', documentId);

  if (dbError) {
    throw dbError;
  }
}

/**
 * Vérifier les documents expirant bientôt (< 30 jours)
 */
export async function checkExpiringDocuments(companyId: string): Promise<CompanyDocument[]> {
  // Date dans 30 jours
  const thirtyDaysFromNow = new Date();
  thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

  const { data, error } = await supabase
    .from('company_documents')
    .select('*')
    .eq('company_id', companyId)
    .not('date_expiration', 'is', null)
    .lte('date_expiration', thirtyDaysFromNow.toISOString())
    .gte('date_expiration', new Date().toISOString()) // Pas encore expiré
    .order('date_expiration', { ascending: true });

  if (error) {
    throw error;
  }

  return data || [];
}
