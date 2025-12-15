/**
 * Upload Service - Gestion des fichiers Supabase Storage
 *
 * PRODUCTION READY - Service complet pour:
 * - Upload de documents (devis, plans, photos, contrats)
 * - Gestion des métadonnées dans la table documents
 * - Génération d'URLs signées
 * - Extraction de texte PDF
 * - Organisation par projet/type
 */

import { supabase, getCurrentUser } from '@/lib/supabase';
import { pdfExtractorService } from '@/services/pdf/pdf-extractor.service';

// =============================================================================
// TYPES
// =============================================================================

export type DocumentType =
  | 'quote'          // Devis
  | 'invoice'        // Facture
  | 'plan'           // Plan architectural
  | 'photo'          // Photo chantier
  | 'contract'       // Contrat
  | 'amendment'      // Avenant
  | 'insurance'      // Attestation assurance
  | 'certification'  // Certification/qualification
  | 'pv_reception'   // PV de réception
  | 'situation'      // Situation de travaux
  | 'correspondence' // Correspondance
  | 'doe'            // DOE
  | 'other';         // Autre

export type DocumentCategory =
  | 'administrative'
  | 'technical'
  | 'financial'
  | 'legal'
  | 'other';

export type DocumentStatus = 'active' | 'archived' | 'deleted' | 'processing';

export interface UploadOptions {
  projectId?: string;
  companyId?: string;
  documentType: DocumentType;
  category?: DocumentCategory;
  title?: string;
  description?: string;
  tags?: string[];
  expiresAt?: Date;
  extractText?: boolean;
  isPublic?: boolean;
}

export interface DocumentMetadata {
  id: string;
  projectId?: string;
  companyId?: string;
  userId: string;
  fileName: string;
  originalName: string;
  filePath: string;
  fileSize: number;
  mimeType: string;
  documentType: DocumentType;
  category?: DocumentCategory;
  title?: string;
  description?: string;
  tags: string[];
  version: number;
  status: DocumentStatus;
  extractedText?: string;
  analysisResult?: Record<string, unknown>;
  isSigned: boolean;
  expiresAt?: Date;
  bucket: string;
  isPublic: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface UploadResult {
  success: boolean;
  document?: DocumentMetadata;
  url?: string;
  error?: string;
}

export interface SearchDocumentsParams {
  query?: string;
  documentType?: DocumentType;
  projectId?: string;
  category?: DocumentCategory;
  status?: DocumentStatus;
  limit?: number;
}

// =============================================================================
// CONFIGURATION
// =============================================================================

const BUCKETS = {
  documents: 'documents',
  photos: 'photos',
  public: 'public',
} as const;

const MAX_FILE_SIZES: Record<string, number> = {
  'application/pdf': 50 * 1024 * 1024, // 50MB
  'image/jpeg': 10 * 1024 * 1024, // 10MB
  'image/png': 10 * 1024 * 1024, // 10MB
  'image/webp': 10 * 1024 * 1024, // 10MB
  'application/msword': 20 * 1024 * 1024, // 20MB
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 20 * 1024 * 1024,
  'application/vnd.ms-excel': 20 * 1024 * 1024,
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 20 * 1024 * 1024,
  default: 10 * 1024 * 1024, // 10MB par défaut
};

const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain',
  'text/csv',
];

// =============================================================================
// SERVICE
// =============================================================================

export class UploadService {
  /**
   * Upload un fichier avec métadonnées
   */
  static async uploadDocument(
    file: File,
    options: UploadOptions
  ): Promise<UploadResult> {
    try {
      // Valider le fichier
      const validation = this.validateFile(file);
      if (!validation.valid) {
        return { success: false, error: validation.error };
      }

      // Obtenir l'utilisateur courant
      const user = await getCurrentUser();
      if (!user) {
        return { success: false, error: 'Utilisateur non authentifié' };
      }

      // Déterminer le bucket et le chemin
      const bucket = options.isPublic ? BUCKETS.public : BUCKETS.documents;
      const filePath = this.generateFilePath(file, options, user.id);

      // Upload vers Supabase Storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from(bucket)
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false,
        });

      if (uploadError) {
        console.error('[Upload] Storage error:', uploadError);
        return { success: false, error: `Échec de l'upload: ${uploadError.message}` };
      }

      // Extraire le texte si demandé (PDF)
      let extractedText: string | undefined;
      if (options.extractText && file.type === 'application/pdf') {
        try {
          extractedText = await pdfExtractorService.extractText(file);
        } catch (extractError) {
          console.warn('[Upload] Text extraction failed:', extractError);
          // Ne pas bloquer l'upload si l'extraction échoue
        }
      }

      // Créer l'enregistrement dans la table documents
      const { data: documentData, error: dbError } = await supabase
        .from('documents')
        .insert({
          project_id: options.projectId || null,
          company_id: options.companyId || null,
          user_id: user.id,
          file_name: uploadData.path.split('/').pop() || file.name,
          original_name: file.name,
          file_path: uploadData.path,
          file_size: file.size,
          mime_type: file.type,
          document_type: options.documentType,
          category: options.category || 'other',
          title: options.title || file.name,
          description: options.description,
          tags: options.tags || [],
          status: 'active',
          extracted_text: extractedText,
          text_extracted_at: extractedText ? new Date().toISOString() : null,
          expires_at: options.expiresAt?.toISOString() || null,
          bucket,
          is_public: options.isPublic || false,
          checksum: await this.calculateChecksum(file),
        })
        .select()
        .single();

      if (dbError) {
        // Si l'insertion en DB échoue, supprimer le fichier uploadé
        await supabase.storage.from(bucket).remove([uploadData.path]);
        console.error('[Upload] Database error:', dbError);
        return { success: false, error: `Échec de l'enregistrement: ${dbError.message}` };
      }

      // Obtenir l'URL
      let url: string;
      if (options.isPublic) {
        const { data: urlData } = supabase.storage
          .from(bucket)
          .getPublicUrl(uploadData.path);
        url = urlData.publicUrl;
      } else {
        const { data: signedData, error: signedError } = await supabase.storage
          .from(bucket)
          .createSignedUrl(uploadData.path, 3600); // 1 heure

        if (signedError) {
          url = '';
        } else {
          url = signedData.signedUrl;
        }
      }

      return {
        success: true,
        document: this.mapDocumentFromDB(documentData),
        url,
      };
    } catch (error) {
      console.error('[Upload] Unexpected error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erreur inattendue',
      };
    }
  }

  /**
   * Upload plusieurs fichiers
   */
  static async uploadMultipleDocuments(
    files: File[],
    options: Omit<UploadOptions, 'title' | 'description'>
  ): Promise<UploadResult[]> {
    const results: UploadResult[] = [];

    for (const file of files) {
      const result = await this.uploadDocument(file, {
        ...options,
        title: file.name,
      });
      results.push(result);
    }

    return results;
  }

  /**
   * Récupère un document par ID
   */
  static async getDocument(documentId: string): Promise<DocumentMetadata | null> {
    const { data, error } = await supabase
      .from('documents')
      .select('*')
      .eq('id', documentId)
      .single();

    if (error || !data) {
      console.error('[Upload] Get document error:', error);
      return null;
    }

    return this.mapDocumentFromDB(data);
  }

  /**
   * Liste les documents avec filtres
   */
  static async listDocuments(
    params: SearchDocumentsParams = {}
  ): Promise<DocumentMetadata[]> {
    const user = await getCurrentUser();
    if (!user) return [];

    let query = supabase
      .from('documents')
      .select('*')
      .eq('user_id', user.id)
      .eq('status', params.status || 'active')
      .order('created_at', { ascending: false });

    if (params.documentType) {
      query = query.eq('document_type', params.documentType);
    }

    if (params.projectId) {
      query = query.eq('project_id', params.projectId);
    }

    if (params.category) {
      query = query.eq('category', params.category);
    }

    if (params.limit) {
      query = query.limit(params.limit);
    }

    const { data, error } = await query;

    if (error) {
      console.error('[Upload] List documents error:', error);
      return [];
    }

    return (data || []).map(this.mapDocumentFromDB);
  }

  /**
   * Recherche fulltext dans les documents
   */
  static async searchDocuments(
    searchQuery: string,
    params: Omit<SearchDocumentsParams, 'query'> = {}
  ): Promise<DocumentMetadata[]> {
    const user = await getCurrentUser();
    if (!user) return [];

    const { data, error } = await supabase.rpc('search_documents', {
      p_user_id: user.id,
      p_search_query: searchQuery,
      p_document_type: params.documentType || null,
      p_project_id: params.projectId || null,
      p_status: params.status || 'active',
      p_limit: params.limit || 20,
    });

    if (error) {
      console.error('[Upload] Search error:', error);
      return [];
    }

    return (data || []).map(this.mapDocumentFromDB);
  }

  /**
   * Obtient les documents qui expirent bientôt
   */
  static async getExpiringDocuments(daysAhead: number = 30): Promise<DocumentMetadata[]> {
    const user = await getCurrentUser();
    if (!user) return [];

    const { data, error } = await supabase.rpc('get_expiring_documents', {
      p_user_id: user.id,
      p_days_ahead: daysAhead,
    });

    if (error) {
      console.error('[Upload] Get expiring documents error:', error);
      return [];
    }

    return (data || []).map(this.mapDocumentFromDB);
  }

  /**
   * Met à jour les métadonnées d'un document
   */
  static async updateDocument(
    documentId: string,
    updates: Partial<Pick<DocumentMetadata, 'title' | 'description' | 'tags' | 'category' | 'expiresAt'>>
  ): Promise<DocumentMetadata | null> {
    const { data, error } = await supabase
      .from('documents')
      .update({
        title: updates.title,
        description: updates.description,
        tags: updates.tags,
        category: updates.category,
        expires_at: updates.expiresAt?.toISOString(),
      })
      .eq('id', documentId)
      .select()
      .single();

    if (error) {
      console.error('[Upload] Update document error:', error);
      return null;
    }

    return this.mapDocumentFromDB(data);
  }

  /**
   * Archive un document (soft delete)
   */
  static async archiveDocument(documentId: string): Promise<boolean> {
    const { error } = await supabase
      .from('documents')
      .update({ status: 'archived' })
      .eq('id', documentId);

    if (error) {
      console.error('[Upload] Archive document error:', error);
      return false;
    }

    return true;
  }

  /**
   * Supprime définitivement un document
   */
  static async deleteDocument(documentId: string): Promise<boolean> {
    // Récupérer le document pour obtenir le chemin
    const doc = await this.getDocument(documentId);
    if (!doc) return false;

    // Supprimer le fichier du storage
    const { error: storageError } = await supabase.storage
      .from(doc.bucket)
      .remove([doc.filePath]);

    if (storageError) {
      console.error('[Upload] Storage delete error:', storageError);
      // Continuer quand même pour supprimer l'enregistrement DB
    }

    // Supprimer l'enregistrement de la base
    const { error: dbError } = await supabase
      .from('documents')
      .delete()
      .eq('id', documentId);

    if (dbError) {
      console.error('[Upload] Database delete error:', dbError);
      return false;
    }

    return true;
  }

  /**
   * Obtient une URL signée pour télécharger un document
   */
  static async getDownloadUrl(
    documentId: string,
    expiresIn: number = 3600
  ): Promise<string | null> {
    const doc = await this.getDocument(documentId);
    if (!doc) return null;

    if (doc.isPublic) {
      const { data } = supabase.storage
        .from(doc.bucket)
        .getPublicUrl(doc.filePath);
      return data.publicUrl;
    }

    const { data, error } = await supabase.storage
      .from(doc.bucket)
      .createSignedUrl(doc.filePath, expiresIn);

    if (error) {
      console.error('[Upload] Get download URL error:', error);
      return null;
    }

    return data.signedUrl;
  }

  /**
   * Télécharge un document
   */
  static async downloadDocument(documentId: string): Promise<Blob | null> {
    const doc = await this.getDocument(documentId);
    if (!doc) return null;

    const { data, error } = await supabase.storage
      .from(doc.bucket)
      .download(doc.filePath);

    if (error) {
      console.error('[Upload] Download error:', error);
      return null;
    }

    return data;
  }

  /**
   * Crée une nouvelle version d'un document
   */
  static async createNewVersion(
    originalDocumentId: string,
    newFile: File,
    options?: Partial<UploadOptions>
  ): Promise<UploadResult> {
    const originalDoc = await this.getDocument(originalDocumentId);
    if (!originalDoc) {
      return { success: false, error: 'Document original non trouvé' };
    }

    // Upload la nouvelle version
    const result = await this.uploadDocument(newFile, {
      projectId: originalDoc.projectId,
      companyId: originalDoc.companyId,
      documentType: originalDoc.documentType,
      category: originalDoc.category,
      title: options?.title || originalDoc.title,
      description: options?.description || originalDoc.description,
      tags: options?.tags || originalDoc.tags,
      expiresAt: options?.expiresAt,
      extractText: true,
      isPublic: originalDoc.isPublic,
    });

    if (result.success && result.document) {
      // Mettre à jour le numéro de version et la référence au parent
      await supabase
        .from('documents')
        .update({
          version: originalDoc.version + 1,
          parent_document_id: originalDocumentId,
        })
        .eq('id', result.document.id);

      // Archiver l'ancienne version
      await this.archiveDocument(originalDocumentId);
    }

    return result;
  }

  /**
   * Liste les documents d'un projet
   */
  static async getProjectDocuments(projectId: string): Promise<DocumentMetadata[]> {
    return this.listDocuments({ projectId, status: 'active' });
  }

  /**
   * Liste les documents d'une entreprise
   */
  static async getCompanyDocuments(companyId: string): Promise<DocumentMetadata[]> {
    const user = await getCurrentUser();
    if (!user) return [];

    const { data, error } = await supabase
      .from('documents')
      .select('*')
      .eq('company_id', companyId)
      .eq('status', 'active')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[Upload] Get company documents error:', error);
      return [];
    }

    return (data || []).map(this.mapDocumentFromDB);
  }

  // =============================================================================
  // MÉTHODES UTILITAIRES
  // =============================================================================

  /**
   * Valide un fichier avant upload
   */
  private static validateFile(file: File): { valid: boolean; error?: string } {
    // Vérifier le type MIME
    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      return {
        valid: false,
        error: `Type de fichier non autorisé: ${file.type}. Types acceptés: PDF, images, documents Office`,
      };
    }

    // Vérifier la taille
    const maxSize = MAX_FILE_SIZES[file.type] || MAX_FILE_SIZES.default;
    if (file.size > maxSize) {
      const maxSizeMB = Math.round(maxSize / (1024 * 1024));
      return {
        valid: false,
        error: `Fichier trop volumineux. Taille max: ${maxSizeMB} MB`,
      };
    }

    // Vérifier le nom du fichier
    if (!file.name || file.name.length > 255) {
      return {
        valid: false,
        error: 'Nom de fichier invalide ou trop long',
      };
    }

    return { valid: true };
  }

  /**
   * Génère un chemin de fichier unique
   */
  private static generateFilePath(
    file: File,
    options: UploadOptions,
    userId: string
  ): string {
    const timestamp = Date.now();
    const randomId = Math.random().toString(36).substring(2, 8);
    const extension = file.name.split('.').pop() || '';
    const sanitizedName = file.name
      .replace(/[^a-zA-Z0-9.-]/g, '_')
      .substring(0, 50);

    const parts: string[] = [userId];

    if (options.projectId) {
      parts.push(`projects/${options.projectId}`);
    }

    parts.push(options.documentType);
    parts.push(`${timestamp}_${randomId}_${sanitizedName}`);

    return parts.join('/');
  }

  /**
   * Calcule le checksum SHA-256 d'un fichier
   */
  private static async calculateChecksum(file: File): Promise<string> {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    } catch {
      return '';
    }
  }

  /**
   * Mappe un enregistrement DB vers DocumentMetadata
   */
  private static mapDocumentFromDB(row: any): DocumentMetadata {
    return {
      id: row.id,
      projectId: row.project_id,
      companyId: row.company_id,
      userId: row.user_id,
      fileName: row.file_name,
      originalName: row.original_name,
      filePath: row.file_path,
      fileSize: row.file_size,
      mimeType: row.mime_type,
      documentType: row.document_type,
      category: row.category,
      title: row.title,
      description: row.description,
      tags: row.tags || [],
      version: row.version,
      status: row.status,
      extractedText: row.extracted_text,
      analysisResult: row.analysis_result,
      isSigned: row.is_signed,
      expiresAt: row.expires_at ? new Date(row.expires_at) : undefined,
      bucket: row.bucket,
      isPublic: row.is_public,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }

  /**
   * Obtient les statistiques de stockage de l'utilisateur
   */
  static async getStorageStats(): Promise<{
    totalFiles: number;
    totalSize: number;
    byType: Record<DocumentType, { count: number; size: number }>;
  }> {
    const user = await getCurrentUser();
    if (!user) {
      return { totalFiles: 0, totalSize: 0, byType: {} as any };
    }

    const { data, error } = await supabase
      .from('documents')
      .select('document_type, file_size')
      .eq('user_id', user.id)
      .eq('status', 'active');

    if (error || !data) {
      return { totalFiles: 0, totalSize: 0, byType: {} as any };
    }

    const byType: Record<string, { count: number; size: number }> = {};
    let totalSize = 0;

    for (const doc of data) {
      totalSize += doc.file_size;

      if (!byType[doc.document_type]) {
        byType[doc.document_type] = { count: 0, size: 0 };
      }
      byType[doc.document_type].count++;
      byType[doc.document_type].size += doc.file_size;
    }

    return {
      totalFiles: data.length,
      totalSize,
      byType: byType as Record<DocumentType, { count: number; size: number }>,
    };
  }
}

export default UploadService;
