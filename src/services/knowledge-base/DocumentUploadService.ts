/**
 * Document Upload Service
 * Gère l'upload et le traitement initial des documents
 */

import { supabase } from '@/lib/supabase';
import type { DocumentUploadRequest, KBDocument, ProcessedDocument } from './types';
import { log, warn, error, time, timeEnd } from '@/lib/logger';

export class DocumentUploadService {
  private readonly STORAGE_BUCKET = 'knowledge-base';
  private readonly MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

  /**
   * Upload un document brut
   */
  async uploadDocument(request: DocumentUploadRequest): Promise<KBDocument> {
    try {
      // Valider le fichier
      this.validateFile(request.file);

      // Créer nom de fichier unique
      const timestamp = new Date().getTime();
      const fileName = `${request.docType}/${timestamp}_${request.file.name}`;

      // Upload dans Supabase Storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from(this.STORAGE_BUCKET)
        .upload(fileName, request.file, { upsert: false });

      if (uploadError) throw uploadError;

      // Créer record dans DB
      const { data: docData, error: dbError } = await supabase
        .from('knowledge_base_documents')
        .insert({
          title: request.title || request.file.name,
          doc_type: request.docType,
          source_file: fileName,
          status: 'raw',
          metadata: {
            ...request.metadata,
            fileSize: request.file.size,
            mimeType: request.file.type,
          },
          uploaded_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (dbError) throw dbError;

      log(`✅ Document uploaded: ${docData.id}`);

      return this.mapToKBDocument(docData);
    } catch (error) {
      console.error('❌ Upload error:', error);
      throw error;
    }
  }

  /**
   * Récupérer un document
   */
  async getDocument(docId: string): Promise<KBDocument | null> {
    try {
      const { data, error } = await supabase
        .from('knowledge_base_documents')
        .select()
        .eq('id', docId)
        .single();

      if (error) throw error;
      return data ? this.mapToKBDocument(data) : null;
    } catch (error) {
      console.error('❌ Get document error:', error);
      throw error;
    }
  }

  /**
   * Lister tous les documents
   */
  async listDocuments(docType?: string) {
    try {
      let query = supabase
        .from('knowledge_base_documents')
        .select()
        .order('created_at', { ascending: false });

      if (docType) {
        query = query.eq('doc_type', docType);
      }

      const { data, error } = await query;

      if (error) throw error;
      return (data || []).map(doc => this.mapToKBDocument(doc));
    } catch (error) {
      console.error('❌ List documents error:', error);
      throw error;
    }
  }

  /**
   * Mettre à jour le statut d'un document
   */
  async updateDocumentStatus(
    docId: string,
    status: 'raw' | 'processing' | 'vectorized'
  ): Promise<void> {
    try {
      const { error } = await supabase
        .from('knowledge_base_documents')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', docId);

      if (error) throw error;
      log(`✅ Document status updated: ${docId} → ${status}`);
    } catch (error) {
      console.error('❌ Update status error:', error);
      throw error;
    }
  }

  /**
   * Supprimer un document
   */
  async deleteDocument(docId: string): Promise<void> {
    try {
      // Récupérer le fichier
      const doc = await this.getDocument(docId);
      if (!doc) throw new Error('Document not found');

      // Supprimer du storage
      await supabase.storage
        .from(this.STORAGE_BUCKET)
        .remove([doc.sourceFile]);

      // Supprimer les chunks (cascade delete dans DB)
      await supabase
        .from('knowledge_base_documents')
        .delete()
        .eq('id', docId);

      log(`✅ Document deleted: ${docId}`);
    } catch (error) {
      console.error('❌ Delete error:', error);
      throw error;
    }
  }

  /**
   * Valider un fichier
   */
  private validateFile(file: File): void {
    // Vérifier la taille
    if (file.size > this.MAX_FILE_SIZE) {
      throw new Error(`File too large: ${file.size / 1024 / 1024}MB > 50MB`);
    }

    // Vérifier le type MIME
    const allowedTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'image/jpeg',
      'image/png',
    ];

    if (!allowedTypes.includes(file.type)) {
      throw new Error(`File type not allowed: ${file.type}`);
    }

    // Vérifier que le fichier n'est pas vide
    if (file.size === 0) {
      throw new Error('File is empty');
    }
  }

  /**
   * Mapper le document DB vers notre type
   */
  private mapToKBDocument(doc: any): KBDocument {
    return {
      id: doc.id,
      title: doc.title,
      docType: doc.doc_type,
      sourceFile: doc.source_file,
      uploadedAt: doc.uploaded_at,
      status: doc.status,
      metadata: doc.metadata || {},
      createdAt: doc.created_at,
    };
  }

  /**
   * Télécharger un document pour traitement
   */
  async downloadDocument(sourceFile: string): Promise<Blob> {
    try {
      const { data, error } = await supabase.storage
        .from(this.STORAGE_BUCKET)
        .download(sourceFile);

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('❌ Download error:', error);
      throw error;
    }
  }

  /**
   * Obtenir l'URL publique d'un document (si nécessaire)
   */
  getPublicUrl(sourceFile: string): string {
    const { data } = supabase.storage
      .from(this.STORAGE_BUCKET)
      .getPublicUrl(sourceFile);

    return data.publicUrl;
  }
}

export default new DocumentUploadService();
