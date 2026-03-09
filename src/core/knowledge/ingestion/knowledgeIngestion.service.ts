/**
 * Knowledge Ingestion Service v1.0
 * Manages document upload, extraction, and indexing
 * Prepares knowledge base for RAG (Phase 30)
 */

import crypto from 'crypto';
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
 * Hash a chunk's content using SHA256
 * Used for deduplication to prevent re-embedding identical chunks
 */
function hashChunk(text: string): string {
  return crypto
    .createHash('sha256')
    .update(text)
    .digest('hex');
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

    // Step 3: Create chunk records with hash-based deduplication
    const chunksToInsert = [];
    let skippedDuplicates = 0;

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const hash = hashChunk(chunk.content);

      // Check if this chunk hash already exists in the database
      const { data: existingChunk, error: hashCheckError } = await supabase
        .from('knowledge_chunks')
        .select('id')
        .eq('chunk_hash', hash)
        .maybeSingle();

      if (hashCheckError) {
        warn('[KnowledgeIngestion] Error checking chunk hash:', hashCheckError.message);
        // Continue anyway - don't fail the entire ingestion on hash check error
      }

      if (existingChunk) {
        // Chunk with this hash already exists - skip it
        skippedDuplicates++;
        log('[KnowledgeIngestion] Skipping duplicate chunk (hash exists):', hash.substring(0, 8));
        continue;
      }

      // New chunk - add to insertion list with hash
      chunksToInsert.push({
        document_id: documentId,
        content: chunk.content,
        chunk_index: i,
        token_count: chunk.tokenCount,
        chunk_hash: hash,
        metadata: chunk.metadata ?? {},
      });
    }

    if (skippedDuplicates > 0) {
      log('[KnowledgeIngestion] Skipped', skippedDuplicates, 'duplicate chunks based on hash');
    }

    console.log("SUPABASE INSERT TABLE:", "knowledge_chunks");
    console.log("SUPABASE INSERT PAYLOAD:", JSON.stringify(chunksToInsert, null, 2));

    let insertedChunks: any;
    let chunkError: any;

    if (chunksToInsert.length === 0) {
      log('[KnowledgeIngestion] All chunks were duplicates - no new chunks to insert');
      insertedChunks = [];
    } else {
      try {
        const result = await supabase
          .from('knowledge_chunks')
          .insert(chunksToInsert)
          .select('id');
        chunkError = result.error;
        insertedChunks = result.data;

        if (chunkError) {
          console.error("SUPABASE INSERT ERROR:", chunkError);
        }
      } catch (e) {
        console.error("SUPABASE INSERT EXCEPTION:", e);
        chunkError = e;
      }

      if (chunkError) {
        throw new Error(`Chunk ingestion failed: ${chunkError.message}`);
      }
    }

    const insertedCount = insertedChunks?.length || 0;
    log('[KnowledgeIngestion] Chunks inserted:', insertedCount);

    // Step 4: Index chunks (for Phase 30 - RAG)
    const { indexChunks } = await import('./knowledgeIndex.service');
    await indexChunks(documentId, chunks);

    return {
      success: true,
      documentId: documentId,
      chunksCreated: insertedCount,
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

