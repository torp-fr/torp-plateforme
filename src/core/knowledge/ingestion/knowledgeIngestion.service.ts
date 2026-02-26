/**
 * Knowledge Ingestion Service v1.0
 * Manages document upload, extraction, and indexing
 * Prepares knowledge base for RAG (Phase 30)
 */

import { supabase } from '@/lib/supabase';
import { log, warn, error, time, timeEnd } from '@/lib/logger';

/**
 * Knowledge document metadata
 */
export interface KnowledgeDocumentMetadata {
  title: string;
  category: 'norme' | 'fiche_technique' | 'jurisprudence' | 'manuel' | 'autre';
  source?: string;
  version?: string;
}

/**
 * Knowledge document record
 */
export interface KnowledgeDocument {
  id: string;
  title: string;
  category: string;
  source?: string;
  version?: string;
  file_size: number;
  created_by: string;
  created_at: string;
  chunk_count: number;
}

/**
 * Knowledge chunk record
 */
export interface KnowledgeChunk {
  id: string;
  document_id: string;
  content: string;
  chunk_index: number;
  token_count: number;
  embedding?: number[];
  created_at: string;
}

/**
 * Ingestion result
 */
export interface IngestionResult {
  success: boolean;
  documentId?: string;
  chunksCreated?: number;
  totalTokens?: number;
  errors?: string[];
}


/**
 * Extract text from document buffer
 * Supports: .txt, .md, .pdf (text), .docx (text)
 */
export function extractTextFromBuffer(
  buffer: Buffer,
  filename: string
): string {
  try {
    // For now, support plain text and markdown
    // PDF/DOCX would require additional libraries (pdfjs, docx)
    if (filename.endsWith('.txt') || filename.endsWith('.md')) {
      return buffer.toString('utf-8');
    }

    // For other formats, attempt UTF-8 decode
    const text = buffer.toString('utf-8');
    if (text.length > 0) {
      return text;
    }

    throw new Error(`Unsupported file format: ${filename}`);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[KnowledgeIngestion] Text extraction failed:', errorMessage);
    throw error;
  }
}

/**
 * Ingest knowledge document
 */
export async function ingestKnowledgeDocument(
  fileBuffer: Buffer,
  filename: string,
  metadata: KnowledgeDocumentMetadata,
  userId: string
): Promise<IngestionResult> {
  try {
    log('[KnowledgeIngestion] Starting ingestion for:', filename);


    // Step 1: Extract text
    const text = extractTextFromBuffer(fileBuffer, filename);
    log('[KnowledgeIngestion] Text extracted:', text.length, 'characters');

    // Step 2: Import chunking service
    const { chunkDocument } = await import('./knowledgeChunker.service');
    const chunks = chunkDocument(text);
    log('[KnowledgeIngestion] Document chunked into', chunks.length, 'chunks');

    // Step 3: Create document record
    const { data: docData, error: docError } = await supabase
      .from('knowledge_documents')
      .insert([
        {
          title: metadata.title,
          category: metadata.category,
          source: metadata.source,
          version: metadata.version || '1.0',
          file_size: fileBuffer.length,
          created_by: userId,
          chunk_count: chunks.length,
        },
      ])
      .select('id')
      .single();

    if (docError || !docData) {
      throw new Error(`Failed to create document record: ${docError?.message}`);
    }

    log('[KnowledgeIngestion] Document created:', docData.id);

    // Step 4: Create chunk records
    const chunkRecords = chunks.map((chunk, index) => ({
      document_id: docData.id,
      content: chunk.content,
      chunk_index: index,
      token_count: chunk.tokenCount,
    }));

    const { error: chunkError } = await supabase
      .from('knowledge_chunks')
      .insert(chunkRecords);

    if (chunkError) {
      throw new Error(`Failed to create chunks: ${chunkError.message}`);
    }

    log('[KnowledgeIngestion] Chunks inserted:', chunks.length);

    // Step 5: Index chunks (for Phase 30 - RAG)
    const { indexChunks } = await import('./knowledgeIndex.service');
    await indexChunks(docData.id, chunks);

    return {
      success: true,
      documentId: docData.id,
      chunksCreated: chunks.length,
      totalTokens: chunks.reduce((sum, c) => sum + c.tokenCount, 0),
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[KnowledgeIngestion] Ingestion failed:', errorMessage);

    return {
      success: false,
      errors: [errorMessage],
    };
  }
}

/**
 * Search knowledge base
 */
export async function searchKnowledge(query: string, limit: number = 10): Promise<KnowledgeChunk[]> {
  try {
    log('[KnowledgeIngestion] Searching for:', query);


    // Full-text search on chunk content
    const { data, error } = await supabase
      .from('knowledge_chunks')
      .select('*')
      .ilike('content', `%${query}%`)
      .limit(limit);

    if (error) {
      throw new Error(`Search failed: ${error.message}`);
    }

    log('[KnowledgeIngestion] Found', data?.length || 0, 'results');
    return data || [];
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[KnowledgeIngestion] Search failed:', errorMessage);
    return [];
  }
}

/**
 * Get knowledge base stats
 */
export async function getKnowledgeStats(): Promise<{
  documentCount: number;
  chunkCount: number;
  totalSize: number;
}> {
  try {

    const { data: docs, error: docsError } = await supabase
      .from('knowledge_documents')
      .select('file_size');

    const { data: chunks, error: chunksError } = await supabase
      .from('knowledge_chunks')
      .select('id');

    if (docsError || chunksError) {
      throw new Error('Failed to fetch stats');
    }

    return {
      documentCount: docs?.length || 0,
      chunkCount: chunks?.length || 0,
      totalSize: (docs || []).reduce((sum, d: any) => sum + (d.file_size || 0), 0),
    };
  } catch (error) {
    warn('[KnowledgeIngestion] Failed to get stats:', error);
    return { documentCount: 0, chunkCount: 0, totalSize: 0 };
  }
}

/**
 * Get recent documents
 */
export async function getRecentDocuments(limit: number = 10): Promise<KnowledgeDocument[]> {
  try {

    const { data, error } = await supabase
      .from('knowledge_documents')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      throw new Error(`Failed to fetch documents: ${error.message}`);
    }

    return data || [];
  } catch (error) {
    warn('[KnowledgeIngestion] Failed to fetch documents:', error);
    return [];
  }
}

/**
 * Delete document and its chunks
 */
export async function deleteKnowledgeDocument(documentId: string): Promise<boolean> {
  try {

    // Delete chunks first (cascade)
    await supabase.from('knowledge_chunks').delete().eq('document_id', documentId);

    // Delete document
    const { error } = await supabase
      .from('knowledge_documents')
      .delete()
      .eq('id', documentId);

    if (error) {
      throw new Error(`Failed to delete document: ${error.message}`);
    }

    log('[KnowledgeIngestion] Document deleted:', documentId);
    return true;
  } catch (error) {
    console.error('[KnowledgeIngestion] Delete failed:', error);
    return false;
  }
}
