/**
 * TORP Document Upload Service
 * Service d'upload et d'indexation de documents pour la base de connaissances
 *
 * Flux :
 * 1. Upload du document (PDF)
 * 2. Extraction du texte (OCR si nécessaire)
 * 3. Chunking intelligent
 * 4. Génération des embeddings
 * 5. Stockage dans pgvector
 */

import { supabase } from '@/lib/supabase';
import { OcrExtractorService } from '@/services/extraction/ocr-extractor.service';
import type { KnowledgeUpload } from '@/types/tender';

// =============================================================================
// TYPES
// =============================================================================

interface DocumentChunk {
  content: string;
  pageNumber?: number;
  sectionTitle?: string;
  chunkIndex: number;
  metadata?: Record<string, unknown>;
}

interface ProcessingResult {
  success: boolean;
  documentId?: string;
  chunksCount?: number;
  error?: string;
}

interface UploadOptions {
  docType: 'dtu' | 'norme' | 'guide' | 'fiche_technique' | 'reglementation' | 'autre';
  category?: string;
  subcategory?: string;
  codeReference?: string;
  autoProcess?: boolean;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const CHUNK_SIZE = 1000;         // Taille cible des chunks en caractères
const CHUNK_OVERLAP = 200;       // Chevauchement entre chunks
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB
const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'text/plain',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

// =============================================================================
// DOCUMENT UPLOAD SERVICE
// =============================================================================

export class DocumentUploadService {
  /**
   * Upload un document et lance le traitement
   */
  static async upload(
    file: File,
    userId: string,
    options: UploadOptions
  ): Promise<KnowledgeUpload> {
    // Valider le fichier
    this.validateFile(file);

    // Calculer le hash du fichier
    const fileHash = await this.calculateFileHash(file);

    // Vérifier si le document existe déjà
    const existing = await this.findByHash(fileHash);
    if (existing) {
      console.log('[DocumentUpload] Document already exists:', existing.id);
      return existing;
    }

    // Uploader vers Supabase Storage
    const filePath = `knowledge/${userId}/${Date.now()}_${file.name}`;
    const { error: uploadError } = await supabase.storage
      .from('documents')
      .upload(filePath, file);

    if (uploadError) {
      console.error('[DocumentUpload] Storage upload error:', uploadError);
      throw new Error(`Erreur upload: ${uploadError.message}`);
    }

    // Obtenir l'URL publique
    const { data: urlData } = supabase.storage
      .from('documents')
      .getPublicUrl(filePath);

    // Créer l'entrée dans la base
    const { data, error } = await supabase
      .from('knowledge_uploads')
      .insert({
        user_id: userId,
        original_filename: file.name,
        file_url: urlData.publicUrl,
        file_size: file.size,
        mime_type: file.type,
        file_hash: fileHash,
        doc_type: options.docType,
        category: options.category,
        subcategory: options.subcategory,
        code_reference: options.codeReference,
        status: 'pending',
        requires_ocr: file.type === 'application/pdf',
      })
      .select()
      .single();

    if (error) {
      console.error('[DocumentUpload] DB insert error:', error);
      throw error;
    }

    const upload = this.mapRowToUpload(data);

    // Lancer le traitement si demandé
    if (options.autoProcess) {
      // Traitement asynchrone
      this.processDocument(upload.id, file).catch(err => {
        console.error('[DocumentUpload] Background processing error:', err);
      });
    }

    return upload;
  }

  /**
   * Traite un document uploadé
   */
  static async processDocument(uploadId: string, file?: File): Promise<ProcessingResult> {
    console.log('[DocumentUpload] Starting processing for:', uploadId);

    // Mettre à jour le statut
    await this.updateStatus(uploadId, 'processing');

    try {
      // Récupérer les infos du document
      const upload = await this.getById(uploadId);
      if (!upload) {
        throw new Error('Document non trouvé');
      }

      // Si pas de fichier fourni, le télécharger
      let documentFile = file;
      if (!documentFile) {
        documentFile = await this.downloadFile(upload.fileUrl);
      }

      // Extraire le texte
      const extractionResult = await this.extractText(documentFile, upload.requiresOcr);

      // Mettre à jour les métadonnées extraites
      await supabase
        .from('knowledge_uploads')
        .update({
          extracted_title: extractionResult.title,
          pages_count: extractionResult.pagesCount,
          ocr_confidence: extractionResult.confidence,
        })
        .eq('id', uploadId);

      // Chunker le texte
      const chunks = this.chunkText(extractionResult.text, extractionResult.sections);

      // Créer le document dans knowledge_documents
      const { data: knowledgeDoc, error: docError } = await supabase
        .from('knowledge_documents')
        .insert({
          filename: upload.originalFilename,
          original_name: upload.originalFilename,
          file_path: upload.fileUrl,
          file_size: upload.fileSize,
          mime_type: upload.mimeType,
          doc_type: upload.docType,
          category: upload.category,
          subcategory: upload.subcategory,
          code_reference: upload.codeReference,
          title: extractionResult.title || upload.originalFilename,
          status: 'processing',
          chunks_count: chunks.length,
        })
        .select()
        .single();

      if (docError) {
        throw docError;
      }

      // Générer les embeddings et insérer les chunks
      await this.processChunks(knowledgeDoc.id, chunks);

      // Mettre à jour les statuts
      await supabase
        .from('knowledge_documents')
        .update({
          status: 'indexed',
          indexed_at: new Date().toISOString(),
        })
        .eq('id', knowledgeDoc.id);

      await supabase
        .from('knowledge_uploads')
        .update({
          status: 'indexed',
          document_id: knowledgeDoc.id,
          chunks_count: chunks.length,
          processing_completed_at: new Date().toISOString(),
        })
        .eq('id', uploadId);

      console.log('[DocumentUpload] Processing completed:', {
        uploadId,
        documentId: knowledgeDoc.id,
        chunksCount: chunks.length,
      });

      return {
        success: true,
        documentId: knowledgeDoc.id,
        chunksCount: chunks.length,
      };

    } catch (error) {
      console.error('[DocumentUpload] Processing error:', error);

      await supabase
        .from('knowledge_uploads')
        .update({
          status: 'error',
          processing_error: String(error),
          processing_completed_at: new Date().toISOString(),
        })
        .eq('id', uploadId);

      return {
        success: false,
        error: String(error),
      };
    }
  }

  /**
   * Liste les uploads d'un utilisateur
   */
  static async listByUser(
    userId: string,
    options?: { status?: string; docType?: string }
  ): Promise<KnowledgeUpload[]> {
    let query = supabase
      .from('knowledge_uploads')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (options?.status) {
      query = query.eq('status', options.status);
    }
    if (options?.docType) {
      query = query.eq('doc_type', options.docType);
    }

    const { data, error } = await query;

    if (error) {
      console.error('[DocumentUpload] List error:', error);
      throw error;
    }

    return (data || []).map(this.mapRowToUpload);
  }

  /**
   * Récupère un upload par ID
   */
  static async getById(uploadId: string): Promise<KnowledgeUpload | null> {
    const { data, error } = await supabase
      .from('knowledge_uploads')
      .select('*')
      .eq('id', uploadId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }

    return this.mapRowToUpload(data);
  }

  /**
   * Supprime un upload et ses données associées
   */
  static async delete(uploadId: string): Promise<void> {
    const upload = await this.getById(uploadId);
    if (!upload) return;

    // Supprimer le document de la base de connaissances si indexé
    if (upload.documentId) {
      await supabase
        .from('knowledge_chunks')
        .delete()
        .eq('document_id', upload.documentId);

      await supabase
        .from('knowledge_documents')
        .delete()
        .eq('id', upload.documentId);
    }

    // Supprimer le fichier du storage
    const filePath = new URL(upload.fileUrl).pathname.replace('/storage/v1/object/public/documents/', '');
    await supabase.storage.from('documents').remove([filePath]);

    // Supprimer l'entrée upload
    await supabase
      .from('knowledge_uploads')
      .delete()
      .eq('id', uploadId);
  }

  /**
   * Relance le traitement d'un document en erreur
   */
  static async retryProcessing(uploadId: string): Promise<ProcessingResult> {
    return this.processDocument(uploadId);
  }

  // ===========================================================================
  // EXTRACTION & CHUNKING
  // ===========================================================================

  /**
   * Extrait le texte d'un document
   */
  private static async extractText(
    file: File,
    requiresOcr: boolean
  ): Promise<{
    text: string;
    title?: string;
    pagesCount?: number;
    confidence?: number;
    sections?: Array<{ title: string; content: string; pageNumber?: number }>;
  }> {
    if (file.type === 'application/pdf') {
      const ocrService = new OcrExtractorService();
      const result = await ocrService.extractFromFile(file);

      // Extraire les sections depuis les pages
      const sections = result.pages.map(page => {
        // Chercher un titre potentiel (première ligne en gras ou première ligne)
        const headerLine = page.lines.find(l => l.isHeader);
        return {
          title: headerLine?.text || `Page ${page.pageNumber}`,
          content: page.text,
          pageNumber: page.pageNumber,
        };
      });

      return {
        text: result.text,
        title: result.metadata.title || this.extractTitleFromText(result.text),
        pagesCount: result.metadata.pageCount,
        confidence: result.confidence,
        sections,
      };
    }

    // Fichier texte simple
    const text = await file.text();
    return {
      text,
      title: this.extractTitleFromText(text),
      pagesCount: 1,
      confidence: 100,
    };
  }

  /**
   * Découpe le texte en chunks avec chevauchement
   */
  private static chunkText(
    text: string,
    sections?: Array<{ title: string; content: string; pageNumber?: number }>
  ): DocumentChunk[] {
    const chunks: DocumentChunk[] = [];

    if (sections && sections.length > 0) {
      // Chunking par sections
      let globalIndex = 0;

      sections.forEach(section => {
        const sectionChunks = this.splitIntoChunks(section.content);

        sectionChunks.forEach((chunkContent, localIndex) => {
          chunks.push({
            content: chunkContent,
            pageNumber: section.pageNumber,
            sectionTitle: section.title,
            chunkIndex: globalIndex++,
            metadata: {
              sectionIndex: localIndex,
              isFirstOfSection: localIndex === 0,
            },
          });
        });
      });
    } else {
      // Chunking simple
      const textChunks = this.splitIntoChunks(text);

      textChunks.forEach((chunkContent, index) => {
        chunks.push({
          content: chunkContent,
          chunkIndex: index,
        });
      });
    }

    return chunks;
  }

  /**
   * Divise un texte en chunks de taille fixe avec chevauchement
   */
  private static splitIntoChunks(text: string): string[] {
    const chunks: string[] = [];
    const sentences = text.split(/(?<=[.!?])\s+/);

    let currentChunk = '';

    for (const sentence of sentences) {
      if (currentChunk.length + sentence.length > CHUNK_SIZE) {
        if (currentChunk) {
          chunks.push(currentChunk.trim());

          // Garder le chevauchement
          const words = currentChunk.split(' ');
          const overlapWords = words.slice(-Math.floor(CHUNK_OVERLAP / 6));
          currentChunk = overlapWords.join(' ') + ' ' + sentence;
        } else {
          // Phrase trop longue, la diviser
          if (sentence.length > CHUNK_SIZE) {
            const parts = sentence.match(new RegExp(`.{1,${CHUNK_SIZE}}`, 'g')) || [];
            chunks.push(...parts);
            currentChunk = '';
          } else {
            currentChunk = sentence;
          }
        }
      } else {
        currentChunk += (currentChunk ? ' ' : '') + sentence;
      }
    }

    if (currentChunk.trim()) {
      chunks.push(currentChunk.trim());
    }

    return chunks;
  }

  /**
   * Traite les chunks : génère les embeddings et les insère
   */
  private static async processChunks(
    documentId: string,
    chunks: DocumentChunk[]
  ): Promise<void> {
    console.log(`[DocumentUpload] Processing ${chunks.length} chunks for document ${documentId}`);

    // Traiter par batch pour éviter les timeouts
    const batchSize = 10;

    for (let i = 0; i < chunks.length; i += batchSize) {
      const batch = chunks.slice(i, i + batchSize);

      // Générer les embeddings
      const embeddings = await this.generateEmbeddings(batch.map(c => c.content));

      // Insérer les chunks avec embeddings
      const chunkRecords = batch.map((chunk, j) => ({
        document_id: documentId,
        content: chunk.content,
        content_length: chunk.content.length,
        chunk_index: chunk.chunkIndex,
        page_number: chunk.pageNumber,
        section_title: chunk.sectionTitle,
        embedding: embeddings[j],
        metadata: chunk.metadata || {},
      }));

      const { error } = await supabase
        .from('knowledge_chunks')
        .insert(chunkRecords);

      if (error) {
        console.error('[DocumentUpload] Chunk insert error:', error);
        throw error;
      }

      console.log(`[DocumentUpload] Processed batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(chunks.length / batchSize)}`);
    }
  }

  /**
   * Génère les embeddings via OpenAI
   */
  private static async generateEmbeddings(texts: string[]): Promise<number[][]> {
    // Pour le MVP, on utilise une fonction Supabase Edge Function
    // ou directement l'API OpenAI si configurée

    const OPENAI_API_KEY = import.meta.env.VITE_OPENAI_API_KEY;

    if (!OPENAI_API_KEY) {
      console.warn('[DocumentUpload] OpenAI API key not configured, using mock embeddings');
      // Retourner des embeddings vides (1536 dimensions pour text-embedding-3-small)
      return texts.map(() => new Array(1536).fill(0));
    }

    try {
      const response = await fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'text-embedding-3-small',
          input: texts,
        }),
      });

      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.status}`);
      }

      const data = await response.json();
      return data.data.map((item: { embedding: number[] }) => item.embedding);

    } catch (error) {
      console.error('[DocumentUpload] Embedding generation error:', error);
      // Fallback : embeddings vides
      return texts.map(() => new Array(1536).fill(0));
    }
  }

  // ===========================================================================
  // HELPERS
  // ===========================================================================

  /**
   * Valide un fichier avant upload
   */
  private static validateFile(file: File): void {
    if (file.size > MAX_FILE_SIZE) {
      throw new Error(`Le fichier dépasse la taille maximale (${MAX_FILE_SIZE / 1024 / 1024} MB)`);
    }

    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      throw new Error(`Type de fichier non supporté. Types acceptés : PDF, TXT, DOCX`);
    }
  }

  /**
   * Calcule le hash SHA-256 d'un fichier
   */
  private static async calculateFileHash(file: File): Promise<string> {
    const buffer = await file.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Cherche un document par son hash
   */
  private static async findByHash(hash: string): Promise<KnowledgeUpload | null> {
    const { data, error } = await supabase
      .from('knowledge_uploads')
      .select('*')
      .eq('file_hash', hash)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }

    return this.mapRowToUpload(data);
  }

  /**
   * Télécharge un fichier depuis une URL
   */
  private static async downloadFile(url: string): Promise<File> {
    const response = await fetch(url);
    const blob = await response.blob();
    const filename = url.split('/').pop() || 'document';
    return new File([blob], filename, { type: blob.type });
  }

  /**
   * Met à jour le statut d'un upload
   */
  private static async updateStatus(
    uploadId: string,
    status: string,
    error?: string
  ): Promise<void> {
    const updates: Record<string, unknown> = {
      status,
      updated_at: new Date().toISOString(),
    };

    if (status === 'processing') {
      updates.processing_started_at = new Date().toISOString();
    }

    if (error) {
      updates.processing_error = error;
    }

    await supabase
      .from('knowledge_uploads')
      .update(updates)
      .eq('id', uploadId);
  }

  /**
   * Extrait un titre potentiel depuis le texte
   */
  private static extractTitleFromText(text: string): string | undefined {
    // Chercher un pattern de titre DTU
    const dtuMatch = text.match(/DTU\s+[\d.]+(?:\s*[-:]\s*[^\n]+)?/i);
    if (dtuMatch) return dtuMatch[0].trim();

    // Chercher un pattern NF
    const nfMatch = text.match(/NF\s+[A-Z]\s*[\d-]+(?:\s*[-:]\s*[^\n]+)?/i);
    if (nfMatch) return nfMatch[0].trim();

    // Prendre la première ligne non vide
    const firstLine = text.split('\n').find(l => l.trim().length > 5);
    if (firstLine && firstLine.length < 200) {
      return firstLine.trim();
    }

    return undefined;
  }

  /**
   * Mappe une row DB vers un KnowledgeUpload
   */
  private static mapRowToUpload(row: Record<string, unknown>): KnowledgeUpload {
    return {
      id: row.id as string,
      userId: row.user_id as string | undefined,
      originalFilename: row.original_filename as string,
      fileUrl: row.file_url as string,
      fileSize: row.file_size as number,
      mimeType: row.mime_type as string,
      fileHash: row.file_hash as string | undefined,
      docType: row.doc_type as KnowledgeUpload['docType'],
      category: row.category as string | undefined,
      subcategory: row.subcategory as string | undefined,
      extractedTitle: row.extracted_title as string | undefined,
      extractedAuthor: row.extracted_author as string | undefined,
      extractedDate: row.extracted_date ? new Date(row.extracted_date as string) : undefined,
      codeReference: row.code_reference as string | undefined,
      status: row.status as KnowledgeUpload['status'],
      processingStartedAt: row.processing_started_at ? new Date(row.processing_started_at as string) : undefined,
      processingCompletedAt: row.processing_completed_at ? new Date(row.processing_completed_at as string) : undefined,
      processingError: row.processing_error as string | undefined,
      pagesCount: row.pages_count as number | undefined,
      chunksCount: row.chunks_count as number | undefined,
      documentId: row.document_id as string | undefined,
      ocrConfidence: row.ocr_confidence as number | undefined,
      requiresOcr: row.requires_ocr as boolean,
      isValidated: row.is_validated as boolean,
      validatedBy: row.validated_by as string | undefined,
      validatedAt: row.validated_at ? new Date(row.validated_at as string) : undefined,
      metadata: row.metadata as Record<string, unknown> | undefined,
      createdAt: new Date(row.created_at as string),
      updatedAt: new Date(row.updated_at as string),
    };
  }
}

export default DocumentUploadService;
