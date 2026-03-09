/**
 * Knowledge Ingestion Service v1.0
 * Manages document upload, extraction, and indexing
 * Prepares knowledge base for RAG (Phase 30)
 */

import { supabase } from '@/lib/supabase';
import { log, warn, error, time, timeEnd } from '@/lib/logger';
import { normalizeText } from './textNormalizer.service';
import { classifyDocument } from './documentClassifier.service';
import { extractDocumentContent } from './documentExtractor.service';
import { chunkSmart } from './smartChunker.service';
import { filterChunks } from './chunkQualityFilter.service';
import { deduplicateChunks } from './semanticDeduplication.service';

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
  embedding_vector?: number[];
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
  userId: string | null,
  documentId?: string
): Promise<IngestionResult> {
  try {
    log('[KnowledgeIngestion] Starting ingestion for:', filename);


    // Step 1: Extract text (format-aware: PDF, DOCX, XLSX, CSV, TXT, MD)
    const rawText = await extractDocumentContent(fileBuffer, filename);
    log('[KnowledgeIngestion] Text extracted:', rawText.length, 'characters');

    // Step 1b: Normalize text (remove noise before chunking)
    const normalizedText = normalizeText(rawText);
    log('[KnowledgeIngestion] Text normalized:', normalizedText.length, 'characters');

    // Step 1c: Classify document type (used by future specialized chunking)
    const docType = classifyDocument(normalizedText);
    log('[KnowledgeIngestion] Document classified as:', docType);

    // Step 2: Chunk document using strategy matched to document type
    const rawChunks = chunkSmart(normalizedText, docType);
    log('[KnowledgeIngestion] Document chunked into', rawChunks.length, 'chunks');

    // Step 2b: Filter out low-quality chunks before embedding generation
    const qualityChunks = filterChunks(rawChunks);
    log('[KnowledgeIngestion] Chunks after quality filter:', qualityChunks.length);

    // Step 2c: Drop near-duplicate chunks already present in the vector index
    const smartChunks = await deduplicateChunks(qualityChunks);
    log('[KnowledgeIngestion] Chunks after deduplication:', smartChunks.length);

    // Map to the shape expected by indexChunks (adds positional fields)
    const chunks = smartChunks.map((c) => ({
      content: c.content,
      tokenCount: c.tokenCount,
      metadata: c.metadata ?? {},
      startIndex: 0,
      endIndex: c.content.length,
    }));

    if (!documentId) {
      throw new Error('documentId is required for ingestion');
    }

    log('[KnowledgeIngestion] Using provided document ID:', documentId);

    // Step 3: Create chunk records
    const chunkRecords = chunks.map((chunk, index) => ({
      document_id: documentId,
      content: chunk.content,
      chunk_index: index,
      token_count: chunk.tokenCount,
      metadata: chunk.metadata ?? {},
    }));

    console.log("SUPABASE INSERT TABLE:", "knowledge_chunks");
    console.log("SUPABASE INSERT PAYLOAD:", JSON.stringify(chunkRecords, null, 2));

    let chunkError: any;

    try {
      const result = await supabase
        .from('knowledge_chunks')
        .insert(chunkRecords);
      chunkError = result.error;

      if (chunkError) {
        console.error("SUPABASE INSERT ERROR:", chunkError);
      }
    } catch (e) {
      console.error("SUPABASE INSERT EXCEPTION:", e);
      chunkError = e;
    }

    if (chunkError) {
      throw new Error(`Failed to create chunks: ${chunkError.message}`);
    }

    log('[KnowledgeIngestion] Chunks inserted:', chunks.length);

    // Step 4: Index chunks (for Phase 30 - RAG)
    const { indexChunks } = await import('./knowledgeIndex.service');
    await indexChunks(documentId, chunks);

    return {
      success: true,
      documentId: documentId,
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

