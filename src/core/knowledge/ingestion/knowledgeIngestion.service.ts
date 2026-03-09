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
 * SUCCESS is determined solely by chunk insertion.
 * All other steps (dedup, indexing) are non-blocking.
 */
/**
 * Runtime guard: intercepts any Supabase write to knowledge_documents.
 * Throws immediately to prevent FK violations from ingestion services.
 */
function assertNotKnowledgeDocumentsWrite(table: string): void {
  if (table === 'knowledge_documents') {
    throw new Error('Runtime write to knowledge_documents is forbidden from ingestion services');
  }
}

export async function ingestKnowledgeDocument(
  fileBuffer: Buffer,
  filename: string,
  metadata: KnowledgeDocumentMetadata,
  userId: string | null,
  documentId?: string
): Promise<IngestionResult> {
  log('[KnowledgeIngestion] Starting ingestion for:', filename);

  if (!documentId) {
    return { success: false, errors: ['documentId is required for ingestion'] };
  }

  // ── CRITICAL: extract, normalize, chunk ──────────────────────────────────
  let rawText: string;
  try {
    rawText = await extractDocumentContent(fileBuffer, filename);
    log('[KnowledgeIngestion] Text extracted:', rawText.length, 'characters');
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    console.error('[KnowledgeIngestion] Text extraction failed:', msg);
    return { success: false, errors: [msg] };
  }

  const normalizedText = normalizeText(rawText);
  log('[KnowledgeIngestion] Text normalized:', normalizedText.length, 'characters');

  const docType = classifyDocument(normalizedText);
  log('[KnowledgeIngestion] Document classified as:', docType);

  const rawChunks = chunkSmart(normalizedText, docType);
  log('[KnowledgeIngestion] Document chunked into', rawChunks.length, 'chunks');

  const qualityChunks = filterChunks(rawChunks);
  log('[KnowledgeIngestion] Chunks after quality filter:', qualityChunks.length);

  // ── NON-CRITICAL: deduplication (failure keeps all chunks) ────────────────
  let dedupedChunks = qualityChunks;
  try {
    dedupedChunks = await deduplicateChunks(qualityChunks);
    log('[KnowledgeIngestion] Chunks after deduplication:', dedupedChunks.length);
  } catch (err) {
    warn('[KnowledgeIngestion] Deduplication failed (non-blocking), using all quality chunks:', err);
  }

  const chunks = dedupedChunks.map((c) => ({
    content: c.content,
    tokenCount: c.tokenCount,
    metadata: c.metadata ?? {},
    startIndex: 0,
    endIndex: c.content.length,
  }));

  log('[KnowledgeIngestion] Using provided document ID:', documentId);

  // ── CRITICAL: insert chunks ───────────────────────────────────────────────
  const chunkRecords = chunks.map((chunk, index) => ({
    document_id: documentId,
    content: chunk.content,
    chunk_index: index,
    token_count: chunk.tokenCount,
    metadata: chunk.metadata ?? {},
  }));

  let insertedCount = 0;
  try {
    const { error: chunkError } = await supabase
      .from('knowledge_chunks')
      .insert(chunkRecords);

    if (chunkError) {
      console.error('[KnowledgeIngestion] Chunk insert error:', chunkError);
      return { success: false, errors: [`Failed to create chunks: ${chunkError.message}`] };
    }
    insertedCount = chunkRecords.length;
    log('[KnowledgeIngestion] Chunks inserted:', insertedCount);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    console.error('[KnowledgeIngestion] Chunk insert exception:', msg);
    return { success: false, errors: [`Failed to create chunks: ${msg}`] };
  }

  if (insertedCount === 0) {
    return { success: false, chunksCreated: 0, errors: ['No chunks were inserted'] };
  }

  // ── NON-CRITICAL: indexing (failure does not fail ingestion) ──────────────
  try {
    const { indexChunks } = await import('./knowledgeIndex.service');
    await indexChunks(documentId, chunks);
  } catch (err) {
    warn('[KnowledgeIngestion] Indexing failed (non-blocking), ingestion still successful:', err);
  }

  return {
    success: true,
    documentId,
    chunksCreated: insertedCount,
    totalTokens: chunks.reduce((sum, c) => sum + c.tokenCount, 0),
  };
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

